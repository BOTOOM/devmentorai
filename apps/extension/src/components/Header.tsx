import { Settings, Plus, Wifi, WifiOff, Loader2, HelpCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { PROVIDER_DISPLAY, type ProviderAuthStatus, type ProviderQuotaStatus, type LLMProvider } from '@devmentorai/shared';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  authStatus?: ProviderAuthStatus | null;
  quotaStatus?: ProviderQuotaStatus | null;
  onNewSession: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;      // D.2
  onViewPage?: () => void;      // D.1
}

function formatQuota(status?: ProviderQuotaStatus | null): string | null {
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

function getLoginLabel(
  authStatus: ProviderAuthStatus | null | undefined,
  providerName: string,
  providerDisplayName?: string
): string {
  const accountName = authStatus?.login || `${providerName}-user`;

  if (authStatus?.isAuthenticated) {
    return `@${accountName}`;
  }

  if (authStatus?.requiresCredential) {
    return `${providerDisplayName || providerName} API key required`;
  }

  return `${providerDisplayName || providerName} login required`;
}

function getRecoveryBadge(
  authStatus: ProviderAuthStatus | null | undefined
): { label: string; className: string; title: string } | null {
  const mode = authStatus?.sessionRecoveryMode;
  if (!mode) {
    return null;
  }

  if (mode === 'native') {
    return {
      label: 'Native resume',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300',
      title: 'Provider supports native session continuation.',
    };
  }

  if (mode === 'replay') {
    return {
      label: 'Replay recovery',
      className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-900/20 dark:text-cyan-300',
      title: 'DevMentorAI restores the conversation by replaying persisted history.',
    };
  }

  if (mode === 'summary') {
    return {
      label: 'Summary recovery',
      className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-300',
      title: 'DevMentorAI restores the conversation using a compact summary fallback.',
    };
  }

  return {
    label: 'No recovery',
    className: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
    title: 'This provider does not expose session recovery metadata.',
  };
}

export function Header({
  connectionStatus,
  authStatus,
  quotaStatus,
  onNewSession,
  onOpenSettings,
  onOpenHelp,
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
  const providerName = authStatus?.provider || 'copilot';
  const providerDisplay = PROVIDER_DISPLAY[providerName as LLMProvider];
  const loginLabel = getLoginLabel(authStatus, providerName, providerDisplay?.name);
  const recoveryBadge = getRecoveryBadge(authStatus);

  return (
    <header className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              DevMentorAI
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className={cn('w-2 h-2 rounded-full', status.dotClassName)} />
              <StatusIcon className={cn('w-3.5 h-3.5', status.className)} />
              <span>{status.text}</span>
            </div>
          </div>

          {connectionStatus === 'connected' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 min-w-0">
              {providerDisplay && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title={providerDisplay.description}
                >
                  <span aria-hidden>{providerDisplay.icon}</span>
                  <span className="truncate max-w-[140px]">{providerDisplay.name}</span>
                </span>
              )}
              {authStatus?.isAuthenticated ? (
                <div className="relative group">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-green-200 bg-green-50 text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300"
                    title={loginLabel}
                    aria-label={`${providerName} account ${loginLabel}`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </button>

                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {loginLabel}
                  </span>
                </div>
              ) : (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border max-w-full truncate border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
                  title={authStatus?.reason || loginLabel}
                >
                  {loginLabel}
                </span>
              )}

              {quotaLabel && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300 max-w-full truncate">
                  Quota {quotaLabel}
                </span>
              )}

              {recoveryBadge && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border max-w-full truncate',
                    recoveryBadge.className
                  )}
                  title={recoveryBadge.title}
                >
                  {recoveryBadge.label}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 shrink-0 self-end sm:self-start">
        {/* D.1 - View current page */}
        {/* D.2 - Help */}
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          aria-label="New session"
          title={chrome.i18n.getMessage('btn_new_session') || 'New session'}
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
      </div>
    </header>
  );
}
