import { DEFAULT_CONFIG, API_ENDPOINTS } from '@devmentorai/shared';
import { storageGet } from '../lib/browser-utils';
import type {
  ApiResponse,
  PaginatedResponse,
  HealthResponse,
  ModelInfo,
  ProviderAuthStatus,
  ProviderCredentialStatus,
  ProviderQuotaStatus,
  Session,
  CreateSessionRequest,
  SetProviderCredentialRequest,
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

  private withProviderQuery(endpoint: string, provider?: string): string {
    if (!provider) return endpoint;

    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}provider=${encodeURIComponent(provider)}`;
  }

  private handleSseLine(
    line: string,
    onEvent: (event: StreamEvent) => void
  ): boolean {
    if (!line.startsWith('data: ')) {
      return false;
    }

    const data = line.slice(6).trim();
    if (data === '[DONE]') {
      console.log('[ApiClient] Received [DONE] marker');
      onEvent({ type: 'done', data: {} });
      return true;
    }

    try {
      const event = JSON.parse(data) as StreamEvent;
      console.log('[ApiClient] Parsed SSE event:', event.type);
      onEvent(event);
    } catch (parseError) {
      console.error('[ApiClient] Failed to parse SSE event:', data, parseError);
    }

    return false;
  }

  private processSseChunk(
    chunk: Uint8Array,
    decoder: TextDecoder,
    buffer: string,
    onEvent: (event: StreamEvent) => void
  ): { buffer: string; done: boolean } {
    const nextBuffer = `${buffer}${decoder.decode(chunk, { stream: true })}`;
    const lines = nextBuffer.split('\n');
    const remainder = lines.pop() || '';

    for (const line of lines) {
      const done = this.handleSseLine(line, onEvent);
      if (done) {
        return { buffer: remainder, done: true };
      }
    }

    return { buffer: remainder, done: false };
  }

  private async consumeSseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('[ApiClient] Stream done (reader.read() returned done)');
        onEvent({ type: 'done', data: {} });
        return;
      }

      const processed = this.processSseChunk(value, decoder, buffer, onEvent);
      buffer = processed.buffer;
      if (processed.done) {
        return;
      }
    }
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
    } catch (storageError) {
      console.warn('[ApiClient] Failed to read backendUrl from storage:', storageError);
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
  async getModels(provider?: string): Promise<ApiResponse<ModelsResponse>> {
    return this.request<ModelsResponse>(this.withProviderQuery(API_ENDPOINTS.MODELS, provider));
  }

  async getAccountAuth(provider?: string): Promise<ApiResponse<ProviderAuthStatus>> {
    return this.request<ProviderAuthStatus>(this.withProviderQuery(API_ENDPOINTS.ACCOUNT_AUTH, provider));
  }

  async getAccountQuota(provider?: string): Promise<ApiResponse<ProviderQuotaStatus>> {
    return this.request<ProviderQuotaStatus>(this.withProviderQuery(API_ENDPOINTS.ACCOUNT_QUOTA, provider));
  }

  async getProviderCredential(provider: string): Promise<ApiResponse<ProviderCredentialStatus>> {
    return this.request<ProviderCredentialStatus>(API_ENDPOINTS.ACCOUNT_CREDENTIAL(provider));
  }

  async setProviderCredential(
    provider: string,
    data: SetProviderCredentialRequest
  ): Promise<ApiResponse<ProviderCredentialStatus>> {
    return this.request<ProviderCredentialStatus>(API_ENDPOINTS.ACCOUNT_CREDENTIAL(provider), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProviderCredential(provider: string): Promise<ApiResponse<ProviderCredentialStatus>> {
    return this.request<ProviderCredentialStatus>(API_ENDPOINTS.ACCOUNT_CREDENTIAL(provider), {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
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

  // Providers
  async listProviders(): Promise<ApiResponse<Array<{ id: string; ready: boolean; mockMode: boolean }>>> {
    return this.request<Array<{ id: string; ready: boolean; mockMode: boolean }>>('/api/providers');
  }

  async reinitializeProvider(providerId: string): Promise<ApiResponse<{ provider: string; ready: boolean; mockMode: boolean }>> {
    return this.request<{ provider: string; ready: boolean; mockMode: boolean }>(
      `/api/providers/${encodeURIComponent(providerId)}/reinitialize`,
      { method: 'POST', body: JSON.stringify({}) }
    );
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

    try {
      await this.consumeSseStream(reader, onEvent);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Pre-upload images to the backend for a message.
   * Sends images individually in parallel to avoid body-size issues.
   * Returns the processed image references (paths on disk, URLs for display).
   */
  async uploadImages(
    sessionId: string,
    messageId: string,
    images: Array<{ id: string; dataUrl: string; mimeType: string; source: string }>
  ): Promise<ApiResponse<{
    images: Array<{
      id: string;
      thumbnailUrl: string;
      fullImageUrl: string;
      fullImagePath: string;
      mimeType: string;
      dimensions: { width: number; height: number };
      fileSize: number;
    }>;
  }>> {
    const baseUrl = await this.resolveBaseUrl();
    
    // Upload images one at a time to avoid payload limits
    const allProcessed: Array<{
      id: string;
      thumbnailUrl: string;
      fullImageUrl: string;
      fullImagePath: string;
      mimeType: string;
      dimensions: { width: number; height: number };
      fileSize: number;
    }> = [];

    // Upload in parallel (each image is its own request)
    const uploadPromises = images.map(async (image) => {
      const response = await fetch(
        `${baseUrl}/api/images/upload/${sessionId}/${messageId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [image] }),
        }
      );

      if (!response.ok) {
        throw new Error(`Image upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse<{ images: typeof allProcessed }>;
      if (result.success && result.data?.images) {
        return result.data.images;
      }
      throw new Error(result.error?.message || 'Upload failed');
    });

    const results = await Promise.all(uploadPromises);
    for (const imgs of results) {
      allProcessed.push(...imgs);
    }

    return {
      success: true,
      data: { images: allProcessed },
    };
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
