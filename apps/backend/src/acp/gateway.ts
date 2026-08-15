import net from 'node:net';
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
import {
  type CachedHistoryMessage,
  type CachedToolCall,
  reconcileMessages,
  reconcileSessionsByAgent,
  reconcileToolCalls,
} from './history-reconciliation.js';
import { AcpPairingStore, type PairingRecord } from './pairing.js';
import { AcpPermissionStore } from './permission-store.js';
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
  pairing?: AcpPairingStore;
};

type GatewayClient = {
  socket: WebSocket;
  pending: Map<JsonRpcId, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
  nextId: number;
};

type PendingPermission = {
  request: RequestPermissionRequest;
  resolve: (decision: PermissionDecision) => void;
  agentId: string;
  tool: string;
};

const PAIRING_PROTOCOL_PREFIX = 'devmentorai-pairing.';
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

function isLoopbackHost(host: string): boolean {
  return net.isIP(host) === 4 && host.startsWith('127.');
}

function pairingToken(request: FastifyRequest): string | undefined {
  const header = request.headers['sec-websocket-protocol'];
  const protocols = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((value) => value.trim());
  const fromProtocol = protocols
    .find((value) => value.startsWith(PAIRING_PROTOCOL_PREFIX))
    ?.slice(PAIRING_PROTOCOL_PREFIX.length);
  if (fromProtocol) return fromProtocol;
  const query = request.query;
  if (isRecord(query) && typeof query.token === 'string') return query.token;
  return undefined;
}

function permissionTool(request: RequestPermissionRequest): string {
  const rawInput = request.toolCall.rawInput;
  if (request.toolCall.kind) return request.toolCall.kind;
  if (isRecord(rawInput) && typeof rawInput.tool === 'string') return rawInput.tool;
  if (isRecord(rawInput) && typeof rawInput.name === 'string') return rawInput.name;
  return 'unknown-tool';
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
  private readonly sessionAgentIds = new Map<string, string>();
  private readonly replayMessageIds = new Map<string, Set<string>>();
  private readonly replaySeenMessageIds = new Map<string, Set<string>>();
  private readonly replayingSessions = new Set<string>();
  private readonly manager: AcpSessionManager;
  private readonly permissions: AcpPermissionStore;
  private readonly pairing: AcpPairingStore;

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
    this.permissions = new AcpPermissionStore(this.db);
    this.pairing = options.pairing ?? new AcpPairingStore();
    this.agentService.ensureDefaultProfile();
  }

  /** Origins configured out of band, which need no pairing token. */
  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false;
    if (origin === this.extensionOrigin || this.allowedOrigins.has(origin)) return true;
    return origin === process.env.ACP_FIXTURE_EXTENSION_ORIGIN;
  }

  isConnectionAllowed(origin: string | undefined, token: string | undefined): boolean {
    return this.isOriginAllowed(origin) || this.pairing.verify(origin, token);
  }

  pairExtension(origin: string | undefined): PairingRecord {
    if (this.isOriginAllowed(origin) && !AcpPairingStore.isExtensionOrigin(origin)) {
      throw new AcpError('pairing_rejected', 'Configured origins do not need a pairing token', {
        origin,
      });
    }
    return this.pairing.pair(origin ?? '');
  }

  isAcpConnected(): boolean {
    return [...this.connections.values()].some((connection) => {
      try {
        connection.capabilities;
        return true;
      } catch {
        return false;
      }
    });
  }

  async register(fastify: FastifyInstance): Promise<void> {
    await fastify.register(websocket, {
      options: {
        // Echo the pairing subprotocol so the browser can send the token without
        // putting it in the URL, where request logs would capture it.
        handleProtocols: (protocols: Set<string>): string | false =>
          [...protocols].find((protocol) => protocol.startsWith(PAIRING_PROTOCOL_PREFIX)) ?? false,
      },
    });
    fastify.post('/acp/pair', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const record = this.pairExtension(request.headers.origin);
        return { origin: record.origin, token: record.token, pairedAt: record.pairedAt };
      } catch (error) {
        const payload = isAcpError(error)
          ? error.toPayload()
          : { code: 'pairing_rejected' as const, message: 'Pairing failed' };
        return reply.code(payload.code === 'pairing_conflict' ? 409 : 403).send({ error: payload });
      }
    });
    fastify.get(
      '/acp',
      {
        websocket: true,
        onRequest: async (
          request: FastifyRequest,
          reply: FastifyReply
        ): Promise<FastifyReply | void> => {
          if (!this.isConnectionAllowed(request.headers.origin, pairingToken(request))) {
            return reply.code(403).send({ error: 'WebSocket origin is not allowed' });
          }
        },
      },
      (socket: WebSocket, request: FastifyRequest) => {
        if (!this.isConnectionAllowed(request.headers.origin, pairingToken(request))) {
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

  async nativePrompt(params: {
    profileId?: string;
    cwd?: string;
    prompt: string | AcpContentBlock[];
  }): Promise<{
    sessionId: string;
    events: Array<{ sessionId: string; seq: number; event: AcpEvent }>;
  }> {
    const messages: Array<Record<string, unknown>> = [];
    const socket = {
      readyState: 1,
      send: (value: string) => {
        const parsed: unknown = JSON.parse(value);
        if (isRecord(parsed)) messages.push(parsed);
      },
    } as unknown as WebSocket;
    const client: GatewayClient = { socket, pending: new Map(), nextId: 1 };
    const session = await this.createSession(client, {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.cwd ? { cwd: params.cwd } : {}),
    });
    await this.prompt({ sessionId: session.id, prompt: params.prompt });
    const events = messages.flatMap((message) => {
      if (message.method !== 'ui/session.event' || !isRecord(message.params)) return [];
      const eventParams = message.params;
      if (typeof eventParams.sessionId !== 'string' || typeof eventParams.seq !== 'number')
        return [];
      return isRecord(eventParams.event)
        ? [
            {
              sessionId: eventParams.sessionId,
              seq: eventParams.seq,
              event: eventParams.event as AcpEvent,
            },
          ]
        : [];
    });
    return { sessionId: session.id, events };
  }

  async nativeCreateSession(params: {
    profileId?: string;
    cwd?: string;
    name?: string;
    type?: string;
    model?: string;
  }): Promise<Session> {
    const record = await this.createSession(undefined, params);
    return {
      id: record.id,
      name: params.name ?? 'ACP session',
      type: (params.type as Session['type']) ?? 'general',
      status: 'active',
      model: params.model ?? 'configured',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      agentId: record.agentId,
      acpSessionId: record.acpSessionId,
      cwd: record.cwd,
      protocolVersion: record.protocolVersion,
      capabilities: record.capabilities,
      configOptions: record.configOptions,
      replaySupported: record.capabilities.agentCapabilities.loadSession === true,
    };
  }

  async nativeDeleteSession(sessionId: string): Promise<boolean> {
    const resolved = this.resolveSessionId(sessionId);
    const session = this.sessions.get(resolved);
    if (!session) return false;
    try {
      await this.manager.closeSession(resolved);
    } catch {
      // Cache deletion remains authoritative when the agent cannot close.
    }
    this.sessions.delete(resolved);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(resolved);
    return true;
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
        const resolved = this.sessions.get(resolvedSessionId);
        if (resolved) this.clientsByAcpSession.set(resolved.acpSessionId, client);
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
      case 'ui/session.load':
        return this.loadSession(sessionId ?? asString(params.sessionId, 'sessionId'));
      case 'ui/session.agent_list':
        return this.listAgentSessions();
      case 'ui/permission.respond':
        return { accepted: true };
      case 'ui/permissions.list':
        return this.permissions.list(
          typeof params.agentId === 'string' ? params.agentId : undefined
        );
      case 'ui/permissions.revoke':
        this.permissions.revoke(
          typeof params.agentId === 'string'
            ? params.agentId
            : (this.sessionAgentIds.get(
                this.resolveSessionId(asString(params.sessionId, 'sessionId'))
              ) ?? asString(params.agentId, 'agentId')),
          asString(params.tool, 'tool')
        );
        return { revoked: true };
      case 'ui/agents.list':
        return this.agentService.list();
      case 'ui/agents.profiles.list':
        return this.agentService.listProfiles();
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
      case 'ui/agents.probe': {
        const profileId = asString(params.profileId, 'profileId');
        const profile = this.agentService.listProfiles().find((item) => item.id === profileId);
        if (!profile || profile.custom) {
          throw new AcpError(
            'capability_unsupported',
            'Only trusted catalog profiles can be probed'
          );
        }
        if (
          profile.transport === 'tcp' &&
          (!profile.host ||
            typeof profile.port !== 'number' ||
            !Number.isInteger(profile.port) ||
            profile.port < 1 ||
            profile.port > 65535 ||
            !isLoopbackHost(profile.host))
        ) {
          throw new AcpError(
            'capability_unsupported',
            'Only valid loopback TCP profiles can be probed'
          );
        }
        return this.agentService.probe(profileId);
      }
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
    client: GatewayClient | undefined,
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
        permissionPolicy: (request) =>
          this.permissionRequest(
            request.sessionId,
            this.clientsByAcpSession.get(request.sessionId) ?? client,
            request,
            resolution.profile.agentId ?? profileId
          ),
      });
      this.connections.set(profileId, connection);
      this.manager.registerAgent({
        agentId: profileId,
        connection,
        launchSpec: resolution.launchSpec,
      });
    } else {
      connection.setPermissionPolicy((request) =>
        this.permissionRequest(
          request.sessionId,
          this.clientsByAcpSession.get(request.sessionId) ?? client,
          request,
          resolution.profile.agentId ?? profileId
        )
      );
    }
    const cwd = await this.workspace.resolve(
      typeof params.cwd === 'string' ? params.cwd : resolution.profile.defaultCwd
    );
    const session = await this.manager.createSession({ agentId: profileId, cwd });
    this.sessions.set(session.id, session);
    this.sessionAgentIds.set(session.id, resolution.profile.agentId ?? profileId);
    if (client) this.clientsByAcpSession.set(session.acpSessionId, client);
    this.persistAcpSession(session, resolution);
    if (typeof params.name === 'string' || typeof params.type === 'string') {
      this.db
        .prepare(
          'UPDATE sessions SET name = COALESCE(?, name), type = COALESCE(?, type), model = COALESCE(?, model) WHERE id = ?'
        )
        .run(params.name ?? null, params.type ?? null, params.model ?? null, session.id);
    }
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
    let eventToPersist = event;
    if (event.type === 'message') {
      this.replayMessageIds.get(sessionId)?.add(`${sessionId}:${event.messageId}`);
      if (this.replayingSessions.has(sessionId)) {
        const seen = this.replaySeenMessageIds.get(sessionId);
        if (seen && !seen.has(event.messageId)) {
          eventToPersist = { ...event, mode: 'replace' };
          seen.add(event.messageId);
        }
      }
    } else if (event.type === 'tool_call') {
      this.replayMessageIds.get(sessionId)?.add(`${sessionId}:tool:${event.toolCallId}`);
    }
    this.persistEvent(sessionId, eventToPersist);
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

  private async loadSession(sessionId: string): Promise<{ supported: boolean }> {
    const replayed = new Set<string>();
    this.replayMessageIds.set(sessionId, replayed);
    this.replaySeenMessageIds.set(sessionId, new Set());
    this.replayingSessions.add(sessionId);
    try {
      const result = await this.manager.loadSession(sessionId);
      if (result.supported) {
        const rows = this.db
          .prepare(
            'SELECT id, role, content, timestamp, metadata FROM messages WHERE session_id = ?'
          )
          .all(sessionId) as Array<{
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: string;
          metadata: string | null;
        }>;
        const localMessages: CachedHistoryMessage[] = rows.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          timestamp: row.timestamp,
          source: 'local',
        }));
        const remoteMessages: Array<{
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: string;
        }> = rows
          .filter((row) => replayed.has(row.id) && !row.id.includes(':tool:'))
          .map(({ id, role, content, timestamp }) => ({ id, role, content, timestamp }));
        const reconciledMessages = reconcileMessages(localMessages, remoteMessages);
        for (const message of reconciledMessages) {
          const metadata = rows.find((row) => row.id === message.id)?.metadata;
          const parsed = metadata ? (JSON.parse(metadata) as Record<string, unknown>) : {};
          this.db.prepare('UPDATE messages SET metadata = ? WHERE id = ?').run(
            JSON.stringify({
              ...parsed,
              ...(message.stale ? { stale: true, source: 'local' } : { source: 'agent' }),
            }),
            message.id
          );
        }
        const localTools: CachedToolCall[] = rows.flatMap((row) => {
          const metadata = row.metadata
            ? (JSON.parse(row.metadata) as Record<string, unknown>)
            : {};
          return typeof metadata.toolCallId === 'string'
            ? [
                {
                  id: metadata.toolCallId,
                  status: String(metadata.status ?? 'unknown'),
                  ...(typeof metadata.title === 'string' ? { title: metadata.title } : {}),
                  source: 'local' as const,
                  timestamp: row.timestamp,
                },
              ]
            : [];
        });
        const remoteTools = localTools.filter((tool) =>
          replayed.has(`${sessionId}:tool:${tool.id}`)
        );
        const reconciledTools = reconcileToolCalls(localTools, remoteTools);
        for (const tool of reconciledTools) {
          const row = rows.find((candidate) => {
            const metadata = candidate.metadata
              ? (JSON.parse(candidate.metadata) as Record<string, unknown>)
              : {};
            return metadata.toolCallId === tool.id;
          });
          if (!row) continue;
          const metadata = row.metadata
            ? (JSON.parse(row.metadata) as Record<string, unknown>)
            : {};
          this.db.prepare('UPDATE messages SET metadata = ? WHERE id = ?').run(
            JSON.stringify({
              ...metadata,
              ...(tool.stale ? { stale: true, source: 'local' } : { source: 'agent' }),
            }),
            row.id
          );
        }
      }
      return result;
    } finally {
      this.replayMessageIds.delete(sessionId);
      this.replaySeenMessageIds.delete(sessionId);
      this.replayingSessions.delete(sessionId);
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
    client: GatewayClient | undefined,
    request: RequestPermissionRequest,
    agentId: string
  ): Promise<PermissionDecision> {
    const tool = permissionTool(request);
    const remembered = this.permissions.get(agentId, tool);
    if (remembered && request.options.some((option) => option.optionId === remembered.optionId)) {
      return Promise.resolve({
        outcome: { outcome: 'selected', optionId: remembered.optionId },
      });
    }
    if (client) {
      this.clientsByAcpSession.set(
        acpSessionId,
        this.clientsByAcpSession.get(acpSessionId) ?? client
      );
    }
    if (!client && !this.clientsByAcpSession.has(acpSessionId)) {
      return Promise.resolve({ outcome: { outcome: 'cancelled' } });
    }
    return new Promise((resolve) => {
      this.pendingPermissions.set(acpSessionId, { request, resolve, agentId, tool });
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
          const selected = pending.request.options.find(
            (option) => option.optionId === outcome.optionId
          );
          if (selected?.kind === 'allow_always') {
            this.permissions.save(pending.agentId, pending.tool, outcome.optionId);
          }
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
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (event.type === 'tool_call') {
      const messageId = `${session.id}:tool:${event.toolCallId}`;
      const metadata = JSON.stringify({
        toolCallId: event.toolCallId,
        status: event.status ?? 'unknown',
        ...(event.title ? { title: event.title } : {}),
        source: 'agent',
      });
      this.db
        .prepare(
          `INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
           VALUES (?, ?, 'assistant', ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET content = excluded.content, metadata = excluded.metadata`
        )
        .run(messageId, session.id, event.title ?? '', new Date().toISOString(), metadata);
      return;
    }
    const text = textFromEvent(event);
    if (!text) return;
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
      ...(row.replay_supported !== null && row.replay_supported !== undefined
        ? { replaySupported: Boolean(row.replay_supported) }
        : {}),
      ...(row.imported_from ? { importedFrom: 'copilot-sdk' as const } : {}),
      ...(row.history_state === 'stale' ? { historyState: 'stale' as const } : {}),
    }));
  }

  private async listAgentSessions(): Promise<Session[]> {
    const local = this.listSessions();
    const profiles = this.agentService.listProfiles();
    const remotes: Array<{ id: string; agentId: string }> = [];
    const successfulAgents = new Set<string>();
    for (const profile of profiles) {
      const profileId = profile.id;
      const agentId = profile.agentId ?? profile.id;
      try {
        const resolution = await this.agentService.resolveLaunch(profile.id);
        const connection =
          this.connections.get(profileId) ??
          new AgentConnection({
            agentId: profileId,
            launchSpec: resolution.launchSpec,
          });
        this.connections.set(profileId, connection);
        this.manager.registerAgent({
          agentId: profileId,
          launchSpec: resolution.launchSpec,
          connection,
        });
        const result = await this.manager.listAgentSessions(profileId);
        if (!isRecord(result) || result.supported !== true) continue;
        const value = result.sessions;
        const sessions = isRecord(value) && Array.isArray(value.sessions) ? value.sessions : [];
        const remote = sessions.flatMap((item) =>
          isRecord(item) && typeof item.sessionId === 'string'
            ? [{ id: item.sessionId, agentId }]
            : []
        );
        remotes.push(...remote);
        successfulAgents.add(agentId);
      } catch {
        // Unreachable agents are excluded from reconciliation.
      }
    }
    const localRows = this.db
      .prepare('SELECT id, acp_session_id FROM sessions WHERE acp_session_id IS NOT NULL')
      .all() as Array<{ id: string; acp_session_id: string }>;
    const localByAcpId = new Map(localRows.map((row) => [row.acp_session_id, row.id]));
    const normalizedRemotes = remotes.map((session) => ({
      ...session,
      id: localByAcpId.get(session.id) ?? session.id,
    }));
    const merged = reconcileSessionsByAgent(local, normalizedRemotes, successfulAgents);
    for (const session of merged) {
      this.db
        .prepare('UPDATE sessions SET history_state = ? WHERE id = ?')
        .run('stale' in session && session.stale ? 'stale' : 'current', session.id);
    }
    return merged.map((session) => {
      const existing = local.find((candidate) => candidate.id === session.id);
      return (
        existing ?? {
          id: session.id,
          name: session.id,
          type: 'general',
          status: 'active',
          model: '',
          messageCount: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          agentId: session.agentId,
          ...('stale' in session && session.stale ? { historyState: 'stale' as const } : {}),
        }
      );
    });
  }
}

export type AcpGatewayRegistrationOptions = Omit<GatewayOptions, 'db'> & {
  db: Database;
};

export async function registerAcpGateway(
  fastify: FastifyInstance,
  options: AcpGatewayRegistrationOptions
): Promise<AcpGateway> {
  const gateway = new AcpGateway(options);
  await gateway.register(fastify);
  return gateway;
}
