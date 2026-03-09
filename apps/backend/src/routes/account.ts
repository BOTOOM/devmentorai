import type { FastifyInstance } from 'fastify';
import type { ApiResponse, ProviderAuthStatus, ProviderQuotaStatus } from '@devmentorai/shared';

export async function accountRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: { provider?: string };
    Reply: ApiResponse<ProviderAuthStatus>;
  }>('/account/auth', async (request, reply) => {
    const auth = await fastify.llmProviderService.getAuthStatus(request.query.provider);

    return reply.send({
      success: true,
      data: auth,
    });
  });

  fastify.get<{
    Querystring: { provider?: string };
    Reply: ApiResponse<ProviderQuotaStatus>;
  }>('/account/quota', async (request, reply) => {
    const quota = await fastify.llmProviderService.getQuota(request.query.provider);

    return reply.send({
      success: true,
      data: quota,
    });
  });
}
