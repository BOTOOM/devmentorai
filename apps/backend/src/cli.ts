/**
 * DevMentorAI Server CLI
 *
 * Usage:
 *   devmentorai-server [command]
 *
 * Commands:
 *   start    Start the server (default)
 *   stop     Stop the running server
 *   status   Show server status
 *   logs     Tail server logs
 *   doctor   Check system requirements
 */

import { startCommand } from './cli/start.js';
import { stopCommand } from './cli/stop.js';
import { statusCommand } from './cli/status.js';
import { logsCommand } from './cli/logs.js';
import { doctorCommand } from './cli/doctor.js';

const VERSION = '0.1.0';

const HELP = `
devmentorai-server v${VERSION}

Usage:
  devmentorai-server [command] [options]

Commands:
  start     Start the server in background (default)
  stop      Stop the running server
  status    Show server status
  logs      Tail server logs
  doctor    Check system requirements and dependencies

Options:
  --port <port>       Port to listen on (default: 3847)
  --foreground, -f    Run in foreground (don't daemonize)
  --help, -h          Show this help message
  --version, -v       Show version

Examples:
  npx devmentorai-server              # Start server in background
  npx devmentorai-server status       # Check if server is running
  npx devmentorai-server stop         # Stop the server
  npx devmentorai-server doctor       # Verify system setup
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }

  const options = parseOptions(args.slice(command === 'start' || command === 'stop' || command === 'status' || command === 'logs' || command === 'doctor' ? 1 : 0));

  try {
    switch (command) {
      case 'start':
        await startCommand(options);
        break;
      case 'stop':
        await stopCommand();
        break;
      case 'status':
        await statusCommand();
        break;
      case 'logs':
        await logsCommand(options);
        break;
      case 'doctor':
        await doctorCommand();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export interface CliOptions {
  port?: number;
  foreground?: boolean;
  lines?: number;
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        options.port = parseInt(args[++i], 10);
        if (isNaN(options.port)) {
          console.error('Error: --port requires a valid number');
          process.exit(1);
        }
        break;
      case '--foreground':
      case '-f':
        options.foreground = true;
        break;
      case '--lines':
      case '-n':
        options.lines = parseInt(args[++i], 10);
        break;
    }
  }

  return options;
}

main();
