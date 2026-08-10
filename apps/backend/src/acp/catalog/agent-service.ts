import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { AgentConnection } from '../connection.js';
import { AcpError } from '../errors.js';
import { type AcpProbeReport, runConformanceProbe } from '../probe.js';
import { AgentCatalog } from './agent-catalog.js';
import { AgentInstaller } from './agent-installer.js';
import { CredentialStore } from './credentials.js';
import { AgentLaunchResolver } from './launch-resolver.js';
import { AgentProfileStore } from './profile-store.js';
import type { AgentCatalogEntry, AgentProfile, LaunchResolution } from './types.js';
import { WorkspaceService } from './workspace.js';

export type ProfileInput = Omit<AgentProfile, 'id'> & { id?: string };

export type AgentServiceOptions = {
  db: Database;
  workspace: WorkspaceService;
  catalog?: AgentCatalog;
  profiles?: AgentProfileStore;
  credentials?: CredentialStore;
  installer?: AgentInstaller;
};

const DEFAULT_PROFILE_ID = 'github-copilot-cli-default';

export class AcpAgentService {
  private readonly db: Database;
  private readonly catalog: AgentCatalog;
  private readonly profiles: AgentProfileStore;
  private readonly credentials: CredentialStore;
  private readonly installer: AgentInstaller;
  private readonly resolver: AgentLaunchResolver;
  private readonly workspace: WorkspaceService;
  private readonly connections = new Map<string, AgentConnection>();
  private readonly authStates = new Map<string, AgentCatalogEntry['authState']>();
  private readonly authMethods = new Map<string, AgentCatalogEntry['authMethods']>();
  private readonly installed = new Set<string>();

  constructor(options: AgentServiceOptions) {
    this.db = options.db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS acp_agents (
        id TEXT PRIMARY KEY,
        auth_state TEXT NOT NULL DEFAULT 'unknown',
        auth_methods_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.profiles = options.profiles ?? new AgentProfileStore(options.db);
    this.credentials = options.credentials ?? new CredentialStore();
    this.installer = options.installer ?? new AgentInstaller();
    this.catalog =
      options.catalog ??
      new AgentCatalog({
        getProfiles: () => this.profiles.list(),
      });
    this.workspace = options.workspace;
    this.resolver = new AgentLaunchResolver({
      installer: this.installer,
      credentials: this.credentials,
    });
  }

  async list(): Promise<AgentCatalogEntry[]> {
    const entries = await this.catalog.list();
    return Promise.all(
      entries.map(async (entry) => {
        const installState = entry.distribution.binary
          ? this.installed.has(entry.id)
            ? 'installed'
            : (await this.installer.isInstalled(entry))
              ? 'installed'
              : entry.platformAvailability.available
                ? 'not_installed'
                : 'unavailable'
          : entry.distribution.npx || entry.distribution.uvx
            ? 'lazy'
            : entry.installState;
        const auth = this.readAuthState(entry.id);
        return {
          ...entry,
          installState,
          authState: auth?.authState ?? this.authStates.get(entry.id) ?? entry.authState,
          authMethods: auth?.authMethods ?? this.authMethods.get(entry.id) ?? entry.authMethods,
        };
      })
    );
  }

  listProfiles(): AgentProfile[] {
    return this.profiles.list();
  }

  async probe(profileId: string): Promise<AcpProbeReport> {
    const resolution = await this.resolveLaunch(profileId);
    return runConformanceProbe(resolution, resolution.profile.defaultCwd);
  }

  async install(agentId: string): Promise<AgentCatalogEntry> {
    const entry = await this.requireEntry(agentId);
    if (entry.distribution.npx || entry.distribution.uvx) {
      return { ...entry, installState: 'lazy' };
    }
    await this.installer.install(entry);
    this.installed.add(agentId);
    return { ...entry, installState: 'installed' };
  }

  async uninstall(agentId: string): Promise<void> {
    await this.installer.uninstall(await this.requireEntry(agentId));
    this.installed.delete(agentId);
  }

  createProfile(input: ProfileInput): AgentProfile {
    if (!path.isAbsolute(input.defaultCwd)) {
      throw new Error('ACP profile defaultCwd must be absolute');
    }
    const profile: AgentProfile = {
      ...input,
      id: input.id ?? randomUUID(),
      args: [...input.args],
      env: { ...input.env },
      defaultCwd: input.defaultCwd,
    };
    return this.profiles.save(profile);
  }

  ensureDefaultProfile(): AgentProfile {
    const firstProfile = this.profiles.list()[0];
    if (firstProfile) return firstProfile;
    const existing = this.profiles.get(DEFAULT_PROFILE_ID);
    if (existing) return existing;
    return this.profiles.save({
      id: DEFAULT_PROFILE_ID,
      name: 'GitHub Copilot CLI',
      agentId: 'github-copilot-cli',
      args: [],
      env: {},
      defaultCwd: this.workspace.defaultCwd,
      transport: 'stdio',
    });
  }

  updateProfile(id: string, patch: Partial<ProfileInput>): AgentProfile {
    const current = this.profiles.get(id);
    if (!current) throw new AcpError('agent_error', `Unknown ACP profile ${id}`);
    return this.profiles.save({
      ...current,
      ...patch,
      id,
      ...(patch.args ? { args: [...patch.args] } : {}),
      ...(patch.env ? { env: { ...patch.env } } : {}),
    });
  }

  deleteProfile(id: string): void {
    this.profiles.delete(id);
    void this.connections.get(id)?.shutdown();
    this.connections.delete(id);
  }

  async authenticate(profileId: string, methodId: string): Promise<void> {
    const resolution = await this.resolveLaunch(profileId);
    let connection = this.connections.get(profileId);
    if (!connection) {
      connection = new AgentConnection({ agentId: profileId, launchSpec: resolution.launchSpec });
      this.connections.set(profileId, connection);
    }
    try {
      const capabilities = await connection.connect();
      this.authMethods.set(profileId, capabilities.authMethods);
      this.writeAuthMethods(profileId, capabilities.authMethods);
      await connection.authenticate(methodId);
      this.authStates.set(profileId, 'authenticated');
      this.writeAuthState(profileId, 'authenticated', capabilities.authMethods);
    } catch (error) {
      if (error instanceof AcpError && error.code === 'auth_required') {
        this.authStates.set(profileId, 'required');
        this.writeAuthState(profileId, 'required', this.authMethods.get(profileId) ?? []);
      }
      throw error;
    }
  }

  async resolveLaunch(profileId: string): Promise<LaunchResolution> {
    const profile = this.requireProfile(profileId);
    const cwd = await this.workspace.resolve(profile.defaultCwd);
    const effective = { ...profile, defaultCwd: cwd };
    const entry = await this.catalog.get(profile.agentId ?? profile.id);
    return this.resolver.resolve(entry, effective);
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.connections.values()].map((connection) => connection.shutdown()));
    this.connections.clear();
  }

  private async requireEntry(id: string): Promise<AgentCatalogEntry> {
    const entry = await this.catalog.get(id);
    if (!entry) throw new AcpError('agent_not_installed', `Unknown ACP agent ${id}`);
    return entry;
  }

  private requireProfile(id: string): AgentProfile {
    const profile = this.profiles.get(id);
    if (!profile) throw new AcpError('agent_error', `Unknown ACP profile ${id}`);
    return profile;
  }

  private readAuthState(id: string):
    | {
        authState: AgentCatalogEntry['authState'];
        authMethods: AgentCatalogEntry['authMethods'];
      }
    | undefined {
    const row = this.db
      .prepare('SELECT auth_state, auth_methods_json FROM acp_agents WHERE id = ?')
      .get(id) as
      | { auth_state: AgentCatalogEntry['authState']; auth_methods_json: string }
      | undefined;
    if (!row) return undefined;
    try {
      return { authState: row.auth_state, authMethods: JSON.parse(row.auth_methods_json) };
    } catch {
      return { authState: row.auth_state, authMethods: [] };
    }
  }

  private writeAuthState(
    id: string,
    authState: AgentCatalogEntry['authState'],
    authMethods: AgentCatalogEntry['authMethods']
  ): void {
    this.db
      .prepare(
        `INSERT INTO acp_agents (id, auth_state, auth_methods_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           auth_state = excluded.auth_state,
           auth_methods_json = excluded.auth_methods_json,
           updated_at = excluded.updated_at`
      )
      .run(id, authState, JSON.stringify(authMethods));
  }

  private writeAuthMethods(id: string, authMethods: AgentCatalogEntry['authMethods']): void {
    this.db
      .prepare(
        `INSERT INTO acp_agents (id, auth_state, auth_methods_json, updated_at)
         VALUES (?, 'unknown', ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           auth_methods_json = excluded.auth_methods_json,
           updated_at = excluded.updated_at`
      )
      .run(id, JSON.stringify(authMethods));
  }
}
