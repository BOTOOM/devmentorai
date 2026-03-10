import type { SessionEvent } from '@github/copilot-sdk';
import type {
  LLMProvider,
  MessageContext,
  ModelInfo,
  ProviderAuthStatus,
  ProviderQuotaStatus,
  SessionType,
} from '@devmentorai/shared';
import type { LLMProviderAdapter, ProviderAttachment } from './llm-provider.interface.js';

// ---------------------------------------------------------------------------
// Types for the OpenAI-compatible chat completions API used by Ollama &
// LM Studio (and any other server that exposes the same contract).
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string | null;
}

interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
}

interface StreamDelta {
  role?: string;
  content?: string;
}

interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: string | null;
}

interface StreamChunk {
  id: string;
  choices: StreamChoice[];
}

interface OllamaModelEntry {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
}

interface OpenAIModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OpenAICompatibleProviderOptions {
  id: LLMProvider;
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  /** If true, fetch models from /api/tags (Ollama). Otherwise /v1/models. */
  useOllamaModelEndpoint?: boolean;
  /** Static fallback models if the server is unreachable during init. */
  fallbackModels?: ModelInfo[];
}

interface SessionState {
  type: SessionType;
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class OpenAICompatibleProviderAdapter implements LLMProviderAdapter {
  readonly id: LLMProvider;

  private readonly displayName: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly useOllamaModelEndpoint: boolean;
  private readonly fallbackModels: ModelInfo[];

  private ready = false;
  private discoveredModels: ModelInfo[] = [];
  private readonly sessions = new Map<string, SessionState>();
  private readonly runningAbortControllers = new Map<string, AbortController>();

  constructor(options: OpenAICompatibleProviderOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultModel = options.defaultModel;
    this.useOllamaModelEndpoint = options.useOllamaModelEndpoint ?? false;
    this.fallbackModels = options.fallbackModels ?? [];
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    try {
      const models = await this.fetchModels();
      this.discoveredModels = models;
      this.ready = models.length > 0;
      console.log(
        `[${this.id}] Initialized – ${models.length} model(s) discovered, ready=${this.ready}`
      );
    } catch (error) {
      console.warn(
        `[${this.id}] Server at ${this.baseUrl} unreachable during init:`,
        error instanceof Error ? error.message : error
      );
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  isMockMode(): boolean {
    return !this.ready;
  }

  async shutdown(): Promise<void> {
    for (const controller of this.runningAbortControllers.values()) {
      controller.abort();
    }
    this.runningAbortControllers.clear();
    this.sessions.clear();
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  async createSession(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    this.ensureReady();
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    this.sessions.set(sessionId, { type, model, systemPrompt, messages });
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    this.ensureReady();
    const existing = this.sessions.get(sessionId);
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    this.sessions.set(sessionId, {
      type,
      model,
      systemPrompt,
      messages: existing?.messages ?? messages,
    });
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.abortRequest(sessionId);
    this.sessions.delete(sessionId);
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  async sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    this.ensureReady();
    const session = this.getSession(sessionId);
    const userContent = this.buildUserContent(prompt, context);

    session.messages.push({ role: 'user', content: userContent });

    const body = {
      model: session.model,
      messages: session.messages,
      stream: false,
    };

    const response = await this.post<ChatCompletionResponse>(
      '/v1/chat/completions',
      body,
      sessionId
    );

    const assistantContent = response.choices?.[0]?.message?.content ?? '';
    session.messages.push({ role: 'assistant', content: assistantContent });

    if (onEvent) {
      onEvent({ type: 'assistant.message', data: { content: assistantContent } } as SessionEvent);
      onEvent({ type: 'session.idle', data: {} } as SessionEvent);
    }

    return assistantContent;
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    _attachments?: ProviderAttachment[]
  ): Promise<void> {
    this.ensureReady();
    const session = this.getSession(sessionId);
    const userContent = this.buildUserContent(prompt, context);
    session.messages.push({ role: 'user', content: userContent });

    const body = {
      model: session.model,
      messages: session.messages,
      stream: true,
    };

    const controller = new AbortController();
    this.runningAbortControllers.set(sessionId, controller);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `[${this.id}] HTTP ${response.status}: ${await response.text()}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(`[${this.id}] No response body for streaming`);
      }

      const fullContent = await this.readSSEStream(reader, onEvent);
      session.messages.push({ role: 'assistant', content: fullContent });

      onEvent?.({
        type: 'assistant.message',
        data: { content: fullContent },
      } as SessionEvent);
      onEvent?.({ type: 'session.idle', data: {} } as SessionEvent);
    } finally {
      this.runningAbortControllers.delete(sessionId);
    }
  }

  private async readSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const delta = this.parseSSELine(line);
        if (delta) {
          fullContent += delta;
          onEvent?.({
            type: 'assistant.message_delta',
            data: { deltaContent: delta },
          } as SessionEvent);
        }
      }
    }

    return fullContent;
  }

  private parseSSELine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed?.startsWith('data:')) return null;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return null;

    try {
      const chunk = JSON.parse(payload) as StreamChunk;
      return chunk.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }

  async abortRequest(sessionId: string): Promise<void> {
    const controller = this.runningAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.runningAbortControllers.delete(sessionId);
    }
  }

  // -------------------------------------------------------------------------
  // Models
  // -------------------------------------------------------------------------

  async listModels(): Promise<{ models: ModelInfo[]; default: string }> {
    // Try to refresh models from server
    try {
      const fresh = await this.fetchModels();
      if (fresh.length > 0) {
        this.discoveredModels = fresh;
        this.ready = true;
      }
    } catch {
      // Keep cached models
    }

    const models =
      this.discoveredModels.length > 0
        ? this.discoveredModels
        : this.fallbackModels.map((m) => ({ ...m, available: false }));

    return {
      models: models.map((m) => ({ ...m, provider: this.id })),
      default: this.defaultModel,
    };
  }

  // -------------------------------------------------------------------------
  // Auth & Quota
  // -------------------------------------------------------------------------

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    return {
      provider: this.id,
      isAuthenticated: this.ready,
      reason: this.ready
        ? `${this.displayName} server is running at ${this.baseUrl}`
        : `${this.displayName} server is not reachable at ${this.baseUrl}. Start the server first.`,
    };
  }

  async getQuota(): Promise<ProviderQuotaStatus> {
    return {
      provider: this.id,
      used: null,
      included: null,
      remaining: null,
      percentageUsed: null,
      percentageRemaining: null,
      periodStart: null,
      periodEnd: null,
      raw: { mode: 'local-server', baseUrl: this.baseUrl },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getSession(sessionId: string): SessionState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(
        `[${this.id}] Session '${sessionId}' not found. Create a session first.`
      );
    }
    return session;
  }

  private ensureReady(): void {
    if (this.ready) return;
    throw new Error(
      `[${this.id}] Provider unavailable. Ensure ${this.displayName} is running at ${this.baseUrl}.`
    );
  }

  private buildUserContent(prompt: string, context?: MessageContext): string {
    if (!context) return prompt;

    const parts: string[] = [];
    if (context.pageUrl) parts.push(`Page URL: ${context.pageUrl}`);
    if (context.pageTitle) parts.push(`Page Title: ${context.pageTitle}`);
    if (context.selectedText) parts.push(`Selected Text: ${context.selectedText}`);
    if (context.action) parts.push(`Action: ${context.action}`);

    if (parts.length === 0) return prompt;
    return `${parts.join('\n')}\n\n${prompt}`;
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    sessionId?: string
  ): Promise<T> {
    const controller = new AbortController();
    if (sessionId) {
      this.runningAbortControllers.set(sessionId, controller);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`[${this.id}] HTTP ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } finally {
      if (sessionId) {
        this.runningAbortControllers.delete(sessionId);
      }
    }
  }

  private async fetchModels(): Promise<ModelInfo[]> {
    if (this.useOllamaModelEndpoint) {
      return this.fetchOllamaModels();
    }
    return this.fetchOpenAIModels();
  }

  private async fetchOllamaModels(): Promise<ModelInfo[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { models?: OllamaModelEntry[] };
      const models = data.models ?? [];

      return models.map((entry): ModelInfo => ({
        id: entry.name,
        name: entry.name.replace(/:latest$/, ''),
        provider: this.id,
        available: true,
        description: `Ollama model – ${this.formatSize(entry.size)}`,
        pricingTier: 'free',
        pricingMultiplier: 0,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchOpenAIModels(): Promise<ModelInfo[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { data?: OpenAIModelEntry[] };
      const models = data.data ?? [];

      return models.map((entry): ModelInfo => ({
        id: entry.id,
        name: entry.id,
        provider: this.id,
        available: true,
        description: `${this.displayName} model`,
        pricingTier: 'free',
        pricingMultiplier: 0,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatSize(bytes?: number): string {
    if (!bytes) return 'unknown size';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }
}
