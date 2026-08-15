import { formatDate, generateMessageId } from '@devmentorai/shared';
import type {
  AcpConfigOption,
  AcpContentBlock,
  ContextPayload,
  ImagePayload,
  Message,
  MessageContext,
} from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AcpPermissionDecision, AcpPermissionRequest } from '../services/acp-client';
import { AcpClient } from '../services/acp-client';
import { initialAcpChatState, reduceAcpChatState } from '../services/acp-reducer';

export interface SendMessageOptions {
  context?: MessageContext;
  fullContext?: ContextPayload;
  useContextAwareMode?: boolean;
  images?: ImagePayload[];
  workspaceFiles?: Array<{ path: string; name?: string; mimeType?: string; size?: number }>;
}

function permissionToolKey(toolCall: unknown): string {
  const call = (toolCall ?? {}) as { kind?: unknown; rawInput?: unknown };
  if (typeof call.kind === 'string' && call.kind.length > 0) return call.kind;
  const rawInput = call.rawInput as Record<string, unknown> | undefined;
  if (rawInput && typeof rawInput.tool === 'string') return rawInput.tool;
  if (rawInput && typeof rawInput.name === 'string') return rawInput.name;
  return 'unknown-tool';
}

export function useChat(
  sessionId: string | undefined,
  acpCapabilities?: Record<string, unknown>,
  sharedClient?: AcpClient
) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<AcpPermissionRequest | null>(null);
  const permissionResolverRef = useRef<((result: AcpPermissionDecision) => void) | null>(null);
  const [acpState, dispatchAcpEvent] = useReducer(reduceAcpChatState, initialAcpChatState);
  const ownClient = useMemo(
    () => (sharedClient ? undefined : new AcpClient({ url: 'ws://127.0.0.1:3847/acp' })),
    [sharedClient]
  );
  const acpClient = sharedClient ?? (ownClient as AcpClient);

  useEffect(() => {
    dispatchAcpEvent({ type: 'reset' });
  }, [sessionId]);

  useEffect(() => {
    acpClient.setPermissionHandler(
      async (request) =>
        new Promise((resolve) => {
          setPermissionRequest(request);
          permissionResolverRef.current = resolve;
        })
    );
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
    void acpClient.revokePermission(
      permissionRequest.sessionId,
      permissionToolKey(permissionRequest.toolCall)
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
      dispatchAcpEvent({ type: 'event', sessionId, event: { type: 'config', options } });
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
      const promptCapabilities = (
        acpCapabilities?.agentCapabilities as Record<string, unknown> | undefined
      )?.promptCapabilities as Record<string, unknown> | undefined;
      if (sendOptions.images?.length && promptCapabilities?.image !== true) {
        setError('This agent does not support image attachments.');
        return;
      }
      setError(null);
      setIsSending(true);
      const blocks: AcpContentBlock[] = [{ type: 'text', text: content }];
      for (const image of sendOptions.images ?? []) {
        const separator = image.dataUrl.indexOf(',');
        blocks.push({
          type: 'image',
          mimeType: image.mimeType,
          data: separator >= 0 ? image.dataUrl.slice(separator + 1) : image.dataUrl,
        });
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
        type: 'user_message',
        message: {
          id: generateMessageId(),
          sessionId,
          role: 'user',
          content,
          timestamp: formatDate(),
        } satisfies Message,
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
