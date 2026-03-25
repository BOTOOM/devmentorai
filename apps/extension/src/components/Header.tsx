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
): { label: string; shortLabel: string; className: string; title: string } | null {
  const mode = authStatus?.sessionRecoveryMode;
  if (!mode) {
    return null;
  }

  if (mode === 'native') {
    return {
      label: 'Native resume',
      shortLabel: 'Native',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300',
      title: 'Provider supports native session continuation.',
    };
  }

  if (mode === 'replay') {
    return {
      label: 'Replay recovery',
      shortLabel: 'Replay',
      className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-900/20 dark:text-cyan-300',
      title: 'DevMentorAI restores the conversation by replaying persisted history.',
    };
  }

  if (mode === 'summary') {
    return {
      label: 'Summary recovery',
      shortLabel: 'Summary',
      className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-300',
      title: 'DevMentorAI restores the conversation using a compact summary fallback.',
    };
  }

  return {
    label: 'No recovery',
    shortLabel: 'No recovery',
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
  const statusLabel = connectionStatus === 'connected'
    ? 'Online'
    : connectionStatus === 'connecting'
      ? 'Syncing'
      : 'Offline';
  const chipBaseClassName = 'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition-colors';

  return (
    <header className="border-b border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[20px] font-semibold leading-tight tracking-tight text-gray-950 dark:text-white">
                DevMentorAI
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 rounded-full border border-gray-200 bg-gray-50/95 p-1 dark:border-gray-700 dark:bg-gray-900/70">
              <button
                onClick={onNewSession}
                className="flex h-8 items-center gap-1.5 rounded-full bg-primary-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-700"
                aria-label="New session"
                title={chrome.i18n.getMessage('btn_new_session') || 'New session'}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{chrome.i18n.getMessage('btn_new_session') || 'New'}</span>
              </button>

              <button
                onClick={onOpenSettings}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={onOpenHelp}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Help & shortcuts"
                aria-label="Help & shortcuts"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1 pr-1">
            <span
              className={cn(
                chipBaseClassName,
                'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300'
              )}
              title={status.text}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClassName)} />
              <StatusIcon className={cn('h-3 w-3', status.className)} />
              <span>{statusLabel}</span>
            </span>

            {connectionStatus === 'connected' && providerDisplay && (
              <span
                className={cn(
                  chipBaseClassName,
                  'max-w-[128px] border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300'
                )}
                title={providerDisplay.description}
              >
                <span aria-hidden>{providerDisplay.icon}</span>
                <span className="truncate">{providerDisplay.name}</span>
              </span>
            )}

            {connectionStatus === 'connected' && authStatus?.isAuthenticated ? (
              <div className="relative shrink-0 group">
                <button
                  type="button"
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-green-200 bg-green-50 px-1.5 text-green-700 transition-colors hover:bg-green-100 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
                  title={loginLabel}
                  aria-label={`${providerName} account ${loginLabel}`}
                >
                  <User className="h-3.5 w-3.5" />
                </button>

                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {loginLabel}
                </span>
              </div>
            ) : connectionStatus === 'connected' ? (
              <span
                className={cn(
                  chipBaseClassName,
                  'max-w-[148px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300'
                )}
                title={authStatus?.reason || loginLabel}
              >
                <span className="truncate">{loginLabel}</span>
              </span>
            ) : null}

            {connectionStatus === 'connected' && quotaLabel && (
              <span
                className={cn(
                  chipBaseClassName,
                  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-300'
                )}
                title={`Quota ${quotaLabel}`}
              >
                <span>{typeof quotaStatus?.percentageRemaining === 'number' ? `${Math.max(0, Math.round(quotaStatus.percentageRemaining))}%` : 'Quota'}</span>
              </span>
            )}

            {connectionStatus === 'connected' && recoveryBadge && (
              <span
                className={cn(
                  chipBaseClassName,
                  recoveryBadge.className
                )}
                title={recoveryBadge.title}
              >
                <span>{recoveryBadge.shortLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
