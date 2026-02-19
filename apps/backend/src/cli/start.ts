/**
 * CLI: start command
 * Starts the DevMentorAI server in background or foreground mode.
 */

import type { CliOptions } from '../cli.js';
import { isServerRunning, spawnServer, waitForHealthy } from '../lib/daemon.js';
import { LOG_FILE } from '../lib/paths.js';
import { DEFAULT_CONFIG, checkForUpdate } from '@devmentorai/shared';
import { BACKEND_VERSION } from '../version.js';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

async function showUpdateNotice(): Promise<void> {
  try {
    const info = await checkForUpdate('backend', BACKEND_VERSION);
    if (info.hasUpdate) {
      console.log(`\n  ⚠ Update available: ${BACKEND_VERSION} → ${info.latestVersion}`);
      console.log(`    Run: npx devmentorai-server@latest`);
      console.log(`    Or: npm install -g devmentorai-server@latest`);
      console.log(`    ${info.releaseUrl}\n`);
    }
  } catch {
    // Silent — don't block startup for update check
  }
}

async function showAuthNotice(port: number): Promise<void> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/account/auth`);
    if (!response.ok) return;

    const payload = await response.json() as {
      success?: boolean;
      data?: { isAuthenticated?: boolean; login?: string | null };
    };

    if (!payload.success) return;

    if (payload.data?.isAuthenticated) {
      if (payload.data.login) {
        console.log(`  Copilot authenticated as @${payload.data.login}`);
      }
      return;
    }

    console.log('  ⚠ Copilot login required for real responses.');
    console.log('    Run: github-copilot auth login');
    console.log('    Or:  copilot auth login\n');
  } catch {
    // Do not block startup when auth check is unavailable.
  }
}

export async function startCommand(options: CliOptions): Promise<void> {
  const port = options.port || DEFAULT_PORT;

  // Check if already running
  const status = await isServerRunning(port);
  if (status.running) {
    console.log(`\n✓ DevMentorAI server is already running (PID: ${status.pid || 'unknown'})`);
    console.log(`  → http://127.0.0.1:${port}`);
    console.log(`  Health: ${status.healthy ? '✓ healthy' : '✗ unhealthy'}\n`);
    await showAuthNotice(port);
    await showUpdateNotice();
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
    await showAuthNotice(port);
    await showUpdateNotice();
  } else {
    console.error(`✗ Server started but healthcheck failed`);
    console.error(`  Check logs: ${LOG_FILE}\n`);
    process.exit(1);
  }
}
