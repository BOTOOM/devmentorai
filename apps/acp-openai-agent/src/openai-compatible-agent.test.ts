import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { once } from 'node:events';
import { type Server, createServer } from 'node:http';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { afterEach, describe, expect, it } from 'vitest';

type FakeResponse = {
  chunks: string[];
  rawChunks?: unknown[];
  status?: number;
  delayMs?: number;
  hold?: boolean;
};

const children: ChildProcessWithoutNullStreams[] = [];
const servers: Server[] = [];

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function fakeServer(response: FakeResponse): Promise<string> {
  const server = createServer(async (_request, reply) => {
    reply.writeHead(response.status ?? 200, { 'Content-Type': 'text/event-stream' });
    const events =
      response.rawChunks ??
      response.chunks.map((chunk) => ({
        choices: [{ delta: { content: chunk } }],
      }));
    for (const event of events) {
      reply.write(sse(event));
      if (response.delayMs) await new Promise((resolve) => setTimeout(resolve, response.delayMs));
    }
    if (!response.hold) reply.end('data: [DONE]\n\n');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fake server has no address');
  return `http://127.0.0.1:${address.port}`;
}

async function connectAgent(baseUrl: string, supportsImage = false) {
  const child = spawn('node', ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OPENAI_COMPATIBLE_BASE_URL: baseUrl,
      OPENAI_COMPATIBLE_MODEL: 'fake-model',
      OPENAI_COMPATIBLE_SUPPORTS_IMAGE: String(supportsImage),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  children.push(child);
  const updates: acp.SessionUpdate[] = [];
  const app = acp
    .client({ name: 'phase7-test' })
    .onNotification('session/update', async (params) => {
      updates.push(params.params.update);
    })
    .onRequest('session/request_permission', async (params) => ({
      outcome: {
        outcome: 'selected',
        optionId: params.params.options[0]?.optionId ?? 'reject',
      },
    }));
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
  );
  const connection = await app.connect(stream);
  const initialize = await connection.agent.request('initialize', {
    protocolVersion: acp.PROTOCOL_VERSION,
    clientCapabilities: {},
  });
  const session = await connection.agent.request('session/new', {
    cwd: process.cwd(),
    mcpServers: [],
  });
  return { child, connection, initialize, session, updates };
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    child.kill();
    await once(child, 'exit').catch(() => undefined);
  }
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('OpenAI-compatible ACP agent', () => {
  it('advertises configured image support and streams a turn over ACP', async () => {
    const baseUrl = await fakeServer({ chunks: ['hello ', 'world'] });
    const result = await connectAgent(baseUrl, true);
    expect(result.initialize.agentCapabilities?.promptCapabilities?.image).toBe(true);
    await expect(
      result.connection.agent.request('session/prompt', {
        sessionId: result.session.sessionId,
        prompt: [{ type: 'text', text: 'hello' }],
      })
    ).resolves.toMatchObject({ stopReason: 'end_turn' });
    expect(
      result.updates.filter((update) => update.sessionUpdate === 'agent_message_chunk')
    ).toHaveLength(3);
  });

  it('does not advertise image support when the endpoint is configured without it', async () => {
    const baseUrl = await fakeServer({ chunks: ['text'] });
    const result = await connectAgent(baseUrl);
    expect(result.initialize.agentCapabilities?.promptCapabilities?.image).toBeUndefined();
  });

  it('requests permission before surfacing an OpenAI tool call', async () => {
    const baseUrl = await fakeServer({
      chunks: [],
      rawChunks: [{ choices: [{ delta: { tool_calls: [{ id: 'call-1', type: 'function' }] } }] }],
    });
    const result = await connectAgent(baseUrl);
    await result.connection.agent.request('session/prompt', {
      sessionId: result.session.sessionId,
      prompt: [{ type: 'text', text: 'use a tool' }],
    });
    expect(result.updates.map((update) => update.sessionUpdate)).toContain('tool_call');
    expect(result.updates.map((update) => update.sessionUpdate)).toContain('tool_call_update');
  });

  it('propagates upstream HTTP errors through the ACP request', async () => {
    const baseUrl = await fakeServer({ chunks: [], status: 503 });
    const result = await connectAgent(baseUrl);
    await expect(
      result.connection.agent.request('session/prompt', {
        sessionId: result.session.sessionId,
        prompt: [{ type: 'text', text: 'fail' }],
      })
    ).rejects.toThrow();
  });

  it('honours cancellation by aborting a held upstream stream', async () => {
    const baseUrl = await fakeServer({ chunks: ['partial'], hold: true });
    const result = await connectAgent(baseUrl);
    const prompt = result.connection.agent.request('session/prompt', {
      sessionId: result.session.sessionId,
      prompt: [{ type: 'text', text: 'hang' }],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await result.connection.agent.notify('session/cancel', { sessionId: result.session.sessionId });
    await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
  });
});
