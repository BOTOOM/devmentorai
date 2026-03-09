import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiResponse, ModelInfo, ModelPricingTier } from '@devmentorai/shared';

const TIER_ORDER: ModelPricingTier[] = ['free', 'cheap', 'standard', 'premium'];

const buildFallbackModel = (provider: string = 'copilot'): ModelInfo => ({
  id: provider === 'copilot' ? 'gpt-4.1' : `${provider}-default`,
  name: provider === 'copilot' ? 'GPT-4.1' : `${provider} (default)`,
  description:
    provider === 'copilot'
      ? 'Recommended baseline model for DevMentorAI sessions'
      : `Fallback model placeholder for ${provider}`,
  provider,
  available: provider === 'copilot',
  isDefault: true,
  pricingTier: 'free',
  pricingMultiplier: 0,
});

function sortModelsByTierAndName(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    const aTier = a.pricingTier || 'standard';
    const bTier = b.pricingTier || 'standard';
    const tierDiff = TIER_ORDER.indexOf(aTier) - TIER_ORDER.indexOf(bTier);
    if (tierDiff !== 0) return tierDiff;

    return a.name.localeCompare(b.name);
  });
}

async function getModelsPayload(
  fastify: FastifyInstance,
  provider?: string
): Promise<{ models: ModelInfo[]; default: string }> {
  const response = await fastify.llmProviderService.listModels(provider);

  if (!response.models || response.models.length === 0) {
    const fallbackModel = buildFallbackModel(provider || 'copilot');
    return {
      models: [fallbackModel],
      default: fallbackModel.id,
    };
  }

  const sortedModels = sortModelsByTierAndName(response.models);
  const defaultModel =
    sortedModels.find((model) => model.id === response.default)?.id ||
    sortedModels.find((model) => model.isDefault)?.id ||
    buildFallbackModel(provider || 'copilot').id;

  return {
    models: sortedModels.map((model) => ({
      ...model,
      isDefault: model.id === defaultModel,
    })),
    default: defaultModel,
  };
}

export async function modelsRoutes(fastify: FastifyInstance): Promise<void> {
  // List all available models
  fastify.get<{
    Querystring: { provider?: string };
    Reply: ApiResponse<{ models: ModelInfo[]; default: string }>;
  }>('/models', async (request: FastifyRequest<{ Querystring: { provider?: string } }>, reply: FastifyReply) => {
    const payload = await getModelsPayload(fastify, request.query.provider);

    return reply.send({
      success: true,
      data: payload,
    });
  });

  // Get specific model info
  fastify.get<{
    Params: { id: string };
    Querystring: { provider?: string };
    Reply: ApiResponse<ModelInfo>;
  }>('/models/:id', async (request, reply) => {
    const modelId = request.params.id;
    const payload = await getModelsPayload(fastify, request.query.provider);
    const model = payload.models.find((m) => m.id === modelId);

    if (!model) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Model '${modelId}' not found`,
        },
      });
    }

    return reply.send({
      success: true,
      data: model,
    });
  });
}
