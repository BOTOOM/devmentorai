/**
 * ThumbnailService
 * 
 * Handles image processing and thumbnail generation.
 * Stores thumbnails AND full images on disk and provides URLs for serving.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {
  getMessageImagesDir,
  getSessionImagesDir,
  getThumbnailPath,
  toRelativePath,
  toImageRelativePath,
  toUrlPath,
  ensureDir,
  deleteDir,
  fileExists,
} from '../lib/paths.js';
import type { ImageAttachment, ImageSource, ImageMimeType } from '@devmentorai/shared';

/** Thumbnail generation settings */
const THUMBNAIL_CONFIG = {
  maxDimension: 200,
  quality: 60,
  format: 'jpeg' as const,
};

export interface ImageInput {
  id: string;
  dataUrl: string;
  mimeType: ImageMimeType;
  source: ImageSource;
}

export interface ProcessedImage {
  id: string;
  source: ImageSource;
  mimeType: ImageMimeType;
  dimensions: { width: number; height: number };
  fileSize: number;
  timestamp: string;
  thumbnailUrl: string;
  /** Relative path for DB storage */
  thumbnailPath: string;
  /** Absolute path to full image (for Copilot SDK attachments) */
  fullImagePath: string;
  /** URL to serve full image to client */
  fullImageUrl: string;
}

/**
 * Extract base64 data and mime type from a data URL
 */
function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  
  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');
  
  return { buffer, mimeType };
}

/**
 * Get image dimensions from a buffer
 */
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Generate a thumbnail from an image buffer
 */
async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMBNAIL_CONFIG.maxDimension, THUMBNAIL_CONFIG.maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: THUMBNAIL_CONFIG.quality })
    .toBuffer();
}

/**
 * Get the file extension for a MIME type
 */
function getExtensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return extensions[mimeType] || 'jpg';
}

/**
 * Get the file path for a full image
 */
export function getFullImagePath(sessionId: string, messageId: string, index: number, extension: string): string {
  const messageDir = getMessageImagesDir(sessionId, messageId);
  return path.join(messageDir, `image_${index}.${extension}`);
}

/**
 * Process images for a message, generating and storing thumbnails AND full images
 * 
 * @param sessionId - The session ID
 * @param messageId - The message ID
 * @param images - Array of image inputs with data URLs
 * @param backendUrl - Base URL for thumbnail serving
 * @returns Array of processed images with thumbnail URLs and full image paths
 */
export async function processMessageImages(
  sessionId: string,
  messageId: string,
  images: ImageInput[],
  backendUrl: string
): Promise<ProcessedImage[]> {
  if (!images || images.length === 0) return [];

  // Ensure the message images directory exists
  const messageDir = getMessageImagesDir(sessionId, messageId);
  ensureDir(messageDir);

  const processedImages: ProcessedImage[] = [];

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    
    try {
      // Parse the data URL
      const parsed = parseDataUrl(image.dataUrl);
      if (!parsed) {
        console.error(`[ThumbnailService] Failed to parse data URL for image ${image.id}`);
        continue;
      }

      const { buffer, mimeType } = parsed;

      // Get original dimensions
      const dimensions = await getImageDimensions(buffer);

      // Generate thumbnail
      const thumbnailBuffer = await generateThumbnail(buffer);

      // Save thumbnail to disk
      const thumbnailAbsPath = getThumbnailPath(sessionId, messageId, index);
      fs.writeFileSync(thumbnailAbsPath, thumbnailBuffer);

      // Save FULL IMAGE to disk (for Copilot SDK attachments and lightbox view)
      const extension = getExtensionForMimeType(mimeType);
      const fullImageAbsPath = getFullImagePath(sessionId, messageId, index, extension);
      fs.writeFileSync(fullImageAbsPath, buffer);
      console.log(`[ThumbnailService] Saved full image to ${fullImageAbsPath}`);

      // Generate relative paths for DB storage (from DATA_DIR)
      const thumbnailRelativePath = toRelativePath(thumbnailAbsPath);
      
      // Generate URL paths for serving (from IMAGES_DIR, no "images/" prefix)
      const thumbnailUrlPath = toUrlPath(toImageRelativePath(thumbnailAbsPath));
      const fullImageUrlPath = toUrlPath(toImageRelativePath(fullImageAbsPath));

      processedImages.push({
        id: image.id,
        source: image.source,
        mimeType: image.mimeType,
        dimensions,
        fileSize: buffer.length,
        timestamp: new Date().toISOString(),
        thumbnailUrl: `${backendUrl}/api/images/${thumbnailUrlPath}`,
        thumbnailPath: thumbnailRelativePath,
        fullImagePath: fullImageAbsPath,
        fullImageUrl: `${backendUrl}/api/images/${fullImageUrlPath}`,
      });

      console.log(`[ThumbnailService] Processed image ${index + 1}/${images.length} for message ${messageId}`);
    } catch (error) {
      console.error(`[ThumbnailService] Failed to process image ${image.id}:`, error);
      // Continue with other images even if one fails
    }
  }

  return processedImages;
}

/**
 * Get the absolute path for a thumbnail from URL path segments
 * 
 * @param sessionId - The session ID
 * @param messageId - The message ID
 * @param index - The image index
 * @returns Absolute path to the thumbnail file, or null if not found
 */
export function getThumbnailFilePath(
  sessionId: string,
  messageId: string,
  index: number
): string | null {
  const thumbnailPath = getThumbnailPath(sessionId, messageId, index);
  return fileExists(thumbnailPath) ? thumbnailPath : null;
}

/**
 * Delete all images for a session (cleanup)
 * 
 * @param sessionId - The session ID
 */
export function deleteSessionImages(sessionId: string): void {
  const sessionDir = getSessionImagesDir(sessionId);
  deleteDir(sessionDir);
  console.log(`[ThumbnailService] Deleted images for session ${sessionId}`);
}

/**
 * Delete all images for a message (cleanup)
 * 
 * @param sessionId - The session ID
 * @param messageId - The message ID
 */
export function deleteMessageImages(sessionId: string, messageId: string): void {
  const messageDir = getMessageImagesDir(sessionId, messageId);
  deleteDir(messageDir);
  console.log(`[ThumbnailService] Deleted images for message ${messageId}`);
}

/**
 * Convert processed images to ImageAttachment format for storage
 */
export function toImageAttachments(processedImages: ProcessedImage[]): ImageAttachment[] {
  return processedImages.map(img => ({
    id: img.id,
    source: img.source,
    mimeType: img.mimeType,
    dimensions: img.dimensions,
    fileSize: img.fileSize,
    timestamp: img.timestamp,
    thumbnailUrl: img.thumbnailUrl,
    fullImageUrl: img.fullImageUrl,
    // Note: dataUrl is NOT included - it's only used during processing
  }));
}
