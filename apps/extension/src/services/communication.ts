export const NATIVE_HOST_NAME = 'com.devmentorai.host';

export interface NativeMessage {
  id: string;
  type: 'request' | 'stream' | 'abort';
  method: string;
  path: string;
  body?: unknown;
}

export interface NativeResponse {
  id: string;
  type: 'response' | 'stream_chunk' | 'stream_end' | 'error';
  status?: number;
  data?: unknown;
  error?: string;
}

interface PendingCall {
  type: 'request' | 'stream';
  resolve: (value: { status: number; data: unknown } | void) => void;
  reject: (error: Error) => void;
  onChunk?: (data: unknown) => void;
  cleanup?: () => void;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export class NativeTransport {
  private port: chrome.runtime.Port | null = null;
  private readonly pending = new Map<string, PendingCall>();
  private requestId = 0;
  private releaseRequested = false;

  constructor(private readonly hostName = NATIVE_HOST_NAME) {}

  request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    this.releaseRequested = false;
    const id = this.nextId();

    return new Promise((resolve, reject) => {
      let port: chrome.runtime.Port;
      try {
        port = this.connect();
      } catch (error) {
        reject(asError(error));
        return;
      }

      this.pending.set(id, {
        type: 'request',
        resolve: (response) => resolve(response as { status: number; data: T }),
        reject,
      });

      try {
        port.postMessage({ id, type: 'request', method, path, body } satisfies NativeMessage);
      } catch (error) {
        this.removePending(id)?.reject(asError(error));
      }
    });
  }

  stream(
    method: string,
    path: string,
    body: unknown,
    onChunk: (data: unknown) => void,
    signal?: AbortSignal
  ): Promise<void> {
    this.releaseRequested = false;
    if (signal?.aborted) {
      return Promise.reject(abortError());
    }

    const id = this.nextId();

    return new Promise((resolve, reject) => {
      let port: chrome.runtime.Port;
      try {
        port = this.connect();
      } catch (error) {
        reject(asError(error));
        return;
      }

      const pending: PendingCall = {
        type: 'stream',
        resolve: () => resolve(),
        reject,
        onChunk,
      };

      const abort = () => {
        if (this.pending.get(id) !== pending) {
          return;
        }

        try {
          port.postMessage({
            id,
            type: 'abort',
            method: '',
            path: '',
          } satisfies NativeMessage);
        } catch {
          this.removePending(id)?.reject(abortError());
          return;
        }

        this.removePending(id)?.reject(abortError());
      };

      if (signal) {
        signal.addEventListener('abort', abort, { once: true });
        pending.cleanup = () => signal.removeEventListener('abort', abort);
      }

      this.pending.set(id, pending);

      if (signal?.aborted) {
        abort();
        return;
      }

      try {
        port.postMessage({ id, type: 'stream', method, path, body } satisfies NativeMessage);
      } catch (error) {
        this.removePending(id)?.reject(asError(error));
      }
    });
  }

  disconnect(): void {
    const port = this.port;
    this.port = null;
    this.rejectPending(new Error(this.getDisconnectMessage()));
    port?.disconnect();
  }

  releaseIfIdle(): void {
    if (!this.port) {
      this.releaseRequested = false;
      return;
    }

    if (this.pending.size !== 0) {
      this.releaseRequested = true;
      return;
    }

    const port = this.port;
    this.port = null;
    this.releaseRequested = false;
    port.disconnect();
  }

  private connect(): chrome.runtime.Port {
    if (this.port) {
      return this.port;
    }

    const port = chrome.runtime.connectNative(this.hostName);
    this.port = port;
    port.onMessage.addListener((message: unknown) => this.handleMessage(message));
    port.onDisconnect.addListener(() => this.handleDisconnect(port));
    return port;
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object' || !('id' in message)) {
      return;
    }

    const response = message as NativeResponse;
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    if (response.type === 'error') {
      this.removePending(response.id)?.reject(new Error(response.error || 'Native host error'));
      return;
    }

    if (response.type === 'response') {
      const call = this.removePending(response.id);
      if (!call) {
        return;
      }
      if (call.type === 'stream') {
        call.reject(new Error(`Stream request failed: ${response.status}`));
      } else {
        call.resolve({
          status: response.status ?? 0,
          data: response.data,
        });
      }
      return;
    }

    if (response.type === 'stream_chunk' && pending.type === 'stream') {
      try {
        pending.onChunk?.(response.data);
      } catch (error) {
        this.removePending(response.id)?.reject(asError(error));
      }
      return;
    }

    if (response.type === 'stream_end' && pending.type === 'stream') {
      this.removePending(response.id)?.resolve();
    }
  }

  private handleDisconnect(port: chrome.runtime.Port): void {
    if (this.port !== port) {
      return;
    }

    this.port = null;
    this.rejectPending(new Error(this.getDisconnectMessage()));
  }

  private getDisconnectMessage(): string {
    return (
      (typeof chrome !== 'undefined' && chrome.runtime.lastError?.message) ||
      'Native host disconnected'
    );
  }

  private removePending(id: string): PendingCall | undefined {
    const pending = this.pending.get(id);
    if (pending) {
      this.pending.delete(id);
      pending.cleanup?.();
      if (this.releaseRequested && this.pending.size === 0) {
        this.releaseIfIdle();
      }
    }
    return pending;
  }

  private rejectPending(error: Error): void {
    for (const id of [...this.pending.keys()]) {
      this.removePending(id)?.reject(error);
    }
  }

  private nextId(): string {
    return `native_${Date.now()}_${++this.requestId}`;
  }
}

let nativeTransport: NativeTransport | undefined;

export function getNativeTransport(): NativeTransport {
  nativeTransport ??= new NativeTransport();
  return nativeTransport;
}

export function releaseNativeTransportIfIdle(): void {
  nativeTransport?.releaseIfIdle();
}
