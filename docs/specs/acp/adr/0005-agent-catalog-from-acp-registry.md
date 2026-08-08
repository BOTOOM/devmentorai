# ADR-0005 — Agents come from the ACP registry plus user-defined commands, not from code

Status: accepted (Phase 0)

## Context

The goal is to support roughly what Devin Desktop supports: Copilot, Claude, Gemini, Codex,
OpenCode, Cursor, Devin CLI, goose, Kimi, Qwen, Droid and more. The ACP project publishes a
machine-readable registry at
`https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` (38 agents today)
where every entry carries `id`, `name`, `description`, `icon`, `version` and a `distribution`
block: either `npx` (`package`, `args`, `env`) or per-platform `binary` (`archive`, `cmd`,
`args`, `sha256`). Registry inclusion requires the agent to advertise valid `authMethods`.

## Decision

The catalog is data: a small curated built-in set (pinned versions, ships offline) merged with
the cached registry and with user-defined custom agents (`cmd`/`args`/`env`). Launch specs are
resolved per platform; binary installs are sha256-verified. Adding an agent requires no
DevMentorAI code, and the UI derives every affordance from advertised capabilities.

## Consequences

- Provider coverage grows without releases; new agents appear as registry data.
- We must handle catalog staleness, offline mode, platform gaps and untrusted custom commands
  (user-authored, clearly labelled).
- No per-agent adapters — which is precisely what makes the `feat/acp` provider abstraction
  unnecessary.
