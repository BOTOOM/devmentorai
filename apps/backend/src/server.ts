import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { chatRoutes } from './routes/chat.js';
import { modelsRoutes } from './routes/models.js';
import { imagesRoutes } from './routes/images.js';
import { updatesRoutes } from './routes/updates.js';
import { registerToolsRoutes } from './routes/tools.js';
import { CopilotService } from './services/copilot.service.js';
import { SessionService } from './services/session.service.js';
import { initDatabase } from './db/index.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const PORT = parseInt(process.env.DEVMENTORAI_PORT || '', 10) || DEFAULT_CONFIG.DEFAULT_PORT;
const HOST = '0.0.0.0';

// Observability mode - enable with DEVMENTORAI_DEBUG=true
const DEBUG_MODE = true;
// const DEBUG_MODE = process.env.DEVMENTORAI_DEBUG === 'true';

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
  await fastify.register(updatesRoutes, { prefix: '/api' });
  await fastify.register(imagesRoutes, { prefix: '/api/images' });
  
  // Register tools routes (not prefixed - has /api in route definitions)
  registerToolsRoutes(fastify, copilotService);

  return fastify;
}

async function main() {
  const fastify = await createServer();

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    try {
      await fastify.copilotService.shutdown();
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 DevMentorAI backend running at http://${HOST}:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    sessionService: SessionService;
    copilotService: CopilotService;
  }
}
