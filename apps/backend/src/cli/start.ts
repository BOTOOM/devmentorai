/**
 * CLI: start command
 * Starts the DevMentorAI server in background or foreground mode.
 */

import type { CliOptions } from '../cli.js';
import { isServerRunning, spawnServer, waitForHealthy } from '../lib/daemon.js';
import { LOG_FILE } from '../lib/paths.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

export async function startCommand(options: CliOptions): Promise<void> {
  const port = options.port || DEFAULT_PORT;

  // Check if already running
  const status = await isServerRunning(port);
  if (status.running) {
    console.log(`\n✓ DevMentorAI server is already running (PID: ${status.pid || 'unknown'})`);
    console.log(`  → http://127.0.0.1:${port}`);
    console.log(`  Health: ${status.healthy ? '✓ healthy' : '✗ unhealthy'}\n`);
    return;
  }

  // Foreground mode — import and run server directly
  if (options.foreground) {
    console.log(`\n🚀 Starting DevMentorAI server on port ${port} (foreground)...\n`);
    process.env.DEVMENTORAI_PORT = String(port);
    const { createServer } = await import('../server.js');
    const fastify = await createServer();
    await fastify.listen({ port, host: '0.0.0.0' });
    return;
  }

  // Background mode
  console.log(`\n🚀 Starting DevMentorAI server on port ${port}...`);

  spawnServer(port);

  // Wait for the server to become healthy
  const healthy = await waitForHealthy(port);

  if (healthy) {
    console.log(`✓ Server started successfully`);
    console.log(`  → http://127.0.0.1:${port}`);
    console.log(`  Logs: ${LOG_FILE}\n`);
  } else {
    console.error(`✗ Server started but healthcheck failed`);
    console.error(`  Check logs: ${LOG_FILE}\n`);
    process.exit(1);
  }
}
