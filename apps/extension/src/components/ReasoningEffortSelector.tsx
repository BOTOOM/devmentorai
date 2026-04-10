import { cn } from '../lib/utils';

export type ReasoningEffortLevel = 'low' | 'medium' | 'high';

interface ReasoningEffortSelectorProps {
  value: ReasoningEffortLevel;
  supportedEfforts: ReasoningEffortLevel[];
  onChange: (effort: ReasoningEffortLevel) => void;
  title?: string;
  helperText?: string;
}

export function ReasoningEffortSelector({
  value,
  supportedEfforts,
  onChange,
  title = 'Reasoning Effort',
  helperText = 'Higher effort = more thorough reasoning, slower responses',
}: Readonly<ReasoningEffortSelectorProps>) {
  if (supportedEfforts.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      <div className="flex gap-2">
        {supportedEfforts.map((effort) => (
          <button
            key={effort}
            type="button"
            onClick={() => onChange(effort)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium capitalize transition-colors',
              value === effort
                ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            {effort}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    </div>
  );
}
