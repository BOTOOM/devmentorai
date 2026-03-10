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
- At least one supported provider available:
  - `github-copilot` / `copilot` (Copilot) — cloud, requires subscription
  - `gemini` (Gemini CLI) — local CLI agent
  - `claude` (Claude Code CLI) — local CLI agent
  - `kilo` (Kilo Code CLI) — local CLI agent
  - **Ollama** — local server, free, no account needed
  - **LM Studio** — local server, free, no account needed

## Multi-Provider Support

The backend supports multiple providers through a provider abstraction layer. Current built-in providers:

| Provider | Type | Default |
|----------|------|---------|
| `copilot` | Cloud (SDK) | ✅ fallback |
| `gemini-cli` | CLI agent | |
| `claude-code` | CLI agent | |
| `kilo-code` | CLI agent | |
| `ollama` | Local server (OpenAI-compatible) | |
| `lmstudio` | Local server (OpenAI-compatible) | |

### CLI provider command overrides

You can override detected CLI binaries with environment variables:

```bash
DEVMENTORAI_GEMINI_CLI_COMMAND=gemini
DEVMENTORAI_CLAUDE_CODE_COMMAND=claude
DEVMENTORAI_KILO_CODE_COMMAND=kilo
```

If a provider command is missing, that provider is reported as unavailable and session creation for that provider is blocked with `PROVIDER_NOT_READY`.

### Local server providers (Ollama / LM Studio)

Ollama and LM Studio expose an OpenAI-compatible API. The backend connects to them automatically on startup.

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVMENTORAI_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DEVMENTORAI_LMSTUDIO_BASE_URL` | `http://localhost:1234` | LM Studio server URL |

**Setup:**

```bash
# Ollama
ollama serve                  # Start the server
ollama pull llama3.2          # Download a model
# Models are discovered automatically at startup

# LM Studio
# 1. Open LM Studio and load a model
# 2. Start the local server (Settings → Local Server → Start)
# Models are discovered automatically at startup
```

> **Docker note:** When running the backend in Docker, the default URLs point to `host.docker.internal` so the container can reach servers running on the host. Override with the env vars above if your setup differs.

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
| `POST /api/sessions/:sessionId/chat` | Send a message |
| `POST /api/sessions/:sessionId/chat/stream` | Stream a message (SSE) |
| `GET /api/models` | List available models |
| `GET /api/account/auth` | Provider auth status |
| `GET /api/account/quota` | Provider quota status |
| `GET /api/providers` | List all registered providers with state |
| `POST /api/providers/:id/reinitialize` | Re-initialize a provider at runtime |
| `GET /api/tools` | List provider tools |
| `POST /api/tools/execute` | Execute provider tool |

Provider-aware endpoints accept `?provider=<provider-id>` (for example `?provider=gemini-cli`).

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

### Provider not connected / not ready

If you receive `PROVIDER_NOT_READY` or see unavailable models:

1. Ensure the provider CLI binary is installed and accessible in `PATH`
2. Authenticate using that provider CLI
3. Restart backend

For Copilot specifically:

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
