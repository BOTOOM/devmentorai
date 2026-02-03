import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  processMessageImages,
  getThumbnailFilePath,
  deleteSessionImages,
  deleteMessageImages,
  toImageAttachments,
  type ImageInput,
  type ProcessedImage,
} from '../../src/services/thumbnail-service.js';
import {
  DATA_DIR,
  IMAGES_DIR,
  getSessionImagesDir,
  getMessageImagesDir,
  deleteDir,
} from '../../src/lib/paths.js';

// Test fixtures
// Small 1x1 red pixel PNG encoded as base64
const RED_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jH/wAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${RED_PIXEL_PNG}`;

// Another valid PNG (slightly different red pixel)
const RED_PIXEL_PNG_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';
const PNG_DATA_URL_2 = `data:image/png;base64,${RED_PIXEL_PNG_2}`;

const TEST_SESSION_ID = 'test_session_12345';
const TEST_MESSAGE_ID = 'test_msg_67890';
const TEST_BACKEND_URL = 'http://localhost:3847';

describe('ThumbnailService', () => {
  // Clean up test directories before and after tests
  beforeEach(() => {
    const sessionDir = getSessionImagesDir(TEST_SESSION_ID);
    deleteDir(sessionDir);
  });

  afterEach(() => {
    const sessionDir = getSessionImagesDir(TEST_SESSION_ID);
    deleteDir(sessionDir);
  });

  describe('processMessageImages', () => {
    it('should return empty array for empty input', async () => {
      const result = await processMessageImages(
        TEST_SESSION_ID,
        TEST_MESSAGE_ID,
        [],
        TEST_BACKEND_URL
      );

      expect(result).toEqual([]);
    });

    it('should process a single PNG image', async () => {
      const images: ImageInput[] = [{
        id: 'img_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'paste',
      }];

      const result = await processMessageImages(
        TEST_SESSION_ID,
        TEST_MESSAGE_ID,
        images,
        TEST_BACKEND_URL
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img_1');
      expect(result[0].source).toBe('paste');
      expect(result[0].mimeType).toBe('image/png');
      expect(result[0].thumbnailUrl).toContain(TEST_BACKEND_URL);
      expect(result[0].thumbnailUrl).toContain(TEST_SESSION_ID);
      expect(result[0].thumbnailUrl).toContain(TEST_MESSAGE_ID);
      expect(result[0].dimensions.width).toBeGreaterThan(0);
      expect(result[0].dimensions.height).toBeGreaterThan(0);
      expect(result[0].fileSize).toBeGreaterThan(0);
      expect(result[0].timestamp).toBeDefined();

      // Verify file was created
      const thumbnailPath = getThumbnailFilePath(TEST_SESSION_ID, TEST_MESSAGE_ID, 0);
      expect(thumbnailPath).not.toBeNull();
      expect(fs.existsSync(thumbnailPath!)).toBe(true);
    });

    it('should process multiple images', async () => {
      const images: ImageInput[] = [
        { id: 'img_1', dataUrl: PNG_DATA_URL, mimeType: 'image/png', source: 'paste' },
        { id: 'img_2', dataUrl: PNG_DATA_URL_2, mimeType: 'image/png', source: 'drop' },
      ];

      const result = await processMessageImages(
        TEST_SESSION_ID,
        TEST_MESSAGE_ID,
        images,
        TEST_BACKEND_URL
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('img_1');
      expect(result[1].id).toBe('img_2');

      // Verify both files were created
      expect(getThumbnailFilePath(TEST_SESSION_ID, TEST_MESSAGE_ID, 0)).not.toBeNull();
      expect(getThumbnailFilePath(TEST_SESSION_ID, TEST_MESSAGE_ID, 1)).not.toBeNull();
    });

    it('should handle screenshot source type', async () => {
      const images: ImageInput[] = [{
        id: 'screenshot_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'screenshot',
      }];

      const result = await processMessageImages(
        TEST_SESSION_ID,
        TEST_MESSAGE_ID,
        images,
        TEST_BACKEND_URL
      );

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('screenshot');
    });

    it('should skip invalid data URLs', async () => {
      const images: ImageInput[] = [
        { id: 'valid', dataUrl: PNG_DATA_URL, mimeType: 'image/png', source: 'paste' },
        { id: 'invalid', dataUrl: 'not-a-valid-data-url', mimeType: 'image/png', source: 'paste' },
      ];

      const result = await processMessageImages(
        TEST_SESSION_ID,
        TEST_MESSAGE_ID,
        images,
        TEST_BACKEND_URL
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('should create directory structure correctly', async () => {
      const images: ImageInput[] = [{
        id: 'img_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'paste',
      }];

      await processMessageImages(TEST_SESSION_ID, TEST_MESSAGE_ID, images, TEST_BACKEND_URL);

      const messageDir = getMessageImagesDir(TEST_SESSION_ID, TEST_MESSAGE_ID);
      expect(fs.existsSync(messageDir)).toBe(true);
      
      const files = fs.readdirSync(messageDir);
      expect(files).toContain('thumb_0.jpg');
    });
  });

  describe('getThumbnailFilePath', () => {
    it('should return null for non-existent file', () => {
      const result = getThumbnailFilePath('non_existent', 'non_existent', 0);
      expect(result).toBeNull();
    });

    it('should return path for existing file', async () => {
      // First create a thumbnail
      const images: ImageInput[] = [{
        id: 'img_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'paste',
      }];

      await processMessageImages(TEST_SESSION_ID, TEST_MESSAGE_ID, images, TEST_BACKEND_URL);

      // Now check if we can get the path
      const result = getThumbnailFilePath(TEST_SESSION_ID, TEST_MESSAGE_ID, 0);
      expect(result).not.toBeNull();
      expect(result).toContain(TEST_SESSION_ID);
      expect(result).toContain(TEST_MESSAGE_ID);
      expect(result).toContain('thumb_0.jpg');
    });
  });

  describe('deleteSessionImages', () => {
    it('should delete all images for a session', async () => {
      // Create images in multiple messages
      const images: ImageInput[] = [{
        id: 'img_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'paste',
      }];

      await processMessageImages(TEST_SESSION_ID, 'msg_1', images, TEST_BACKEND_URL);
      await processMessageImages(TEST_SESSION_ID, 'msg_2', images, TEST_BACKEND_URL);

      // Verify images exist
      const sessionDir = getSessionImagesDir(TEST_SESSION_ID);
      expect(fs.existsSync(sessionDir)).toBe(true);

      // Delete session images
      deleteSessionImages(TEST_SESSION_ID);

      // Verify session directory is gone
      expect(fs.existsSync(sessionDir)).toBe(false);
    });

    it('should not throw for non-existent session', () => {
      expect(() => deleteSessionImages('non_existent_session')).not.toThrow();
    });
  });

  describe('deleteMessageImages', () => {
    it('should delete images for a specific message only', async () => {
      const images: ImageInput[] = [{
        id: 'img_1',
        dataUrl: PNG_DATA_URL,
        mimeType: 'image/png',
        source: 'paste',
      }];

      await processMessageImages(TEST_SESSION_ID, 'msg_1', images, TEST_BACKEND_URL);
      await processMessageImages(TEST_SESSION_ID, 'msg_2', images, TEST_BACKEND_URL);

      // Delete only msg_1 images
      deleteMessageImages(TEST_SESSION_ID, 'msg_1');

      // msg_1 directory should be gone
      expect(fs.existsSync(getMessageImagesDir(TEST_SESSION_ID, 'msg_1'))).toBe(false);

      // msg_2 directory should still exist
      expect(fs.existsSync(getMessageImagesDir(TEST_SESSION_ID, 'msg_2'))).toBe(true);
    });
  });

  describe('toImageAttachments', () => {
    it('should convert processed images to attachment format', () => {
      const processed: ProcessedImage[] = [{
        id: 'img_1',
        source: 'paste',
        mimeType: 'image/png',
        dimensions: { width: 100, height: 100 },
        fileSize: 1234,
        timestamp: '2024-01-01T00:00:00.000Z',
        thumbnailUrl: 'http://localhost:3847/api/images/session/message/0',
        thumbnailPath: 'images/session/message/thumb_0.jpg',
      }];

      const attachments = toImageAttachments(processed);

      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toEqual({
        id: 'img_1',
        source: 'paste',
        mimeType: 'image/png',
        dimensions: { width: 100, height: 100 },
        fileSize: 1234,
        timestamp: '2024-01-01T00:00:00.000Z',
        thumbnailUrl: 'http://localhost:3847/api/images/session/message/0',
      });
      // dataUrl should NOT be included
      expect(attachments[0]).not.toHaveProperty('dataUrl');
    });
  });

  describe('paths integration', () => {
    it('should use cross-platform paths', () => {
      // Verify that paths are using path.join() style (works on all OS)
      const sessionDir = getSessionImagesDir(TEST_SESSION_ID);
      const messageDir = getMessageImagesDir(TEST_SESSION_ID, TEST_MESSAGE_ID);

      // Should contain home directory
      expect(sessionDir).toContain(os.homedir());
      expect(messageDir).toContain(os.homedir());

      // Should contain .devmentorai
      expect(sessionDir).toContain('.devmentorai');
      expect(messageDir).toContain('.devmentorai');

      // Should contain images directory
      expect(sessionDir).toContain('images');
      expect(messageDir).toContain('images');

      // Message dir should be inside session dir
      expect(messageDir.startsWith(sessionDir)).toBe(true);
    });
  });
});
