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
import type {
  LLMProviderAdapter,
  ProviderAttachment,
  ProviderSessionRestoreData,
} from './llm-provider.interface.js';

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
  recoverySummary?: string;
  history: CliSessionMessage[];
}

interface CliSessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface KiloJsonEvent {
  type?: string;
  part?: {
    text?: string;
  };
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
    this.sessions.set(sessionId, { type, model, systemPrompt, history: [] });
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    this.ensureReady();
    const existing = this.sessions.get(sessionId);
    this.sessions.set(sessionId, {
      type,
      model,
      systemPrompt,
      recoverySummary: existing?.recoverySummary,
      history: existing?.history ?? [],
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
      recoverySummary: this.buildRecoverySummary(data),
      history: [],
    });
    return true;
  }

  async sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    this.ensureReady();
    const session = this.sessions.get(sessionId);
    const userTurn = this.buildUserTurnContent(prompt, context);
    const fullPrompt = this.buildPrompt(
      userTurn,
      session?.systemPrompt,
      session?.recoverySummary,
      this.buildRecentHistoryBlock(session?.history)
    );
    const response = await this.invokePrompt(sessionId, fullPrompt);
    this.recordSessionExchange(sessionId, userTurn, response);

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
    attachments?: ProviderAttachment[]
  ): Promise<void> {
    this.ensureReady();
    const session = this.sessions.get(sessionId);
    const userTurn = this.buildUserTurnContent(prompt, context, attachments);
    const fullPrompt = this.buildPrompt(
      userTurn,
      session?.systemPrompt,
      session?.recoverySummary,
      this.buildRecentHistoryBlock(session?.history)
    );

    if (this.id === 'kilo-code') {
      const response = await this.streamKiloPrompt(sessionId, fullPrompt, onEvent);
      this.recordSessionExchange(sessionId, userTurn, response);
      return;
    }

    const response = await this.invokePrompt(sessionId, fullPrompt);
    this.recordSessionExchange(sessionId, userTurn, response);

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
      supportsNativeResume: false,
      sessionRecoveryMode: 'summary',
      reason: this.ready
        ? this.getReadyReason()
        : this.getUnavailableReason(),
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

    throw new Error(`[${this.id}] ${this.getUnavailableReason()}`);
  }

  private buildPrompt(
    userTurn: string,
    systemPrompt?: string,
    recoverySummary?: string,
    recentHistory?: string
  ): string {
    return [
      systemPrompt ? `System:\n${systemPrompt}` : '',
      recoverySummary ? `--- PREVIOUS CONVERSATION HISTORY ---\n${recoverySummary}\n--- END OF HISTORY ---` : '',
      recentHistory ? `--- RECENT SESSION TURNS ---\n${recentHistory}\n--- END RECENT SESSION TURNS ---` : '',
      userTurn,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildUserTurnContent(
    prompt: string,
    context?: MessageContext,
    attachments?: ProviderAttachment[]
  ): string {
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

    const attachmentBlock = attachments && attachments.length > 0
      ? attachments
          .map((attachment) => `- ${attachment.displayName || attachment.path} (${attachment.path})`)
          .join('\n')
      : '';

    return [
      attachmentBlock ? `Attached Files:\n${attachmentBlock}` : '',
      contextBlock ? `Context:\n${contextBlock}` : '',
      `User:\n${prompt}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildRecentHistoryBlock(history?: CliSessionMessage[]): string {
    if (!history || history.length === 0) {
      return '';
    }

    return history
      .slice(-12)
      .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
      .join('\n\n');
  }

  private async invokePrompt(sessionId: string, prompt: string): Promise<string> {
    const attempts = this.getInvocationAttempts(prompt);
    let lastError: Error | null = null;

    for (const args of attempts) {
      try {
        return await this.runCliAttempt(sessionId, args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error(`[${this.id}] CLI invocation failed`);
  }

  private streamKiloPrompt(
    sessionId: string,
    prompt: string,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, ['run', '--auto', '--format', 'json', '--', prompt], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.runningProcesses.set(sessionId, child);

      let stdout = '';
      let stderr = '';
      let fullContent = '';
      let buffer = '';

      const emitText = (text: string) => {
        if (!text) {
          return;
        }

        fullContent += text;
        if (!onEvent) {
          return;
        }

        onEvent({
          type: 'assistant.message_delta',
          data: { deltaContent: text },
        } as SessionEvent);
      };

      const parseBufferedLines = () => {
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          try {
            const parsed = JSON.parse(trimmed) as KiloJsonEvent;
            if (parsed.type === 'text' && parsed.part?.text) {
              emitText(parsed.part.text);
              continue;
            }

            if (onEvent) {
              onEvent({
                type: 'assistant.message_delta',
                data: { deltaContent: '' },
              } as SessionEvent);
            }
          } catch {
            emitText(`${trimmed}\n`);
          }
        }
      };

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        buffer += text;
        parseBufferedLines();
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

        if (buffer.trim()) {
          buffer = `${buffer}\n`;
          parseBufferedLines();

          if (buffer.trim()) {
            emitText(buffer.trim());
          }
        }

        if (code === 0) {
          if (fullContent && onEvent) {
            onEvent({
              type: 'assistant.message',
              data: { content: fullContent },
            } as SessionEvent);
          }

          if (onEvent) {
            onEvent({
              type: 'session.idle',
              data: {},
            } as SessionEvent);
          }

          resolve(fullContent);
          return;
        }

        reject(new Error(this.normalizeCliFailure(code, stdout, stderr)));
      });
    });
  }

  private recordSessionExchange(sessionId: string, userTurn: string, assistantTurn: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (userTurn.trim()) {
      session.history.push({ role: 'user', content: userTurn.trim() });
    }

    if (assistantTurn.trim()) {
      session.history.push({ role: 'assistant', content: assistantTurn.trim() });
    }

    if (session.history.length > 24) {
      session.history.splice(0, session.history.length - 24);
    }
  }

  private runCliAttempt(sessionId: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
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

        reject(new Error(this.normalizeCliFailure(code, stdout, stderr)));
      });
    });
  }

  private getInvocationAttempts(prompt: string): string[][] {
    if (this.id === 'kilo-code') {
      return [
        ['run', '--auto', '--', prompt],
        ['run', '--auto', prompt],
      ];
    }

    if (this.id === 'gemini-cli') {
      return [[`--prompt=${prompt}`]];
    }

    return [[this.promptFlag, prompt]];
  }

  private normalizeCliFailure(code: number | null, stdout: string, stderr: string): string {
    const combinedOutput = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');

    if (this.id === 'kilo-code') {
      const baseMessage = `[${this.id}] Kilo CLI failed (${code ?? 'unknown'}). DevMentorAI uses a non-interactive invocation. Verify Kilo is authenticated and that autonomous or gateway mode is configured for local CLI usage.`;

      if (!combinedOutput || /unknown error/i.test(combinedOutput)) {
        return baseMessage;
      }

      return `${baseMessage}\n${combinedOutput}`;
    }

    return `[${this.id}] CLI process failed (${code ?? 'unknown'}): ${combinedOutput || 'Unknown error'}`;
  }

  private getReadyReason(): string {
    if (this.id === 'kilo-code') {
      return `${this.displayName} command detected. DevMentorAI will use 'kilo run --auto' for non-interactive execution and summarize history when recovering sessions.`;
    }

    return `${this.displayName} command detected`;
  }

  private getUnavailableReason(): string {
    if (this.id === 'kilo-code') {
      return `Command '${this.command}' not found. Install Kilo CLI and authenticate locally before using this provider.`;
    }

    return `Command '${this.command}' not found. Install and login in your local CLI first.`;
  }

  private buildRecoverySummary(data: ProviderSessionRestoreData): string {
    const relevantMessages = data.messages.filter((message) => message.role !== 'system');
    const recentMessages = relevantMessages.slice(-12);
    const olderMessages = relevantMessages.slice(0, -12);

    const recentBlock = recentMessages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n\n');

    const olderSummary = olderMessages.length > 0
      ? olderMessages
          .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, 280)}`)
          .join('\n')
          .slice(0, 4000)
      : '';

    return [
      olderSummary ? `Earlier conversation summary:\n${olderSummary}` : '',
      recentBlock ? `${recentBlock}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private chunkText(text: string, size: number): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }
}
