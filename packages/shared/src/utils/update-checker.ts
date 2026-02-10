/**
 * Update checker for DevMentorAI components.
 * Queries GitHub Releases API to detect new versions.
 */

export type ComponentType = 'backend' | 'extension';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  downloadUrls: { chrome?: string; firefox?: string; npm?: string };
  publishedAt: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const GITHUB_OWNER = 'BOTOOM';
const GITHUB_REPO = 'devmentorai';
const TAG_PREFIXES: Record<ComponentType, string> = {
  backend: 'backend-v',
  extension: 'ext-v',
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: UpdateInfo;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Compare two semver strings. Returns:
 *  1 if a > b, -1 if a < b, 0 if equal
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Check if an update is available for a given component.
 * Uses GitHub Releases API with a 1-hour cache.
 *
 * @param component - 'backend' or 'extension'
 * @param currentVersion - Current version string (e.g. '1.0.0')
 * @param fetchFn - Optional fetch function (for environments where global fetch differs)
 */
export async function checkForUpdate(
  component: ComponentType,
  currentVersion: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<UpdateInfo> {
  const cacheKey = `${component}:${currentVersion}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const noUpdate: UpdateInfo = {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
    downloadUrls: {},
    publishedAt: '',
  };

  try {
    const prefix = TAG_PREFIXES[component];
    const response = await fetchFn(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10`,
      {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
      return noUpdate;
    }

    const releases = (await response.json()) as GitHubRelease[];

    // Find the latest non-draft, non-prerelease release matching our tag prefix
    const matching = releases.find(
      (r) => r.tag_name.startsWith(prefix) && !r.draft && !r.prerelease,
    );

    if (!matching) {
      cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
      return noUpdate;
    }

    const latestVersion = matching.tag_name.replace(prefix, '');
    const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;

    const downloadUrls: UpdateInfo['downloadUrls'] = {};
    for (const asset of matching.assets) {
      if (asset.name.includes('chrome')) {
        downloadUrls.chrome = asset.browser_download_url;
      } else if (asset.name.includes('firefox')) {
        downloadUrls.firefox = asset.browser_download_url;
      }
    }

    if (component === 'backend') {
      downloadUrls.npm = `https://www.npmjs.com/package/devmentorai-server`;
    }

    const result: UpdateInfo = {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: matching.html_url,
      downloadUrls,
      publishedAt: matching.published_at,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
    return noUpdate;
  }
}

/**
 * Clear the update check cache (useful for testing or forced refresh).
 */
export function clearUpdateCache(): void {
  cache.clear();
}
