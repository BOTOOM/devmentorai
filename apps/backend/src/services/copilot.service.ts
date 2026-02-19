import { CopilotClient, type SessionEvent, type Tool as CopilotTool } from '@github/copilot-sdk';
import { SessionService } from './session.service.js';
import { getAgentConfig, SESSION_TYPE_CONFIGS } from '@devmentorai/shared';
import type {
  SessionType,
  MessageContext,
  ModelInfo,
  CopilotAuthStatus,
  CopilotQuotaStatus,
  ModelPricingTier,
} from '@devmentorai/shared';
import { devopsTools, getToolByName } from '../tools/devops-tools.js';

interface CopilotSession {
  sessionId: string;
  session: Awaited<ReturnType<CopilotClient['createSession']>>;
  type: SessionType;
}

// MCP server configurations for different integrations
const MCP_SERVERS: Record<string, { type: 'http'; url: string; tools: string[] }> = {
  github: {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    tools: ['*'],
  },
};

const RECOMMENDED_DEFAULT_MODEL = 'gpt-4.1';

interface RawSdkModel {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  provider?: unknown;
  isDefault?: unknown;
  billing?: {
    multiplier?: unknown;
  };
  supportedReasoningEfforts?: unknown;
}

export class CopilotService {
  private client: CopilotClient | null = null;
  private readonly sessions: Map<string, CopilotSession> = new Map();
  private initialized = false;
  private mockMode = false;

  constructor(private readonly sessionService: SessionService) {}

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

  async getAuthStatus(): Promise<CopilotAuthStatus> {
    if (this.mockMode || !this.client) {
      return {
        isAuthenticated: false,
        login: null,
        reason: 'Copilot SDK unavailable (mock mode)',
      };
    }

    try {
      const client = this.client as unknown as {
        getAuthStatus?: () => Promise<{ isAuthenticated?: unknown; login?: unknown }>;
      };

      if (!client.getAuthStatus) {
        return {
          isAuthenticated: false,
          login: null,
          reason: 'Copilot auth API not available in this SDK version',
        };
      }

      const auth = await client.getAuthStatus();
      return {
        isAuthenticated: Boolean(auth?.isAuthenticated),
        login: typeof auth?.login === 'string' ? auth.login : null,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        login: null,
        reason: error instanceof Error ? error.message : 'Failed to get auth status',
      };
    }
  }

  async listModels(): Promise<{ models: ModelInfo[]; default: string }> {
    if (this.mockMode || !this.client) {
      return { models: [], default: RECOMMENDED_DEFAULT_MODEL };
    }

    try {
      const client = this.client as unknown as {
        listModels?: () => Promise<RawSdkModel[]>;
      };

      if (!client.listModels) {
        return { models: [], default: RECOMMENDED_DEFAULT_MODEL };
      }

      const rawModels = await client.listModels();
      if (!Array.isArray(rawModels)) {
        return { models: [], default: RECOMMENDED_DEFAULT_MODEL };
      }

      const models = rawModels
        .map((raw) => this.normalizeModel(raw))
        .filter((model): model is ModelInfo => Boolean(model?.id));

      const recommendedAvailable = models.some((model) => model.id === RECOMMENDED_DEFAULT_MODEL);
      const sdkDefault = models.find((model) => model.isDefault)?.id;
      const fallbackFirst = models[0]?.id;

      const defaultModel =
        (recommendedAvailable && RECOMMENDED_DEFAULT_MODEL) ||
        sdkDefault ||
        fallbackFirst ||
        RECOMMENDED_DEFAULT_MODEL;

      const modelsWithDefaultFlag = models.map((model) => ({
        ...model,
        isDefault: model.id === defaultModel,
      }));

      return { models: modelsWithDefaultFlag, default: defaultModel };
    } catch (error) {
      console.error('[CopilotService] Failed to list models:', error);
      return { models: [], default: RECOMMENDED_DEFAULT_MODEL };
    }
  }

  async getQuota(): Promise<CopilotQuotaStatus> {
    if (this.mockMode || !this.client) {
      return {
        used: null,
        included: null,
        remaining: null,
        percentageUsed: null,
        percentageRemaining: null,
        raw: {},
      };
    }

    try {
      const client = this.client as unknown as {
        rpc?: {
          account?: {
            getQuota?: () => Promise<unknown>;
          };
        };
      };

      const quotaData = await client.rpc?.account?.getQuota?.();
      if (!quotaData || typeof quotaData !== 'object') {
        return {
          used: null,
          included: null,
          remaining: null,
          percentageUsed: null,
          percentageRemaining: null,
          raw: {},
        };
      }

      return this.normalizeQuota(quotaData as Record<string, unknown>);
    } catch (error) {
      return {
        used: null,
        included: null,
        remaining: null,
        percentageUsed: null,
        percentageRemaining: null,
        raw: {
          error: error instanceof Error ? error.message : 'Failed to get quota',
        },
      };
    }
  }

  async switchSessionModel(
    sessionId: string,
    type: SessionType,
    model: string,
    systemPrompt?: string
  ): Promise<void> {
    const existing = this.sessions.get(sessionId);

    if (existing?.session && !this.mockMode) {
      try {
        await existing.session.abort().catch(() => undefined);
        await existing.session.destroy();
      } catch (error) {
        console.warn(`[CopilotService] Failed to destroy previous session before model switch: ${sessionId}`, error);
      }
    }

    this.sessions.delete(sessionId);

    if (this.client && !this.mockMode) {
      try {
        await this.client.deleteSession(sessionId);
      } catch {
        // Ignore when session files don't exist yet.
      }
    }

    await this.createCopilotSession(sessionId, type, model, systemPrompt);
  }

  private normalizeModel(raw: RawSdkModel): ModelInfo {
    const id = typeof raw.id === 'string' ? raw.id : '';
    const name = typeof raw.name === 'string' ? raw.name : id;
    const description =
      typeof raw.description === 'string' && raw.description.trim().length > 0
        ? raw.description
        : `AI model ${id}`;
    const provider =
      typeof raw.provider === 'string' && raw.provider.trim().length > 0
        ? raw.provider
        : this.inferProviderFromModelId(id);
    const multiplier =
      typeof raw.billing?.multiplier === 'number' && Number.isFinite(raw.billing.multiplier)
        ? raw.billing.multiplier
        : undefined;
    const supportedReasoningEfforts = Array.isArray(raw.supportedReasoningEfforts)
      ? raw.supportedReasoningEfforts.filter((effort): effort is string => typeof effort === 'string')
      : undefined;

    return {
      id,
      name,
      description,
      provider,
      available: true,
      isDefault: Boolean(raw.isDefault),
      pricingMultiplier: multiplier,
      pricingTier: this.mapPricingTier(multiplier),
      supportedReasoningEfforts,
    };
  }

  private inferProviderFromModelId(modelId: string): string {
    const normalized = modelId.toLowerCase();
    if (normalized.startsWith('gpt')) return 'openai';
    if (normalized.startsWith('claude')) return 'anthropic';
    if (normalized.startsWith('gemini')) return 'google';
    return 'unknown';
  }

  private mapPricingTier(multiplier?: number): ModelPricingTier {
    if (multiplier === 0) return 'free';
    if (typeof multiplier === 'number' && multiplier > 0 && multiplier < 1) return 'cheap';
    if (typeof multiplier === 'number' && multiplier > 1) return 'premium';
    return 'standard';
  }

  private normalizeQuota(raw: Record<string, unknown>): CopilotQuotaStatus {
    const used = this.readNumber(raw, ['used', 'consumed', 'usage', 'quotaUsed', 'totalUsed']);
    const included = this.readNumber(raw, ['included', 'limit', 'quota', 'total', 'quotaTotal', 'allowed']);
    const computedRemaining =
      typeof included === 'number' && typeof used === 'number' ? Math.max(included - used, 0) : null;
    const remaining = this.readNumber(raw, ['remaining', 'left', 'available']) ?? computedRemaining;

    const computedPercentageUsed =
      typeof included === 'number' && included > 0 && typeof used === 'number'
        ? Math.min(100, (used / included) * 100)
        : null;
    const percentageUsed =
      this.readNumber(raw, ['percentageUsed', 'usedPercent', 'percentUsed']) ?? computedPercentageUsed;
    const percentageRemaining =
      this.readNumber(raw, ['percentageRemaining', 'remainingPercent', 'percentRemaining']) ??
      (typeof percentageUsed === 'number' ? Math.max(0, 100 - percentageUsed) : null);

    return {
      used,
      included,
      remaining,
      percentageUsed,
      percentageRemaining,
      periodStart: this.readString(raw, ['periodStart', 'startAt', 'windowStart']),
      periodEnd: this.readString(raw, ['periodEnd', 'endAt', 'windowEnd']),
      raw,
    };
  }

  private readNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  private readString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) return value;
    }
    return null;
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

    // Build SDK-compatible tools for DevOps sessions
    // The SDK calls tool.handler() directly and uses the return value as the result
    const tools = type === 'devops' ? this.buildSdkTools() : undefined;

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

    this.sessions.set(sessionId, { sessionId, session, type });
  }

  /**
   * Convert our Tool definitions to Copilot SDK Tool format.
   * The SDK expects tools with a `handler` function — it calls the handler
   * directly and uses the return value as the tool result (no sendToolResult needed).
   */
  private buildSdkTools(): CopilotTool<any>[] {
    return devopsTools.map((tool): CopilotTool<any> => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      handler: async (args: Record<string, unknown>) => {
        console.log(`[CopilotService] Executing tool ${tool.name}`);
        try {
          return await tool.handler(args);
        } catch (error) {
          console.error(`[CopilotService] Tool ${tool.name} failed:`, error);
          return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    }));
  }

  async resumeCopilotSession(sessionId: string): Promise<boolean> {
    if (this.mockMode || !this.client) {
      return true;
    }

    // First, try to resume existing session
    try {
      const session = await this.client.resumeSession(sessionId);
      // Try to get type from DB, fallback to 'general'
      const dbSession = this.sessionService.getSession(sessionId);
      this.sessions.set(sessionId, { sessionId, session, type: dbSession?.type || 'general' });
      console.log(`[CopilotService] Session ${sessionId} resumed from disk`);
      return true;
    } catch (resumeError) {
      console.log(`[CopilotService] Could not resume session ${sessionId}, will try to create new`);
      console.log('[CopilotService] Resume error:', resumeError);
    }

    // If resume fails, try to create a new session using DB info
    try {
      const dbSession = this.sessionService.getSession(sessionId);
      if (!dbSession) {
        console.error(`[CopilotService] Session ${sessionId} not found in database`);
        return false;
      }

      // Create new Copilot session with same parameters
      await this.createCopilotSession(
        sessionId,
        dbSession.type,
        dbSession.model,
        dbSession.systemPrompt || undefined,
        false // MCP disabled by default on recreate
      );
      console.log(`[CopilotService] Session ${sessionId} recreated successfully`);
      return true;
    } catch (createError) {
      console.error(`[CopilotService] Failed to create session ${sessionId}:`, createError);
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
      console.log('[CopilotService] Response payload:', response?.data);
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
    let copilotSession = this.sessions.get(sessionId);

    // Auto-resume session if not in memory (e.g., after browser restart)
    if (!copilotSession?.session && !this.mockMode) {
      console.log(`[CopilotService] Session ${sessionId} not in memory, attempting auto-resume...`);
      const resumed = await this.resumeCopilotSession(sessionId);
      if (resumed) {
        copilotSession = this.sessions.get(sessionId);
        console.log(`[CopilotService] Session ${sessionId} auto-resumed successfully`);
      } else {
        console.warn(`[CopilotService] Failed to auto-resume session ${sessionId}, falling back to mock`);
      }
    }

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
    await copilotSession.session.send({
      prompt: fullPrompt,
      attachments,
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
        const errorMessage = (lastError?.message || '').toLowerCase();
        if (nonRetryableErrors.some(e => errorMessage.includes(e))) {
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
        console.log('[CopilotService] deleteSession error:', error);
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
