import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SessionEvent } from '@github/copilot-sdk';
import type {
  ApiResponse,
  Message,
  SendMessageRequest,
  StreamEvent,
  ContextPayload,
  ImagePayload,
  ImageAttachment,
} from '@devmentorai/shared';
import {
  buildContextAwarePrompt,
  buildSimplePrompt,
  validateContext,
  sanitizeContext,
} from '../services/context-prompt-builder.js';
import {
  processMessageImages,
  toImageAttachments,
} from '../services/thumbnail-service.js';

// Schema for simple context (backward compatible)
const simpleContextSchema = z.object({
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
});

// Schema for full context payload
const fullContextSchema = z.object({
  metadata: z.object({
    captureTimestamp: z.string(),
    captureMode: z.enum(['auto', 'manual']),
    browserInfo: z.object({
      userAgent: z.string(),
      viewport: z.object({ width: z.number(), height: z.number() }),
      language: z.string(),
    }),
  }),
  page: z.object({
    url: z.string(),
    urlParsed: z.object({
      protocol: z.string(),
      hostname: z.string(),
      pathname: z.string(),
      search: z.string(),
      hash: z.string(),
    }),
    title: z.string(),
    platform: z.object({
      type: z.string(),
      confidence: z.number(),
      indicators: z.array(z.string()),
      specificProduct: z.string().optional(),
    }),
  }),
  text: z.object({
    selectedText: z.string().optional(),
    visibleText: z.string(),
    headings: z.array(z.object({
      level: z.number(),
      text: z.string(),
    })),
    errors: z.array(z.object({
      type: z.enum(['error', 'warning', 'info']),
      message: z.string(),
      source: z.enum(['console', 'ui', 'network', 'dom']).optional(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      context: z.string().optional(),
    })),
    metadata: z.object({
      totalLength: z.number(),
      truncated: z.boolean(),
    }),
  }),
  structure: z.object({
    relevantSections: z.array(z.any()),
    errorContainers: z.array(z.any()),
    activeElements: z.any(),
    metadata: z.any(),
  }),
  session: z.object({
    sessionId: z.string(),
    sessionType: z.string(),
    intent: z.object({
      primary: z.string(),
      keywords: z.array(z.string()),
      implicitSignals: z.array(z.string()),
      explicitGoal: z.string().optional(),
    }),
    previousMessages: z.object({
      count: z.number(),
      lastN: z.array(z.any()),
    }),
  }),
  privacy: z.object({
    redactedFields: z.array(z.string()),
    sensitiveDataDetected: z.boolean(),
    consentGiven: z.boolean(),
    dataRetention: z.enum(['session', 'none']),
  }),
}).passthrough();

// Schema for image payload
const imagePayloadSchema = z.object({
  id: z.string(),
  dataUrl: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  source: z.enum(['screenshot', 'paste', 'drop']),
});

const sendMessageSchema = z.object({
  prompt: z.string().min(1),
  context: simpleContextSchema.optional(),
  fullContext: fullContextSchema.optional(),
  useContextAwareMode: z.boolean().optional(),
  images: z.array(imagePayloadSchema).max(5).optional(),
});

export async function chatRoutes(fastify: FastifyInstance) {
  // Helper to build the appropriate prompt based on context type
  // Returns userPrompt (enriched with context) and promptType
  // systemPrompt is always null - we don't override Copilot's default
  const buildPrompt = (
    body: { prompt: string; context?: any; fullContext?: any; useContextAwareMode?: boolean }
  ): { userPrompt: string; promptType: string } => {
    // If full context is provided and context-aware mode is enabled
    if (body.fullContext && body.useContextAwareMode !== false) {
      if (validateContext(body.fullContext)) {
        const sanitizedContext = sanitizeContext(body.fullContext as ContextPayload);
        const { userPrompt } = buildContextAwarePrompt(sanitizedContext, body.prompt);
        return { userPrompt, promptType: 'context-aware' };
      }
    }
    
    // Fall back to simple prompt
    const { userPrompt } = buildSimplePrompt(
      body.prompt,
      body.context?.pageUrl,
      body.context?.pageTitle,
      body.context?.selectedText
    );
    return { userPrompt, promptType: 'simple' };
  };

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

      // Build the prompt (enriched with context, no system prompt override)
      const { userPrompt, promptType } = buildPrompt(body);
      console.log(`[ChatRoute] Using ${promptType} prompt`);

      // Save user message
      const userMessage = fastify.sessionService.addMessage(
        sessionId,
        'user',
        body.prompt,
        body.context ? {
          pageUrl: body.context.pageUrl,
          selectedText: body.context.selectedText,
          action: body.context.action,
        } : undefined
      );

      // Persist context if fullContext is provided (Phase 5)
      if (body.fullContext) {
        try {
          fastify.sessionService.saveContext(
            sessionId,
            JSON.stringify(body.fullContext),
            userMessage.id,
            body.fullContext.page?.url,
            body.fullContext.page?.title,
            body.fullContext.page?.platform?.type
          );
          console.log(`[ChatRoute] Context saved for message ${userMessage.id}`);
        } catch (err) {
          console.error('[ChatRoute] Failed to persist context:', err);
        }
      }

      // Get response from Copilot (no system prompt - uses customAgents from session)
      const response = await fastify.copilotService.sendMessage(
        sessionId,
        userPrompt,
        body.context
        // NOT passing systemPrompt - preserves Copilot's intelligence
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

      // Build the prompt (enriched with context, no system prompt override)
      const { userPrompt, promptType } = buildPrompt(body);
      console.log(`[ChatRoute] Using ${promptType} prompt for streaming`);

      // Process images if provided
      let processedImages: ImageAttachment[] = [];
      const backendUrl = `http://${request.hostname}`;
      
      // We'll need the message ID before processing images
      // First save the user message without images
      const userMessage = fastify.sessionService.addMessage(
        sessionId,
        'user',
        body.prompt,
        body.context ? {
          pageUrl: body.context.pageUrl,
          selectedText: body.context.selectedText,
          action: body.context.action,
          contextAware: body.useContextAwareMode,
        } : { contextAware: body.useContextAwareMode }
      );

      // Process images after we have the message ID
      if (body.images && body.images.length > 0) {
        try {
          console.log(`[ChatRoute] Processing ${body.images.length} images for message ${userMessage.id}`);
          const processed = await processMessageImages(
            sessionId,
            userMessage.id,
            body.images,
            backendUrl
          );
          processedImages = toImageAttachments(processed);
          
          // Update message metadata with images
          fastify.sessionService.updateMessageMetadata(userMessage.id, {
            ...userMessage.metadata,
            images: processedImages,
          });
          
          console.log(`[ChatRoute] Processed ${processedImages.length} images successfully`);
        } catch (err) {
          console.error('[ChatRoute] Failed to process images:', err);
          // Continue without images - don't fail the message
        }
      }

      // Persist context if fullContext is provided (Phase 5)
      if (body.fullContext) {
        try {
          fastify.sessionService.saveContext(
            sessionId,
            JSON.stringify(body.fullContext),
            userMessage.id,
            body.fullContext.page?.url,
            body.fullContext.page?.title,
            body.fullContext.page?.platform?.type
          );
          console.log(`[ChatRoute] Context saved for message ${userMessage.id}`);
        } catch (err) {
          console.error('[ChatRoute] Failed to persist context:', err);
        }
      }

      // Set up SSE
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      let fullContent = '';
      let assistantMessageId: string | null = null;
      let streamEnded = false;
      let lastActivityTime = Date.now();

      // Global timeout for the entire streaming operation (2 minutes)
      const STREAM_TIMEOUT_MS = 120000;
      // Idle timeout - if no events received for this duration, consider it stuck
      const IDLE_TIMEOUT_MS = 30000;

      const sendSSE = (event: StreamEvent) => {
        if (!streamEnded) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          lastActivityTime = Date.now();
        }
      };

      const endStream = (reason: string = 'completed') => {
        if (streamEnded) return;
        streamEnded = true;
        
        console.log(`[ChatRoute] Stream ending: ${reason}. Content length: ${fullContent.length}`);
        
        // Save message if we have content
        if (fullContent && !assistantMessageId) {
          const message = fastify.sessionService.addMessage(
            sessionId,
            'assistant',
            fullContent
          );
          assistantMessageId = message.id;
        }

        sendSSE({ type: 'done', data: { messageId: assistantMessageId || undefined, reason } });
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      };

      // Create a Promise that resolves when streaming is complete
      const streamComplete = new Promise<void>((resolve) => {
        // Set up global timeout
        const globalTimeout = setTimeout(() => {
          console.warn('[ChatRoute] Global stream timeout reached');
          endStream('timeout');
          fastify.copilotService.abortRequest(sessionId).catch(() => {});
          resolve();
        }, STREAM_TIMEOUT_MS);

        // Set up idle timeout check
        const idleCheckInterval = setInterval(() => {
          const idleTime = Date.now() - lastActivityTime;
          if (idleTime > IDLE_TIMEOUT_MS && !streamEnded) {
            console.warn(`[ChatRoute] Stream idle for ${idleTime}ms, ending`);
            endStream('idle_timeout');
            fastify.copilotService.abortRequest(sessionId).catch(() => {});
            resolve();
          }
        }, 5000);

        // Handle Copilot events
        const handleEvent = (event: SessionEvent) => {
          if (streamEnded) return;
          
          console.log('[ChatRoute] Received event:', event.type);
          lastActivityTime = Date.now();
          
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
              clearTimeout(globalTimeout);
              clearInterval(idleCheckInterval);
              endStream('completed');
              resolve();
              break;
          }
        };

        // Start streaming (no system prompt - uses customAgents from session)
        fastify.copilotService.streamMessage(
          sessionId,
          userPrompt,
          body.context,
          handleEvent
        );
      });

      // Handle client disconnect
      request.raw.on('close', async () => {
        if (!streamEnded) {
          console.log('[ChatRoute] Client disconnected, aborting');
          streamEnded = true;
          await fastify.copilotService.abortRequest(sessionId);
          reply.raw.end();
        }
      });

      // Wait for streaming to complete before allowing Fastify to close the connection
      await streamComplete;

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

  // Get session context history (Phase 5)
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: number };
  }>('/sessions/:id/context', async (request, reply) => {
    const sessionId = request.params.id;
    const limit = request.query.limit || 10;

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

    const latestContext = fastify.sessionService.getLatestContext(sessionId);
    const contextHistory = fastify.sessionService.getContextHistory(sessionId, limit);
    const contextCount = fastify.sessionService.getContextCount(sessionId);

    return reply.send({
      success: true,
      data: {
        latest: latestContext,
        history: contextHistory,
        totalCount: contextCount,
      },
    });
  });

  // Get specific context by ID (Phase 5)
  fastify.get<{
    Params: { id: string; contextId: string };
  }>('/sessions/:id/context/:contextId', async (request, reply) => {
    const { id: sessionId, contextId } = request.params;

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

    const context = fastify.sessionService.getContext(contextId);
    if (!context || context.sessionId !== sessionId) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Context not found',
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        ...context,
        contextData: JSON.parse(context.contextJson),
      },
    });
  });

  // Cleanup old contexts for a session (Phase 5)
  fastify.post<{
    Params: { id: string };
    Body: { keepCount?: number };
  }>('/sessions/:id/context/cleanup', async (request, reply) => {
    const sessionId = request.params.id;
    const keepCount = request.body?.keepCount || 20;

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

    const deletedCount = fastify.sessionService.cleanupOldContexts(sessionId, keepCount);

    return reply.send({
      success: true,
      data: {
        deletedCount,
        remainingCount: fastify.sessionService.getContextCount(sessionId),
      },
    });
  });
}
