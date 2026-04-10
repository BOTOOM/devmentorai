import type { ModelInfo, ReasoningEffort, Session } from '@devmentorai/shared';
import { Brain, Cpu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiClient } from '../services/api-client';
import { ReasoningEffortSelector } from './ReasoningEffortSelector';

interface ModelSwitchModalProps {
  session: Session;
  onClose: () => void;
  onModelSwitched: (updatedSession: Session) => void;
}

export function ModelSwitchModal({
  session,
  onClose,
  onModelSwitched,
}: Readonly<ModelSwitchModalProps>) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(session.model);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    session.reasoningEffort || 'medium'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = new ApiClient();

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await apiClient.getModels();
      if (response.success && response.data) {
        setModels(response.data.models);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  const selectedModelInfo = models.find((m) => m.id === selectedModel);
  const supportsReasoning =
    selectedModelInfo?.supportedReasoningEfforts &&
    selectedModelInfo.supportedReasoningEfforts.length > 0;
  const supportedReasoningEfforts = (selectedModelInfo?.supportedReasoningEfforts ||
    []) as ReasoningEffort[];
  const currentReasoningEffort = session.reasoningEffort ?? null;
  const selectedReasoningEffort = supportsReasoning ? reasoningEffort : null;
  const isUnchanged =
    selectedModel === session.model && selectedReasoningEffort === currentReasoningEffort;

  useEffect(() => {
    if (!selectedModelInfo?.supportedReasoningEfforts?.length) {
      return;
    }

    if (!selectedModelInfo.supportedReasoningEfforts.includes(reasoningEffort)) {
      setReasoningEffort(selectedModelInfo.supportedReasoningEfforts[0] as ReasoningEffort);
    }
  }, [selectedModelInfo, reasoningEffort]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.switchSessionModel(
        session.id,
        selectedModel,
        supportsReasoning ? reasoningEffort : undefined
      );

      if (response.success && response.data) {
        onModelSwitched(response.data);
        onClose();
      } else {
        setError(response.error?.message || 'Failed to switch model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Switch Model
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Current model: <span className="font-medium">{session.model}</span>
          {session.reasoningEffort && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Reasoning: {session.reasoningEffort}
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Model
            </p>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              {models.map((model) => (
                <label
                  key={model.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-3 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 ${
                    selectedModel === model.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={selectedModel === model.id}
                    onChange={() => setSelectedModel(model.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {model.name}
                      </span>
                      {model.supportedReasoningEfforts &&
                        model.supportedReasoningEfforts.length > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            <Brain className="w-3 h-3" />
                            Reasoning
                          </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {model.provider}
                      {model.pricingTier && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {model.pricingTier}
                        </span>
                      )}
                    </p>
                    {model.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {model.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {supportsReasoning && (
            <ReasoningEffortSelector
              value={reasoningEffort}
              supportedEfforts={supportedReasoningEfforts}
              onChange={setReasoningEffort}
            />
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isUnchanged}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isLoading ? 'Switching...' : 'Switch Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
