/**
 * Message type definitions for DevMentorAI
 */
export type MessageRole = 'user' | 'assistant' | 'system';
export interface Message {
    id: string;
    sessionId: string;
    role: MessageRole;
    content: string;
    timestamp: string;
    metadata?: MessageMetadata;
}
export interface MessageMetadata {
    pageUrl?: string;
    selectedText?: string;
    action?: QuickAction;
    toolCalls?: ToolCall[];
    streamComplete?: boolean;
}
export type QuickAction = 'explain' | 'translate' | 'rewrite' | 'fix_grammar' | 'summarize' | 'expand' | 'analyze_config' | 'diagnose_error';
export interface ToolCall {
    toolName: string;
    toolCallId: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    result?: unknown;
}
export interface SendMessageRequest {
    prompt: string;
    context?: MessageContext;
}
export interface MessageContext {
    pageUrl?: string;
    pageTitle?: string;
    selectedText?: string;
    action?: QuickAction;
}
export interface StreamEvent {
    type: StreamEventType;
    data: StreamEventData;
}
export type StreamEventType = 'message_start' | 'message_delta' | 'message_complete' | 'tool_start' | 'tool_complete' | 'error' | 'done';
export interface StreamEventData {
    content?: string;
    deltaContent?: string;
    toolName?: string;
    toolCallId?: string;
    error?: string;
    messageId?: string;
}
//# sourceMappingURL=message.d.ts.map