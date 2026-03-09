import type { FastifyInstance } from 'fastify';
import type { ApiResponse, HealthResponse } from '@devmentorai/shared';
import { checkForUpdate } from '@devmentorai/shared';
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
await refreshUpdateInfo();
setInterval(refreshUpdateInfo, 60 * 60 * 1000);

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Reply: ApiResponse<HealthResponse>;
  }>('/health', async (_request, reply) => {
    const providerStates = fastify.llmProviderService.getProviderStates();
    const registeredProviders = fastify.llmProviderService.listRegisteredProviders();
    const activeProvider =
      registeredProviders.find((provider) => provider === 'copilot')
      ?? registeredProviders[0]
      ?? 'copilot';
    const activeState = providerStates[activeProvider];
    const activeReady = activeState?.ready ?? false;
    const activeMockMode = activeState?.mockMode ?? true;
    
    const healthData: HealthResponse = {
      status: activeReady ? 'healthy' : 'degraded',
      version: BACKEND_VERSION,
      copilotConnected: activeReady && !activeMockMode,
      activeProvider,
      providerStates,
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
