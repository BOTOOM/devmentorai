import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SessionService } from '../../src/services/session.service.js';

describe('SessionService', () => {
  let db: Database.Database;
  let service: SessionService;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Initialize schema
    db.exec(`
      CREATE TABLE sessions (
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

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    service = new SessionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createSession', () => {
    it('should create a DevOps session with correct defaults', () => {
      const session = service.createSession({
        name: 'AWS Migration',
        type: 'devops',
      });

      expect(session.id).toMatch(/^session_/);
      expect(session.name).toBe('AWS Migration');
      expect(session.type).toBe('devops');
      expect(session.status).toBe('active');
      expect(session.model).toBe('gpt-4.1');
      expect(session.customAgent).toBe('devops-mentor');
      expect(session.messageCount).toBe(0);
    });

    it('should create a Writing session', () => {
      const session = service.createSession({
        name: 'Email Draft',
        type: 'writing',
      });

      expect(session.type).toBe('writing');
      expect(session.customAgent).toBe('writing-assistant');
    });

    it('should create a General session without custom agent', () => {
      const session = service.createSession({
        name: 'General Chat',
        type: 'general',
      });

      expect(session.type).toBe('general');
      expect(session.customAgent).toBeUndefined();
    });

    it('should use custom model if provided', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
        model: 'gpt-5',
      });

      expect(session.model).toBe('gpt-5');
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const session = service.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should return existing session', () => {
      const created = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      const retrieved = service.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test');
    });
  });

  describe('listSessions', () => {
    it('should return empty list when no sessions exist', () => {
      const result = service.listSessions();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return all sessions', () => {
      service.createSession({ name: 'Session 1', type: 'devops' });
      service.createSession({ name: 'Session 2', type: 'writing' });
      service.createSession({ name: 'Session 3', type: 'general' });

      const result = service.listSessions();
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should paginate correctly', () => {
      for (let i = 0; i < 5; i++) {
        service.createSession({ name: `Session ${i}`, type: 'general' });
      }

      const page1 = service.listSessions(1, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = service.listSessions(2, 2);
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(true);

      const page3 = service.listSessions(3, 2);
      expect(page3.items).toHaveLength(1);
      expect(page3.hasMore).toBe(false);
    });
  });

  describe('updateSession', () => {
    it('should update session name', () => {
      const session = service.createSession({
        name: 'Old Name',
        type: 'devops',
      });

      const updated = service.updateSession(session.id, { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
    });

    it('should update session status', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      const updated = service.updateSession(session.id, { status: 'paused' });
      expect(updated!.status).toBe('paused');
    });

    it('should update session model', () => {
      const session = service.createSession({
        name: 'Model Switch',
        type: 'devops',
      });

      const updated = service.updateSession(session.id, { model: 'gpt-5-mini' });
      expect(updated!.model).toBe('gpt-5-mini');
    });

    it('should return null for non-existent session', () => {
      const result = service.updateSession('non-existent', { name: 'New' });
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      const deleted = service.deleteSession(session.id);
      expect(deleted).toBe(true);
      expect(service.getSession(session.id)).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const deleted = service.deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('messages', () => {
    it('should add message to session', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      const message = service.addMessage(session.id, 'user', 'Hello!');
      
      expect(message.id).toMatch(/^msg_/);
      expect(message.sessionId).toBe(session.id);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
    });

    it('should increment message count', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      expect(service.getSession(session.id)!.messageCount).toBe(0);

      service.addMessage(session.id, 'user', 'Hello!');
      expect(service.getSession(session.id)!.messageCount).toBe(1);

      service.addMessage(session.id, 'assistant', 'Hi there!');
      expect(service.getSession(session.id)!.messageCount).toBe(2);
    });

    it('should list messages in order', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      service.addMessage(session.id, 'user', 'First');
      service.addMessage(session.id, 'assistant', 'Second');
      service.addMessage(session.id, 'user', 'Third');

      const result = service.listMessages(session.id);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].content).toBe('First');
      expect(result.items[1].content).toBe('Second');
      expect(result.items[2].content).toBe('Third');
    });

    it('should store message metadata', () => {
      const session = service.createSession({
        name: 'Test',
        type: 'devops',
      });

      service.addMessage(session.id, 'user', 'Explain this', {
        pageUrl: 'https://example.com',
        selectedText: 'some code',
        action: 'explain',
      });

      const messages = service.listMessages(session.id);
      expect(messages.items[0].metadata).toEqual({
        pageUrl: 'https://example.com',
        selectedText: 'some code',
        action: 'explain',
      });
    });
  });
});
