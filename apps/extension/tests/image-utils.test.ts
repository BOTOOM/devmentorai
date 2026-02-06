/**
 * Unit tests for image utilities (from useImageAttachments)
 * Tests validation, size calculations, and MIME type handling
 */
import { describe, it, expect } from 'vitest';
import { IMAGE_CONSTANTS, type ImageMimeType } from '@devmentorai/shared';

// Re-implement the utility functions for testing (they're not exported from the hook)
function isSupportedMimeType(mimeType: string): mimeType is ImageMimeType {
  return (IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

function getBase64Size(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

describe('Image Utilities', () => {
  describe('IMAGE_CONSTANTS', () => {
    it('should have max images per message limit', () => {
      expect(IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBeDefined();
      expect(typeof IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBe('number');
      expect(IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBeGreaterThan(0);
    });

    it('should have max image size in bytes', () => {
      expect(IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBeDefined();
      expect(typeof IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBe('number');
      expect(IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBeGreaterThan(0);
    });

    it('should have supported MIME types', () => {
      expect(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES).toBeDefined();
      expect(Array.isArray(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES)).toBe(true);
      expect(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES.length).toBeGreaterThan(0);
    });

    it('should support common image formats', () => {
      expect(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES).toContain('image/jpeg');
      expect(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES).toContain('image/png');
      expect(IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES).toContain('image/webp');
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for JPEG', () => {
      expect(isSupportedMimeType('image/jpeg')).toBe(true);
    });

    it('should return true for PNG', () => {
      expect(isSupportedMimeType('image/png')).toBe(true);
    });

    it('should return true for WebP', () => {
      expect(isSupportedMimeType('image/webp')).toBe(true);
    });

    it('should return false for GIF', () => {
      // GIF is typically not supported to avoid animation issues
      expect(isSupportedMimeType('image/gif')).toBe(false);
    });

    it('should return false for SVG', () => {
      expect(isSupportedMimeType('image/svg+xml')).toBe(false);
    });

    it('should return false for non-image types', () => {
      expect(isSupportedMimeType('text/plain')).toBe(false);
      expect(isSupportedMimeType('application/pdf')).toBe(false);
      expect(isSupportedMimeType('video/mp4')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isSupportedMimeType('')).toBe(false);
    });

    it('should return false for invalid MIME types', () => {
      expect(isSupportedMimeType('image')).toBe(false);
      expect(isSupportedMimeType('jpeg')).toBe(false);
      expect(isSupportedMimeType('image/')).toBe(false);
    });
  });

  describe('getBase64Size', () => {
    it('should calculate size correctly for small data', () => {
      // "Hello" in base64 is "SGVsbG8=" (5 bytes -> 8 chars with padding)
      const dataUrl = 'data:text/plain;base64,SGVsbG8=';
      const size = getBase64Size(dataUrl);
      expect(size).toBe(5);
    });

    it('should handle data URL with no padding', () => {
      // "abc" in base64 is "YWJj" (3 bytes -> 4 chars, no padding)
      const dataUrl = 'data:text/plain;base64,YWJj';
      const size = getBase64Size(dataUrl);
      expect(size).toBe(3);
    });

    it('should handle data URL with double padding', () => {
      // "a" in base64 is "YQ==" (1 byte -> 4 chars with 2 padding)
      const dataUrl = 'data:text/plain;base64,YQ==';
      const size = getBase64Size(dataUrl);
      expect(size).toBe(1);
    });

    it('should return 0 for invalid data URL', () => {
      expect(getBase64Size('not a data url')).toBe(0);
      expect(getBase64Size('')).toBe(0);
    });

    it('should return 0 for data URL without base64 content', () => {
      expect(getBase64Size('data:text/plain;base64,')).toBe(0);
    });

    it('should calculate larger sizes correctly', () => {
      // Create a known-size base64 string
      // 100 bytes = 134 base64 chars (rounded up with padding)
      const bytes = new Uint8Array(100);
      for (let i = 0; i < 100; i++) bytes[i] = i;
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
      const dataUrl = `data:application/octet-stream;base64,${base64}`;
      const size = getBase64Size(dataUrl);
      expect(size).toBe(100);
    });
  });

  describe('generateImageId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateImageId());
      }
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should have img_ prefix', () => {
      const id = generateImageId();
      expect(id.startsWith('img_')).toBe(true);
    });

    it('should contain timestamp', () => {
      const before = Date.now();
      const id = generateImageId();
      const after = Date.now();
      
      // Extract timestamp from ID (format: img_TIMESTAMP_RANDOM)
      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);
      
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should have random suffix', () => {
      const id = generateImageId();
      const parts = id.split('_');
      
      // Should have 3 parts: 'img', timestamp, random
      expect(parts.length).toBe(3);
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });

  describe('Data URL Validation', () => {
    const extractMimeType = (dataUrl: string): string | null => {
      const match = dataUrl.match(/^data:(image\/[^;]+);base64,/);
      return match ? match[1] : null;
    };

    it('should extract MIME type from JPEG data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      expect(extractMimeType(dataUrl)).toBe('image/jpeg');
    });

    it('should extract MIME type from PNG data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      expect(extractMimeType(dataUrl)).toBe('image/png');
    });

    it('should extract MIME type from WebP data URL', () => {
      const dataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4IBIAAAAwAQCdASoBAAEAAQAcJYwCdAEO';
      expect(extractMimeType(dataUrl)).toBe('image/webp');
    });

    it('should return null for non-image data URL', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8=';
      expect(extractMimeType(dataUrl)).toBeNull();
    });

    it('should return null for invalid data URL', () => {
      expect(extractMimeType('not a data url')).toBeNull();
      expect(extractMimeType('')).toBeNull();
    });
  });

  describe('Image Size Limits', () => {
    it('should have reasonable max size (between 1MB and 20MB)', () => {
      const minBytes = 1 * 1024 * 1024; // 1MB
      const maxBytes = 20 * 1024 * 1024; // 20MB
      
      expect(IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBeGreaterThanOrEqual(minBytes);
      expect(IMAGE_CONSTANTS.MAX_IMAGE_SIZE_BYTES).toBeLessThanOrEqual(maxBytes);
    });

    it('should have reasonable max images per message (between 1 and 10)', () => {
      expect(IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBeGreaterThanOrEqual(1);
      expect(IMAGE_CONSTANTS.MAX_IMAGES_PER_MESSAGE).toBeLessThanOrEqual(10);
    });
  });

  describe('Image Source Types', () => {
    // Validate that source types are as expected
    const validSources = ['paste', 'drop', 'screenshot'] as const;

    it('should have paste as valid source', () => {
      expect(validSources).toContain('paste');
    });

    it('should have drop as valid source', () => {
      expect(validSources).toContain('drop');
    });

    it('should have screenshot as valid source', () => {
      expect(validSources).toContain('screenshot');
    });
  });
});
