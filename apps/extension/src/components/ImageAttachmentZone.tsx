/**
 * ImageAttachmentZone Component
 * 
 * Expandable area above the chat input for managing image attachments.
 * Supports drag & drop, displays thumbnails, and allows removal.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ImagePlus, X, AlertCircle, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { ImageThumbnail } from './ImageThumbnail';
import { ImageLightbox } from './ImageLightbox';
import { IMAGE_CONSTANTS } from '@devmentorai/shared';
import type { DraftImage } from '../hooks/useImageAttachments';

interface ImageAttachmentZoneProps {
  /** Current draft images */
  images: DraftImage[];
  /** Whether we're at the maximum image limit */
  isAtLimit: boolean;
  /** Number of images that can still be added */
  remainingSlots: number;
  /** Callback to remove an image */
  onRemoveImage: (id: string) => void;
  /** Callback when files are dropped */
  onDrop: (e: DragEvent) => Promise<boolean>;
  /** Last error message */
  error: string | null;
  /** Clear the error */
  onClearError: () => void;
  /** Whether attachments are enabled */
  enabled?: boolean;
  /** Callback to capture screenshot */
  onCaptureScreenshot?: () => void;
  /** Whether screenshot capture is in progress */
  isCapturingScreenshot?: boolean;
  /** Whether screenshot button should be shown */
  showScreenshotButton?: boolean;
}

export function ImageAttachmentZone({
  images,
  isAtLimit,
  remainingSlots,
  onRemoveImage,
  onDrop,
  error,
  onClearError,
  enabled = true,
  onCaptureScreenshot,
  isCapturingScreenshot = false,
  showScreenshotButton = false,
}: ImageAttachmentZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const hasImages = images.length > 0;
  const showZone = hasImages || isDragOver;

  // Handle drag events
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enabled || isAtLimit) return;
    
    // Check if dragging files
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, [enabled, isAtLimit]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide if leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as Node | null;
    if (!dropZoneRef.current?.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (!enabled) return;
    await onDrop(e);
  }, [enabled, onDrop]);

  // Set up drag event listeners on the document for global drop detection
  useEffect(() => {
    if (!enabled) return;

    const zone = dropZoneRef.current;
    if (!zone) return;

    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('drop', handleDrop);

    return () => {
      zone.removeEventListener('dragenter', handleDragEnter);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('drop', handleDrop);
    };
  }, [enabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(onClearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClearError]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dropZoneRef}
        className={cn(
          'transition-all duration-200 overflow-hidden',
          showZone ? 'max-h-40 opacity-100 mb-3' : 'max-h-0 opacity-0'
        )}
      >
        <div
          className={cn(
            'rounded-xl border-2 border-dashed p-3 transition-colors',
            isDragOver
              ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
          )}
        >
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={onClearError}
                className="p-0.5 hover:bg-red-100 dark:hover:bg-red-800/50 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Content: either drop indicator or thumbnails */}
          {isDragOver && !hasImages ? (
            <div className="flex flex-col items-center justify-center py-4 text-primary-600 dark:text-primary-400">
              <ImagePlus className="w-8 h-8 mb-2" />
              <p className="text-sm font-medium">Drop images here</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Image thumbnails */}
              {images.map((image, index) => (
                <ImageThumbnail
                  key={image.id}
                  src={image.dataUrl}
                  alt={`Attachment ${index + 1}`}
                  source={image.source}
                  size="md"
                  showRemove
                  isDraft
                  onRemove={() => onRemoveImage(image.id)}
                  onClick={() => openLightbox(index)}
                />
              ))}

              {/* Add more indicator */}
              {!isAtLimit && hasImages && (
                <div
                  className={cn(
                    'w-16 h-16 rounded-lg border-2 border-dashed',
                    'border-gray-300 dark:border-gray-600',
                    'flex flex-col items-center justify-center',
                    'text-gray-400 dark:text-gray-500 text-xs',
                    isDragOver && 'border-primary-400 dark:border-primary-500 text-primary-500'
                  )}
                >
                  <ImagePlus className="w-5 h-5 mb-0.5" />
                  <span>+{remainingSlots}</span>
                </div>
              )}

              {/* Screenshot button */}
              {showScreenshotButton && onCaptureScreenshot && !isAtLimit && (
                <button
                  onClick={onCaptureScreenshot}
                  disabled={isCapturingScreenshot}
                  className={cn(
                    'w-16 h-16 rounded-lg border-2',
                    'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500',
                    'flex flex-col items-center justify-center',
                    'text-gray-500 dark:text-gray-400 hover:text-primary-500 text-xs',
                    'transition-colors',
                    isCapturingScreenshot && 'opacity-50 cursor-not-allowed'
                  )}
                  title="Capture screenshot"
                >
                  <Camera className={cn('w-5 h-5 mb-0.5', isCapturingScreenshot && 'animate-pulse')} />
                  <span>Screen</span>
                </button>
              )}
            </div>
          )}

          {/* Limit indicator */}
          {isAtLimit && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Maximum {IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE} images reached
            </p>
          )}
        </div>
      </div>

      {/* Drag overlay for the entire chat area - shown when dragging but no images yet */}
      {isDragOver && !hasImages && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-primary-500/5" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map(img => ({
            thumbnailSrc: img.dataUrl,
            alt: `Attachment from ${img.source}`,
            source: img.source,
          }))}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}
