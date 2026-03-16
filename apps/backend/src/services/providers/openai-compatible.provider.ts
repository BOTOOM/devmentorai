import fs from 'node:fs';
import path from 'node:path';
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
import type {
  LLMProviderAdapter,
  ProviderAttachment,
  ProviderSessionRestoreData,
} from './llm-provider.interface.js';

interface ChatTextPart {
  type: 'text';
  text: string;
}

interface ChatImagePart {
  type: 'image_url';
  image_url: { url: string };
}

type ChatMessageContent = string | Array<ChatTextPart | ChatImagePart>;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatMessageContent;
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

export interface OpenAICompatibleProviderOptions {
  id: LLMProvider;
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  useOllamaModelEndpoint?: boolean;
  fallbackModels?: ModelInfo[];
  requiresCredential?: boolean;
  apiKeyProvider?: () => string | null;
  staticHeaders?: Record<string, string>;
}

interface SessionState {
  type: SessionType;
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
}

const MAX_RECOVERY_MESSAGES = 16;
const MAX_RECOVERY_SUMMARY_CHARS = 4000;

export class OpenAICompatibleProviderAdapter implements LLMProviderAdapter {
  readonly id: LLMProvider;

  private readonly displayName: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly useOllamaModelEndpoint: boolean;
  private readonly fallbackModels: ModelInfo[];
  private readonly requiresCredential: boolean;
  private readonly apiKeyProvider?: () => string | null;
  private readonly staticHeaders: Record<string, string>;

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
    this.requiresCredential = options.requiresCredential ?? false;
    this.apiKeyProvider = options.apiKeyProvider;
    this.staticHeaders = options.staticHeaders ?? {};
  }

  async initialize(): Promise<void> {
    if (this.requiresCredential && !this.getApiKey()) {
      this.ready = false;
      this.discoveredModels = [];
      return;
    }

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
    const nextMessages =
      existing?.messages && existing.messages.length > 0
        ? existing.messages
        : systemPrompt
          ? [{ role: 'system', content: systemPrompt } satisfies ChatMessage]
          : [];
    this.sessions.set(sessionId, {
      type,
      model,
      systemPrompt,
      messages: nextMessages,
    });
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async restoreSession(data: ProviderSessionRestoreData): Promise<boolean> {
    this.ensureReady();
    this.sessions.set(data.sessionId, {
      type: data.type,
      model: data.model,
      systemPrompt: data.systemPrompt,
      messages: this.buildRecoveredMessages(data),
    });
    return true;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.abortRequest(sessionId);
    this.sessions.delete(sessionId);
  }

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

    const response = await this.post<ChatCompletionResponse>(
      '/v1/chat/completions',
      {
        model: session.model,
        messages: session.messages,
        stream: false,
      },
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
    attachments?: ProviderAttachment[]
  ): Promise<void> {
    this.ensureReady();
    const session = this.getSession(sessionId);
    const userContent = this.buildUserContent(prompt, context, attachments);
    session.messages.push({ role: 'user', content: userContent });

    const controller = new AbortController();
    this.runningAbortControllers.set(sessionId, controller);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getRequestHeaders(true),
        body: JSON.stringify({
          model: session.model,
          messages: session.messages,
          stream: true,
        }),
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

  async abortRequest(sessionId: string): Promise<void> {
    const controller = this.runningAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.runningAbortControllers.delete(sessionId);
    }
  }

  async listModels(): Promise<{ models: ModelInfo[]; default: string }> {
    if (!this.requiresCredential || this.getApiKey()) {
      try {
        const fresh = await this.fetchModels();
        if (fresh.length > 0) {
          this.discoveredModels = fresh;
          this.ready = true;
        }
      } catch {
        // Keep cached models
      }
    }

    const models =
      this.discoveredModels.length > 0
        ? this.discoveredModels
        : this.fallbackModels.map((model) => ({ ...model, available: false }));

    return {
      models: models.map((model) => ({ ...model, provider: this.id })),
      default: this.defaultModel,
    };
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    const credentialConfigured = !this.requiresCredential || Boolean(this.getApiKey());

    return {
      provider: this.id,
      isAuthenticated: credentialConfigured && this.ready,
      requiresCredential: this.requiresCredential,
      credentialConfigured,
      supportsNativeResume: false,
      sessionRecoveryMode: 'replay',
      reason: !credentialConfigured
        ? `Configure your ${this.displayName} API key in DevMentorAI settings.`
        : this.ready
          ? `${this.displayName} is ready at ${this.baseUrl}`
          : `${this.displayName} is not reachable at ${this.baseUrl}.`,
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
      raw: {
        mode: this.requiresCredential ? 'cloud-api' : 'local-server',
        baseUrl: this.baseUrl,
        requiresCredential: this.requiresCredential,
      },
    };
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
    if (!trimmed.startsWith('data:')) return null;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return null;

    try {
      const chunk = JSON.parse(payload) as StreamChunk;
      return chunk.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }

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
    const credentialConfigured = !this.requiresCredential || Boolean(this.getApiKey());
    if (this.ready && credentialConfigured) return;

    if (!credentialConfigured) {
      throw new Error(
        `[${this.id}] Provider unavailable. Configure your ${this.displayName} API key first.`
      );
    }

    throw new Error(
      `[${this.id}] Provider unavailable. Ensure ${this.displayName} is reachable at ${this.baseUrl}.`
    );
  }

  private getApiKey(): string | null {
    return this.apiKeyProvider?.() ?? null;
  }

  private buildUserContent(
    prompt: string,
    context?: MessageContext,
    attachments?: ProviderAttachment[]
  ): ChatMessageContent {
    const parts: string[] = [];
    if (context?.pageUrl) parts.push(`Page URL: ${context.pageUrl}`);
    if (context?.pageTitle) parts.push(`Page Title: ${context.pageTitle}`);
    if (context?.selectedText) parts.push(`Selected Text: ${context.selectedText}`);
    if (context?.action) parts.push(`Action: ${context.action}`);

    const promptText = parts.length > 0 ? `${parts.join('\n')}\n\n${prompt}` : prompt;
    if (!attachments || attachments.length === 0) {
      return promptText;
    }

    const imageParts = attachments
      .map((attachment) => this.attachmentToImagePart(attachment))
      .filter((value): value is ChatImagePart => value !== null);

    if (imageParts.length === 0) {
      return promptText;
    }

    return [{ type: 'text', text: promptText }, ...imageParts];
  }

  private attachmentToImagePart(attachment: ProviderAttachment): ChatImagePart | null {
    try {
      const fileBuffer = fs.readFileSync(attachment.path);
      const mimeType = this.inferMimeType(attachment.path);
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
        },
      };
    } catch (error) {
      console.warn(
        `[${this.id}] Failed to attach file '${attachment.path}':`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  private inferMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  private async post<T>(
    pathValue: string,
    body: Record<string, unknown>,
    sessionId?: string
  ): Promise<T> {
    const controller = new AbortController();
    if (sessionId) {
      this.runningAbortControllers.set(sessionId, controller);
    }

    try {
      const response = await fetch(`${this.baseUrl}${pathValue}`, {
        method: 'POST',
        headers: this.getRequestHeaders(true),
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

  private getRequestHeaders(includeContentType: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.staticHeaders,
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    const apiKey = this.getApiKey();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private async fetchModels(): Promise<ModelInfo[]> {
    if (this.requiresCredential && !this.getApiKey()) {
      return [];
    }

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
        headers: this.getRequestHeaders(false),
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { models?: OllamaModelEntry[] };
      const models = data.models ?? [];

      return models.map((entry): ModelInfo => {
        const supportsVision = this.inferVisionSupport(entry.name);
        return {
          id: entry.name,
          name: entry.name.replace(/:latest$/, ''),
          provider: this.id,
          available: true,
          description: `Ollama model – ${this.formatSize(entry.size)}`,
          pricingTier: 'free',
          pricingMultiplier: 0,
          supportsVision,
          supportsAttachments: supportsVision,
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchOpenAIModels(): Promise<ModelInfo[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getRequestHeaders(false),
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { data?: OpenAIModelEntry[] };
      const models = data.data ?? [];

      return models.map((entry): ModelInfo => {
        const supportsVision = this.inferVisionSupport(entry.id);
        return {
          id: entry.id,
          name: entry.id,
          provider: this.id,
          available: true,
          description: `${this.displayName} model`,
          pricingTier: 'free',
          pricingMultiplier: 0,
          supportsVision,
          supportsAttachments: supportsVision,
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private inferVisionSupport(modelId: string): boolean {
    const normalized = modelId.toLowerCase();
    if (normalized === 'openrouter/free') {
      return true;
    }
    if (this.id === 'groq') {
      return false;
    }

    return [
      'vision',
      'image',
      'vl',
      'llava',
      'bakllava',
      'minicpm-v',
      'gemma3',
      'gemini',
      'gpt-4o',
      'omni',
      'pixtral',
      'qwen2-vl',
      'qwen2.5-vl',
      'llama-3.2-vision',
      'llama3.2-vision',
    ].some((token) => normalized.includes(token));
  }

  private buildRecoveredMessages(data: ProviderSessionRestoreData): ChatMessage[] {
    const conversation = data.messages.filter(
      (message) =>
        message.role === 'system' || message.role === 'user' || message.role === 'assistant'
    );

    const recoveredMessages: ChatMessage[] = [];
    if (data.systemPrompt) {
      recoveredMessages.push({ role: 'system', content: data.systemPrompt });
    }

    const recentMessages = conversation.slice(-MAX_RECOVERY_MESSAGES);
    const olderMessages = conversation.slice(0, -MAX_RECOVERY_MESSAGES);
    const summary = this.summarizeMessages(olderMessages);

    if (summary) {
      recoveredMessages.push({
        role: 'system',
        content: `Recovered conversation summary:\n${summary}`,
      });
    }

    for (const message of recentMessages) {
      if (message.role === 'system' && data.systemPrompt && message.content === data.systemPrompt) {
        continue;
      }

      recoveredMessages.push({
        role: message.role,
        content: message.content,
      });
    }

    return recoveredMessages;
  }

  private summarizeMessages(messages: Message[]): string {
    if (messages.length === 0) {
      return '';
    }

    return messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, 240)}`)
      .join('\n')
      .slice(0, MAX_RECOVERY_SUMMARY_CHARS);
  }

  private formatSize(bytes?: number): string {
    if (!bytes) return 'unknown size';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }
}
