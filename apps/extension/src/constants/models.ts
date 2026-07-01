export const DEFAULT_QUICK_ACTION_MODEL = 'gpt-5-mini';

export const GITHUB_COPILOT_ACCESS_PROVIDER = 'github-copilot';

export const REMOTE_MODEL_CATALOG_URL =
  'https://raw.githubusercontent.com/BOTOOM/devmentorai/model-catalog/catalogs/github-copilot-models.json';

const DEPRECATED_QUICK_ACTION_MODEL_REPLACEMENTS = new Map<string, string>([
  ['gpt-4.1', DEFAULT_QUICK_ACTION_MODEL],
  ['claude-3-5-haiku', 'claude-haiku-4.5'],
  ['claude-3-5-sonnet', 'claude-sonnet-4.5'],
]);

export const QUICK_ACTION_FAST_MODEL_ORDER = [
  DEFAULT_QUICK_ACTION_MODEL,
  'gpt-5.4-mini',
  'claude-haiku-4.5',
  'gemini-3.5-flash',
  'mai-code-1-flash',
] as const;

export const QUICK_ACTION_MODEL_OPTIONS = [
  { value: DEFAULT_QUICK_ACTION_MODEL, label: 'GPT-5 Mini (Fast, no reasoning)' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (Fast)' },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5 (Fast)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Fast)' },
  { value: 'mai-code-1-flash', label: 'MAI-Code-1-Flash (Fast)' },
] as const;

export const FALLBACK_MODEL_CATALOG = [
  {
    id: DEFAULT_QUICK_ACTION_MODEL,
    name: 'GPT-5 Mini',
    provider: 'openai',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isDefault: true,
    isRecommendedForQuickActions: true,
    pricingTier: 'free',
    description: 'Fast default model for quick text edits, translations, and rewrites.',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isRecommendedForQuickActions: true,
    pricingTier: 'cheap',
    description: 'Fast GPT-5.4 mini variant for lightweight editing tasks.',
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isRecommendedForQuickActions: true,
    pricingTier: 'cheap',
    description: 'Fast Claude model suited to simple writing transformations.',
    aliases: ['claude-3-5-haiku'],
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isRecommendedForQuickActions: true,
    pricingTier: 'cheap',
    description: 'Fast Gemini model for low-latency text operations.',
  },
  {
    id: 'mai-code-1-flash',
    name: 'MAI-Code-1-Flash',
    provider: 'microsoft',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isRecommendedForQuickActions: true,
    pricingTier: 'cheap',
    description: 'Fast MAI model for lightweight coding and text assistance.',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    provider: 'openai',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'premium',
    description: 'Heavier general-purpose GPT model.',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    isDefault: false,
    pricingTier: 'standard',
    description: 'Default general-purpose GPT model in some Copilot plans.',
  },
  {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3-Codex',
    provider: 'openai',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'standard',
    description: 'Coding-focused GPT model.',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'standard',
    description: 'General-purpose Claude Sonnet model.',
  },
  {
    id: 'claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'standard',
    description: 'Claude Sonnet 4.6 model.',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'standard',
    description: 'Claude Sonnet 4.5 model.',
    aliases: ['claude-3-5-sonnet'],
  },
  {
    id: 'claude-opus-4.8-fast',
    name: 'Claude Opus 4.8 (fast mode)',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'premium',
    description: 'Fast preview mode for Claude Opus 4.8.',
  },
  {
    id: 'claude-opus-4.8',
    name: 'Claude Opus 4.8',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'premium',
    description: 'High-capability Claude Opus model.',
  },
  {
    id: 'claude-opus-4.7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'premium',
    description: 'High-capability Claude Opus model.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'google',
    accessProvider: GITHUB_COPILOT_ACCESS_PROVIDER,
    available: true,
    pricingTier: 'premium',
    description: 'Preview Gemini Pro model.',
  },
] satisfies Array<{
  id: string;
  name: string;
  provider: string;
  accessProvider: string;
  available: boolean;
  isDefault?: boolean;
  isRecommendedForQuickActions?: boolean;
  pricingTier: 'free' | 'cheap' | 'standard' | 'premium';
  description: string;
  aliases?: string[];
}>;

export function normalizeQuickActionModel(model?: string | null): string {
  const normalizedModel = model?.trim();

  if (!normalizedModel) {
    return DEFAULT_QUICK_ACTION_MODEL;
  }

  return DEPRECATED_QUICK_ACTION_MODEL_REPLACEMENTS.get(normalizedModel) || normalizedModel;
}
