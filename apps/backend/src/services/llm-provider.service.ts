import type { SessionEvent } from '@github/copilot-sdk';
import type {
  LLMProvider,
  Message,
  MessageContext,
  ModelInfo,
  ProviderAuthStatus,
  ProviderQuotaStatus,
  Session,
  SessionType,
} from '@devmentorai/shared';
import { CopilotService } from './copilot.service.js';
import { ProviderCredentialService } from './credential.service.js';
import { CopilotProviderAdapter } from './providers/copilot.provider.js';
import { CliCommandProviderAdapter } from './providers/cli-command.provider.js';
import { OpenAICompatibleProviderAdapter } from './providers/openai-compatible.provider.js';
import type { ProviderAttachment } from './providers/llm-provider.interface.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { SessionService } from './session.service.js';

const FALLBACK_PROVIDER: LLMProvider = 'copilot';

const CLI_PROVIDER_MODELS: Record<'gemini-cli' | 'claude-code' | 'kilo-code', ModelInfo[]> = {
  'gemini-cli': [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'gemini-cli',
      available: false,
      description: 'Google Gemini CLI default model',
      pricingTier: 'free',
      pricingMultiplier: 0,
      supportsVision: false,
      supportsAttachments: false,
    },
  ],
  'claude-code': [
    {
      id: 'claude-sonnet-4',
      name: 'Claude Sonnet 4',
      provider: 'claude-code',
      available: false,
      description: 'Claude Code default model',
      pricingTier: 'standard',
      pricingMultiplier: 1,
      supportsVision: false,
      supportsAttachments: false,
    },
  ],
  'kilo-code': [
    {
      id: 'kilo-default',
      name: 'Kilo Default',
      provider: 'kilo-code',
      available: false,
      description: 'Kilo Code default model',
      pricingTier: 'standard',
      pricingMultiplier: 1,
      supportsVision: false,
      supportsAttachments: false,
    },
  ],
};

const OPENROUTER_FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    provider: 'openrouter',
    available: false,
    description: 'Routes requests to an available free model on OpenRouter',
    pricingTier: 'free',
    pricingMultiplier: 0,
    supportsVision: true,
    supportsAttachments: true,
  },
];

const GROQ_FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    available: false,
    description: 'Fast Groq-hosted open model',
    pricingTier: 'free',
    pricingMultiplier: 0,
    supportsVision: false,
    supportsAttachments: false,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    available: false,
    description: 'Higher quality Groq-hosted open model',
    pricingTier: 'free',
    pricingMultiplier: 0,
    supportsVision: false,
    supportsAttachments: false,
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B 32K',
    provider: 'groq',
    available: false,
    description: 'Legacy Groq-hosted Mixtral model',
    pricingTier: 'free',
    pricingMultiplier: 0,
    supportsVision: false,
    supportsAttachments: false,
  },
];

export class ProviderNotRegisteredError extends Error {
  readonly code = 'PROVIDER_NOT_REGISTERED';

  constructor(
    readonly provider: string,
    readonly registeredProviders: LLMProvider[]
  ) {
    super(
      `Provider '${provider}' is not registered. Registered providers: ${
        registeredProviders.length > 0 ? registeredProviders.join(', ') : 'none'
      }`
    );
    this.name = 'ProviderNotRegisteredError';
  }
}

export class LLMProviderService {
  private readonly registry = new ProviderRegistry();

  constructor(
    copilotService: CopilotService,
    private readonly sessionService: SessionService,
    private readonly providerCredentialService: ProviderCredentialService
  ) {
    this.registry.register(new CopilotProviderAdapter(copilotService));
    this.registry.register(
      new OpenAICompatibleProviderAdapter({
        id: 'openrouter',
        displayName: 'OpenRouter',
        baseUrl: process.env.DEVMENTORAI_OPENROUTER_BASE_URL || 'https://openrouter.ai/api',
        defaultModel: 'openrouter/free',
        useOllamaModelEndpoint: false,
        fallbackModels: OPENROUTER_FALLBACK_MODELS,
        requiresCredential: true,
        apiKeyProvider: () => this.providerCredentialService.getCredential('openrouter'),
        staticHeaders: {
          'HTTP-Referer': 'https://github.com/BOTOOM/devmentorai',
          'X-Title': 'DevMentorAI',
        },
      })
    );
    this.registry.register(
      new OpenAICompatibleProviderAdapter({
        id: 'groq',
        displayName: 'Groq',
        baseUrl: process.env.DEVMENTORAI_GROQ_BASE_URL || 'https://api.groq.com/openai',
        defaultModel: 'llama-3.1-8b-instant',
        useOllamaModelEndpoint: false,
        fallbackModels: GROQ_FALLBACK_MODELS,
        requiresCredential: true,
        apiKeyProvider: () => this.providerCredentialService.getCredential('groq'),
      })
    );
    this.registry.register(
      new CliCommandProviderAdapter({
        id: 'gemini-cli',
        command: process.env.DEVMENTORAI_GEMINI_CLI_COMMAND || 'gemini',
        displayName: 'Gemini CLI',
        defaultModel: 'gemini-2.5-pro',
        models: CLI_PROVIDER_MODELS['gemini-cli'],
      })
    );
    this.registry.register(
      new CliCommandProviderAdapter({
        id: 'claude-code',
        command: process.env.DEVMENTORAI_CLAUDE_CODE_COMMAND || 'claude',
        displayName: 'Claude Code',
        defaultModel: 'claude-sonnet-4',
        models: CLI_PROVIDER_MODELS['claude-code'],
      })
    );
    this.registry.register(
      new CliCommandProviderAdapter({
        id: 'kilo-code',
        command: process.env.DEVMENTORAI_KILO_CODE_COMMAND || 'kilo',
        displayName: 'Kilo Code',
        defaultModel: 'kilo-default',
        models: CLI_PROVIDER_MODELS['kilo-code'],
      })
    );
    this.registry.register(
      new OpenAICompatibleProviderAdapter({
        id: 'ollama',
        displayName: 'Ollama',
        baseUrl: process.env.DEVMENTORAI_OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultModel: 'llama3.2',
        useOllamaModelEndpoint: true,
        fallbackModels: [
          {
            id: 'llama3.2',
            name: 'Llama 3.2',
            provider: 'ollama',
            available: false,
            description: 'Meta Llama 3.2 – pull with: ollama pull llama3.2',
            pricingTier: 'free',
            pricingMultiplier: 0,
            supportsVision: false,
            supportsAttachments: false,
          },
        ],
      })
    );
    this.registry.register(
      new OpenAICompatibleProviderAdapter({
        id: 'lmstudio',
        displayName: 'LM Studio',
        baseUrl: process.env.DEVMENTORAI_LMSTUDIO_BASE_URL || 'http://localhost:1234',
        defaultModel: 'default',
        useOllamaModelEndpoint: false,
        fallbackModels: [
          {
            id: 'default',
            name: 'LM Studio Model',
            provider: 'lmstudio',
            available: false,
            description: 'Load a model in LM Studio and start the local server',
            pricingTier: 'free',
            pricingMultiplier: 0,
            supportsVision: false,
            supportsAttachments: false,
          },
        ],
      })
    );
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

  isProviderRegistered(provider: string): boolean {
    return this.registry.has(provider as LLMProvider);
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

    throw new ProviderNotRegisteredError(provider, this.listRegisteredProviders());
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
      const messages = this.sessionService.listAllMessages(sessionId);
      const restored = await nextAdapter.restoreSession({
        sessionId,
        type,
        model,
        systemPrompt,
        messages,
      });

      if (!restored) {
        await nextAdapter.createSession(sessionId, type, model, systemPrompt);
      }

      try {
        await previousAdapter.destroySession(sessionId);
      } catch (error) {
        await nextAdapter.destroySession(sessionId).catch(() => undefined);
        throw error;
      }
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

  async restoreSession(
    session: Session,
    messages?: Message[]
  ): Promise<boolean> {
    const adapter = this.getProvider(session.provider);
    return adapter.restoreSession({
      sessionId: session.id,
      type: session.type,
      model: session.model,
      systemPrompt: session.systemPrompt,
      messages: messages ?? this.sessionService.listAllMessages(session.id),
    });
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
      const adapter = this.getProvider(provider);
      const result = await adapter.listModels();
      return {
        ...result,
        models: result.models.map((model) => ({ ...model, provider: adapter.id })),
      };
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
      payload.models.map((model) => ({ ...model, provider: providerId }))
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

  listAvailableTools(type: SessionType, provider?: string): Array<{ name: string; description: string }> {
    const adapter = this.getProvider(provider);
    if (!adapter.listAvailableTools) {
      return [];
    }

    return adapter.listAvailableTools(type);
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    provider?: string
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const adapter = this.getProvider(provider);
    if (!adapter.executeTool) {
      return {
        success: false,
        error: `Provider '${adapter.id}' does not support direct tool execution`,
      };
    }

    return adapter.executeTool(toolName, params);
  }

  isReady(provider?: string): boolean {
    return this.getProvider(provider).isReady();
  }

  isMockMode(provider?: string): boolean {
    return this.getProvider(provider).isMockMode();
  }

  async reinitializeProvider(providerId: string): Promise<{ ready: boolean; mockMode: boolean }> {
    const adapter = this.getProvider(providerId);
    await adapter.initialize();
    return {
      ready: adapter.isReady(),
      mockMode: adapter.isMockMode(),
    };
  }

  async shutdown(): Promise<void> {
    for (const provider of this.registry.list()) {
      await provider.shutdown();
    }
  }
}
