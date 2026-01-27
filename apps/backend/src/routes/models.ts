import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiResponse } from '@devmentorai/shared';

// Available models based on Copilot SDK documentation
const AVAILABLE_MODELS = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Fast and capable model for most tasks',
    provider: 'openai',
    isDefault: true,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    description: 'Most capable model for complex reasoning',
    provider: 'openai',
    isDefault: false,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Fast, lightweight model for simple tasks',
    provider: 'openai',
    isDefault: false,
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced model for general use',
    provider: 'anthropic',
    isDefault: false,
  },
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Premium model for complex analysis',
    provider: 'anthropic',
    isDefault: false,
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Fast, efficient model for quick tasks',
    provider: 'anthropic',
    isDefault: false,
  },
];

interface Model {
  id: string;
  name: string;
  description: string;
  provider: string;
  isDefault: boolean;
}

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
