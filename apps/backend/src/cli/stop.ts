/**
 * CLI: stop command
 * Stops the running DevMentorAI server.
 */

import { isServerRunning, stopServer, readPid } from '../lib/daemon.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

export async function stopCommand(): Promise<void> {
  const pid = readPid();
  const status = await isServerRunning(DEFAULT_PORT);

  if (!status.running) {
    console.log('\n⊘ DevMentorAI server is not running.\n');
    return;
  }

  console.log(`\n⏳ Stopping DevMentorAI server (PID: ${pid || 'unknown'})...`);

  const stopped = await stopServer();

  if (stopped) {
    console.log('✓ Server stopped successfully.\n');
  } else {
    console.error('✗ Failed to stop server. You may need to kill the process manually.\n');
    process.exit(1);
  }
}
