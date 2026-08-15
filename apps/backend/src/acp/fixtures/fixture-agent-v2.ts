import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk/experimental/v2';

const sessions = new Set<string>();
const cancellationResolvers = new Map<string, () => void>();

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
);

acp
  .agent({ name: 'devmentorai-fixture-v2' })
  .onRequest(acp.methods.agent.initialize, () => ({
    protocolVersion: 2,
    info: { name: 'devmentorai-fixture-v2', version: '1.0.0' },
    capabilities: {
      elicitation: { form: {} },
      session: {
        elicitation: { form: {} },
        prompt: {
          image: {},
          embeddedContext: {},
        },
      },
    },
  }))
  .onRequest(acp.methods.agent.session.new, () => {
    const sessionId = randomUUID();
    sessions.add(sessionId);
    return { sessionId };
  })
  .onRequest(acp.methods.agent.session.resume, async ({ params, client }) => {
    if (!sessions.has(params.sessionId)) throw new Error('Unknown fixture session');
    const updates = [
      {
        sessionUpdate: 'user_message',
        messageId: 'fixture-v2-user',
        content: [{ type: 'text', text: 'replayed prompt' }],
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'fixture-v2-tool',
        status: 'completed',
      },
      {
        sessionUpdate: 'agent_message',
        messageId: 'fixture-v2-message',
        content: [{ type: 'text', text: 'v2 fixture response' }],
      },
    ];
    if (params.replayFrom) {
      for (const update of updates) {
        await client.notify(acp.methods.client.session.update, {
          sessionId: params.sessionId,
          update,
        });
      }
    }
    return {};
  })
  .onRequest(acp.methods.agent.session.prompt, async ({ params, client }) => {
    if (!sessions.has(params.sessionId)) throw new Error('Unknown fixture session');
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: { sessionUpdate: 'state_update', state: 'running' },
    });
    if (process.env.ACP_FIXTURE_PARTIAL_AFTER_COMPLETE === '1') {
      await client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'fixture-v2-tool',
          status: 'completed',
        },
      });
      await client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call_content_chunk',
          toolCallId: 'fixture-v2-tool',
          content: [{ type: 'content', content: { type: 'text', text: 'late' } }],
        },
      });
      await new Promise<void>((resolve) => {
        cancellationResolvers.set(params.sessionId, resolve);
      });
    }
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'fixture-v2-message',
        content: { type: 'text', text: 'v2 fixture response' },
      },
    });
    await client.request(acp.methods.client.elicitation.create, {
      sessionId: params.sessionId,
      mode: 'form',
      message: 'Fixture elicitation',
      requestedSchema: { type: 'object', properties: {} },
    });
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'plan_update',
        plan: {
          type: 'items',
          planId: 'fixture-v2-plan',
          entries: [{ content: 'Finish v2 fixture', priority: 'high', status: 'completed' }],
        },
      },
    });
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'terminal_output_chunk',
        terminalId: 'fixture-v2-terminal',
        data: 'done',
      },
    });
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: { sessionUpdate: 'state_update', state: 'idle', stopReason: 'end_turn' },
    });
    return {};
  })
  .onNotification(acp.methods.agent.session.cancel, ({ params }) => {
    cancellationResolvers.get(params.sessionId)?.();
    cancellationResolvers.delete(params.sessionId);
  })
  .connect(stream);
