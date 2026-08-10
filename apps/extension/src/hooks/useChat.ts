import { formatDate, generateMessageId } from '@devmentorai/shared';
import type {
  AcpConfigOption,
  AcpContentBlock,
  ContextPayload,
  ImagePayload,
  Message,
  MessageContext,
  StreamEvent,
} from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AcpPermissionDecision, AcpPermissionRequest } from '../services/acp-client';
import { AcpClient, acpEnabled } from '../services/acp-client';
import {
  type AcpChatAction,
  initialAcpChatState,
  reduceAcpChatState,
} from '../services/acp-reducer';
import { ApiClient } from '../services/api-client';

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

export function useChat(sessionId: string | undefined, acpCapabilities?: Record<string, unknown>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<AcpPermissionRequest | null>(null);
  const permissionResolverRef = useRef<((result: AcpPermissionDecision) => void) | null>(null);
  const [acpState, dispatchAcpEvent] = useReducer(
    (state: typeof initialAcpChatState, action: AcpChatAction) => reduceAcpChatState(state, action),
    initialAcpChatState
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageRef = useRef<string>('');
  const currentSessionRef = useRef<string | undefined>(sessionId);

  const apiClient = useMemo(() => ApiClient.getInstance(), []);
  const acpClient = useMemo(
    () =>
      new AcpClient({
        url: 'ws://localhost:3847/acp',
        permissionHandler: async (request) =>
          new Promise((resolve) => {
            setPermissionRequest(request);
            permissionResolverRef.current = resolve;
          }),
      }),
    []
  );

  useEffect(() => {
    if (!acpEnabled()) return;
    const unsubscribe = acpClient.onEvent((eventSessionId, _seq, event) => {
      if (eventSessionId === sessionId) {
        dispatchAcpEvent({ type: 'event', sessionId: eventSessionId, event });
      }
    });
    void acpClient.connect().catch((connectError: unknown) => {
      setError(connectError instanceof Error ? connectError.message : 'ACP connection failed');
    });
    return unsubscribe;
  }, [acpClient, sessionId]);

  const respondToPermission = useCallback((optionId: string) => {
    permissionResolverRef.current?.({ outcome: { outcome: 'selected', optionId } });
    permissionResolverRef.current = null;
    setPermissionRequest(null);
  }, []);

  const revokePermission = useCallback(() => {
    if (!permissionRequest) return;
    const toolCall = permissionRequest.toolCall as {
      kind?: string;
      rawInput?: { tool?: string; name?: string };
    };
    void acpClient.revokePermission(
      permissionRequest.sessionId,
      toolCall.kind ?? toolCall.rawInput?.tool ?? toolCall.rawInput?.name ?? 'unknown-tool'
    );
    permissionResolverRef.current?.({ outcome: { outcome: 'cancelled' } });
    permissionResolverRef.current = null;
    setPermissionRequest(null);
  }, [acpClient, permissionRequest]);

  const dismissPermission = useCallback(() => {
    permissionResolverRef.current?.({ outcome: { outcome: 'cancelled' } });
    permissionResolverRef.current = null;
    setPermissionRequest(null);
  }, []);

  const setAcpConfigOption = useCallback(
    async (option: AcpConfigOption, value: string | boolean) => {
      if (!sessionId) return;
      const options = await acpClient.setConfigOption(sessionId, option.id, value);
      dispatchAcpEvent({
        type: 'event',
        sessionId,
        event: { type: 'config', options: options as AcpConfigOption[] },
      });
    },
    [acpClient, sessionId]
  );

  const loadMessages = useCallback(
    async (sid: string) => {
      try {
        const response = await apiClient.getSessionMessages(sid);
        if (response.success && response.data) {
          setMessages(response.data.items);
        }
      } catch (err) {
        console.error('[useChat] Failed to load messages:', err);
      }
    },
    [apiClient]
  );

  // Track session changes to prevent message mixup (A.4 fix)
  useEffect(() => {
    currentSessionRef.current = sessionId;
    dispatchAcpEvent({ type: 'reset' });
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
      setIsSending(false);
      void loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [loadMessages, sessionId]);

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions | MessageContext) => {
      console.log('[useChat] sendMessage called:', {
        sessionId,
        isStreaming,
        contentLength: content.length,
      });

      if (!sessionId || isStreaming || isSending) {
        console.log('[useChat] Blocked - no sessionId, already streaming, or already sending');
        return;
      }

      const isSendMessageOptions =
        options &&
        ('useContextAwareMode' in options || 'fullContext' in options || 'images' in options);
      const sendOptions: SendMessageOptions = isSendMessageOptions
        ? (options as SendMessageOptions)
        : { context: options as MessageContext };

      if (acpEnabled()) {
        const promptCapabilities = (
          acpCapabilities?.agentCapabilities as Record<string, unknown> | undefined
        )?.promptCapabilities as Record<string, unknown> | undefined;
        if (sendOptions.images && promptCapabilities?.image !== true) {
          setError('This agent does not support image attachments.');
          return;
        }
        setError(null);
        setIsSending(true);
        const optimisticMessage: Message = {
          id: generateMessageId(),
          sessionId,
          role: 'user',
          content,
          timestamp: formatDate(),
        };
        dispatchAcpEvent({ type: 'user_message', message: optimisticMessage });
        try {
          const blocks: AcpContentBlock[] = [{ type: 'text', text: content }];
          if (sendOptions.images && promptCapabilities?.image === true) {
            for (const image of sendOptions.images) {
              const separator = image.dataUrl.indexOf(',');
              blocks.push({
                type: 'image',
                mimeType: image.mimeType,
                data: separator >= 0 ? image.dataUrl.slice(separator + 1) : image.dataUrl,
              });
            }
          }
          if (sendOptions.fullContext) {
            const context = sendOptions.fullContext;
            if (promptCapabilities?.embeddedContext === true) {
              blocks.push({
                type: 'resource',
                resource: {
                  uri: `devmentorai://context/${sessionId}`,
                  mimeType: 'text/plain',
                  text: JSON.stringify(context),
                },
              });
            } else {
              blocks[0] = {
                type: 'text',
                text: `${content}\n\n\`\`\`context\n${JSON.stringify(context, null, 2)}\n\`\`\``,
              };
            }
          }
          dispatchAcpEvent({
            type: 'event',
            sessionId,
            event: {
              type: 'message',
              role: 'user',
              messageId: `user-${Date.now()}`,
              content: [{ type: 'text', text: content }],
              mode: 'replace',
            },
          });
          await acpClient.prompt(sessionId, blocks);
        } catch (sendError) {
          setError(sendError instanceof Error ? sendError.message : 'ACP prompt failed');
        } finally {
          setIsSending(false);
        }
        return;
      }

      // Handle both old (MessageContext) and new (SendMessageOptions) API
      // SendMessageOptions has: useContextAwareMode, fullContext, or images at top level
      // MessageContext is the legacy format with pageUrl, selectedText, action
      console.log('[useChat] Parsed options:', {
        isSendMessageOptions,
        hasImages: !!sendOptions.images?.length,
        hasFullContext: !!sendOptions.fullContext,
        hasContext: !!sendOptions.context,
      });

      // Store the session ID at the start of this request (A.4 fix)
      const requestSessionId = sessionId;

      setError(null);
      setIsSending(true);
      currentMessageRef.current = '';

      // Build images for metadata (convert to ImageAttachment-like format for display)
      // The actual ImagePayload has dataUrl which can be used as thumbnailUrl temporarily
      const imagesForMetadata = sendOptions.images?.map((img) => {
        console.log('[useChat] Processing image for metadata:', {
          id: img.id,
          source: img.source,
          hasDataUrl: !!img.dataUrl,
          dataUrlLength: img.dataUrl?.length || 0,
        });
        return {
          id: img.id,
          source: img.source,
          mimeType: img.mimeType,
          dataUrl: img.dataUrl, // For immediate display before server processes
          thumbnailUrl: img.dataUrl, // Use dataUrl as thumbnail until server provides real one
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
          ...(sendOptions.context
            ? {
                pageUrl: sendOptions.context.pageUrl,
                selectedText: sendOptions.context.selectedText,
                action: sendOptions.context.action,
              }
            : {}),
          ...(imagesForMetadata && imagesForMetadata.length > 0
            ? { images: imagesForMetadata }
            : {}),
        },
      };
      setMessages((prev) => [...prev, userMessage]);
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
      setMessages((prev) => [...prev, assistantMessage]);
      console.log('[useChat] Added empty assistant message placeholder');

      try {
        abortControllerRef.current = new AbortController();

        // ----------------------------------------------------------------
        // Phase 1: Pre-upload images (if any) before sending the chat request
        // This sends each image individually to the backend so the chat
        // request body stays small and avoids payload-too-large crashes.
        // ----------------------------------------------------------------
        let preUploadedImages:
          | Array<{
              id: string;
              thumbnailUrl: string;
              fullImageUrl: string;
              fullImagePath: string;
              mimeType: string;
              dimensions: { width: number; height: number };
              fileSize: number;
            }>
          | undefined;

        if (sendOptions.images && sendOptions.images.length > 0) {
          console.log(`[useChat] Pre-uploading ${sendOptions.images.length} images...`);
          try {
            const uploadResult = await apiClient.uploadImages(
              requestSessionId,
              userMessage.id,
              sendOptions.images.map((img) => ({
                id: img.id,
                dataUrl: img.dataUrl,
                mimeType: img.mimeType,
                source: img.source,
              }))
            );
            if (uploadResult.success && uploadResult.data?.images) {
              preUploadedImages = uploadResult.data.images;
              console.log(`[useChat] Pre-upload complete: ${preUploadedImages.length} images`);
            } else {
              console.error('[useChat] Pre-upload failed:', uploadResult.error);
              throw new Error(uploadResult.error?.message || 'Failed to upload images');
            }
          } catch (uploadErr) {
            console.error('[useChat] Image upload error:', uploadErr);
            const uploadErrMsg =
              uploadErr instanceof Error ? uploadErr.message : 'Failed to upload images';
            setError(uploadErrMsg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      metadata: { ...m.metadata, error: `⚠️ Image upload failed: ${uploadErrMsg}` },
                    }
                  : m
              )
            );
            setIsSending(false);
            setIsStreaming(false);
            abortControllerRef.current = null;
            return;
          }
        }

        // ----------------------------------------------------------------
        // Phase 2: Send the chat request (images are now just references)
        // ----------------------------------------------------------------
        setIsStreaming(true);

        // Build request body with optional full context and pre-uploaded image refs
        const requestBody: {
          prompt: string;
          context?: MessageContext;
          fullContext?: ContextPayload;
          useContextAwareMode?: boolean;
          preUploadedImages?: typeof preUploadedImages;
        } = {
          prompt: content,
          context: sendOptions.context,
        };

        if (sendOptions.fullContext && sendOptions.useContextAwareMode !== false) {
          requestBody.fullContext = sendOptions.fullContext;
          requestBody.useContextAwareMode = true;
          console.log('[useChat] Using context-aware mode with full context');
        }

        // Attach pre-uploaded image references (NOT base64 data)
        if (preUploadedImages && preUploadedImages.length > 0) {
          requestBody.preUploadedImages = preUploadedImages;
          console.log(
            `[useChat] Attaching ${preUploadedImages.length} pre-uploaded image refs to message`
          );
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
                    setMessages((prev) =>
                      prev.map((m) =>
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

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            content: currentMessageRef.current,
                            metadata: { ...m.metadata, streamComplete: true },
                          }
                        : m
                    )
                  );
                  break;

                case 'tool_start':
                  setMessages((prev) =>
                    prev.map((m) =>
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
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            metadata: {
                              ...m.metadata,
                              toolCalls: m.metadata?.toolCalls?.map((tc) =>
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
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              metadata: {
                                ...m.metadata,
                                error: streamError,
                              },
                            }
                          : m
                      )
                    );
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

          console.warn(
            '[useChat] Recoverable session error detected, attempting one resume retry:',
            error
          );
          const resumeResponse = await apiClient.resumeSession(requestSessionId);
          if (!resumeResponse.success) {
            throw error;
          }

          currentMessageRef.current = '';
          setMessages((prev) =>
            prev.map((m) =>
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
          const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
          setError(errorMessage);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      error: errorMessage,
                    },
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setIsSending(false);
        abortControllerRef.current = null;
      }
    },
    [acpCapabilities, acpClient, apiClient, isSending, isStreaming, sessionId]
  );

  const abortMessage = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (sessionId && acpEnabled()) {
      try {
        await acpClient.cancel(sessionId);
      } catch (err) {
        console.error('[useChat] Failed to cancel ACP turn:', err);
      }
    } else if (sessionId) {
      try {
        await apiClient.abortRequest(sessionId);
      } catch (err) {
        console.error('[useChat] Failed to abort on server:', err);
      }
    }

    setIsStreaming(false);
    setIsSending(false);
  }, [acpClient, apiClient, sessionId]);

  return {
    messages: acpEnabled() ? acpState.messages : messages,
    isStreaming: acpEnabled() ? acpState.isStreaming : isStreaming,
    isSending,
    isExtractingContext,
    error,
    sendMessage,
    abortMessage,
    clearError: () => setError(null),
    setIsExtractingContext,
    permissionRequest,
    respondToPermission,
    dismissPermission,
    revokePermission,
    acpState: acpEnabled() ? acpState : undefined,
    setAcpConfigOption,
  };
}
