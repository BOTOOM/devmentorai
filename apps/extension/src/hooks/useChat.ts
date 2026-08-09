import type {
  AcpConfigOption,
  AcpContentBlock,
  ContextPayload,
  ImagePayload,
  MessageContext,
} from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AcpPermissionDecision, AcpPermissionRequest } from '../services/acp-client';
import { AcpClient } from '../services/acp-client';
import { initialAcpChatState, reduceAcpEvent } from '../services/acp-reducer';

export interface SendMessageOptions {
  context?: MessageContext;
  fullContext?: ContextPayload;
  useContextAwareMode?: boolean;
  images?: ImagePayload[];
  workspaceFiles?: Array<{ path: string; name?: string; mimeType?: string; size?: number }>;
}

export function useChat(sessionId: string | undefined, acpCapabilities?: Record<string, unknown>) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<AcpPermissionRequest | null>(null);
  const permissionResolverRef = useRef<((result: AcpPermissionDecision) => void) | null>(null);
  const [acpState, dispatchAcpEvent] = useReducer(
    (
      state: typeof initialAcpChatState,
      action: { sessionId: string; event: Parameters<typeof reduceAcpEvent>[1] }
    ) => reduceAcpEvent(state, action.event, action.sessionId),
    initialAcpChatState
  );
  const acpClient = useMemo(
    () =>
      new AcpClient({
        url: 'ws://127.0.0.1:3847/acp',
        permissionHandler: async (request) =>
          new Promise((resolve) => {
            setPermissionRequest(request);
            permissionResolverRef.current = resolve;
          }),
      }),
    []
  );

  useEffect(() => {
    const unsubscribe = acpClient.onEvent((eventSessionId, _seq, event) => {
      if (eventSessionId === sessionId) dispatchAcpEvent({ sessionId: eventSessionId, event });
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
    const toolCall = permissionRequest.toolCall as { title?: string; kind?: string };
    void acpClient.revokePermission(
      permissionRequest.sessionId,
      toolCall.title ?? toolCall.kind ?? 'unknown-tool'
    );
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
      dispatchAcpEvent({ sessionId, event: { type: 'config', options } });
    },
    [acpClient, sessionId]
  );

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions | MessageContext) => {
      if (!sessionId || isSending || acpState.isStreaming) return;
      const isOptions =
        options &&
        ('useContextAwareMode' in options ||
          'fullContext' in options ||
          'images' in options ||
          'workspaceFiles' in options);
      const sendOptions: SendMessageOptions = isOptions
        ? (options as SendMessageOptions)
        : { context: options as MessageContext };
      setError(null);
      setIsSending(true);
      const promptCapabilities = (
        acpCapabilities?.agentCapabilities as Record<string, unknown> | undefined
      )?.promptCapabilities as Record<string, unknown> | undefined;
      const blocks: AcpContentBlock[] = [{ type: 'text', text: content }];
      if (promptCapabilities?.image === true) {
        for (const image of sendOptions.images ?? []) {
          const separator = image.dataUrl.indexOf(',');
          blocks.push({
            type: 'image',
            mimeType: image.mimeType,
            data: separator >= 0 ? image.dataUrl.slice(separator + 1) : image.dataUrl,
          });
        }
      }
      if (sendOptions.fullContext) {
        if (promptCapabilities?.embeddedContext === true) {
          blocks.push({
            type: 'resource',
            resource: {
              uri: `devmentorai://context/${sessionId}`,
              mimeType: 'text/plain',
              text: JSON.stringify(sendOptions.fullContext),
            },
          });
        } else {
          blocks[0] = {
            type: 'text',
            text: `${content}\n\n\`\`\`context\n${JSON.stringify(sendOptions.fullContext, null, 2)}\n\`\`\``,
          };
        }
      }
      for (const file of sendOptions.workspaceFiles ?? []) {
        if (!file.path.startsWith('/')) continue;
        blocks.push({
          type: 'resource_link',
          uri: `file://${file.path}`,
          ...(file.name ? { name: file.name } : {}),
          ...(file.mimeType ? { mimeType: file.mimeType } : {}),
          ...(file.size !== undefined ? { size: file.size } : {}),
        });
      }
      dispatchAcpEvent({
        sessionId,
        event: {
          type: 'message',
          role: 'user',
          messageId: `user-${Date.now()}`,
          content: [{ type: 'text', text: content }],
          mode: 'replace',
        },
      });
      try {
        await acpClient.prompt(sessionId, blocks);
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : 'ACP prompt failed');
      } finally {
        setIsSending(false);
      }
    },
    [acpCapabilities, acpClient, acpState.isStreaming, isSending, sessionId]
  );

  const abortMessage = useCallback(async () => {
    if (!sessionId) return;
    try {
      await acpClient.cancel(sessionId);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel ACP turn');
    } finally {
      setIsSending(false);
    }
  }, [acpClient, sessionId]);

  return {
    messages: acpState.messages,
    isStreaming: acpState.isStreaming,
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
    acpState,
    setAcpConfigOption,
  };
}
