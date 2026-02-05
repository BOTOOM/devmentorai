import { useState } from 'react';
import { User, Bot, Wrench, Copy, Check, Replace, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { ImageThumbnail } from './ImageThumbnail';
import { ImageLightbox } from './ImageLightbox';
import type { Message, ImageAttachment } from '@devmentorai/shared';

interface MessageBubbleProps {
  message: Message;
  onReplaceText?: (text: string) => void; // D.3, D.4 - Callback to replace selected text
}

export function MessageBubble({ message, onReplaceText }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const images = message.metadata?.images || [];
  const hasImages = images.length > 0;
  
  // Don't render empty assistant messages (A.2 fix) - but allow if has images
  if (message.role === 'assistant' && !message.content.trim() && !hasImages) {
    return null;
  }

  // D.3, D.4 - Check if this is a translate/rewrite action
  const action = message.metadata?.action;
  const isReplaceableAction = !isUser && (action === 'translate' || action === 'rewrite' || action === 'fix_grammar');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleReplace = () => {
    if (onReplaceText) {
      onReplaceText(message.content);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  // Get image source for display (prefer thumbnailUrl, fallback to dataUrl)
  const getImageSrc = (img: ImageAttachment): string => {
    return img.thumbnailUrl || img.dataUrl || '';
  };

  return (
    <>
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
          {/* Image attachments */}
          {hasImages && (
            <div className={cn(
              'flex flex-wrap gap-2 mb-2',
              images.length === 1 ? 'justify-center' : ''
            )}>
              {images.map((img, index) => (
                <ImageThumbnail
                  key={img.id}
                  src={getImageSrc(img)}
                  alt={`Attachment ${index + 1}`}
                  source={img.source}
                  size={images.length === 1 ? 'lg' : 'md'}
                  onClick={() => openLightbox(index)}
                  isLoading={!getImageSrc(img)}
                />
              ))}
            </div>
          )}

          {/* Text content */}
          {message.content && (
            <div className="text-sm whitespace-pre-wrap break-words">
              {formatContent(message.content)}
            </div>
          )}

          {/* Images-only indicator when no text */}
          {!message.content && hasImages && (
            <div className={cn(
              'flex items-center gap-1 text-xs',
              isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
            )}>
              <ImageIcon className="w-3 h-3" />
              <span>{images.length} image{images.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* D.3, D.4 - Action buttons for copy/replace */}
        {!isUser && message.content && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            
            {isReplaceableAction && onReplaceText && (
              <button
                onClick={handleReplace}
                className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                title="Replace original text"
              >
                <Replace className="w-3 h-3" />
                <span>Replace</span>
              </button>
            )}
          </div>
        )}

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

    {/* Lightbox for viewing images */}
    {lightboxIndex !== null && hasImages && (
      <ImageLightbox
        images={images.map(img => ({
          thumbnailSrc: getImageSrc(img),
          fullSrc: img.fullImageUrl,  // Will load full image, fallback to thumbnail
          alt: `Image from ${img.source}`,
          source: img.source,
        }))}
        initialIndex={lightboxIndex}
        onClose={closeLightbox}
      />
    )}
    </>
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
