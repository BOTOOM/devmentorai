import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { CopilotService } from '../../src/services/copilot.service';
import { SessionService } from '../../src/services/session.service';

// Mock the Copilot SDK
vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockRejectedValue(new Error('Mock: Copilot CLI not available')),
    stop: vi.fn().mockResolvedValue([]),
    createSession: vi.fn(),
    resumeSession: vi.fn(),
  })),
}));

describe('CopilotService', () => {
  let db: Database.Database;
  let sessionService: SessionService;
  let copilotService: CopilotService;

  beforeEach(() => {
    db = new Database(':memory:');
    
    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        model TEXT,
        system_prompt TEXT,
        custom_agent TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    sessionService = new SessionService(db);
    copilotService = new CopilotService(sessionService);
  });

  afterEach(async () => {
    await copilotService.shutdown();
    db.close();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize in mock mode when Copilot CLI is not available', async () => {
      await copilotService.initialize();
      
      expect(copilotService.isReady()).toBe(true);
      expect(copilotService.isMockMode()).toBe(true);
    });

    it('should report ready state after initialization', async () => {
      expect(copilotService.isReady()).toBe(false);
      
      await copilotService.initialize();
      
      expect(copilotService.isReady()).toBe(true);
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await copilotService.initialize();
    });

    it('should create a mock session for DevOps type', async () => {
      await copilotService.createCopilotSession(
        'test-session-1',
        'devops',
        'gpt-4.1'
      );
      
      // Should not throw in mock mode
      expect(copilotService.isMockMode()).toBe(true);
    });

    it('should create a mock session for Writing type', async () => {
      await copilotService.createCopilotSession(
        'test-session-2',
        'writing',
        'gpt-4.1'
      );
      
      expect(copilotService.isMockMode()).toBe(true);
    });

    it('should create a mock session with custom system prompt', async () => {
      await copilotService.createCopilotSession(
        'test-session-3',
        'general',
        'gpt-4.1',
        'Custom system prompt for testing'
      );
      
      expect(copilotService.isMockMode()).toBe(true);
    });

    it('should resume session in mock mode', async () => {
      const result = await copilotService.resumeCopilotSession('any-session-id');
      
      expect(result).toBe(true);
    });

    it('should destroy session without error', async () => {
      await copilotService.createCopilotSession(
        'test-session-4',
        'devops',
        'gpt-4.1'
      );
      
      // Should not throw
      await copilotService.destroySession('test-session-4');
    });
  });

  describe('mock message handling', () => {
    beforeEach(async () => {
      await copilotService.initialize();
      await copilotService.createCopilotSession(
        'mock-session',
        'devops',
        'gpt-4.1'
      );
    });

    it('should generate mock response for explain action', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'Explain this code',
        { action: 'explain', selectedText: 'const x = 1;' }
      );
      
      expect(response).toContain('Explanation');
    });

    it('should generate mock response for translate action', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'Translate this',
        { action: 'translate', selectedText: 'Hello world' }
      );
      
      expect(response).toContain('Translation');
    });

    it('should generate mock response for rewrite action', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'Rewrite this text',
        { action: 'rewrite', selectedText: 'Original text' }
      );
      
      expect(response).toContain('Rewritten');
    });

    it('should generate mock response for fix_grammar action', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'Fix grammar',
        { action: 'fix_grammar', selectedText: 'Me has error' }
      );
      
      expect(response).toContain('Corrected');
    });

    it('should generate generic mock response for regular prompts', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'What is Kubernetes?'
      );
      
      expect(response).toContain('Mock Response');
      expect(response).toContain('Copilot SDK is not available');
    });

    it('should include context in response when provided', async () => {
      const response = await copilotService.sendMessage(
        'mock-session',
        'Analyze this',
        { 
          pageUrl: 'https://example.com',
          pageTitle: 'Example Page',
          selectedText: 'Some selected text'
        }
      );
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('streaming', () => {
    beforeEach(async () => {
      await copilotService.initialize();
      await copilotService.createCopilotSession(
        'stream-session',
        'devops',
        'gpt-4.1'
      );
    });

    it('should stream mock response with events', async () => {
      const events: any[] = [];
      
      await copilotService.streamMessage(
        'stream-session',
        'Hello',
        undefined,
        (event) => events.push(event)
      );
      
      // Should receive delta events and final message
      expect(events.length).toBeGreaterThan(0);
      
      const deltaEvents = events.filter(e => e.type === 'assistant.message_delta');
      const messageEvent = events.find(e => e.type === 'assistant.message');
      const idleEvent = events.find(e => e.type === 'session.idle');
      
      expect(deltaEvents.length).toBeGreaterThan(0);
      expect(messageEvent).toBeDefined();
      expect(idleEvent).toBeDefined();
    });

    it('should include selected text context in streaming', async () => {
      const events: any[] = [];
      
      await copilotService.streamMessage(
        'stream-session',
        'Explain',
        { action: 'explain', selectedText: 'test code' },
        (event) => events.push(event)
      );
      
      const messageEvent = events.find(e => e.type === 'assistant.message');
      expect(messageEvent?.data.content).toContain('Explanation');
    });

    it('should reject when SDK stream send fails (no silent unhandled rejection)', async () => {
      const send = vi.fn().mockRejectedValue(new Error('Mock send failure'));
      const on = vi.fn();

      (copilotService as any).mockMode = false;
      (copilotService as any).sessions.set('real-stream-session', {
        sessionId: 'real-stream-session',
        session: { send, on },
        type: 'general',
      });

      await expect(
        copilotService.streamMessage(
          'real-stream-session',
          'Trigger stream',
          undefined,
          vi.fn()
        )
      ).rejects.toThrow('Mock send failure');
    });
  });

  describe('abort and cleanup', () => {
    beforeEach(async () => {
      await copilotService.initialize();
    });

    it('should abort request without error in mock mode', async () => {
      await copilotService.createCopilotSession(
        'abort-session',
        'devops',
        'gpt-4.1'
      );
      
      // Should not throw
      await copilotService.abortRequest('abort-session');
    });

    it('should abort non-existent session without error', async () => {
      // Should not throw
      await copilotService.abortRequest('non-existent');
    });

    it('should shutdown cleanly', async () => {
      await copilotService.createCopilotSession(
        'shutdown-session',
        'devops',
        'gpt-4.1'
      );
      
      // Should not throw
      await copilotService.shutdown();
      
      expect(copilotService.isReady()).toBe(false);
    });
  });

  describe('session types', () => {
    beforeEach(async () => {
      await copilotService.initialize();
    });

    it('should support all session types', async () => {
      const types = ['devops', 'writing', 'development', 'general'] as const;
      
      for (const type of types) {
        await copilotService.createCopilotSession(
          `session-${type}`,
          type,
          'gpt-4.1'
        );
        
        const response = await copilotService.sendMessage(
          `session-${type}`,
          'Test message'
        );
        
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
      }
    });
  });
});
