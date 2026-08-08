import { describe, expect, it } from 'vitest';
import { normalizeV1Update } from '../../src/acp/normalize/v1.js';

describe('ACP v1 normalization', () => {
  it.each([
    [
      'user message',
      {
        sessionUpdate: 'user_message_chunk',
        messageId: 'u',
        content: { type: 'text', text: 'hi' },
      },
      {
        type: 'message',
        role: 'user',
        messageId: 'u',
        content: [{ type: 'text', text: 'hi' }],
        mode: 'append',
      },
    ],
    [
      'assistant message',
      {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'a',
        content: { type: 'text', text: 'hello' },
      },
      {
        type: 'message',
        role: 'assistant',
        messageId: 'a',
        content: [{ type: 'text', text: 'hello' }],
        mode: 'append',
      },
    ],
    [
      'thought',
      {
        sessionUpdate: 'agent_thought_chunk',
        messageId: 't',
        content: { type: 'text', text: 'think' },
      },
      {
        type: 'message',
        role: 'thought',
        messageId: 't',
        content: [{ type: 'text', text: 'think' }],
        mode: 'append',
      },
    ],
    [
      'tool call',
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool',
        title: 'Run',
        kind: 'execute',
        status: 'pending',
      },
      {
        type: 'tool_call',
        toolCallId: 'tool',
        title: 'Run',
        kind: 'execute',
        status: 'pending',
        mode: 'replace',
      },
    ],
    [
      'tool update',
      { sessionUpdate: 'tool_call_update', toolCallId: 'tool', status: 'completed' },
      { type: 'tool_call', toolCallId: 'tool', status: 'completed', mode: 'replace' },
    ],
    [
      'plan',
      {
        sessionUpdate: 'plan',
        entries: [{ content: 'Do it', priority: 'high', status: 'pending' }],
      },
      { type: 'plan', entries: [{ content: 'Do it', priority: 'high', status: 'pending' }] },
    ],
    [
      'plan update extension',
      { sessionUpdate: 'plan_update', entries: [] },
      {
        type: 'unknown',
        sessionUpdate: 'plan_update',
        data: { sessionUpdate: 'plan_update', entries: [] },
      },
    ],
    [
      'plan removed extension',
      { sessionUpdate: 'plan_removed' },
      { type: 'unknown', sessionUpdate: 'plan_removed', data: { sessionUpdate: 'plan_removed' } },
    ],
    [
      'commands',
      {
        sessionUpdate: 'available_commands_update',
        availableCommands: [{ name: 'help', description: 'Help' }],
      },
      { type: 'commands', commands: [{ name: 'help', description: 'Help' }] },
    ],
    [
      'config',
      {
        sessionUpdate: 'config_option_update',
        configOptions: [{ id: 'mode', name: 'Mode', type: 'select' }],
      },
      { type: 'config', options: [{ id: 'mode', name: 'Mode', type: 'select' }] },
    ],
    [
      'session info',
      { sessionUpdate: 'session_info_update', title: 'Title', updatedAt: 'now' },
      { type: 'session_info', title: 'Title', updatedAt: 'now' },
    ],
    [
      'session info title-only update',
      { sessionUpdate: 'session_info_update', title: 'Title' },
      { type: 'session_info', title: 'Title' },
    ],
    [
      'session info cleared timestamp',
      { sessionUpdate: 'session_info_update', updatedAt: null },
      { type: 'session_info', updatedAt: null },
    ],
    [
      'usage',
      { sessionUpdate: 'usage_update', used: 1, size: 2, cost: { amount: 0.1, currency: 'USD' } },
      { type: 'usage', used: 1, size: 2, cost: { amount: 0.1, currency: 'USD' } },
    ],
  ])('%s', (_name, input, expected) => {
    expect(normalizeV1Update(input)).toEqual(expected);
  });

  it('preserves extension fields and unknown updates', () => {
    const input = {
      sessionUpdate: 'x_future_update',
      value: { type: 'future_content', _nested: true },
      _meta: { trace: '1' },
    };
    expect(normalizeV1Update(input)).toEqual({
      type: 'unknown',
      sessionUpdate: 'x_future_update',
      data: input,
    });
  });

  it('does not throw for malformed input', () => {
    expect(() => normalizeV1Update(null)).not.toThrow();
    expect(normalizeV1Update(null)).toEqual({ type: 'unknown', data: {} });
  });

  it('preserves unknown content and status values', () => {
    expect(
      normalizeV1Update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool',
        status: 'future_status',
        content: [{ type: 'future_content', payload: true }],
        _extension: 'preserve',
      })
    ).toEqual({
      type: 'tool_call',
      toolCallId: 'tool',
      status: 'future_status',
      content: [{ type: 'future_content', payload: true }],
      mode: 'replace',
      extensions: { _extension: 'preserve' },
    });
  });
});
