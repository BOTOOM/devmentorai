#!/usr/bin/env bash
set -euo pipefail

PORT="${DEVMENTORAI_PORT:-3847}"

for name in COPILOT_GITHUB_TOKEN GH_TOKEN GITHUB_TOKEN COPILOT_TOKEN; do
  if [[ -v "$name" && -z "${!name:-}" ]]; then
    unset "$name"
  fi
done

token_name=""
for name in COPILOT_GITHUB_TOKEN GH_TOKEN GITHUB_TOKEN COPILOT_TOKEN; do
  if [[ -n "${!name:-}" ]]; then
    token_name="$name"
    break
  fi
done

if [[ -n "$token_name" ]]; then
  export GITHUB_TOKEN="${!token_name}"
  unset COPILOT_GITHUB_TOKEN GH_TOKEN COPILOT_TOKEN
  echo "[DevMentorAI Docker] Using GitHub token from ${token_name}"
  if [[ "$GITHUB_TOKEN" == ghp_* ]]; then
    echo "[DevMentorAI Docker] Warning: classic ghp_ PATs are not supported. Use a fine-grained PAT with the Copilot Requests permission."
  fi
else
  echo "[DevMentorAI Docker] No GitHub token found."
  echo "[DevMentorAI Docker] Log in with a device code: docker compose exec backend copilot login"
  echo "[DevMentorAI Docker] Then restart the backend: docker compose restart backend"
  echo "[DevMentorAI Docker] The login persists in the devmentorai-copilot volume."
fi

if [[ ! -w "$HOME/.copilot" || ! -w "$HOME/.devmentorai" ]]; then
  echo "[DevMentorAI Docker] Warning: a data directory is not writable. Check HOST_UID/HOST_GID and volume ownership."
fi

echo "[DevMentorAI Docker] Starting backend on port ${PORT}"
exec node /workspace/apps/backend/dist/server.js
