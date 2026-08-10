import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_DIR = path.join(os.homedir(), '.devmentorai');
const DB_PATH = path.join(DB_DIR, 'devmentorai.db');

export type DatabaseOptions = {
  path?: string;
};

export function initDatabase(options: DatabaseOptions = {}): Database.Database {
  const databasePath = options.path ?? DB_PATH;
  const databaseDirectory = path.dirname(databasePath);
  // Ensure directory exists
  if (databasePath !== ':memory:' && !fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
  }

  const db = new Database(databasePath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('devops', 'writing', 'development', 'general')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
      model TEXT NOT NULL DEFAULT 'gpt-5-mini',
      system_prompt TEXT,
      custom_agent TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- New table for session context persistence (Phase 5)
    CREATE TABLE IF NOT EXISTS session_contexts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT,
      context_json TEXT NOT NULL,
      page_url TEXT,
      page_title TEXT,
      platform TEXT,
      extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_session_contexts_session_id ON session_contexts(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_contexts_extracted_at ON session_contexts(extracted_at);

    CREATE TABLE IF NOT EXISTS acp_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_id TEXT,
      command TEXT,
      args_json TEXT NOT NULL DEFAULT '[]',
      env_json TEXT NOT NULL DEFAULT '{}',
      default_cwd TEXT NOT NULL,
      transport TEXT NOT NULL DEFAULT 'stdio' CHECK (transport IN ('stdio', 'tcp')),
      host TEXT,
      port INTEGER,
      custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS acp_agents (
      id TEXT PRIMARY KEY,
      auth_state TEXT NOT NULL DEFAULT 'unknown',
      auth_methods_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS acp_permission_grants (
      agent_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      option_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (agent_id, tool)
    );
  `);

  // Migration: Add tone, explain_tradeoffs, reasoning_effort columns if they don't exist
  try {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN tone TEXT DEFAULT 'balanced';
    `);
    console.log('[DB] Migration: Added tone column');
  } catch {
    // Column already exists
  }

  for (const statement of [
    'ALTER TABLE acp_profiles ADD COLUMN host TEXT',
    'ALTER TABLE acp_profiles ADD COLUMN port INTEGER',
  ]) {
    try {
      db.exec(statement);
    } catch {
      // Column already exists.
    }
  }

  try {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN explain_tradeoffs INTEGER DEFAULT 0;
    `);
    console.log('[DB] Migration: Added explain_tradeoffs column');
  } catch {
    // Column already exists
  }

  try {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN reasoning_effort TEXT;
    `);
    console.log('[DB] Migration: Added reasoning_effort column');
  } catch {
    // Column already exists
  }

  const acpSessionColumns = [
    'agent_id TEXT',
    'acp_session_id TEXT',
    'cwd TEXT',
    'protocol_version INTEGER',
    'capabilities_json TEXT',
    'config_options_json TEXT',
    "title_source TEXT CHECK (title_source IN ('agent', 'local'))",
    'replay_supported INTEGER',
    "history_state TEXT NOT NULL DEFAULT 'current'",
    'imported_from TEXT',
  ];
  for (const column of acpSessionColumns) {
    try {
      db.exec(`ALTER TABLE sessions ADD COLUMN ${column}`);
    } catch {
      // Column already exists.
    }
  }
  const migrationVersion = Number(db.pragma('user_version', { simple: true }));
  if (migrationVersion < 1) {
    db.exec(
      "UPDATE sessions SET imported_from = 'copilot-sdk' WHERE imported_from IS NULL AND agent_id IS NULL"
    );
    db.pragma('user_version = 1');
  }

  try {
    db.exec(`
      ALTER TABLE acp_profiles ADD COLUMN custom INTEGER NOT NULL DEFAULT 0;
    `);
    db.exec('UPDATE acp_profiles SET custom = 1 WHERE agent_id IS NULL');
    console.log('[DB] Migration: Added custom profile column');
  } catch {
    // Column already exists.
  }

  return db;
}

export type { Database };
