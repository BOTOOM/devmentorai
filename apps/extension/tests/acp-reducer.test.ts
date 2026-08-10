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

  it('replaces advertised commands and merges tool calls field-wise', () => {
    const commands = reduceAcpEvent(
      initialAcpChatState,
      { type: 'commands', commands: [{ name: 'usage', description: 'Show usage' }] },
      'session-1'
    );
    const replaced = reduceAcpEvent(
      commands,
      { type: 'commands', commands: [{ name: 'plan', description: 'Show plan' }] },
      'session-1'
    );
    const pending = reduceAcpEvent(
      replaced,
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Edit file',
        kind: 'edit',
        status: 'pending',
        content: [{ type: 'diff', content: { type: 'text', text: 'before' } }],
        mode: 'replace',
      },
      'session-1'
    );
    const completed = reduceAcpEvent(
      pending,
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        status: 'completed',
        mode: 'replace',
      },
      'session-1'
    );
    expect(replaced.commands.map((command) => command.name)).toEqual(['plan']);
    expect(completed.toolCalls).toHaveLength(1);
    expect(completed.toolCalls[0]?.title).toBe('Edit file');
    expect(completed.toolCalls[0]?.content).toHaveLength(1);
    expect(completed.toolCalls[0]?.status).toBe('completed');
  });

  it('updates plans, usage and session info without discarding absent fields', () => {
    const first = reduceAcpEvent(
      initialAcpChatState,
      { type: 'plan', entries: [{ content: 'Run tests', priority: 'high', status: 'pending' }] },
      'session-1'
    );
    const second = reduceAcpEvent(
      first,
      { type: 'plan', entries: [{ content: 'Run tests', priority: 'high', status: 'completed' }] },
      'session-1'
    );
    const info = reduceAcpEvent(
      second,
      { type: 'session_info', title: 'Updated title' },
      'session-1'
    );
    expect(info.plan[0]?.status).toBe('completed');
    expect(info.sessionInfo?.title).toBe('Updated title');
    expect(info.sessionInfo?.updatedAt).toBeUndefined();
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
