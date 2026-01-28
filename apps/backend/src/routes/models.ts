import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiResponse } from '@devmentorai/shared';

// D.5 - Model pricing tiers based on user info
type PricingTier = 'free' | 'cheap' | 'standard' | 'premium';

interface Model {
  id: string;
  name: string;
  description: string;
  provider: string;
  isDefault: boolean;
  pricingTier: PricingTier;   // D.5
  pricingMultiplier: number;  // D.5 - 0 = free, 0.33 = cheap, 1 = standard, 3 = premium
}

// Available models with pricing info based on user-provided data
const AVAILABLE_MODELS: Model[] = [
  // Free tier (0x)
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Fast and capable model for most tasks',
    provider: 'openai',
    isDefault: true,
    pricingTier: 'free',
    pricingMultiplier: 0,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Multimodal model with vision capabilities',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'free',
    pricingMultiplier: 0,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Fast, lightweight model for simple tasks',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'free',
    pricingMultiplier: 0,
  },
  // Cheap tier (0.33x)
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Fast, efficient model for quick tasks',
    provider: 'anthropic',
    isDefault: false,
    pricingTier: 'cheap',
    pricingMultiplier: 0.33,
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    description: 'Compact coding model',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'cheap',
    pricingMultiplier: 0.33,
  },
  // Standard tier (1x)
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Most capable model for complex reasoning',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'Enhanced reasoning and analysis',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    description: 'Specialized for code generation',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Latest generation model',
    provider: 'openai',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Balanced model for general use',
    provider: 'anthropic',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Enhanced balanced model',
    provider: 'anthropic',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Google\'s latest model',
    provider: 'google',
    isDefault: false,
    pricingTier: 'standard',
    pricingMultiplier: 1,
  },
  // Premium tier (3x)
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Premium model for complex analysis',
    provider: 'anthropic',
    isDefault: false,
    pricingTier: 'premium',
    pricingMultiplier: 3,
  },
];

export async function modelsRoutes(fastify: FastifyInstance): Promise<void> {
  // List all available models
  fastify.get<{
    Reply: ApiResponse<{ models: Model[]; default: string }>;
  }>('/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    const defaultModel = AVAILABLE_MODELS.find(m => m.isDefault);
    
    return reply.send({
      success: true,
      data: {
        models: AVAILABLE_MODELS,
        default: defaultModel?.id || 'gpt-4.1',
      },
    });
  });

  // Get specific model info
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Model>;
  }>('/models/:id', async (request, reply) => {
    const modelId = request.params.id;
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);

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
