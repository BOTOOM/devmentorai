import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SessionEvent } from '@github/copilot-sdk';
import type {
  ApiResponse,
  Message,
  SendMessageRequest,
  StreamEvent,
} from '@devmentorai/shared';

const sendMessageSchema = z.object({
  prompt: z.string().min(1),
  context: z.object({
    pageUrl: z.string().optional(),
    pageTitle: z.string().optional(),
    selectedText: z.string().optional(),
    action: z.enum([
      'explain',
      'translate',
      'rewrite',
      'fix_grammar',
      'summarize',
      'expand',
      'analyze_config',
      'diagnose_error',
    ]).optional(),
  }).optional(),
});

export async function chatRoutes(fastify: FastifyInstance) {
  // Send message (non-streaming)
  fastify.post<{
    Params: { id: string };
    Body: SendMessageRequest;
    Reply: ApiResponse<Message>;
  }>('/sessions/:id/chat', async (request, reply) => {
    try {
      const body = sendMessageSchema.parse(request.body);
      const sessionId = request.params.id;

      const session = fastify.sessionService.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        });
      }

      // Save user message
      fastify.sessionService.addMessage(
        sessionId,
        'user',
        body.prompt,
        body.context ? {
          pageUrl: body.context.pageUrl,
          selectedText: body.context.selectedText,
          action: body.context.action,
        } : undefined
      );

      // Get response from Copilot
      const response = await fastify.copilotService.sendMessage(
        sessionId,
        body.prompt,
        body.context
      );

      // Save assistant message
      const assistantMessage = fastify.sessionService.addMessage(
        sessionId,
        'assistant',
        response
      );

      return reply.send({
        success: true,
        data: assistantMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: { errors: error.errors },
          },
        });
      }
      throw error;
    }
  });

  // Send message (streaming via SSE)
  fastify.post<{
    Params: { id: string };
    Body: SendMessageRequest;
  }>('/sessions/:id/chat/stream', async (request, reply) => {
    try {
      const body = sendMessageSchema.parse(request.body);
      const sessionId = request.params.id;

      const session = fastify.sessionService.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        });
      }

      // Save user message
      fastify.sessionService.addMessage(
        sessionId,
        'user',
        body.prompt,
        body.context ? {
          pageUrl: body.context.pageUrl,
          selectedText: body.context.selectedText,
          action: body.context.action,
        } : undefined
      );

      // Set up SSE
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      let fullContent = '';
      let assistantMessageId: string | null = null;

      const sendSSE = (event: StreamEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Handle Copilot events
      const handleEvent = (event: SessionEvent) => {
        switch (event.type) {
          case 'assistant.message_delta':
            fullContent += event.data.deltaContent || '';
            sendSSE({
              type: 'message_delta',
              data: { deltaContent: event.data.deltaContent },
            });
            break;

          case 'assistant.message':
            fullContent = event.data.content || fullContent;
            sendSSE({
              type: 'message_complete',
              data: { content: fullContent },
            });
            break;

          case 'tool.execution_start':
            sendSSE({
              type: 'tool_start',
              data: {
                toolName: (event.data as any).toolName,
                toolCallId: (event.data as any).toolCallId,
              },
            });
            break;

          case 'tool.execution_complete':
            sendSSE({
              type: 'tool_complete',
              data: { toolCallId: (event.data as any).toolCallId },
            });
            break;

          case 'session.idle':
            // Save the complete assistant message
            if (fullContent && !assistantMessageId) {
              const message = fastify.sessionService.addMessage(
                sessionId,
                'assistant',
                fullContent
              );
              assistantMessageId = message.id;
            }

            sendSSE({ type: 'done', data: { messageId: assistantMessageId || undefined } });
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
            break;
        }
      };

      // Start streaming
      await fastify.copilotService.streamMessage(
        sessionId,
        body.prompt,
        body.context,
        handleEvent
      );

      // Handle client disconnect
      request.raw.on('close', async () => {
        if (!reply.raw.writableEnded) {
          await fastify.copilotService.abortRequest(sessionId);
          reply.raw.end();
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        });
      }
      
      // Send error via SSE
      const errorEvent: StreamEvent = {
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
      reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  });
}
