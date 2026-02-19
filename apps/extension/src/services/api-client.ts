import { DEFAULT_CONFIG, API_ENDPOINTS } from '@devmentorai/shared';
import { storageGet } from '../lib/browser-utils';
import type {
  ApiResponse,
  PaginatedResponse,
  HealthResponse,
  ModelInfo,
  CopilotAuthStatus,
  CopilotQuotaStatus,
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
  Message,
  SendMessageRequest,
  StreamEvent,
} from '@devmentorai/shared';

interface ModelsResponse {
  models: ModelInfo[];
  default: string;
}

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = ApiClient.normalizeBaseUrl(
      baseUrl || `http://${DEFAULT_CONFIG.DEFAULT_HOST}:${DEFAULT_CONFIG.DEFAULT_PORT}`
    );
  }

  private static normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private async resolveBaseUrl(): Promise<string> {
    try {
      const { backendUrl } = await storageGet<{ backendUrl?: string }>('backendUrl');
      if (backendUrl && backendUrl.trim().length > 0) {
        this.baseUrl = ApiClient.normalizeBaseUrl(backendUrl);
      }
    } catch {
      // Keep current URL if storage is unavailable in this context.
    }

    return this.baseUrl;
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = await this.resolveBaseUrl();
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle 204 No Content (e.g., DELETE requests)
      if (response.status === 204) {
        return { success: true } as ApiResponse<T>;
      }

      const data = await response.json();
      return data as ApiResponse<T>;
    } catch (error) {
      console.error('[ApiClient] Request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // Health
  async getHealth(): Promise<ApiResponse<HealthResponse>> {
    return this.request<HealthResponse>(API_ENDPOINTS.HEALTH);
  }

  // Models
  async getModels(): Promise<ApiResponse<ModelsResponse>> {
    return this.request<ModelsResponse>(API_ENDPOINTS.MODELS);
  }

  async getAccountAuth(): Promise<ApiResponse<CopilotAuthStatus>> {
    return this.request<CopilotAuthStatus>(API_ENDPOINTS.ACCOUNT_AUTH);
  }

  async getAccountQuota(): Promise<ApiResponse<CopilotQuotaStatus>> {
    return this.request<CopilotQuotaStatus>(API_ENDPOINTS.ACCOUNT_QUOTA);
  }

  // Sessions
  async listSessions(): Promise<ApiResponse<PaginatedResponse<Session>>> {
    return this.request<PaginatedResponse<Session>>(API_ENDPOINTS.SESSIONS);
  }

  async createSession(data: CreateSessionRequest): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSIONS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSession(sessionId: string): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSION(sessionId));
  }

  async updateSession(sessionId: string, data: UpdateSessionRequest): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSION(sessionId), {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(API_ENDPOINTS.SESSION(sessionId), {
      method: 'DELETE',
      body: JSON.stringify({}), // Send empty body to satisfy Content-Type header
    });
  }

  async resumeSession(sessionId: string): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSION_RESUME(sessionId), {
      method: 'POST',
      body: JSON.stringify({}), // Send empty body to satisfy Content-Type header
    });
  }

  async abortRequest(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(API_ENDPOINTS.SESSION_ABORT(sessionId), {
      method: 'POST',
      body: JSON.stringify({}), // Send empty body to satisfy Content-Type header
    });
  }

  async getSessionMessages(sessionId: string): Promise<ApiResponse<PaginatedResponse<Message>>> {
    return this.request<PaginatedResponse<Message>>(API_ENDPOINTS.SESSION_MESSAGES(sessionId));
  }

  // Chat
  async sendChat(sessionId: string, data: SendMessageRequest): Promise<ApiResponse<Message>> {
    return this.request<Message>(API_ENDPOINTS.CHAT(sessionId), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async streamChat(
    sessionId: string,
    data: SendMessageRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const baseUrl = await this.resolveBaseUrl();
    console.log('[ApiClient] streamChat called for session:', sessionId);
    console.log('[ApiClient] Request data:', { 
      prompt: data.prompt.substring(0, 100), 
      hasContext: !!data.context,
      hasFullContext: !!data.fullContext,
      useContextAwareMode: data.useContextAwareMode,
      imageCount: data.images?.length || 0,
    });
    
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.CHAT_STREAM(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    console.log('[ApiClient] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    console.log('[ApiClient] Starting to read SSE stream...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[ApiClient] Stream done (reader.read() returned done)');
          onEvent({ type: 'done', data: {} });
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log('[ApiClient] Received [DONE] marker');
              onEvent({ type: 'done', data: {} });
              return;
            }
            
            try {
              const event = JSON.parse(data) as StreamEvent;
              console.log('[ApiClient] Parsed SSE event:', event.type);
              onEvent(event);
            } catch (e) {
              console.error('[ApiClient] Failed to parse SSE event:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get full URL for a thumbnail image
   */
  getThumbnailUrl(relativePath: string): string {
    // relativePath is like "images/sessionId/messageId/thumb_0.jpg"
    return `${this.baseUrl}/api/${relativePath}`;
  }

  /**
   * Get the base URL for image serving
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
