import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { AgentConnection } from '../connection.js';
import { AcpError } from '../errors.js';
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

export class AcpAgentService {
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
    return entries.map((entry) => ({
      ...entry,
      ...(this.installed.has(entry.id) ? { installState: 'installed' as const } : {}),
      ...(this.authStates.has(entry.id) ? { authState: this.authStates.get(entry.id) } : {}),
      ...(this.authMethods.has(entry.id) ? { authMethods: this.authMethods.get(entry.id) } : {}),
    }));
  }

  async install(agentId: string): Promise<AgentCatalogEntry> {
    const entry = await this.requireEntry(agentId);
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
      await connection.authenticate(methodId);
      this.authStates.set(profileId, 'authenticated');
      if (capabilities.authMethods.length === 0) this.authStates.set(profileId, 'authenticated');
    } catch (error) {
      if (error instanceof AcpError && error.code === 'auth_required') {
        this.authStates.set(profileId, 'required');
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
}
