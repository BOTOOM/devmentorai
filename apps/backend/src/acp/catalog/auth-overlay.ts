import type { AgentAuthOverlay } from './types.js';

/**
 * Versioned, data-only authentication metadata per agent id.
 *
 * This is deliberately not code: the generic path is always "connect, read
 * `authMethods`, and if `session/new` answers `auth_required` show them". The
 * overlay only lets the UI say *which* environment variable an agent reads and
 * where the token comes from, so a user can paste a token instead of installing
 * and logging into a CLI. Agents missing from this map still work through the
 * generic token/env field.
 */
export const AGENT_AUTH_OVERLAY_VERSION = 1;

export const AGENT_AUTH_OVERLAY: Readonly<Record<string, AgentAuthOverlay>> = {
  'github-copilot-cli': {
    envVars: ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'],
    localLogin: 'copilot login',
    tokenUrl: 'https://github.com/settings/personal-access-tokens/new',
    scopes: ['Copilot Requests'],
    notes:
      'A fine-grained PAT with the Copilot Requests permission works without running copilot login.',
  },
  'claude-acp': {
    envVars: ['ANTHROPIC_API_KEY'],
    localLogin: 'claude login',
    tokenUrl: 'https://console.anthropic.com/settings/keys',
  },
  'codex-acp': {
    envVars: ['OPENAI_API_KEY'],
    localLogin: 'codex login',
    tokenUrl: 'https://platform.openai.com/api-keys',
  },
  'gemini-cli': {
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    localLogin: 'gemini auth login',
    tokenUrl: 'https://aistudio.google.com/apikey',
  },
  'qwen-code': {
    envVars: ['OPENAI_API_KEY', 'DASHSCOPE_API_KEY'],
  },
  'devmentorai-openai-compatible': {
    envVars: ['OPENAI_COMPATIBLE_API_KEY'],
    notes:
      'Local endpoints (LM Studio, Ollama, vLLM) usually need no key; set OPENAI_COMPATIBLE_BASE_URL in the profile environment to point elsewhere.',
  },
};

export function authOverlayFor(agentId: string): AgentAuthOverlay | undefined {
  return AGENT_AUTH_OVERLAY[agentId];
}
