import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { afterEach, describe, expect, it } from 'vitest';

type FakeResponse = {
  chunks: string[];
  rawChunks?: unknown[];
  completionSequences?: unknown[][];
  models?: string[];
  modelsError?: boolean;
  requests?: string[];
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
  let completionCount = 0;
  const server = createServer(async (request, reply) => {
    if (request.url === '/v1/models') {
      if (response.modelsError) {
        reply.writeHead(503);
        reply.end();
        return;
      }
      reply.writeHead(200, { 'Content-Type': 'application/json' });
      reply.end(
        JSON.stringify({ data: (response.models ?? ['fake-model']).map((id) => ({ id })) })
      );
      return;
    }
    if (request.url !== '/v1/chat/completions') {
      reply.writeHead(404);
      reply.end();
      return;
    }
    if (response.requests) {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      response.requests.push(body);
    }
    reply.writeHead(response.status ?? 200, { 'Content-Type': 'text/event-stream' });
    const events =
      response.completionSequences?.[completionCount++] ??
      response.rawChunks ??
      response.chunks.map((chunk) => ({ choices: [{ delta: { content: chunk } }] }));
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

async function connectAgent(
  baseUrl: string,
  supportsImage = false,
  allowTools = true,
  cwd = process.cwd()
) {
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
    .onRequest('session/request_permission', async (params) => {
      if (!allowTools) return { outcome: { outcome: 'cancelled' } };
      return {
        outcome: {
          outcome: 'selected',
          optionId: params.params.options[0]?.optionId ?? 'reject',
        },
      };
    });
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
    cwd,
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
    ).toHaveLength(2);
  });

  it('does not advertise image support when the endpoint is configured without it', async () => {
    const baseUrl = await fakeServer({ chunks: ['text'] });
    const result = await connectAgent(baseUrl);
    expect(result.initialize.agentCapabilities?.promptCapabilities?.image).toBeUndefined();
  });

  it('requests permission before surfacing an OpenAI tool call', async () => {
    const requests: string[] = [];
    const baseUrl = await fakeServer({
      chunks: [],
      requests,
      completionSequences: [
        [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-1',
                      function: { name: 'read_file', arguments: '{"path":"' },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: 'missing.txt"}' } }],
                },
              },
            ],
          },
        ],
        [{ choices: [{ delta: { content: 'done' } }] }],
      ],
    });
    const result = await connectAgent(baseUrl);
    await result.connection.agent.request('session/prompt', {
      sessionId: result.session.sessionId,
      prompt: [{ type: 'text', text: 'use a tool' }],
    });
    expect(result.updates.map((update) => update.sessionUpdate)).toContain('tool_call');
    expect(result.updates.map((update) => update.sessionUpdate)).toContain('tool_call_update');
    expect(JSON.parse(requests[1] ?? '{}').messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'tool', tool_call_id: 'call-1' })])
    );
  });

  it('reports rejected permissions and continues with the tool result', async () => {
    const baseUrl = await fakeServer({
      chunks: [],
      completionSequences: [
        [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-2',
                      function: { name: 'read_file', arguments: '{"path":"x"}' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      ],
    });
    const result = await connectAgent(baseUrl, false, false);
    await result.connection.agent.request('session/prompt', {
      sessionId: result.session.sessionId,
      prompt: [{ type: 'text', text: 'deny' }],
    });
    expect(result.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionUpdate: 'tool_call_update', status: 'failed' }),
      ])
    );
  });

  it('executes approved file tools inside cwd and returns the result to the model', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'acp-openai-agent-'));
    const requests: string[] = [];
    const baseUrl = await fakeServer({
      chunks: [],
      requests,
      completionSequences: [
        [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'write-1',
                      function: {
                        name: 'write_file',
                        arguments: '{"path":"answer.txt","content":"tool answer"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
        [
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'read-1',
                      function: {
                        name: 'read_file',
                        arguments: '{"path":"answer.txt"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
        [{ choices: [{ delta: { content: 'tool answer' } }] }],
      ],
    });
    try {
      const result = await connectAgent(baseUrl, false, true, cwd);
      await expect(
        result.connection.agent.request('session/prompt', {
          sessionId: result.session.sessionId,
          prompt: [{ type: 'text', text: 'create and read the answer' }],
        })
      ).resolves.toMatchObject({ stopReason: 'end_turn' });
      await expect(readFile(path.join(cwd, 'answer.txt'), 'utf8')).resolves.toBe('tool answer');
      const finalRequest = JSON.parse(requests[2] ?? '{}') as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      expect(finalRequest.messages).toEqual(
        expect.arrayContaining([expect.objectContaining({ role: 'tool', content: 'tool answer' })])
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    ['parent traversal', '../escape.txt'],
    ['absolute path', '/tmp/acp-openai-agent-escape.txt'],
    ['symlink traversal', 'link/escape.txt'],
  ])('rejects %s outside cwd', async (_label, requestedPath) => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'acp-openai-agent-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'acp-openai-agent-outside-'));
    const outsideFile = path.join(outside, 'escape.txt');
    try {
      await symlink(outside, path.join(cwd, 'link'));
      const baseUrl = await fakeServer({
        chunks: [],
        completionSequences: [
          [
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'escape-1',
                        function: {
                          name: 'write_file',
                          arguments: JSON.stringify({
                            path: requestedPath,
                            content: 'must not write',
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        ],
      });
      const result = await connectAgent(baseUrl, false, true, cwd);
      await result.connection.agent.request('session/prompt', {
        sessionId: result.session.sessionId,
        prompt: [{ type: 'text', text: 'escape' }],
      });
      expect(result.updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionUpdate: 'tool_call_update', status: 'failed' }),
        ])
      );
      await expect(readFile(outsideFile, 'utf8')).rejects.toThrow();
      await expect(readFile(path.join(cwd, 'escape.txt'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('cancels shell execution during the tool loop without starting another round', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'acp-openai-agent-'));
    const requests: string[] = [];
    try {
      const baseUrl = await fakeServer({
        chunks: [],
        requests,
        completionSequences: [
          [
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'shell-1',
                        function: {
                          name: 'run_shell',
                          arguments: '{"command":"sleep 5"}',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        ],
      });
      const result = await connectAgent(baseUrl, false, true, cwd);
      const prompt = result.connection.agent.request('session/prompt', {
        sessionId: result.session.sessionId,
        prompt: [{ type: 'text', text: 'run slowly' }],
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await result.connection.agent.notify('session/cancel', {
        sessionId: result.session.sessionId,
      });
      await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
      expect(requests).toHaveLength(1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('preserves resource context and discovers models with a fallback', async () => {
    const requests: string[] = [];
    const baseUrl = await fakeServer({ chunks: ['ok'], models: ['alpha', 'beta'], requests });
    const result = await connectAgent(baseUrl);
    expect(result.session.configOptions?.[0]).toMatchObject({
      options: [{ value: 'fake-model' }, { value: 'alpha' }, { value: 'beta' }],
    });
    await result.connection.agent.request('session/prompt', {
      sessionId: result.session.sessionId,
      prompt: [
        { type: 'text', text: 'question' },
        {
          type: 'resource',
          resource: { uri: 'page://1', mimeType: 'text/plain', text: 'page context' },
        },
      ],
    });
    expect(JSON.parse(requests[0] ?? '{}').messages[0].content).toEqual([
      { type: 'text', text: 'question' },
      { type: 'text', text: '[text/plain page://1]\npage context' },
    ]);
  });

  it('falls back to the configured model when model discovery fails', async () => {
    const baseUrl = await fakeServer({ chunks: ['ok'], modelsError: true });
    const result = await connectAgent(baseUrl);
    expect(result.session.configOptions?.[0]).toMatchObject({
      currentValue: 'fake-model',
      options: [{ value: 'fake-model' }],
    });
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
