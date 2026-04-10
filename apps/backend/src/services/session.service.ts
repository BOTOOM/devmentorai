import {
  formatDate,
  generateMessageId,
  generateSessionId,
  getAgentConfig,
  getDefaultModel,
} from '@devmentorai/shared';
import type {
  CreateSessionRequest,
  Message,
  MessageMetadata,
  PaginatedResponse,
  Session,
  SessionStatus,
  SessionType,
  UpdateSessionRequest,
} from '@devmentorai/shared';
import type { Database } from 'better-sqlite3';

interface DbSession {
  id: string;
  name: string;
  type: SessionType;
  status: SessionStatus;
  model: string;
  system_prompt: string | null;
  custom_agent: string | null;
  tone: string | null;
  explain_tradeoffs: number | null; // SQLite boolean as 0/1
  reasoning_effort: string | null; // 'low' | 'medium' | 'high'
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
  constructor(private readonly db: Database) {}

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
      items: rows.map((row) => this.mapDbSession(row)),
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
      INSERT INTO sessions (id, name, type, model, system_prompt, custom_agent, tone, explain_tradeoffs, reasoning_effort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      request.name,
      request.type,
      model,
      request.systemPrompt || agentConfig?.prompt || null,
      agentConfig?.name || null,
      request.tone || 'balanced',
      request.explainTradeoffs ? 1 : 0,
      request.reasoningEffort || null,
      now,
      now
    );

    const createdSession = this.getSession(id);

    if (!createdSession) {
      throw new Error(`Failed to load created session: ${id}`);
    }

    return createdSession;
  }

  updateSession(id: string, request: UpdateSessionRequest): Session | null {
    const session = this.getSession(id);
    if (!session) return null;

    const updateFields: Array<{ sql: string; value: string | number | null }> = [];

    if (request.name !== undefined) {
      updateFields.push({ sql: 'name = ?', value: request.name });
    }
    if (request.status !== undefined) {
      updateFields.push({ sql: 'status = ?', value: request.status });
    }
    if (request.model !== undefined) {
      updateFields.push({ sql: 'model = ?', value: request.model });
    }
    if (request.tone !== undefined) {
      updateFields.push({ sql: 'tone = ?', value: request.tone });
    }
    if (request.explainTradeoffs !== undefined) {
      updateFields.push({ sql: 'explain_tradeoffs = ?', value: request.explainTradeoffs ? 1 : 0 });
    }
    if (request.reasoningEffort !== undefined) {
      updateFields.push({ sql: 'reasoning_effort = ?', value: request.reasoningEffort });
    }

    if (updateFields.length === 0) return session;

    const updates = updateFields.map((f) => f.sql);
    const values = [...updateFields.map((f) => f.value), formatDate(), id];

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${updates.join(', ')}, updated_at = ? WHERE id = ?
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

    const countStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = ?'
    );
    const count = (countStmt.get(sessionId) as { count: number }).count;

    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(sessionId, pageSize, offset) as DbMessage[];

    return {
      items: rows.map((row) => this.mapDbMessage(row)),
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

    stmt.run(id, sessionId, role, content, timestamp, metadata ? JSON.stringify(metadata) : null);

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

  updateMessageMetadata(messageId: string, metadata: Record<string, unknown>): void {
    const stmt = this.db.prepare('UPDATE messages SET metadata = ? WHERE id = ?');
    stmt.run(JSON.stringify(metadata), messageId);
  }

  // ============================================================================
  // Context Persistence (Phase 5)
  // ============================================================================

  /**
   * Save context for a session (associated with a message)
   */
  saveContext(
    sessionId: string,
    contextJson: string,
    messageId?: string,
    pageUrl?: string,
    pageTitle?: string,
    platform?: string
  ): string {
    const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = formatDate();

    const stmt = this.db.prepare(`
      INSERT INTO session_contexts (id, session_id, message_id, context_json, page_url, page_title, platform, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      messageId || null,
      contextJson,
      pageUrl || null,
      pageTitle || null,
      platform || null,
      now
    );

    return id;
  }

  /**
   * Get the most recent context for a session
   */
  getLatestContext(
    sessionId: string
  ): {
    id: string;
    contextJson: string;
    pageUrl?: string;
    platform?: string;
    extractedAt: string;
  } | null {
    const stmt = this.db.prepare(`
      SELECT id, context_json, page_url, platform, extracted_at
      FROM session_contexts
      WHERE session_id = ?
      ORDER BY extracted_at DESC
      LIMIT 1
    `);

    const row = stmt.get(sessionId) as
      | {
          id: string;
          context_json: string;
          page_url: string | null;
          platform: string | null;
          extracted_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      contextJson: row.context_json,
      pageUrl: row.page_url || undefined,
      platform: row.platform || undefined,
      extractedAt: row.extracted_at,
    };
  }

  /**
   * Get context history for a session
   */
  getContextHistory(
    sessionId: string,
    limit = 10
  ): Array<{
    id: string;
    messageId?: string;
    pageUrl?: string;
    pageTitle?: string;
    platform?: string;
    extractedAt: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, message_id, page_url, page_title, platform, extracted_at
      FROM session_contexts
      WHERE session_id = ?
      ORDER BY extracted_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(sessionId, limit) as Array<{
      id: string;
      message_id: string | null;
      page_url: string | null;
      page_title: string | null;
      platform: string | null;
      extracted_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      messageId: row.message_id || undefined,
      pageUrl: row.page_url || undefined,
      pageTitle: row.page_title || undefined,
      platform: row.platform || undefined,
      extractedAt: row.extracted_at,
    }));
  }

  /**
   * Get a specific context by ID
   */
  getContext(
    contextId: string
  ): { id: string; sessionId: string; contextJson: string; extractedAt: string } | null {
    const stmt = this.db.prepare(`
      SELECT id, session_id, context_json, extracted_at
      FROM session_contexts
      WHERE id = ?
    `);

    const row = stmt.get(contextId) as
      | { id: string; session_id: string; context_json: string; extracted_at: string }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      sessionId: row.session_id,
      contextJson: row.context_json,
      extractedAt: row.extracted_at,
    };
  }

  /**
   * Clean up old contexts for a session (keep only last N)
   */
  cleanupOldContexts(sessionId: string, keepCount = 20): number {
    // Get IDs to keep
    const keepStmt = this.db.prepare(`
      SELECT id FROM session_contexts
      WHERE session_id = ?
      ORDER BY extracted_at DESC
      LIMIT ?
    `);
    const idsToKeep = (keepStmt.all(sessionId, keepCount) as Array<{ id: string }>).map(
      (r) => r.id
    );

    if (idsToKeep.length === 0) return 0;

    // Delete older contexts
    const deleteStmt = this.db.prepare(`
      DELETE FROM session_contexts
      WHERE session_id = ?
      AND id NOT IN (${idsToKeep.map(() => '?').join(',')})
    `);

    const result = deleteStmt.run(sessionId, ...idsToKeep);
    return result.changes;
  }

  /**
   * Get context count for a session
   */
  getContextCount(sessionId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM session_contexts WHERE session_id = ?'
    );
    const result = stmt.get(sessionId) as { count: number };
    return result.count;
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
      tone: (row.tone as Session['tone']) || undefined,
      explainTradeoffs: this.mapDbBoolean(row.explain_tradeoffs),
      reasoningEffort: (row.reasoning_effort as Session['reasoningEffort']) || undefined,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDbMessage(row: DbMessage): Message {
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

    // Fix legacy image URLs that have incorrect format
    if (metadata?.images) {
      metadata.images = metadata.images.map((img: Record<string, unknown>) => ({
        ...img,
        thumbnailUrl: this.fixImageUrl(img.thumbnailUrl as string | undefined),
        fullImageUrl: this.fixImageUrl(img.fullImageUrl as string | undefined),
      }));
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata,
    };
  }

  /**
   * Map SQLite boolean (0/1) to TypeScript boolean or undefined
   */
  private mapDbBoolean(value: number | null): boolean | undefined {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  /**
   * Fix legacy image URLs that have incorrect format
   * - Adds missing port (localhost -> localhost:3847)
   * - Removes duplicate "images/images/" path
   */
  private fixImageUrl(url: string | undefined): string | undefined {
    if (!url) return url;

    let fixed = url;

    // Fix missing port: http://localhost/api -> http://localhost:3847/api
    if (fixed.includes('http://localhost/api')) {
      fixed = fixed.replace('http://localhost/api', 'http://localhost:3847/api');
    }

    // Fix duplicate images path: /api/images/images/ -> /api/images/
    if (fixed.includes('/api/images/images/')) {
      fixed = fixed.replace('/api/images/images/', '/api/images/');
    }

    return fixed;
  }
}
