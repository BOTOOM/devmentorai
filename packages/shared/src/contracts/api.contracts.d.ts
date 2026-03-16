/**
 * API contract definitions for DevMentorAI
 * These define the endpoints and their request/response types
 */
import type { Session, CreateSessionRequest, UpdateSessionRequest, Message, SendMessageRequest, ApiResponse, PaginatedResponse, HealthResponse, ModelInfo, ProviderAuthStatus, ProviderQuotaStatus, ProviderCredentialStatus, SetProviderCredentialRequest } from '../types/index.js';
/**
 * Backend API endpoints contract
 */
export declare const API_ENDPOINTS: {
    readonly HEALTH: "/api/health";
    readonly SESSIONS: "/api/sessions";
    readonly SESSION: (id: string) => string;
    readonly SESSION_RESUME: (id: string) => string;
    readonly SESSION_ABORT: (id: string) => string;
    readonly SESSION_MESSAGES: (id: string) => string;
    readonly CHAT: (sessionId: string) => string;
    readonly CHAT_STREAM: (sessionId: string) => string;
    readonly IMAGE_UPLOAD: (sessionId: string) => string;
    readonly MODELS: "/api/models";
    readonly ACCOUNT_AUTH: "/api/account/auth";
    readonly ACCOUNT_QUOTA: "/api/account/quota";
    readonly ACCOUNT_CREDENTIAL: (provider: string) => string;
};
/**
 * API endpoint type definitions
 */
export interface ApiEndpoints {
    'GET /api/health': {
        response: ApiResponse<HealthResponse>;
    };
    'GET /api/sessions': {
        response: ApiResponse<PaginatedResponse<Session>>;
    };
    'POST /api/sessions': {
        body: CreateSessionRequest;
        response: ApiResponse<Session>;
    };
    'GET /api/sessions/:id': {
        params: {
            id: string;
        };
        response: ApiResponse<Session>;
    };
    'PATCH /api/sessions/:id': {
        params: {
            id: string;
        };
        body: UpdateSessionRequest;
        response: ApiResponse<Session>;
    };
    'DELETE /api/sessions/:id': {
        params: {
            id: string;
        };
        response: ApiResponse<void>;
    };
    'POST /api/sessions/:id/resume': {
        params: {
            id: string;
        };
        response: ApiResponse<Session>;
    };
    'POST /api/sessions/:id/abort': {
        params: {
            id: string;
        };
        response: ApiResponse<void>;
    };
    'GET /api/sessions/:id/messages': {
        params: {
            id: string;
        };
        response: ApiResponse<PaginatedResponse<Message>>;
    };
    'POST /api/sessions/:id/chat': {
        params: {
            id: string;
        };
        body: SendMessageRequest;
        response: ApiResponse<Message>;
    };
    'POST /api/sessions/:id/chat/stream': {
        params: {
            id: string;
        };
        body: SendMessageRequest;
        response: ReadableStream;
    };
    'POST /api/sessions/:id/images/upload': {
        params: {
            id: string;
        };
        body: {
            images: Array<{
                id: string;
                dataUrl: string;
                mimeType: string;
                source: string;
            }>;
        };
        response: ApiResponse<{
            images: Array<{
                id: string;
                thumbnailUrl: string;
                fullImageUrl: string;
                fullImagePath: string;
            }>;
        }>;
    };
    'GET /api/models': {
        query?: {
            provider?: string;
        };
        response: ApiResponse<{
            models: ModelInfo[];
            default: string;
        }>;
    };
    'GET /api/account/auth': {
        query?: {
            provider?: string;
        };
        response: ApiResponse<ProviderAuthStatus>;
    };
    'GET /api/account/quota': {
        query?: {
            provider?: string;
        };
        response: ApiResponse<ProviderQuotaStatus>;
    };
    'GET /api/account/credentials/:provider': {
        params: {
            provider: string;
        };
        response: ApiResponse<ProviderCredentialStatus>;
    };
    'PUT /api/account/credentials/:provider': {
        params: {
            provider: string;
        };
        body: SetProviderCredentialRequest;
        response: ApiResponse<ProviderCredentialStatus>;
    };
    'DELETE /api/account/credentials/:provider': {
        params: {
            provider: string;
        };
        response: ApiResponse<ProviderCredentialStatus>;
    };
}
/**
 * Default configuration values
 */
export declare const DEFAULT_CONFIG: {
    readonly DEFAULT_MODEL: "gpt-4.1";
    readonly DEFAULT_PORT: 3847;
    readonly DEFAULT_HOST: "localhost";
    readonly REQUEST_TIMEOUT_MS: 60000;
    readonly STREAM_TIMEOUT_MS: 300000;
};
//# sourceMappingURL=api.contracts.d.ts.map