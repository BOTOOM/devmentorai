import type { ApiResponse, HealthResponse } from '@devmentorai/shared';
import { checkForUpdate } from '@devmentorai/shared';
import type { FastifyInstance } from 'fastify';
import { BACKEND_VERSION } from '../version.js';

const startTime = Date.now();

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
void refreshUpdateInfo();
setInterval(refreshUpdateInfo, 60 * 60 * 1000);

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Reply: ApiResponse<HealthResponse>;
  }>('/health', async (_request, reply) => {
    const healthData: HealthResponse = {
      status: 'healthy',
      version: BACKEND_VERSION,
      acpConnected: true,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    if (cachedUpdateInfo) {
      healthData.latestVersion = cachedUpdateInfo.latestVersion;
      healthData.updateAvailable = cachedUpdateInfo.updateAvailable;
    }

    return reply.send({
      success: true,
      data: healthData,
    });
  });
}
