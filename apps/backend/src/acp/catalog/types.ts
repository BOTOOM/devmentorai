import type { LaunchSpec } from '../launcher.js';

export type AgentSource = 'builtin' | 'registry' | 'custom';
export type AgentInstallState = 'installed' | 'not_installed' | 'lazy' | 'unavailable';
export type AgentAuthState = 'unknown' | 'required' | 'authenticated';
export type AgentTransport = 'stdio' | 'tcp';

export type NpxDistribution = {
  package: string;
  args?: string[];
  env?: Record<string, string>;
};

export type UvDistribution = NpxDistribution;

export type BinaryDistribution = {
  archive: string;
  cmd: string;
  args?: string[];
  sha256?: string;
};

export type AgentDistribution = {
  npx?: NpxDistribution;
  uvx?: UvDistribution;
  binary?: Record<string, BinaryDistribution>;
  command?: {
    cmd: string;
    args?: string[];
    env?: Record<string, string>;
  };
  [key: string]: unknown;
};

export type AgentCatalogEntry = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  version?: string;
  source: AgentSource;
  distribution: AgentDistribution;
  installState: AgentInstallState;
  authState: AgentAuthState;
  authMethods: Array<{ id: string; description: string }>;
  platformAvailability: {
    available: boolean;
    key: string;
    reason?: string;
  };
};

export type AgentProfile = {
  id: string;
  name: string;
  agentId?: string;
  custom?: boolean;
  cmd?: string;
  args: string[];
  env: Record<string, string>;
  defaultCwd: string;
  transport: AgentTransport;
};

export type LaunchResolution = {
  profile: AgentProfile;
  catalogEntry?: AgentCatalogEntry;
  launchSpec: LaunchSpec;
};

export type RegistryDocument = {
  version?: string;
  agents: Array<Record<string, unknown>>;
};
