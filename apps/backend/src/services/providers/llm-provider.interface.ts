import type { SessionEvent } from '@github/copilot-sdk';
import type {
  LLMProvider,
  Message,
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

export interface ProviderToolDefinition {
  name: string;
  description: string;
}

export interface ProviderToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface ProviderSessionRestoreData {
  sessionId: string;
  type: SessionType;
  model: string;
  systemPrompt?: string;
  messages: Message[];
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
  restoreSession(data: ProviderSessionRestoreData): Promise<boolean>;

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

  listAvailableTools?(type: SessionType): ProviderToolDefinition[];
  executeTool?(toolName: string, params: Record<string, unknown>): Promise<ProviderToolExecutionResult>;

  shutdown(): Promise<void>;
}
