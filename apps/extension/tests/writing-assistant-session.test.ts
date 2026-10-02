import type { Session } from '@devmentorai/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  streamChat: vi.fn(),
  switchSessionModel: vi.fn(),
  resumeSession: vi.fn(),
}));

vi.mock('../src/services/api-client', () => ({
  ApiClient: {
    getInstance: () => apiClientMock,
  },
}));

vi.mock('../src/services/model-catalog', () => ({
  getEffectiveQuickActionModel: vi.fn(async (modelId: string) => ({ modelId })),
  invalidateModelAvailabilityCache: vi.fn(async () => {}),
}));

import {
  SESSION_MESSAGES_UPDATED,
  clearWritingAssistantCache,
  getOrCreateWritingAssistantSession,
  streamQuickAction,
} from '../src/services/writing-assistant-session';

const writingSession = {
  id: 'writing-assistant-session',
  name: 'Writing Assistant',
  type: 'writing',
  status: 'active',
  model: 'test-model',
  messageCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Session;

describe('writing assistant session', () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let originalChrome: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    clearWritingAssistantCache();

    sendMessage = vi.fn().mockResolvedValue(undefined);
    originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    });
  });

  afterEach(() => {
    clearWritingAssistantCache();
    vi.restoreAllMocks();
    if (originalChrome) {
      Object.defineProperty(globalThis, 'chrome', originalChrome);
    } else {
      Reflect.deleteProperty(globalThis, 'chrome');
    }
  });

  it('notifies the side panel after a successful quick action even if there is no receiver', async () => {
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: {
        items: [writingSession],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    });
    apiClientMock.streamChat.mockResolvedValue(undefined);
    sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));

    await expect(
      streamQuickAction('Fix this text', 'test-model', () => {})
    ).resolves.toBeUndefined();

    expect(apiClientMock.streamChat).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      type: SESSION_MESSAGES_UPDATED,
      sessionId: writingSession.id,
    });
  });

  it('finds the Writing Assistant session on a later page instead of creating a duplicate', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      ...writingSession,
      id: `other-session-${index}`,
      name: `Other session ${index}`,
      type: 'general',
    }));
    apiClientMock.listSessions
      .mockResolvedValueOnce({
        success: true,
        data: { items: firstPage, total: 51, page: 1, pageSize: 50, hasMore: true },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { items: [writingSession], total: 51, page: 2, pageSize: 50, hasMore: false },
      });

    await expect(getOrCreateWritingAssistantSession('test-model')).resolves.toEqual(writingSession);

    expect(apiClientMock.listSessions).toHaveBeenNthCalledWith(1, 1, 50);
    expect(apiClientMock.listSessions).toHaveBeenNthCalledWith(2, 2, 50);
    expect(apiClientMock.createSession).not.toHaveBeenCalled();
  });
});
