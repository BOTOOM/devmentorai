import path from 'node:path';
import { AcpError } from '../errors.js';
import type { LaunchSpec } from '../launcher.js';
import { AgentInstaller } from './agent-installer.js';
import { CredentialStore } from './credentials.js';
import type { AgentCatalogEntry, AgentProfile, LaunchResolution } from './types.js';

export type LaunchResolverOptions = {
  installer?: AgentInstaller;
  credentials?: CredentialStore;
};

export class AgentLaunchResolver {
  private readonly installer: AgentInstaller;
  private readonly credentials: CredentialStore;

  constructor(options: LaunchResolverOptions = {}) {
    this.installer = options.installer ?? new AgentInstaller();
    this.credentials = options.credentials ?? new CredentialStore();
  }

  async resolve(
    entry: AgentCatalogEntry | undefined,
    profile: AgentProfile
  ): Promise<LaunchResolution> {
    const environment = this.credentials.resolveEnvironment(profile.env);
    if (profile.custom || !entry) {
      if (!profile.cmd) {
        throw new AcpError('agent_launch_failed', `Custom profile ${profile.id} has no command`);
      }
      return {
        profile,
        ...(entry ? { catalogEntry: entry } : {}),
        launchSpec: {
          cmd: profile.cmd,
          args: profile.args,
          env: environment,
          cwd: profile.defaultCwd,
          ...(profile.transport === 'tcp'
            ? { transport: 'tcp' as const, host: profile.host ?? '127.0.0.1', port: profile.port }
            : {}),
        },
      };
    }
    const launch = await this.resolveDistribution(entry, profile);
    return {
      profile,
      catalogEntry: entry,
      launchSpec: {
        ...launch,
        env: { ...launch.env, ...environment },
        cwd: profile.defaultCwd,
        ...(profile.transport === 'tcp'
          ? { transport: 'tcp' as const, host: profile.host ?? '127.0.0.1', port: profile.port }
          : {}),
      },
    };
  }

  private async resolveDistribution(
    entry: AgentCatalogEntry,
    profile: AgentProfile
  ): Promise<LaunchSpec> {
    const distribution = entry.distribution;
    if (distribution.npx) {
      return {
        cmd: 'npx',
        args: [
          '--yes',
          distribution.npx.package,
          ...(distribution.npx.args ?? []),
          ...profile.args,
        ],
        env: distribution.npx.env,
        cwd: profile.defaultCwd,
      };
    }
    if (distribution.uvx) {
      return {
        cmd: 'uvx',
        args: [distribution.uvx.package, ...(distribution.uvx.args ?? []), ...profile.args],
        env: distribution.uvx.env,
        cwd: profile.defaultCwd,
      };
    }
    if (distribution.command) {
      return {
        cmd: distribution.command.cmd,
        args: [...(distribution.command.args ?? []), ...profile.args],
        env: distribution.command.env,
        cwd: profile.defaultCwd,
      };
    }
    if (distribution.binary) {
      const root = await this.installer.install(entry);
      const binary = distribution.binary[entry.platformAvailability.key];
      if (!binary) {
        throw new AcpError(
          'capability_unsupported',
          entry.platformAvailability.reason ?? 'Platform unavailable'
        );
      }
      return {
        cmd: path.resolve(root, binary.cmd),
        args: [...(binary.args ?? []), ...profile.args],
        cwd: profile.defaultCwd,
      };
    }
    throw new AcpError('agent_launch_failed', `Unsupported distribution for agent ${entry.id}`);
  }
}
