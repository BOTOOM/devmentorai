import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SessionEvent } from '@github/copilot-sdk';
import type {
  ApiResponse,
  Message,
  SendMessageRequest,
  StreamEvent,
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
  type ProcessedImage,
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

// Schema for image payload (inline data URL - legacy / small images)
const imagePayloadSchema = z.object({
  id: z.string(),
  dataUrl: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  source: z.enum(['screenshot', 'paste', 'drop']),
});

// Schema for pre-uploaded image reference (from /api/images/upload endpoint)
const preUploadedImageSchema = z.object({
  id: z.string(),
  fullImagePath: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  thumbnailUrl: z.string().optional(),
  fullImageUrl: z.string().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  fileSize: z.number().optional(),
});

const sendMessageSchema = z.object({
  prompt: z.string().min(1),
  context: simpleContextSchema.optional(),
  fullContext: fullContextSchema.optional(),
  useContextAwareMode: z.boolean().optional(),
  images: z.array(imagePayloadSchema).max(5).optional(),
  /** Pre-uploaded image references (already processed on disk) */
  preUploadedImages: z.array(preUploadedImageSchema).max(5).optional(),
});

type ParsedSendMessageBody = z.infer<typeof sendMessageSchema>;
type ProviderAttachment = { type: 'file'; path: string; displayName: string };

export async function chatRoutes(fastify: FastifyInstance) {
  const STREAM_TIMEOUT_MS = 120000;
  const IDLE_TIMEOUT_MS = 30000;

  const setSseHeaders = (reply: FastifyReply): void => {
    if (reply.raw.headersSent) {
      return;
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  };

  const buildUserMessageMetadata = (body: ParsedSendMessageBody): Message['metadata'] => {
    if (body.context) {
      return {
        pageUrl: body.context.pageUrl,
        selectedText: body.context.selectedText,
        action: body.context.action,
        contextAware: body.useContextAwareMode,
      };
    }

    return { contextAware: body.useContextAwareMode };
  };

  const persistFullContext = (
    sessionId: string,
    messageId: string,
    fullContext: ParsedSendMessageBody['fullContext']
  ): void => {
    if (!fullContext) {
      return;
    }

    try {
      fastify.sessionService.saveContext(
        sessionId,
        JSON.stringify(fullContext),
        messageId,
        fullContext.page?.url,
        fullContext.page?.title,
        fullContext.page?.platform?.type
      );
      console.log(`[ChatRoute] Context saved for message ${messageId}`);
    } catch (contextError) {
      console.error('[ChatRoute] Failed to persist context:', contextError);
    }
  };

  const prepareProviderAttachments = async (
    sessionId: string,
    userMessage: Message,
    body: ParsedSendMessageBody,
    backendUrl: string
  ): Promise<ProviderAttachment[]> => {
    if (body.preUploadedImages && body.preUploadedImages.length > 0) {
      console.log(`[ChatRoute] Using ${body.preUploadedImages.length} pre-uploaded images`);

      const providerAttachments = body.preUploadedImages.map((img, index) => ({
        type: 'file' as const,
        path: img.fullImagePath,
        displayName: `image_${index + 1}.${img.mimeType.split('/')[1] ?? 'jpg'}`,
      }));

      const processedImages: ImageAttachment[] = body.preUploadedImages.map((img) => ({
        id: img.id,
        source: 'screenshot' as const,
        mimeType: img.mimeType,
        dimensions: img.dimensions || { width: 0, height: 0 },
        fileSize: img.fileSize || 0,
        timestamp: new Date().toISOString(),
        thumbnailUrl: img.thumbnailUrl,
        fullImageUrl: img.fullImageUrl,
      }));

      fastify.sessionService.updateMessageMetadata(userMessage.id, {
        ...userMessage.metadata,
        images: processedImages,
      });

      return providerAttachments;
    }

    if (body.images && body.images.length > 0) {
      try {
        console.log(`[ChatRoute] Processing ${body.images.length} inline images for message ${userMessage.id}`);
        const processedImagesRaw: ProcessedImage[] = await processMessageImages(
          sessionId,
          userMessage.id,
          body.images,
          backendUrl
        );

        const processedImages = toImageAttachments(processedImagesRaw);
        fastify.sessionService.updateMessageMetadata(userMessage.id, {
          ...userMessage.metadata,
          images: processedImages,
        });

        console.log(`[ChatRoute] Processed ${processedImages.length} images successfully`);
        return processedImagesRaw.map((img, index) => ({
          type: 'file' as const,
          path: img.fullImagePath,
          displayName: `image_${index + 1}.${img.mimeType.split('/')[1] ?? 'jpg'}`,
        }));
      } catch (imageError) {
        console.error('[ChatRoute] Failed to process images:', imageError);
      }
    }

    return [];
  };

  const streamSessionResponse = async (
    request: FastifyRequest,
    reply: FastifyReply,
    sessionId: string,
    provider: string,
    userPrompt: string,
    context: ParsedSendMessageBody['context'],
    providerAttachments: ProviderAttachment[]
  ): Promise<void> => {
    setSseHeaders(reply);

    let fullContent = '';
    let assistantMessageId: string | null = null;
    let streamEnded = false;
    let lastActivityTime = Date.now();
    let globalTimeout: ReturnType<typeof setTimeout> | undefined;
    let idleCheckInterval: ReturnType<typeof setInterval> | undefined;

    const cleanupTimers = () => {
      if (globalTimeout) clearTimeout(globalTimeout);
      if (idleCheckInterval) clearInterval(idleCheckInterval);
    };

    const sendSse = (event: StreamEvent, force = false) => {
      if (streamEnded && !force) {
        return;
      }

      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      lastActivityTime = Date.now();
    };

    const endStream = (reason: string = 'completed') => {
      if (streamEnded) {
        return;
      }
      streamEnded = true;

      console.log(`[ChatRoute] Stream ending: ${reason}. Content length: ${fullContent.length}`);

      if (fullContent && !assistantMessageId) {
        const message = fastify.sessionService.addMessage(sessionId, 'assistant', fullContent);
        assistantMessageId = message.id;
      }

      sendSse({ type: 'done', data: { messageId: assistantMessageId || undefined, reason } }, true);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    };

    const abortProviderRequest = () => {
      fastify.llmProviderService.abortRequest(sessionId, provider).catch((abortError) => {
        console.warn('[ChatRoute] Failed to abort provider request:', abortError);
      });
    };

    let resolveStreamComplete: (() => void) | null = null;
    let streamCompleteResolved = false;
    const resolveStreamCompleteOnce = () => {
      if (streamCompleteResolved) {
        return;
      }

      streamCompleteResolved = true;
      resolveStreamComplete?.();
    };

    const streamComplete = new Promise<void>((resolve) => {
      resolveStreamComplete = resolve;

      const finish = (reason: string, abortProvider = false) => {
        cleanupTimers();
        endStream(reason);
        if (abortProvider) {
          abortProviderRequest();
        }
        resolveStreamCompleteOnce();
      };

      const handleEvent = (event: SessionEvent) => {
        if (streamEnded) {
          return;
        }

        console.log('[ChatRoute] Received event:', event.type);
        lastActivityTime = Date.now();

        switch (event.type) {
          case 'assistant.message_delta':
            fullContent += event.data.deltaContent || '';
            sendSse({
              type: 'message_delta',
              data: { deltaContent: event.data.deltaContent },
            });
            break;

          case 'assistant.message':
            fullContent = event.data.content || fullContent;
            sendSse({
              type: 'message_complete',
              data: { content: fullContent },
            });
            break;

          case 'tool.execution_start':
            sendSse({
              type: 'tool_start',
              data: {
                toolName: (event.data as any).toolName,
                toolCallId: (event.data as any).toolCallId,
              },
            });
            break;

          case 'tool.execution_complete':
            sendSse({
              type: 'tool_complete',
              data: { toolCallId: (event.data as any).toolCallId },
            });
            break;

          case 'session.idle':
            finish('completed');
            break;
        }
      };

      globalTimeout = setTimeout(() => {
        console.warn('[ChatRoute] Global stream timeout reached');
        finish('timeout', true);
      }, STREAM_TIMEOUT_MS);

      idleCheckInterval = setInterval(() => {
        const idleTime = Date.now() - lastActivityTime;
        if (idleTime > IDLE_TIMEOUT_MS && !streamEnded) {
          console.warn(`[ChatRoute] Stream idle for ${idleTime}ms, ending`);
          finish('idle_timeout', true);
        }
      }, 5000);

      fastify.llmProviderService
        .streamMessage(
          sessionId,
          provider,
          userPrompt,
          context,
          handleEvent,
          providerAttachments.length > 0 ? providerAttachments : undefined
        )
        .catch((streamError) => {
          console.error(`[ChatRoute] Failed to start stream for provider ${provider}:`, streamError);
          setSseHeaders(reply);
          sendSse({
            type: 'error',
            data: {
              error: streamError instanceof Error ? streamError.message : 'Failed to start stream',
            },
          });
          finish('provider_error');
        });
    });

    request.raw.on('close', () => {
      if (streamEnded) {
        return;
      }

      console.log('[ChatRoute] Client disconnected, aborting');
      streamEnded = true;
      cleanupTimers();
      abortProviderRequest();
      resolveStreamCompleteOnce();
      reply.raw.end();
    });

    await streamComplete;
  };

  // Helper to build the appropriate prompt based on context type
  // Returns userPrompt (enriched with context) and promptType
  // systemPrompt is always null - we don't override Copilot's default
  const buildPrompt = (
    body: { prompt: string; context?: any; fullContext?: any; useContextAwareMode?: boolean }
  ): { userPrompt: string; promptType: string } => {
    // If full context is provided and context-aware mode is enabled
    if (body.fullContext && body.useContextAwareMode !== false) {
      if (validateContext(body.fullContext)) {
        const sanitizedContext = sanitizeContext(body.fullContext);
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

      // Get response from active provider (no system prompt override)
      const response = await fastify.llmProviderService.sendMessage(
        sessionId,
        session.provider,
        userPrompt,
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

      // Build the prompt (enriched with context, no system prompt override)
      const { userPrompt, promptType } = buildPrompt(body);
      console.log(`[ChatRoute] Using ${promptType} prompt for streaming`);

      // Build backend URL with port for image serving
      const host = request.headers.host || `${request.hostname}:3847`;
      const backendUrl = `http://${host}`;
      
      // We'll need the message ID before processing images
      // First save the user message without images
      const userMessage = fastify.sessionService.addMessage(
        sessionId,
        'user',
        body.prompt,
        buildUserMessageMetadata(body)
      );

      const providerAttachments = await prepareProviderAttachments(
        sessionId,
        userMessage,
        body,
        backendUrl
      );
      
      if (providerAttachments.length > 0) {
        console.log(
          `[ChatRoute] Built ${providerAttachments.length} attachments for provider ${session.provider}:`,
          providerAttachments
        );
      }

      persistFullContext(sessionId, userMessage.id, body.fullContext);

      await streamSessionResponse(
        request,
        reply,
        sessionId,
        session.provider,
        userPrompt,
        body.context,
        providerAttachments
      );

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
      setSseHeaders(reply);
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
