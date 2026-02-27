/**
 * Images Route
 * 
 * Serves thumbnail and full images stored on disk.
 * Also provides an upload endpoint for pre-uploading images before chat.
 * 
 * Routes:
 *   GET  /api/images/:sessionId/:messageId/thumb_:index.jpg  - Thumbnail
 *   GET  /api/images/:sessionId/:messageId/image_:index.:ext  - Full image
 *   POST /api/images/upload/:sessionId/:messageId             - Pre-upload images
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGES_DIR } from '../lib/paths.js';
import {
  getThumbnailFilePath,
  processMessageImages,
  toImageAttachments,
} from '../services/thumbnail-service.js';

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

// Schema for identifying a single image in an upload payload
const uploadImageSchema = z.object({
  id: z.string(),
  dataUrl: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  source: z.enum(['screenshot', 'paste', 'drop']),
});

const uploadBodySchema = z.object({
  images: z.array(uploadImageSchema).min(1).max(5),
});

export async function imagesRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/images/upload/:sessionId/:messageId
   * Pre-upload images before sending the chat message.
   * Returns processed image info (thumbnailUrl, fullImageUrl, fullImagePath).
   */
  fastify.post<{
    Params: { sessionId: string; messageId: string };
    Body: z.infer<typeof uploadBodySchema>;
  }>(
    '/upload/:sessionId/:messageId',
    async (request, reply) => {
      try {
        const { sessionId, messageId } = request.params;
        const body = uploadBodySchema.parse(request.body);

        // Build backend URL for image serving
        const host = request.headers.host || `${request.hostname}:3847`;
        const backendUrl = `http://${host}`;

        console.log(`[ImagesRoute] Pre-uploading ${body.images.length} images for ${sessionId}/${messageId}`);

        const processedImagesRaw = await processMessageImages(
          sessionId,
          messageId,
          body.images,
          backendUrl
        );

        const processedImages = toImageAttachments(processedImagesRaw);

        // Return the processed image metadata + absolute paths for Copilot SDK attachments
        const responseImages = processedImagesRaw.map((img, i) => ({
          id: img.id,
          thumbnailUrl: img.thumbnailUrl,
          fullImageUrl: img.fullImageUrl,
          fullImagePath: img.fullImagePath,
          mimeType: img.mimeType,
          dimensions: img.dimensions,
          fileSize: img.fileSize,
        }));

        console.log(`[ImagesRoute] Pre-upload complete: ${responseImages.length} images processed`);

        return reply.send({
          success: true,
          data: { images: responseImages },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid upload body',
              details: error.errors,
            },
          });
        }
        console.error('[ImagesRoute] Upload failed:', error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: error instanceof Error ? error.message : 'Failed to process images',
          },
        });
      }
    }
  );

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
