/**
 * Communication Adapter Interface
 * 
 * Provides an abstraction layer for communication between the extension
 * and the backend, supporting both HTTP and Native Messaging protocols.
 */

import type { 
  ChatMessage, 
  Session, 
  SessionEvent,
  ApiResponse 
} from '@devmentorai/shared';

export interface HealthStatus {
  status: 'ok' | 'error';
  mode: 'http' | 'native';
  version?: string;
  error?: string;
}

export interface CommunicationAdapter {
  readonly mode: 'http' | 'native';
  
  // Health check
  getHealth(): Promise<HealthStatus>;
  
  // Session management
  createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Session>>;
  getSession(sessionId: string): Promise<ApiResponse<Session>>;
  listSessions(): Promise<ApiResponse<Session[]>>;
  deleteSession(sessionId: string): Promise<ApiResponse<void>>;
  
  // Chat
  sendMessage(sessionId: string, message: ChatMessage): Promise<ApiResponse<unknown>>;
  streamMessage(
    sessionId: string, 
    message: ChatMessage, 
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal
  ): Promise<void>;
  
  // Models
  listModels(): Promise<ApiResponse<Array<{ id: string; name: string; description?: string }>>>;
}

/**
 * HTTP Communication Adapter
 * Uses fetch API to communicate with local HTTP backend
 */
export class HttpAdapter implements CommunicationAdapter {
  readonly mode = 'http' as const;
  
  constructor(private baseUrl: string) {}
  
  async getHealth(): Promise<HealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        return { status: 'ok', mode: 'http', version: data.version };
      }
      return { status: 'error', mode: 'http', error: `HTTP ${response.status}` };
    } catch (error) {
      return { 
        status: 'error', 
        mode: 'http', 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
  
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Session>> {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    return response.json();
  }
  
  async getSession(sessionId: string): Promise<ApiResponse<Session>> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
    return response.json();
  }
  
  async listSessions(): Promise<ApiResponse<Session[]>> {
    const response = await fetch(`${this.baseUrl}/api/sessions`);
    return response.json();
  }
  
  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    return response.json();
  }
  
  async sendMessage(sessionId: string, message: ChatMessage): Promise<ApiResponse<unknown>> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.json();
  }
  
  async streamMessage(
    sessionId: string, 
    message: ChatMessage,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onEvent({ type: 'complete', sessionId });
          } else {
            try {
              const event = JSON.parse(data) as SessionEvent;
              onEvent(event);
            } catch {
              // Skip non-JSON data
            }
          }
        }
      }
    }
  }
  
  async listModels(): Promise<ApiResponse<Array<{ id: string; name: string; description?: string }>>> {
    const response = await fetch(`${this.baseUrl}/api/models`);
    return response.json();
  }
}

/**
 * Native Messaging Adapter
 * Uses Chrome Native Messaging API for direct communication
 */
export class NativeMessagingAdapter implements CommunicationAdapter {
  readonly mode = 'native' as const;
  private port: chrome.runtime.Port | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    onEvent?: (event: SessionEvent) => void;
  }>();
  private requestId = 0;
  
  constructor(private hostName: string = 'com.devmentorai.host') {}
  
  private connect(): chrome.runtime.Port {
    if (this.port) return this.port;
    
    this.port = chrome.runtime.connectNative(this.hostName);
    
    this.port.onMessage.addListener((response: NativeResponse) => {
      const pending = this.pendingRequests.get(response.id);
      if (!pending) return;
      
      switch (response.type) {
        case 'response':
          pending.resolve(response.data);
          this.pendingRequests.delete(response.id);
          break;
        case 'stream_chunk':
          if (pending.onEvent && response.data) {
            pending.onEvent(response.data as SessionEvent);
          }
          break;
        case 'stream_end':
          if (pending.onEvent) {
            pending.onEvent({ type: 'complete', sessionId: '' });
          }
          pending.resolve(undefined);
          this.pendingRequests.delete(response.id);
          break;
        case 'error':
          pending.reject(new Error(response.error || 'Native messaging error'));
          this.pendingRequests.delete(response.id);
          break;
      }
    });
    
    this.port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      for (const pending of this.pendingRequests.values()) {
        pending.reject(new Error(error?.message || 'Native host disconnected'));
      }
      this.pendingRequests.clear();
      this.port = null;
    });
    
    return this.port;
  }
  
  private sendNativeMessage<T>(message: NativeMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const port = this.connect();
      this.pendingRequests.set(message.id, { 
        resolve: resolve as (value: unknown) => void, 
        reject 
      });
      port.postMessage(message);
    });
  }
  
  private sendStreamingMessage(
    message: NativeMessage, 
    onEvent: (event: SessionEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = this.connect();
      this.pendingRequests.set(message.id, { 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        onEvent 
      });
      port.postMessage(message);
    });
  }
  
  private nextId(): string {
    return `native_${++this.requestId}_${Date.now()}`;
  }
  
  async getHealth(): Promise<HealthStatus> {
    try {
      const data = await this.sendNativeMessage<{ status: string; version?: string }>({
        id: this.nextId(),
        type: 'request',
        method: 'GET',
        path: '/health',
      });
      return { status: 'ok', mode: 'native', version: data.version };
    } catch (error) {
      return { 
        status: 'error', 
        mode: 'native', 
        error: error instanceof Error ? error.message : 'Native messaging failed' 
      };
    }
  }
  
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Session>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'POST',
      path: '/api/sessions',
      body: session,
    });
  }
  
  async getSession(sessionId: string): Promise<ApiResponse<Session>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'GET',
      path: `/api/sessions/${sessionId}`,
    });
  }
  
  async listSessions(): Promise<ApiResponse<Session[]>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'GET',
      path: '/api/sessions',
    });
  }
  
  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'DELETE',
      path: `/api/sessions/${sessionId}`,
    });
  }
  
  async sendMessage(sessionId: string, message: ChatMessage): Promise<ApiResponse<unknown>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'POST',
      path: `/api/sessions/${sessionId}/chat`,
      body: message,
    });
  }
  
  async streamMessage(
    sessionId: string,
    message: ChatMessage,
    onEvent: (event: SessionEvent) => void,
    _signal?: AbortSignal
  ): Promise<void> {
    const id = this.nextId();
    return this.sendStreamingMessage(
      {
        id,
        type: 'stream',
        method: 'POST',
        path: `/api/sessions/${sessionId}/chat/stream`,
        body: message,
      },
      onEvent
    );
  }
  
  async listModels(): Promise<ApiResponse<Array<{ id: string; name: string; description?: string }>>> {
    return this.sendNativeMessage({
      id: this.nextId(),
      type: 'request',
      method: 'GET',
      path: '/api/models',
    });
  }
  
  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }
}

interface NativeMessage {
  id: string;
  type: 'request' | 'stream' | 'abort';
  method: string;
  path: string;
  body?: unknown;
}

interface NativeResponse {
  id: string;
  type: 'response' | 'stream_chunk' | 'stream_end' | 'error';
  status?: number;
  data?: unknown;
  error?: string;
}

/**
 * Communication Service
 * Manages the active communication adapter and provides switching capability
 */
export class CommunicationService {
  private adapter: CommunicationAdapter;
  private httpAdapter: HttpAdapter;
  private nativeAdapter: NativeMessagingAdapter | null = null;
  
  constructor(httpBaseUrl: string = 'http://localhost:3847') {
    this.httpAdapter = new HttpAdapter(httpBaseUrl);
    this.adapter = this.httpAdapter;
  }
  
  get currentMode(): 'http' | 'native' {
    return this.adapter.mode;
  }
  
  getAdapter(): CommunicationAdapter {
    return this.adapter;
  }
  
  async switchToHttp(): Promise<void> {
    if (this.nativeAdapter) {
      this.nativeAdapter.disconnect();
    }
    this.adapter = this.httpAdapter;
    await chrome.storage.local.set({ communicationMode: 'http' });
  }
  
  async switchToNative(): Promise<void> {
    if (!this.nativeAdapter) {
      this.nativeAdapter = new NativeMessagingAdapter();
    }
    
    // Test connection before switching
    const health = await this.nativeAdapter.getHealth();
    if (health.status === 'error') {
      throw new Error(`Native Messaging unavailable: ${health.error}`);
    }
    
    this.adapter = this.nativeAdapter;
    await chrome.storage.local.set({ communicationMode: 'native' });
  }
  
  async initialize(): Promise<void> {
    const { communicationMode } = await chrome.storage.local.get('communicationMode');
    
    if (communicationMode === 'native') {
      try {
        await this.switchToNative();
      } catch {
        // Fall back to HTTP if native fails
        console.warn('Native Messaging unavailable, falling back to HTTP');
        await this.switchToHttp();
      }
    }
  }
  
  // Proxy methods
  getHealth = () => this.adapter.getHealth();
  createSession = (...args: Parameters<CommunicationAdapter['createSession']>) => 
    this.adapter.createSession(...args);
  getSession = (...args: Parameters<CommunicationAdapter['getSession']>) => 
    this.adapter.getSession(...args);
  listSessions = () => this.adapter.listSessions();
  deleteSession = (...args: Parameters<CommunicationAdapter['deleteSession']>) => 
    this.adapter.deleteSession(...args);
  sendMessage = (...args: Parameters<CommunicationAdapter['sendMessage']>) => 
    this.adapter.sendMessage(...args);
  streamMessage = (...args: Parameters<CommunicationAdapter['streamMessage']>) => 
    this.adapter.streamMessage(...args);
  listModels = () => this.adapter.listModels();
}

// Singleton instance
let communicationService: CommunicationService | null = null;

export function getCommunicationService(): CommunicationService {
  if (!communicationService) {
    communicationService = new CommunicationService();
  }
  return communicationService;
}
