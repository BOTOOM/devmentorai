import { API_ENDPOINTS, DEFAULT_CONFIG } from '@devmentorai/shared';
import type {
  ApiResponse,
  CreateSessionRequest,
  HealthResponse,
  Message,
  PaginatedResponse,
  Session,
} from '@devmentorai/shared';
import { storageGet } from '../lib/browser-utils';

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ?? `http://${DEFAULT_CONFIG.DEFAULT_HOST}:${DEFAULT_CONFIG.DEFAULT_PORT}`
    )
      .trim()
      .replace(/\/+$/, '');
  }

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient();
    return ApiClient.instance;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const { backendUrl } = await storageGet<{ backendUrl?: string }>('backendUrl');
      const baseUrl = backendUrl?.trim().replace(/\/+$/, '') || this.baseUrl;
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      if (response.status === 204) return { success: true } as ApiResponse<T>;
      return (await response.json()) as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  getHealth(): Promise<ApiResponse<HealthResponse>> {
    return this.request<HealthResponse>(API_ENDPOINTS.HEALTH);
  }

  listSessions(): Promise<
    ApiResponse<{
      items: Session[];
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    }>
  > {
    return this.request(API_ENDPOINTS.SESSIONS);
  }

  createSession(data: CreateSessionRequest): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSIONS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getSession(sessionId: string): Promise<ApiResponse<Session>> {
    return this.request<Session>(API_ENDPOINTS.SESSION(sessionId));
  }

  deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(API_ENDPOINTS.SESSION(sessionId), { method: 'DELETE' });
  }

  getSessionMessages(sessionId: string): Promise<ApiResponse<PaginatedResponse<Message>>> {
    return this.request<PaginatedResponse<Message>>(API_ENDPOINTS.SESSION_MESSAGES(sessionId));
  }
}
