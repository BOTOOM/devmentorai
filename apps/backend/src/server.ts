import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { chatRoutes } from './routes/chat.js';
import { modelsRoutes } from './routes/models.js';
import { accountRoutes } from './routes/account.js';
import { imagesRoutes } from './routes/images.js';
import { updatesRoutes } from './routes/updates.js';
import { registerToolsRoutes } from './routes/tools.js';
import { CopilotService } from './services/copilot.service.js';
import { SessionService } from './services/session.service.js';
import { initDatabase } from './db/index.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const PORT = Number.parseInt(process.env.DEVMENTORAI_PORT || '', 10) || DEFAULT_CONFIG.DEFAULT_PORT;
const HOST = '0.0.0.0';

// Observability mode - enable with DEVMENTORAI_DEBUG=true
const DEBUG_MODE = true;

/**
 * Truncate long strings for logging
 */
function truncate(str: string | undefined | null, maxLen = 500): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... [truncated ${str.length - maxLen} chars]`;
}

export async function createServer() {
  const fastify = Fastify({
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
  const copilotService = new CopilotService(sessionService);
  
  try {
    await copilotService.initialize();
    fastify.log.info('CopilotService initialized');
  } catch (err) {
    fastify.log.error({ err }, 'Failed to initialize CopilotService');
    fastify.log.warn('Running in mock mode - Copilot features will be simulated');
  }

  // Decorate fastify with services
  fastify.decorate('sessionService', sessionService);
  fastify.decorate('copilotService', copilotService);

  // Register plugins
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(sessionRoutes, { prefix: '/api' });
  await fastify.register(chatRoutes, { prefix: '/api' });
  await fastify.register(modelsRoutes, { prefix: '/api' });
  await fastify.register(accountRoutes, { prefix: '/api' });
  await fastify.register(updatesRoutes, { prefix: '/api' });
  await fastify.register(imagesRoutes, { prefix: '/api/images' });
  
  // Register tools routes (not prefixed - has /api in route definitions)
  registerToolsRoutes(fastify, copilotService);

  return fastify;
}

async function main() {
  const fastify = await createServer();
  let shuttingDown = false;

  // Graceful shutdown
  const shutdown = async (
    reason: 'SIGINT' | 'SIGTERM' | 'UNCAUGHT_EXCEPTION',
    error?: unknown,
  ) => {
    if (shuttingDown) return;
    shuttingDown = true;

    fastify.log.warn({ reason }, 'Shutting down...');
    if (error) {
      fastify.log.error({ err: error }, 'Fatal process error');
    }

    let exitCode = 0;
    try {
      await fastify.copilotService.shutdown();
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
    copilotService: CopilotService;
  }
}
