import { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SessionType } from '@devmentorai/shared';
import { SESSION_TYPE_CONFIGS, DEFAULT_CONFIG } from '@devmentorai/shared';
import { ApiClient } from '../services/api-client';

interface Model {
  id: string;
  name: string;
  description: string;
  provider: string;
  isDefault: boolean;
}

interface NewSessionModalProps {
  onClose: () => void;
  onSubmit: (name: string, type: SessionType, model?: string) => void;
}

export function NewSessionModal({ onClose, onSubmit }: NewSessionModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SessionType>('devops');
  const [model, setModel] = useState<string>('gpt-4.1');
  const [models, setModels] = useState<Model[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const apiClient = new ApiClient(`http://localhost:${DEFAULT_CONFIG.DEFAULT_PORT}`);
        const response = await apiClient.getModels();
        if (response.success && response.data) {
          setModels(response.data.models);
          setModel(response.data.default);
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

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), type, model);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionTypes = Object.entries(SESSION_TYPE_CONFIGS) as [SessionType, typeof SESSION_TYPE_CONFIGS[SessionType]][];
  const selectedModel = models.find(m => m.id === model);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {sessionTypes.map(([typeKey, config]) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setType(typeKey)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                    type === typeKey
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Model
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {selectedModel?.name || model}
                  </p>
                  {selectedModel && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedModel.description}
                    </p>
                  )}
                </div>
                <ChevronDown className={cn(
                  'w-5 h-5 text-gray-400 transition-transform',
                  showModelPicker && 'rotate-180'
                )} />
              </button>

              {showModelPicker && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModel(m.id);
                        setShowModelPicker(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                        model === m.id && 'bg-primary-50 dark:bg-primary-900/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {m.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {m.description}
                          </p>
                        </div>
                        {m.isDefault && (
                          <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {SESSION_TYPE_CONFIGS[type].description}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
