import { once } from 'node:events';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { AgentCatalog } from '../../src/acp/catalog/agent-catalog.js';
import { AcpAgentService } from '../../src/acp/catalog/agent-service.js';
import { WorkspaceService } from '../../src/acp/catalog/workspace.js';
import { AcpGateway } from '../../src/acp/gateway.js';
import { AcpPairingStore } from '../../src/acp/pairing.js';
import { initDatabase } from '../../src/db/index.js';

const EXTENSION_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const OTHER_EXTENSION_ORIGIN = 'chrome-extension://zyxwvutsrqponmlkzyxwvutsrqponmlk';

const resources: Array<{
  db: ReturnType<typeof initDatabase>;
  gateway: AcpGateway;
  app: ReturnType<typeof Fastify>;
}> = [];
const directories: string[] = [];

function pairingStore(): AcpPairingStore {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'devmentorai-pairing-'));
  directories.push(directory);
  return new AcpPairingStore({ directory });
}

async function createGateway(options: {
  pairing: AcpPairingStore;
  extensionOrigin?: string;
}): Promise<ReturnType<typeof Fastify>> {
  const db = initDatabase({ path: ':memory:' });
  const app = Fastify();
  const gateway = new AcpGateway({
    db,
    agentService: new AcpAgentService({
      db,
      workspace: new WorkspaceService({ root: process.cwd() }),
      catalog: new AgentCatalog({ builtIns: [], fetcher: async () => ({ agents: [] }) }),
    }),
    workspaceRoot: process.cwd(),
    pairing: options.pairing,
    ...(options.extensionOrigin ? { extensionOrigin: options.extensionOrigin } : {}),
  });
  await gateway.register(app);
  await app.listen({ host: '127.0.0.1', port: 0 });
  resources.push({ db, gateway, app });
  return app;
}

function baseUrl(app: ReturnType<typeof Fastify>): string {
  const address = app.server.address() as AddressInfo;
  return `127.0.0.1:${address.port}`;
}

async function pair(
  app: ReturnType<typeof Fastify>,
  origin: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://${baseUrl(app)}/acp/pair`, {
    method: 'POST',
    headers: { origin },
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function canConnect(
  app: ReturnType<typeof Fastify>,
  origin: string,
  token?: string
): Promise<boolean> {
  const socket = new WebSocket(
    `ws://${baseUrl(app)}/acp`,
    token ? [`devmentorai-pairing.${token}`] : [],
    { origin }
  );
  const accepted = await new Promise<boolean>((resolve) => {
    socket.once('open', () => resolve(true));
    socket.once('close', () => resolve(false));
    socket.once('unexpected-response', () => resolve(false));
    socket.once('error', () => resolve(false));
  });
  socket.close();
  if (accepted) await once(socket, 'close');
  return accepted;
}

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.gateway.shutdown();
    await resource.app.close();
    resource.db.close();
  }
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('ACP extension pairing', () => {
  it('pairs the first extension and rejects a second one', async () => {
    const store = pairingStore();
    const app = await createGateway({ pairing: store });

    const first = await pair(app, EXTENSION_ORIGIN);
    expect(first.status).toBe(200);
    expect(typeof first.body.token).toBe('string');
    expect(await pair(app, EXTENSION_ORIGIN)).toMatchObject({
      status: 200,
      body: { token: first.body.token },
    });

    const conflict = await pair(app, OTHER_EXTENSION_ORIGIN);
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({ error: { code: 'pairing_conflict' } });

    expect(await canConnect(app, EXTENSION_ORIGIN, first.body.token as string)).toBe(true);
    expect(await canConnect(app, EXTENSION_ORIGIN)).toBe(false);
    expect(await canConnect(app, OTHER_EXTENSION_ORIGIN, first.body.token as string)).toBe(false);
  });

  it('lets a freshly loaded extension connect without any configuration', async () => {
    const store = pairingStore();
    const app = await createGateway({ pairing: store });
    const { body } = await pair(app, EXTENSION_ORIGIN);
    expect(await canConnect(app, EXTENSION_ORIGIN, body.token as string)).toBe(true);
  });

  it('keeps the configured origin override working without a token', async () => {
    const store = pairingStore();
    const app = await createGateway({ pairing: store, extensionOrigin: EXTENSION_ORIGIN });
    expect(await canConnect(app, EXTENSION_ORIGIN)).toBe(true);
    expect(await canConnect(app, OTHER_EXTENSION_ORIGIN)).toBe(false);
    expect(store.read()).toBeUndefined();
  });

  it('refuses to pair with a page origin', async () => {
    const store = pairingStore();
    const app = await createGateway({ pairing: store });
    const response = await pair(app, 'https://evil.example');
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'pairing_rejected' } });
    expect(store.read()).toBeUndefined();
  });

  it('stores the pairing with owner-only permissions and can be reset', async () => {
    const store = pairingStore();
    const record = store.pair(EXTENSION_ORIGIN);
    expect(record.token).toHaveLength(64);
    expect(fs.statSync(store.filePath).mode & 0o777).toBe(0o600);
    expect(store.verify(EXTENSION_ORIGIN, record.token)).toBe(true);
    expect(store.verify(EXTENSION_ORIGIN, 'wrong')).toBe(false);
    expect(store.verify(OTHER_EXTENSION_ORIGIN, record.token)).toBe(false);

    store.reset();
    expect(store.read()).toBeUndefined();
    expect(store.pair(OTHER_EXTENSION_ORIGIN).origin).toBe(OTHER_EXTENSION_ORIGIN);
  });
});
