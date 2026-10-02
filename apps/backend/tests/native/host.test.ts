import { PassThrough } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { type NativeMessage, NativeMessagingHost } from '../../src/native/host.js';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function encodeMessage(message: NativeMessage): Buffer {
  const payload = Buffer.from(JSON.stringify(message));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(payload.length);
  return Buffer.concat([length, payload]);
}

class FrameReader {
  private buffer = Buffer.alloc(0);
  private frames: unknown[] = [];
  private waiters: Array<(frame: unknown) => void> = [];

  constructor(stream: PassThrough) {
    stream.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4) {
        const length = this.buffer.readUInt32LE(0);
        if (this.buffer.length < length + 4) {
          return;
        }

        const payload = this.buffer.subarray(4, length + 4);
        this.buffer = this.buffer.subarray(length + 4);
        const frame = JSON.parse(payload.toString('utf-8'));
        const waiter = this.waiters.shift();
        if (waiter) {
          waiter(frame);
        } else {
          this.frames.push(frame);
        }
      }
    });
  }

  next(): Promise<unknown> {
    const frame = this.frames.shift();
    if (frame !== undefined) {
      return Promise.resolve(frame);
    }

    return new Promise((resolve) => this.waiters.push(resolve));
  }

  available(): unknown[] {
    return [...this.frames];
  }
}

function createApp(
  options: {
    streamGate?: Promise<void>;
    closeOnRequestEnd?: boolean;
    onRequestClose?: () => void;
  } = {}
): FastifyInstance {
  const app = Fastify();

  app.get('/api/health', async () => ({ success: true, data: {} }));
  app.get('/large', async (_request, reply) => {
    reply.type('text/plain').send('x'.repeat(1024 * 1024));
  });

  if (options.streamGate) {
    app.post('/api/stream', async (request, reply) => {
      let streamEnded = false;
      request.raw.on('close', () => {
        options.onRequestClose?.();
        if (options.closeOnRequestEnd && !streamEnded) {
          streamEnded = true;
          reply.raw.end();
        }
      });

      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
      reply.hijack();
      reply.raw.write('data: {"n":1}\n\n');
      await options.streamGate;
      if (!streamEnded) {
        reply.raw.write('data: {"n":2}\n\n');
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      }
    });
  }

  return app;
}

function startHost(createApp: () => Promise<FastifyInstance>) {
  const input = new PassThrough();
  const output = new PassThrough();
  const frames = new FrameReader(output);
  const host = new NativeMessagingHost({ input, output, createApp });
  const run = host.run();

  return { input, frames, run };
}

describe('NativeMessagingHost', () => {
  let activeInput: PassThrough | undefined;
  let activeRun: Promise<void> | undefined;
  let releaseStream: (() => void) | undefined;

  afterEach(async () => {
    releaseStream?.();
    activeInput?.end();
    await activeRun;
    activeInput = undefined;
    activeRun = undefined;
    releaseStream = undefined;
  });

  it('returns the health response with its status', async () => {
    const harness = startHost(async () => createApp());
    activeInput = harness.input;
    activeRun = harness.run;

    harness.input.write(
      encodeMessage({
        id: 'health',
        type: 'request',
        method: 'GET',
        path: '/api/health',
      })
    );

    expect(await harness.frames.next()).toEqual({
      id: 'health',
      type: 'response',
      status: 200,
      data: { success: true, data: {} },
    });
  });

  it('returns unknown paths as status-404 responses', async () => {
    const harness = startHost(async () => createApp());
    activeInput = harness.input;
    activeRun = harness.run;

    harness.input.write(
      encodeMessage({
        id: 'missing',
        type: 'request',
        method: 'GET',
        path: '/missing',
      })
    );

    const response = (await harness.frames.next()) as { id: string; status: number; type: string };
    expect(response).toMatchObject({
      id: 'missing',
      type: 'response',
      status: 404,
    });
  });

  it('streams chunks before the route finishes and emits stream_end', async () => {
    const gate = deferred();
    let requestClosed = false;
    const harness = startHost(async () =>
      createApp({
        streamGate: gate.promise,
        onRequestClose: () => {
          requestClosed = true;
        },
      })
    );
    activeInput = harness.input;
    activeRun = harness.run;
    releaseStream = gate.resolve;

    harness.input.write(
      encodeMessage({
        id: 'stream',
        type: 'stream',
        method: 'POST',
        path: '/api/stream',
        body: {},
      })
    );

    expect(await harness.frames.next()).toEqual({
      id: 'stream',
      type: 'stream_chunk',
      data: { n: 1 },
    });
    expect(requestClosed).toBe(false);

    gate.resolve();
    expect(await harness.frames.next()).toEqual({
      id: 'stream',
      type: 'stream_chunk',
      data: { n: 2 },
    });
    expect(await harness.frames.next()).toEqual({
      id: 'stream',
      type: 'stream_end',
    });
  });

  it('stops sending frames after a stream is aborted', async () => {
    const gate = deferred();
    const harness = startHost(async () =>
      createApp({
        streamGate: gate.promise,
        closeOnRequestEnd: false,
      })
    );
    activeInput = harness.input;
    activeRun = harness.run;
    releaseStream = gate.resolve;

    harness.input.write(
      encodeMessage({
        id: 'abortable',
        type: 'stream',
        method: 'POST',
        path: '/api/stream',
        body: {},
      })
    );
    expect(await harness.frames.next()).toMatchObject({
      id: 'abortable',
      type: 'stream_chunk',
    });

    harness.input.write(
      encodeMessage({
        id: 'abortable',
        type: 'abort',
        method: '',
        path: '',
      })
    );
    await new Promise((resolve) => setImmediate(resolve));
    gate.resolve();
    harness.input.end();
    await harness.run;
    activeInput = undefined;
    activeRun = undefined;

    await new Promise((resolve) => setImmediate(resolve));
    expect(harness.frames.available()).toEqual([]);
  });

  it('replaces responses larger than 1 MB with a bounded error frame', async () => {
    const harness = startHost(async () => createApp());
    activeInput = harness.input;
    activeRun = harness.run;

    harness.input.write(
      encodeMessage({
        id: 'large',
        type: 'request',
        method: 'GET',
        path: '/large',
      })
    );

    expect(await harness.frames.next()).toEqual({
      id: 'large',
      type: 'error',
      error: 'Response exceeds the 1 MB Native Messaging limit',
    });
  });

  it('decodes a frame split across input writes', async () => {
    const harness = startHost(async () => createApp());
    activeInput = harness.input;
    activeRun = harness.run;
    const frame = encodeMessage({
      id: 'split',
      type: 'request',
      method: 'GET',
      path: '/api/health',
    });

    harness.input.write(frame.subarray(0, 2));
    harness.input.write(frame.subarray(2));

    expect(await harness.frames.next()).toMatchObject({
      id: 'split',
      type: 'response',
      status: 200,
    });
  });

  it('resolves run when input ends', async () => {
    const harness = startHost(async () => createApp());
    activeInput = harness.input;
    activeRun = harness.run;

    harness.input.end();
    await expect(harness.run).resolves.toBeUndefined();
    activeInput = undefined;
    activeRun = undefined;
  });
});
