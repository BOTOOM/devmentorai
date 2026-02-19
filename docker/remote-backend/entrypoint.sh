#!/usr/bin/env bash
set -euo pipefail

PORT="${DEVMENTORAI_PORT:-3847}"

COPILOT_CMD=""
if command -v github-copilot >/dev/null 2>&1; then
  COPILOT_CMD="github-copilot"
elif command -v copilot >/dev/null 2>&1; then
  COPILOT_CMD="copilot"
fi

if [[ -n "${COPILOT_CMD}" ]]; then
  if "${COPILOT_CMD}" auth status >/dev/null 2>&1; then
    echo "[DevMentorAI Docker] Copilot CLI already authenticated."
  else
    echo "[DevMentorAI Docker] Copilot CLI is not authenticated yet."
    echo "[DevMentorAI Docker] Run: docker compose exec backend ${COPILOT_CMD} auth login"
  fi
else
  echo "[DevMentorAI Docker] Copilot CLI binary not found in container PATH."
fi

echo "[DevMentorAI Docker] Starting backend on port ${PORT}"
exec node /workspace/apps/backend/dist/server.js
