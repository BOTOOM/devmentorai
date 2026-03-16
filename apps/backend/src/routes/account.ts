import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  ApiResponse,
  ProviderAuthStatus,
  ProviderCredentialStatus,
  ProviderQuotaStatus,
  SetProviderCredentialRequest,
} from '@devmentorai/shared';

const credentialProviderSchema = z.enum(['openrouter', 'groq']);
const credentialBodySchema = z.object({
  provider: credentialProviderSchema.optional(),
  apiKey: z.string().min(1),
});

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

  fastify.get<{
    Params: { provider: string };
    Reply: ApiResponse<ProviderCredentialStatus>;
  }>('/account/credentials/:provider', async (request, reply) => {
    const provider = credentialProviderSchema.parse(request.params.provider);
    const status = fastify.providerCredentialService.getCredentialStatus(provider);

    return reply.send({
      success: true,
      data: status,
    });
  });

  fastify.put<{
    Params: { provider: string };
    Body: SetProviderCredentialRequest;
    Reply: ApiResponse<ProviderCredentialStatus>;
  }>('/account/credentials/:provider', async (request, reply) => {
    const provider = credentialProviderSchema.parse(request.params.provider);
    const body = credentialBodySchema.parse(request.body);
    const status = fastify.providerCredentialService.setCredential(provider, body.apiKey);
    await fastify.llmProviderService.reinitializeProvider(provider);

    return reply.send({
      success: true,
      data: status,
    });
  });

  fastify.delete<{
    Params: { provider: string };
    Reply: ApiResponse<ProviderCredentialStatus>;
  }>('/account/credentials/:provider', async (request, reply) => {
    const provider = credentialProviderSchema.parse(request.params.provider);
    const status = fastify.providerCredentialService.deleteCredential(provider);
    await fastify.llmProviderService.reinitializeProvider(provider);

    return reply.send({
      success: true,
      data: status,
    });
  });
}
