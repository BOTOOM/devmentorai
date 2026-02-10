const GITHUB_API = "https://api.github.com/repos/BOTOOM/devmentorai/releases";
const RELEASES_URL = "https://github.com/BOTOOM/devmentorai/releases";

export interface ReleaseInfo {
  version: string;
  chromeUrl: string;
  firefoxUrl: string;
  releaseUrl: string;
  publishedAt: string;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  assets: GitHubAsset[];
}

export async function getLatestExtensionRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(GITHUB_API, {
      next: { revalidate: 3600 },
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) return null;

    const releases: GitHubRelease[] = await res.json();

    const extRelease = releases.find((r) => r.tag_name.startsWith("ext-v"));
    if (!extRelease) return null;

    const version = extRelease.tag_name.replace("ext-v", "");

    const chromeAsset = extRelease.assets.find(
      (a) => a.name.endsWith("-chrome.zip") || a.name.includes("chrome")
    );
    const firefoxAsset = extRelease.assets.find(
      (a) => a.name.endsWith(".xpi") || a.name.includes("firefox")
    );

    return {
      version,
      chromeUrl:
        chromeAsset?.browser_download_url ?? `${RELEASES_URL}/latest`,
      firefoxUrl:
        firefoxAsset?.browser_download_url ?? `${RELEASES_URL}/latest`,
      releaseUrl: extRelease.html_url,
      publishedAt: extRelease.published_at,
    };
  } catch {
    return null;
  }
}

export function getFallbackRelease(): ReleaseInfo {
  return {
    version: "latest",
    chromeUrl: `${RELEASES_URL}/latest`,
    firefoxUrl: `${RELEASES_URL}/latest`,
    releaseUrl: `${RELEASES_URL}/latest`,
    publishedAt: new Date().toISOString(),
  };
}
