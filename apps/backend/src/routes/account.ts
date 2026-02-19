import type { FastifyInstance } from 'fastify';
import type { ApiResponse, CopilotAuthStatus, CopilotQuotaStatus } from '@devmentorai/shared';

export async function accountRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Reply: ApiResponse<CopilotAuthStatus>;
  }>('/account/auth', async (_request, reply) => {
    const auth = await fastify.copilotService.getAuthStatus();

    return reply.send({
      success: true,
      data: auth,
    });
  });

  fastify.get<{
    Reply: ApiResponse<CopilotQuotaStatus>;
  }>('/account/quota', async (_request, reply) => {
    const quota = await fastify.copilotService.getQuota();

    return reply.send({
      success: true,
      data: quota,
    });
  });
}
