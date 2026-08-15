import { Globe, HelpCircle, Loader2, Plus, Settings, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onNewSession: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onViewPage?: () => void;
}

export function Header({
  connectionStatus,
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

  return (
    <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-xl font-bold text-transparent">
          DevMentorAI
        </span>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <span className={cn('h-2 w-2 rounded-full', status.dotClassName)} />
          <StatusIcon className={cn('h-3.5 w-3.5', status.className)} />
          <span className="sr-only">{status.text}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          onClick={_onViewPage}
          title="View current page"
          type="button"
        >
          <Globe className="h-4.5 w-4.5" />
        </button>
        <button
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          onClick={onOpenHelp}
          title="Help"
          type="button"
        >
          <HelpCircle className="h-4.5 w-4.5" />
        </button>
        <button
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          onClick={onOpenSettings}
          title="Settings"
          type="button"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
        <button
          className="rounded-lg p-1.5 text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
          onClick={onNewSession}
          title="New session"
          type="button"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
