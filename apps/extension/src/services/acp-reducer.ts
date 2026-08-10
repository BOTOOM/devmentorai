import type { AcpEvent, Message } from '@devmentorai/shared';

export type AcpChatState = {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  events: AcpEvent[];
};

export const initialAcpChatState: AcpChatState = {
  messages: [],
  isStreaming: false,
  error: null,
  events: [],
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
    return { ...state, error: event.error.message, isStreaming: false };
  }
  if (event.type !== 'message') return { ...state, events: [...state.events, event] };
  const content = event.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const existing = state.messages.find((message) => message.id === event.messageId);
  const role = event.role === 'thought' ? 'assistant' : event.role;
  if (!existing) {
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
