import type { FastifyInstance } from 'fastify';
import type { ApiResponse, HealthResponse } from '@devmentorai/shared';
import { checkForUpdate } from '@devmentorai/shared';

const startTime = Date.now();
const BACKEND_VERSION = '1.0.0';

// Cache update info in background
let cachedUpdateInfo: { latestVersion: string; updateAvailable: boolean } | null = null;

async function refreshUpdateInfo() {
  try {
    const info = await checkForUpdate('backend', BACKEND_VERSION);
    cachedUpdateInfo = { latestVersion: info.latestVersion, updateAvailable: info.hasUpdate };
  } catch {
    // Ignore — keep last cached value
  }
}

// Check on startup and every hour
refreshUpdateInfo();
setInterval(refreshUpdateInfo, 60 * 60 * 1000);

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Reply: ApiResponse<HealthResponse>;
  }>('/health', async (_request, reply) => {
    const copilotService = fastify.copilotService;
    
    const healthData: HealthResponse = {
      status: copilotService.isReady() ? 'healthy' : 'degraded',
      version: BACKEND_VERSION,
      copilotConnected: copilotService.isReady() && !copilotService.isMockMode(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      ...(cachedUpdateInfo || {}),
    };

    return reply.send({
      success: true,
      data: healthData,
    });
  });
}
