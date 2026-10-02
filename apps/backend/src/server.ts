import { startServer } from './app.js';

try {
  await startServer();
} catch (error) {
  console.error('[DevMentorAI] Fatal startup error:', error);
  process.exit(1);
}
