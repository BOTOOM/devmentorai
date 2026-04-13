import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_DIR = path.join(os.homedir(), '.devmentorai');
const DB_PATH = path.join(DB_DIR, 'devmentorai.db');

console.log(`Database path: ${DB_PATH}`);

export function initDatabase(): Database.Database {
  // Ensure directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('devops', 'writing', 'development', 'general')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
      model TEXT NOT NULL DEFAULT 'gpt-4.1',
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

  return db;
}

export type { Database };
