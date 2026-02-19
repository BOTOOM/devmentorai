import { Settings, Plus, Wifi, WifiOff, Loader2, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CopilotAuthStatus, CopilotQuotaStatus } from '@devmentorai/shared';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  authStatus?: CopilotAuthStatus | null;
  quotaStatus?: CopilotQuotaStatus | null;
  onNewSession: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;      // D.2
  onViewPage?: () => void;      // D.1
}

function formatQuota(status?: CopilotQuotaStatus | null): string | null {
  if (!status) return null;

  let pctRemaining: number | null = null;
  if (typeof status.percentageRemaining === 'number') {
    pctRemaining = status.percentageRemaining;
  } else if (typeof status.percentageUsed === 'number') {
    pctRemaining = 100 - status.percentageUsed;
  }

  const used = typeof status.used === 'number' ? status.used : null;
  const included = typeof status.included === 'number' ? status.included : null;

  const compactPct = typeof pctRemaining === 'number' ? `${Math.max(0, Math.round(pctRemaining))}% left` : null;
  const compactUsage = used !== null && included !== null ? `${used}/${included}` : null;

  if (compactPct && compactUsage) return `${compactPct} · ${compactUsage}`;
  return compactPct || compactUsage;
}

export function Header({
  connectionStatus,
  authStatus,
  quotaStatus,
  onNewSession,
  onOpenSettings,
  onOpenHelp,
  onViewPage: _onViewPage,
}: Readonly<HeaderProps>) {
  const statusConfig = {
    connecting: {
      icon: Loader2,
      text: chrome.i18n.getMessage('status_connecting') || 'Connecting...',
      className: 'text-yellow-500 animate-spin',
      dotClassName: 'bg-yellow-500 animate-pulse',
    },
    connected: {
      icon: Wifi,
      text: chrome.i18n.getMessage('status_connected') || 'Connected',
      className: 'text-green-500',
      dotClassName: 'bg-green-500',
    },
    disconnected: {
      icon: WifiOff,
      text: chrome.i18n.getMessage('status_disconnected') || 'Disconnected',
      className: 'text-red-500',
      dotClassName: 'bg-red-500',
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;
  const quotaLabel = formatQuota(quotaStatus);
  const loginLabel = authStatus?.isAuthenticated
    ? `@${authStatus.login || 'copilot-user'}`
    : 'Copilot login required';

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            DevMentorAI
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className={cn('w-2 h-2 rounded-full', status.dotClassName)} />
          <StatusIcon className={cn('w-3.5 h-3.5', status.className)} />
        </div>

        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border whitespace-nowrap max-w-[120px] truncate',
                authStatus?.isAuthenticated
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300'
              )}
              title={authStatus?.reason || loginLabel}
            >
              {loginLabel}
            </span>

            {quotaLabel && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300 whitespace-nowrap max-w-[110px] truncate">
                Quota {quotaLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* D.1 - View current page 
        {/*<button
          onClick={onViewPage}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="View current page"
        >
          <Globe className="w-4.5 h-4.5" />
        </button>*/}

        {/* D.2 - Help */}
        

        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">
            {chrome.i18n.getMessage('btn_new_session') || 'New'}
          </span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenHelp}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Help & shortcuts"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
}
