import * as acp from '@agentclientprotocol/sdk';

type AgentOptions = {
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  supportsImage: boolean;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | Array<Record<string, unknown>> | null;
  tool_calls?: Array<Record<string, unknown>>;
  tool_call_id?: string;
};

type SessionState = {
  cwd: string;
  baseUrl: string;
  model: string;
  controller: AbortController | undefined;
  messages: ChatMessage[];
};

type CompletionChoice = {
  delta?: {
    content?: string | null;
    tool_calls?: Array<Record<string, unknown>>;
  };
  message?: {
    content?: string | null;
    tool_calls?: Array<Record<string, unknown>>;
  };
  finish_reason?: string | null;
};

type CompletionChunk = { choices?: CompletionChoice[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textContent(blocks: acp.ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<acp.ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export class OpenAICompatibleAgent {
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly apiKey: string | undefined;
  private readonly supportsImage: boolean;
  private readonly sessions = new Map<string, SessionState>();

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
      authMethods: this.apiKey
        ? []
        : [{ id: 'api-key', name: 'API key', description: 'Configure the endpoint API key' }],
      agentInfo: { name: 'DevMentorAI OpenAI-compatible ACP agent', version: '0.1.0' },
    };
  }

  authenticate(_params: acp.AuthenticateRequest): Promise<void> {
    return Promise.resolve();
  }

  newSession(params: acp.NewSessionRequest): acp.NewSessionResponse {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      cwd: params.cwd,
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      controller: undefined,
      messages: [],
    });
    return {
      sessionId,
      configOptions: [
        {
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: this.defaultModel,
          options: [{ value: this.defaultModel, name: this.defaultModel }],
        },
        {
          id: 'base-url',
          name: 'Endpoint',
          category: 'mode',
          type: 'select',
          currentValue: this.baseUrl,
          options: [{ value: this.baseUrl, name: this.baseUrl }],
        },
      ],
    };
  }

  setConfigOption(params: acp.SetSessionConfigOptionRequest): acp.SetSessionConfigOptionResponse {
    const session = this.requireSession(params.sessionId);
    if (params.configId === 'model' && typeof params.value === 'string') {
      session.model = params.value;
    }
    if (params.configId === 'base-url' && typeof params.value === 'string') {
      session.baseUrl = params.value.replace(/\/+$/, '');
    }
    return {
      configOptions: [
        {
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: session.model,
          options: [{ value: session.model, name: session.model }],
        },
        {
          id: 'base-url',
          name: 'Endpoint',
          category: 'mode',
          type: 'select',
          currentValue: session.baseUrl,
          options: [{ value: session.baseUrl, name: session.baseUrl }],
        },
      ],
    };
  }

  async prompt(params: acp.PromptRequest, client: acp.AgentContext): Promise<acp.PromptResponse> {
    const session = this.requireSession(params.sessionId);
    const controller = new AbortController();
    session.controller = controller;
    const userMessage = this.toMessage(params.prompt);
    session.messages.push(userMessage);
    try {
      const response = await fetch(`${session.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: session.model, messages: session.messages, stream: true }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OpenAI-compatible endpoint returned ${response.status}`);
      const content = await this.consumeStream(response, params.sessionId, client);
      session.messages.push({ role: 'assistant', content });
      await client.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '' } },
      });
      return { stopReason: controller.signal.aborted ? 'cancelled' : 'end_turn' };
    } catch (error) {
      if (controller.signal.aborted) return { stopReason: 'cancelled' };
      throw error;
    } finally {
      session.controller = undefined;
    }
  }

  cancel(params: acp.CancelNotification): void {
    this.sessions.get(params.sessionId)?.controller?.abort();
  }

  private async consumeStream(
    response: Response,
    sessionId: string,
    client: acp.AgentContext
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenAI-compatible endpoint returned no stream');
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        const parsed: unknown = JSON.parse(payload);
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
        const toolCalls = choice?.delta?.tool_calls;
        if (toolCalls) await this.emitToolCalls(sessionId, toolCalls, client);
      }
    }
    return content;
  }

  private async emitToolCalls(
    sessionId: string,
    toolCalls: Array<Record<string, unknown>>,
    client: acp.AgentContext
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      const id = typeof toolCall.id === 'string' ? toolCall.id : crypto.randomUUID();
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: id,
          title: 'OpenAI tool call',
          kind: 'execute',
          status: 'pending',
          rawInput: toolCall,
        },
      });
      const permission = await client.request(acp.methods.client.session.requestPermission, {
        sessionId,
        toolCall: { toolCallId: id, title: 'OpenAI tool call', kind: 'execute', status: 'pending' },
        options: [
          { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
        ],
      });
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          status: permission.outcome.outcome === 'selected' ? 'completed' : 'cancelled',
          rawOutput: permission,
        },
      });
    }
  }

  private toMessage(blocks: acp.ContentBlock[]): ChatMessage {
    const text = textContent(blocks);
    const images = blocks.filter((block) => block.type === 'image');
    if (images.length > 0 && !this.supportsImage) {
      throw new Error('The configured endpoint does not support image content');
    }
    if (images.length === 0) return { role: 'user', content: text };
    return {
      role: 'user',
      content: [
        { type: 'text', text },
        ...images.map((block) => ({
          type: 'image_url',
          image_url: { url: `data:${block.mimeType};base64,${block.data}` },
        })),
      ],
    };
  }

  private requireSession(sessionId: string): SessionState {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown ACP session ${sessionId}`);
    return session;
  }
}
