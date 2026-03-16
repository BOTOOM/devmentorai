/**
 * Session type definitions for DevMentorAI
 */
export type SessionType = 'devops' | 'writing' | 'development' | 'general';
export type SessionStatus = 'active' | 'paused' | 'closed';
export declare const SUPPORTED_LLM_PROVIDERS: readonly ["copilot", "openrouter", "groq", "gemini-cli", "claude-code", "kilo-code", "ollama", "lmstudio", "bedrock", "vertex-ai", "azure-foundry"];
export type LLMProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];
export type ProviderCategory = 'cloud' | 'cli-agent' | 'local-server';
export interface ProviderDisplayConfig {
    name: string;
    icon: string;
    category: ProviderCategory;
    description: string;
}
export declare const PROVIDER_DISPLAY: Record<LLMProvider, ProviderDisplayConfig>;
export declare const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string>;
export declare const PROVIDER_CATEGORY_ORDER: ProviderCategory[];
export interface ProviderCapabilities {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    attachments: boolean;
    reasoningEffort: boolean;
    conversationHistory: boolean;
}
export declare const PROVIDER_CAPABILITIES: Record<LLMProvider, ProviderCapabilities>;
export interface Session {
    id: string;
    name: string;
    type: SessionType;
    status: SessionStatus;
    provider: LLMProvider;
    model: string;
    systemPrompt?: string;
    customAgent?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    pageContext?: PageContext;
}
export interface PageContext {
    url: string;
    title: string;
    selectedText?: string;
}
export interface CreateSessionRequest {
    name: string;
    type: SessionType;
    provider?: LLMProvider;
    model?: string;
    systemPrompt?: string;
}
export interface UpdateSessionRequest {
    name?: string;
    status?: SessionStatus;
    provider?: LLMProvider;
    model?: string;
}
//# sourceMappingURL=session.d.ts.map