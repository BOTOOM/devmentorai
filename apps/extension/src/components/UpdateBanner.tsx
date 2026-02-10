/**
 * Update notification banner.
 * Shows when a newer version of extension or backend is available.
 */
import { useState } from 'react';
import type { UpdateInfo } from '@devmentorai/shared';

interface UpdateBannerProps {
  extensionUpdate: UpdateInfo | null;
  backendUpdate: UpdateInfo | null;
  onDismiss: () => void;
}

export function UpdateBanner({ extensionUpdate, backendUpdate, onDismiss }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const hasExtUpdate = extensionUpdate?.hasUpdate;
  const hasBackendUpdate = backendUpdate?.hasUpdate;

  if (!hasExtUpdate && !hasBackendUpdate) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        {hasExtUpdate && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            🔄 Extension v{extensionUpdate.latestVersion} available
            <a
              href={extensionUpdate.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 underline hover:text-amber-600 dark:hover:text-amber-200"
            >
              Download
            </a>
          </p>
        )}
        {hasBackendUpdate && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            🔄 Backend v{backendUpdate.latestVersion} available
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              npm update -g devmentorai-server
            </span>
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-xs font-medium shrink-0"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
