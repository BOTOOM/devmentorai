/**
 * Session type definitions for DevMentorAI
 */
export type SessionType = 'devops' | 'writing' | 'development' | 'general';
export type SessionStatus = 'active' | 'paused' | 'closed';
export interface Session {
    id: string;
    name: string;
    type: SessionType;
    status: SessionStatus;
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
    model?: string;
    systemPrompt?: string;
}
export interface UpdateSessionRequest {
    name?: string;
    status?: SessionStatus;
}
//# sourceMappingURL=session.d.ts.map