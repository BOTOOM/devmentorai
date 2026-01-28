import { Settings, Plus, Wifi, WifiOff, Loader2, HelpCircle, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onNewSession: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;      // D.2
  onViewPage?: () => void;      // D.1
}

export function Header({ connectionStatus, onNewSession, onOpenSettings, onOpenHelp, onViewPage }: HeaderProps) {
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
    <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            DevMentorAI
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs">
          <span className={cn('w-2 h-2 rounded-full', status.dotClassName)} />
          <StatusIcon className={cn('w-3.5 h-3.5', status.className)} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* D.1 - View current page */}
        <button
          onClick={onViewPage}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="View current page"
        >
          <Globe className="w-4.5 h-4.5" />
        </button>

        {/* D.2 - Help */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Help & shortcuts"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

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
      </div>
    </header>
  );
}
