import type { Session } from '@devmentorai/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  streamChat: vi.fn(),
  switchSessionModel: vi.fn(),
  resumeSession: vi.fn(),
}));

const modelCatalogMock = vi.hoisted(() => ({
  getEffectiveQuickActionModel: vi.fn(async (modelId: string) => ({
    modelId,
    reasoningEffort: undefined as 'none' | undefined,
  })),
  invalidateModelAvailabilityCache: vi.fn(async () => {}),
}));

vi.mock('../src/services/api-client', () => ({
  ApiClient: {
    getInstance: () => apiClientMock,
  },
}));

vi.mock('../src/services/model-catalog', () => modelCatalogMock);

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
    modelCatalogMock.getEffectiveQuickActionModel.mockImplementation(async (modelId) => ({
      modelId,
      reasoningEffort: undefined,
    }));

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

  it('finds the Writing Assistant session on page 21 instead of creating a duplicate', async () => {
    const otherSessions = Array.from({ length: 50 }, (_, index) => ({
      ...writingSession,
      id: `other-session-${index}`,
      name: `Other session ${index}`,
      type: 'general',
    }));
    apiClientMock.listSessions.mockImplementation(async (page: number) => ({
      success: true,
      data: {
        items: page === 21 ? [writingSession] : otherSessions,
        total: 1050,
        page,
        pageSize: 50,
        hasMore: page < 21,
      },
    }));

    await expect(getOrCreateWritingAssistantSession('test-model')).resolves.toEqual(writingSession);

    expect(apiClientMock.listSessions).toHaveBeenNthCalledWith(1, 1, 50);
    expect(apiClientMock.listSessions).toHaveBeenNthCalledWith(21, 21, 50);
    expect(apiClientMock.listSessions).toHaveBeenCalledTimes(21);
    expect(apiClientMock.createSession).not.toHaveBeenCalled();
  });

  it('stops paging when a page is empty even if there are more pages', async () => {
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 100, page: 1, pageSize: 50, hasMore: true },
    });
    apiClientMock.createSession.mockResolvedValue({
      success: true,
      data: writingSession,
    });

    await expect(getOrCreateWritingAssistantSession('test-model')).resolves.toEqual(writingSession);

    expect(apiClientMock.listSessions).toHaveBeenCalledOnce();
    expect(apiClientMock.createSession).toHaveBeenCalledOnce();
  });

  it('uses the pre-resolved effort without resolving the quick-action model again', async () => {
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession.mockResolvedValue({
      success: true,
      data: { ...writingSession, model: 'gpt-6-luna', reasoningEffort: 'none' },
    });
    apiClientMock.streamChat.mockResolvedValue(undefined);

    await streamQuickAction('Fix this text', 'gpt-6-luna', () => {}, undefined, 'none');

    expect(apiClientMock.createSession).toHaveBeenCalledWith({
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
    });
    expect(modelCatalogMock.getEffectiveQuickActionModel).not.toHaveBeenCalled();
  });

  it('retries creating a session without reasoning effort when none is rejected', async () => {
    const createdSession = {
      ...writingSession,
      model: 'gpt-6-luna',
      reasoningEffort: undefined,
    };
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession
      .mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'Unsupported reasoning effort' },
      })
      .mockResolvedValueOnce({ success: true, data: createdSession });

    await expect(getOrCreateWritingAssistantSession('gpt-6-luna', 'none')).resolves.toEqual(
      createdSession
    );

    expect(apiClientMock.createSession).toHaveBeenNthCalledWith(1, {
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
    });
    expect(apiClientMock.createSession).toHaveBeenNthCalledWith(2, {
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-6-luna',
    });
  });

  it('does not retry a failed create when no reasoning effort was requested', async () => {
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession.mockResolvedValue({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Invalid model' },
    });

    await expect(getOrCreateWritingAssistantSession('gpt-5-mini')).resolves.toBeNull();

    expect(apiClientMock.createSession).toHaveBeenCalledOnce();
    expect(apiClientMock.createSession).toHaveBeenCalledWith({
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-5-mini',
    });
  });

  it('does not retry a create aborted while applying reasoning effort', async () => {
    const abortError = new Error('Request cancelled');
    abortError.name = 'AbortError';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession.mockRejectedValue(abortError);

    await expect(getOrCreateWritingAssistantSession('gpt-6-luna', 'none')).resolves.toBeNull();

    expect(apiClientMock.createSession).toHaveBeenCalledOnce();
  });

  it('switches an existing same-model session to none when it is not set', async () => {
    const existingSession = {
      ...writingSession,
      model: 'gpt-6-luna',
      reasoningEffort: null,
    } as unknown as Session;
    const updatedSession = { ...existingSession, reasoningEffort: 'none' } as Session;
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: {
        items: [existingSession],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    });
    apiClientMock.switchSessionModel.mockResolvedValue({
      success: true,
      data: updatedSession,
    });

    await expect(getOrCreateWritingAssistantSession('gpt-6-luna', 'none')).resolves.toEqual(
      updatedSession
    );

    expect(apiClientMock.switchSessionModel).toHaveBeenCalledWith(
      writingSession.id,
      'gpt-6-luna',
      'none'
    );
  });

  it('retries switching a session without reasoning effort when none is rejected', async () => {
    const existingSession = {
      ...writingSession,
      model: 'gpt-6-luna',
      reasoningEffort: null,
    } as unknown as Session;
    const updatedSession = {
      ...existingSession,
      reasoningEffort: undefined,
    } as Session;
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: {
        items: [existingSession],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    });
    apiClientMock.switchSessionModel
      .mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_ARGUMENT', message: 'Unsupported reasoning effort' },
      })
      .mockResolvedValueOnce({ success: true, data: updatedSession });

    await expect(getOrCreateWritingAssistantSession('gpt-6-luna', 'none')).resolves.toEqual(
      updatedSession
    );

    expect(apiClientMock.switchSessionModel).toHaveBeenNthCalledWith(
      1,
      writingSession.id,
      'gpt-6-luna',
      'none'
    );
    expect(apiClientMock.switchSessionModel).toHaveBeenNthCalledWith(
      2,
      writingSession.id,
      'gpt-6-luna',
      undefined
    );
  });

  it('does not switch an existing session already using the model and none', async () => {
    const existingSession = {
      ...writingSession,
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
    } as Session;
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: {
        items: [existingSession],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    });

    await expect(getOrCreateWritingAssistantSession('gpt-6-luna', 'none')).resolves.toEqual(
      existingSession
    );

    expect(apiClientMock.switchSessionModel).not.toHaveBeenCalled();
  });

  it('omits reasoning effort for new models that do not support none', async () => {
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession.mockResolvedValue({
      success: true,
      data: { ...writingSession, model: 'gpt-5-mini' },
    });

    await getOrCreateWritingAssistantSession('gpt-5-mini');

    expect(apiClientMock.createSession).toHaveBeenCalledWith({
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-5-mini',
    });
  });

  it('clears stale none when switching an existing session to a model without it', async () => {
    const existingSession = {
      ...writingSession,
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
    } as Session;
    const updatedSession = {
      ...existingSession,
      model: 'gpt-5-mini',
      reasoningEffort: undefined,
    };
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: {
        items: [existingSession],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    });
    apiClientMock.switchSessionModel.mockResolvedValue({
      success: true,
      data: updatedSession,
    });

    await expect(getOrCreateWritingAssistantSession('gpt-5-mini')).resolves.toEqual(updatedSession);

    expect(apiClientMock.switchSessionModel).toHaveBeenCalledWith(
      writingSession.id,
      'gpt-5-mini',
      undefined
    );
  });

  it('resolves the fallback model effort when Copilot reports a model unavailable', async () => {
    modelCatalogMock.getEffectiveQuickActionModel.mockImplementationOnce(async () => ({
      modelId: 'gpt-5-mini',
      reasoningEffort: undefined,
    }));
    apiClientMock.listSessions.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    });
    apiClientMock.createSession
      .mockResolvedValueOnce({
        success: true,
        data: { ...writingSession, model: 'gpt-6-luna', reasoningEffort: 'none' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { ...writingSession, id: 'fallback-session', model: 'gpt-5-mini' },
      });
    apiClientMock.streamChat
      .mockRejectedValueOnce(new Error('MODEL_UNAVAILABLE'))
      .mockResolvedValueOnce(undefined);

    await streamQuickAction('Fix this text', 'gpt-6-luna', () => {}, undefined, 'none');

    expect(apiClientMock.createSession).toHaveBeenNthCalledWith(1, {
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
    });
    expect(apiClientMock.createSession).toHaveBeenNthCalledWith(2, {
      name: 'Writing Assistant',
      type: 'writing',
      model: 'gpt-5-mini',
    });
  });
});
