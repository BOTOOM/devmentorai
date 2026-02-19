/**
 * API contract definitions for DevMentorAI
 * These define the endpoints and their request/response types
 */

import type {
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
  Message,
  SendMessageRequest,
  ApiResponse,
  PaginatedResponse,
  HealthResponse,
  ModelInfo,
  CopilotAuthStatus,
  CopilotQuotaStatus,
} from '../types/index.js';

/**
 * Backend API endpoints contract
 */
export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',
  
  // Sessions
  SESSIONS: '/api/sessions',
  SESSION: (id: string) => `/api/sessions/${id}`,
  SESSION_RESUME: (id: string) => `/api/sessions/${id}/resume`,
  SESSION_ABORT: (id: string) => `/api/sessions/${id}/abort`,
  SESSION_MESSAGES: (id: string) => `/api/sessions/${id}/messages`,
  
  // Chat
  CHAT: (sessionId: string) => `/api/sessions/${sessionId}/chat`,
  CHAT_STREAM: (sessionId: string) => `/api/sessions/${sessionId}/chat/stream`,
  
  // Models
  MODELS: '/api/models',

  // Account
  ACCOUNT_AUTH: '/api/account/auth',
  ACCOUNT_QUOTA: '/api/account/quota',
} as const;

/**
 * API endpoint type definitions
 */
export interface ApiEndpoints {
  // GET /api/health
  'GET /api/health': {
    response: ApiResponse<HealthResponse>;
  };
  
  // GET /api/sessions
  'GET /api/sessions': {
    response: ApiResponse<PaginatedResponse<Session>>;
  };
  
  // POST /api/sessions
  'POST /api/sessions': {
    body: CreateSessionRequest;
    response: ApiResponse<Session>;
  };
  
  // GET /api/sessions/:id
  'GET /api/sessions/:id': {
    params: { id: string };
    response: ApiResponse<Session>;
  };
  
  // PATCH /api/sessions/:id
  'PATCH /api/sessions/:id': {
    params: { id: string };
    body: UpdateSessionRequest;
    response: ApiResponse<Session>;
  };
  
  // DELETE /api/sessions/:id
  'DELETE /api/sessions/:id': {
    params: { id: string };
    response: ApiResponse<void>;
  };
  
  // POST /api/sessions/:id/resume
  'POST /api/sessions/:id/resume': {
    params: { id: string };
    response: ApiResponse<Session>;
  };
  
  // POST /api/sessions/:id/abort
  'POST /api/sessions/:id/abort': {
    params: { id: string };
    response: ApiResponse<void>;
  };
  
  // GET /api/sessions/:id/messages
  'GET /api/sessions/:id/messages': {
    params: { id: string };
    response: ApiResponse<PaginatedResponse<Message>>;
  };
  
  // POST /api/sessions/:id/chat
  'POST /api/sessions/:id/chat': {
    params: { id: string };
    body: SendMessageRequest;
    response: ApiResponse<Message>;
  };
  
  // POST /api/sessions/:id/chat/stream (SSE)
  'POST /api/sessions/:id/chat/stream': {
    params: { id: string };
    body: SendMessageRequest;
    response: ReadableStream; // SSE stream
  };
  
  // GET /api/models
  'GET /api/models': {
    response: ApiResponse<{ models: ModelInfo[]; default: string }>;
  };

  // GET /api/account/auth
  'GET /api/account/auth': {
    response: ApiResponse<CopilotAuthStatus>;
  };

  // GET /api/account/quota
  'GET /api/account/quota': {
    response: ApiResponse<CopilotQuotaStatus>;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  DEFAULT_MODEL: 'gpt-4.1',
  DEFAULT_PORT: 3847,
  DEFAULT_HOST: 'localhost',
  REQUEST_TIMEOUT_MS: 60000,
  STREAM_TIMEOUT_MS: 300000,
} as const;
