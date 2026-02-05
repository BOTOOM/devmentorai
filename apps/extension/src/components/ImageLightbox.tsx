/**
 * ImageLightbox Component
 * 
 * Full-screen modal for viewing images at full size.
 * Supports keyboard navigation (ESC to close, arrows for multiple images).
 * Loads full image with thumbnail as placeholder/fallback.
 */

import { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ImageAttachment } from '@devmentorai/shared';

interface LightboxImage {
  /** Thumbnail URL (shown while loading / fallback) */
  thumbnailSrc: string;
  /** Full image URL (loaded progressively) */
  fullSrc?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Image source type for badge display */
  source?: ImageAttachment['source'];
}

interface ImageLightboxProps {
  /** Images to display in the lightbox */
  images: LightboxImage[];
  /** Index of the currently displayed image */
  initialIndex?: number;
  /** Callback when lightbox is closed */
  onClose: () => void;
  /** Whether to show navigation arrows (for multiple images) */
  showNavigation?: boolean;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
  showNavigation = true,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState<Record<number, boolean>>({});
  const [fullImageError, setFullImageError] = useState<Record<number, boolean>>({});

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const canGoNext = currentIndex < images.length - 1;
  const canGoPrev = currentIndex > 0;
  
  // Determine which image to display
  const isFullLoaded = fullImageLoaded[currentIndex];
  const hasFullError = fullImageError[currentIndex];
  const showFullImage = currentImage?.fullSrc && isFullLoaded && !hasFullError;
  const displaySrc = showFullImage ? currentImage.fullSrc! : currentImage?.thumbnailSrc;
  const isLoadingFull = currentImage?.fullSrc && !isFullLoaded && !hasFullError;

  const goNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(prev => prev + 1);
      setIsZoomed(false);
    }
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (canGoPrev) {
      setCurrentIndex(prev => prev - 1);
      setIsZoomed(false);
    }
  }, [canGoPrev]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(prev => !prev);
  }, []);

  // Preload full image when lightbox opens or index changes
  useEffect(() => {
    if (!currentImage?.fullSrc || fullImageLoaded[currentIndex] || fullImageError[currentIndex]) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      setFullImageLoaded(prev => ({ ...prev, [currentIndex]: true }));
    };
    img.onerror = () => {
      console.warn(`[ImageLightbox] Failed to load full image, using thumbnail`);
      setFullImageError(prev => ({ ...prev, [currentIndex]: true }));
    };
    img.src = currentImage.fullSrc;
  }, [currentIndex, currentImage?.fullSrc, fullImageLoaded, fullImageError]);

  const handleDownload = useCallback(() => {
    // Prefer full image for download, fallback to thumbnail
    const downloadSrc = currentImage?.fullSrc || currentImage?.thumbnailSrc;
    if (!downloadSrc) return;
    
    const link = document.createElement('a');
    link.href = downloadSrc;
    const ext = downloadSrc.includes('png') ? 'png' : 'jpg';
    link.download = `image_${currentIndex + 1}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentImage, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case ' ':
          e.preventDefault();
          toggleZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goNext, goPrev, toggleZoom]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Header toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-white text-sm">
          {hasMultiple && (
            <span>{currentIndex + 1} / {images.length}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={isZoomed ? 'Zoom out' : 'Zoom in'}
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleDownload}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image container */}
      <div
        className={cn(
          'relative z-10 max-w-[90vw] max-h-[85vh] transition-transform duration-200',
          isZoomed && 'cursor-zoom-out scale-150'
        )}
        onClick={isZoomed ? toggleZoom : undefined}
      >
        {/* Loading indicator overlay */}
        {isLoadingFull && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-black/60 rounded-full p-3">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          </div>
        )}
        
        <img
          src={displaySrc}
          alt={currentImage.alt || `Image ${currentIndex + 1}`}
          className={cn(
            'max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-opacity',
            !isZoomed && 'cursor-zoom-in',
            isLoadingFull && 'opacity-80'  // Slightly dim while loading full image
          )}
          onClick={!isZoomed ? toggleZoom : undefined}
        />
      </div>

      {/* Navigation arrows */}
      {showNavigation && hasMultiple && (
        <>
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className={cn(
              'absolute left-4 z-10 p-3 rounded-full bg-black/50 text-white transition-all',
              canGoPrev
                ? 'hover:bg-black/70 cursor-pointer'
                : 'opacity-30 cursor-not-allowed'
            )}
            title="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className={cn(
              'absolute right-4 z-10 p-3 rounded-full bg-black/50 text-white transition-all',
              canGoNext
                ? 'hover:bg-black/70 cursor-pointer'
                : 'opacity-30 cursor-not-allowed'
            )}
            title="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image source indicator */}
      {currentImage.source && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-black/50 text-white text-xs rounded-full">
          Source: {currentImage.source}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="absolute bottom-4 right-4 z-10 text-white/50 text-xs hidden md:block">
        ESC to close {hasMultiple && '• ← → to navigate'} • Space to zoom
      </div>
    </div>
  );
}
