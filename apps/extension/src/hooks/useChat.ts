import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient } from '../services/api-client';
import { generateMessageId, formatDate } from '@devmentorai/shared';
import type { Message, MessageContext, StreamEvent, ContextPayload, ImagePayload } from '@devmentorai/shared';

export interface SendMessageOptions {
  context?: MessageContext;
  fullContext?: ContextPayload;
  useContextAwareMode?: boolean;
  images?: ImagePayload[];
}

function isLikelySessionRecoveryError(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    'session not found',
    'stream request failed: 404',
    'stream request failed: 410',
    'invalid session',
    'session does not exist',
  ].some((token) => normalized.includes(token));
}

function isRecoverableSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return isLikelySessionRecoveryError(message);
}

export function useChat(sessionId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageRef = useRef<string>('');
  const currentSessionRef = useRef<string | undefined>(sessionId);

  const apiClient = ApiClient.getInstance();

  // Track session changes to prevent message mixup (A.4 fix)
  useEffect(() => {
    currentSessionRef.current = sessionId;
  }, [sessionId]);

  // Load messages when session changes
  useEffect(() => {
    if (sessionId) {
      // Abort any ongoing streaming when switching sessions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const loadMessages = async (sid: string) => {
    try {
      const response = await apiClient.getSessionMessages(sid);
      if (response.success && response.data) {
        setMessages(response.data.items);
      }
    } catch (err) {
      console.error('[useChat] Failed to load messages:', err);
    }
  };

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions | MessageContext) => {
    console.log('[useChat] sendMessage called:', { sessionId, isStreaming, contentLength: content.length });
    
    if (!sessionId || isStreaming) {
      console.log('[useChat] Blocked - no sessionId or already streaming');
      return;
    }

    // Handle both old (MessageContext) and new (SendMessageOptions) API
    // SendMessageOptions has: useContextAwareMode, fullContext, or images at top level
    // MessageContext is the legacy format with pageUrl, selectedText, action
    const isSendMessageOptions = options && (
      'useContextAwareMode' in options || 
      'fullContext' in options || 
      'images' in options
    );
    const sendOptions: SendMessageOptions = isSendMessageOptions
      ? options as SendMessageOptions
      : { context: options as MessageContext };
    
    console.log('[useChat] Parsed options:', { 
      isSendMessageOptions, 
      hasImages: !!sendOptions.images?.length,
      hasFullContext: !!sendOptions.fullContext,
      hasContext: !!sendOptions.context
    });

    // Store the session ID at the start of this request (A.4 fix)
    const requestSessionId = sessionId;

    setError(null);
    setIsStreaming(true);
    currentMessageRef.current = '';

    // Build images for metadata (convert to ImageAttachment-like format for display)
    // The actual ImagePayload has dataUrl which can be used as thumbnailUrl temporarily
    const imagesForMetadata = sendOptions.images?.map(img => {
      console.log('[useChat] Processing image for metadata:', { 
        id: img.id, 
        source: img.source, 
        hasDataUrl: !!img.dataUrl,
        dataUrlLength: img.dataUrl?.length || 0
      });
      return {
        id: img.id,
        source: img.source,
        mimeType: img.mimeType,
        dataUrl: img.dataUrl,  // For immediate display before server processes
        thumbnailUrl: img.dataUrl,  // Use dataUrl as thumbnail until server provides real one
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
        timestamp: formatDate(),
      };
    });

    // Add user message immediately (with images if any)
    const userMessage: Message = {
      id: generateMessageId(),
      sessionId: requestSessionId,
      role: 'user',
      content,
      timestamp: formatDate(),
      metadata: {
        ...(sendOptions.context ? {
          pageUrl: sendOptions.context.pageUrl,
          selectedText: sendOptions.context.selectedText,
          action: sendOptions.context.action,
        } : {}),
        ...(imagesForMetadata && imagesForMetadata.length > 0 ? { images: imagesForMetadata } : {}),
      },
    };
    setMessages(prev => [...prev, userMessage]);
    console.log('[useChat] Added user message to UI', { hasImages: !!imagesForMetadata?.length });

    // Create placeholder for assistant message
    const assistantMessageId = generateMessageId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      sessionId: requestSessionId,
      role: 'assistant',
      content: '',
      timestamp: formatDate(),
      metadata: sendOptions.useContextAwareMode ? { contextAware: true } : undefined,
    };
    setMessages(prev => [...prev, assistantMessage]);
    console.log('[useChat] Added empty assistant message placeholder');

    try {
      abortControllerRef.current = new AbortController();

      // Build request body with optional full context and images
      const requestBody: {
        prompt: string;
        context?: MessageContext;
        fullContext?: ContextPayload;
        useContextAwareMode?: boolean;
        images?: ImagePayload[];
      } = {
        prompt: content,
        context: sendOptions.context,
      };

      if (sendOptions.fullContext && sendOptions.useContextAwareMode !== false) {
        requestBody.fullContext = sendOptions.fullContext;
        requestBody.useContextAwareMode = true;
        console.log('[useChat] Using context-aware mode with full context');
      }

      // Add images if provided
      if (sendOptions.images && sendOptions.images.length > 0) {
        requestBody.images = sendOptions.images;
        console.log(`[useChat] Attaching ${sendOptions.images.length} images to message`);
      }

      const streamOnce = async () => {
        let deferredSessionError: string | null = null;

        console.log('[useChat] Starting streamChat...');
        await apiClient.streamChat(
          requestSessionId,
          requestBody,
          (event: StreamEvent) => {
            console.log('[useChat] Received SSE event:', event.type);
            
            // A.4 fix: Only update if we're still on the same session
            if (currentSessionRef.current !== requestSessionId) {
              return;
            }

            switch (event.type) {
              case 'message_delta':
                if (event.data.deltaContent) {
                  currentMessageRef.current += event.data.deltaContent;
                  setMessages(prev => 
                    prev.map(m => 
                      m.id === assistantMessageId 
                        ? { ...m, content: currentMessageRef.current }
                        : m
                    )
                  );
                }
                break;

              case 'message_complete':
                // Update content if provided (for cases where no deltas were sent)
                if (event.data.content) {
                  currentMessageRef.current = event.data.content;
                }
                
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { 
                          ...m, 
                          content: currentMessageRef.current,
                          metadata: { ...m.metadata, streamComplete: true } 
                        }
                      : m
                  )
                );
                break;

              case 'tool_start':
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          metadata: {
                            ...m.metadata,
                            toolCalls: [
                              ...(m.metadata?.toolCalls || []),
                              {
                                toolName: event.data.toolName || '',
                                toolCallId: event.data.toolCallId || '',
                                status: 'running' as const,
                              },
                            ],
                          },
                        }
                      : m
                  )
                );
                break;

              case 'tool_complete':
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          metadata: {
                            ...m.metadata,
                            toolCalls: m.metadata?.toolCalls?.map(tc =>
                              tc.toolCallId === event.data.toolCallId
                                ? { ...tc, status: 'completed' as const }
                                : tc
                            ),
                          },
                        }
                      : m
                  )
                );
                break;

              case 'error': {
                const streamError = event.data.error || 'An error occurred';
                if (isLikelySessionRecoveryError(streamError)) {
                  deferredSessionError = streamError;
                } else {
                  setError(streamError);
                }
                break;
              }

              case 'done':
                setIsStreaming(false);
                break;
            }
          },
          abortControllerRef.current?.signal
        );

        if (deferredSessionError) {
          throw new Error(deferredSessionError);
        }
      };

      try {
        await streamOnce();
      } catch (error) {
        if (!isRecoverableSessionError(error)) {
          throw error;
        }

        console.warn('[useChat] Recoverable session error detected, attempting one resume retry:', error);
        const resumeResponse = await apiClient.resumeSession(requestSessionId);
        if (!resumeResponse.success) {
          throw error;
        }

        currentMessageRef.current = '';
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: '',
                  metadata: sendOptions.useContextAwareMode ? { contextAware: true } : undefined,
                }
              : m
          )
        );

        await streamOnce();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useChat] Request aborted');
      } else {
        console.error('[useChat] Failed to send message:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [sessionId, isStreaming]);

  const abortMessage = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (sessionId) {
      try {
        await apiClient.abortRequest(sessionId);
      } catch (err) {
        console.error('[useChat] Failed to abort on server:', err);
      }
    }
    
    setIsStreaming(false);
  }, [sessionId]);

  return {
    messages,
    isStreaming,
    isExtractingContext,
    error,
    sendMessage,
    abortMessage,
    clearError: () => setError(null),
    setIsExtractingContext,
  };
}
