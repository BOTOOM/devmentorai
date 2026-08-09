import * as acp from '@agentclientprotocol/sdk';
import type {
  AgentCapabilities,
  ContentBlock,
  InitializeResponse,
  PermissionOption,
  PromptResponse,
  RequestPermissionRequest,
  SessionConfigOption,
  SetSessionConfigOptionRequest,
} from '@agentclientprotocol/sdk';
import * as acpV2 from '@agentclientprotocol/sdk/experimental/v2';
import type {
  AcpAgentCapabilities,
  AcpAuthMethod,
  AcpConfigOption,
  AcpConnectionCapabilities,
  AcpContentBlock,
} from '@devmentorai/shared';
import {
  assertPromptCapabilities,
  normalizeCapabilities,
  supportsSessionCapability,
} from './capabilities.js';
import { AcpError, toAcpError } from './errors.js';
import { AgentLauncher, type AgentProcess, type LaunchSpec } from './launcher.js';

export type AcpRawSessionNotification = {
  sessionId: string;
  update: Record<string, unknown>;
  [key: string]: unknown;
};

export type PermissionDecision = {
  outcome: { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };
};

export type PermissionPolicy = (
  request: RequestPermissionRequest
) => PermissionDecision | Promise<PermissionDecision>;

export type AgentConnectionOptions = {
  agentId: string;
  launchSpec: LaunchSpec;
  launcher?: AgentLauncher;
  permissionPolicy?: PermissionPolicy;
  onSessionUpdate?: (notification: AcpRawSessionNotification) => void | Promise<void>;
  onAgentCrash?: (error: AcpError) => void | Promise<void>;
  clientName?: string;
  clientVersion?: string;
};

export type AcpProbeRequestResult = {
  supported: boolean;
  value?: unknown;
  error?: { code?: number; message: string };
};

function defaultPermissionPolicy(request: RequestPermissionRequest): PermissionDecision {
  const rejectOption = request.options.find(
    (option: PermissionOption) => option.kind === 'reject_once' || option.kind === 'reject_always'
  );
  return rejectOption
    ? { outcome: { outcome: 'selected', optionId: rejectOption.optionId } }
    : { outcome: { outcome: 'cancelled' } };
}

function capabilitiesFromResponse(response: InitializeResponse): AcpConnectionCapabilities {
  const raw = response as unknown as Record<string, unknown>;
  const v2Capabilities =
    raw.capabilities && typeof raw.capabilities === 'object'
      ? (raw.capabilities as Record<string, unknown>)
      : undefined;
  const v2Session =
    v2Capabilities?.session && typeof v2Capabilities.session === 'object'
      ? (v2Capabilities.session as Record<string, unknown>)
      : undefined;
  const v2Prompt =
    v2Session?.prompt && typeof v2Session.prompt === 'object'
      ? (v2Session.prompt as Record<string, unknown>)
      : undefined;
  const agentCapabilities =
    response.protocolVersion >= 2
      ? {
          loadSession: Boolean(v2Session),
          promptCapabilities: {
            image: Boolean(v2Prompt?.image),
            audio: Boolean(v2Prompt?.audio),
            embeddedContext: Boolean(v2Prompt?.embeddedContext),
          },
        }
      : normalizeCapabilities(response.agentCapabilities as AgentCapabilities | null | undefined);
  const authMethods: AcpAuthMethod[] = (response.authMethods ?? []).map((method) => ({
    ...method,
    ...(method.description ? { description: method.description } : { description: method.name }),
  }));
  return {
    protocolVersion: response.protocolVersion,
    agentCapabilities: {
      ...agentCapabilities,
      ...(process.env.ACP_V2 === '1' ? { elicitation: true } : {}),
    },
    authMethods,
    ...(response.agentInfo
      ? { agentInfo: { ...response.agentInfo } }
      : raw.info && typeof raw.info === 'object'
        ? { agentInfo: { ...(raw.info as Record<string, unknown>) } }
        : {}),
  };
}

function normalizeConfigOptions(options: SessionConfigOption[]): AcpConfigOption[] {
  return options.map((option) => ({ ...option })) as AcpConfigOption[];
}

export class AgentConnection {
  readonly agentId: string;
  readonly launchSpec: LaunchSpec;
  private readonly launcher: AgentLauncher;
  private permissionPolicy: PermissionPolicy;
  private onSessionUpdate?: AgentConnectionOptions['onSessionUpdate'];
  private onAgentCrash?: AgentConnectionOptions['onAgentCrash'];
  private process: AgentProcess | undefined;
  private connection: acp.ClientConnection | undefined;
  private closing = false;
  private cancelledSessions = new Set<string>();
  private configurableSessions = new Set<string>();
  private _capabilities: AcpConnectionCapabilities | undefined;
  private connectPromise: Promise<AcpConnectionCapabilities> | undefined;
  private readonly clientName: string;
  private readonly clientVersion: string;

  constructor(options: AgentConnectionOptions) {
    this.agentId = options.agentId;
    this.launchSpec = options.launchSpec;
    this.launcher = options.launcher ?? new AgentLauncher();
    this.permissionPolicy = options.permissionPolicy ?? defaultPermissionPolicy;
    this.onSessionUpdate = options.onSessionUpdate;
    this.onAgentCrash = options.onAgentCrash;
    this.clientName = options.clientName ?? 'devmentorai';
    this.clientVersion = options.clientVersion ?? '0.1.0';
  }

  get capabilities(): AcpConnectionCapabilities {
    if (!this._capabilities) {
      throw new AcpError('agent_launch_failed', 'ACP connection is not initialized');
    }
    return this._capabilities;
  }

  get processId(): number | undefined {
    return this.process?.pid;
  }

  get stderr(): string {
    return this.process?.stderr ?? '';
  }

  setSessionUpdateHandler(handler: AgentConnectionOptions['onSessionUpdate']): void {
    this.onSessionUpdate = handler;
  }

  setPermissionPolicy(policy: PermissionPolicy): void {
    this.permissionPolicy = policy;
  }

  setAgentCrashHandler(handler: AgentConnectionOptions['onAgentCrash']): void {
    this.onAgentCrash = handler;
  }

  async connect(): Promise<AcpConnectionCapabilities> {
    if (this._capabilities) return this._capabilities;
    if (this.connectPromise) return this.connectPromise;
    const promise = this.connectInternal();
    this.connectPromise = promise;
    try {
      return await promise;
    } finally {
      if (this.connectPromise === promise) this.connectPromise = undefined;
    }
  }

  private async connectInternal(): Promise<AcpConnectionCapabilities> {
    if (this.connection) return this.capabilities;
    this.closing = false;
    try {
      this.process = this.launcher.launch(this.launchSpec);
    } catch (error) {
      throw toAcpError(error, { startup: true, agentId: this.agentId });
    }

    void this.process.exited.then((exit) => {
      if (!this.closing && !this._capabilities) {
        const error = new AcpError('agent_launch_failed', 'Agent exited before initialization', {
          code: exit.code,
          signal: exit.signal,
          stderr: exit.stderr,
          agentId: this.agentId,
        });
        void this.onAgentCrash?.(error);
      } else if (!this.closing && this._capabilities) {
        const error = new AcpError('agent_crashed', 'Agent process exited unexpectedly', {
          code: exit.code,
          signal: exit.signal,
          stderr: exit.stderr,
          agentId: this.agentId,
        });
        void this.onAgentCrash?.(error);
      }
    });

    const v2Enabled = process.env.ACP_V2 === '1';
    const app = (v2Enabled
      ? acpV2.client({ name: this.clientName })
      : acp.client({ name: this.clientName })) as unknown as ReturnType<typeof acp.client>;
    app
      .onNotification(
        acp.methods.client.session.update,
        (params: unknown) => params,
        async ({ params }) => {
          if (params && typeof params === 'object') {
            await this.onSessionUpdate?.(params as AcpRawSessionNotification);
          }
        }
      )
      .onRequest(acp.methods.client.session.requestPermission, async ({ params }) => {
        if (this.cancelledSessions.has(params.sessionId)) {
          return { outcome: { outcome: 'cancelled' } };
        }
        return this.permissionPolicy(params);
      });

    try {
      const stream = v2Enabled
        ? acpV2.ndJsonStream(this.process.stdin, this.process.stdout)
        : acp.ndJsonStream(this.process.stdin, this.process.stdout);
      this.connection = app.connect(
        stream as unknown as Parameters<ReturnType<typeof acp.client>['connect']>[0]
      );
      const response = (await this.connection.agent.request('initialize', {
        protocolVersion: v2Enabled ? 2 : acp.PROTOCOL_VERSION,
        clientCapabilities: v2Enabled
          ? ({ elicitation: { form: {} } } as unknown as Record<string, unknown>)
          : {},
        ...(v2Enabled
          ? { info: { name: this.clientName, version: this.clientVersion } }
          : { clientInfo: { name: this.clientName, version: this.clientVersion } }),
      })) as InitializeResponse;
      if (
        response.protocolVersion !== acp.PROTOCOL_VERSION &&
        !(v2Enabled && response.protocolVersion === 2)
      ) {
        throw new AcpError(
          'protocol_version_unsupported',
          `Agent negotiated unsupported ACP protocol version ${response.protocolVersion}`,
          {
            supportedVersion: acp.PROTOCOL_VERSION,
            negotiatedVersion: response.protocolVersion,
          }
        );
      }
      this._capabilities = capabilitiesFromResponse(response);
      return this._capabilities;
    } catch (error) {
      const acpError =
        error instanceof AcpError
          ? error
          : toAcpError(error, { startup: true, agentId: this.agentId });
      await this.shutdown();
      throw acpError;
    }
  }

  async newSession(cwd: string): Promise<{ sessionId: string; configOptions?: AcpConfigOption[] }> {
    const connection = this.requireConnection();
    try {
      const response = await connection.agent.request('session/new', {
        cwd,
        mcpServers: [],
      });
      if (response.configOptions?.length) {
        this.configurableSessions.add(response.sessionId);
      }
      return {
        sessionId: response.sessionId,
        ...(response.configOptions
          ? { configOptions: normalizeConfigOptions(response.configOptions) }
          : {}),
      };
    } catch (error) {
      throw this.mapAgentError(error);
    }
  }

  async loadSession(sessionId: string, cwd: string): Promise<void> {
    if (this.capabilities.protocolVersion >= 2) {
      await this.requireConnection().agent.request('session/resume', {
        sessionId,
        cwd,
        replayFrom: { type: 'start' },
      });
    } else {
      await this.requireConnection().agent.request('session/load', {
        sessionId,
        cwd,
        mcpServers: [],
      });
    }
  }

  async listSessions(): Promise<unknown> {
    return this.requireConnection().agent.request('session/list', {});
  }

  async probeRequest(method: string, params: unknown): Promise<AcpProbeRequestResult> {
    try {
      const value = await this.requireConnection().agent.request(method, params);
      return { supported: true, value };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? Number((error as { code?: unknown }).code)
          : undefined;
      return {
        supported: false,
        error: {
          ...(Number.isFinite(code) ? { code } : {}),
          message,
        },
      };
    }
  }

  async prompt(sessionId: string, blocks: AcpContentBlock[]): Promise<PromptResponse> {
    assertPromptCapabilities(this.capabilities, blocks);
    this.cancelledSessions.delete(sessionId);
    try {
      return await this.requireConnection().agent.request('session/prompt', {
        sessionId,
        prompt: blocks as ContentBlock[],
      });
    } catch (error) {
      throw this.mapAgentError(error);
    }
  }

  async authenticate(methodId: string): Promise<void> {
    const method = this.capabilities.authMethods.find((candidate) => candidate.id === methodId);
    if (!method) {
      throw new AcpError(
        'capability_unsupported',
        `Agent did not advertise auth method ${methodId}`
      );
    }
    try {
      await this.requireConnection().agent.request('authenticate', { methodId });
    } catch (error) {
      const mapped = toAcpError(error, { agentId: this.agentId });
      if (mapped.code === 'auth_required') {
        throw new AcpError('auth_required', mapped.message, {
          ...(mapped.details ?? {}),
          authMethod: method.id,
          authDescription: method.description,
        });
      }
      throw mapped;
    }
  }

  async cancel(sessionId: string): Promise<void> {
    this.cancelledSessions.add(sessionId);
    try {
      await this.requireConnection().agent.notify('session/cancel', { sessionId });
    } catch (error) {
      throw toAcpError(error, { agentId: this.agentId });
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    if (!supportsSessionCapability(this.capabilities, 'close')) {
      throw new AcpError('capability_unsupported', 'Agent did not advertise session close');
    }
    try {
      await this.requireConnection().agent.request('session/close', { sessionId });
    } catch (error) {
      throw toAcpError(error, { agentId: this.agentId });
    }
  }

  async setConfigOption(request: SetSessionConfigOptionRequest): Promise<AcpConfigOption[]> {
    if (!this.configurableSessions.has(request.sessionId)) {
      throw new AcpError(
        'capability_unsupported',
        'Agent did not advertise configuration options for this session'
      );
    }
    try {
      const response = await this.requireConnection().agent.request(
        'session/set_config_option',
        request
      );
      return normalizeConfigOptions(response.configOptions);
    } catch (error) {
      throw toAcpError(error, { agentId: this.agentId });
    }
  }

  async shutdown(): Promise<void> {
    this.closing = true;
    this.cancelledSessions.clear();
    this.configurableSessions.clear();
    this.connection?.close();
    this.connection = undefined;
    await this.process?.shutdown();
    this.process = undefined;
  }

  private requireConnection(): acp.ClientConnection {
    if (!this.connection || !this._capabilities) {
      throw new AcpError('agent_launch_failed', 'ACP connection is not initialized');
    }
    return this.connection;
  }

  private mapAgentError(error: unknown): AcpError {
    const mapped = toAcpError(error, { agentId: this.agentId });
    if (mapped.code !== 'auth_required') return mapped;
    return new AcpError('auth_required', mapped.message, {
      ...(mapped.details ?? {}),
      authMethods: this.capabilities.authMethods.map(({ id, description }) => ({
        id,
        description,
      })),
    });
  }
}
