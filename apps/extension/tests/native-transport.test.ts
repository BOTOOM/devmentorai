import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/services/api-client';
import {
  type NativeMessage,
  type NativeResponse,
  NativeTransport,
  getNativeTransport,
} from '../src/services/communication';

let originalChrome: PropertyDescriptor | undefined;

class FakeEvent {
  private listeners: Array<(...args: unknown[]) => void> = [];

  addListener(listener: (...args: unknown[]) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (...args: unknown[]) => void): void {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener);
  }

  fire(...args: unknown[]): void {
    for (const listener of this.listeners) {
      listener(...args);
    }
  }
}

class FakePort {
  onMessage = new FakeEvent();
  onDisconnect = new FakeEvent();
  messages: NativeMessage[] = [];
  postMessage = vi.fn((message: NativeMessage) => {
    this.messages.push(message);
  });
  disconnect = vi.fn();

  emitMessage(message: NativeResponse): void {
    this.onMessage.fire(message);
  }

  emitDisconnect(): void {
    this.onDisconnect.fire();
  }
}

function installChrome(ports: FakePort[], communicationMode = 'http') {
  originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  const storage = { communicationMode };
  const runtime = {
    connectNative: vi.fn((_hostName: string) => {
      const port = ports.shift();
      if (!port) {
        throw new Error('No fake native port available');
      }
      return port as unknown as chrome.runtime.Port;
    }),
    lastError: undefined as { message?: string } | undefined,
    setCommunicationMode: (mode: string) => {
      storage.communicationMode = mode;
    },
  };

  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime,
      storage: {
        local: {
          get: (_keys: unknown, callback: (items: Record<string, unknown>) => void) => {
            callback({ communicationMode: storage.communicationMode });
          },
        },
      },
    },
  });

  return runtime;
}

describe('NativeTransport', () => {
  let singletonTransportUsed = false;

  afterEach(() => {
    if (singletonTransportUsed) {
      getNativeTransport().disconnect();
      singletonTransportUsed = false;
    }

    vi.restoreAllMocks();
    if (originalChrome) {
      Object.defineProperty(globalThis, 'chrome', originalChrome);
    } else {
      Reflect.deleteProperty(globalThis, 'chrome');
    }
    originalChrome = undefined;
  });

  it('resolves request calls with status and data', async () => {
    const port = new FakePort();
    const runtime = installChrome([port]);
    const transport = new NativeTransport();

    const responsePromise = transport.request<{ success: boolean }>('GET', '/api/health');
    const message = port.messages[0];
    port.emitMessage({
      id: message.id,
      type: 'response',
      status: 200,
      data: { success: true },
    });

    await expect(responsePromise).resolves.toEqual({
      status: 200,
      data: { success: true },
    });
    expect(runtime.connectNative).toHaveBeenCalledWith('com.devmentorai.host');
  });

  it('releases an idle port and reconnects on the next request', async () => {
    const firstPort = new FakePort();
    const secondPort = new FakePort();
    const runtime = installChrome([firstPort, secondPort]);
    const transport = new NativeTransport();

    const firstRequest = transport.request('GET', '/first');
    firstPort.emitMessage({
      id: firstPort.messages[0].id,
      type: 'response',
      status: 200,
      data: {},
    });
    await expect(firstRequest).resolves.toEqual({ status: 200, data: {} });

    transport.releaseIfIdle();
    expect(firstPort.disconnect).toHaveBeenCalledOnce();

    const secondRequest = transport.request('GET', '/second');
    secondPort.emitMessage({
      id: secondPort.messages[0].id,
      type: 'response',
      status: 200,
      data: {},
    });
    await expect(secondRequest).resolves.toEqual({ status: 200, data: {} });
    expect(runtime.connectNative).toHaveBeenCalledTimes(2);
  });

  it('releases a requested port after its pending request finishes', async () => {
    const port = new FakePort();
    installChrome([port]);
    const transport = new NativeTransport();

    const request = transport.request('GET', '/pending');
    transport.releaseIfIdle();
    expect(port.disconnect).not.toHaveBeenCalled();

    port.emitMessage({
      id: port.messages[0].id,
      type: 'response',
      status: 200,
      data: {},
    });
    await expect(request).resolves.toEqual({ status: 200, data: {} });
    expect(port.disconnect).toHaveBeenCalledOnce();
  });

  it('keeps the port open when a new native request cancels a pending release', async () => {
    const port = new FakePort();
    const runtime = installChrome([port]);
    const transport = new NativeTransport();

    const firstRequest = transport.request('GET', '/first');
    transport.releaseIfIdle();
    const secondRequest = transport.request('GET', '/second');

    port.emitMessage({
      id: port.messages[0].id,
      type: 'response',
      status: 200,
      data: {},
    });
    await expect(firstRequest).resolves.toEqual({ status: 200, data: {} });
    expect(port.disconnect).not.toHaveBeenCalled();

    port.emitMessage({
      id: port.messages[1].id,
      type: 'response',
      status: 200,
      data: {},
    });
    await expect(secondRequest).resolves.toEqual({ status: 200, data: {} });
    expect(port.disconnect).not.toHaveBeenCalled();
    expect(runtime.connectNative).toHaveBeenCalledOnce();
  });

  it('sends an abort frame before releasing a port with a pending release', async () => {
    const port = new FakePort();
    installChrome([port]);
    const transport = new NativeTransport();
    const controller = new AbortController();

    const stream = transport.stream('POST', '/stream', {}, () => {}, controller.signal);
    transport.releaseIfIdle();
    controller.abort();

    await expect(stream).rejects.toMatchObject({ name: 'AbortError' });
    expect(port.messages[1]).toMatchObject({ type: 'abort' });
    expect(port.disconnect).toHaveBeenCalledOnce();
  });

  it('rejects request calls on error frames', async () => {
    const port = new FakePort();
    installChrome([port]);
    const transport = new NativeTransport();

    const responsePromise = transport.request('GET', '/api/health');
    port.emitMessage({
      id: port.messages[0].id,
      type: 'error',
      error: 'Native request failed',
    });

    await expect(responsePromise).rejects.toThrow('Native request failed');
  });

  it('rejects pending calls on disconnect and reconnects on the next request', async () => {
    const firstPort = new FakePort();
    const secondPort = new FakePort();
    const runtime = installChrome([firstPort, secondPort]);
    const transport = new NativeTransport();

    const firstRequest = transport.request('GET', '/first');
    runtime.lastError = { message: 'Native host stopped' };
    firstPort.emitDisconnect();
    await expect(firstRequest).rejects.toThrow('Native host stopped');

    runtime.lastError = undefined;
    const secondRequest = transport.request('GET', '/second');
    secondPort.emitMessage({
      id: secondPort.messages[0].id,
      type: 'response',
      status: 200,
      data: { success: true },
    });

    await expect(secondRequest).resolves.toEqual({
      status: 200,
      data: { success: true },
    });
    expect(runtime.connectNative).toHaveBeenCalledTimes(2);
  });

  it('delivers stream chunks in order and resolves on stream_end', async () => {
    const port = new FakePort();
    installChrome([port]);
    const transport = new NativeTransport();
    const chunks: unknown[] = [];

    const streamPromise = transport.stream('POST', '/api/stream', {}, (chunk) => {
      chunks.push(chunk);
    });
    const id = port.messages[0].id;
    port.emitMessage({ id, type: 'stream_chunk', data: { n: 1 } });
    port.emitMessage({ id, type: 'stream_chunk', data: { n: 2 } });
    port.emitMessage({ id, type: 'stream_end' });

    await expect(streamPromise).resolves.toBeUndefined();
    expect(chunks).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('sends an abort frame and rejects with AbortError when the signal aborts', async () => {
    const port = new FakePort();
    installChrome([port]);
    const transport = new NativeTransport();
    const controller = new AbortController();

    const streamPromise = transport.stream('POST', '/api/stream', {}, () => {}, controller.signal);
    const id = port.messages[0].id;
    controller.abort();

    await expect(streamPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(port.messages[1]).toEqual({
      id,
      type: 'abort',
      method: '',
      path: '',
    });
  });

  it('routes ApiClient health checks through native transport without fetch', async () => {
    const port = new FakePort();
    installChrome([port], 'native');
    const fetch = vi.spyOn(globalThis, 'fetch');
    singletonTransportUsed = true;

    const healthPromise = ApiClient.getInstance().getHealth();
    await vi.waitFor(() => expect(port.messages).toHaveLength(1));
    port.emitMessage({
      id: port.messages[0].id,
      type: 'response',
      status: 200,
      data: {
        success: true,
        data: {
          status: 'healthy',
          version: '1.0.0',
          copilotConnected: true,
          uptime: 1,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await expect(healthPromise).resolves.toMatchObject({
      success: true,
      data: { status: 'healthy' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('disconnects an idle native port when ApiClient switches back to HTTP', async () => {
    const port = new FakePort();
    const runtime = installChrome([port], 'native');
    singletonTransportUsed = true;
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            status: 'healthy',
            version: '1.0.0',
            copilotConnected: true,
            uptime: 1,
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const nativeHealthPromise = ApiClient.getInstance().getHealth();
    await vi.waitFor(() => expect(port.messages).toHaveLength(1));
    port.emitMessage({
      id: port.messages[0].id,
      type: 'response',
      status: 200,
      data: { success: true, data: { status: 'healthy' } },
    });
    await expect(nativeHealthPromise).resolves.toMatchObject({ success: true });

    runtime.setCommunicationMode('http');
    await expect(ApiClient.getInstance().getHealth()).resolves.toMatchObject({ success: true });
    expect(port.disconnect).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    expect(runtime.connectNative).toHaveBeenCalledOnce();
  });
});
