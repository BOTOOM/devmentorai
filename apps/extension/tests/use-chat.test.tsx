import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../src/hooks/useChat';
import { ApiClient } from '../src/services/api-client';
import { SESSION_MESSAGES_UPDATED } from '../src/services/writing-assistant-session';

describe('useChat session message updates', () => {
  let listeners: Array<(message: { type: string; sessionId: string }) => void>;
  let getSessionMessages: ReturnType<typeof vi.fn>;
  let streamChat: ReturnType<typeof vi.fn>;

  const fireMessage = (message: { type: string; sessionId: string }) => {
    for (const listener of listeners) {
      listener(message);
    }
  };

  beforeEach(() => {
    listeners = [];
    getSessionMessages = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 100, hasMore: false },
    });
    streamChat = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(ApiClient, 'getInstance').mockReturnValue({
      getSessionMessages,
      streamChat,
    } as unknown as ApiClient);

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: (message: { type: string; sessionId: string }) => void) =>
            listeners.push(listener)
          ),
          removeListener: vi.fn(
            (listener: (message: { type: string; sessionId: string }) => void) => {
              listeners = listeners.filter((candidate) => candidate !== listener);
            }
          ),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reloads messages for the active session and ignores other sessions', async () => {
    renderHook(() => useChat('active-session'));

    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(1));

    act(() => {
      fireMessage({ type: SESSION_MESSAGES_UPDATED, sessionId: 'other-session' });
    });
    expect(getSessionMessages).toHaveBeenCalledTimes(1);

    act(() => {
      fireMessage({ type: SESSION_MESSAGES_UPDATED, sessionId: 'active-session' });
    });
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(2));
    expect(getSessionMessages).toHaveBeenLastCalledWith('active-session');
  });

  it('defers a message reload until sending finishes', async () => {
    let finishStream: (() => void) | undefined;
    streamChat.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStream = resolve;
        })
    );

    const { result } = renderHook(() => useChat('active-session'));
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(1));

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendMessage('Hello');
    });
    expect(streamChat).toHaveBeenCalledOnce();

    act(() => {
      fireMessage({ type: SESSION_MESSAGES_UPDATED, sessionId: 'active-session' });
    });
    expect(getSessionMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishStream?.();
      await sendPromise;
    });
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(2));
  });
});
