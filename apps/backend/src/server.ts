import { DEFAULT_CONFIG } from '@devmentorai/shared';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { registerAcpGateway } from './acp/gateway.js';
import { AcpPairingStore } from './acp/pairing.js';
import { initDatabase } from './db/index.js';
import { healthRoutes } from './routes/health.js';
import { imagesRoutes } from './routes/images.js';
import { sessionRoutes } from './routes/sessions.js';
import { updatesRoutes } from './routes/updates.js';
import { SessionService } from './services/session.service.js';

const PORT = Number.parseInt(process.env.DEVMENTORAI_PORT || '', 10) || DEFAULT_CONFIG.DEFAULT_PORT;
const HOST = process.env.ACP_HOST || '127.0.0.1';

// Observability mode - enable with DEVMENTORAI_DEBUG=true
const DEBUG_MODE = true;

/**
 * Truncate long strings for logging
 */
function truncate(str: string | undefined | null, maxLen = 500): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}... [truncated ${str.length - maxLen} chars]`;
}

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

function isAllowedRestOrigin(origin: string | undefined): boolean {
  // Native clients and same-origin requests send no Origin header.
  if (!origin) return true;
  if (AcpPairingStore.isExtensionOrigin(origin) || LOCAL_ORIGIN.test(origin)) return true;
  const configured = [
    process.env.ACP_EXTENSION_ORIGIN,
    ...(process.env.ACP_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()),
  ].filter(Boolean);
  return configured.includes(origin);
}

export async function createServer() {
  const fastify = Fastify({
    // Allow large payloads for image uploads (data URLs can be 10-30MB for full-page screenshots)
    bodyLimit: 50 * 1024 * 1024, // 50MB
    logger: {
      level: DEBUG_MODE ? 'debug' : 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Observability middleware - log all requests and responses
  if (DEBUG_MODE) {
    fastify.log.info('🔍 Debug mode enabled - logging all requests and responses');

    // Log after body is parsed
    fastify.addHook('preHandler', async (request) => {
      const body = request.body ? truncate(JSON.stringify(request.body)) : null;
      fastify.log.debug({
        type: '→ REQUEST',
        method: request.method,
        url: request.url,
        headers: {
          'content-type': request.headers['content-type'],
          'user-agent': request.headers['user-agent'],
        },
        body: body,
      });
    });

    fastify.addHook('onSend', async (request, reply, payload) => {
      const statusCode = reply.statusCode;
      let responseBody: string | null = null;

      // Skip logging SSE streams (too verbose)
      if (reply.getHeader('content-type') === 'text/event-stream') {
        responseBody = '[SSE Stream]';
      } else if (typeof payload === 'string') {
        responseBody = truncate(payload);
      } else if (Buffer.isBuffer(payload)) {
        responseBody = truncate(payload.toString());
      }

      fastify.log.debug({
        type: '← RESPONSE',
        method: request.method,
        url: request.url,
        statusCode,
        body: responseBody,
      });

      return payload;
    });

    fastify.addHook('onError', async (request, reply, error) => {
      fastify.log.error({
        type: '✗ ERROR',
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
      });
    });
  }

  // Initialize database
  const db = initDatabase();
  fastify.log.info('Database initialized');

  // Initialize services
  const sessionService = new SessionService(db);
  const acpGateway = await registerAcpGateway(fastify, {
    db,
    workspaceRoot: process.env.ACP_WORKSPACE_ROOT,
    extensionOrigin: process.env.ACP_EXTENSION_ORIGIN,
    allowedOrigins: (process.env.ACP_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    idleTimeoutMs: Number(process.env.ACP_IDLE_TIMEOUT_MS) || undefined,
  });
  if (acpGateway) {
    fastify.decorate('acpGateway', acpGateway);
  }

  // Decorate fastify with services
  fastify.decorate('sessionService', sessionService);

  // Register plugins
  await fastify.register(cors, {
    // The backend is a local ACP host: only browser extensions and local tooling
    // may call it from a browser context.
    origin: (origin, callback) => callback(null, isAllowedRestOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(sessionRoutes, { prefix: '/api' });
  await fastify.register(updatesRoutes, { prefix: '/api' });
  await fastify.register(imagesRoutes, { prefix: '/api/images' });

  return fastify;
}

async function main() {
  const fastify = await createServer();
  let shuttingDown = false;

  // Graceful shutdown
  const shutdown = async (reason: 'SIGINT' | 'SIGTERM' | 'UNCAUGHT_EXCEPTION', error?: unknown) => {
    if (shuttingDown) return;
    shuttingDown = true;

    fastify.log.warn({ reason }, 'Shutting down...');
    if (error) {
      fastify.log.error({ err: error }, 'Fatal process error');
    }

    let exitCode = 0;
    try {
      await fastify.acpGateway?.shutdown();
      await fastify.close();
    } catch (err) {
      exitCode = 1;
      fastify.log.error({ err }, 'Error during shutdown');
    } finally {
      process.exit(exitCode);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  // Keep process alive on unhandled promise rejections and log root cause.
  process.on('unhandledRejection', (reason) => {
    fastify.log.error({ err: reason }, 'Unhandled promise rejection');
  });

  // For uncaught exceptions, perform a controlled shutdown.
  process.on('uncaughtException', (error) => {
    void shutdown('UNCAUGHT_EXCEPTION', error);
  });

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 DevMentorAI backend running at http://${HOST}:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  // Fallback logger for bootstrap failures before Fastify is fully available
  console.error('[DevMentorAI] Fatal startup error:', error);
  process.exit(1);
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    sessionService: SessionService;
    acpGateway?: Awaited<ReturnType<typeof registerAcpGateway>>;
  }
}
