/**
 * Session type definitions for DevMentorAI
 */

export type SessionType = 'devops' | 'writing' | 'development' | 'general';

export type SessionStatus = 'active' | 'paused' | 'closed';

export const SUPPORTED_LLM_PROVIDERS = [
  'copilot',
  'openrouter',
  'groq',
  'gemini-cli',
  'claude-code',
  'kilo-code',
  'ollama',
  'lmstudio',
  'bedrock',
  'vertex-ai',
  'azure-foundry',
] as const;

export type LLMProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];

export type ProviderCategory = 'cloud' | 'cli-agent' | 'local-server';

export interface ProviderDisplayConfig {
  name: string;
  icon: string;
  category: ProviderCategory;
  description: string;
}

export const PROVIDER_DISPLAY: Record<LLMProvider, ProviderDisplayConfig> = {
  copilot: {
    name: 'GitHub Copilot',
    icon: '🤖',
    category: 'cloud',
    description: 'GitHub Copilot via SDK – requires Copilot subscription',
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🛰️',
    category: 'cloud',
    description: 'OpenRouter – bring your own API key stored securely in the local backend',
  },
  groq: {
    name: 'Groq',
    icon: '🚀',
    category: 'cloud',
    description: 'Groq – bring your own API key stored securely in the local backend',
  },
  'gemini-cli': {
    name: 'Gemini CLI',
    icon: '💎',
    category: 'cli-agent',
    description: 'Google Gemini via local CLI – run: gemini login',
  },
  'claude-code': {
    name: 'Claude Code',
    icon: '🧠',
    category: 'cli-agent',
    description: 'Anthropic Claude via CLI – run: claude login',
  },
  'kilo-code': {
    name: 'Kilo Code',
    icon: '⚡',
    category: 'cli-agent',
    description: 'Kilo Code via CLI – run: kilo login',
  },
  ollama: {
    name: 'Ollama',
    icon: '🦙',
    category: 'local-server',
    description: 'Local LLM via Ollama – run: ollama serve',
  },
  lmstudio: {
    name: 'LM Studio',
    icon: '🔬',
    category: 'local-server',
    description: 'Local LLM via LM Studio – start server in app',
  },
  bedrock: {
    name: 'AWS Bedrock',
    icon: '☁️',
    category: 'cloud',
    description: 'AWS Bedrock – requires AWS credentials',
  },
  'vertex-ai': {
    name: 'Vertex AI',
    icon: '🔷',
    category: 'cloud',
    description: 'Google Vertex AI – requires GCP credentials',
  },
  'azure-foundry': {
    name: 'Azure AI Foundry',
    icon: '🔵',
    category: 'cloud',
    description: 'Azure AI Foundry – requires Azure credentials',
  },
};

export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  cloud: 'Cloud Providers',
  'cli-agent': 'CLI Agents',
  'local-server': 'Local Servers',
};

export const PROVIDER_CATEGORY_ORDER: ProviderCategory[] = [
  'cloud',
  'cli-agent',
  'local-server',
];

export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  attachments: boolean;
  reasoningEffort: boolean;
  conversationHistory: boolean;
}

export const PROVIDER_CAPABILITIES: Record<LLMProvider, ProviderCapabilities> = {
  copilot: {
    streaming: true,
    tools: true,
    vision: true,
    attachments: true,
    reasoningEffort: true,
    conversationHistory: true,
  },
  'gemini-cli': {
    streaming: false,
    tools: false,
    vision: false,
    attachments: false,
    reasoningEffort: false,
    conversationHistory: true,
  },
  'claude-code': {
    streaming: false,
    tools: false,
    vision: false,
    attachments: false,
    reasoningEffort: false,
    conversationHistory: true,
  },
  'kilo-code': {
    streaming: false,
    tools: false,
    vision: false,
    attachments: false,
    reasoningEffort: false,
    conversationHistory: true,
  },
  ollama: {
    streaming: true,
    tools: false,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  lmstudio: {
    streaming: true,
    tools: false,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  openrouter: {
    streaming: true,
    tools: false,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  groq: {
    streaming: true,
    tools: false,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  bedrock: {
    streaming: true,
    tools: true,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  'vertex-ai': {
    streaming: true,
    tools: true,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
  'azure-foundry': {
    streaming: true,
    tools: true,
    vision: true,
    attachments: true,
    reasoningEffort: false,
    conversationHistory: true,
  },
};

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  status: SessionStatus;
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  customAgent?: string;
  createdAt: string; // ISO date string
  updatedAt: string;
  messageCount: number;
  pageContext?: PageContext;
}

export interface PageContext {
  url: string;
  title: string;
  selectedText?: string;
}

export interface CreateSessionRequest {
  name: string;
  type: SessionType;
  provider?: LLMProvider;
  model?: string;
  systemPrompt?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  status?: SessionStatus;
  provider?: LLMProvider;
  model?: string;
}
