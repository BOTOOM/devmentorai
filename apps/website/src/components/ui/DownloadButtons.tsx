import { MonitorSmartphone, Globe } from "lucide-react";
import type { ReleaseInfo } from "@/lib/github-releases";

interface DownloadButtonsProps {
  readonly release: ReleaseInfo;
}

export function DownloadButtons({ release }: DownloadButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <a
        href={release.chromeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-4 transition-all hover:border-primary sm:px-6"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-light">
          <MonitorSmartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold">Download for Chrome</p>
          <p className="text-xs text-[var(--muted)]">
            v{release.version} &middot; .zip
          </p>
        </div>
      </a>
      <a
        href={release.firefoxUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-4 transition-all hover:border-primary sm:px-6"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-light">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold">Download for Firefox</p>
          <p className="text-xs text-[var(--muted)]">
            v{release.version} &middot; .xpi
          </p>
        </div>
      </a>
    </div>
  );
}
