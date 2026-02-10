/**
 * Update checker for DevMentorAI components.
 * Queries GitHub Releases API to detect new versions.
 */
const GITHUB_OWNER = 'BOTOOM';
const GITHUB_REPO = 'devmentorai';
const TAG_PREFIXES = {
    backend: 'backend-v',
    extension: 'ext-v',
};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map();
/**
 * Compare two semver strings. Returns:
 *  1 if a > b, -1 if a < b, 0 if equal
 */
export function compareSemver(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const na = pa[i] ?? 0;
        const nb = pb[i] ?? 0;
        if (na > nb)
            return 1;
        if (na < nb)
            return -1;
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
export async function checkForUpdate(component, currentVersion, fetchFn = globalThis.fetch) {
    const cacheKey = `${component}:${currentVersion}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }
    const noUpdate = {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        downloadUrls: {},
        publishedAt: '',
    };
    try {
        const prefix = TAG_PREFIXES[component];
        const response = await fetchFn(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10`, {
            headers: { Accept: 'application/vnd.github.v3+json' },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
            return noUpdate;
        }
        const releases = (await response.json());
        // Find the latest non-draft, non-prerelease release matching our tag prefix
        const matching = releases.find((r) => r.tag_name.startsWith(prefix) && !r.draft && !r.prerelease);
        if (!matching) {
            cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
            return noUpdate;
        }
        const latestVersion = matching.tag_name.replace(prefix, '');
        const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
        const downloadUrls = {};
        for (const asset of matching.assets) {
            if (asset.name.includes('chrome')) {
                downloadUrls.chrome = asset.browser_download_url;
            }
            else if (asset.name.includes('firefox')) {
                downloadUrls.firefox = asset.browser_download_url;
            }
        }
        if (component === 'backend') {
            downloadUrls.npm = `https://www.npmjs.com/package/devmentorai-server`;
        }
        const result = {
            hasUpdate,
            currentVersion,
            latestVersion,
            releaseUrl: matching.html_url,
            downloadUrls,
            publishedAt: matching.published_at,
        };
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }
    catch {
        cache.set(cacheKey, { data: noUpdate, timestamp: Date.now() });
        return noUpdate;
    }
}
/**
 * Clear the update check cache (useful for testing or forced refresh).
 */
export function clearUpdateCache() {
    cache.clear();
}
//# sourceMappingURL=update-checker.js.map