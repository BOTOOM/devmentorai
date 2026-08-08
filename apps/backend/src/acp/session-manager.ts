import { randomUUID } from 'node:crypto';
import type {
  AcpContentBlock,
  AcpEvent,
  AcpSessionRecord,
  AcpStopReason,
} from '@devmentorai/shared';
import { AgentConnection } from './connection.js';
import { AcpError } from './errors.js';
import type { LaunchSpec } from './launcher.js';
import { normalizeV1Update } from './normalize/v1.js';

export type SessionEventHandler = (sessionId: string, event: AcpEvent) => void | Promise<void>;

export type RegisterAgentOptions = {
  agentId: string;
  launchSpec: LaunchSpec;
  connection?: AgentConnection;
};

export type CreateSessionOptions = {
  agentId: string;
  cwd: string;
};

type ManagedSession = AcpSessionRecord & {
  activeToolCalls: Set<string>;
};

export class AcpSessionManager {
  private readonly agents = new Map<string, AgentConnection>();
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly onEvent?: SessionEventHandler;

  constructor(options: { onEvent?: SessionEventHandler } = {}) {
    this.onEvent = options.onEvent;
  }

  registerAgent(options: RegisterAgentOptions): AgentConnection {
    const connection =
      options.connection ??
      new AgentConnection({
        agentId: options.agentId,
        launchSpec: options.launchSpec,
      });
    connection.setSessionUpdateHandler((notification) => this.handleUpdate(notification));
    connection.setAgentCrashHandler((error) => this.handleAgentCrash(options.agentId, error));
    this.agents.set(options.agentId, connection);
    return connection;
  }

  getSession(sessionId: string): AcpSessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return {
      id: session.id,
      agentId: session.agentId,
      acpSessionId: session.acpSessionId,
      cwd: session.cwd,
      protocolVersion: session.protocolVersion,
      capabilities: session.capabilities,
    };
  }

  async connectAgent(agentId: string): Promise<void> {
    await this.requireAgent(agentId).connect();
  }

  async createSession(options: CreateSessionOptions): Promise<AcpSessionRecord> {
    const connection = await this.connectAndGetAgent(options.agentId);
    const created = await connection.newSession(options.cwd);
    const session: ManagedSession = {
      id: randomUUID(),
      agentId: options.agentId,
      acpSessionId: created.sessionId,
      cwd: options.cwd,
      protocolVersion: connection.capabilities.protocolVersion,
      capabilities: connection.capabilities,
      activeToolCalls: new Set(),
    };
    this.sessions.set(session.id, session);
    return this.getSession(session.id) as AcpSessionRecord;
  }

  async prompt(sessionId: string, prompt: AcpContentBlock[]): Promise<void> {
    const session = this.requireSession(sessionId);
    await this.emit(sessionId, { type: 'state', state: 'running' });
    try {
      const response = await this.requireAgent(session.agentId).prompt(
        session.acpSessionId,
        prompt
      );
      await this.emit(sessionId, {
        type: 'state',
        state: 'idle',
        stopReason: response.stopReason as AcpStopReason,
      });
    } catch (error) {
      const acpError =
        error instanceof AcpError ? error : new AcpError('agent_error', String(error));
      await this.emit(sessionId, { type: 'error', error: acpError.toPayload() });
      throw acpError;
    }
  }

  async cancelPrompt(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    for (const toolCallId of session.activeToolCalls) {
      await this.emit(sessionId, {
        type: 'tool_call',
        toolCallId,
        status: 'cancelled',
        mode: 'replace',
      });
    }
    session.activeToolCalls.clear();
    await this.requireAgent(session.agentId).cancel(session.acpSessionId);
  }

  async setConfigOption(
    sessionId: string,
    configId: string,
    value: string | boolean
  ): Promise<unknown> {
    const session = this.requireSession(sessionId);
    return this.requireAgent(session.agentId).setConfigOption({
      sessionId: session.acpSessionId,
      configId,
      ...(typeof value === 'boolean' ? { type: 'boolean', value } : { value }),
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    try {
      await this.requireAgent(session.agentId).closeSession(session.acpSessionId);
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.agents.values()].map((agent) => agent.shutdown()));
    this.sessions.clear();
    this.agents.clear();
  }

  private async handleUpdate(notification: {
    sessionId: string;
    update: Record<string, unknown>;
  }): Promise<void> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.acpSessionId === notification.sessionId
    );
    if (!session) return;
    const event = normalizeV1Update(notification.update);
    if (event.type === 'tool_call') {
      if (
        event.status === 'completed' ||
        event.status === 'failed' ||
        event.status === 'cancelled'
      ) {
        session.activeToolCalls.delete(event.toolCallId);
      } else {
        session.activeToolCalls.add(event.toolCallId);
      }
    }
    await this.emit(session.id, event);
  }

  private async handleAgentCrash(agentId: string, error: AcpError): Promise<void> {
    const affected = [...this.sessions.values()].filter((session) => session.agentId === agentId);
    await Promise.all(
      affected.map((session) => this.emit(session.id, { type: 'error', error: error.toPayload() }))
    );
  }

  private async emit(sessionId: string, event: AcpEvent): Promise<void> {
    await this.onEvent?.(sessionId, event);
  }

  private async connectAndGetAgent(agentId: string): Promise<AgentConnection> {
    const connection = this.requireAgent(agentId);
    await connection.connect();
    return connection;
  }

  private requireAgent(agentId: string): AgentConnection {
    const connection = this.agents.get(agentId);
    if (!connection) {
      throw new AcpError('agent_not_installed', `No ACP agent registered with id ${agentId}`);
    }
    return connection;
  }

  private requireSession(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AcpError('agent_error', `Unknown DevMentorAI session ${sessionId}`);
    }
    return session;
  }
}
