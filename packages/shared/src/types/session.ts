/**
 * Session type definitions for DevMentorAI
 */

export type SessionType = 'devops' | 'writing' | 'development' | 'general';

export type SessionStatus = 'active' | 'paused' | 'closed';

export type AssistantTone = 'concise' | 'friendly' | 'professional' | 'technical' | 'balanced';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  status: SessionStatus;
  model: string;
  systemPrompt?: string;
  customAgent?: string;
  /** Tone for AI assistant responses */
  tone?: AssistantTone;
  /** Whether to explain pros and cons in recommendations */
  explainTradeoffs?: boolean;
  /** Current reasoning effort level for supported models */
  reasoningEffort?: ReasoningEffort;
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
  model?: string;
  systemPrompt?: string;
  /** Tone for AI assistant responses */
  tone?: AssistantTone;
  /** Whether to explain pros and cons in recommendations */
  explainTradeoffs?: boolean;
  /** Reasoning effort level for supported models (o1, o3, etc.) */
  reasoningEffort?: ReasoningEffort;
}

export interface UpdateSessionRequest {
  name?: string;
  status?: SessionStatus;
  model?: string;
  /** Tone for AI assistant responses */
  tone?: AssistantTone;
  /** Whether to explain pros and cons in recommendations */
  explainTradeoffs?: boolean;
  /** Reasoning effort level for supported models (o1, o3, etc.) */
  reasoningEffort?: ReasoningEffort | null;
}
