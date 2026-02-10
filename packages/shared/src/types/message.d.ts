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
export type ImageSource = 'screenshot' | 'paste' | 'drop';
export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export interface ImageAttachment {
    id: string;
    source: ImageSource;
    mimeType: ImageMimeType;
    dimensions: {
        width: number;
        height: number;
    };
    fileSize: number;
    timestamp: string;
    /** Original base64 data URL - only present in draft/request, not persisted */
    dataUrl?: string;
    /** Backend-provided thumbnail URL for display in chat history */
    thumbnailUrl?: string;
    /** Backend-provided full image URL for lightbox view */
    fullImageUrl?: string;
}
/** Image data sent in message request (before processing) */
export interface ImagePayload {
    id: string;
    dataUrl: string;
    mimeType: ImageMimeType;
    source: ImageSource;
}
/** Constants for image handling */
export declare const IMAGE_CONSTANTS: {
    readonly MAX_IMAGES_PER_MESSAGE: 5;
    readonly MAX_IMAGE_SIZE_BYTES: number;
    readonly SUPPORTED_MIME_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
    readonly THUMBNAIL_MAX_DIMENSION: 200;
    readonly THUMBNAIL_QUALITY: 60;
};
export interface MessageMetadata {
    pageUrl?: string;
    selectedText?: string;
    action?: QuickAction;
    toolCalls?: ToolCall[];
    streamComplete?: boolean;
    /** Attached images for this message */
    images?: ImageAttachment[];
    /** Whether context-aware mode was used */
    contextAware?: boolean;
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
    /** Full extracted context payload for context-aware mode */
    fullContext?: unknown;
    /** Whether to use context-aware mode */
    useContextAwareMode?: boolean;
    /** Images to attach to this message */
    images?: ImagePayload[];
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
    reason?: string;
}
//# sourceMappingURL=message.d.ts.map