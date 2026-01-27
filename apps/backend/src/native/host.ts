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

import { createServer } from '../server.js';
import type { FastifyInstance } from 'fastify';

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

class NativeMessagingHost {
  private app: FastifyInstance | null = null;
  private activeStreams = new Map<string, AbortController>();

  async initialize(): Promise<void> {
    this.app = await createServer();
    await this.app.ready();
    this.log('Native Messaging Host initialized');
  }

  private log(message: string): void {
    // Write logs to stderr (not stdout, which is reserved for native messaging)
    process.stderr.write(`[NativeHost] ${message}\n`);
  }

  /**
   * Read a native message from stdin
   * Format: 4-byte length (little-endian) + JSON payload
   */
  private readMessage(): Promise<NativeMessage | null> {
    return new Promise((resolve, reject) => {
      // Read 4-byte length header
      const lengthBuffer = Buffer.alloc(4);
      let bytesRead = 0;

      const readLength = () => {
        const chunk = process.stdin.read(4 - bytesRead);
        if (chunk === null) {
          // No data available yet
          process.stdin.once('readable', readLength);
          return;
        }

        chunk.copy(lengthBuffer, bytesRead);
        bytesRead += chunk.length;

        if (bytesRead < 4) {
          process.stdin.once('readable', readLength);
          return;
        }

        const messageLength = lengthBuffer.readUInt32LE(0);
        
        if (messageLength === 0) {
          resolve(null);
          return;
        }

        // Read message body
        let messageBuffer = Buffer.alloc(0);
        
        const readBody = () => {
          const remaining = messageLength - messageBuffer.length;
          const bodyChunk = process.stdin.read(remaining);
          
          if (bodyChunk === null) {
            process.stdin.once('readable', readBody);
            return;
          }

          messageBuffer = Buffer.concat([messageBuffer, bodyChunk]);

          if (messageBuffer.length < messageLength) {
            process.stdin.once('readable', readBody);
            return;
          }

          try {
            const message = JSON.parse(messageBuffer.toString('utf-8'));
            resolve(message);
          } catch (err) {
            reject(new Error(`Invalid JSON: ${err}`));
          }
        };

        readBody();
      };

      readLength();
    });
  }

  /**
   * Write a native message to stdout
   * Format: 4-byte length (little-endian) + JSON payload
   */
  private writeMessage(response: NativeResponse): void {
    const json = JSON.stringify(response);
    const buffer = Buffer.from(json, 'utf-8');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);

    process.stdout.write(lengthBuffer);
    process.stdout.write(buffer);
  }

  /**
   * Handle incoming native message by routing to Fastify
   */
  private async handleMessage(message: NativeMessage): Promise<void> {
    if (!this.app) {
      this.writeMessage({
        id: message.id,
        type: 'error',
        error: 'Host not initialized',
      });
      return;
    }

    // Handle abort requests
    if (message.type === 'abort') {
      const controller = this.activeStreams.get(message.id);
      if (controller) {
        controller.abort();
        this.activeStreams.delete(message.id);
      }
      return;
    }

    try {
      // Route the request through Fastify's inject method
      const response = await this.app.inject({
        method: message.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: message.path,
        payload: message.body,
        headers: {
          'content-type': 'application/json',
        },
      });

      // Check if this is a streaming response
      if (message.type === 'stream' && response.headers['content-type']?.includes('text/event-stream')) {
        // Handle SSE streaming
        await this.handleStreamResponse(message.id, response.payload);
      } else {
        // Regular response
        let data: unknown;
        try {
          data = JSON.parse(response.payload);
        } catch {
          data = response.payload;
        }

        this.writeMessage({
          id: message.id,
          type: 'response',
          status: response.statusCode,
          data,
        });
      }
    } catch (error) {
      this.writeMessage({
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle SSE stream response by converting to native messages
   */
  private async handleStreamResponse(id: string, payload: string): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(id, controller);

    const lines = payload.split('\n');
    
    for (const line of lines) {
      if (controller.signal.aborted) break;

      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          this.writeMessage({
            id,
            type: 'stream_end',
          });
        } else {
          try {
            const parsed = JSON.parse(data);
            this.writeMessage({
              id,
              type: 'stream_chunk',
              data: parsed,
            });
          } catch {
            // Non-JSON data chunk
            this.writeMessage({
              id,
              type: 'stream_chunk',
              data: { raw: data },
            });
          }
        }
      }
    }

    this.activeStreams.delete(id);
  }

  /**
   * Main loop - read and process messages
   */
  async run(): Promise<void> {
    await this.initialize();

    process.stdin.on('end', () => {
      this.log('stdin closed, shutting down');
      process.exit(0);
    });

    // Continuous message processing
    while (true) {
      try {
        const message = await this.readMessage();
        if (message === null) {
          // Connection closed
          break;
        }
        
        // Process message asynchronously
        this.handleMessage(message).catch((err) => {
          this.log(`Error handling message: ${err}`);
        });
      } catch (error) {
        this.log(`Error reading message: ${error}`);
        break;
      }
    }

    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    // Abort all active streams
    for (const controller of this.activeStreams.values()) {
      controller.abort();
    }
    this.activeStreams.clear();

    // Close Fastify
    if (this.app) {
      await this.app.close();
    }

    this.log('Native Messaging Host shut down');
  }
}

// Entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const host = new NativeMessagingHost();
  host.run().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}

export { NativeMessagingHost, type NativeMessage, type NativeResponse };
