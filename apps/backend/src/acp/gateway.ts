import type { RequestPermissionRequest } from '@agentclientprotocol/sdk';
import type { AcpContentBlock, AcpEvent, AcpSessionRecord, Session } from '@devmentorai/shared';
import type { WebSocket } from '@fastify/websocket';
import websocket from '@fastify/websocket';
import type { Database } from 'better-sqlite3';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AcpAgentService, type ProfileInput } from './catalog/agent-service.js';
import type { LaunchResolution } from './catalog/types.js';
import { WorkspaceService } from './catalog/workspace.js';
import { AgentConnection, type PermissionDecision } from './connection.js';
import { AcpError, isAcpError } from './errors.js';
import { AcpSessionManager } from './session-manager.js';

type JsonRpcId = string | number;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type BufferedEvent = {
  seq: number;
  event: AcpEvent;
};

type GatewayOptions = {
  db: Database;
  agentService?: AcpAgentService;
  workspaceRoot?: string;
  allowedOrigins?: string[];
  extensionOrigin?: string;
  idleTimeoutMs?: number;
  bufferLimit?: number;
};

type GatewayClient = {
  socket: WebSocket;
  pending: Map<JsonRpcId, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
  nextId: number;
};

type PendingPermission = {
  request: RequestPermissionRequest;
  resolve: (decision: PermissionDecision) => void;
};

const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_BUFFER_LIMIT = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseRequest(value: unknown): JsonRpcRequest | undefined {
  if (!isRecord(value) || value.jsonrpc !== '2.0' || typeof value.method !== 'string')
    return undefined;
  if (typeof value.id !== 'string' && typeof value.id !== 'number') return undefined;
  return {
    jsonrpc: '2.0',
    id: value.id,
    method: value.method,
    ...(value.params !== undefined ? { params: value.params } : {}),
  };
}

function textFromEvent(event: AcpEvent): string | undefined {
  if (event.type !== 'message') return undefined;
  return event.content
    .filter((block): block is Extract<AcpContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function asParams(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AcpError('agent_error', `Missing ${name}`);
  }
  return value;
}

function asBlocks(value: unknown): AcpContentBlock[] {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value))
    throw new AcpError('agent_error', 'Prompt must be text or content blocks');
  return value as AcpContentBlock[];
}

export class AcpGateway {
  private readonly db: Database;
  private readonly agentService: AcpAgentService;
  private readonly workspace: WorkspaceService;
  private readonly allowedOrigins: Set<string>;
  private readonly extensionOrigin?: string;
  private readonly idleTimeoutMs: number;
  private readonly bufferLimit: number;
  private readonly clients = new Set<GatewayClient>();
  private readonly sessions = new Map<string, AcpSessionRecord>();
  private readonly buffers = new Map<string, BufferedEvent[]>();
  private readonly sequence = new Map<string, number>();
  private readonly connections = new Map<string, AgentConnection>();
  private readonly clientsByAcpSession = new Map<string, GatewayClient>();
  private readonly externalSessionIds = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly timeoutRejects = new Map<string, (error: AcpError) => void>();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly manager: AcpSessionManager;

  constructor(options: GatewayOptions) {
    this.db = options.db;
    this.workspace = new WorkspaceService({
      root: options.workspaceRoot ?? process.cwd(),
    });
    this.agentService =
      options.agentService ??
      new AcpAgentService({
        db: options.db,
        workspace: this.workspace,
      });
    this.allowedOrigins = new Set(options.allowedOrigins ?? []);
    this.extensionOrigin = options.extensionOrigin;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.bufferLimit = options.bufferLimit ?? DEFAULT_BUFFER_LIMIT;
    this.manager = new AcpSessionManager({
      onEvent: (sessionId, event) => this.handleEvent(sessionId, event),
    });
    this.agentService.ensureDefaultProfile();
  }

  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false;
    return origin === this.extensionOrigin || this.allowedOrigins.has(origin);
  }

  async register(fastify: FastifyInstance): Promise<void> {
    await fastify.register(websocket);
    fastify.get(
      '/acp',
      {
        websocket: true,
        onRequest: async (
          request: FastifyRequest,
          reply: FastifyReply
        ): Promise<FastifyReply | void> => {
          if (!this.isOriginAllowed(request.headers.origin)) {
            return reply.code(403).send({ error: 'WebSocket origin is not allowed' });
          }
        },
      },
      (socket: WebSocket, request: FastifyRequest) => {
        if (!this.isOriginAllowed(request.headers.origin)) {
          socket.close(1008, 'Origin not allowed');
          return;
        }
        this.attach(socket);
      }
    );
  }

  attach(socket: WebSocket): void {
    const client: GatewayClient = { socket, pending: new Map(), nextId: 1 };
    this.clients.add(client);
    socket.on('message', (data: unknown) => {
      void this.handleMessage(client, data);
    });
    socket.on('close', () => {
      this.clients.delete(client);
      for (const pending of client.pending.values()) {
        pending.reject(new Error('WebSocket closed'));
      }
      client.pending.clear();
      for (const [sessionId, current] of this.clientsByAcpSession) {
        if (current === client) this.clientsByAcpSession.delete(sessionId);
      }
    });
  }

  async shutdown(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await this.manager.shutdown();
    await this.agentService.shutdown();
    for (const client of this.clients) client.socket.close();
    this.clients.clear();
  }

  private send(client: GatewayClient, message: JsonRpcResponse | Record<string, unknown>): void {
    if (client.socket.readyState === 1) client.socket.send(JSON.stringify(message));
  }

  private request(client: GatewayClient, method: string, params: unknown): Promise<unknown> {
    const id = client.nextId++;
    return new Promise((resolve, reject) => {
      client.pending.set(id, { resolve, reject });
      this.send(client, { jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        const pending = client.pending.get(id);
        if (pending) {
          client.pending.delete(id);
          pending.reject(new AcpError('agent_error', 'UI request timed out'));
        }
      }, this.idleTimeoutMs).unref();
    });
  }

  private async handleMessage(client: GatewayClient, data: unknown): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(
        typeof data === 'string' ? data : Buffer.from(data as Uint8Array).toString()
      );
    } catch {
      this.send(client, {
        jsonrpc: '2.0',
        id: 0,
        error: { code: -32700, message: 'Invalid JSON' },
      });
      return;
    }
    if (isRecord(value) && ('result' in value || 'error' in value) && 'id' in value) {
      const id = value.id;
      if (typeof id === 'string' || typeof id === 'number') {
        const pending = client.pending.get(id);
        if (pending) {
          client.pending.delete(id);
          if (isRecord(value.error)) {
            pending.reject(new Error(String(value.error.message ?? 'UI request failed')));
          } else {
            pending.resolve(value.result);
          }
        }
      }
      return;
    }
    const request = parseRequest(value);
    if (!request) return;
    try {
      const result = await this.dispatch(client, request.method, asParams(request.params));
      this.send(client, { jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      const acpError = isAcpError(error)
        ? error
        : new AcpError('agent_error', error instanceof Error ? error.message : String(error));
      this.send(client, {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message: acpError.message, data: acpError.toPayload() },
      });
    }
  }

  private async dispatch(
    client: GatewayClient,
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const sessionId =
      typeof params.sessionId === 'string' ? this.resolveSessionId(params.sessionId) : undefined;
    switch (method) {
      case 'ui/session.create':
        return this.createSession(client, params);
      case 'ui/session.prompt': {
        const requestedSessionId = asString(params.sessionId, 'sessionId');
        const resolvedSessionId = await this.ensureSession(client, requestedSessionId);
        return this.prompt({ ...params, sessionId: resolvedSessionId });
      }
      case 'ui/session.cancel':
        await this.manager.cancelPrompt(sessionId ?? asString(params.sessionId, 'sessionId'));
        return { cancelled: true };
      case 'ui/session.close':
        await this.manager.closeSession(sessionId ?? asString(params.sessionId, 'sessionId'));
        return { closed: true };
      case 'ui/session.set_config_option':
        return this.manager.setConfigOption(
          sessionId ?? asString(params.sessionId, 'sessionId'),
          asString(params.configId, 'configId'),
          params.value as string | boolean
        );
      case 'ui/session.replay':
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            this.clientsByAcpSession.set(session.acpSessionId, client);
            this.sendPendingPermission(session.acpSessionId);
          }
        }
        return this.replay(sessionId ?? asString(params.sessionId, 'sessionId'), params.lastSeq);
      case 'ui/session.list':
        return this.listSessions();
      case 'ui/permission.respond':
        return { accepted: true };
      case 'ui/agents.list':
        return this.agentService.list();
      case 'ui/agents.install':
        return this.agentService.install(asString(params.agentId, 'agentId'));
      case 'ui/agents.uninstall':
        await this.agentService.uninstall(asString(params.agentId, 'agentId'));
        return { uninstalled: true };
      case 'ui/agents.create_profile':
        return this.agentService.createProfile(params as ProfileInput);
      case 'ui/agents.update_profile':
        return this.agentService.updateProfile(
          asString(params.id, 'id'),
          params as Partial<ProfileInput>
        );
      case 'ui/agents.delete_profile':
        this.agentService.deleteProfile(asString(params.id, 'id'));
        return { deleted: true };
      case 'ui/agents.authenticate':
        await this.agentService.authenticate(
          asString(params.profileId, 'profileId'),
          asString(params.methodId, 'methodId')
        );
        return { authenticated: true };
      case 'ui/agents.resolve_launch':
        return this.agentService.resolveLaunch(asString(params.profileId, 'profileId'));
      default:
        throw new AcpError('capability_unsupported', `Unknown UI method ${method}`);
    }
  }

  private resolveSessionId(value: string): string {
    if (this.sessions.has(value)) return value;
    const mapped = [...this.externalSessionIds.entries()].find(
      ([, external]) => external === value
    );
    if (mapped) return mapped[0];
    return (
      [...this.sessions.entries()].find(([, session]) => session.acpSessionId === value)?.[0] ??
      value
    );
  }

  private async ensureSession(client: GatewayClient, externalSessionId: string): Promise<string> {
    const resolved = this.resolveSessionId(externalSessionId);
    if (this.sessions.has(resolved)) return resolved;
    const row = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(externalSessionId) as
      | { id?: string }
      | undefined;
    if (!row?.id) {
      throw new AcpError('agent_error', `Unknown DevMentorAI session ${externalSessionId}`);
    }
    const session = await this.createSession(client, {});
    this.externalSessionIds.set(session.id, externalSessionId);
    return session.id;
  }

  private async createSession(
    client: GatewayClient,
    params: Record<string, unknown>
  ): Promise<AcpSessionRecord> {
    const profileId =
      typeof params.profileId === 'string' && params.profileId.length > 0
        ? params.profileId
        : this.agentService.ensureDefaultProfile().id;
    const resolution = await this.agentService.resolveLaunch(profileId);
    let connection = this.connections.get(profileId);
    if (!connection) {
      connection = new AgentConnection({
        agentId: profileId,
        launchSpec: resolution.launchSpec,
        permissionPolicy: (request) => this.permissionRequest(request.sessionId, client, request),
      });
      this.connections.set(profileId, connection);
      this.manager.registerAgent({
        agentId: profileId,
        connection,
        launchSpec: resolution.launchSpec,
      });
    } else {
      connection.setPermissionPolicy((request) =>
        this.permissionRequest(request.sessionId, client, request)
      );
    }
    const cwd = await this.workspace.resolve(
      typeof params.cwd === 'string' ? params.cwd : resolution.profile.defaultCwd
    );
    const session = await this.manager.createSession({ agentId: profileId, cwd });
    this.sessions.set(session.id, session);
    this.clientsByAcpSession.set(session.acpSessionId, client);
    this.persistAcpSession(session, resolution);
    return session;
  }

  private async prompt(params: Record<string, unknown>): Promise<{ accepted: boolean }> {
    const sessionId = asString(params.sessionId, 'sessionId');
    const blocks = asBlocks(params.prompt ?? params.text);
    this.persistPrompt(sessionId, blocks);
    const promptPromise = this.manager.prompt(sessionId, blocks);
    void promptPromise.catch(() => undefined);
    const timeoutPromise = new Promise<never>((_, reject) => {
      this.timeoutRejects.set(sessionId, reject);
      this.startTimer(sessionId);
    });
    try {
      await Promise.race([promptPromise, timeoutPromise]);
      return { accepted: true };
    } catch (error) {
      if (isAcpError(error) && error.details?.recoverable === true) return { accepted: false };
      throw error;
    } finally {
      this.clearTimer(sessionId);
      this.timeoutRejects.delete(sessionId);
    }
  }

  private startTimer(sessionId: string): void {
    this.clearTimer(sessionId);
    this.timers.set(
      sessionId,
      setTimeout(() => {
        void this.handleTimeout(sessionId);
      }, this.idleTimeoutMs)
    );
  }

  private touchTimer(sessionId: string): void {
    if (this.timers.has(sessionId)) this.startTimer(sessionId);
  }

  private clearTimer(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.timers.delete(sessionId);
  }

  private async handleTimeout(sessionId: string): Promise<void> {
    this.timers.delete(sessionId);
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const timeoutError = new AcpError('agent_error', 'ACP turn idle timeout', {
      recoverable: true,
      timeoutMs: this.idleTimeoutMs,
    });
    this.timeoutRejects.get(sessionId)?.(timeoutError);
    try {
      await this.manager.cancelPrompt(sessionId);
    } catch {
      // The timeout error is the actionable result; cancellation is best effort.
    }
    await this.handleEvent(sessionId, {
      type: 'error',
      error: timeoutError.toPayload(),
    });
  }

  private async handleEvent(sessionId: string, event: AcpEvent): Promise<void> {
    this.touchTimer(sessionId);
    const next = (this.sequence.get(sessionId) ?? 0) + 1;
    this.sequence.set(sessionId, next);
    const events = this.buffers.get(sessionId) ?? [];
    events.push({ seq: next, event });
    // Keep the most recent bufferLimit events; reconnects older than the first
    // retained sequence are reported as gaps by replay().
    while (events.length > this.bufferLimit) events.shift();
    this.buffers.set(sessionId, events);
    this.persistEvent(sessionId, event);
    const client = this.clientsBySession(sessionId);
    if (client) {
      this.send(client, {
        jsonrpc: '2.0',
        method: 'ui/session.event',
        params: {
          sessionId: this.externalSessionIds.get(sessionId) ?? sessionId,
          seq: next,
          event,
        },
      });
    }
  }

  private clientsBySession(sessionId: string): GatewayClient | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.clientsByAcpSession.get(session.acpSessionId) : undefined;
  }

  private replay(
    sessionId: string,
    lastSeq: unknown
  ): {
    events: BufferedEvent[];
    gap: boolean;
    nextSeq: number;
  } {
    const requested = typeof lastSeq === 'number' ? lastSeq : 0;
    const events = this.buffers.get(sessionId) ?? [];
    const first = events[0]?.seq ?? requested + 1;
    return {
      events: events.filter((entry) => entry.seq > requested),
      gap: requested < first - 1,
      nextSeq: this.sequence.get(sessionId) ?? 0,
    };
  }

  private permissionRequest(
    acpSessionId: string,
    client: GatewayClient,
    request: RequestPermissionRequest
  ): Promise<PermissionDecision> {
    this.clientsByAcpSession.set(
      acpSessionId,
      this.clientsByAcpSession.get(acpSessionId) ?? client
    );
    return new Promise((resolve) => {
      this.pendingPermissions.set(acpSessionId, { request, resolve });
      this.sendPendingPermission(acpSessionId);
    });
  }

  private sendPendingPermission(acpSessionId: string): void {
    const pending = this.pendingPermissions.get(acpSessionId);
    const client = this.clientsByAcpSession.get(acpSessionId);
    if (!pending || !client) return;
    this.request(client, 'ui/permission.request', pending.request)
      .then((result) => {
        this.pendingPermissions.delete(acpSessionId);
        if (!isRecord(result) || !isRecord(result.outcome)) {
          pending.resolve({ outcome: { outcome: 'cancelled' } });
          return;
        }
        const outcome = result.outcome;
        if (outcome.outcome === 'selected' && typeof outcome.optionId === 'string') {
          pending.resolve({ outcome: { outcome: 'selected', optionId: outcome.optionId } });
          return;
        }
        pending.resolve({ outcome: { outcome: 'cancelled' } });
      })
      .catch(() => {
        if (this.clientsByAcpSession.get(acpSessionId) === client) {
          this.clientsByAcpSession.delete(acpSessionId);
        }
      });
  }

  private persistAcpSession(session: AcpSessionRecord, resolution: LaunchResolution): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO sessions
         (id, name, type, status, model, message_count, created_at, updated_at,
          agent_id, acp_session_id, cwd, protocol_version, capabilities_json,
          config_options_json, title_source, replay_supported)
         VALUES (?, ?, 'general', 'active', '', 0, ?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?)`
      )
      .run(
        session.id,
        resolution.catalogEntry?.name ?? resolution.profile.name,
        now,
        now,
        session.agentId,
        session.acpSessionId,
        session.cwd,
        session.protocolVersion,
        JSON.stringify(session.capabilities),
        JSON.stringify(session.configOptions ?? []),
        session.capabilities.agentCapabilities.loadSession === true ? 1 : 0
      );
  }

  private persistEvent(sessionId: string, event: AcpEvent): void {
    const text = textFromEvent(event);
    if (!text) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const role =
      event.type === 'message' && event.role === 'thought'
        ? 'assistant'
        : event.type === 'message'
          ? event.role
          : 'assistant';
    const metadata =
      event.type === 'message' && event.role === 'thought'
        ? JSON.stringify({ role: 'thought' })
        : null;
    const messageId =
      event.type === 'message' ? `${session.id}:${event.messageId}` : `${sessionId}-event`;
    const current = this.db.prepare('SELECT content FROM messages WHERE id = ?').get(messageId) as
      | { content?: string }
      | undefined;
    const content =
      event.type === 'message' && event.mode === 'append'
        ? `${current?.content ?? ''}${text}`
        : text;
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, metadata = excluded.metadata`
      )
      .run(messageId, session.id, role, content, new Date().toISOString(), metadata);
  }

  private persistPrompt(sessionId: string, blocks: AcpContentBlock[]): void {
    const session = this.sessions.get(sessionId);
    const text = blocks
      .filter((block): block is Extract<AcpContentBlock, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('');
    if (!session || !text) return;
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
         VALUES (?, ?, 'user', ?, ?, NULL)`
      )
      .run(`${session.id}:user:${Date.now()}`, session.id, text, new Date().toISOString());
  }

  private listSessions(): Session[] {
    return (
      this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Array<
        Record<string, unknown>
      >
    ).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type) as Session['type'],
      status: String(row.status) as Session['status'],
      model: String(row.model),
      messageCount: Number(row.message_count),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ...(row.agent_id ? { agentId: String(row.agent_id) } : {}),
      ...(row.cwd ? { cwd: String(row.cwd) } : {}),
      ...(row.imported_from ? { importedFrom: 'copilot-sdk' as const } : {}),
    }));
  }
}

export function acpEnabled(): boolean {
  return process.env.ACP_ENABLED === 'true' || process.env.ACP_ENABLED === '1';
}

export type AcpGatewayRegistrationOptions = Omit<GatewayOptions, 'db'> & {
  db: Database;
};

export async function registerAcpGateway(
  fastify: FastifyInstance,
  options: AcpGatewayRegistrationOptions
): Promise<AcpGateway | undefined> {
  if (!acpEnabled()) return undefined;
  const gateway = new AcpGateway(options);
  await gateway.register(fastify);
  return gateway;
}
