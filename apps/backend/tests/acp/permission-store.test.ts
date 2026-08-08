import { describe, expect, it } from 'vitest';
import { AcpPermissionStore } from '../../src/acp/permission-store.js';
import { initDatabase } from '../../src/db/index.js';

describe('ACP permission store', () => {
  it('scopes grants by durable agent identity and supports revocation', () => {
    const db = initDatabase({ path: ':memory:' });
    const store = new AcpPermissionStore(db);
    store.save('agent-a', 'shell', 'always');
    expect(store.get('agent-a', 'shell')?.optionId).toBe('always');
    expect(store.get('agent-b', 'shell')).toBeUndefined();
    expect(store.list('agent-a')).toHaveLength(1);
    store.revoke('agent-a', 'shell');
    expect(store.get('agent-a', 'shell')).toBeUndefined();
    db.close();
  });
});
