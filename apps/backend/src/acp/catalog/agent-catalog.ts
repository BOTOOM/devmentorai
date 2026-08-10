import fs from 'node:fs/promises';
import path from 'node:path';
import { devmentorHome } from './paths.js';
import type {
  AgentCatalogEntry,
  AgentDistribution,
  AgentProfile,
  AgentSource,
  RegistryDocument,
} from './types.js';

export const ACP_REGISTRY_URL =
  'https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json';
export const DEFAULT_REGISTRY_TTL_MS = 24 * 60 * 60 * 1000;

type RegistryFetcher = (url: string) => Promise<unknown>;

type CatalogOptions = {
  fetcher?: RegistryFetcher;
  cachePath?: string;
  now?: () => number;
  ttlMs?: number;
  builtIns?: Array<Record<string, unknown>>;
  getProfiles?: () => Promise<AgentProfile[]> | AgentProfile[];
  getInstallState?: (
    entry: Omit<AgentCatalogEntry, 'platformAvailability'>
  ) => Promise<AgentCatalogEntry['installState']> | AgentCatalogEntry['installState'];
  getAuthState?: (
    entry: Omit<AgentCatalogEntry, 'platformAvailability'>
  ) =>
    | Promise<Pick<AgentCatalogEntry, 'authState' | 'authMethods'>>
    | Pick<AgentCatalogEntry, 'authState' | 'authMethods'>;
};

const BUILT_IN_AGENTS: Array<Record<string, unknown>> = [
  {
    id: 'devmentorai-openai-compatible',
    name: 'OpenAI-compatible endpoint',
    description: 'DevMentorAI ACP agent for OpenAI-compatible chat-completions endpoints',
    distribution: {
      command: {
        cmd: process.execPath,
        args: [path.resolve(process.cwd(), 'apps/acp-openai-agent/dist/main.js')],
      },
    },
  },
  {
    id: 'claude-acp',
    name: 'Claude',
    version: '0.66.0',
    description: 'Claude Agent ACP',
    distribution: { npx: { package: '@agentclientprotocol/claude-agent-acp@0.66.0' } },
  },
  {
    id: 'codex-acp',
    name: 'Codex',
    version: '1.1.14',
    description: 'Codex ACP',
    distribution: { npx: { package: '@agentclientprotocol/codex-acp@1.1.14' } },
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    version: '0.54.4',
    description: 'Gemini CLI ACP',
    distribution: { npx: { package: '@google/gemini-cli@0.54.4', args: ['--acp'] } },
  },
  {
    id: 'github-copilot-cli',
    name: 'GitHub Copilot CLI',
    version: '1.0.78',
    description: 'GitHub Copilot CLI ACP',
    distribution: { npx: { package: '@github/copilot@1.0.78', args: ['--acp'] } },
  },
];

function defaultCachePath(): string {
  return path.join(devmentorHome(), 'acp-registry.json');
}

function defaultFetcher(url: string): Promise<unknown> {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`ACP registry request failed with status ${response.status}`);
    return response.json();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseRegistry(value: unknown): RegistryDocument | undefined {
  if (!isRecord(value) || !Array.isArray(value.agents)) return undefined;
  const agents = value.agents.filter(isRecord).filter((agent) => typeof agent.id === 'string');
  return { agents };
}

function distribution(value: unknown): AgentDistribution {
  return isRecord(value) ? (value as AgentDistribution) : {};
}

function sourceEntry(
  raw: Record<string, unknown>,
  source: AgentSource
): Omit<AgentCatalogEntry, 'platformAvailability'> {
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : String(raw.id),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    ...(typeof raw.icon === 'string' ? { icon: raw.icon } : {}),
    ...(typeof raw.version === 'string' ? { version: raw.version } : {}),
    source,
    distribution: distribution(raw.distribution),
    installState: source === 'custom' ? 'installed' : 'not_installed',
    authState: 'unknown',
    authMethods: [],
  };
}

export function platformKey(): string {
  const osName = process.platform === 'win32' ? 'windows' : process.platform;
  const architecture =
    process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch;
  return `${osName}-${architecture}`;
}

function availability(
  entry: Omit<AgentCatalogEntry, 'platformAvailability'>
): AgentCatalogEntry['platformAvailability'] {
  if (entry.distribution.npx || entry.distribution.uvx || entry.distribution.command) {
    return { available: true, key: platformKey() };
  }
  if (entry.distribution.binary) {
    return entry.distribution.binary[platformKey()]
      ? { available: true, key: platformKey() }
      : {
          available: false,
          key: platformKey(),
          reason: `No binary distribution for platform ${platformKey()}`,
        };
  }
  return { available: false, key: platformKey(), reason: 'No supported distribution' };
}

async function defaultInstallState(
  entry: Omit<AgentCatalogEntry, 'platformAvailability'>
): Promise<AgentCatalogEntry['installState']> {
  if (entry.distribution.npx || entry.distribution.uvx) return 'lazy';
  if (entry.distribution.binary) {
    const binary = entry.distribution.binary[platformKey()];
    if (!binary) return 'unavailable';
    const target = path.join(devmentorHome(), 'agents', entry.id, entry.version ?? 'unknown');
    const command = path.resolve(target, binary.cmd);
    const relative = path.relative(target, command);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return 'unavailable';
    try {
      const stat = await fs.stat(command);
      return stat.isFile() ? 'installed' : 'not_installed';
    } catch {
      return 'not_installed';
    }
  }
  return entry.source === 'custom' ? 'installed' : entry.installState;
}

export class AgentCatalog {
  private readonly fetcher: RegistryFetcher;
  private readonly cachePath: string;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly builtIns: Array<Record<string, unknown>>;
  private readonly getProfiles?: CatalogOptions['getProfiles'];
  private readonly getInstallState?: CatalogOptions['getInstallState'];
  private readonly getAuthState?: CatalogOptions['getAuthState'];

  constructor(options: CatalogOptions = {}) {
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.cachePath = options.cachePath ?? defaultCachePath();
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_REGISTRY_TTL_MS;
    this.builtIns = options.builtIns ?? BUILT_IN_AGENTS;
    this.getProfiles = options.getProfiles;
    this.getInstallState = options.getInstallState;
    this.getAuthState = options.getAuthState;
  }

  async list(): Promise<AgentCatalogEntry[]> {
    const merged = new Map<string, Omit<AgentCatalogEntry, 'platformAvailability'>>();
    const unavailableProfiles = new Map<string, string>();
    for (const entry of this.builtIns) {
      if (typeof entry.id === 'string') merged.set(entry.id, sourceEntry(entry, 'builtin'));
    }
    const cached = await this.readCache();
    const registry =
      cached && this.now() - cached.fetchedAt < this.ttlMs
        ? cached.document
        : await this.fetchRegistry(cached?.document);
    for (const entry of registry?.agents ?? [])
      merged.set(String(entry.id), sourceEntry(entry, 'registry'));
    const profiles = (await this.getProfiles?.()) ?? [];
    for (const profile of profiles) {
      const raw = profile.agentId
        ? merged.get(profile.agentId)
        : sourceEntry(
            {
              id: profile.id,
              name: profile.name,
              distribution: {
                command: { cmd: profile.cmd ?? '', args: profile.args, env: profile.env },
              },
            },
            'custom'
          );
      if (!raw) {
        unavailableProfiles.set(profile.id, `Catalog entry '${profile.agentId}' is unavailable`);
        merged.set(profile.id, {
          id: profile.id,
          name: profile.name,
          source: 'custom',
          distribution: {},
          installState: 'unavailable',
          authState: 'unknown',
          authMethods: [],
        });
        continue;
      }
      merged.set(profile.id, { ...raw, id: profile.id, name: profile.name, source: 'custom' });
    }
    return Promise.all(
      [...merged.values()].map(async (entry) => {
        const authState = this.getAuthState ? await this.getAuthState(entry) : undefined;
        const installState = this.getInstallState?.(entry) ?? (await defaultInstallState(entry));
        return {
          ...entry,
          installState: unavailableProfiles.has(entry.id) ? 'unavailable' : await installState,
          ...(authState ?? {}),
          platformAvailability: unavailableProfiles.has(entry.id)
            ? {
                available: false,
                key: platformKey(),
                reason: unavailableProfiles.get(entry.id),
              }
            : availability(entry),
        };
      })
    );
  }

  async get(id: string): Promise<AgentCatalogEntry | undefined> {
    return (await this.list()).find((entry) => entry.id === id);
  }

  private async fetchRegistry(fallback?: RegistryDocument): Promise<RegistryDocument | undefined> {
    try {
      const parsed = parseRegistry(await this.fetcher(ACP_REGISTRY_URL));
      if (!parsed) return fallback;
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      await fs.writeFile(
        this.cachePath,
        JSON.stringify({ fetchedAt: this.now(), document: parsed }),
        {
          mode: 0o600,
        }
      );
      return parsed;
    } catch {
      return fallback;
    }
  }

  private async readCache(): Promise<
    { fetchedAt: number; document: RegistryDocument } | undefined
  > {
    try {
      const value: unknown = JSON.parse(await fs.readFile(this.cachePath, 'utf8'));
      if (!isRecord(value) || typeof value.fetchedAt !== 'number') return undefined;
      const document = parseRegistry(value.document);
      return document ? { fetchedAt: value.fetchedAt, document } : undefined;
    } catch {
      return undefined;
    }
  }
}
