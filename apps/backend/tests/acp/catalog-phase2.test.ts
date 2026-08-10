import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AcpAgentService,
  AgentCatalog,
  AgentInstaller,
  AgentLaunchResolver,
  AgentProfileStore,
  CredentialStore,
  WorkspaceService,
  platformKey,
} from '../../src/acp/catalog/index.js';
import type { AgentCatalogEntry, AgentProfile } from '../../src/acp/catalog/types.js';
import { AgentConnection } from '../../src/acp/connection.js';
import { AcpError } from '../../src/acp/errors.js';

const fixture = path.resolve('src/acp/fixtures/fixture-agent.ts');
const tsx = path.resolve('node_modules/.bin/tsx');
const execFileAsync = promisify(execFile);
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
    const directory = await tempDirectory();
    const catalog = new AgentCatalog({
      cachePath: path.join(directory, 'registry.json'),
      fetcher: async () => ({
        agents: [
          { id: 'good-agent', name: 'Good', distribution: { npx: { package: 'good@1' } } },
          { name: 'missing id', distribution: { npx: { package: 'bad@1' } } },
        ],
      }),
      builtIns: [
        { id: 'builtin-agent', name: 'Built in', distribution: { command: { cmd: 'agent' } } },
      ],
    });
    await expect(catalog.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'builtin-agent' }),
        expect.objectContaining({ id: 'good-agent' }),
      ])
    );
  });

  it('concatenates profile arguments for every distribution kind', async () => {
    const directory = await tempDirectory();
    const credentials = new CredentialStore({ directory });
    const resolver = new AgentLaunchResolver({ credentials });
    const profile = (args: string[]): AgentProfile => ({
      id: 'profile',
      name: 'Profile',
      args,
      env: {},
      defaultCwd: directory,
      transport: 'stdio',
    });
    const entry = (distribution: AgentCatalogEntry['distribution']): AgentCatalogEntry => ({
      id: 'agent',
      name: 'Agent',
      version: '1',
      source: 'registry',
      distribution,
      installState: 'lazy',
      authState: 'unknown',
      authMethods: [],
      platformAvailability: { available: true, key: platformKey() },
    });

    await expect(
      resolver.resolve(
        entry({ npx: { package: 'copilot@1', args: ['--acp'] } }),
        profile(['--port', 'N'])
      )
    ).resolves.toMatchObject({
      launchSpec: { args: ['--yes', 'copilot@1', '--acp', '--port', 'N'] },
    });
    await expect(
      resolver.resolve(
        entry({ uvx: { package: 'fast-agent', args: ['--acp'] } }),
        profile(['--model', 'local'])
      )
    ).resolves.toMatchObject({
      launchSpec: { args: ['fast-agent', '--acp', '--model', 'local'] },
    });
    await expect(
      resolver.resolve(entry({ command: { cmd: 'devin', args: ['acp'] } }), profile(['--cloud']))
    ).resolves.toMatchObject({
      launchSpec: { args: ['acp', '--cloud'] },
    });

    const binaryRoot = path.join(directory, 'agents');
    const binaryTarget = path.join(binaryRoot, 'agent', '1');
    await fs.mkdir(binaryTarget, { recursive: true });
    await fs.writeFile(path.join(binaryTarget, 'agent'), '');
    const installer = new AgentInstaller({
      root: binaryRoot,
      fetcher: async () => new Uint8Array(),
    });
    await expect(
      new AgentLaunchResolver({ installer, credentials }).resolve(
        entry({
          binary: {
            [platformKey()]: { archive: 'agent.tar.gz', cmd: './agent', args: ['acp'] },
          },
        }),
        profile(['--cloud'])
      )
    ).resolves.toMatchObject({
      launchSpec: { args: ['acp', '--cloud'] },
    });
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

  it('does not reinstall an already installed binary', async () => {
    const directory = await tempDirectory();
    const root = path.join(directory, 'agents');
    const target = path.join(root, 'binary-agent', '1');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'agent'), '');
    let downloads = 0;
    const installer = new AgentInstaller({
      root,
      fetcher: async () => {
        downloads += 1;
        return new Uint8Array();
      },
    });
    const entry = {
      id: 'binary-agent',
      name: 'Binary',
      version: '1',
      source: 'registry' as const,
      distribution: {
        binary: {
          [platformKey()]: { archive: 'agent.tar.gz', cmd: './agent', args: [] },
        },
      },
      installState: 'not_installed' as const,
      authState: 'unknown' as const,
      authMethods: [],
      platformAvailability: { available: true, key: platformKey() },
    };
    await expect(installer.install(entry)).resolves.toBe(target);
    expect(downloads).toBe(0);
  });

  it('rejects archive entries that escape the extraction directory', async () => {
    const directory = await tempDirectory();
    const source = path.join(directory, 'source');
    const archive = path.join(directory, 'malicious.tar.gz');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'safe'), 'malicious');
    await execFileAsync('tar', [
      '-czf',
      archive,
      '--transform=s|safe|../escape|',
      '-C',
      source,
      'safe',
    ]);
    const bytes = new Uint8Array(await fs.readFile(archive));
    const installer = new AgentInstaller({
      root: path.join(directory, 'agents'),
      fetcher: async () => bytes,
    });
    const entry = {
      id: 'malicious-agent',
      name: 'Malicious',
      version: '1',
      source: 'registry' as const,
      distribution: {
        binary: {
          [platformKey()]: { archive: 'malicious.tar.gz', cmd: './safe' },
        },
      },
      installState: 'not_installed' as const,
      authState: 'unknown' as const,
      authMethods: [],
      platformAvailability: { available: true, key: platformKey() },
    };
    await expect(installer.install(entry)).rejects.toMatchObject({
      code: 'agent_launch_failed',
    });
  });

  it('rejects archives containing symbolic links', async () => {
    const directory = await tempDirectory();
    const source = path.join(directory, 'source');
    const archive = path.join(directory, 'symlink.tar.gz');
    await fs.mkdir(source);
    await fs.symlink('/outside', path.join(source, 'agent'));
    await execFileAsync('tar', ['-czf', archive, '-C', source, 'agent']);
    const bytes = new Uint8Array(await fs.readFile(archive));
    const installer = new AgentInstaller({
      root: path.join(directory, 'agents'),
      fetcher: async () => bytes,
    });
    const entry = {
      id: 'symlink-agent',
      name: 'Symlink',
      version: '1',
      source: 'registry' as const,
      distribution: {
        binary: {
          [platformKey()]: { archive: 'symlink.tar.gz', cmd: './agent' },
        },
      },
      installState: 'not_installed' as const,
      authState: 'unknown' as const,
      authMethods: [],
      platformAvailability: { available: true, key: platformKey() },
    };
    await expect(installer.install(entry)).rejects.toMatchObject({
      code: 'agent_launch_failed',
    });
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
    expect(
      store.resolveEnvironment({
        SHORT: 'credential:provider-key',
        URI: 'credential://provider-key',
        TEMPLATE: '${credential:provider-key}',
      })
    ).toEqual({ SHORT: secret, URI: secret, TEMPLATE: secret });
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

  it('derives lazy install state and persists auth state in the catalog', async () => {
    const db = new Database(':memory:');
    db.exec(
      `CREATE TABLE acp_agents (
        id TEXT PRIMARY KEY,
        auth_state TEXT NOT NULL,
        auth_methods_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    );
    db.prepare('INSERT INTO acp_agents VALUES (?, ?, ?, ?)').run(
      'catalog-agent',
      'authenticated',
      JSON.stringify([{ id: 'login', description: 'Login' }]),
      new Date().toISOString()
    );
    const catalog = new AgentCatalog({
      fetcher: async () => ({ agents: [] }),
      builtIns: [
        {
          id: 'catalog-agent',
          name: 'Catalog',
          distribution: { npx: { package: 'catalog@1' } },
        },
      ],
      getAuthState: (entry) => {
        const row = db
          .prepare('SELECT auth_state, auth_methods_json FROM acp_agents WHERE id = ?')
          .get(entry.id) as { auth_state: 'authenticated'; auth_methods_json: string };
        return {
          authState: row.auth_state,
          authMethods: JSON.parse(row.auth_methods_json),
        };
      },
    });
    await expect(catalog.get('catalog-agent')).resolves.toMatchObject({
      installState: 'lazy',
      authState: 'authenticated',
      authMethods: [{ id: 'login', description: 'Login' }],
    });
    db.close();
  });

  it('keeps npx installs lazy instead of invoking the binary installer', async () => {
    const db = new Database(':memory:');
    const directory = await tempDirectory();
    const catalog = new AgentCatalog({
      fetcher: async () => ({ agents: [] }),
      builtIns: [{ id: 'npx-agent', name: 'Npx', distribution: { npx: { package: 'npx-agent' } } }],
    });
    const installer = {
      install: async () => {
        throw new Error('must not install npx distributions');
      },
      uninstall: async () => undefined,
    } as unknown as AgentInstaller;
    const service = new AcpAgentService({
      db,
      catalog,
      installer,
      workspace: new WorkspaceService({ root: directory }),
    });
    await expect(service.install('npx-agent')).resolves.toMatchObject({ installState: 'lazy' });
    db.close();
  });

  it('lists profiles for missing catalog agents as unavailable', async () => {
    const db = new Database(':memory:');
    const directory = await tempDirectory();
    createProfileTable(db);
    const profiles = new AgentProfileStore(db);
    profiles.save({
      id: 'missing-profile',
      name: 'Missing',
      agentId: 'missing-agent',
      args: [],
      env: {},
      defaultCwd: directory,
      transport: 'stdio',
    });
    const catalog = new AgentCatalog({
      fetcher: async () => ({ agents: [] }),
      builtIns: [],
      getProfiles: () => profiles.list(),
    });
    await expect(catalog.get('missing-profile')).resolves.toMatchObject({
      installState: 'unavailable',
      platformAvailability: {
        available: false,
        reason: "Catalog entry 'missing-agent' is unavailable",
      },
    });
    db.close();
  });

  it('persists an explicit custom profile flag', async () => {
    const db = new Database(':memory:');
    const directory = await tempDirectory();
    createProfileTable(db);
    const profiles = new AgentProfileStore(db);
    profiles.save({
      id: 'catalog-custom',
      name: 'Catalog custom',
      agentId: 'catalog-agent',
      custom: true,
      args: [],
      env: {},
      defaultCwd: directory,
      transport: 'stdio',
    });
    expect(profiles.get('catalog-custom')).toMatchObject({
      agentId: 'catalog-agent',
      custom: true,
    });
    db.close();
  });

  it('maps resolver failures to AcpError taxonomy', async () => {
    const directory = await tempDirectory();
    const resolver = new AgentLaunchResolver({
      credentials: new CredentialStore({ directory }),
    });
    const profile: AgentProfile = {
      id: 'tcp',
      name: 'TCP',
      args: [],
      env: {},
      defaultCwd: directory,
      transport: 'tcp',
    };
    await expect(resolver.resolve(undefined, profile)).rejects.toMatchObject({
      code: 'capability_unsupported',
    });
    expect(new AcpError('agent_error', 'test')).toBeInstanceOf(AcpError);
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
