import type {
  AcpConfigOption,
  AcpContentBlock,
  AcpEvent,
  AcpSessionRecord,
  Session,
} from '@devmentorai/shared';
export type AcpCatalogEntry = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  version?: string;
  source: string;
  installState: string;
  authState: string;
  authMethods: Array<{ id: string; description: string }>;
  platformAvailability: { available: boolean; key: string; reason?: string };
};

export type AcpProfile = {
  id: string;
  name: string;
  agentId?: string;
  custom?: boolean;
  cmd?: string;
  args: string[];
  env: Record<string, string>;
  defaultCwd: string;
  transport: 'stdio' | 'tcp';
  host?: string;
  port?: number;
};

type JsonRpcId = string | number;
type JsonRpcMessage = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type AcpPermissionRequest = {
  sessionId: string;
  toolCall?: unknown;
  options: Array<{ optionId: string; name: string; kind: string }>;
  [key: string]: unknown;
};

export type AcpPermissionHandler = (
  request: AcpPermissionRequest
) => Promise<{ outcome: { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } }>;
export type AcpPermissionDecision = Awaited<ReturnType<AcpPermissionHandler>>;

export type AcpClientOptions = {
  url: string;
  reconnect?: boolean;
  permissionHandler?: AcpPermissionHandler;
  reconnectDelayMs?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class AcpClient {
  private readonly url: string;
  private reconnect: boolean;
  private permissionHandler: AcpPermissionHandler;
  private readonly reconnectDelayMs: number;
  private socket: WebSocket | undefined;
  private connectPromise: Promise<void> | undefined;
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private eventHandlers = new Set<(sessionId: string, seq: number, event: AcpEvent) => void>();
  private connectionHandlers = new Set<(connected: boolean) => void>();
  private readonly permissionRequests = new Set<(request: AcpPermissionRequest) => void>();
  private readonly lastSequences = new Map<string, number>();

  constructor(options: AcpClientOptions) {
    this.url = options.url;
    this.reconnect = options.reconnect ?? true;
    this.permissionHandler =
      options.permissionHandler ?? (async () => ({ outcome: { outcome: 'cancelled' } }));
    this.reconnectDelayMs = options.reconnectDelayMs ?? 500;
  }

  onEvent(handler: (sessionId: string, seq: number, event: AcpEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onPermissionRequest(handler: (request: AcpPermissionRequest) => void): () => void {
    this.permissionRequests.add(handler);
    return () => this.permissionRequests.delete(handler);
  }

  setPermissionHandler(handler: AcpPermissionHandler): void {
    this.permissionHandler = handler;
  }

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    const promise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.onopen = () => {
        for (const handler of this.connectionHandlers) handler(true);
        resolve();
        void this.replayKnownSessions();
      };
      socket.onerror = () => reject(new Error('ACP WebSocket connection failed'));
      socket.onmessage = (message) => {
        void this.handleMessage(message.data);
      };
      socket.onclose = () => {
        if (this.connectPromise === promise) this.connectPromise = undefined;
        for (const pending of this.pending.values())
          pending.reject(new Error('ACP WebSocket closed'));
        this.pending.clear();
        for (const handler of this.connectionHandlers) handler(false);
        if (this.reconnect) this.scheduleReconnect();
      };
    });
    this.connectPromise = promise;
    void promise.then(
      () => {
        if (this.connectPromise === promise) this.connectPromise = undefined;
      },
      () => {
        if (this.connectPromise === promise) this.connectPromise = undefined;
      }
    );
    return promise;
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.reconnect = false;
    this.socket?.close();
    this.socket = undefined;
  }

  async createSession(profileId: string | undefined, cwd: string): Promise<AcpSessionRecord> {
    return this.request<AcpSessionRecord>('ui/session.create', {
      ...(profileId ? { profileId } : {}),
      cwd,
    });
  }

  async loadSession(sessionId: string): Promise<{ supported: boolean }> {
    return this.request<{ supported: boolean }>('ui/session.load', { sessionId });
  }

  async listAgentSessions(): Promise<Session[]> {
    return this.request<Session[]>('ui/session.agent_list', {});
  }

  async prompt(sessionId: string, prompt: string | AcpContentBlock[]): Promise<void> {
    await this.request('ui/session.prompt', { sessionId, prompt });
  }

  async cancel(sessionId: string): Promise<void> {
    await this.request('ui/session.cancel', { sessionId });
  }

  async setConfigOption(
    sessionId: string,
    configId: string,
    value: string | boolean
  ): Promise<AcpConfigOption[]> {
    return this.request<AcpConfigOption[]>('ui/session.set_config_option', {
      sessionId,
      configId,
      value,
    });
  }

  async revokePermission(sessionId: string, tool: string): Promise<void> {
    await this.request('ui/permissions.revoke', { sessionId, tool });
  }

  async listAgents(): Promise<AcpCatalogEntry[]> {
    return this.request<AcpCatalogEntry[]>('ui/agents.list', {});
  }

  async listProfiles(): Promise<AcpProfile[]> {
    return this.request<AcpProfile[]>('ui/agents.profiles.list', {});
  }

  async createProfile(profile: Omit<AcpProfile, 'id'>): Promise<AcpProfile> {
    return this.request<AcpProfile>('ui/agents.create_profile', profile);
  }

  async updateProfile(id: string, patch: Partial<AcpProfile>): Promise<AcpProfile> {
    return this.request<AcpProfile>('ui/agents.update_profile', { id, ...patch });
  }

  async deleteProfile(id: string): Promise<void> {
    await this.request('ui/agents.delete_profile', { id });
  }

  async installAgent(agentId: string): Promise<AcpCatalogEntry> {
    return this.request<AcpCatalogEntry>('ui/agents.install', { agentId });
  }

  async uninstallAgent(agentId: string): Promise<void> {
    await this.request('ui/agents.uninstall', { agentId });
  }

  async probeAgent(profileId: string): Promise<unknown> {
    return this.request('ui/agents.probe', { profileId });
  }

  async replay(
    sessionId: string,
    lastSeq: number
  ): Promise<{
    events: Array<{ seq: number; event: AcpEvent }>;
    gap: boolean;
    nextSeq: number;
  }> {
    return this.request('ui/session.replay', { sessionId, lastSeq });
  }

  private async request<T>(method: string, params: unknown): Promise<T> {
    await this.connect();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.socket?.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  private async handleMessage(data: unknown): Promise<void> {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(typeof data === 'string' ? data : String(data)) as JsonRpcMessage;
    } catch {
      return;
    }
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === 'ui/session.event' && isEventParams(message.params)) {
      const params = message.params;
      this.lastSequences.set(params.sessionId, params.seq);
      for (const handler of this.eventHandlers) handler(params.sessionId, params.seq, params.event);
      return;
    }
    if (message.method === 'ui/permission.request' && isPermissionRequest(message.params)) {
      for (const handler of this.permissionRequests) handler(message.params);
      const result = await this.permissionHandler(message.params);
      this.socket?.send(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    }
  }

  private async replayKnownSessions(): Promise<void> {
    for (const [sessionId, lastSeq] of this.lastSequences) {
      try {
        const replay = await this.replay(sessionId, lastSeq);
        if (replay.gap) continue;
        for (const entry of replay.events) {
          this.lastSequences.set(sessionId, entry.seq);
          for (const handler of this.eventHandlers) handler(sessionId, entry.seq, entry.event);
        }
      } catch {
        // The next reconnect retries replay; live streaming remains available.
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.reconnect) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch(() => this.scheduleReconnect());
    }, this.reconnectDelayMs);
  }
}

function isEventParams(value: unknown): value is {
  sessionId: string;
  seq: number;
  event: AcpEvent;
} {
  if (value === null || typeof value !== 'object') return false;
  const params = value as Record<string, unknown>;
  return (
    typeof params.sessionId === 'string' &&
    typeof params.seq === 'number' &&
    isAcpEvent(params.event)
  );
}

function isAcpEvent(value: unknown): value is AcpEvent {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function isPermissionRequest(value: unknown): value is AcpPermissionRequest {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { sessionId?: unknown }).sessionId === 'string' &&
    Array.isArray((value as { options?: unknown }).options)
  );
}

export function acpEnabled(): boolean {
  return import.meta.env.VITE_ACP_ENABLED === 'true';
}
