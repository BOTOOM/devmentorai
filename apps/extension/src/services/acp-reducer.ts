import type {
  AcpAvailableCommand,
  AcpConfigOption,
  AcpEvent,
  AcpPlanEntry,
  AcpToolCallContent,
  AcpToolCallLocation,
  Message,
} from '@devmentorai/shared';

export type AcpChatState = {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  events: AcpEvent[];
  commands: AcpAvailableCommand[];
  configOptions: AcpConfigOption[];
  toolCalls: Array<{
    toolCallId: string;
    title?: string;
    kind?: string;
    status?: string;
    content?: AcpToolCallContent[];
    locations?: AcpToolCallLocation[];
    raw?: { input?: unknown; output?: unknown };
  }>;
  plan: AcpPlanEntry[];
  usage: Extract<AcpEvent, { type: 'usage' }> | null;
  sessionInfo: Extract<AcpEvent, { type: 'session_info' }> | null;
  errors: Extract<AcpEvent, { type: 'error' }>[];
};

export const initialAcpChatState: AcpChatState = {
  messages: [],
  isStreaming: false,
  error: null,
  events: [],
  commands: [],
  configOptions: [],
  toolCalls: [],
  plan: [],
  usage: null,
  sessionInfo: null,
  errors: [],
};

export type AcpChatAction =
  | { type: 'event'; sessionId: string; event: AcpEvent }
  | { type: 'user_message'; message: Message }
  | { type: 'reset' };

export function reduceAcpChatState(state: AcpChatState, action: AcpChatAction): AcpChatState {
  if (action.type === 'reset') return initialAcpChatState;
  if (action.type === 'user_message') {
    return { ...state, messages: [...state.messages, action.message], error: null };
  }
  return reduceAcpEvent(state, action.event, action.sessionId);
}

export function reduceAcpEvent(
  state: AcpChatState,
  event: AcpEvent,
  sessionId: string
): AcpChatState {
  if (event.type === 'state') {
    return { ...state, isStreaming: event.state === 'running' };
  }
  if (event.type === 'error') {
    return {
      ...state,
      error: event.error.message,
      errors: [...state.errors, event],
      events: [...state.events, event],
      isStreaming: false,
    };
  }
  if (event.type === 'commands') return { ...state, commands: event.commands };
  if (event.type === 'config') return { ...state, configOptions: event.options };
  if (event.type === 'plan') return { ...state, plan: event.entries };
  if (event.type === 'usage') return { ...state, usage: event };
  if (event.type === 'session_info') {
    return {
      ...state,
      sessionInfo: {
        ...(state.sessionInfo ?? { type: 'session_info' }),
        ...event,
      },
    };
  }
  if (event.type === 'tool_call') {
    const existing = state.toolCalls.find((tool) => tool.toolCallId === event.toolCallId);
    const content =
      event.content === undefined
        ? existing?.content
        : event.mode === 'append'
          ? [...(existing?.content ?? []), ...event.content]
          : event.content;
    const next = {
      ...(existing ?? { toolCallId: event.toolCallId }),
      ...event,
      ...(content === undefined ? {} : { content }),
    };
    return {
      ...state,
      toolCalls: existing
        ? state.toolCalls.map((tool) => (tool.toolCallId === event.toolCallId ? next : tool))
        : [...state.toolCalls, next],
      events: [...state.events, event],
    };
  }
  if (event.type !== 'message') return { ...state, events: [...state.events, event] };
  const content = event.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const existing = state.messages.find((message) => message.id === event.messageId);
  const role = event.role === 'thought' ? 'assistant' : event.role;
  if (!existing) {
    if (role === 'user') {
      let echoed: Message | undefined;
      for (let index = state.messages.length - 1; index >= 0; index -= 1) {
        const message = state.messages[index];
        if (message?.role === 'user' && message.content === content) {
          echoed = message;
          break;
        }
      }
      if (echoed) {
        return {
          ...state,
          messages: state.messages.map((message) =>
            message.id === echoed.id ? { ...message, id: event.messageId } : message
          ),
        };
      }
    }
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: event.messageId,
          sessionId,
          role,
          content,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === event.messageId
        ? { ...message, content: event.mode === 'append' ? message.content + content : content }
        : message
    ),
  };
}
