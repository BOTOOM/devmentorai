import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiResponse, ModelInfo, ModelPricingTier } from '@devmentorai/shared';

const TIER_ORDER: ModelPricingTier[] = ['free', 'cheap', 'standard', 'premium'];

const FALLBACK_MODEL: ModelInfo = {
  id: 'gpt-4.1',
  name: 'GPT-4.1',
  description: 'Recommended baseline model for DevMentorAI sessions',
  provider: 'openai',
  available: true,
  isDefault: true,
  pricingTier: 'free',
  pricingMultiplier: 0,
};

function sortModelsByTierAndName(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    const aTier = a.pricingTier || 'standard';
    const bTier = b.pricingTier || 'standard';
    const tierDiff = TIER_ORDER.indexOf(aTier) - TIER_ORDER.indexOf(bTier);
    if (tierDiff !== 0) return tierDiff;

    return a.name.localeCompare(b.name);
  });
}

async function getModelsPayload(fastify: FastifyInstance): Promise<{ models: ModelInfo[]; default: string }> {
  const response = await fastify.copilotService.listModels();

  if (!response.models || response.models.length === 0) {
    return {
      models: [FALLBACK_MODEL],
      default: FALLBACK_MODEL.id,
    };
  }

  const sortedModels = sortModelsByTierAndName(response.models);
  const defaultModel =
    sortedModels.find((model) => model.id === response.default)?.id ||
    sortedModels.find((model) => model.isDefault)?.id ||
    FALLBACK_MODEL.id;

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
    Reply: ApiResponse<{ models: ModelInfo[]; default: string }>;
  }>('/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    const payload = await getModelsPayload(fastify);

    return reply.send({
      success: true,
      data: payload,
    });
  });

  // Get specific model info
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<ModelInfo>;
  }>('/models/:id', async (request, reply) => {
    const modelId = request.params.id;
    const payload = await getModelsPayload(fastify);
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
