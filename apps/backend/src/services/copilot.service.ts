import { CopilotClient, type SessionEvent } from '@github/copilot-sdk';
import { SessionService } from './session.service.js';
import { getAgentConfig, SESSION_TYPE_CONFIGS } from '@devmentorai/shared';
import type { SessionType, MessageContext } from '@devmentorai/shared';
import { devopsTools, getToolByName, type Tool } from '../tools/devops-tools.js';

interface CopilotSession {
  sessionId: string;
  session: Awaited<ReturnType<CopilotClient['createSession']>>;
  type: SessionType;
}

interface MCPServerConfig {
  type: 'http' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
}

// MCP server configurations for different integrations
const MCP_SERVERS: Record<string, MCPServerConfig> = {
  github: {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
  },
  // Future: Add more MCP servers like filesystem, database, etc.
};

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
    systemPrompt?: string,
    enableMcp: boolean = false
  ): Promise<void> {
    if (this.mockMode || !this.client) {
      // Create mock session
      this.sessions.set(sessionId, {
        sessionId,
        session: null as any,
        type,
      });
      return;
    }

    const agentConfig = getAgentConfig(type);
    const typeConfig = SESSION_TYPE_CONFIGS[type];

    // Build tools for DevOps sessions
    const tools = type === 'devops' ? this.buildToolDefinitions() : undefined;

    // Build MCP server config if enabled
    const mcpServers = enableMcp ? MCP_SERVERS : undefined;

    const session = await this.client.createSession({
      sessionId,
      model: model || typeConfig.defaultModel,
      streaming: true,
      customAgents: agentConfig ? [agentConfig] : undefined,
      systemMessage: systemPrompt ? { content: systemPrompt } : undefined,
      tools,
      mcpServers,
    });

    // Set up tool execution handler
    if (tools) {
      session.on((event: SessionEvent) => {
        if (event.type === 'tool.execution_start') {
          this.handleToolExecution(sessionId, event);
        }
      });
    }

    this.sessions.set(sessionId, { sessionId, session, type });
  }

  /**
   * Build tool definitions from DevOps tools for Copilot SDK
   */
  private buildToolDefinitions(): Record<string, unknown>[] {
    return devopsTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Handle tool execution requests from Copilot
   */
  private async handleToolExecution(sessionId: string, event: SessionEvent): Promise<void> {
    const { toolName, toolCallId, input } = event.data as {
      toolName: string;
      toolCallId: string;
      input: Record<string, unknown>;
    };

    const tool = getToolByName(toolName);
    if (!tool) {
      console.warn(`[CopilotService] Unknown tool: ${toolName}`);
      return;
    }

    try {
      console.log(`[CopilotService] Executing tool ${toolName} for session ${sessionId}`);
      const result = await tool.handler(input);
      
      // Send tool result back to Copilot
      const copilotSession = this.sessions.get(sessionId);
      if (copilotSession?.session) {
        copilotSession.session.sendToolResult(toolCallId, result);
      }
    } catch (error) {
      console.error(`[CopilotService] Tool ${toolName} failed:`, error);
      const copilotSession = this.sessions.get(sessionId);
      if (copilotSession?.session) {
        copilotSession.session.sendToolResult(
          toolCallId, 
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
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
    return this.withRetry(async () => {
      const copilotSession = this.sessions.get(sessionId);
      
      // Note: The prompt should already be enriched with context by the route
      // We only add basic context fallback if the prompt doesn't contain it
      let fullPrompt = prompt;
      if (context?.selectedText && !prompt.includes(context.selectedText)) {
        fullPrompt = `Context (selected text):\n${context.selectedText}\n\nUser request: ${prompt}`;
      }
      if (context?.pageUrl && !prompt.includes(context.pageUrl)) {
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

      // Send message - no systemMessage override to preserve Copilot's intelligence
      // The customAgents from session creation provide the persona/expertise
      const response = await copilotSession.session.sendAndWait({ prompt: fullPrompt });
      console.log(`[CopilotService] Received response for session ${sessionId}`);
      console.log(`[CopilotService] Response: ${response?.data}...`);
      console.log(`[CopilotService] responseContent: ${responseContent}...`);
      
      return response?.data.content || responseContent;
    }, 3, 1000);
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    context?: MessageContext,
    onEvent?: (event: SessionEvent) => void,
    attachments?: Array<{ type: 'file' | 'directory'; path: string; displayName?: string }>
  ): Promise<void> {
    const copilotSession = this.sessions.get(sessionId);

    // Note: The prompt should already be enriched with context by the route
    // We only add basic context fallback if the prompt doesn't contain it
    let fullPrompt = prompt;
    if (context?.selectedText && !prompt.includes(context.selectedText)) {
      fullPrompt = `Context (selected text):\n${context.selectedText}\n\nUser request: ${prompt}`;
    }

    if (this.mockMode || !copilotSession?.session) {
      // Mock streaming response
      console.log('[CopilotService] Streaming mock response');
      await this.streamMockResponse(prompt, context, onEvent);
      return;
    }

    console.log('[CopilotService] Starting real stream for session', sessionId);
    if (attachments && attachments.length > 0) {
      console.log(`[CopilotService] Sending ${attachments.length} attachments:`, attachments.map(a => a.path));
    }
    
    // Set up event listener
    if (onEvent) {
      copilotSession.session.on(onEvent);
    }

    // Send message with attachments if provided
    // The customAgents from session creation provide the persona/expertise
    copilotSession.session.send({ 
      prompt: fullPrompt,
      attachments: attachments,
    });
    console.log('[CopilotService] Message sent, waiting for events...');
  }

  /**
   * Retry logic for transient errors
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        const nonRetryableErrors = ['authentication', 'invalid_session', 'rate_limit'];
        if (nonRetryableErrors.some(e => lastError!.message.toLowerCase().includes(e))) {
          throw lastError;
        }
        
        if (attempt < maxRetries) {
          console.warn(`[CopilotService] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get available tools for a session type
   */
  getAvailableTools(type: SessionType): Array<{ name: string; description: string }> {
    if (type === 'devops') {
      return devopsTools.map(t => ({ name: t.name, description: t.description }));
    }
    return [];
  }

  /**
   * Execute a tool directly (for testing or standalone use)
   */
  async executeTool(
    toolName: string, 
    params: Record<string, unknown>
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const tool = getToolByName(toolName);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    
    try {
      const result = await tool.handler(params);
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
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
      try {
        // Abort any pending requests first
        await copilotSession.session.abort().catch(() => {});
        // Destroy the session (releases resources but doesn't delete files)
        await copilotSession.session.destroy();
        console.log(`[CopilotService] Session ${sessionId} destroyed successfully`);
      } catch (error) {
        console.error(`[CopilotService] Error destroying session ${sessionId}:`, error);
        // Continue with cleanup even if destroy fails
      }
    }
    
    // Delete session data from disk using SDK's deleteSession
    if (this.client && !this.mockMode) {
      try {
        await this.client.deleteSession(sessionId);
        console.log(`[CopilotService] Session ${sessionId} files deleted from disk`);
      } catch (error) {
        // Session might not exist on disk, that's OK
        console.log(`[CopilotService] Could not delete session files (may not exist): ${sessionId}`);
      }
    }
    
    // Remove from in-memory map
    this.sessions.delete(sessionId);
    console.log(`[CopilotService] Session ${sessionId} removed from memory`);
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
