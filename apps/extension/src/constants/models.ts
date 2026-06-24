export const DEFAULT_QUICK_ACTION_MODEL = 'gpt-5-mini';

const DEPRECATED_QUICK_ACTION_MODELS = new Set(['gpt-4.1']);

export const QUICK_ACTION_MODEL_OPTIONS = [
  { value: DEFAULT_QUICK_ACTION_MODEL, label: 'GPT-5 Mini (Fast, no reasoning)' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku (Fast)' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
] as const;

export function normalizeQuickActionModel(model?: string | null): string {
  const normalizedModel = model?.trim();

  if (!normalizedModel || DEPRECATED_QUICK_ACTION_MODELS.has(normalizedModel)) {
    return DEFAULT_QUICK_ACTION_MODEL;
  }

  return normalizedModel;
}
