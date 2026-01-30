import { useState, useRef, useEffect } from 'react';
import { Send, Square, Loader2, Cpu, ChevronDown, Brain, Sparkles, Globe, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { MessageBubble } from './MessageBubble';
import type { Session, Message, ContextPayload, PlatformDetection } from '@devmentorai/shared';

interface ChatViewProps {
  session: Session | null;
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (content: string, useContext?: boolean) => void;
  onAbort: () => void;
  onChangeModel?: (model: string) => void;
  availableModels?: Array<{ id: string; name: string }>;
  disabled?: boolean;
  pendingText?: string;
  // Context-aware mode props
  contextEnabled?: boolean;
  onToggleContext?: () => void;
  isExtractingContext?: boolean;
  extractedContext?: ContextPayload | null;
  platform?: PlatformDetection | null;
  errorCount?: number;
}

export function ChatView({
  session,
  messages,
  isStreaming,
  onSendMessage,
  onAbort,
  onChangeModel,
  availableModels = [],
  disabled = false,
  pendingText,
  // Context-aware mode
  contextEnabled = false,
  onToggleContext,
  isExtractingContext = false,
  extractedContext,
  platform,
  errorCount = 0,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);
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

  // Set pending text when provided (A.3 fix: increased limit to 5000 chars)
  useEffect(() => {
    if (pendingText) {
      const maxLength = 5000;
      const truncated = pendingText.length > maxLength;
      const text = truncated ? pendingText.substring(0, maxLength) : pendingText;
      setInput(`Regarding this text:\n"${text}${truncated ? '...' : ''}"\n\n`);
      inputRef.current?.focus();
    }
  }, [pendingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isStreaming) return;

    onSendMessage(input.trim(), contextEnabled);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getSessionIcon = (type: Session['type']) => {
    switch (type) {
      case 'devops': return '🔧';
      case 'writing': return '✍️';
      case 'development': return '💻';
      default: return '🤖';
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
      {/* Session info bar - C.1: clickeable model selector */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <span>{getSessionIcon(session.type)}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{session.name}</span>
        </div>
        
        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => onChangeModel && setShowModelPicker(!showModelPicker)}
            disabled={!onChangeModel || isStreaming}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors",
              onChangeModel && !isStreaming
                ? "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                : "text-gray-400 dark:text-gray-500 cursor-default"
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{session.model}</span>
            {onChangeModel && <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showModelPicker && availableModels.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[180px] max-h-60 overflow-y-auto">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onChangeModel?.(model.id);
                    setShowModelPicker(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                    model.id === session.model && "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Start a conversation by typing a message below.
            </p>
            {session.type === 'devops' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">Quick prompts:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Explain Kubernetes pods', 'Best practices for CI/CD', 'Debug AWS Lambda'].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {session.type === 'writing' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">Quick prompts:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Write a professional email', 'Translate to Spanish', 'Make this more formal'].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {/* C.4 - Enhanced thinking indicator */}
        {isStreaming && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-pulse" />
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {chrome.i18n.getMessage('status_thinking') || 'Thinking...'}
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
        {/* Context preview bar (shows when context is enabled) */}
        {contextEnabled && extractedContext && (
          <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {platform?.product || platform?.type || 'Page Context'}
                </span>
                {platform && platform.confidence >= 0.7 && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 rounded text-[10px]">
                    {Math.round(platform.confidence * 100)}% match
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    {errorCount} errors detected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowContextPreview(!showContextPreview)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showContextPreview ? 'Hide' : 'Preview'}
              </button>
            </div>
            
            {showContextPreview && (
              <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-700 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="truncate">
                  <span className="font-medium">URL:</span> {extractedContext.page.url}
                </div>
                {extractedContext.text.selectedText && (
                  <div className="truncate">
                    <span className="font-medium">Selection:</span> {extractedContext.text.selectedText.substring(0, 100)}...
                  </div>
                )}
                {extractedContext.text.headings.length > 0 && (
                  <div className="truncate">
                    <span className="font-medium">Headings:</span> {extractedContext.text.headings.slice(0, 3).map(h => h.text).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Context toggle button */}
          {onToggleContext && (
            <button
              type="button"
              onClick={onToggleContext}
              disabled={isStreaming || isExtractingContext}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
                contextEnabled
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                (isStreaming || isExtractingContext) && 'opacity-50 cursor-not-allowed'
              )}
              title={contextEnabled 
                ? (chrome.i18n.getMessage('context_mode_on') || 'Context mode ON - Click to disable')
                : (chrome.i18n.getMessage('context_mode_off') || 'Use page context')}
            >
              {isExtractingContext ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className={cn('w-5 h-5', contextEnabled && 'animate-pulse')} />
              )}
            </button>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={contextEnabled 
                ? (chrome.i18n.getMessage('placeholder_context') || 'Ask about this page...')
                : (chrome.i18n.getMessage('placeholder_message') || 'Type a message...')}
              disabled={disabled || isStreaming}
              rows={1}
              className={cn(
                'w-full px-4 py-3 pr-12 text-sm rounded-xl border resize-none',
                'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-32',
                contextEnabled && 'ring-1 ring-indigo-300 dark:ring-indigo-700'
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
        
        {/* Context mode indicator text */}
        {contextEnabled && (
          <div className="mt-2 text-[10px] text-center text-indigo-600 dark:text-indigo-400">
            {chrome.i18n.getMessage('context_mode_hint') || 'Context mode: AI will analyze the current page'}
          </div>
        )}
      </form>
    </div>
  );
}
