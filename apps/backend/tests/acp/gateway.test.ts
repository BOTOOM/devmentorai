import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { AcpGateway } from '../../src/acp/gateway.js';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      agent_id TEXT,
      acp_session_id TEXT,
      cwd TEXT,
      protocol_version INTEGER,
      capabilities_json TEXT,
      config_options_json TEXT,
      title_source TEXT,
      replay_supported INTEGER,
      imported_from TEXT
    );
    CREATE TABLE acp_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_id TEXT,
      command TEXT,
      args_json TEXT NOT NULL,
      env_json TEXT NOT NULL,
      default_cwd TEXT NOT NULL,
      transport TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE acp_agents (
      id TEXT PRIMARY KEY,
      auth_state TEXT NOT NULL,
      auth_methods_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
  `);
  return db;
}

describe('ACP gateway security', () => {
  it('allows only the configured extension and development origins', () => {
    const gateway = new AcpGateway({
      db: createDatabase(),
      extensionOrigin: 'chrome-extension://abcdefghijklmnop',
      allowedOrigins: ['http://localhost:5173'],
    });
    expect(gateway.isOriginAllowed('chrome-extension://abcdefghijklmnop')).toBe(true);
    expect(gateway.isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(gateway.isOriginAllowed('https://evil.example')).toBe(false);
    expect(gateway.isOriginAllowed(undefined)).toBe(false);
  });
});
