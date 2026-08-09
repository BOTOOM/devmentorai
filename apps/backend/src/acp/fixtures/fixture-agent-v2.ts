import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk/experimental/v2';

const sessions = new Set<string>();

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
      session: {
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
  .onRequest(acp.methods.agent.session.prompt, async ({ params, client }) => {
    if (!sessions.has(params.sessionId)) throw new Error('Unknown fixture session');
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: { sessionUpdate: 'state_update', state: 'running' },
    });
    await client.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'fixture-v2-message',
        content: { type: 'text', text: 'v2 fixture response' },
      },
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
  .onNotification(acp.methods.agent.session.cancel, () => undefined)
  .connect(stream);
