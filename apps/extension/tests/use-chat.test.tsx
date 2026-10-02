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

  it('ignores a quick-action reload that resolves after sending starts', async () => {
    const staleMessage = {
      id: 'stale-message',
      sessionId: 'active-session',
      role: 'assistant' as const,
      content: 'stale quick-action content',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const staleResponse = {
      success: true,
      data: { items: [staleMessage], total: 1, page: 1, pageSize: 100, hasMore: false },
    };
    let finishStream: (() => void) | undefined;
    streamChat.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStream = resolve;
        })
    );

    const { result } = renderHook(() => useChat('active-session'));
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(1));

    let resolveReload!: (response: typeof staleResponse) => void;
    getSessionMessages.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReload = resolve;
      })
    );

    act(() => {
      fireMessage({ type: SESSION_MESSAGES_UPDATED, sessionId: 'active-session' });
    });
    expect(getSessionMessages).toHaveBeenCalledTimes(2);

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.sendMessage('Hello');
    });

    await act(async () => {
      resolveReload(staleResponse);
      await Promise.resolve();
    });

    expect(result.current.messages.some((message) => message.content === 'Hello')).toBe(true);
    expect(result.current.messages.some((message) => message.id === staleMessage.id)).toBe(false);

    await act(async () => {
      finishStream?.();
      await sendPromise;
    });
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(3));
  });

  it('ignores a pending message load after switching sessions', async () => {
    const sessionAMessage = {
      id: 'session-a-message',
      sessionId: 'session-a',
      role: 'assistant' as const,
      content: 'Session A',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const sessionBMessage = {
      id: 'session-b-message',
      sessionId: 'session-b',
      role: 'assistant' as const,
      content: 'Session B',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const sessionAResponse = {
      success: true,
      data: { items: [sessionAMessage], total: 1, page: 1, pageSize: 100, hasMore: false },
    };
    const sessionBResponse = {
      success: true,
      data: { items: [sessionBMessage], total: 1, page: 1, pageSize: 100, hasMore: false },
    };
    let resolveSessionA!: (response: typeof sessionAResponse) => void;
    getSessionMessages
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSessionA = resolve;
        })
      )
      .mockResolvedValueOnce(sessionBResponse);

    const { result, rerender } = renderHook(({ sessionId }) => useChat(sessionId), {
      initialProps: { sessionId: 'session-a' },
    });

    expect(getSessionMessages).toHaveBeenCalledWith('session-a');

    rerender({ sessionId: 'session-b' });
    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([sessionBMessage.id])
    );

    await act(async () => {
      resolveSessionA(sessionAResponse);
      await Promise.resolve();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual([sessionBMessage.id]);
  });
});
