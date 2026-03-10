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

The backend supports multiple LLM providers simultaneously. All providers are detected at startup; you choose which one to use **per session**.

### Supported providers

| ID | Type | Auth | Cost |
|----|------|------|------|
| `copilot` | Cloud (SDK) | GitHub Copilot subscription | Included in sub |
| `gemini-cli` | CLI agent | `gemini login` | Free tier / pay |
| `claude-code` | CLI agent | `claude login` | Pay per use |
| `kilo-code` | CLI agent | `kilo login` | Varies |
| `ollama` | Local server | None | Free (runs locally) |
| `lmstudio` | Local server | None | Free (runs locally) |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVMENTORAI_PORT` | `3847` | Backend port |
| `DEVMENTORAI_GEMINI_CLI_COMMAND` | `gemini` | Gemini CLI binary name |
| `DEVMENTORAI_CLAUDE_CODE_COMMAND` | `claude` | Claude Code CLI binary name |
| `DEVMENTORAI_KILO_CODE_COMMAND` | `kilo` | Kilo Code CLI binary name |
| `DEVMENTORAI_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DEVMENTORAI_LMSTUDIO_BASE_URL` | `http://localhost:1234` | LM Studio server URL |

---

### How provider selection works

1. **At startup** the backend probes every registered provider (checks CLI binaries in PATH, pings local server URLs).
2. Providers that respond are marked `ready: true`; others become `ready: false`.
3. When you **create a session**, you pass a `provider` field — the backend routes all chat for that session through the chosen provider.
4. You can **switch provider mid-session** with a `PATCH` request.
5. You can **re-initialize** a provider at runtime (e.g., after starting Ollama) without restarting the backend.

---

### Running locally (development)

From the monorepo root:

```bash
pnpm install
pnpm dev:backend          # starts on port 3847 in foreground
```

All providers that are available on your machine will be detected automatically.

**Quick test — check which providers are ready:**

```bash
curl -s http://localhost:3847/api/providers | jq
```

```json
{
  "success": true,
  "data": [
    { "id": "copilot",     "ready": true,  "mockMode": false },
    { "id": "gemini-cli",  "ready": true,  "mockMode": false },
    { "id": "claude-code", "ready": false, "mockMode": true  },
    { "id": "ollama",      "ready": true,  "mockMode": false },
    { "id": "lmstudio",    "ready": false, "mockMode": true  }
  ]
}
```

---

### Running with npx (published version)

```bash
npx devmentorai-server start --foreground
```

Works exactly the same — providers are detected from whatever is installed on the host. To override URLs or commands, prefix with env vars:

```bash
# Use a custom Ollama host
DEVMENTORAI_OLLAMA_BASE_URL=http://192.168.1.50:11434 npx devmentorai-server start -f

# Use a different Gemini binary
DEVMENTORAI_GEMINI_CLI_COMMAND=/opt/gemini/bin/gemini npx devmentorai-server start -f
```

---

### Running with Docker

```bash
docker compose up -d backend
```

Inside Docker, CLI agents (gemini, claude, kilo) are **not available** because their CLIs are not installed in the container. The providers that work inside Docker are:

| Provider | Available in Docker? | Notes |
|----------|---------------------|-------|
| `copilot` | ✅ Yes | Uses SDK, no CLI needed |
| `ollama` | ✅ Yes | Connects to host via `host.docker.internal` |
| `lmstudio` | ✅ Yes | Connects to host via `host.docker.internal` |
| `gemini-cli` | ❌ No | Requires `gemini` CLI in PATH |
| `claude-code` | ❌ No | Requires `claude` CLI in PATH |
| `kilo-code` | ❌ No | Requires `kilo` CLI in PATH |

To use Ollama from Docker, start Ollama on the **host** first:

```bash
# On host
ollama serve
ollama pull llama3.2

# Then start the backend container
docker compose up -d backend
```

To override the URLs (e.g., Ollama running on another machine):

```bash
DEVMENTORAI_OLLAMA_BASE_URL=http://10.0.0.5:11434 docker compose up -d backend
```

---

### Per-provider setup guide

#### Copilot (default)

```bash
# No extra setup needed if you have a GitHub Copilot subscription.
# The backend uses the Copilot SDK which authenticates via your GitHub session.
```

#### Gemini CLI

```bash
# Install: https://github.com/google-gemini/gemini-cli
npm install -g @anthropic-ai/gemini-cli  # or: brew install gemini
gemini login                              # authenticate with Google
# Restart backend or call POST /api/providers/gemini-cli/reinitialize
```

#### Claude Code

```bash
# Install: https://docs.anthropic.com/en/docs/claude-code
npm install -g @anthropic-ai/claude-code
claude login                              # authenticate with Anthropic
# Restart backend or call POST /api/providers/claude-code/reinitialize
```

#### Ollama

```bash
# Install: https://ollama.com/download
ollama serve                  # Start server (default :11434)
ollama pull llama3.2          # Download a model
ollama pull mistral           # Download another model
# Models are discovered automatically — no restart needed, just reinitialize
```

#### LM Studio

```
1. Download from https://lmstudio.ai
2. Open LM Studio → download a model
3. Go to Local Server tab → click Start
4. Default URL: http://localhost:1234
```

---

### Using providers via the API (curl examples)

The full workflow is: **check providers → create session with provider → chat → (optionally switch provider)**.

#### 1. Check available providers

```bash
curl -s http://localhost:3847/api/providers | jq
```

#### 2. List models for a specific provider

```bash
# All models from all providers
curl -s http://localhost:3847/api/models | jq

# Only models from a specific provider
curl -s "http://localhost:3847/api/models?provider=ollama" | jq
curl -s "http://localhost:3847/api/models?provider=gemini-cli" | jq
curl -s "http://localhost:3847/api/models?provider=copilot" | jq
```

#### 3. Create a session with a specific provider

```bash
# Session using Gemini CLI
curl -s -X POST http://localhost:3847/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Gemini",
    "type": "general",
    "provider": "gemini-cli",
    "model": "gemini-2.5-pro"
  }' | jq

# Session using Ollama
curl -s -X POST http://localhost:3847/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Ollama",
    "type": "general",
    "provider": "ollama",
    "model": "llama3.2"
  }' | jq

# Session using Claude Code
curl -s -X POST http://localhost:3847/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Claude",
    "type": "development",
    "provider": "claude-code",
    "model": "claude-sonnet-4"
  }' | jq

# Session using Copilot (default — provider can be omitted)
curl -s -X POST http://localhost:3847/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Copilot",
    "type": "devops"
  }' | jq
```

#### 4. Send a message (streaming)

```bash
# Replace SESSION_ID with the id from step 3
curl -N -X POST http://localhost:3847/api/sessions/SESSION_ID/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain what Kubernetes is in 3 sentences"}'
```

The response is an SSE stream with `data:` lines containing JSON events:

```
data: {"type":"assistant.message_delta","data":{"deltaContent":"Kubernetes is..."}}
data: {"type":"assistant.message","data":{"content":"Kubernetes is a container orchestration..."}}
data: {"type":"session.idle","data":{}}
data: [DONE]
```

#### 5. Switch provider on an existing session

```bash
# Switch a session from copilot to ollama
curl -s -X PATCH http://localhost:3847/api/sessions/SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "llama3.2"
  }' | jq
```

The backend destroys the old provider session and creates a new one transparently. The conversation history in the database is preserved.

#### 6. Re-initialize a provider at runtime

If you started Ollama **after** the backend was already running:

```bash
# Tell the backend to re-probe Ollama
curl -s -X POST http://localhost:3847/api/providers/ollama/reinitialize \
  -H "Content-Type: application/json" | jq

# Response:
# { "success": true, "data": { "provider": "ollama", "ready": true, "mockMode": false } }
```

This works for any provider — useful when you install a CLI or start a local server without restarting the backend.

#### 7. Check auth and quota for a provider

```bash
curl -s "http://localhost:3847/api/account/auth?provider=copilot" | jq
curl -s "http://localhost:3847/api/account/quota?provider=copilot" | jq
curl -s "http://localhost:3847/api/account/auth?provider=ollama" | jq
```

---

### Quick reference: testing each provider end-to-end

```bash
BASE=http://localhost:3847

# ── Copilot ──
curl -s -X POST $BASE/api/sessions -H "Content-Type: application/json" \
  -d '{"name":"copilot-test","type":"general"}' | jq '.data.id' -r | read SID
curl -N -X POST $BASE/api/sessions/$SID/chat/stream -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}'

# ── Gemini CLI ──
curl -s -X POST $BASE/api/sessions -H "Content-Type: application/json" \
  -d '{"name":"gemini-test","type":"general","provider":"gemini-cli","model":"gemini-2.5-pro"}' | jq '.data.id' -r | read SID
curl -N -X POST $BASE/api/sessions/$SID/chat/stream -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}'

# ── Claude Code ──
curl -s -X POST $BASE/api/sessions -H "Content-Type: application/json" \
  -d '{"name":"claude-test","type":"general","provider":"claude-code","model":"claude-sonnet-4"}' | jq '.data.id' -r | read SID
curl -N -X POST $BASE/api/sessions/$SID/chat/stream -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}'

# ── Ollama ──
curl -s -X POST $BASE/api/sessions -H "Content-Type: application/json" \
  -d '{"name":"ollama-test","type":"general","provider":"ollama","model":"llama3.2"}' | jq '.data.id' -r | read SID
curl -N -X POST $BASE/api/sessions/$SID/chat/stream -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}'

# ── LM Studio ──
curl -s -X POST $BASE/api/sessions -H "Content-Type: application/json" \
  -d '{"name":"lmstudio-test","type":"general","provider":"lmstudio","model":"default"}' | jq '.data.id' -r | read SID
curl -N -X POST $BASE/api/sessions/$SID/chat/stream -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}'
```

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
