/**
 * CLI: status command
 * Shows the current status of the DevMentorAI server.
 */

import { isServerRunning, readPid, healthcheck } from '../lib/daemon.js';
import { PID_FILE, LOG_FILE, DATA_DIR } from '../lib/paths.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

export async function statusCommand(): Promise<void> {
  const status = await isServerRunning(DEFAULT_PORT);

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     DevMentorAI Server Status        ║');
  console.log('╚══════════════════════════════════════╝\n');

  if (!status.running) {
    console.log('  Status:  ⊘ stopped');
    console.log(`  Port:    ${DEFAULT_PORT}`);
    console.log(`  Data:    ${DATA_DIR}\n`);
    return;
  }

  const pid = readPid();
  const health = await healthcheck(DEFAULT_PORT);

  console.log(`  Status:  ✓ running`);
  console.log(`  PID:     ${pid || 'unknown'}`);
  console.log(`  Port:    ${DEFAULT_PORT}`);
  console.log(`  URL:     http://127.0.0.1:${DEFAULT_PORT}`);
  console.log(`  Health:  ${health.ok ? '✓ healthy' : '✗ unhealthy'}`);

  if (health.ok && health.data?.data) {
    const data = health.data.data as Record<string, unknown>;
    if (data.uptime) {
      console.log(`  Uptime:  ${formatUptime(data.uptime as number)}`);
    }
    if (data.copilotConnected !== undefined) {
      console.log(`  Copilot: ${data.copilotConnected ? '✓ connected' : '⊘ disconnected (mock mode)'}`);
    }
  }

  console.log(`  PID file: ${PID_FILE}`);
  console.log(`  Logs:     ${LOG_FILE}`);
  console.log(`  Data:     ${DATA_DIR}\n`);
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
