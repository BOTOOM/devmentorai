import { describe, expect, it } from 'vitest';
import { reconcileMessages, reconcileSessions } from '../../src/acp/history-reconciliation.js';

describe('ACP history reconciliation', () => {
  it('retains local-only messages as stale and is idempotent', () => {
    const local = [
      { id: 'one', role: 'user' as const, content: 'old', source: 'local' as const },
      { id: 'gone', role: 'assistant' as const, content: 'local only', source: 'local' as const },
    ];
    const remote = [{ id: 'one', role: 'user' as const, content: 'replayed' }];
    const merged = reconcileMessages(local, remote);
    expect(merged).toEqual([
      { id: 'one', role: 'user', content: 'replayed', source: 'agent' },
      { id: 'gone', role: 'assistant', content: 'local only', source: 'local', stale: true },
    ]);
    expect(reconcileMessages(merged, remote)).toEqual(merged);
  });

  it('adopts remote sessions and marks dropped local sessions stale', () => {
    const merged = reconcileSessions(
      [{ id: 'local', agentId: 'fixture' }],
      [{ id: 'remote', agentId: 'fixture' }]
    );
    expect(merged).toEqual([
      { id: 'remote', agentId: 'fixture' },
      { id: 'local', agentId: 'fixture', stale: true },
    ]);
  });
});
