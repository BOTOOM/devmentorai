import type { ModelInfo } from '@devmentorai/shared';
import {
  DEFAULT_QUICK_ACTION_MODEL,
  FALLBACK_MODEL_CATALOG,
  GITHUB_COPILOT_ACCESS_PROVIDER,
  QUICK_ACTION_FAST_MODEL_ORDER,
  REMOTE_MODEL_CATALOG_URL,
  normalizeQuickActionModel,
} from '../constants/models';
import { storageGet, storageSet } from '../lib/browser-utils';
import { ApiClient } from './api-client';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const REMOTE_CATALOG_CACHE_KEY = 'modelCatalogCache';
const AVAILABILITY_CACHE_KEY = 'modelAvailabilityCache';

type CatalogStatus = 'fresh' | 'stale' | 'fallback';

export interface RemoteModelCatalog {
  version: number;
  provider: string;
  defaultQuickActionModel?: string;
  quickActionModelOrder?: string[];
  models: ModelInfo[];
  updatedAt?: string;
}

interface CachedRemoteCatalog {
  catalog: RemoteModelCatalog;
  fetchedAt: number;
  expiresAt: number;
}

interface CachedAvailability {
  provider: string;
  models: ModelInfo[];
  default: string;
  fetchedAt: number;
  expiresAt: number;
}

export interface QuickActionModelOption {
  value: string;
  label: string;
  provider: string;
  available: boolean;
  recommended: boolean;
  source: CatalogStatus;
}

export interface QuickActionModelState {
  options: QuickActionModelOption[];
  allModels: ModelInfo[];
  defaultModel: string;
  status: CatalogStatus;
  statusMessage: string;
  availabilityKnown: boolean;
}

export interface EffectiveQuickActionModel {
  modelId: string;
  requestedModelId: string;
  wasFallback: boolean;
  reason?: string;
  state: QuickActionModelState;
}

function fallbackCatalog(): RemoteModelCatalog {
  return {
    version: 1,
    provider: GITHUB_COPILOT_ACCESS_PROVIDER,
    defaultQuickActionModel: DEFAULT_QUICK_ACTION_MODEL,
    quickActionModelOrder: [...QUICK_ACTION_FAST_MODEL_ORDER],
    models: FALLBACK_MODEL_CATALOG.map((model) => ({
      ...model,
      aliases: model.aliases ? [...model.aliases] : undefined,
    })),
  };
}

function isRemoteModelCatalog(value: unknown): value is RemoteModelCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as Partial<RemoteModelCatalog>;
  return (
    typeof catalog.version === 'number' &&
    typeof catalog.provider === 'string' &&
    Array.isArray(catalog.models) &&
    catalog.models.every((model) => model && typeof model.id === 'string')
  );
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeModels(catalogModels: ModelInfo[], availabilityModels: ModelInfo[]): ModelInfo[] {
  const byId = new Map<string, ModelInfo>();
  const fastModelIds = new Set<string>(QUICK_ACTION_FAST_MODEL_ORDER);

  for (const model of catalogModels) {
    byId.set(model.id, model);
  }

  for (const availableModel of availabilityModels) {
    const catalogModel = byId.get(availableModel.id);
    byId.set(availableModel.id, {
      ...catalogModel,
      ...availableModel,
      name: availableModel.name || catalogModel?.name || availableModel.id,
      provider: availableModel.provider || catalogModel?.provider || 'unknown',
      accessProvider:
        availableModel.accessProvider ||
        catalogModel?.accessProvider ||
        GITHUB_COPILOT_ACCESS_PROVIDER,
      available: availableModel.available,
      isRecommendedForQuickActions:
        catalogModel?.isRecommendedForQuickActions || fastModelIds.has(availableModel.id),
    });
  }

  return Array.from(byId.values());
}

function buildOptions(
  models: ModelInfo[],
  modelOrder: string[],
  availabilityKnown: boolean,
  source: CatalogStatus
): QuickActionModelOption[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  const orderedIds = [
    ...modelOrder,
    ...models
      .filter((model) => model.isRecommendedForQuickActions && !modelOrder.includes(model.id))
      .map((model) => model.id),
  ];

  return Array.from(new Set(orderedIds))
    .map((modelId) => byId.get(modelId))
    .filter((model): model is ModelInfo => Boolean(model))
    .filter((model) => !availabilityKnown || model.available)
    .map((model) => ({
      value: model.id,
      label: model.name || model.id,
      provider: model.provider,
      available: model.available,
      recommended: Boolean(model.isRecommendedForQuickActions),
      source,
    }));
}

function statusMessage(status: CatalogStatus, availabilityKnown: boolean): string {
  if (status === 'fresh' && availabilityKnown) {
    return 'Using current Copilot model availability.';
  }
  if (status === 'fresh') {
    return 'Using current remote model catalog.';
  }
  if (status === 'stale') {
    return 'Using cached model data until the next successful refresh.';
  }
  return 'Using built-in model fallback.';
}

async function getCachedRemoteCatalog(): Promise<CachedRemoteCatalog | null> {
  const result = await storageGet<{ [REMOTE_CATALOG_CACHE_KEY]?: CachedRemoteCatalog }>(
    REMOTE_CATALOG_CACHE_KEY
  );
  const cached = result[REMOTE_CATALOG_CACHE_KEY];
  return cached?.catalog && isRemoteModelCatalog(cached.catalog) ? cached : null;
}

async function getCachedAvailability(): Promise<CachedAvailability | null> {
  const result = await storageGet<{ [AVAILABILITY_CACHE_KEY]?: CachedAvailability }>(
    AVAILABILITY_CACHE_KEY
  );
  const cached = result[AVAILABILITY_CACHE_KEY];
  return cached?.provider === GITHUB_COPILOT_ACCESS_PROVIDER && Array.isArray(cached.models)
    ? cached
    : null;
}

async function loadRemoteCatalog(forceRefresh: boolean): Promise<{
  catalog: RemoteModelCatalog;
  status: CatalogStatus;
}> {
  const now = Date.now();
  const cached = await getCachedRemoteCatalog();

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return { catalog: cached.catalog, status: 'fresh' };
  }

  try {
    const remoteCatalog = await fetchJsonWithTimeout<unknown>(
      REMOTE_MODEL_CATALOG_URL,
      FETCH_TIMEOUT_MS
    );

    if (!isRemoteModelCatalog(remoteCatalog)) {
      throw new Error('Remote model catalog has an invalid shape');
    }

    const nextCache: CachedRemoteCatalog = {
      catalog: remoteCatalog,
      fetchedAt: now,
      expiresAt: now + ONE_DAY_MS,
    };
    await storageSet({ [REMOTE_CATALOG_CACHE_KEY]: nextCache });
    return { catalog: remoteCatalog, status: 'fresh' };
  } catch (error) {
    console.warn('[ModelCatalog] Failed to refresh remote catalog:', error);
    if (cached) {
      return { catalog: cached.catalog, status: 'stale' };
    }
    return { catalog: fallbackCatalog(), status: 'fallback' };
  }
}

async function loadAvailability(forceRefresh: boolean): Promise<{
  availability: CachedAvailability | null;
  status: CatalogStatus | null;
}> {
  const now = Date.now();
  const cached = await getCachedAvailability();

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return { availability: cached, status: 'fresh' };
  }

  try {
    const apiClient = ApiClient.getInstance();
    const response = await apiClient.getModels({ forceRefresh });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch available models');
    }

    const availability: CachedAvailability = {
      provider: GITHUB_COPILOT_ACCESS_PROVIDER,
      models: response.data.models,
      default: response.data.default,
      fetchedAt: now,
      expiresAt: now + ONE_DAY_MS,
    };
    await storageSet({ [AVAILABILITY_CACHE_KEY]: availability });
    return { availability, status: 'fresh' };
  } catch (error) {
    console.warn('[ModelCatalog] Failed to refresh model availability:', error);
    if (cached) {
      return { availability: cached, status: 'stale' };
    }
    return { availability: null, status: null };
  }
}

export async function invalidateModelAvailabilityCache(): Promise<void> {
  await storageSet({
    [AVAILABILITY_CACHE_KEY]: {
      provider: GITHUB_COPILOT_ACCESS_PROVIDER,
      models: [],
      default: DEFAULT_QUICK_ACTION_MODEL,
      fetchedAt: 0,
      expiresAt: 0,
    } satisfies CachedAvailability,
  });
}

export async function getQuickActionModelState(
  options: { forceRefresh?: boolean } = {}
): Promise<QuickActionModelState> {
  const forceRefresh = Boolean(options.forceRefresh);
  const [{ catalog, status: catalogStatus }, { availability, status: availabilityStatus }] =
    await Promise.all([loadRemoteCatalog(forceRefresh), loadAvailability(forceRefresh)]);

  const availabilityKnown = Boolean(availability?.models.length);
  const status: CatalogStatus =
    availabilityStatus === 'fresh' || catalogStatus === 'fresh'
      ? 'fresh'
      : availabilityStatus === 'stale' || catalogStatus === 'stale'
        ? 'stale'
        : 'fallback';
  const allModels = mergeModels(catalog.models, availability?.models || []);
  const defaultModel = normalizeQuickActionModel(
    availability?.default || catalog.defaultQuickActionModel || DEFAULT_QUICK_ACTION_MODEL
  );
  const optionsList = buildOptions(
    allModels,
    catalog.quickActionModelOrder || [...QUICK_ACTION_FAST_MODEL_ORDER],
    availabilityKnown,
    status
  );

  return {
    options:
      optionsList.length > 0
        ? optionsList
        : buildOptions(
            fallbackCatalog().models,
            [...QUICK_ACTION_FAST_MODEL_ORDER],
            false,
            'fallback'
          ),
    allModels,
    defaultModel,
    status,
    statusMessage: statusMessage(status, availabilityKnown),
    availabilityKnown,
  };
}

export async function getEffectiveQuickActionModel(
  requestedModel?: string | null,
  options: { forceRefresh?: boolean; excludeModelIds?: string[] } = {}
): Promise<EffectiveQuickActionModel> {
  const requestedModelId = normalizeQuickActionModel(requestedModel);
  const state = await getQuickActionModelState({ forceRefresh: options.forceRefresh });
  const excluded = new Set(options.excludeModelIds || []);
  const availableModels = state.availabilityKnown
    ? state.allModels.filter((model) => model.available && !excluded.has(model.id))
    : state.allModels.filter((model) => !model.deprecated && !excluded.has(model.id));
  const availableIds = new Set(availableModels.map((model) => model.id));

  if (availableIds.has(requestedModelId)) {
    return {
      modelId: requestedModelId,
      requestedModelId,
      wasFallback: false,
      state,
    };
  }

  const fallbackOption = state.options.find((option) => !excluded.has(option.value));
  const fallbackModelId =
    fallbackOption?.value ||
    availableModels.find((model) => model.id === state.defaultModel)?.id ||
    availableModels[0]?.id ||
    DEFAULT_QUICK_ACTION_MODEL;

  return {
    modelId: fallbackModelId,
    requestedModelId,
    wasFallback: fallbackModelId !== requestedModelId,
    reason: state.availabilityKnown
      ? `Model ${requestedModelId} is not available from Copilot.`
      : `Model ${requestedModelId} is not in the cached catalog.`,
    state,
  };
}
