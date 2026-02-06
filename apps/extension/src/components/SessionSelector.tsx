import { useState } from 'react';
import { ChevronDown, Trash2, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Session } from '@devmentorai/shared';
import { SESSION_TYPE_CONFIGS } from '@devmentorai/shared';
import { isWritingAssistantSession } from '../services/writing-assistant-session';

interface SessionSelectorProps {
  sessions: Session[];
  activeSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionSelector({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeConfig = activeSession ? SESSION_TYPE_CONFIGS[activeSession.type] : null;
  const isActiveWritingAssistant = activeSession ? isWritingAssistantSession(activeSession) : false;

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No sessions yet. Create one to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{activeConfig?.icon || '💬'}</span>
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
              {activeSession?.name || 'Select a session'}
              {isActiveWritingAssistant && (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isActiveWritingAssistant ? 'Quick Actions History' : (activeConfig?.name || 'No session selected')}
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-5 h-5 text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 z-20 mt-1 mx-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
            {sessions.map(session => {
              const config = SESSION_TYPE_CONFIGS[session.type];
              const isActive = session.id === activeSessionId;
              const isWritingAssistant = isWritingAssistantSession(session);

              return (
                <div
                  key={session.id}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer',
                    isActive && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                >
                  <button
                    onClick={() => {
                      onSelectSession(session.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span className="text-lg">{config?.icon || '💬'}</span>
                    <div>
                      <p className={cn(
                        'font-medium flex items-center gap-1.5',
                        isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'
                      )}>
                        {session.name}
                        {isWritingAssistant && (
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {session.messageCount} messages
                        {isWritingAssistant && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400">• Quick Actions</span>
                        )}
                      </p>
                    </div>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
