import { describe, expect, it } from 'vitest';
import { normalizeV2Update } from '../../src/acp/normalize/v2.js';

describe('ACP v2 normalization', () => {
  it.each([
    [
      'assistant message',
      {
        sessionUpdate: 'agent_message',
        messageId: 'a',
        content: { type: 'text', text: 'hello' },
      },
      {
        type: 'message',
        role: 'assistant',
        messageId: 'a',
        content: [{ type: 'text', text: 'hello' }],
        mode: 'replace',
      },
    ],
    [
      'state update',
      { sessionUpdate: 'state_update', state: 'idle', stopReason: 'end_turn' },
      { type: 'state', state: 'idle', stopReason: 'end_turn' },
    ],
    [
      'plan update',
      {
        sessionUpdate: 'plan_update',
        planId: 'p1',
        entries: [{ content: 'Ship', priority: 'high', status: 'pending' }],
      },
      {
        type: 'plan',
        planId: 'p1',
        entries: [{ content: 'Ship', priority: 'high', status: 'pending' }],
      },
    ],
    [
      'terminal output',
      {
        sessionUpdate: 'terminal_output_chunk',
        terminalId: 't1',
        data: 'hello',
      },
      {
        type: 'terminal',
        terminalId: 't1',
        output: { data: 'hello', mode: 'append' },
      },
    ],
  ])('%s', (_name, input, expected) => {
    expect(normalizeV2Update(input)).toEqual(expected);
  });

  it('maps the same logical message stream as v1', () => {
    const v2 = normalizeV2Update({
      sessionUpdate: 'agent_message_chunk',
      messageId: 'assistant',
      content: { type: 'text', text: 'hello' },
    });
    expect(v2).toEqual({
      type: 'message',
      role: 'assistant',
      messageId: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      mode: 'append',
    });
  });
});
