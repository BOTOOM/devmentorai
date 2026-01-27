import type { FastifyInstance } from 'fastify';
import type { ApiResponse, HealthResponse } from '@devmentorai/shared';

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Reply: ApiResponse<HealthResponse>;
  }>('/health', async (_request, reply) => {
    const copilotService = fastify.copilotService;
    
    const healthData: HealthResponse = {
      status: copilotService.isReady() ? 'healthy' : 'degraded',
      version: '0.1.0',
      copilotConnected: copilotService.isReady() && !copilotService.isMockMode(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    return reply.send({
      success: true,
      data: healthData,
    });
  });
}
