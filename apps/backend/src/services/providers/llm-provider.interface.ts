import type { SessionEvent } from '@github/copilot-sdk';
import type {
  LLMProvider,
  MessageContext,
  ModelInfo,
  ProviderAuthStatus,
  ProviderQuotaStatus,
  SessionType,
} from '@devmentorai/shared';

export interface ProviderAttachment {
  type: 'file' | 'directory';
  path: string;
  displayName?: string;
}

export interface LLMProviderAdapter {
  readonly id: LLMProvider;
  initialize(): Promise<void>;
  isReady(): boolean;
  isMockMode(): boolean;

  createSession(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void>;

  switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void>;

  resumeSession(sessionId: string): Promise<boolean>;

  sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string>;

  streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    attachments?: ProviderAttachment[]
  ): Promise<void>;

  abortRequest(sessionId: string): Promise<void>;
  destroySession(sessionId: string): Promise<void>;

  listModels(): Promise<{ models: ModelInfo[]; default: string }>;
  getAuthStatus(): Promise<ProviderAuthStatus>;
  getQuota(): Promise<ProviderQuotaStatus>;

  shutdown(): Promise<void>;
}
