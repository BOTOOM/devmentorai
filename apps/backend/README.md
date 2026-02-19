# devmentorai-server

AI-powered DevOps mentoring and writing assistant backend, powered by [GitHub Copilot](https://github.com/features/copilot).

Part of the [DevMentorAI](https://github.com/BOTOOM/devmentorai) project.

## Quick Start

```bash
npx devmentorai-server
```

That's it! The server starts in the background on port **3847**.

## Installation

### Run without installing (recommended)

```bash
npx devmentorai-server
```

### Install globally

```bash
npm install -g devmentorai-server
devmentorai-server
```

## Long-Running Usage (No Interruptions)

`npx devmentorai-server` is supported and starts the backend in background mode, but for long-running sessions (hours/days) you should use a process supervisor.

### Option 1: Global install + PM2 (recommended)

```bash
npm install -g devmentorai-server pm2
pm2 start "devmentorai-server start --foreground" --name devmentorai-server
pm2 save
pm2 status
```

### Option 2: systemd (Linux)

Create a user service that runs:

```bash
devmentorai-server start --foreground
```

Then enable restart policies (`Restart=always`) so the backend auto-recovers if it crashes.

## Commands

| Command | Description |
|---------|-------------|
| `devmentorai-server start` | Start the server in background (default) |
| `devmentorai-server stop` | Stop the running server |
| `devmentorai-server status` | Show server status (PID, port, health) |
| `devmentorai-server logs` | View recent server logs |
| `devmentorai-server doctor` | Check system requirements |

## Options

| Option | Description |
|--------|-------------|
| `--port <port>` | Port to listen on (default: 3847) |
| `--foreground, -f` | Run in foreground (don't daemonize) |
| `--lines, -n` | Number of log lines to show (default: 50) |
| `--help, -h` | Show help message |
| `--version, -v` | Show version |

## Examples

```bash
# Start server on a custom port
devmentorai-server start --port 4000

# Run in foreground (useful for debugging)
devmentorai-server start --foreground

# Check if everything is set up correctly
devmentorai-server doctor

# View last 100 lines of logs
devmentorai-server logs --lines 100
```

## Requirements

- **Node.js** >= 20.0.0
- **GitHub Copilot CLI** (optional — server runs in mock mode without it)

## How It Works

The server runs as a background process and stores its data in `~/.devmentorai/`:

```
~/.devmentorai/
├── devmentorai.db      # SQLite database (sessions, messages)
├── server.pid          # PID of running server
├── config.json         # User configuration
├── logs/
│   └── server.log      # Server logs
└── images/             # Session image thumbnails
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/sessions` | List sessions |
| `POST /api/sessions` | Create a new session |
| `POST /api/chat/:sessionId` | Send a message |
| `GET /api/models` | List available models |

## Troubleshooting

### Server won't start

1. Run `devmentorai-server doctor` to check requirements
2. Check logs: `devmentorai-server logs`
3. Try foreground mode: `devmentorai-server start -f`

### Server stops unexpectedly

1. Check the latest backend logs: `devmentorai-server logs --lines 200`
2. Re-run in foreground to capture runtime errors directly: `devmentorai-server start -f`
3. For continuous uptime, run under PM2 or systemd (see **Long-Running Usage**)

### Port already in use

```bash
devmentorai-server start --port 4000
```

### Copilot not connected

The server requires GitHub Copilot CLI to be installed and authenticated. Without it, the server runs in **mock mode** with simulated responses.

```bash
# Install Copilot CLI (if not installed)
npm install -g @github/copilot-cli

# Authenticate
github-copilot auth
```

### Reset data

```bash
rm -rf ~/.devmentorai
devmentorai-server start
```

## Development

This package is part of the [DevMentorAI monorepo](https://github.com/BOTOOM/devmentorai).

```bash
git clone https://github.com/BOTOOM/devmentorai.git
cd devmentorai
pnpm install
pnpm dev:backend
```

## Support

Found a bug or have a feature request? [Open an issue](https://github.com/BOTOOM/devmentorai/issues/new) on GitHub.

## License

MIT © [BOTOOM](https://github.com/BOTOOM)
