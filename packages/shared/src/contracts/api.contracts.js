/**
 * API contract definitions for DevMentorAI
 * These define the endpoints and their request/response types
 */
/**
 * Backend API endpoints contract
 */
export const API_ENDPOINTS = {
    // Health
    HEALTH: '/api/health',
    // Sessions
    SESSIONS: '/api/sessions',
    SESSION: (id) => `/api/sessions/${id}`,
    SESSION_RESUME: (id) => `/api/sessions/${id}/resume`,
    SESSION_ABORT: (id) => `/api/sessions/${id}/abort`,
    SESSION_MESSAGES: (id) => `/api/sessions/${id}/messages`,
    // Chat
    CHAT: (sessionId) => `/api/sessions/${sessionId}/chat`,
    CHAT_STREAM: (sessionId) => `/api/sessions/${sessionId}/chat/stream`,
    // Models
    MODELS: '/api/models',
};
/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    DEFAULT_MODEL: 'gpt-4.1',
    DEFAULT_PORT: 3847,
    DEFAULT_HOST: 'localhost',
    REQUEST_TIMEOUT_MS: 60000,
    STREAM_TIMEOUT_MS: 300000,
};
//# sourceMappingURL=api.contracts.js.map