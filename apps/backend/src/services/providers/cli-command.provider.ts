import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
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

interface CliCommandProviderOptions {
  id: LLMProvider;
  command: string;
  displayName: string;
  defaultModel: string;
  models: ModelInfo[];
  promptFlag?: string;
}

interface CliSessionState {
  type: SessionType;
  model: string;
  systemPrompt?: string;
}

export class CliCommandProviderAdapter implements LLMProviderAdapter {
  readonly id: LLMProvider;

  private readonly command: string;

  private readonly displayName: string;

  private readonly defaultModel: string;

  private readonly models: ModelInfo[];

  private readonly promptFlag: string;

  private ready = false;

  private readonly sessions = new Map<string, CliSessionState>();

  private readonly runningProcesses = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(options: CliCommandProviderOptions) {
    this.id = options.id;
    this.command = options.command;
    this.displayName = options.displayName;
    this.defaultModel = options.defaultModel;
    this.models = options.models;
    this.promptFlag = options.promptFlag || '-p';
  }

  async initialize(): Promise<void> {
    this.ready = this.isCommandAvailable();
  }

  isReady(): boolean {
    return this.ready;
  }

  isMockMode(): boolean {
    return !this.ready;
  }

  async createSession(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    this.ensureReady();
    this.sessions.set(sessionId, { type, model, systemPrompt });
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    this.ensureReady();
    this.sessions.set(sessionId, { type, model, systemPrompt });
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    this.ensureReady();
    const session = this.sessions.get(sessionId);
    const fullPrompt = this.buildPrompt(prompt, context, session?.systemPrompt);
    const response = await this.invokePrompt(sessionId, fullPrompt);

    if (onEvent) {
      onEvent({
        type: 'assistant.message',
        data: { content: response },
      } as SessionEvent);
      onEvent({
        type: 'session.idle',
        data: {},
      } as SessionEvent);
    }

    return response;
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    _attachments?: ProviderAttachment[]
  ): Promise<void> {
    const response = await this.sendMessage(sessionId, prompt, context);
    if (!onEvent) {
      return;
    }

    const chunks = this.chunkText(response, 180);
    for (const chunk of chunks) {
      onEvent({
        type: 'assistant.message_delta',
        data: { deltaContent: chunk },
      } as SessionEvent);
    }

    onEvent({
      type: 'assistant.message',
      data: { content: response },
    } as SessionEvent);

    onEvent({
      type: 'session.idle',
      data: {},
    } as SessionEvent);
  }

  async abortRequest(sessionId: string): Promise<void> {
    const process = this.runningProcesses.get(sessionId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
    }
    this.runningProcesses.delete(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.abortRequest(sessionId);
    this.sessions.delete(sessionId);
  }

  async listModels(): Promise<{ models: ModelInfo[]; default: string }> {
    return {
      models: this.models.map((model) => ({
        ...model,
        provider: this.id,
        available: this.ready,
      })),
      default: this.defaultModel,
    };
  }

  async getAuthStatus(): Promise<ProviderAuthStatus> {
    return {
      provider: this.id,
      isAuthenticated: this.ready,
      reason: this.ready
        ? `${this.displayName} command detected`
        : `Command '${this.command}' not found. Install and login in your local CLI first.`,
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
        mode: 'cli-local',
        command: this.command,
      },
    };
  }

  async shutdown(): Promise<void> {
    const sessionIds = Array.from(this.runningProcesses.keys());
    await Promise.all(sessionIds.map((sessionId) => this.abortRequest(sessionId)));
  }

  private isCommandAvailable(): boolean {
    const helpResult = spawnSync(this.command, ['--help'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const error = helpResult.error;
    if (!error) {
      return true;
    }

    if ('code' in error && error.code === 'ENOENT') {
      return false;
    }

    return true;
  }

  private ensureReady(): void {
    if (this.ready) {
      return;
    }

    throw new Error(
      `[${this.id}] Provider is unavailable. Install '${this.command}' CLI and authenticate locally before using this provider.`
    );
  }

  private buildPrompt(prompt: string, context?: MessageContext, systemPrompt?: string): string {
    const contextBlock = context
      ? [
          context.pageUrl ? `Page URL: ${context.pageUrl}` : '',
          context.pageTitle ? `Page Title: ${context.pageTitle}` : '',
          context.selectedText ? `Selected Text: ${context.selectedText}` : '',
          context.action ? `Action: ${context.action}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    return [
      systemPrompt ? `System:\n${systemPrompt}` : '',
      contextBlock ? `Context:\n${contextBlock}` : '',
      `User:\n${prompt}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private invokePrompt(sessionId: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [this.promptFlag, prompt];
      const child = spawn(this.command, args, {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.runningProcesses.set(sessionId, child);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        this.runningProcesses.delete(sessionId);
        reject(error);
      });

      child.on('close', (code) => {
        this.runningProcesses.delete(sessionId);

        if (code === 0) {
          const output = stdout.trim();
          if (output.length > 0) {
            resolve(output);
            return;
          }

          reject(new Error(`[${this.id}] CLI returned no output`));
          return;
        }

        reject(new Error(`[${this.id}] CLI process failed (${code}): ${stderr.trim() || 'Unknown error'}`));
      });
    });
  }

  private chunkText(value: string, chunkSize: number): string[] {
    if (value.length <= chunkSize) {
      return [value];
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += chunkSize) {
      chunks.push(value.slice(i, i + chunkSize));
    }

    return chunks;
  }
}
