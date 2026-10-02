# Docker Backend Setup (Windows, macOS, Linux)

Use Docker as a fallback when the normal npm/npx installation fails. The container serves the backend on port 3847 and supports either a GitHub token or Copilot CLI device-code login.

## Prerequisites

- Windows: Docker Desktop using Linux containers and its WSL 2 backend.
- macOS: Docker Desktop with Linux containers.
- Linux: Docker Engine and Docker Compose v2.
- Git and a GitHub account with Copilot access.

Clone the repository and create your local environment file:

```powershell
git clone https://github.com/BOTOOM/devmentorai.git
Set-Location devmentorai
Copy-Item .env.example .env
```

```bash
git clone https://github.com/BOTOOM/devmentorai.git
cd devmentorai
cp .env.example .env
```

The `.env` file is ignored by Git; never commit it. Keep the default `BACKEND_BIND_ADDRESS=127.0.0.1` unless you intentionally need remote access.

## Choose an authentication method

### A. Fine-grained GitHub token

Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with the **Copilot Requests** permission, then put it in `.env`:

```env
COPILOT_GITHUB_TOKEN=github_pat_your_token
```

Classic `ghp_` personal access tokens are not supported. The entrypoint logs which environment variable is in use but never prints its value.

### B. Copilot CLI device-code login

Leave `COPILOT_GITHUB_TOKEN` blank. After starting the container below, run:

```sh
docker compose exec backend copilot login
```

Open the printed URL, https://github.com/login/device, enter the device code, and complete login. Then restart the backend:

```sh
docker compose restart backend
```

The login is persisted in the `devmentorai-copilot` volume.

## Start and verify

Stop any locally running backend first so it releases port 3847:

```sh
devmentorai-server stop
```

Build and start the container:

```sh
docker compose up -d --build backend
docker compose logs backend
```

Use `docker compose logs -f backend` to follow the logs; press Ctrl+C to stop following.

Verify the health and Copilot auth endpoints.

PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3847/api/health' | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri 'http://127.0.0.1:3847/api/account/auth' | ConvertTo-Json -Depth 5
```

macOS/Linux:

```bash
curl -fsS http://127.0.0.1:3847/api/health
curl -fsS http://127.0.0.1:3847/api/account/auth
```

For the extension, select **HTTP** mode and use `http://localhost:3847`. Native Messaging is for a locally installed backend and does not apply to Docker.

## Remote access

To bind beyond localhost, set `BACKEND_BIND_ADDRESS=0.0.0.0` in `.env`, then recreate the service:

```sh
docker compose up -d backend
```

This exposes an unauthenticated API that can spend your Copilot quota. Only do this on a trusted network with appropriate firewall rules. Alternatively, use a tunnel profile:

```sh
docker compose --profile tunnel-ngrok up -d
docker compose --profile tunnel-cloudflare up -d
```

## Migrate the previous bind-mount layout

To keep data from `/home/botom/devmentor-container`, set these values in `.env`:

```env
DEVMENTORAI_COPILOT_VOLUME=/home/botom/devmentor-container/.copilot
DEVMENTORAI_DATA_VOLUME=/home/botom/devmentor-container/.devmentorai
HOST_UID=1000
HOST_GID=1000
```

Set `HOST_UID` and `HOST_GID` to the owner of those directories. On Linux, check with `id -u` and `id -g`. On Docker Desktop, use host paths accessible to Docker Desktop; the old `/home/botom/...` path is only valid if it is accessible from the Docker environment.

## Update or reset login

Pull the latest changes and rebuild:

```sh
git pull
docker compose up -d --build backend
```

To reset Copilot login, stop the service and remove only its auth volume:

```sh
docker compose down
docker volume rm devmentorai-copilot
docker compose up -d backend
```

## Troubleshooting

- **`EACCES` for `.copilot` or `.devmentorai`:** Use the default named volumes, or set `HOST_UID`/`HOST_GID` to match the bind-mounted directories' owner.
- **Port 3847 is in use:** Stop the local `devmentorai-server`, or set another `BACKEND_PORT` in `.env`.
- **Invalid token:** Use a fine-grained PAT with **Copilot Requests** permission. Classic `ghp_` PATs are unsupported; an organization may also block Copilot access through its policy.
- **`copilot: command not found`:** Rebuild the image and check the installed CLI version:

  ```sh
  docker compose up -d --build backend
  docker compose exec backend copilot --version
  ```
