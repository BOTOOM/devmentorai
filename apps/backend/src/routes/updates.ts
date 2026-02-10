import type { FastifyInstance } from 'fastify';
import type { ApiResponse } from '@devmentorai/shared';
import { checkForUpdate, type UpdateInfo } from '@devmentorai/shared';

interface UpdatesResponse {
  backend: UpdateInfo;
  extension: UpdateInfo;
}

export async function updatesRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Reply: ApiResponse<UpdatesResponse>;
  }>('/updates', async (_request, reply) => {
    const [backend, extension] = await Promise.all([
      checkForUpdate('backend', '1.0.0'),
      checkForUpdate('extension', '1.0.0'),
    ]);

    return reply.send({
      success: true,
      data: { backend, extension },
    });
  });
}
