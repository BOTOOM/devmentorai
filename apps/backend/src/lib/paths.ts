/**
 * Cross-Platform Path Utilities
 * 
 * Provides consistent path handling across Windows, macOS, and Linux.
 * Uses the same pattern as db/index.ts for data directory location.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/** Base data directory: ~/.devmentorai */
export const DATA_DIR = path.join(os.homedir(), '.devmentorai');

/** Images directory: ~/.devmentorai/images */
export const IMAGES_DIR = path.join(DATA_DIR, 'images');

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the directory path for a session's images
 * @param sessionId - The session ID
 * @returns Absolute path to the session's images directory
 */
export function getSessionImagesDir(sessionId: string): string {
  return path.join(IMAGES_DIR, sessionId);
}

/**
 * Get the directory path for a message's images
 * @param sessionId - The session ID
 * @param messageId - The message ID
 * @returns Absolute path to the message's images directory
 */
export function getMessageImagesDir(sessionId: string, messageId: string): string {
  return path.join(IMAGES_DIR, sessionId, messageId);
}

/**
 * Get the file path for a thumbnail image
 * @param sessionId - The session ID
 * @param messageId - The message ID
 * @param index - The image index (0-based)
 * @returns Absolute path to the thumbnail file
 */
export function getThumbnailPath(sessionId: string, messageId: string, index: number): string {
  return path.join(getMessageImagesDir(sessionId, messageId), `thumb_${index}.jpg`);
}

/**
 * Convert an absolute path to a relative path from DATA_DIR
 * This is used for storing portable paths in the database
 * @param absolutePath - The absolute file path
 * @returns Relative path from DATA_DIR
 */
export function toRelativePath(absolutePath: string): string {
  return path.relative(DATA_DIR, absolutePath);
}

/**
 * Convert a relative path (from DB) to an absolute path
 * @param relativePath - The relative path stored in DB
 * @returns Absolute file path
 */
export function toAbsolutePath(relativePath: string): string {
  return path.join(DATA_DIR, relativePath);
}

/**
 * Convert a file system path to a URL-safe path (always forward slashes)
 * @param fsPath - The file system path
 * @returns URL-safe path with forward slashes
 */
export function toUrlPath(fsPath: string): string {
  return fsPath.split(path.sep).join('/');
}

/**
 * Delete a directory and all its contents
 * @param dirPath - The directory to delete
 */
export function deleteDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Check if a file exists
 * @param filePath - The file path to check
 * @returns True if the file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Get file stats if the file exists
 * @param filePath - The file path
 * @returns File stats or null if file doesn't exist
 */
export function getFileStats(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

// Initialize images directory on module load
ensureDir(IMAGES_DIR);
