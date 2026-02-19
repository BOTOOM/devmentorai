# Docker Backend + Copilot CLI Setup

This guide explains how to run the DevMentorAI backend in Docker with:

- GitHub Copilot CLI installed inside the container
- Copilot auth session persisted on the host (`.copilot`)
- Backend data persisted on the host (`.devmentorai`)
- Custom backend port support
- Optional ngrok/cloudflared tunnels
- Manual Copilot CLI update flow

## 1) Prerequisites

- Docker + Docker Compose
- A GitHub account with Copilot access
- Optional: proxy settings if your network restricts outbound HTTPS

## 2) Configure `.env`

Create or update the root `.env` file:

```env
# Backend port exposed on host and used inside container
BACKEND_PORT=3847

# Host path where Copilot session and backend data are persisted
HOST_DEVMENTOR_CONTAINER_DIR=/home/botom/devmentor-container

# Match host user/group to avoid permission issues on bind mounts
HOST_UID=1000
HOST_GID=1000

# Optional (only if your network requires proxy)
HTTP_PROXY=
HTTPS_PROXY=
ALL_PROXY=
NO_PROXY=localhost,127.0.0.1,backend

# Optional for ngrok profile
NGROK_AUTHTOKEN=
```

## 3) Prepare host directories

```bash
mkdir -p /home/botom/devmentor-container/.copilot
mkdir -p /home/botom/devmentor-container/.devmentorai
chown -R "$(id -u):$(id -g)" /home/botom/devmentor-container
```

## 4) Build and start backend container

```bash
docker compose up -d --build backend
```

Check logs:

```bash
docker compose logs -f backend
```

## 5) Authenticate Copilot CLI inside container

Use the `copilot` binary:

```bash
docker compose exec backend copilot auth login
```

Verify authentication status:

```bash
docker compose exec backend copilot auth status
```

The auth session is stored in:

- Container: `/home/devmentor/.copilot`
- Host: `${HOST_DEVMENTOR_CONTAINER_DIR}/.copilot`

## 6) Update Copilot CLI inside container

Check current version:

```bash
docker compose exec backend copilot --version
```

Run update check/install:

```bash
docker compose exec backend copilot update
```

If your network is strict and update checks fail with timeout, configure `HTTP_PROXY`/`HTTPS_PROXY` in `.env` and recreate the container:

```bash
docker compose up -d --build backend
```

## 7) Optional remote tunnel

### ngrok

```bash
docker compose --profile tunnel-ngrok up -d
```

### Cloudflare Quick Tunnel

```bash
docker compose --profile tunnel-cloudflare up -d
```

## 8) Useful commands

```bash
# Stop and remove containers/networks
docker compose down

# Restart backend
docker compose restart backend

# Open shell in backend container
docker compose exec backend sh
```

## 9) Troubleshooting

### `copilot: command not found`

Rebuild image to ensure Copilot CLI is present:

```bash
docker compose up -d --build backend
```

Then verify:

```bash
docker compose exec backend sh -lc 'command -v copilot && copilot --version'
```

### `Error: EACCES` on `.devmentorai` or `.copilot`

Ensure host directory ownership matches your user:

```bash
chown -R "$(id -u):$(id -g)" /home/botom/devmentor-container
```

Also confirm `HOST_UID` and `HOST_GID` in `.env`.

### `Failed to fetch latest release` / timeout during update check

- Usually a transient network timeout.
- Confirm connectivity to `api.github.com` from container.
- If you are behind proxy/corporate network, set `HTTP_PROXY`/`HTTPS_PROXY` and recreate backend container.
