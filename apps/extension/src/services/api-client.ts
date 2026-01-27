import { DEFAULT_CONFIG, API_ENDPOINTS } from '@devmentorai/shared';
import type {
  ApiResponse,
  PaginatedResponse,
  HealthResponse,
  Session,
  CreateSessionRequest,
  Message,
  SendMessageRequest,
  StreamEvent,
} from '@devmentorai/shared';

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `http://${DEFAULT_CONFIG.DEFAULT_HOST}:${DEFAULT_CONFIG.DEFAULT_PORT}`;
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
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

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

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(API_ENDPOINTS.SESSION(sessionId), {
      method: 'DELETE',
    });
  }

  async resumeSession(sessionId: string): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSION_RESUME(sessionId), {
      method: 'POST',
    });
  }

  async abortRequest(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(API_ENDPOINTS.SESSION_ABORT(sessionId), {
      method: 'POST',
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
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CHAT_STREAM(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
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
              onEvent({ type: 'done', data: {} });
              return;
            }
            
            try {
              const event = JSON.parse(data) as StreamEvent;
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
}
