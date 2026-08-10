import type { AcpEvent } from '@devmentorai/shared';
import { describe, expect, it } from 'vitest';
import {
  initialAcpChatState,
  reduceAcpChatState,
  reduceAcpEvent,
} from '../src/services/acp-reducer';

describe('ACP chat reducer', () => {
  it('upserts and appends streamed message chunks by message id', () => {
    const first: AcpEvent = {
      type: 'message',
      role: 'assistant',
      messageId: 'assistant-1',
      content: [{ type: 'text', text: 'hel' }],
      mode: 'replace',
    };
    const second: AcpEvent = {
      ...first,
      content: [{ type: 'text', text: 'lo' }],
      mode: 'append',
    };
    const afterFirst = reduceAcpEvent(initialAcpChatState, first, 'session-1');
    const afterSecond = reduceAcpEvent(afterFirst, second, 'session-1');
    expect(afterSecond.messages).toHaveLength(1);
    expect(afterSecond.messages[0]?.content).toBe('hello');
  });

  it('tracks state and recoverable errors', () => {
    const running = reduceAcpEvent(
      initialAcpChatState,
      { type: 'state', state: 'running' },
      'session-1'
    );
    const failed = reduceAcpEvent(
      running,
      {
        type: 'error',
        error: { code: 'agent_error', message: 'timed out', recoverable: true },
      },
      'session-1'
    );
    expect(running.isStreaming).toBe(true);
    expect(failed.isStreaming).toBe(false);
    expect(failed.error).toBe('timed out');
  });

  it('retains unsupported display events for later UI surfaces', () => {
    const toolCall: AcpEvent = {
      type: 'tool_call',
      toolCallId: 'tool-1',
      status: 'running',
      mode: 'replace',
    };
    const state = reduceAcpEvent(initialAcpChatState, toolCall, 'session-1');
    expect(state.events).toEqual([toolCall]);
  });

  it('shows optimistic user messages and resets when the session changes', () => {
    const state = reduceAcpChatState(initialAcpChatState, {
      type: 'user_message',
      message: {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'hello',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    });
    expect(state.messages).toHaveLength(1);
    expect(reduceAcpChatState(state, { type: 'reset' })).toEqual(initialAcpChatState);
  });
});
