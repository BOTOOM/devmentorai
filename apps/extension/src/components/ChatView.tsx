import { useState, useRef, useEffect } from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { MessageBubble } from './MessageBubble';
import type { Session, Message } from '@devmentorai/shared';

interface ChatViewProps {
  session: Session | null;
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onAbort: () => void;
  disabled?: boolean;
}

export function ChatView({
  session,
  messages,
  isStreaming,
  onSendMessage,
  onAbort,
  disabled = false,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when session changes
  useEffect(() => {
    if (session && !disabled) {
      inputRef.current?.focus();
    }
  }, [session, disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isStreaming) return;

    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to DevMentorAI
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Create a new session to start chatting with your AI assistant.
            Choose from DevOps, Writing, Development, or General assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Start a conversation by typing a message below.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {isStreaming && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">
              {chrome.i18n.getMessage('status_processing') || 'Processing...'}
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={chrome.i18n.getMessage('placeholder_message') || 'Type a message...'}
              disabled={disabled || isStreaming}
              rows={1}
              className={cn(
                'w-full px-4 py-3 pr-12 text-sm rounded-xl border resize-none',
                'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-32'
              )}
              style={{
                minHeight: '48px',
              }}
            />
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={onAbort}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
              title="Stop"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || disabled}
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl transition-colors',
                input.trim() && !disabled
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
              title={chrome.i18n.getMessage('btn_send') || 'Send'}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
