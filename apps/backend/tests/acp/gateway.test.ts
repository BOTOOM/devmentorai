import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { AgentCatalog } from '../../src/acp/catalog/agent-catalog.js';
import { AcpAgentService } from '../../src/acp/catalog/agent-service.js';
import { WorkspaceService } from '../../src/acp/catalog/workspace.js';
import { AcpGateway } from '../../src/acp/gateway.js';
import { initDatabase } from '../../src/db/index.js';

type RpcMessage = {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const fixture = path.resolve('src/acp/fixtures/fixture-agent.ts');
const tsx = path.resolve('node_modules/.bin/tsx');
const resources: Array<{
  db: ReturnType<typeof initDatabase>;
  gateway: AcpGateway;
  app: ReturnType<typeof Fastify>;
}> = [];
const inboxes = new WeakMap<WebSocket, RpcMessage[]>();

function createService(db: ReturnType<typeof initDatabase>, root = process.cwd()): AcpAgentService {
  return new AcpAgentService({
    db,
    workspace: new WorkspaceService({ root }),
    catalog: new AgentCatalog({ builtIns: [], fetcher: async () => ({ agents: [] }) }),
  });
}

async function createGateway(env: Record<string, string> = {}): Promise<{
  app: ReturnType<typeof Fastify>;
  gateway: AcpGateway;
}> {
  const db = initDatabase({ path: ':memory:' });
  const service = createService(db);
  service.createProfile({
    name: 'Fixture',
    custom: true,
    cmd: tsx,
    args: [fixture],
    env,
    defaultCwd: process.cwd(),
    transport: 'stdio',
  });
  const app = Fastify();
  const gateway = new AcpGateway({
    db,
    agentService: service,
    workspaceRoot: process.cwd(),
    extensionOrigin: 'http://localhost:5173',
    idleTimeoutMs: 250,
    bufferLimit: 100,
  });
  await gateway.register(app);
  await app.listen({ host: '127.0.0.1', port: 0 });
  resources.push({ db, gateway, app });
  return { app, gateway };
}

async function connect(app: ReturnType<typeof Fastify>): Promise<WebSocket> {
  const address = app.server.address() as AddressInfo;
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/acp`, {
    origin: 'http://localhost:5173',
  });
  await once(socket, 'open');
  const inbox: RpcMessage[] = [];
  socket.on('message', (data) => {
    inbox.push(JSON.parse(String(data)) as RpcMessage);
  });
  inboxes.set(socket, inbox);
  return socket;
}

async function waitForMessage(
  socket: WebSocket,
  predicate: (message: RpcMessage) => boolean
): Promise<RpcMessage> {
  const inbox = inboxes.get(socket);
  if (!inbox) throw new Error('Socket has no message inbox');
  const deadline = Date.now() + 10_000;
  for (;;) {
    const index = inbox.findIndex(predicate);
    if (index >= 0) return inbox.splice(index, 1)[0] as RpcMessage;
    if (Date.now() >= deadline) throw new Error('Timed out waiting for WebSocket message');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.gateway.shutdown();
    await resource.app.close();
    resource.db.close();
  }
});

describe('ACP gateway security', () => {
  it('allows only the configured extension and development origins', async () => {
    const db = initDatabase({ path: ':memory:' });
    const gateway = new AcpGateway({
      db,
      extensionOrigin: 'chrome-extension://abcdefghijklmnop',
      allowedOrigins: ['http://localhost:5173'],
    });
    expect(gateway.isOriginAllowed('chrome-extension://abcdefghijklmnop')).toBe(true);
    expect(gateway.isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(gateway.isOriginAllowed('https://evil.example')).toBe(false);
    expect(gateway.isOriginAllowed(undefined)).toBe(false);
    db.close();
  });

  it('rejects a disallowed WebSocket upgrade', async () => {
    const { app } = await createGateway();
    const address = app.server.address() as AddressInfo;
    const rejected = await new Promise<boolean>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/acp`, {
        origin: 'https://evil.example',
      });
      socket.once('open', () => resolve(false));
      socket.once('unexpected-response', () => resolve(true));
      socket.once('error', () => resolve(true));
    });
    expect(rejected).toBe(true);
  });
});

describe('ACP gateway transport', () => {
  it('streams a full turn, answers permission, and replays missing events exactly', async () => {
    const { app } = await createGateway();
    const firstSocket = await connect(app);
    firstSocket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/session.create',
        params: { cwd: process.cwd() },
      })
    );
    const created = await waitForMessage(firstSocket, (message) => message.id === 1);
    const sessionId = String(created.result?.id);

    firstSocket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'ui/session.prompt',
        params: { sessionId, prompt: 'hello' },
      })
    );
    const firstEvent = await waitForMessage(
      firstSocket,
      (message) => message.method === 'ui/session.event'
    );
    const firstSeq = Number(firstEvent.params?.seq);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await new Promise<void>((resolve) => {
      firstSocket.once('close', () => resolve());
      firstSocket.close();
    });

    const secondSocket = await connect(app);
    secondSocket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'ui/session.replay',
        params: { sessionId, lastSeq: firstSeq },
      })
    );
    const replay = await waitForMessage(secondSocket, (message) => message.id === 3);
    const replayEvents = (replay.result?.events ?? []) as Array<{ seq: number }>;
    expect(replay.result?.gap).toBe(false);
    expect(replayEvents.every((event) => event.seq > firstSeq)).toBe(true);
    expect(replayEvents.map((event) => event.seq)).toEqual(
      replayEvents.map((_, index) => firstSeq + index + 1)
    );

    const permissionInbox = inboxes.get(secondSocket) as RpcMessage[];
    const answerPermission = (): void => {
      const message = permissionInbox.find(
        (candidate) => candidate.method === 'ui/permission.request'
      );
      if (message?.id !== undefined) {
        permissionInbox.splice(permissionInbox.indexOf(message), 1);
        secondSocket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: { outcome: { outcome: 'selected', optionId: 'allow' } },
          })
        );
      }
    };
    const permissionTimer = setInterval(answerPermission, 10);
    const idleEvent = await waitForMessage(
      secondSocket,
      (message) =>
        message.method === 'ui/session.event' &&
        (message.params?.event as { type?: string }).type === 'state' &&
        (message.params?.event as { state?: string }).state === 'idle'
    );
    clearInterval(permissionTimer);
    expect(idleEvent.params?.seq).toBeGreaterThan(firstSeq);
    expect(replayEvents.length).toBeGreaterThan(0);
    secondSocket.close();
  }, 20_000);

  it('cancels a turn and leaves the session usable', async () => {
    const { app } = await createGateway();
    const socket = await connect(app);
    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/session.create',
        params: { cwd: process.cwd() },
      })
    );
    const created = await waitForMessage(socket, (message) => message.id === 1);
    const sessionId = String(created.result?.id);
    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'ui/session.prompt',
        params: { sessionId, prompt: 'cancel me' },
      })
    );
    await waitForMessage(socket, (message) => message.method === 'ui/session.event');
    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'ui/session.cancel',
        params: { sessionId },
      })
    );
    const cancelled = await waitForMessage(socket, (message) => message.id === 3);
    expect(cancelled.result?.cancelled).toBe(true);
    socket.close();
  }, 20_000);

  it('returns a recoverable timeout for a stalled fixture', async () => {
    const { app } = await createGateway({ ACP_FIXTURE_STALL: '1' });
    const socket = await connect(app);
    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/session.create',
        params: { cwd: process.cwd() },
      })
    );
    const created = await waitForMessage(socket, (message) => message.id === 1);
    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'ui/session.prompt',
        params: { sessionId: String(created.result?.id), prompt: 'stall' },
      })
    );
    const timeout = await waitForMessage(
      socket,
      (message) =>
        message.method === 'ui/session.event' &&
        message.params?.event !== undefined &&
        (message.params.event as { type?: string }).type === 'error'
    );
    expect(
      (timeout.params?.event as { error?: { details?: { recoverable?: boolean } } }).error?.details
        ?.recoverable
    ).toBe(true);
    socket.close();
  }, 20_000);

  it('seeds a Copilot CLI profile for profile-less session creation', async () => {
    const db = initDatabase({ path: ':memory:' });
    const service = createService(db);
    const profile = service.ensureDefaultProfile();
    expect(profile.agentId).toBe('github-copilot-cli');
    expect(profile.transport).toBe('stdio');
    db.close();
  });
});
