import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SessionType } from '@devmentorai/shared';
import { SESSION_TYPE_CONFIGS } from '@devmentorai/shared';

interface NewSessionModalProps {
  onClose: () => void;
  onSubmit: (name: string, type: SessionType) => void;
}

export function NewSessionModal({ onClose, onSubmit }: NewSessionModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SessionType>('devops');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), type);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionTypes = Object.entries(SESSION_TYPE_CONFIGS) as [SessionType, typeof SESSION_TYPE_CONFIGS[SessionType]][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl">
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
