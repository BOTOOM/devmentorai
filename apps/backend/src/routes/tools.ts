/**
 * Tools API Routes
 * 
 * Exposes custom DevOps tools for direct execution
 * and provides tool metadata for the extension.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionType } from '@devmentorai/shared';

interface ToolExecuteBody {
  toolName: string;
  params: Record<string, unknown>;
  provider?: string;
}

export function registerToolsRoutes(app: FastifyInstance): void {
  
  // List available tools
  app.get('/api/tools', async (
    request: FastifyRequest<{ Querystring: { type?: SessionType; provider?: string } }>,
    reply: FastifyReply
  ) => {
    const sessionType = request.query.type || 'devops';
    const tools = app.llmProviderService.listAvailableTools(sessionType, request.query.provider);
    
    return reply.send({
      success: true,
      data: tools,
    });
  });
  
  // Execute a tool directly
  app.post('/api/tools/execute', async (
    request: FastifyRequest<{ Body: ToolExecuteBody }>,
    reply: FastifyReply
  ) => {
    const { toolName, params } = request.body;
    const provider = request.body.provider;
    
    if (!toolName) {
      return reply.status(400).send({
        success: false,
        error: 'toolName is required',
      });
    }
    
    const result = await app.llmProviderService.executeTool(toolName, params || {}, provider);
    
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }
    
    return reply.send({
      success: true,
      data: {
        toolName,
        result: result.result,
      },
    });
  });
  
  // Analyze config endpoint (convenience wrapper)
  app.post('/api/tools/analyze-config', async (
    request: FastifyRequest<{ Body: { content: string; type?: string; provider?: string } }>,
    reply: FastifyReply
  ) => {
    const { content, type, provider } = request.body;
    
    if (!content) {
      return reply.status(400).send({
        success: false,
        error: 'content is required',
      });
    }
    
    const result = await app.llmProviderService.executeTool('analyze_config', {
      content,
      type: type || 'auto',
    }, provider);
    
    return reply.send({
      success: result.success,
      data: result.result,
      error: result.error,
    });
  });
  
  // Analyze error endpoint (convenience wrapper)
  app.post('/api/tools/analyze-error', async (
    request: FastifyRequest<{ Body: { error: string; context?: string; provider?: string } }>,
    reply: FastifyReply
  ) => {
    const { error, context, provider } = request.body;
    
    if (!error) {
      return reply.status(400).send({
        success: false,
        error: 'error is required',
      });
    }
    
    const result = await app.llmProviderService.executeTool('analyze_error', {
      error,
      context: context || 'general',
    }, provider);
    
    return reply.send({
      success: result.success,
      data: result.result,
      error: result.error,
    });
  });
}
