import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  ApiResponse,
  PaginatedResponse,
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
  Message,
} from '@devmentorai/shared';
import { deleteSessionImages } from '../services/thumbnail-service.js';

const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['devops', 'writing', 'development', 'general']),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'paused', 'closed']).optional(),
  model: z.string().min(1).optional(),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // List sessions
  fastify.get<{
    Querystring: { page?: string; pageSize?: string };
    Reply: ApiResponse<PaginatedResponse<Session>>;
  }>('/sessions', async (request, reply) => {
    const page = Number.parseInt(request.query.page || '1', 10);
    const pageSize = Number.parseInt(request.query.pageSize || '50', 10);

    const sessions = fastify.sessionService.listSessions(page, pageSize);

    return reply.send({
      success: true,
      data: sessions,
    });
  });

  // Create session
  fastify.post<{
    Body: CreateSessionRequest;
    Reply: ApiResponse<Session>;
  }>('/sessions', async (request, reply) => {
    try {
      const body = createSessionSchema.parse(request.body);
      console.log('[sessionRoutes] Creating session with body:', body);
      
      // Create in database
      const session = fastify.sessionService.createSession(body);
      
      // Create Copilot session
      await fastify.copilotService.createCopilotSession(
        session.id,
        session.type,
        session.model,
        session.systemPrompt
      );

      return reply.code(201).send({
        success: true,
        data: session,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: { errors: error.errors },
          },
        });
      }
      throw error;
    }
  });

  // Get session
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Session>;
  }>('/sessions/:id', async (request, reply) => {
    const session = fastify.sessionService.getSession(request.params.id);

    if (!session) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    return reply.send({
      success: true,
      data: session,
    });
  });

  // Update session
  fastify.patch<{
    Params: { id: string };
    Body: UpdateSessionRequest;
    Reply: ApiResponse<Session>;
  }>('/sessions/:id', async (request, reply) => {
    try {
      const body = updateSessionSchema.parse(request.body);
      const currentSession = fastify.sessionService.getSession(request.params.id);

      if (!currentSession) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        });
      }

      if (body.model && body.model !== currentSession.model) {
        await fastify.copilotService.switchSessionModel(
          currentSession.id,
          currentSession.type,
          body.model,
          currentSession.systemPrompt
        );
      }

      const session = fastify.sessionService.updateSession(request.params.id, body);

      if (!session) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        });
      }

      return reply.send({
        success: true,
        data: session,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: { errors: error.errors },
          },
        });
      }
      throw error;
    }
  });

  // Delete session
  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse<{ deleted: boolean; sessionId: string }>;
  }>('/sessions/:id', async (request, reply) => {
    const sessionId = request.params.id;
    
    console.log(`[SessionRoute] Deleting session: ${sessionId}`);

    // First check if session exists
    const session = fastify.sessionService.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    // Destroy Copilot session first (handles cleanup of SDK resources)
    try {
      await fastify.copilotService.destroySession(sessionId);
    } catch (error) {
      console.error(`[SessionRoute] Error destroying Copilot session:`, error);
      // Continue with DB deletion even if Copilot cleanup fails
    }

    // Clean up images for this session
    try {
      deleteSessionImages(sessionId);
    } catch (error) {
      console.error(`[SessionRoute] Error deleting session images:`, error);
      // Continue with DB deletion even if image cleanup fails
    }

    // Delete from database (CASCADE will delete messages)
    const deleted = fastify.sessionService.deleteSession(sessionId);
    
    console.log(`[SessionRoute] Session ${sessionId} deleted: ${deleted}`);

    return reply.code(200).send({ 
      success: true,
      data: { deleted, sessionId }
    });
  });

  // Resume session
  fastify.post<{
    Params: { id: string };
    Reply: ApiResponse<Session>;
  }>('/sessions/:id/resume', async (request, reply) => {
    const sessionId = request.params.id;
    const session = fastify.sessionService.getSession(sessionId);

    if (!session) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    // Resume Copilot session
    const resumed = await fastify.copilotService.resumeCopilotSession(sessionId);

    if (!resumed) {
      // Create new Copilot session if resume failed
      await fastify.copilotService.createCopilotSession(
        session.id,
        session.type,
        session.model,
        session.systemPrompt
      );
    }

    // Update status to active
    const updatedSession = fastify.sessionService.updateSession(sessionId, { status: 'active' });

    return reply.send({
      success: true,
      data: updatedSession!,
    });
  });

  // Abort request
  fastify.post<{
    Params: { id: string };
    Reply: ApiResponse<void>;
  }>('/sessions/:id/abort', async (request, reply) => {
    await fastify.copilotService.abortRequest(request.params.id);

    return reply.send({
      success: true,
    });
  });

  // Get session messages
  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; pageSize?: string };
    Reply: ApiResponse<PaginatedResponse<Message>>;
  }>('/sessions/:id/messages', async (request, reply) => {
    const session = fastify.sessionService.getSession(request.params.id);

    if (!session) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    const page = Number.parseInt(request.query.page || '1', 10);
    const pageSize = Number.parseInt(request.query.pageSize || '100', 10);

    const messages = fastify.sessionService.listMessages(request.params.id, page, pageSize);

    return reply.send({
      success: true,
      data: messages,
    });
  });
}
