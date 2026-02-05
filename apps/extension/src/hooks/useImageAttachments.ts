/**
 * useImageAttachments Hook
 * 
 * Manages draft image attachments for chat messages.
 * Handles paste, drag & drop, and screenshot attachments.
 */

import { useState, useCallback, useRef } from 'react';
import { IMAGE_CONSTANTS, type ImageAttachment, type ImageSource, type ImageMimeType } from '@devmentorai/shared';

export interface DraftImage extends ImageAttachment {
  /** Always present for draft images (before sending) */
  dataUrl: string;
}

export interface UseImageAttachmentsResult {
  /** Current draft images */
  images: DraftImage[];
  /** Whether we're at the maximum image limit */
  isAtLimit: boolean;
  /** Number of images that can still be added */
  remainingSlots: number;
  /** Add an image from a data URL */
  addImage: (dataUrl: string, source: ImageSource) => Promise<boolean>;
  /** Add image from File object */
  addImageFromFile: (file: File, source: ImageSource) => Promise<boolean>;
  /** Remove an image by ID */
  removeImage: (id: string) => void;
  /** Clear all images */
  clearImages: () => void;
  /** Get images ready for sending (with dataUrl) */
  getImagesForSend: () => Array<{
    id: string;
    dataUrl: string;
    mimeType: ImageMimeType;
    source: ImageSource;
  }>;
  /** Handle paste event */
  handlePaste: (e: ClipboardEvent) => Promise<boolean>;
  /** Handle drop event */
  handleDrop: (e: DragEvent) => Promise<boolean>;
  /** Last error message (for UI feedback) */
  lastError: string | null;
  /** Clear the last error */
  clearError: () => void;
}

/**
 * Generate a unique ID for an image
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a MIME type is supported
 */
function isSupportedMimeType(mimeType: string): mimeType is ImageMimeType {
  return (IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Extract image dimensions from a data URL
 */
async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Get file size from base64 data URL
 */
function getBase64Size(dataUrl: string): number {
  // Remove the data URL prefix
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  // Calculate size: base64 encodes 3 bytes in 4 characters
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Read a File as data URL
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function useImageAttachments(): UseImageAttachmentsResult {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const isAtLimit = images.length >= IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE;
  const remainingSlots = IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE - images.length;

  /**
   * Add an image from a data URL
   */
  const addImage = useCallback(async (dataUrl: string, source: ImageSource): Promise<boolean> => {
    // Prevent concurrent processing issues
    if (processingRef.current) return false;
    processingRef.current = true;

    try {
      // Check limit
      if (images.length >= IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE) {
        setLastError(`Maximum ${IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE} images allowed`);
        return false;
      }

      // Extract MIME type from data URL
      const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);base64,/);
      if (!mimeMatch) {
        setLastError('Invalid image format');
        return false;
      }

      const mimeType = mimeMatch[1];
      if (!isSupportedMimeType(mimeType)) {
        setLastError(`Unsupported image format: ${mimeType}`);
        return false;
      }

      // Check file size
      const fileSize = getBase64Size(dataUrl);
      if (fileSize > IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
        const maxMB = IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
        setLastError(`Image too large. Maximum size is ${maxMB}MB`);
        return false;
      }

      // Get dimensions
      const dimensions = await getImageDimensions(dataUrl);

      const newImage: DraftImage = {
        id: generateImageId(),
        source,
        mimeType,
        dimensions,
        fileSize,
        timestamp: new Date().toISOString(),
        dataUrl,
      };

      setImages(prev => [...prev, newImage]);
      setLastError(null);
      return true;
    } catch (error) {
      console.error('[useImageAttachments] Failed to add image:', error);
      setLastError('Failed to process image');
      return false;
    } finally {
      processingRef.current = false;
    }
  }, [images.length]);

  /**
   * Add an image from a File object
   */
  const addImageFromFile = useCallback(async (file: File, source: ImageSource): Promise<boolean> => {
    try {
      // Quick validation before reading
      if (!isSupportedMimeType(file.type)) {
        setLastError(`Unsupported file type: ${file.type}`);
        return false;
      }

      if (file.size > IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
        const maxMB = IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
        setLastError(`File too large. Maximum size is ${maxMB}MB`);
        return false;
      }

      const dataUrl = await readFileAsDataUrl(file);
      return addImage(dataUrl, source);
    } catch (error) {
      console.error('[useImageAttachments] Failed to read file:', error);
      setLastError('Failed to read image file');
      return false;
    }
  }, [addImage]);

  /**
   * Remove an image by ID
   */
  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  /**
   * Clear all images
   */
  const clearImages = useCallback(() => {
    setImages([]);
    setLastError(null);
  }, []);

  /**
   * Get images formatted for sending to backend
   */
  const getImagesForSend = useCallback(() => {
    console.log('[useImageAttachments] getImagesForSend called, images count:', images.length);
    const result = images.map(img => {
      console.log('[useImageAttachments] Image:', { 
        id: img.id, 
        source: img.source,
        hasDataUrl: !!img.dataUrl,
        dataUrlLength: img.dataUrl?.length || 0
      });
      return {
        id: img.id,
        dataUrl: img.dataUrl,
        mimeType: img.mimeType,
        source: img.source,
      };
    });
    return result;
  }, [images]);

  /**
   * Handle paste event - extracts images from clipboard
   */
  const handlePaste = useCallback(async (e: ClipboardEvent): Promise<boolean> => {
    const items = e.clipboardData?.items;
    if (!items) return false;

    let addedAny = false;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const success = await addImageFromFile(file, 'paste');
          if (success) addedAny = true;
        }
      }
    }

    return addedAny;
  }, [addImageFromFile]);

  /**
   * Handle drop event - extracts images from dropped files
   */
  const handleDrop = useCallback(async (e: DragEvent): Promise<boolean> => {
    const files = e.dataTransfer?.files;
    console.log('[useImageAttachments] handleDrop called, files:', files?.length || 0);
    if (!files || files.length === 0) return false;

    let addedAny = false;

    for (const file of Array.from(files)) {
      console.log('[useImageAttachments] Processing file:', file.name, file.type, file.size);
      if (file.type.startsWith('image/')) {
        const success = await addImageFromFile(file, 'drop');
        console.log('[useImageAttachments] addImageFromFile result:', success);
        if (success) addedAny = true;
        // Stop if we hit the limit
        if (images.length + (addedAny ? 1 : 0) >= IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE) {
          break;
        }
      }
    }

    return addedAny;
  }, [addImageFromFile, images.length]);

  /**
   * Clear the last error
   */
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    images,
    isAtLimit,
    remainingSlots,
    addImage,
    addImageFromFile,
    removeImage,
    clearImages,
    getImagesForSend,
    handlePaste,
    handleDrop,
    lastError,
    clearError,
  };
}
