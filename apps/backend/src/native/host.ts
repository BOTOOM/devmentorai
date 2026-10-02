/**
 * Native Messaging Host for DevMentorAI
 *
 * This module implements Chrome Native Messaging protocol for direct
 * communication between the extension and local Node.js backend.
 *
 * Protocol: Messages are prefixed with 4-byte length (little-endian uint32)
 *
 * Usage:
 *   node native-host.js
 *
 * The host reads JSON messages from stdin and writes responses to stdout.
 */

import type { Readable, Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';

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

interface NativeMessagingHostOptions {
  input?: Readable;
  output?: Writable;
  createApp?: () => Promise<FastifyInstance>;
}

const MAX_NATIVE_MESSAGE_SIZE = 1024 * 1024;

export class NativeMessagingHost {
  private app: FastifyInstance | null = null;
  private activeStreams = new Map<string, AbortController>();
  private pendingMessages = new Set<Promise<void>>();
  private inputBuffer = Buffer.alloc(0);
  private readonly input: Readable;
  private readonly output: Writable;
  private readonly inputIterator: AsyncIterator<unknown>;
  private readonly createApp: () => Promise<FastifyInstance>;

  constructor(options: NativeMessagingHostOptions = {}) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.inputIterator = this.input[Symbol.asyncIterator]();
    this.createApp =
      options.createApp ??
      (async () => (await import('../app.js')).createServer({ logToStderr: true }));
  }

  async initialize(): Promise<void> {
    this.app = await this.createApp();
    await this.app.ready();
    this.log('Native Messaging Host initialized');
  }

  private log(message: string): void {
    process.stderr.write(`[NativeHost] ${message}\n`);
  }

  private async readMessage(): Promise<NativeMessage | null> {
    while (true) {
      if (this.inputBuffer.length >= 4) {
        const messageLength = this.inputBuffer.readUInt32LE(0);
        if (messageLength === 0) {
          this.inputBuffer = this.inputBuffer.subarray(4);
          return null;
        }

        if (this.inputBuffer.length >= messageLength + 4) {
          const payload = this.inputBuffer.subarray(4, messageLength + 4);
          this.inputBuffer = this.inputBuffer.subarray(messageLength + 4);
          try {
            return JSON.parse(payload.toString('utf-8')) as NativeMessage;
          } catch (error) {
            throw new Error(`Invalid JSON: ${error}`);
          }
        }
      }

      const { value, done } = await this.inputIterator.next();
      if (done) {
        return null;
      }

      this.inputBuffer = Buffer.concat([this.inputBuffer, Buffer.from(value as Uint8Array)]);
    }
  }

  private writeMessage(response: NativeResponse): void {
    let buffer = Buffer.from(JSON.stringify(response), 'utf-8');
    if (buffer.length > MAX_NATIVE_MESSAGE_SIZE) {
      buffer = Buffer.from(
        JSON.stringify({
          id: response.id,
          type: 'error',
          error: 'Response exceeds the 1 MB Native Messaging limit',
        }),
        'utf-8'
      );
    }

    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);
    this.output.write(Buffer.concat([lengthBuffer, buffer]));
  }

  private async handleMessage(message: NativeMessage): Promise<void> {
    if (message.type === 'abort') {
      const controller = this.activeStreams.get(message.id);
      if (controller) {
        controller.abort();
        this.activeStreams.delete(message.id);
      }
      return;
    }

    if (!this.app) {
      this.writeMessage({
        id: message.id,
        type: 'error',
        error: 'Host not initialized',
      });
      return;
    }

    try {
      if (message.type === 'stream') {
        await this.handleStreamMessage(message);
        return;
      }

      const response = await this.app.inject({
        method: message.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: message.path,
        payload: message.body as Record<string, unknown> | undefined,
        headers: {
          'content-type': 'application/json',
        },
      });

      this.writeMessage({
        id: message.id,
        type: 'response',
        status: response.statusCode,
        data: this.parsePayload(String(response.payload)),
      });
    } catch (error) {
      this.writeMessage({
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleStreamMessage(message: NativeMessage): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(message.id, controller);

    try {
      const response = await this.app?.inject({
        method: message.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: message.path,
        payload: message.body as Record<string, unknown> | undefined,
        headers: {
          'content-type': 'application/json',
        },
        payloadAsStream: true,
        signal: controller.signal,
      });

      if (!response || controller.signal.aborted) {
        return;
      }

      const contentType = response.headers['content-type'];
      if (response.statusCode >= 400 || !contentType?.includes('text/event-stream')) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.stream()) {
          if (controller.signal.aborted) {
            return;
          }
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        this.writeMessage({
          id: message.id,
          type: 'response',
          status: response.statusCode,
          data: this.parsePayload(Buffer.concat(chunks).toString('utf-8')),
        });
        return;
      }

      await this.handleStreamResponse(message.id, response.stream(), controller);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.writeMessage({
          id: message.id,
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      if (this.activeStreams.get(message.id) === controller) {
        this.activeStreams.delete(message.id);
      }
    }
  }

  private parsePayload(payload: string): unknown {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  private async handleStreamResponse(
    id: string,
    stream: Readable,
    controller: AbortController
  ): Promise<void> {
    let lineBuffer = '';
    let streamEnded = false;

    const handleLine = (line: string) => {
      const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line;
      if (!normalizedLine.startsWith('data: ')) {
        return;
      }

      const data = normalizedLine.slice(6);
      if (data === '[DONE]') {
        if (!streamEnded) {
          this.writeMessage({ id, type: 'stream_end' });
          streamEnded = true;
        }
        return;
      }

      if (streamEnded) {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = { raw: data };
      }

      this.writeMessage({
        id,
        type: 'stream_chunk',
        data: parsed,
      });
    };

    for await (const chunk of stream) {
      if (controller.signal.aborted) {
        return;
      }

      lineBuffer += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      let newlineIndex = lineBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        handleLine(lineBuffer.slice(0, newlineIndex));
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        newlineIndex = lineBuffer.indexOf('\n');
      }
    }

    if (controller.signal.aborted) {
      return;
    }

    if (lineBuffer.length > 0) {
      handleLine(lineBuffer);
    }

    if (!streamEnded) {
      this.writeMessage({ id, type: 'stream_end' });
    }
  }

  async run(): Promise<void> {
    await this.initialize();
    while (true) {
      try {
        const message = await this.readMessage();
        if (message === null) {
          this.log('stdin closed, shutting down');
          break;
        }

        const pending = this.handleMessage(message).catch((error) => {
          this.log(`Error handling message: ${error}`);
        });
        this.pendingMessages.add(pending);
        void pending.finally(() => this.pendingMessages.delete(pending));
      } catch (error) {
        this.log(`Error reading message: ${error}`);
        break;
      }
    }

    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    for (const controller of this.activeStreams.values()) {
      controller.abort();
    }
    this.activeStreams.clear();

    await Promise.allSettled(this.pendingMessages);

    if (this.app) {
      await this.app.close();
      this.app = null;
    }

    this.log('Native Messaging Host shut down');
  }
}

// Entry point when run directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;

  const host = new NativeMessagingHost();
  host.run().then(
    () => process.exit(0),
    (err) => {
      process.stderr.write(`Fatal error: ${err}\n`);
      process.exit(1);
    }
  );
}
