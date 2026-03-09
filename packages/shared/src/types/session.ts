/**
 * Session type definitions for DevMentorAI
 */

export type SessionType = 'devops' | 'writing' | 'development' | 'general';

export type SessionStatus = 'active' | 'paused' | 'closed';

export const SUPPORTED_LLM_PROVIDERS = [
  'copilot',
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
