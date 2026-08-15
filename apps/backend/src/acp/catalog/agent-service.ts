import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';
import { AgentConnection } from '../connection.js';
import { AcpError } from '../errors.js';
import { type AcpProbeReport, runConformanceProbe } from '../probe.js';
import { AgentCatalog } from './agent-catalog.js';
import { AgentInstaller } from './agent-installer.js';
import { authOverlayFor } from './auth-overlay.js';
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
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

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
    this.migrateEnablement();
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

  /**
   * Enabling an agent is the one-click path: it records the agent as enabled and
   * creates the implicit profile so no field has to be filled in by hand. Agents
   * distributed through npx/uvx stay lazy — the first session installs them.
   */
  async enable(agentId: string): Promise<{ entry: AgentCatalogEntry; profile: AgentProfile }> {
    const entry = await this.requireEntry(agentId);
    if (!entry.platformAvailability.available) {
      throw new AcpError('agent_not_installed', `${entry.name} is not available on this platform`, {
        agentId,
        platform: entry.platformAvailability.key,
        ...(entry.platformAvailability.reason ? { reason: entry.platformAvailability.reason } : {}),
      });
    }
    const profile = this.profiles.save({
      ...(this.implicitProfile(agentId) ?? {
        id: randomUUID(),
        name: entry.name,
        agentId,
        args: [],
        env: {},
        defaultCwd: this.workspace.defaultCwd,
        transport: 'stdio' as const,
      }),
    });
    this.writeEnablement(agentId, { enabled: true, profileId: profile.id });
    if (!this.defaultAgentId()) this.setDefault(agentId);
    return {
      entry: { ...entry, enabled: true, default: this.defaultAgentId() === agentId },
      profile,
    };
  }

  /** Keeps profiles, credentials and history; only stops using the agent. */
  async disable(agentId: string): Promise<void> {
    const state = this.readEnablement(agentId);
    this.writeEnablement(agentId, { enabled: false, isDefault: false });
    const profileIds = new Set(
      [
        state?.profileId,
        ...this.profiles
          .list()
          .filter((profile) => profile.agentId === agentId)
          .map((profile) => profile.id),
      ].filter((id): id is string => typeof id === 'string')
    );
    await Promise.all(
      [...profileIds].map(async (profileId) => {
        const connection = this.connections.get(profileId);
        this.connections.delete(profileId);
        await connection?.shutdown();
      })
    );
  }

  /**
   * Stores the token encrypted in the backend and injects it into the agent
   * process through the environment variable the agent reads. The value never
   * reaches the profile row: the profile only keeps a `credential:` reference.
   */
  setAuthToken(agentId: string, token: string, envVar?: string): AgentProfile {
    if (!token) throw new AcpError('agent_error', 'A token value is required');
    const overlay = authOverlayFor(agentId);
    const variable = envVar ?? overlay?.envVars[0];
    if (!variable) {
      throw new AcpError(
        'agent_error',
        `No environment variable is known for ${agentId}; pass envVar explicitly`,
        { agentId }
      );
    }
    if (overlay && envVar && !overlay.envVars.includes(envVar)) {
      throw new AcpError('agent_error', `${agentId} does not read ${envVar}`, {
        agentId,
        accepted: overlay.envVars,
      });
    }
    const credentialId = `${agentId}:${variable}`;
    this.credentials.set(credentialId, token);
    const profile = this.implicitProfile(agentId);
    if (!profile) {
      throw new AcpError('agent_error', `Enable ${agentId} before storing a token`, { agentId });
    }
    const saved = this.profiles.save({
      ...profile,
      env: { ...profile.env, [variable]: `credential:${credentialId}` },
    });
    this.writeAuthState(agentId, 'authenticated', this.authMethods.get(agentId) ?? []);
    return saved;
  }

  clearAuthToken(agentId: string, envVar: string): void {
    this.credentials.delete(`${agentId}:${envVar}`);
    const profile = this.implicitProfile(agentId);
    if (!profile) return;
    const { [envVar]: _removed, ...env } = profile.env;
    this.profiles.save({ ...profile, env });
    this.writeAuthState(agentId, 'required', this.authMethods.get(agentId) ?? []);
  }

  setDefault(agentId: string): void {
    this.db.prepare('UPDATE acp_agents SET is_default = 0 WHERE is_default = 1').run();
    this.writeEnablement(agentId, { enabled: true, isDefault: true });
  }

  defaultAgentId(): string | undefined {
    const row = this.db
      .prepare('SELECT id FROM acp_agents WHERE is_default = 1 AND enabled = 1')
      .get() as { id: string } | undefined;
    return row?.id;
  }

  /** Profile used by new sessions and quick actions, when an agent is the default. */
  defaultProfileId(): string | undefined {
    const agentId = this.defaultAgentId();
    if (!agentId) return undefined;
    const state = this.readEnablement(agentId);
    if (state?.profileId && this.profiles.get(state.profileId)) return state.profileId;
    return this.implicitProfile(agentId)?.id;
  }

  isEnabled(agentId: string): boolean {
    return this.readEnablement(agentId)?.enabled ?? false;
  }

  enabledProfileIds(): string[] {
    return this.profiles
      .list()
      .filter((profile) => profile.agentId && this.isEnabled(profile.agentId))
      .map((profile) => profile.id);
  }

  async list(): Promise<AgentCatalogEntry[]> {
    const entries = await this.catalog.list();
    const defaultAgentId = this.defaultAgentId();
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
        const enablement = this.readEnablement(entry.id);
        return {
          ...entry,
          enabled: enablement?.enabled ?? false,
          ...(authOverlayFor(entry.id) ? { auth: authOverlayFor(entry.id) } : {}),
          default: defaultAgentId === entry.id,
          ...(enablement?.profileId ? { profileId: enablement.profileId } : {}),
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
    if (process.env.ACP_FIXTURE_AGENT === '1') {
      return this.profiles.save({
        id: DEFAULT_PROFILE_ID,
        name: 'Deterministic ACP fixture',
        custom: true,
        cmd: path.join(BACKEND_ROOT, 'node_modules/.bin/tsx'),
        args: [path.join(BACKEND_ROOT, 'src/acp/fixtures/fixture-agent.ts')],
        env: {},
        defaultCwd: this.workspace.defaultCwd,
        transport: 'stdio',
      });
    }
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

  private migrateEnablement(): void {
    const columns = this.db.prepare('PRAGMA table_info(acp_agents)').all() as Array<{
      name: string;
    }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('enabled')) {
      this.db.exec('ALTER TABLE acp_agents ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0');
    }
    if (!names.has('is_default')) {
      this.db.exec('ALTER TABLE acp_agents ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
    }
    if (!names.has('profile_id')) {
      this.db.exec('ALTER TABLE acp_agents ADD COLUMN profile_id TEXT');
    }
  }

  /** The profile Enable creates: bound to the catalog agent and not hand-written. */
  private implicitProfile(agentId: string): AgentProfile | undefined {
    const state = this.readEnablement(agentId);
    const byState = state?.profileId ? this.profiles.get(state.profileId) : undefined;
    if (byState) return byState;
    return this.profiles.list().find((profile) => profile.agentId === agentId && !profile.custom);
  }

  private readEnablement(
    id: string
  ): { enabled: boolean; isDefault: boolean; profileId?: string } | undefined {
    const row = this.db
      .prepare('SELECT enabled, is_default, profile_id FROM acp_agents WHERE id = ?')
      .get(id) as { enabled: number; is_default: number; profile_id: string | null } | undefined;
    if (!row) return undefined;
    return {
      enabled: row.enabled === 1,
      isDefault: row.is_default === 1,
      ...(row.profile_id ? { profileId: row.profile_id } : {}),
    };
  }

  private writeEnablement(
    id: string,
    patch: { enabled?: boolean; isDefault?: boolean; profileId?: string }
  ): void {
    this.db
      .prepare(
        `INSERT INTO acp_agents (id, enabled, is_default, profile_id, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           enabled = COALESCE(?, enabled),
           is_default = COALESCE(?, is_default),
           profile_id = COALESCE(?, profile_id),
           updated_at = excluded.updated_at`
      )
      .run(
        id,
        patch.enabled === true ? 1 : 0,
        patch.isDefault === true ? 1 : 0,
        patch.profileId ?? null,
        patch.enabled === undefined ? null : patch.enabled ? 1 : 0,
        patch.isDefault === undefined ? null : patch.isDefault ? 1 : 0,
        patch.profileId ?? null
      );
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
