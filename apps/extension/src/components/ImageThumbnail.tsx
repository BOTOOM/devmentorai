/**
 * ImageThumbnail Component
 * 
 * Displays a single image thumbnail with optional remove button.
 * Used in both the attachment zone and message history.
 */

import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ImageSource } from '@devmentorai/shared';

interface ImageThumbnailProps {
  /** Image source URL (data URL or backend URL) */
  src: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Image source type for badge display */
  source?: ImageSource;
  /** Whether to show the remove button */
  showRemove?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Callback when thumbnail is clicked (for lightbox) */
  onClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the image is loading */
  isLoading?: boolean;
  /** Whether this is in a draft state (before sending) */
  isDraft?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
};

const sourceLabels: Record<ImageSource, string> = {
  screenshot: '📷',
  paste: '📋',
  drop: '📁',
};

export function ImageThumbnail({
  src,
  alt = 'Attached image',
  source,
  showRemove = false,
  onRemove,
  onClick,
  size = 'md',
  isLoading = false,
  isDraft = false,
  className,
}: ImageThumbnailProps) {
  return (
    <div
      className={cn(
        'relative group rounded-lg overflow-hidden border-2 transition-all',
        isDraft
          ? 'border-primary-300 dark:border-primary-600 border-dashed'
          : 'border-gray-200 dark:border-gray-700',
        onClick && 'cursor-pointer hover:border-primary-400 dark:hover:border-primary-500',
        sizeClasses[size],
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <ImageIcon className="w-5 h-5 text-gray-400" />
        </div>
      )}

      {/* Source badge */}
      {source && !isLoading && (
        <div
          className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/60 text-white px-1 rounded"
          title={`Source: ${source}`}
        >
          {sourceLabels[source]}
        </div>
      )}

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'absolute -top-1 -right-1 w-5 h-5 rounded-full',
            'bg-red-500 hover:bg-red-600 text-white',
            'flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'shadow-md'
          )}
          title="Remove image"
          aria-label="Remove image"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Hover overlay for clickable thumbnails */}
      {onClick && !isLoading && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View
          </span>
        </div>
      )}
    </div>
  );
}
