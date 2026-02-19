/**
 * CLI: doctor command
 * Verifies system requirements and dependencies for DevMentorAI server.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { DATA_DIR, LOG_DIR, IMAGES_DIR } from '../lib/paths.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function doctorCommand(): Promise<void> {
  console.log('\n🔍 DevMentorAI Server Doctor\n');

  const checks: CheckResult[] = [];

  // 1. Node.js version
  checks.push(checkNodeVersion());

  // 2. Data directory
  checks.push(checkDataDirectory());

  // 3. Port availability
  checks.push(await checkPort(DEFAULT_PORT));

  // 4. Copilot CLI
  checks.push(checkCopilotCli());

  // Display results
  let hasFailure = false;
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (check.status === 'fail') hasFailure = true;
  }

  console.log('');
  if (hasFailure) {
    console.log('  Some checks failed. Please fix the issues above.\n');
    process.exit(1);
  } else {
    console.log('  All checks passed! The server is ready to run.\n');
  }
}

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 20) {
    return { name: 'Node.js', status: 'pass', message: `${version} (>= 20 required)` };
  }
  return { name: 'Node.js', status: 'fail', message: `${version} — Node.js >= 20 is required` };
}

function checkDataDirectory(): CheckResult {
  const dirs = [DATA_DIR, LOG_DIR, IMAGES_DIR];
  const missing: string[] = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      missing.push(dir);
    }
  }

  if (missing.length === 0) {
    return { name: 'Data directory', status: 'pass', message: DATA_DIR };
  }

  // Try to create missing dirs
  try {
    for (const dir of missing) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return { name: 'Data directory', status: 'pass', message: `${DATA_DIR} (created)` };
  } catch (err) {
    return { name: 'Data directory', status: 'fail', message: `Cannot create ${DATA_DIR}: ${err}` };
  }
}

function checkPort(port: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ name: `Port ${port}`, status: 'warn', message: `Port ${port} is in use (server may already be running)` });
      } else {
        resolve({ name: `Port ${port}`, status: 'fail', message: `Cannot bind port ${port}: ${err.message}` });
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve({ name: `Port ${port}`, status: 'pass', message: `Port ${port} is available` });
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

function checkCopilotCli(): CheckResult {
  try {
    const version = execSync('github-copilot --version 2>/dev/null || copilot --version 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return { name: 'Copilot CLI', status: 'pass', message: version || 'installed' };
  } catch {
    return { name: 'Copilot CLI', status: 'warn', message: 'Not found — server will run in mock mode' };
  }
}
