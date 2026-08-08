import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AcpAgentService,
  AgentCatalog,
  AgentInstaller,
  AgentProfileStore,
  CredentialStore,
  WorkspaceService,
  platformKey,
} from '../../src/acp/catalog/index.js';
import { AgentConnection } from '../../src/acp/connection.js';

const fixture = path.resolve('src/acp/fixtures/fixture-agent.ts');
const tsx = path.resolve('node_modules/.bin/tsx');
const temporaryDirectories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devmentorai-acp-phase2-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createProfileTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE acp_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_id TEXT,
      command TEXT,
      args_json TEXT NOT NULL,
      env_json TEXT NOT NULL,
      default_cwd TEXT NOT NULL,
      transport TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('ACP Phase 2 catalog', () => {
  it('uses registry data for unknown distribution kinds and falls back offline', async () => {
    const directory = await tempDirectory();
    const registry = {
      version: '1.0.0',
      agents: [
        {
          id: 'unknown-agent',
          name: 'Unknown Agent',
          version: '1',
          distribution: { future_transport: { command: 'agent' } },
        },
      ],
    };
    const catalog = new AgentCatalog({
      cachePath: path.join(directory, 'registry.json'),
      fetcher: async () => registry,
      builtIns: [],
    });
    expect((await catalog.list())[0]).toMatchObject({ id: 'unknown-agent', source: 'registry' });

    const offline = new AgentCatalog({
      cachePath: path.join(directory, 'missing.json'),
      fetcher: async () => {
        throw new Error('offline');
      },
      builtIns: [
        { id: 'offline-agent', name: 'Offline', distribution: { command: { cmd: 'agent' } } },
      ],
    });
    await expect(offline.list()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'offline-agent' })])
    );
  });

  it('rejects malformed registry data without throwing', async () => {
    const catalog = new AgentCatalog({
      fetcher: async () => ({ agents: 'not-an-array' }),
      builtIns: [
        { id: 'builtin-agent', name: 'Built in', distribution: { command: { cmd: 'agent' } } },
      ],
    });
    await expect(catalog.list()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'builtin-agent' })])
    );
  });

  it('reports binary distributions unavailable on the current platform', async () => {
    const catalog = new AgentCatalog({
      fetcher: async () => {
        throw new Error('offline');
      },
      builtIns: [
        {
          id: 'platform-agent',
          name: 'Platform',
          distribution: { binary: { 'not-this-platform': { archive: 'x', cmd: 'agent' } } },
        },
      ],
    });
    await expect(catalog.get('platform-agent')).resolves.toMatchObject({
      platformAvailability: { available: false },
    });
  });

  it('fails checksum mismatches before creating an install', async () => {
    const directory = await tempDirectory();
    const installer = new AgentInstaller({
      root: path.join(directory, 'agents'),
      fetcher: async () => new TextEncoder().encode('untrusted archive'),
    });
    const entry = {
      id: 'binary-agent',
      name: 'Binary',
      version: '1',
      source: 'registry' as const,
      distribution: {
        binary: {
          [platformKey()]: {
            archive: 'https://example.test/agent.tar.gz',
            cmd: './agent',
            sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        },
      },
      installState: 'not_installed' as const,
      authState: 'unknown' as const,
      authMethods: [],
      platformAvailability: { available: true, key: platformKey() },
    };
    await expect(installer.install(entry)).rejects.toMatchObject({
      code: 'agent_launch_failed',
      details: expect.objectContaining({
        expected: entry.distribution.binary[platformKey()].sha256,
      }),
    });
    await expect(fs.access(path.join(directory, 'agents', 'binary-agent', '1'))).rejects.toThrow();
  });

  it('stores credentials encrypted and resolves only process environment values', async () => {
    const directory = await tempDirectory();
    const secret = 'phase2-secret-value';
    const store = new CredentialStore({ directory });
    store.set('provider-key', secret);
    const raw = await fs.readFile(path.join(directory, 'credentials'), 'utf8');
    expect(raw).not.toContain(secret);
    expect(store.resolveEnvironment({ PROVIDER_KEY: 'credential:provider-key' })).toEqual({
      PROVIDER_KEY: secret,
    });
    expect(JSON.stringify({ status: 'configured' })).not.toContain(secret);
  });

  it('exposes advertised auth methods and invokes authenticate', async () => {
    const directory = await tempDirectory();
    const connection = new AgentConnection({
      agentId: 'auth-fixture',
      launchSpec: {
        cmd: tsx,
        args: [fixture],
        cwd: directory,
        env: {
          ACP_FIXTURE_AUTH_METHODS: JSON.stringify([
            { id: 'fixture-login', name: 'Fixture login', description: 'Run fixture login' },
          ]),
        },
      },
    });
    await expect(connection.connect()).resolves.toMatchObject({
      authMethods: [{ id: 'fixture-login', description: 'Run fixture login' }],
    });
    await expect(connection.authenticate('fixture-login')).resolves.toBeUndefined();
    await connection.shutdown();
  });

  it('rejects workspace traversal and creates valid directories', async () => {
    const root = await tempDirectory();
    const workspace = new WorkspaceService({ root });
    await expect(workspace.resolve('../outside')).rejects.toThrow('must be absolute');
    const resolved = await workspace.resolve(path.join(root, 'project'));
    expect(resolved).toBe(path.join(root, 'project'));
    await expect(workspace.resolve(path.join(root, 'project'))).resolves.toBe(resolved);
  });

  it('keeps profiles of one agent independent and launches an unknown custom agent', async () => {
    const directory = await tempDirectory();
    const db = new Database(':memory:');
    createProfileTable(db);
    const profiles = new AgentProfileStore(db);
    const workspace = new WorkspaceService({ root: directory });
    const catalog = new AgentCatalog({
      fetcher: async () => ({ agents: [] }),
      builtIns: [],
      getProfiles: () => profiles.list(),
    });
    const service = new AcpAgentService({ db, profiles, catalog, workspace });
    const first = service.createProfile({
      id: 'fixture-one',
      name: 'Fixture one',
      custom: true,
      cmd: tsx,
      args: [fixture],
      env: {},
      defaultCwd: directory,
      transport: 'stdio',
    });
    const second = service.createProfile({
      id: 'fixture-two',
      name: 'Fixture two',
      custom: true,
      cmd: tsx,
      args: [fixture],
      env: { ACP_FIXTURE_SESSION_ID: 'same-session' },
      defaultCwd: directory,
      transport: 'stdio',
    });
    expect(first.id).not.toBe(second.id);
    expect(service.updateProfile(first.id, { args: [fixture, '--one'] }).args).toEqual([
      fixture,
      '--one',
    ]);
    const resolution = await service.resolveLaunch(second.id);
    const connection = new AgentConnection({
      agentId: second.id,
      launchSpec: resolution.launchSpec,
    });
    await expect(connection.connect()).resolves.toMatchObject({ protocolVersion: 1 });
    await connection.shutdown();
    db.close();
  });
});
