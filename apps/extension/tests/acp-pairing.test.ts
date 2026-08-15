import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpClient, AcpPairingError } from '../src/services/acp-client';

type SocketInstance = {
  url: string;
  protocols: string | string[] | undefined;
  onopen?: () => void;
  onerror?: () => void;
  onclose?: (event: { code: number }) => void;
  onmessage?: (message: { data: string }) => void;
  send: (data: string) => void;
  close: () => void;
  readyState: number;
};

const sockets: SocketInstance[] = [];

function installWebSocket(): void {
  class FakeWebSocket implements SocketInstance {
    static readonly OPEN = 1;
    url: string;
    protocols: string | string[] | undefined;
    readyState = 0;
    onopen?: () => void;
    onerror?: () => void;
    onclose?: (event: { code: number }) => void;
    onmessage?: (message: { data: string }) => void;

    constructor(url: string, protocols?: string | string[]) {
      this.url = url;
      this.protocols = protocols;
      sockets.push(this);
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.();
      }, 0);
    }

    send(): void {}
    close(): void {
      this.readyState = 3;
    }
  }
  vi.stubGlobal('WebSocket', FakeWebSocket);
}

afterEach(() => {
  sockets.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ACP client pairing', () => {
  it('pairs with the backend and sends the token as a subprotocol', async () => {
    installWebSocket();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ origin: 'chrome-extension://abc', token: 'secret-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new AcpClient({ url: 'ws://127.0.0.1:3847/acp', reconnect: false });
    await client.connect();

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3847/acp/pair', { method: 'POST' });
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.protocols).toEqual(['devmentorai-pairing.secret-token']);
  });

  it('surfaces an actionable error when another extension is already paired', async () => {
    installWebSocket();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'pairing_conflict' } }),
      })
    );

    const client = new AcpClient({
      url: 'ws://127.0.0.1:3847/acp',
      reconnect: false,
      origin: 'chrome-extension://mine',
    });
    await expect(client.connect()).rejects.toBeInstanceOf(AcpPairingError);
    await expect(client.connect()).rejects.toThrow(/acp:unpair/);
    await expect(client.connect()).rejects.toThrow(
      /ACP_EXTENSION_ORIGIN=chrome-extension:\/\/mine/
    );
    expect(sockets).toHaveLength(0);
  });

  it('connects without a token when the backend does not require pairing', async () => {
    installWebSocket();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const client = new AcpClient({ url: 'ws://127.0.0.1:3847/acp', reconnect: false });
    await client.connect();
    expect(sockets[0]?.protocols).toBeUndefined();
  });
});
