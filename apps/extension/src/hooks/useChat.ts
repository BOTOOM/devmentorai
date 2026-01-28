import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient } from '../services/api-client';
import { generateMessageId, formatDate } from '@devmentorai/shared';
import type { Message, MessageContext, StreamEvent } from '@devmentorai/shared';

export function useChat(sessionId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const sendMessage = useCallback(async (content: string, context?: MessageContext) => {
    if (!sessionId || isStreaming) return;

    // Store the session ID at the start of this request (A.4 fix)
    const requestSessionId = sessionId;

    setError(null);
    setIsStreaming(true);
    currentMessageRef.current = '';

    // Add user message immediately
    const userMessage: Message = {
      id: generateMessageId(),
      sessionId: requestSessionId,
      role: 'user',
      content,
      timestamp: formatDate(),
      metadata: context ? {
        pageUrl: context.pageUrl,
        selectedText: context.selectedText,
        action: context.action,
      } : undefined,
    };
    setMessages(prev => [...prev, userMessage]);

    // Create placeholder for assistant message
    const assistantMessageId = generateMessageId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      sessionId: requestSessionId,
      role: 'assistant',
      content: '',
      timestamp: formatDate(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      await apiClient.streamChat(
        requestSessionId,
        { prompt: content, context },
        (event: StreamEvent) => {
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
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, metadata: { ...m.metadata, streamComplete: true } }
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

            case 'error':
              setError(event.data.error || 'An error occurred');
              break;

            case 'done':
              setIsStreaming(false);
              break;
          }
        },
        abortControllerRef.current.signal
      );
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
    error,
    sendMessage,
    abortMessage,
    clearError: () => setError(null),
  };
}
