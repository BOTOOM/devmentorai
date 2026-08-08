import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import type { SessionConfigOption } from '@agentclientprotocol/sdk';

type FixtureSession = {
  controller?: AbortController;
};

const sessions = new Map<string, FixtureSession>();
const configuredCapabilities = process.env.ACP_FIXTURE_CAPABILITIES
  ? (JSON.parse(process.env.ACP_FIXTURE_CAPABILITIES) as Record<string, unknown>)
  : {};
const configuredCommands = process.env.ACP_FIXTURE_COMMANDS
  ? (JSON.parse(process.env.ACP_FIXTURE_COMMANDS) as Array<Record<string, unknown>>)
  : [
      {
        name: 'fixture',
        description: 'Run the fixture update sequence',
        input: { hint: 'optional text' },
      },
    ];

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('cancelled'));
      },
      { once: true }
    );
  });
}

const fixture = {
  async initialize() {
    return {
      protocolVersion: Number(process.env.ACP_FIXTURE_PROTOCOL_VERSION ?? acp.PROTOCOL_VERSION),
      agentCapabilities: {
        promptCapabilities: {
          image: true,
          audio: true,
          embeddedContext: true,
        },
        sessionCapabilities: {
          close: {},
          configOptions: {},
        },
        ...configuredCapabilities,
      },
      authMethods: [],
      agentInfo: { name: 'devmentorai-fixture', version: '1.0.0' },
    };
  },

  async newSession(): Promise<{ sessionId: string; configOptions: SessionConfigOption[] }> {
    const sessionId = randomUUID();
    sessions.set(sessionId, {});
    return {
      sessionId,
      configOptions: [
        {
          id: 'fixture.mode',
          name: 'Fixture mode',
          category: 'mode',
          type: 'select',
          currentValue: 'all',
          options: [{ value: 'all', name: 'All updates' }],
        },
      ],
    };
  },

  async setConfigOption(): Promise<{ configOptions: SessionConfigOption[] }> {
    return { configOptions: [] };
  },

  async prompt(
    params: { sessionId: string },
    client: acp.AgentContext
  ): Promise<{ stopReason: acp.StopReason }> {
    const session = sessions.get(params.sessionId);
    if (!session) throw new Error(`Unknown fixture session ${params.sessionId}`);
    const controller = new AbortController();
    session.controller = controller;
    const { signal } = controller;
    const notify = (update: Record<string, unknown>) =>
      client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update,
      });

    try {
      if (process.env.ACP_FIXTURE_STALL === '1') {
        await delay(60_000, signal);
      }

      await notify({
        sessionUpdate: 'available_commands_update',
        availableCommands: configuredCommands,
        _fixture: 'available',
      });
      await notify({
        sessionUpdate: 'agent_message_chunk',
        messageId: 'fixture-message',
        content: { type: 'text', text: 'fixture ' },
      });
      await delay(10, signal);
      await notify({
        sessionUpdate: 'agent_thought_chunk',
        messageId: 'fixture-thought',
        content: { type: 'text', text: 'thinking' },
      });
      await notify({
        sessionUpdate: 'user_message_chunk',
        messageId: 'fixture-user',
        content: { type: 'text', text: 'echo' },
      });
      await notify({
        sessionUpdate: 'tool_call',
        toolCallId: 'fixture-tool',
        title: 'Fixture tool',
        kind: 'execute',
        status: 'pending',
        rawInput: { command: 'fixture' },
      });

      if (process.env.ACP_FIXTURE_STALL_AFTER_TOOL === '1') {
        await delay(60_000, signal);
      }

      if (process.env.ACP_FIXTURE_CRASH === '1') {
        process.exit(17);
      }

      const permission = await client.request(acp.methods.client.session.requestPermission, {
        sessionId: params.sessionId,
        toolCall: {
          toolCallId: 'fixture-permission',
          title: 'Fixture permission',
          kind: 'execute',
          status: 'pending',
        },
        options: [
          { kind: 'allow_once', name: 'Allow once', optionId: 'allow' },
          { kind: 'reject_once', name: 'Reject once', optionId: 'reject' },
        ],
      });
      await notify({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'fixture-tool',
        status: permission.outcome.outcome === 'selected' ? 'completed' : 'failed',
        rawOutput: permission,
        content: [{ type: 'content', content: { type: 'text', text: 'done' } }],
      });
      await notify({
        sessionUpdate: 'plan',
        entries: [{ content: 'Finish fixture', priority: 'high', status: 'completed' }],
      });
      await notify({
        sessionUpdate: 'plan_update',
        entries: [{ content: 'Finish fixture', priority: 'high', status: 'completed' }],
      });
      await notify({ sessionUpdate: 'plan_removed' });
      await notify({
        sessionUpdate: 'current_mode_update',
        currentModeId: 'fixture',
      });
      await notify({
        sessionUpdate: 'config_option_update',
        configOptions: [
          {
            id: 'fixture.mode',
            name: 'Fixture mode',
            type: 'select',
            currentValue: 'all',
          },
        ],
      });
      await notify({
        sessionUpdate: 'session_info_update',
        title: 'Fixture session',
        updatedAt: new Date().toISOString(),
      });
      await notify({
        sessionUpdate: 'usage_update',
        used: 1,
        size: 10,
        cost: { amount: 0, currency: 'USD' },
      });
      await notify({
        sessionUpdate: 'agent_message_chunk',
        messageId: 'fixture-message',
        content: { type: 'text', text: 'done' },
      });
      return { stopReason: 'end_turn' };
    } catch (error) {
      if (signal.aborted) {
        await notify({
          sessionUpdate: 'agent_message_chunk',
          messageId: 'fixture-after-cancel',
          content: { type: 'text', text: 'after cancel' },
        }).catch(() => undefined);
        return { stopReason: 'cancelled' };
      }
      throw error;
    } finally {
      session.controller = undefined;
    }
  },

  async cancel(params: { sessionId: string }): Promise<void> {
    sessions.get(params.sessionId)?.controller?.abort();
  },
};

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
);

acp
  .agent({ name: 'devmentorai-fixture' })
  .onRequest('initialize', (ctx) => fixture.initialize())
  .onRequest('session/new', (ctx) => fixture.newSession())
  .onRequest('session/set_config_option', (ctx) => fixture.setConfigOption())
  .onRequest('session/prompt', (ctx) => fixture.prompt(ctx.params, ctx.client))
  .onNotification('session/cancel', (ctx) => fixture.cancel(ctx.params))
  .connect(stream);
