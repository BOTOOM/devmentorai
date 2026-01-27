import type { Database } from 'better-sqlite3';
import {
  generateSessionId,
  generateMessageId,
  formatDate,
  getAgentConfig,
  getDefaultModel,
} from '@devmentorai/shared';
import type {
  Session,
  SessionType,
  SessionStatus,
  CreateSessionRequest,
  UpdateSessionRequest,
  Message,
  MessageMetadata,
  PaginatedResponse,
} from '@devmentorai/shared';

interface DbSession {
  id: string;
  name: string;
  type: SessionType;
  status: SessionStatus;
  model: string;
  system_prompt: string | null;
  custom_agent: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata: string | null;
}

export class SessionService {
  constructor(private db: Database) {}

  // Sessions
  listSessions(page = 1, pageSize = 50): PaginatedResponse<Session> {
    const offset = (page - 1) * pageSize;
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions');
    const count = (countStmt.get() as { count: number }).count;

    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset) as DbSession[];

    return {
      items: rows.map(this.mapDbSession),
      total: count,
      page,
      pageSize,
      hasMore: offset + rows.length < count,
    };
  }

  getSession(id: string): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as DbSession | undefined;
    return row ? this.mapDbSession(row) : null;
  }

  createSession(request: CreateSessionRequest): Session {
    const id = generateSessionId();
    const now = formatDate();
    const agentConfig = getAgentConfig(request.type);
    const model = request.model || getDefaultModel(request.type);
    
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, name, type, model, system_prompt, custom_agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      request.name,
      request.type,
      model,
      request.systemPrompt || agentConfig?.prompt || null,
      agentConfig?.name || null,
      now,
      now
    );

    return this.getSession(id)!;
  }

  updateSession(id: string, request: UpdateSessionRequest): Session | null {
    const session = this.getSession(id);
    if (!session) return null;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (request.name !== undefined) {
      updates.push('name = ?');
      values.push(request.name);
    }
    if (request.status !== undefined) {
      updates.push('status = ?');
      values.push(request.status);
    }

    if (updates.length === 0) return session;

    updates.push('updated_at = ?');
    values.push(formatDate());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.getSession(id);
  }

  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  incrementMessageCount(sessionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET message_count = message_count + 1, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(formatDate(), sessionId);
  }

  // Messages
  listMessages(sessionId: string, page = 1, pageSize = 100): PaginatedResponse<Message> {
    const offset = (page - 1) * pageSize;

    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?');
    const count = (countStmt.get(sessionId) as { count: number }).count;

    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(sessionId, pageSize, offset) as DbMessage[];

    return {
      items: rows.map(this.mapDbMessage),
      total: count,
      page,
      pageSize,
      hasMore: offset + rows.length < count,
    };
  }

  addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: MessageMetadata
  ): Message {
    const id = generateMessageId();
    const timestamp = formatDate();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      sessionId,
      role,
      content,
      timestamp,
      metadata ? JSON.stringify(metadata) : null
    );

    this.incrementMessageCount(sessionId);

    return {
      id,
      sessionId,
      role,
      content,
      timestamp,
      metadata,
    };
  }

  updateMessageContent(messageId: string, content: string): void {
    const stmt = this.db.prepare('UPDATE messages SET content = ? WHERE id = ?');
    stmt.run(content, messageId);
  }

  private mapDbSession(row: DbSession): Session {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      model: row.model,
      systemPrompt: row.system_prompt || undefined,
      customAgent: row.custom_agent || undefined,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDbMessage(row: DbMessage): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
