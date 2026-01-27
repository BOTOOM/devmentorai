import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { chatRoutes } from './routes/chat.js';
import { CopilotService } from './services/copilot.service.js';
import { SessionService } from './services/session.service.js';
import { initDatabase } from './db/index.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const PORT = DEFAULT_CONFIG.DEFAULT_PORT;
const HOST = '0.0.0.0';

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
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

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...');
    try {
      await copilotService.shutdown();
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
