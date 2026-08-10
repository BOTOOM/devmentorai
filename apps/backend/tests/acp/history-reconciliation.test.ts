import { describe, expect, it } from 'vitest';
import {
  reconcileMessages,
  reconcileSessionsByAgent,
  reconcileToolCalls,
} from '../../src/acp/history-reconciliation.js';

describe('ACP history reconciliation', () => {
  it('retains local-only messages as stale and is idempotent', () => {
    const local = [
      {
        id: 'one',
        role: 'user' as const,
        content: 'old',
        source: 'local' as const,
        timestamp: '2024-01-01',
      },
      {
        id: 'gone',
        role: 'assistant' as const,
        content: 'local only',
        source: 'local' as const,
        timestamp: '2024-01-03',
      },
    ];
    const remote = [
      { id: 'one', role: 'user' as const, content: 'replayed', timestamp: '2024-01-01' },
      { id: 'two', role: 'assistant' as const, content: 'answer', timestamp: '2024-01-02' },
    ];
    const merged = reconcileMessages(local, remote);
    expect(merged).toEqual([
      {
        id: 'one',
        role: 'user',
        content: 'replayed',
        timestamp: '2024-01-01',
        source: 'agent',
      },
      {
        id: 'two',
        role: 'assistant',
        content: 'answer',
        timestamp: '2024-01-02',
        source: 'agent',
      },
      {
        id: 'gone',
        role: 'assistant',
        content: 'local only',
        source: 'local',
        timestamp: '2024-01-03',
        stale: true,
      },
    ]);
    expect(reconcileMessages(merged, remote)).toEqual(merged);
  });

  it('reconciles tool calls by id and retains local-only calls in order', () => {
    const local = [
      {
        id: 'local-tool',
        status: 'completed',
        source: 'local' as const,
        timestamp: '2024-01-02',
      },
    ];
    const remote = [{ id: 'remote-tool', status: 'completed', timestamp: '2024-01-01' }];
    const merged = reconcileToolCalls(local, remote);
    expect(merged).toEqual([
      {
        id: 'remote-tool',
        status: 'completed',
        timestamp: '2024-01-01',
        source: 'agent',
      },
      {
        id: 'local-tool',
        status: 'completed',
        source: 'local',
        timestamp: '2024-01-02',
        stale: true,
      },
    ]);
    expect(reconcileToolCalls(merged, remote)).toEqual(merged);
  });

  it('adopts remote sessions and marks dropped local sessions stale', () => {
    const merged = reconcileSessionsByAgent(
      [{ id: 'local', agentId: 'fixture' }],
      [{ id: 'remote', agentId: 'fixture' }],
      new Set(['fixture'])
    );
    expect(merged).toEqual([
      { id: 'remote', agentId: 'fixture' },
      { id: 'local', agentId: 'fixture', stale: true },
    ]);
  });

  it('does not mark sessions stale when an agent was not successfully queried', () => {
    const local = [
      { id: 'offline', agentId: 'offline' },
      { id: 'unsupported', agentId: 'unsupported' },
      { id: 'dropped', agentId: 'working' },
    ];
    const merged = reconcileSessionsByAgent(
      local,
      [{ id: 'other', agentId: 'working' }],
      new Set(['working'])
    );
    expect(merged).toEqual([
      { id: 'other', agentId: 'working' },
      { id: 'offline', agentId: 'offline' },
      { id: 'unsupported', agentId: 'unsupported' },
      { id: 'dropped', agentId: 'working', stale: true },
    ]);
  });
});
