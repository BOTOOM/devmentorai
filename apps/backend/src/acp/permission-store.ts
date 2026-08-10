import type { Database } from 'better-sqlite3';

export type PermissionGrant = {
  agentId: string;
  tool: string;
  optionId: string;
  createdAt: string;
};

export class AcpPermissionStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS acp_permission_grants (
        agent_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        option_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (agent_id, tool)
      );
    `);
  }

  get(agentId: string, tool: string): PermissionGrant | undefined {
    return this.db
      .prepare(
        'SELECT agent_id as agentId, tool, option_id as optionId, created_at as createdAt FROM acp_permission_grants WHERE agent_id = ? AND tool = ?'
      )
      .get(agentId, tool) as PermissionGrant | undefined;
  }

  list(agentId?: string): PermissionGrant[] {
    const statement = agentId
      ? this.db.prepare(
          'SELECT agent_id as agentId, tool, option_id as optionId, created_at as createdAt FROM acp_permission_grants WHERE agent_id = ? ORDER BY agent_id, tool'
        )
      : this.db.prepare(
          'SELECT agent_id as agentId, tool, option_id as optionId, created_at as createdAt FROM acp_permission_grants ORDER BY agent_id, tool'
        );
    return (agentId ? statement.all(agentId) : statement.all()) as PermissionGrant[];
  }

  save(agentId: string, tool: string, optionId: string): PermissionGrant {
    this.db
      .prepare(
        `INSERT INTO acp_permission_grants (agent_id, tool, option_id)
         VALUES (?, ?, ?)
         ON CONFLICT(agent_id, tool) DO UPDATE SET option_id = excluded.option_id`
      )
      .run(agentId, tool, optionId);
    return this.get(agentId, tool) as PermissionGrant;
  }

  revoke(agentId: string, tool: string): void {
    this.db
      .prepare('DELETE FROM acp_permission_grants WHERE agent_id = ? AND tool = ?')
      .run(agentId, tool);
  }
}
