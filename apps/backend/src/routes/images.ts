/**
 * Images Route
 * 
 * Serves thumbnail and full images stored on disk.
 * Routes:
 *   GET /api/images/:sessionId/:messageId/thumb_:index.jpg - Thumbnail
 *   GET /api/images/:sessionId/:messageId/image_:index.:ext - Full image
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGES_DIR } from '../lib/paths.js';
import { getThumbnailFilePath } from '../services/thumbnail-service.js';

interface ImageParams {
  sessionId: string;
  messageId: string;
  filename: string;
}

// MIME types for supported image formats
const MIME_TYPES: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
};

export async function imagesRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/images/:sessionId/:messageId/:filename
   * Serves thumbnail or full image
   * 
   * Filename patterns:
   *   - thumb_0.jpg (thumbnail)
   *   - image_0.jpg (full image)
   *   - image_0.png (full image)
   */
  fastify.get<{ Params: ImageParams }>(
    '/:sessionId/:messageId/:filename',
    async (request: FastifyRequest<{ Params: ImageParams }>, reply: FastifyReply) => {
      const { sessionId, messageId, filename } = request.params;

      // Validate session and message IDs (basic security check)
      if (!sessionId?.match(/^session_[a-z0-9]+$/) || !messageId?.match(/^msg_[a-z0-9]+$/)) {
        return reply.code(400).send({ error: 'Invalid session or message ID format' });
      }

      // Parse filename - support thumb_N.jpg and image_N.ext
      let filePath: string | null = null;
      let mimeType = 'image/jpeg';

      // Check for thumbnail: thumb_0.jpg
      const thumbMatch = filename.match(/^thumb_(\d+)\.jpg$/);
      if (thumbMatch) {
        const imageIndex = parseInt(thumbMatch[1], 10);
        filePath = getThumbnailFilePath(sessionId, messageId, imageIndex);
        mimeType = 'image/jpeg';
      }

      // Check for full image: image_0.jpg, image_0.png, etc.
      const imageMatch = filename.match(/^image_(\d+)\.(jpg|jpeg|png|webp|gif)$/i);
      if (imageMatch) {
        const ext = imageMatch[2].toLowerCase();
        mimeType = MIME_TYPES[ext] || 'image/jpeg';
        // Build path directly
        filePath = path.join(IMAGES_DIR, sessionId, messageId, filename);
      }

      if (!filePath) {
        return reply.code(400).send({ error: 'Invalid filename format' });
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`[ImagesRoute] File not found: ${filePath}`);
        return reply.code(404).send({ error: 'Image not found' });
      }

      // Read and send the file
      try {
        const fileBuffer = fs.readFileSync(filePath);
        
        return reply
          .code(200)
          .header('Content-Type', mimeType)
          .header('Cache-Control', 'public, max-age=31536000, immutable') // Cache for 1 year
          .header('Content-Length', fileBuffer.length)
          .send(fileBuffer);
      } catch (error) {
        console.error('[ImagesRoute] Failed to read image file:', error);
        return reply.code(500).send({ error: 'Failed to read image' });
      }
    }
  );
}
