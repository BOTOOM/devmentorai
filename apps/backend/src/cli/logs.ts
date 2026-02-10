/**
 * CLI: logs command
 * Tail the DevMentorAI server log file.
 */

import fs from 'node:fs';
import { LOG_FILE } from '../lib/paths.js';
import type { CliOptions } from '../cli.js';

export async function logsCommand(options: CliOptions): Promise<void> {
  const lines = options.lines || 50;

  if (!fs.existsSync(LOG_FILE)) {
    console.log(`\n⊘ No log file found at ${LOG_FILE}`);
    console.log('  The server may not have been started yet.\n');
    return;
  }

  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const allLines = content.split('\n');
  const tailLines = allLines.slice(-lines).join('\n');

  console.log(`\n📋 Last ${lines} lines of ${LOG_FILE}:\n`);
  console.log(tailLines);
  console.log('');
}
