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
    downloadUrls: {
        chrome?: string;
        firefox?: string;
        npm?: string;
    };
    publishedAt: string;
}
/**
 * Compare two semver strings. Returns:
 *  1 if a > b, -1 if a < b, 0 if equal
 */
export declare function compareSemver(a: string, b: string): number;
/**
 * Check if an update is available for a given component.
 * Uses GitHub Releases API with a 1-hour cache.
 *
 * @param component - 'backend' or 'extension'
 * @param currentVersion - Current version string (e.g. '1.0.0')
 * @param fetchFn - Optional fetch function (for environments where global fetch differs)
 */
export declare function checkForUpdate(component: ComponentType, currentVersion: string, fetchFn?: typeof fetch): Promise<UpdateInfo>;
/**
 * Clear the update check cache (useful for testing or forced refresh).
 */
export declare function clearUpdateCache(): void;
//# sourceMappingURL=update-checker.d.ts.map