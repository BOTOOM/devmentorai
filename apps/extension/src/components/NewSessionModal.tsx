import type { SessionType } from '@devmentorai/shared';
import { SESSION_TYPE_CONFIGS } from '@devmentorai/shared';
import { X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface NewSessionModalProps {
  onClose: () => void;
  onSubmit: (name: string, type: SessionType) => Promise<void> | void;
}

export function NewSessionModal({ onClose, onSubmit }: Readonly<NewSessionModalProps>) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SessionType>('devops');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), type);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionTypes = Object.entries(SESSION_TYPE_CONFIGS) as [
    SessionType,
    (typeof SESSION_TYPE_CONFIGS)[SessionType],
  ][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Session</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close new session"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <label
              htmlFor="session-name"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Session Name
            </label>
            <input
              ref={nameInputRef}
              id="session-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., AWS Migration, Email Draft"
              className="input"
            />
          </div>
          <div>
            <p className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Session Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {sessionTypes.map(([typeKey, config]) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setType(typeKey)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors',
                    type === typeKey
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  )}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      type === typeKey
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white'
                    )}
                  >
                    {config.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Agent model and runtime settings are selected from ACP configuration options after the
            session starts.
          </p>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Session'}
          </button>
        </form>
      </div>
    </div>
  );
}
