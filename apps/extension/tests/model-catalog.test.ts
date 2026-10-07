import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelInfo } from '@devmentorai/shared';
import { DEFAULT_QUICK_ACTION_MODEL, normalizeQuickActionModel } from '../src/constants/models';

const storage = new Map<string, unknown>();

vi.mock('../src/lib/browser-utils', () => ({
  storageGet: vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
    if (typeof keys === 'string') {
      return { [keys]: storage.get(keys) };
    }
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, storage.get(key)]));
    }
    return Object.fromEntries(storage.entries());
  }),
  storageSet: vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) {
      storage.set(key, value);
    }
  }),
}));

vi.mock('../src/services/api-client', () => ({
  ApiClient: {
    getInstance: () => ({
      getModels: vi.fn(async () => ({
        success: true,
        data: {
          default: DEFAULT_QUICK_ACTION_MODEL,
          models: [
            {
              id: DEFAULT_QUICK_ACTION_MODEL,
              name: 'GPT-5 Mini',
              provider: 'openai',
              accessProvider: 'github-copilot',
              available: true,
            },
            {
              id: 'gpt-6-luna',
              name: 'GPT-6 Luna',
              provider: 'openai',
              accessProvider: 'github-copilot',
              available: true,
              supportedReasoningEfforts: ['low', 'medium', 'high'],
            },
            {
              id: 'claude-haiku-4.5',
              name: 'Claude Haiku 4.5',
              provider: 'anthropic',
              accessProvider: 'github-copilot',
              available: true,
            },
          ],
        },
      })),
    }),
  },
}));

describe('model catalog', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          version: 1,
          provider: 'github-copilot',
          defaultQuickActionModel: DEFAULT_QUICK_ACTION_MODEL,
          quickActionModelOrder: [DEFAULT_QUICK_ACTION_MODEL, 'gpt-6-luna', 'claude-haiku-4.5'],
          models: [
            {
              id: DEFAULT_QUICK_ACTION_MODEL,
              name: 'GPT-5 Mini',
              provider: 'openai',
              accessProvider: 'github-copilot',
              available: true,
              isRecommendedForQuickActions: true,
            },
            {
              id: 'gpt-6-luna',
              name: 'GPT-6 Luna',
              provider: 'openai',
              accessProvider: 'github-copilot',
              available: true,
              isRecommendedForQuickActions: true,
              supportedReasoningEfforts: ['none', 'low', 'medium', 'high'],
            },
            {
              id: 'claude-haiku-4.5',
              name: 'Claude Haiku 4.5',
              provider: 'anthropic',
              accessProvider: 'github-copilot',
              available: true,
              isRecommendedForQuickActions: true,
            },
          ],
        }),
      }))
    );
  });

  it('normalizes deprecated quick action models to current replacements', () => {
    expect(normalizeQuickActionModel('gpt-4.1')).toBe(DEFAULT_QUICK_ACTION_MODEL);
    expect(normalizeQuickActionModel('claude-3-5-haiku')).toBe('claude-haiku-4.5');
    expect(normalizeQuickActionModel('claude-3-5-sonnet')).toBe('claude-sonnet-4.5');
  });

  it('uses available fast fallback when requested model is unavailable', async () => {
    const { getEffectiveQuickActionModel } = await import('../src/services/model-catalog');

    const effectiveModel = await getEffectiveQuickActionModel('claude-3-5-haiku');

    expect(effectiveModel.requestedModelId).toBe('claude-haiku-4.5');
    expect(effectiveModel.modelId).toBe('claude-haiku-4.5');
    expect(effectiveModel.wasFallback).toBe(false);
  });

  it('falls back to the fastest available model for unknown selections', async () => {
    const { getEffectiveQuickActionModel } = await import('../src/services/model-catalog');

    const effectiveModel = await getEffectiveQuickActionModel('unknown-model');

    expect(effectiveModel.modelId).toBe(DEFAULT_QUICK_ACTION_MODEL);
    expect(effectiveModel.wasFallback).toBe(true);
  });

  it('preserves catalog reasoning efforts when live availability omits none', async () => {
    const { getQuickActionModelState } = await import('../src/services/model-catalog');

    const state = await getQuickActionModelState();
    const model = state.allModels.find((candidate) => candidate.id === 'gpt-6-luna');

    expect(model?.supportedReasoningEfforts).toEqual(['none', 'low', 'medium', 'high']);
  });

  it('resolves none for direct and fallback quick-action models', async () => {
    const { getEffectiveQuickActionModel } = await import('../src/services/model-catalog');

    const directModel = await getEffectiveQuickActionModel('gpt-6-luna');
    const fallbackModel = await getEffectiveQuickActionModel('unknown-model', {
      excludeModelIds: [DEFAULT_QUICK_ACTION_MODEL],
    });

    expect(directModel.reasoningEffort).toBe('none');
    expect(fallbackModel.modelId).toBe('gpt-6-luna');
    expect(fallbackModel.reasoningEffort).toBe('none');
  });

  it('returns none only when the model catalog explicitly supports it', async () => {
    const { getQuickActionReasoningEffort } = await import('../src/services/model-catalog');
    const model = {
      id: 'gpt-6-luna',
      name: 'GPT-6 Luna',
      provider: 'openai',
      available: true,
      supportedReasoningEfforts: ['none'],
    } satisfies ModelInfo;

    expect(getQuickActionReasoningEffort(model)).toBe('none');
    expect(getQuickActionReasoningEffort({ ...model, supportedReasoningEfforts: [] })).toBe(
      undefined
    );
    expect(getQuickActionReasoningEffort()).toBeUndefined();
  });
});
