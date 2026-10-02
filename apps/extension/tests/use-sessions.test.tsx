import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessions } from '../src/hooks/useSessions';
import { ApiClient } from '../src/services/api-client';

describe('useSessions', () => {
  let listSessions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSessions = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    vi.spyOn(ApiClient, 'getInstance').mockReturnValue({
      listSessions,
    } as unknown as ApiClient);
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_: string, callback: (result: object) => void) => callback({})),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps isLoading false during a silent refresh', async () => {
    const { result } = renderHook(() => useSessions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh!: (response: {
      success: boolean;
      data: { items: never[]; total: number; page: number; pageSize: number; hasMore: boolean };
    }) => void;
    listSessions.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = result.current.refreshSessions({ silent: true });
    });

    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveRefresh({
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
      });
      await refreshPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });
});
