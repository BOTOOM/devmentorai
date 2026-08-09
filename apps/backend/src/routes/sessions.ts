import type { ApiResponse, Message, PaginatedResponse, Session } from '@devmentorai/shared';
import type { FastifyInstance } from 'fastify';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: { name: string; type: Session['type']; model?: string };
    Reply: ApiResponse<Session>;
  }>('/sessions', async (request, reply) => {
    if (!fastify.acpGateway) {
      return reply.code(503).send({
        success: false,
        error: { code: 'ACP_UNAVAILABLE', message: 'ACP gateway is unavailable' },
      });
    }
    const session = await fastify.acpGateway.nativeCreateSession(request.body);
    return reply.code(201).send({ success: true, data: session });
  });

  fastify.get<{
    Querystring: { page?: string; pageSize?: string };
    Reply: ApiResponse<PaginatedResponse<Session>>;
  }>('/sessions', async (request, reply) => {
    const page = Number.parseInt(request.query.page ?? '1', 10);
    const pageSize = Number.parseInt(request.query.pageSize ?? '50', 10);
    return reply.send({ success: true, data: fastify.sessionService.listSessions(page, pageSize) });
  });

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse<void>;
  }>('/sessions/:id', async (request, reply) => {
    if (process.env.ACP_FIXTURE_AGENT !== '1') {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
    }
    const deleted = fastify.sessionService.deleteSession(request.params.id);
    return reply.send({
      success: true,
      data: undefined,
      ...(deleted ? {} : { error: { code: 'NOT_FOUND', message: 'Session not found' } }),
    });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Session>;
  }>('/sessions/:id', async (request, reply) => {
    const session = fastify.sessionService.getSession(request.params.id);
    if (!session) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
    }
    return reply.send({ success: true, data: session });
  });

  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; pageSize?: string };
    Reply: ApiResponse<PaginatedResponse<Message>>;
  }>('/sessions/:id/messages', async (request, reply) => {
    if (!fastify.sessionService.getSession(request.params.id)) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
    }
    const page = Number.parseInt(request.query.page ?? '1', 10);
    const pageSize = Number.parseInt(request.query.pageSize ?? '100', 10);
    return reply.send({
      success: true,
      data: fastify.sessionService.listMessages(request.params.id, page, pageSize),
    });
  });
}
