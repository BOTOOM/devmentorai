import { randomUUID } from 'node:crypto';
import type {
  AcpConfigOption,
  AcpContentBlock,
  AcpEvent,
  AcpSessionRecord,
  AcpStopReason,
} from '@devmentorai/shared';
import { supportsLoadSession } from './capabilities.js';
import { AgentConnection } from './connection.js';
import { AcpError } from './errors.js';
import type { LaunchSpec } from './launcher.js';
import { type AcpMessageRole, normalizeV1Update } from './normalize/v1.js';

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
  messageIds: Partial<Record<AcpMessageRole, string>>;
  updateChain: Promise<void>;
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
    connection.setSessionUpdateHandler((notification) =>
      this.handleUpdate(options.agentId, notification)
    );
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
      ...(session.configOptions ? { configOptions: session.configOptions } : {}),
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
      ...(created.configOptions ? { configOptions: created.configOptions } : {}),
      activeToolCalls: new Set(),
      messageIds: {},
      updateChain: Promise.resolve(),
    };
    this.sessions.set(session.id, session);
    return this.getSession(session.id) as AcpSessionRecord;
  }

  async prompt(sessionId: string, prompt: AcpContentBlock[]): Promise<void> {
    const session = this.requireSession(sessionId);
    session.messageIds = {
      user: randomUUID(),
      assistant: randomUUID(),
      thought: randomUUID(),
    };
    await this.emit(sessionId, { type: 'state', state: 'running' });
    try {
      const response = await this.requireAgent(session.agentId).prompt(
        session.acpSessionId,
        prompt
      );
      await session.updateChain;
      if (response.stopReason === 'cancelled') {
        await this.cancelUnfinishedTools(session);
      }
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

  async loadSession(sessionId: string): Promise<{ supported: boolean }> {
    const session = this.requireSession(sessionId);
    if (!supportsLoadSession(session.capabilities)) return { supported: false };
    await this.requireAgent(session.agentId).loadSession(session.acpSessionId, session.cwd);
    await session.updateChain;
    return { supported: true };
  }

  async listAgentSessions(agentId: string): Promise<unknown> {
    const connection = await this.connectAndGetAgent(agentId);
    if (!supportsLoadSession(connection.capabilities)) return { sessions: [], supported: false };
    return { sessions: await connection.listSessions(), supported: true };
  }

  async cancelPrompt(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    await this.requireAgent(session.agentId).cancel(session.acpSessionId);
  }

  async setConfigOption(
    sessionId: string,
    configId: string,
    value: string | boolean
  ): Promise<AcpConfigOption[]> {
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

  private handleUpdate(
    agentId: string,
    notification: {
      sessionId: string;
      update: Record<string, unknown>;
    }
  ): Promise<void> {
    const session = [...this.sessions.values()].find(
      (candidate) =>
        candidate.agentId === agentId && candidate.acpSessionId === notification.sessionId
    );
    if (!session) return Promise.resolve();
    session.updateChain = session.updateChain.then(async () => {
      const event = normalizeV1Update(notification.update, { messageIds: session.messageIds });
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
    });
    return session.updateChain;
  }

  private async cancelUnfinishedTools(session: ManagedSession): Promise<void> {
    for (const toolCallId of session.activeToolCalls) {
      await this.emit(session.id, {
        type: 'tool_call',
        toolCallId,
        status: 'cancelled',
        mode: 'replace',
      });
    }
    session.activeToolCalls.clear();
  }

  private async handleAgentCrash(agentId: string, error: AcpError): Promise<void> {
    const affected = [...this.sessions.values()].filter((session) => session.agentId === agentId);
    await Promise.all(
      affected.map((session) => this.emit(session.id, { type: 'error', error: error.toPayload() }))
    );
  }

  private async emit(sessionId: string, event: AcpEvent): Promise<void> {
    try {
      await this.onEvent?.(sessionId, event);
    } catch (error) {
      console.error('ACP session event consumer failed', {
        sessionId,
        eventType: event.type,
        error,
      });
    }
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
