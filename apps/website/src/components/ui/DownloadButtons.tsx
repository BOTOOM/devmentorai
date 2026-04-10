import { Store } from "lucide-react";
import type { ReleaseInfo } from "@/lib/github-releases";

interface DownloadButtonsProps {
  readonly release: ReleaseInfo;
}

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/devmentorai/fghdjkhbockpbpgapfdjbcfbhemdeggf";
const FIREFOX_ADDONS_URL =
  "https://addons.mozilla.org/es-MX/firefox/addon/devmentorai/";

export function DownloadButtons({ release }: DownloadButtonsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex cursor-pointer items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 px-4 py-4 transition-all hover:border-primary hover:bg-primary/10 sm:px-6"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-primary">Chrome Web Store</p>
            <p className="text-xs text-[var(--muted)]">Official & recommended</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-white">
              Install →
            </span>
          </div>
        </a>
        <a
          href={FIREFOX_ADDONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex cursor-pointer items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 px-4 py-4 transition-all hover:border-primary hover:bg-primary/10 sm:px-6"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-primary">Firefox Add-ons</p>
            <p className="text-xs text-[var(--muted)]">Official & recommended</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-white">
              Install →
            </span>
          </div>
        </a>
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        Or download directly as{" "}
        <a
          href={release.chromeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          .zip
        </a>{" "}
        /{" "}
        <a
          href={release.firefoxUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          .xpi
        </a>{" "}
        (manual installation)
      </p>
    </div>
  );
}
