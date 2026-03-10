import type { FastifyInstance } from 'fastify';
import type { ApiResponse, LLMProvider } from '@devmentorai/shared';

interface ReinitializeParams {
  providerId: string;
}

interface ReinitializeResponse {
  provider: string;
  ready: boolean;
  mockMode: boolean;
}

export async function providerRoutes(fastify: FastifyInstance) {
  /**
   * POST /providers/:providerId/reinitialize
   *
   * Re-run the initialization routine for a single provider at runtime.
   * Useful after starting Ollama / LM Studio without restarting the backend.
   */
  fastify.post<{
    Params: ReinitializeParams;
    Reply: ApiResponse<ReinitializeResponse>;
  }>('/providers/:providerId/reinitialize', async (request, reply) => {
    const { providerId } = request.params;

    if (!fastify.llmProviderService.isProviderRegistered(providerId)) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'PROVIDER_NOT_FOUND',
          message: `Provider '${providerId}' is not registered`,
        },
      });
    }

    try {
      const state = await fastify.llmProviderService.reinitializeProvider(providerId);

      return reply.send({
        success: true,
        data: {
          provider: providerId,
          ready: state.ready,
          mockMode: state.mockMode,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        success: false,
        error: {
          code: 'PROVIDER_REINIT_FAILED',
          message: `Failed to reinitialize provider '${providerId}': ${message}`,
        },
      });
    }
  });

  /**
   * GET /providers
   *
   * List all registered providers with their current state.
   */
  fastify.get<{
    Reply: ApiResponse<Array<{ id: LLMProvider; ready: boolean; mockMode: boolean }>>;
  }>('/providers', async (_request, reply) => {
    const states = fastify.llmProviderService.getProviderStates();
    const providers = Object.entries(states).map(([id, state]) => ({
      id: id as LLMProvider,
      ready: state.ready,
      mockMode: state.mockMode,
    }));

    return reply.send({
      success: true,
      data: providers,
    });
  });
}
