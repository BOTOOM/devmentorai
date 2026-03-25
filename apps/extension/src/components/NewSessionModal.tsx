import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  SESSION_TYPE_CONFIGS,
  SUPPORTED_LLM_PROVIDERS,
  PROVIDER_DISPLAY,
  type SessionType,
  type ModelInfo,
  type LLMProvider,
} from '@devmentorai/shared';
import { ApiClient } from '../services/api-client';

// D.5 - Pricing tier display
const PRICING_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cheap: { label: 'Cheap', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  standard: { label: 'Standard', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  premium: { label: 'Premium', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

interface NewSessionModalProps {
  onClose: () => void;
  onSubmit: (name: string, type: SessionType, model?: string, provider?: LLMProvider) => Promise<void> | void;
}

export function NewSessionModal({ onClose, onSubmit }: Readonly<NewSessionModalProps>) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SessionType>('devops');
  const [model, setModel] = useState<string>('gpt-4.1');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [collapsedProviders, setCollapsedProviders] = useState<Partial<Record<LLMProvider, boolean>>>({});
  const [providerFilter, setProviderFilter] = useState<LLMProvider | 'all'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const apiClient = ApiClient.getInstance();
        const response = await apiClient.getModels();
        const modelsData = response.success ? response.data : undefined;
        if (modelsData) {
          setModels(modelsData.models);

          const defaultModel = modelsData.models.find((item) => item.id === modelsData.default);
          const firstAvailableModel = modelsData.models.find((item) => item.available !== false);
          const preferredModel =
            defaultModel && defaultModel.available !== false
              ? defaultModel
              : firstAvailableModel;

          setModel(preferredModel?.id || modelsData.default);
          if (
            preferredModel?.provider &&
            SUPPORTED_LLM_PROVIDERS.includes(preferredModel.provider as LLMProvider)
          ) {
            setProviderFilter(preferredModel.provider as LLMProvider);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setSubmitError(null);

    const maybeProvider = selectedModel?.provider;
    const provider =
      maybeProvider &&
      SUPPORTED_LLM_PROVIDERS.includes(maybeProvider as LLMProvider)
        ? (maybeProvider as LLMProvider)
        : undefined;

    if (selectedModel?.available === false) {
      setSubmitError(
        `Model '${selectedModel.name}' is not available right now. Install/login the provider CLI or choose another model.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), type, model, provider);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionTypes = Object.entries(SESSION_TYPE_CONFIGS) as [SessionType, typeof SESSION_TYPE_CONFIGS[SessionType]][];
  const selectedModel = models.find(m => m.id === model);
  const selectedProviderId = selectedModel?.provider;
  const normalizedQuery = modelSearch.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const filteredModels = normalizedQuery
    ? models.filter((modelItem) => {
        const searchSource = [
          modelItem.id,
          modelItem.name,
          modelItem.provider,
          modelItem.description || '',
        ]
          .join(' ')
          .toLowerCase();
        return searchSource.includes(normalizedQuery);
      })
    : models;
  const availableFilteredModels = filteredModels.filter((modelItem) => modelItem.available !== false);
  const providerOptions = SUPPORTED_LLM_PROVIDERS.map((providerId) => {
    const totalCount = filteredModels.filter((modelItem) => modelItem.provider === providerId).length;
    const availableCount = availableFilteredModels.filter((modelItem) => modelItem.provider === providerId).length;

    return {
      providerId,
      display: PROVIDER_DISPLAY[providerId],
      totalCount,
      availableCount,
    };
  }).filter((option) => option.availableCount > 0 || (option.totalCount > 0 && providerFilter === option.providerId));
  const scopedAvailableModels = providerFilter === 'all'
    ? availableFilteredModels
    : availableFilteredModels.filter((modelItem) => modelItem.provider === providerFilter);

  const isProviderCollapsed = (providerId: LLMProvider): boolean => {
    if (isSearching) {
      return false;
    }

    const storedValue = collapsedProviders[providerId];
    if (typeof storedValue === 'boolean') {
      return storedValue;
    }

    return providerId !== selectedProviderId;
  };

  const toggleProvider = (providerId: LLMProvider) => {
    setCollapsedProviders((current) => ({
      ...current,
      [providerId]: !isProviderCollapsed(providerId),
    }));
  };

  useEffect(() => {
    if (selectedProviderId && !showModelPicker) {
      setProviderFilter(selectedProviderId as LLMProvider);
    }
  }, [selectedProviderId, showModelPicker]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative flex max-h-[88vh] w-full max-w-[390px] flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Session
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-3.5 overflow-y-auto p-4.5">
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Session name */}
          <div>
            <label
              htmlFor="session-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Session Name
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AWS Migration, Email Draft"
              className="input"
              autoFocus
            />
          </div>

          {/* Session type */}
          <div>
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Type
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {sessionTypes.map(([typeKey, config]) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setType(typeKey)}
                  className={cn(
                    'flex min-h-[58px] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                    type === typeKey
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900/40'
                  )}
                >
                  <span className="text-lg leading-none">{config.icon}</span>
                  <div className="min-w-0">
                    <p className={cn(
                      'font-medium text-[12px] leading-4',
                      type === typeKey
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {config.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div>
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Model
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {selectedModel?.name || model}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {selectedModel?.provider && (
                      <span className="truncate">
                        {PROVIDER_DISPLAY[selectedModel.provider as LLMProvider]?.name || selectedModel.provider}
                      </span>
                    )}
                    {selectedModel && (
                      <span className="truncate text-gray-400 dark:text-gray-500">
                        {selectedModel.description || selectedModel.id}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 text-gray-400 transition-transform shrink-0',
                  showModelPicker && 'rotate-180'
                )} />
              </button>

              {showModelPicker && (
                <div className="absolute top-full left-0 right-0 z-10 mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="sticky top-0 border-b border-gray-200 bg-white/95 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/95 backdrop-blur-sm">
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(event) => setModelSearch(event.target.value)}
                      placeholder="Search models..."
                      className="w-full px-2.5 py-2 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setProviderFilter('all')}
                        className={cn(
                          'rounded-full border px-2 py-1 text-[10px] font-medium transition-colors',
                          providerFilter === 'all'
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                        )}
                      >
                        All ready ({availableFilteredModels.length})
                      </button>

                      {providerOptions.map((option) => (
                        <button
                          key={option.providerId}
                          type="button"
                          onClick={() => {
                            setProviderFilter(option.providerId);
                            setCollapsedProviders((current) => ({
                              ...current,
                              [option.providerId]: false,
                            }));
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors',
                            providerFilter === option.providerId
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                          )}
                        >
                          <span aria-hidden>{option.display.icon}</span>
                          <span>{option.display.name}</span>
                          <span className="rounded-full bg-black/5 px-1 py-0.5 text-[9px] dark:bg-white/10">
                            {option.availableCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {availableFilteredModels.length === 0 && (
                    <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">No available models found</p>
                  )}

                  {providerFilter !== 'all' && scopedAvailableModels.length === 0 && (
                    <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                      No available models for {PROVIDER_DISPLAY[providerFilter]?.name || providerFilter} right now.
                    </div>
                  )}

                  {providerFilter !== 'all' && scopedAvailableModels.length > 0 && (
                    <div>
                      {scopedAvailableModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setModel(m.id);
                            setProviderFilter(m.provider as LLMProvider);
                            setShowModelPicker(false);
                            setModelSearch('');
                          }}
                          className={cn(
                            'w-full px-3.5 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700',
                            model === m.id && 'bg-primary-50 dark:bg-primary-900/20'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-[13px] text-gray-900 dark:text-white truncate">
                                {m.name}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {m.description || m.id}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                              {m.pricingTier && (
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full',
                                  PRICING_BADGES[m.pricingTier]?.color || PRICING_BADGES.standard.color
                                )}>
                                  {PRICING_BADGES[m.pricingTier]?.label || 'Standard'}
                                </span>
                              )}
                              {m.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Group models by provider */}
                  {providerFilter === 'all' && SUPPORTED_LLM_PROVIDERS.map(providerId => {
                    const providerModels = scopedAvailableModels.filter(m => m.provider === providerId);
                    if (providerModels.length === 0) return null;
                    const display = PROVIDER_DISPLAY[providerId];
                    const isCollapsed = providerFilter === 'all' ? isProviderCollapsed(providerId) : false;

                    return (
                      <div key={providerId}>
                        <button
                          type="button"
                          onClick={() => toggleProvider(providerId)}
                          className={cn(
                            'w-full px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/70',
                            'bg-gray-50 dark:bg-gray-900'
                          )}
                          disabled={providerFilter !== 'all'}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          )}
                          <span className="text-sm" aria-hidden>{display.icon}</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {display.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {providerModels.length}
                          </span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            Ready
                          </span>
                        </button>
                        {!isCollapsed && providerModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setModel(m.id);
                              setProviderFilter(m.provider as LLMProvider);
                              setShowModelPicker(false);
                              setModelSearch('');
                            }}
                            className={cn(
                              'w-full px-3.5 py-2 text-left transition-colors',
                              'hover:bg-gray-50 dark:hover:bg-gray-700',
                              model === m.id && 'bg-primary-50 dark:bg-primary-900/20'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-[13px] text-gray-900 dark:text-white truncate">
                                  {m.name}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                  {m.description || m.id}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                {m.pricingTier && (
                                  <span className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded-full',
                                    PRICING_BADGES[m.pricingTier]?.color || PRICING_BADGES.standard.color
                                  )}>
                                    {PRICING_BADGES[m.pricingTier]?.label || 'Standard'}
                                  </span>
                                )}
                                {m.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {SESSION_TYPE_CONFIGS[type].description}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className={cn(
                'flex-1 btn-primary',
                (!name.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
