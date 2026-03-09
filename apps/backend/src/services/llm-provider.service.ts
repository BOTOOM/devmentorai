import type { SessionEvent } from '@github/copilot-sdk';
import type {
  LLMProvider,
  MessageContext,
  ModelInfo,
  ProviderAuthStatus,
  ProviderQuotaStatus,
  SessionType,
} from '@devmentorai/shared';
import { CopilotService } from './copilot.service.js';
import { CopilotProviderAdapter } from './providers/copilot.provider.js';
import type { ProviderAttachment } from './providers/llm-provider.interface.js';
import { ProviderRegistry } from './providers/provider-registry.js';

const FALLBACK_PROVIDER: LLMProvider = 'copilot';

export class LLMProviderService {
  private readonly registry = new ProviderRegistry();

  constructor(copilotService: CopilotService) {
    this.registry.register(new CopilotProviderAdapter(copilotService));
  }

  async initialize(): Promise<void> {
    const providers = this.registry.list();
    for (const provider of providers) {
      await provider.initialize();
    }
  }

  listRegisteredProviders(): LLMProvider[] {
    return this.registry.list().map((provider) => provider.id);
  }

  getProviderStates(): Record<string, { ready: boolean; mockMode: boolean }> {
    const states: Record<string, { ready: boolean; mockMode: boolean }> = {};
    for (const provider of this.registry.list()) {
      states[provider.id] = {
        ready: provider.isReady(),
        mockMode: provider.isMockMode(),
      };
    }
    return states;
  }

  private resolveProviderId(provider?: string): LLMProvider {
    if (!provider) return FALLBACK_PROVIDER;
    const normalized = provider as LLMProvider;
    if (this.registry.has(normalized)) return normalized;

    console.warn(`[LLMProviderService] Provider '${provider}' is not registered. Falling back to '${FALLBACK_PROVIDER}'.`);
    return FALLBACK_PROVIDER;
  }

  private getProvider(provider?: string) {
    const providerId = this.resolveProviderId(provider);
    const adapter = this.registry.get(providerId);

    if (!adapter) {
      throw new Error(`Provider '${providerId}' is not available`);
    }

    return adapter;
  }

  async createSession(
    sessionId: string,
    type: SessionType,
    model: string,
    provider?: string,
    systemPrompt?: string
  ): Promise<void> {
    await this.getProvider(provider).createSession(sessionId, type, model, systemPrompt);
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    nextProvider?: string,
    systemPrompt?: string,
    previousProvider?: string
  ): Promise<void> {
    const nextAdapter = this.getProvider(nextProvider);
    const previousAdapter = previousProvider ? this.getProvider(previousProvider) : nextAdapter;

    if (previousAdapter.id !== nextAdapter.id) {
      await previousAdapter.destroySession(sessionId);
      await nextAdapter.createSession(sessionId, type, model, systemPrompt);
      return;
    }

    await nextAdapter.switchSessionModel(sessionId, type, model, systemPrompt);
  }

  async resumeSession(
    sessionId: string,
    provider?: string
  ): Promise<boolean> {
    return this.getProvider(provider).resumeSession(sessionId);
  }

  async sendMessage(
    sessionId: string,
    provider: string | undefined,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    return this.getProvider(provider).sendMessage(sessionId, prompt, context, onEvent);
  }

  async streamMessage(
    sessionId: string,
    provider: string | undefined,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    attachments?: ProviderAttachment[]
  ): Promise<void> {
    await this.getProvider(provider).streamMessage(sessionId, prompt, context, onEvent, attachments);
  }

  async abortRequest(sessionId: string, provider?: string): Promise<void> {
    await this.getProvider(provider).abortRequest(sessionId);
  }

  async destroySession(sessionId: string, provider?: string): Promise<void> {
    await this.getProvider(provider).destroySession(sessionId);
  }

  async listModels(provider?: string): Promise<{ models: ModelInfo[]; default: string }> {
    if (provider) {
      return this.getProvider(provider).listModels();
    }

    const providers = this.registry.list();
    if (providers.length === 0) {
      return { models: [], default: 'gpt-4.1' };
    }

    const responses = await Promise.all(providers.map(async (currentProvider) => ({
      provider: currentProvider.id,
      payload: await currentProvider.listModels(),
    })));

    const allModels = responses.flatMap(({ provider: providerId, payload }) =>
      payload.models.map((model) => ({ ...model, provider: model.provider || providerId }))
    );

    const defaultModel =
      responses.find(({ provider: providerId }) => providerId === FALLBACK_PROVIDER)?.payload.default ||
      responses[0]?.payload.default ||
      'gpt-4.1';

    return {
      models: allModels,
      default: defaultModel,
    };
  }

  async getAuthStatus(provider?: string): Promise<ProviderAuthStatus> {
    return this.getProvider(provider).getAuthStatus();
  }

  async getQuota(provider?: string): Promise<ProviderQuotaStatus> {
    return this.getProvider(provider).getQuota();
  }

  isReady(provider?: string): boolean {
    return this.getProvider(provider).isReady();
  }

  isMockMode(provider?: string): boolean {
    return this.getProvider(provider).isMockMode();
  }

  async shutdown(): Promise<void> {
    for (const provider of this.registry.list()) {
      await provider.shutdown();
    }
  }
}
