import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { authOverlayFor } from '../../src/acp/catalog/auth-overlay.js';
import {
  AcpAgentService,
  AgentCatalog,
  AgentProfileStore,
  CredentialStore,
  WorkspaceService,
} from '../../src/acp/catalog/index.js';

const temporaryDirectories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devmentorai-enable-'));
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
      custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

async function createService(): Promise<{
  service: AcpAgentService;
  db: Database.Database;
  credentials: CredentialStore;
  workspaceRoot: string;
}> {
  const directory = await tempDirectory();
  const db = new Database(':memory:');
  createProfileTable(db);
  const profiles = new AgentProfileStore(db);
  const catalog = new AgentCatalog({
    fetcher: async () => ({ agents: [] }),
    builtIns: [
      {
        id: 'github-copilot-cli',
        name: 'GitHub Copilot CLI',
        distribution: { npx: { package: '@github/copilot' } },
      },
      { id: 'other-agent', name: 'Other Agent', distribution: { npx: { package: 'other' } } },
    ],
    getProfiles: () => profiles.list(),
  });
  const credentials = new CredentialStore({ directory });
  const service = new AcpAgentService({
    db,
    profiles,
    catalog,
    credentials,
    workspace: new WorkspaceService({ root: directory }),
  });
  return { service, db, credentials, workspaceRoot: directory };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('ACP agent enablement', () => {
  it('creates the implicit profile, is idempotent, and makes the first agent the default', async () => {
    const { service, db, workspaceRoot } = await createService();

    const first = await service.enable('github-copilot-cli');
    expect(first.profile).toMatchObject({
      name: 'GitHub Copilot CLI',
      agentId: 'github-copilot-cli',
      args: [],
      defaultCwd: workspaceRoot,
      transport: 'stdio',
    });
    expect(service.defaultAgentId()).toBe('github-copilot-cli');
    expect(service.defaultProfileId()).toBe(first.profile.id);

    const again = await service.enable('github-copilot-cli');
    expect(again.profile.id).toBe(first.profile.id);
    expect(service.listProfiles()).toHaveLength(1);

    const second = await service.enable('other-agent');
    expect(service.defaultAgentId()).toBe('github-copilot-cli');
    service.setDefault('other-agent');
    expect(service.defaultAgentId()).toBe('other-agent');
    expect(service.defaultProfileId()).toBe(second.profile.id);

    const listed = await service.list();
    expect(listed.find((entry) => entry.id === 'other-agent')).toMatchObject({
      enabled: true,
      default: true,
    });
    db.close();
  });

  it('does not list the implicit profile as a second catalog card', async () => {
    const { service, db } = await createService();
    await service.enable('github-copilot-cli');
    const listed = await service.list();
    expect(listed.filter((entry) => entry.name === 'GitHub Copilot CLI')).toHaveLength(1);
    expect(listed.map((entry) => entry.id)).toEqual(['github-copilot-cli', 'other-agent']);
    db.close();
  });

  it('reuses a hand-written profile when its derived entry is enabled', async () => {
    const { service, db } = await createService();
    const custom = service.createProfile({
      id: 'custom-profile',
      name: 'Hand-written',
      custom: true,
      cmd: 'agent',
      args: [],
      env: {},
      defaultCwd: process.cwd(),
      transport: 'stdio',
    });
    const enabled = await service.enable(custom.id);
    expect(enabled.profile.id).toBe(custom.id);
    expect(service.listProfiles()).toHaveLength(1);
    db.close();
  });

  it('keeps the profile and credentials when disabling, and drops the default', async () => {
    const { service, db, credentials } = await createService();
    const { profile } = await service.enable('github-copilot-cli');
    service.setAuthToken('github-copilot-cli', 'ghp_example');

    await service.disable('github-copilot-cli');

    expect(service.isEnabled('github-copilot-cli')).toBe(false);
    expect(service.defaultAgentId()).toBeUndefined();
    expect(service.listProfiles().map((item) => item.id)).toContain(profile.id);
    expect(credentials.get('github-copilot-cli:COPILOT_GITHUB_TOKEN')).toBe('ghp_example');

    const reEnabled = await service.enable('github-copilot-cli');
    expect(reEnabled.profile.id).toBe(profile.id);
    db.close();
  });

  it('stores a token encrypted and references it from the profile environment', async () => {
    const { service, db, credentials } = await createService();
    await service.enable('github-copilot-cli');

    const profile = service.setAuthToken('github-copilot-cli', 'ghp_example');

    expect(profile.env.COPILOT_GITHUB_TOKEN).toBe(
      'credential:github-copilot-cli:COPILOT_GITHUB_TOKEN'
    );
    expect(JSON.stringify(profile)).not.toContain('ghp_example');
    expect(credentials.get('github-copilot-cli:COPILOT_GITHUB_TOKEN')).toBe('ghp_example');

    const alternate = service.setAuthToken('github-copilot-cli', 'gh_other', 'GH_TOKEN');
    expect(alternate.env.GH_TOKEN).toBe('credential:github-copilot-cli:GH_TOKEN');

    expect(() => service.setAuthToken('github-copilot-cli', 'x', 'RANDOM_TOKEN')).toThrow(
      'does not read RANDOM_TOKEN'
    );
    expect(() => service.setAuthToken('other-agent', 'x')).toThrow(
      'No environment variable is known'
    );

    service.clearAuthToken('github-copilot-cli', 'COPILOT_GITHUB_TOKEN');
    expect(credentials.get('github-copilot-cli:COPILOT_GITHUB_TOKEN')).toBeUndefined();
    expect(service.listProfiles()[0]?.env.COPILOT_GITHUB_TOKEN).toBeUndefined();
    db.close();
  });

  it('publishes the declared Copilot environment variables as data, not code', () => {
    expect(authOverlayFor('github-copilot-cli')?.envVars).toEqual([
      'COPILOT_GITHUB_TOKEN',
      'GH_TOKEN',
      'GITHUB_TOKEN',
    ]);
    expect(authOverlayFor('an-agent-nobody-mapped')).toBeUndefined();
  });

  it('refuses to enable an agent that has no build for this platform', async () => {
    const directory = await tempDirectory();
    const db = new Database(':memory:');
    createProfileTable(db);
    const profiles = new AgentProfileStore(db);
    const service = new AcpAgentService({
      db,
      profiles,
      catalog: new AgentCatalog({
        fetcher: async () => ({ agents: [] }),
        builtIns: [
          {
            id: 'binary-agent',
            name: 'Binary Agent',
            distribution: { binary: { 'nonexistent-platform': { archive: 'x', cmd: 'x' } } },
          },
        ],
        getProfiles: () => profiles.list(),
      }),
      credentials: new CredentialStore({ directory }),
      workspace: new WorkspaceService({ root: directory }),
    });
    await expect(service.enable('binary-agent')).rejects.toThrow(
      'is not available on this platform'
    );
    expect(service.listProfiles()).toHaveLength(0);
    db.close();
  });
});
