import type { Database } from 'better-sqlite3';
import type { AgentProfile, AgentTransport } from './types.js';

type ProfileRow = {
  id: string;
  name: string;
  agent_id: string | null;
  command: string | null;
  args_json: string;
  env_json: string;
  default_cwd: string;
  transport: AgentTransport;
  host: string | null;
  port: number | null;
  custom: number;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toProfile(row: ProfileRow): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    ...(row.agent_id ? { agentId: row.agent_id } : {}),
    ...(row.custom === 1 ? { custom: true } : {}),
    ...(row.command ? { cmd: row.command } : {}),
    args: parseJson<string[]>(row.args_json, []),
    env: parseJson<Record<string, string>>(row.env_json, {}),
    defaultCwd: row.default_cwd,
    transport: row.transport,
    ...(row.host ? { host: row.host } : {}),
    ...(row.port !== null ? { port: row.port } : {}),
  };
}

export class AgentProfileStore {
  constructor(private readonly db: Database) {
    for (const statement of [
      'ALTER TABLE acp_profiles ADD COLUMN host TEXT',
      'ALTER TABLE acp_profiles ADD COLUMN port INTEGER',
    ]) {
      try {
        this.db.exec(statement);
      } catch {
        // Columns already exist.
      }
    }
  }

  list(): AgentProfile[] {
    return (this.db.prepare('SELECT * FROM acp_profiles ORDER BY name').all() as ProfileRow[]).map(
      toProfile
    );
  }

  get(id: string): AgentProfile | undefined {
    const row = this.db.prepare('SELECT * FROM acp_profiles WHERE id = ?').get(id) as
      | ProfileRow
      | undefined;
    return row ? toProfile(row) : undefined;
  }

  save(profile: AgentProfile): AgentProfile {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO acp_profiles
          (id, name, agent_id, command, args_json, env_json, default_cwd, transport, host, port, custom, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           agent_id = excluded.agent_id,
           command = excluded.command,
           args_json = excluded.args_json,
           env_json = excluded.env_json,
           default_cwd = excluded.default_cwd,
           transport = excluded.transport,
           host = excluded.host,
           port = excluded.port,
           custom = excluded.custom,
           updated_at = excluded.updated_at`
      )
      .run(
        profile.id,
        profile.name,
        profile.agentId ?? null,
        profile.cmd ?? null,
        JSON.stringify(profile.args),
        JSON.stringify(profile.env),
        profile.defaultCwd,
        profile.transport,
        profile.host ?? null,
        profile.port ?? null,
        profile.custom ? 1 : 0,
        now,
        now
      );
    return profile;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM acp_profiles WHERE id = ?').run(id);
  }
}
