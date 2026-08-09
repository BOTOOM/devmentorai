import type { AcpConfigOption, Session } from '@devmentorai/shared';
import { Settings, X } from 'lucide-react';
import { useState } from 'react';

interface ModelSwitchModalProps {
  session: Session;
  configOptions: AcpConfigOption[];
  onConfigOptionChange: (option: AcpConfigOption, value: string | boolean) => Promise<void>;
  onClose: () => void;
}

export function ModelSwitchModal({
  session,
  configOptions,
  onConfigOptionChange,
  onClose,
}: Readonly<ModelSwitchModalProps>) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (option: AcpConfigOption, value: string | boolean) => {
    setPending(option.id);
    setError(null);
    try {
      await onConfigOptionChange(option, value);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Failed to update option');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
            <Settings className="h-5 w-5" />
            Agent configuration
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Close configuration"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Configure options advertised by {session.agentId ?? 'the active ACP agent'}.
        </p>
        {configOptions.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            This agent does not advertise configurable session options.
          </p>
        ) : (
          <div className="space-y-4">
            {configOptions.map((option) => (
              <label className="block text-sm" key={option.id}>
                <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                  {option.name}
                </span>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={String(option.currentValue ?? '')}
                  disabled={pending === option.id}
                  onChange={(event) =>
                    void handleChange(
                      option,
                      option.type === 'boolean' ? event.target.value === 'true' : event.target.value
                    )
                  }
                >
                  {(option.options ?? []).map((candidate) => {
                    const value = String(candidate.value ?? candidate.id ?? '');
                    return (
                      <option key={value} value={value}>
                        {String(candidate.name ?? value)}
                      </option>
                    );
                  })}
                </select>
              </label>
            ))}
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-300"
        >
          Done
        </button>
      </div>
    </div>
  );
}
