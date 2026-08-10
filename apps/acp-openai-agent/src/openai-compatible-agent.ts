import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import * as acp from '@agentclientprotocol/sdk';

const execFileAsync = promisify(execFile);

type AgentOptions = {
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  supportsImage: boolean;
};
type ChatContentPart = Record<string, unknown>;
type ChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | ChatContentPart[] | null;
  tool_calls?: Array<Record<string, unknown>>;
  tool_call_id?: string;
};
type ToolCall = { id: string; index: number; name: string; arguments: string };
type SessionState = {
  cwd: string;
  baseUrl: string;
  model: string;
  controller: AbortController | undefined;
  messages: ChatMessage[];
};
type CompletionChoice = {
  delta?: { content?: string | null; tool_calls?: Array<Record<string, unknown>> };
};
type SessionToolResult = { call: ToolCall; result?: string; rejected?: boolean };

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file inside the session workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write UTF-8 text to a file inside the session workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_shell',
      description: 'Run a shell command inside the session workspace.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function configOptions(
  model: string,
  baseUrl: string,
  models: string[]
): acp.SessionConfigOption[] {
  return [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: model,
      options: [...new Set([model, ...models])].map((value) => ({ value, name: value })),
    },
    {
      id: 'base-url',
      name: 'Endpoint',
      category: 'mode',
      type: 'select',
      currentValue: baseUrl,
      options: [{ value: baseUrl, name: baseUrl }],
    },
  ];
}

export class OpenAICompatibleAgent {
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly apiKey: string | undefined;
  private readonly supportsImage: boolean;
  private readonly sessions = new Map<string, SessionState>();
  private readonly models = new Map<string, string[]>();

  constructor(options: AgentOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultModel = options.model;
    this.apiKey = options.apiKey;
    this.supportsImage = options.supportsImage;
  }

  initialize(): acp.InitializeResponse {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        promptCapabilities: {
          ...(this.supportsImage ? { image: true } : {}),
          embeddedContext: true,
        },
      },
      authMethods: [],
      agentInfo: { name: 'DevMentorAI OpenAI-compatible ACP agent', version: '0.1.0' },
    };
  }

  authenticate(_params: acp.AuthenticateRequest): Promise<void> {
    return Promise.resolve();
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    const sessionId = crypto.randomUUID();
    const baseUrl = this.baseUrl;
    const models = await this.fetchModels(baseUrl);
    this.models.set(sessionId, models);
    this.sessions.set(sessionId, {
      cwd: path.resolve(params.cwd),
      baseUrl,
      model: this.defaultModel,
      controller: undefined,
      messages: [],
    });
    return { sessionId, configOptions: configOptions(this.defaultModel, baseUrl, models) };
  }

  async setConfigOption(
    params: acp.SetSessionConfigOptionRequest
  ): Promise<acp.SetSessionConfigOptionResponse> {
    const session = this.requireSession(params.sessionId);
    if (params.configId === 'model' && typeof params.value === 'string') {
      session.model = params.value;
    }
    if (params.configId === 'base-url' && typeof params.value === 'string') {
      session.baseUrl = params.value.replace(/\/+$/, '');
      this.models.set(params.sessionId, await this.fetchModels(session.baseUrl));
    }
    return {
      configOptions: configOptions(
        session.model,
        session.baseUrl,
        this.models.get(params.sessionId) ?? []
      ),
    };
  }

  async prompt(params: acp.PromptRequest, client: acp.AgentContext): Promise<acp.PromptResponse> {
    const session = this.requireSession(params.sessionId);
    const controller = new AbortController();
    session.controller = controller;
    session.messages.push(this.toMessage(params.prompt));
    const initialMessageCount = session.messages.length - 1;
    try {
      for (let round = 0; round < 8; round += 1) {
        const result = await this.complete(session, params.sessionId, client);
        if (result.toolCalls.length === 0) {
          if (result.content) session.messages.push({ role: 'assistant', content: result.content });
          return { stopReason: controller.signal.aborted ? 'cancelled' : 'end_turn' };
        }
        session.messages.push({
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
          })),
        });
        const results = await this.resolveToolCalls(
          session,
          params.sessionId,
          result.toolCalls,
          client
        );
        for (const toolResult of results) {
          session.messages.push({
            role: 'tool',
            tool_call_id: toolResult.call.id,
            content: toolResult.rejected
              ? 'Tool execution rejected by the user.'
              : (toolResult.result ?? ''),
          });
        }
        if (controller.signal.aborted) return { stopReason: 'cancelled' };
      }
      await client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'The maximum number of tool-call rounds was reached.',
          },
        },
      });
      return { stopReason: 'max_turn_requests' };
    } catch (error) {
      session.messages.splice(initialMessageCount);
      if (controller.signal.aborted) return { stopReason: 'cancelled' };
      throw error;
    } finally {
      session.controller = undefined;
    }
  }

  cancel(params: acp.CancelNotification): void {
    this.sessions.get(params.sessionId)?.controller?.abort();
  }

  private async complete(
    session: SessionState,
    sessionId: string,
    client: acp.AgentContext
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const response = await fetch(`${session.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: session.model,
        messages: session.messages,
        tools: TOOL_DEFINITIONS,
        stream: true,
      }),
      ...(session.controller ? { signal: session.controller.signal } : {}),
    });
    if (!response.ok) throw new Error(`OpenAI-compatible endpoint returned ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenAI-compatible endpoint returned no stream');
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolCalls = new Map<number, ToolCall>();
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '' || payload === '[DONE]') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (!isRecord(parsed) || !Array.isArray(parsed.choices)) continue;
        const choice = parsed.choices[0] as CompletionChoice | undefined;
        const delta = choice?.delta?.content;
        if (typeof delta === 'string') {
          content += delta;
          await client.notify(acp.methods.client.session.update, {
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: delta },
            },
          });
        }
        for (const fragment of choice?.delta?.tool_calls ?? []) {
          this.mergeToolCall(toolCalls, fragment);
        }
      }
    }
    return { content, toolCalls: [...toolCalls.values()] };
  }

  private mergeToolCall(calls: Map<number, ToolCall>, fragment: Record<string, unknown>): void {
    const index = typeof fragment.index === 'number' ? fragment.index : 0;
    const current = calls.get(index) ?? {
      id: crypto.randomUUID(),
      index,
      name: '',
      arguments: '',
    };
    if (typeof fragment.id === 'string') current.id = fragment.id;
    const functionValue = isRecord(fragment.function) ? fragment.function : {};
    if (typeof functionValue.name === 'string') current.name += functionValue.name;
    if (typeof functionValue.arguments === 'string') current.arguments += functionValue.arguments;
    calls.set(index, current);
  }

  private async resolveToolCalls(
    session: SessionState,
    sessionId: string,
    calls: ToolCall[],
    client: acp.AgentContext
  ): Promise<SessionToolResult[]> {
    const results: SessionToolResult[] = [];
    for (const call of calls) {
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: call.id,
          title: call.name,
          kind: 'execute',
          status: 'pending',
          rawInput: call.arguments,
        },
      });
      const permission = await client.request(acp.methods.client.session.requestPermission, {
        sessionId,
        toolCall: {
          toolCallId: call.id,
          title: `${call.name}(${call.arguments.slice(0, 500)})`,
          kind: 'execute',
          status: 'pending',
        },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
        ],
      });
      if (permission.outcome.outcome !== 'selected' || permission.outcome.optionId !== 'allow') {
        await this.toolUpdate(client, sessionId, call.id, 'failed', 'rejected');
        results.push({ call, rejected: true });
        continue;
      }
      await this.toolUpdate(client, sessionId, call.id, 'in_progress');
      try {
        const result = await this.executeTool(session, call);
        await this.toolUpdate(client, sessionId, call.id, 'completed', result);
        results.push({ call, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool failed';
        await this.toolUpdate(client, sessionId, call.id, 'failed', message);
        results.push({ call, result: message });
      }
    }
    return results;
  }

  private async toolUpdate(
    client: acp.AgentContext,
    sessionId: string,
    toolCallId: string,
    status: 'failed' | 'in_progress' | 'completed',
    output?: string
  ): Promise<void> {
    await client.notify(acp.methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status,
        ...(output ? { rawOutput: output } : {}),
      },
    });
  }

  private async executeTool(session: SessionState, call: ToolCall): Promise<string> {
    const input: unknown = JSON.parse(call.arguments);
    if (!isRecord(input)) throw new Error('Tool arguments must be an object');
    if (call.name === 'read_file') {
      return readFile(await this.safePath(session.cwd, stringValue(input.path)), 'utf8');
    }
    if (call.name === 'write_file') {
      const target = await this.safePath(session.cwd, stringValue(input.path));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, stringValue(input.content), 'utf8');
      return 'File written.';
    }
    if (call.name === 'run_shell') {
      const command = stringValue(input.command);
      const env = Object.fromEntries(
        ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM', 'USER', 'SHELL']
          .filter((name) => process.env[name] !== undefined)
          .map((name) => [name, process.env[name] as string])
      );
      const result = await execFileAsync('/bin/sh', ['-c', command], {
        cwd: session.cwd,
        env,
        maxBuffer: 1024 * 1024,
        ...(session.controller ? { signal: session.controller.signal } : {}),
      });
      return `${result.stdout}${result.stderr}`;
    }
    throw new Error(`Unsupported tool: ${call.name}`);
  }

  private async safePath(cwd: string, requested: string): Promise<string> {
    const root = path.resolve(cwd);
    const target = path.resolve(root, requested);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Tool path is outside the session workspace');
    }
    const resolvedRoot = await realpath(root);
    let resolvedTarget: string | undefined;
    try {
      resolvedTarget = await realpath(target);
    } catch {
      let existing = path.dirname(target);
      const suffix: string[] = [path.basename(target)];
      while (existing !== path.dirname(existing)) {
        try {
          const resolvedExisting = await realpath(existing);
          resolvedTarget = path.join(resolvedExisting, ...suffix);
          break;
        } catch {
          suffix.unshift(path.basename(existing));
          existing = path.dirname(existing);
        }
      }
      if (resolvedTarget === undefined) throw new Error('Tool path cannot be resolved');
    }
    if (resolvedTarget === undefined) throw new Error('Tool path cannot be resolved');
    if (
      resolvedTarget !== resolvedRoot &&
      !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error('Tool path is outside the session workspace');
    }
    return target;
  }

  private async fetchModels(baseUrl: string): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      if (!response.ok) return [this.defaultModel];
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.data)) return [this.defaultModel];
      const models = payload.data
        .filter(isRecord)
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string');
      return models.length > 0 ? models : [this.defaultModel];
    } catch {
      return [this.defaultModel];
    }
  }

  private toMessage(blocks: acp.ContentBlock[]): ChatMessage {
    const parts: ChatContentPart[] = [];
    for (const block of blocks) {
      if (block.type === 'text') parts.push({ type: 'text', text: block.text });
      else if (block.type === 'image') {
        if (!this.supportsImage) throw new Error('The endpoint does not support image content');
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${block.mimeType};base64,${block.data}` },
        });
      } else if (block.type === 'resource') {
        const resourceValue: unknown = block.resource;
        const resource = isRecord(resourceValue) ? resourceValue : {};
        parts.push({
          type: 'text',
          text: `[${stringValue(resource.mimeType) || 'resource'} ${stringValue(resource.uri)}]\n${stringValue(resource.text)}`,
        });
      } else if (block.type === 'resource_link') {
        parts.push({ type: 'text', text: `[Resource ${block.name ?? block.uri}] ${block.uri}` });
      }
    }
    if (parts.length === 1 && parts[0]?.type === 'text') {
      return { role: 'user', content: stringValue(parts[0].text) };
    }
    return { role: 'user', content: parts };
  }

  private requireSession(sessionId: string): SessionState {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown ACP session ${sessionId}`);
    return session;
  }
}
