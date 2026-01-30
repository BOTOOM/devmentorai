import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

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

  return db;
}

export type { Database };
