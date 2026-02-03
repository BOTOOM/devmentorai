/**
 * Images Route
 * 
 * Serves thumbnail images stored on disk.
 * Route: GET /api/images/:sessionId/:messageId/thumb_:index.jpg
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import { getThumbnailFilePath } from '../services/thumbnail-service.js';

interface ImageParams {
  sessionId: string;
  messageId: string;
  index: string;
}

export async function imagesRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/images/:sessionId/:messageId/:index
   * Serves a thumbnail image
   */
  fastify.get<{ Params: ImageParams }>(
    '/:sessionId/:messageId/:index',
    async (request: FastifyRequest<{ Params: ImageParams }>, reply: FastifyReply) => {
      const { sessionId, messageId, index } = request.params;

      // Parse index (handle "thumb_0.jpg" or just "0")
      let imageIndex: number;
      const indexMatch = index.match(/^(?:thumb_)?(\d+)(?:\.jpg)?$/);
      if (indexMatch) {
        imageIndex = parseInt(indexMatch[1], 10);
      } else {
        return reply.code(400).send({ error: 'Invalid image index format' });
      }

      // Validate parameters
      if (!sessionId || !messageId || isNaN(imageIndex) || imageIndex < 0) {
        return reply.code(400).send({ error: 'Invalid parameters' });
      }

      // Get the thumbnail file path
      const filePath = getThumbnailFilePath(sessionId, messageId, imageIndex);
      if (!filePath) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      // Read and send the file
      try {
        const fileBuffer = fs.readFileSync(filePath);
        
        return reply
          .code(200)
          .header('Content-Type', 'image/jpeg')
          .header('Cache-Control', 'public, max-age=31536000, immutable') // Cache for 1 year
          .header('Content-Length', fileBuffer.length)
          .send(fileBuffer);
      } catch (error) {
        console.error('[ImagesRoute] Failed to read image file:', error);
        return reply.code(500).send({ error: 'Failed to read image' });
      }
    }
  );

  /**
   * Alternative route pattern for URL-safe paths
   * GET /api/images/images/:sessionId/:messageId/thumb_:index.jpg
   * This handles paths like: /api/images/images/session123/msg456/thumb_0.jpg
   */
  fastify.get<{ Params: { '*': string } }>(
    '/images/*',
    async (request: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
      const pathParts = request.params['*'].split('/');
      
      // Expected format: sessionId/messageId/thumb_X.jpg
      if (pathParts.length < 3) {
        return reply.code(400).send({ error: 'Invalid path format' });
      }

      const sessionId = pathParts[0];
      const messageId = pathParts[1];
      const filename = pathParts[2];

      // Parse index from filename
      const indexMatch = filename.match(/^thumb_(\d+)\.jpg$/);
      if (!indexMatch) {
        return reply.code(400).send({ error: 'Invalid filename format' });
      }
      const imageIndex = parseInt(indexMatch[1], 10);

      // Get the thumbnail file path
      const filePath = getThumbnailFilePath(sessionId, messageId, imageIndex);
      if (!filePath) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      // Read and send the file
      try {
        const fileBuffer = fs.readFileSync(filePath);
        
        return reply
          .code(200)
          .header('Content-Type', 'image/jpeg')
          .header('Cache-Control', 'public, max-age=31536000, immutable')
          .header('Content-Length', fileBuffer.length)
          .send(fileBuffer);
      } catch (error) {
        console.error('[ImagesRoute] Failed to read image file:', error);
        return reply.code(500).send({ error: 'Failed to read image' });
      }
    }
  );
}
