import { User, Bot, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Message } from '@devmentorai/shared';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isUser
          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      )}>
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        'flex flex-col max-w-[85%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Context indicator */}
        {message.metadata?.action && (
          <div className="flex items-center gap-1 mb-1 text-xs text-gray-500 dark:text-gray-400">
            <Wrench className="w-3 h-3" />
            <span>{formatAction(message.metadata.action)}</span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          'px-4 py-2.5 rounded-2xl',
          isUser
            ? 'bg-primary-600 text-white rounded-tr-md'
            : isSystem
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-md'
        )}>
          <div className="text-sm whitespace-pre-wrap break-words">
            {formatContent(message.content)}
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {formatTime(message.timestamp)}
        </span>

        {/* Tool calls indicator */}
        {message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {message.metadata.toolCalls.length} tool(s) executed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const actions: Record<string, string> = {
    explain: 'Explaining',
    translate: 'Translating',
    rewrite: 'Rewriting',
    fix_grammar: 'Fixing grammar',
    summarize: 'Summarizing',
    expand: 'Expanding',
    analyze_config: 'Analyzing config',
    diagnose_error: 'Diagnosing error',
  };
  return actions[action] || action;
}

function formatContent(content: string): React.ReactNode {
  // Basic code block detection
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3);
      const firstNewline = code.indexOf('\n');
      const language = firstNewline > 0 ? code.slice(0, firstNewline) : '';
      const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code;
      
      return (
        <pre
          key={index}
          className="my-2 p-3 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg overflow-x-auto text-xs font-mono"
        >
          {language && (
            <div className="text-gray-500 text-xs mb-2">{language}</div>
          )}
          <code>{codeContent}</code>
        </pre>
      );
    }
    
    // Handle inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return inlineParts.map((inlinePart, inlineIndex) => {
      if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
        return (
          <code
            key={`${index}-${inlineIndex}`}
            className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono"
          >
            {inlinePart.slice(1, -1)}
          </code>
        );
      }
      return inlinePart;
    });
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
