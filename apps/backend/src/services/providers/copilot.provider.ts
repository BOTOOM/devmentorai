import type { SessionEvent } from '@github/copilot-sdk';
import type {
  MessageContext,
  ProviderAuthStatus,
  ProviderQuotaStatus,
  SessionType,
} from '@devmentorai/shared';
import { CopilotService } from '../copilot.service.js';
import type {
  LLMProviderAdapter,
  ProviderAttachment,
  ProviderSessionRestoreData,
  ProviderToolDefinition,
  ProviderToolExecutionResult,
} from './llm-provider.interface.js';

export class CopilotProviderAdapter implements LLMProviderAdapter {
  readonly id = 'copilot' as const;

  constructor(private readonly copilotService: CopilotService) {}

  async initialize(): Promise<void> {
    if (!this.copilotService.isReady()) {
      await this.copilotService.initialize();
    }
  }

  isReady(): boolean {
    return this.copilotService.isReady();
  }

  isMockMode(): boolean {
    return this.copilotService.isMockMode();
  }

  async createSession(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    await this.copilotService.createCopilotSession(sessionId, type, model, systemPrompt);
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    await this.copilotService.switchSessionModel(sessionId, type, model, systemPrompt);
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    return this.copilotService.resumeCopilotSession(sessionId);
  }

  async restoreSession(_data: ProviderSessionRestoreData): Promise<boolean> {
    return false;
  }

  async sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    return this.copilotService.sendMessage(sessionId, prompt, context, onEvent);
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    attachments?: ProviderAttachment[]
  ): Promise<void> {
    await this.copilotService.streamMessage(sessionId, prompt, context, onEvent, attachments);
  }

  async abortRequest(sessionId: string): Promise<void> {
    await this.copilotService.abortRequest(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.copilotService.destroySession(sessionId);
  }

  listModels() {
    return this.copilotService.listModels();
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    const status = await this.copilotService.getAuthStatus();
    return {
      provider: this.id,
      isAuthenticated: status.isAuthenticated,
      login: status.login,
      reason: status.reason,
    };
  }

  async getQuota(): Promise<ProviderQuotaStatus> {
    const quota = await this.copilotService.getQuota();
    return {
      provider: this.id,
      used: quota.used,
      included: quota.included,
      remaining: quota.remaining,
      percentageUsed: quota.percentageUsed,
      percentageRemaining: quota.percentageRemaining,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
      raw: quota.raw,
    };
  }

  listAvailableTools(type: SessionType): ProviderToolDefinition[] {
    return this.copilotService.getAvailableTools(type);
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ProviderToolExecutionResult> {
    return this.copilotService.executeTool(toolName, params);
  }

  async shutdown(): Promise<void> {
    await this.copilotService.shutdown();
  }
}
