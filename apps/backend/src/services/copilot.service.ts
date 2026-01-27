import { CopilotClient, type SessionEvent } from '@github/copilot-sdk';
import { SessionService } from './session.service.js';
import { getAgentConfig, SESSION_TYPE_CONFIGS } from '@devmentorai/shared';
import type { SessionType, MessageContext } from '@devmentorai/shared';

interface CopilotSession {
  sessionId: string;
  session: Awaited<ReturnType<CopilotClient['createSession']>>;
}

export class CopilotService {
  private client: CopilotClient | null = null;
  private sessions: Map<string, CopilotSession> = new Map();
  private initialized = false;
  private mockMode = false;

  constructor(private sessionService: SessionService) {}

  async initialize(): Promise<void> {
    try {
      this.client = new CopilotClient();
      await this.client.start();
      this.initialized = true;
      console.log('[CopilotService] Initialized successfully');
    } catch (error) {
      console.error('[CopilotService] Failed to initialize:', error);
      this.mockMode = true;
      this.initialized = true;
      console.warn('[CopilotService] Running in mock mode');
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  isMockMode(): boolean {
    return this.mockMode;
  }

  async createCopilotSession(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    if (this.mockMode || !this.client) {
      // Create mock session
      this.sessions.set(sessionId, {
        sessionId,
        session: null as any,
      });
      return;
    }

    const agentConfig = getAgentConfig(type);
    const typeConfig = SESSION_TYPE_CONFIGS[type];

    const session = await this.client.createSession({
      sessionId,
      model: model || typeConfig.defaultModel,
      streaming: true,
      customAgents: agentConfig ? [agentConfig] : undefined,
      systemMessage: systemPrompt ? { content: systemPrompt } : undefined,
    });

    this.sessions.set(sessionId, { sessionId, session });
  }

  async resumeCopilotSession(sessionId: string): Promise<boolean> {
    if (this.mockMode || !this.client) {
      return true;
    }

    try {
      const session = await this.client.resumeSession(sessionId);
      this.sessions.set(sessionId, { sessionId, session });
      return true;
    } catch (error) {
      console.error(`[CopilotService] Failed to resume session ${sessionId}:`, error);
      return false;
    }
  }

  async sendMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<string> {
    const copilotSession = this.sessions.get(sessionId);
    
    // Build full prompt with context
    let fullPrompt = prompt;
    if (context?.selectedText) {
      fullPrompt = `Context (selected text):\n${context.selectedText}\n\nUser request: ${prompt}`;
    }
    if (context?.pageUrl) {
      fullPrompt = `Page: ${context.pageUrl}\n${fullPrompt}`;
    }

    if (this.mockMode || !copilotSession?.session) {
      // Mock response
      return this.generateMockResponse(prompt, context);
    }

    let responseContent = '';

    // Set up event listener
    if (onEvent) {
      copilotSession.session.on(onEvent);
    }

    copilotSession.session.on((event: SessionEvent) => {
      if (event.type === 'assistant.message') {
        responseContent = event.data.content || '';
      }
    });

    // Send and wait for response
    const response = await copilotSession.session.sendAndWait({ prompt: fullPrompt });
    
    return response?.data.content || responseContent;
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<void> {
    const copilotSession = this.sessions.get(sessionId);

    // Build full prompt with context
    let fullPrompt = prompt;
    if (context?.selectedText) {
      fullPrompt = `Context (selected text):\n${context.selectedText}\n\nUser request: ${prompt}`;
    }

    if (this.mockMode || !copilotSession?.session) {
      // Mock streaming response
      await this.streamMockResponse(prompt, context, onEvent);
      return;
    }

    // Set up event listener
    if (onEvent) {
      copilotSession.session.on(onEvent);
    }

    // Send message (don't wait, let events handle it)
    copilotSession.session.send({ prompt: fullPrompt });
  }

  async abortRequest(sessionId: string): Promise<void> {
    const copilotSession = this.sessions.get(sessionId);
    if (copilotSession?.session && !this.mockMode) {
      await copilotSession.session.abort();
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const copilotSession = this.sessions.get(sessionId);
    if (copilotSession?.session && !this.mockMode) {
      await copilotSession.session.destroy();
    }
    this.sessions.delete(sessionId);
  }

  async shutdown(): Promise<void> {
    // Destroy all sessions
    for (const [sessionId, copilotSession] of this.sessions) {
      try {
        if (copilotSession.session && !this.mockMode) {
          await copilotSession.session.destroy();
        }
      } catch (error) {
        console.error(`[CopilotService] Failed to destroy session ${sessionId}:`, error);
      }
    }
    this.sessions.clear();

    // Stop client
    if (this.client && !this.mockMode) {
      try {
        await this.client.stop();
      } catch (error) {
        console.error('[CopilotService] Failed to stop client:', error);
      }
    }

    this.initialized = false;
  }

  // Mock implementations for development without Copilot CLI
  private generateMockResponse(prompt: string, context?: MessageContext): string {
    const action = context?.action;
    
    if (action === 'explain') {
      return `**Explanation:**\n\nThis appears to be ${context?.selectedText?.slice(0, 50)}...\n\nIn essence, this code/text demonstrates a common pattern used in software development. The key points are:\n\n1. It handles a specific use case\n2. It follows best practices\n3. It can be extended for additional functionality`;
    }
    
    if (action === 'translate') {
      return `**Translation:**\n\n${context?.selectedText || 'No text provided'}`;
    }
    
    if (action === 'rewrite') {
      return `**Rewritten:**\n\n${context?.selectedText || prompt}`;
    }
    
    if (action === 'fix_grammar') {
      return `**Corrected:**\n\n${context?.selectedText || prompt}`;
    }

    return `**Mock Response:**\n\nI understand you're asking about: "${prompt.slice(0, 100)}..."\n\nThis is a mock response because the Copilot SDK is not available. In production, you would receive intelligent responses powered by GitHub Copilot.\n\nTo enable real responses:\n1. Install GitHub Copilot CLI\n2. Authenticate with your GitHub account\n3. Restart the DevMentorAI backend`;
  }

  private async streamMockResponse(
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void
  ): Promise<void> {
    const response = this.generateMockResponse(prompt, context);
    const words = response.split(' ');

    // Simulate streaming with delays
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      onEvent?.({
        type: 'assistant.message_delta',
        data: { deltaContent: words[i] + (i < words.length - 1 ? ' ' : '') },
      } as SessionEvent);
    }

    onEvent?.({
      type: 'assistant.message',
      data: { content: response },
    } as SessionEvent);

    onEvent?.({
      type: 'session.idle',
      data: {},
    } as SessionEvent);
  }
}
