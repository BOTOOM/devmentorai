# ADR-0005 — Agents come from the ACP registry plus user-defined commands, not from code

Status: accepted (Phase 0)

## Context

The goal is to support **every ACP agent available in 2026** — Copilot, Claude, Gemini,
Codex, OpenCode, Cursor, Devin (local and cloud), Kilo, GLM, MiniMax, Amp, Cline, Junie,
goose, Kimi, Qwen, Droid, Grok, Mistral and whatever ships next — not a hand-picked list. The ACP project publishes a
machine-readable registry at
`https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` (38 agents today)
where every entry carries `id`, `name`, `description`, `icon`, `version` and a `distribution`
block: either `npx` (`package`, `args`, `env`) or per-platform `binary` (`archive`, `cmd`,
`args`, `sha256`). Registry inclusion requires the agent to advertise valid `authMethods`.

## Decision

The catalog is data: a small curated built-in set (pinned versions, ships offline) merged with
the **entire** cached registry and with user-defined agents. Launch specs are resolved per
platform and support `npx`, `uvx` and downloaded binaries (sha256-verified). Configuration is
expressed as **profiles** — a named launch tuple — so variants of one agent coexist:
`devin acp` vs `devin acp --cloud`, `copilot --acp --stdio` vs `--acp --port N`, one profile
per BYOK provider, or a non-registry agent such as MiniMax's `mini-agent-acp`. Support is
established by an automated conformance probe (R-017) whose output generates the published
support table, so coverage claims are measured rather than asserted.

Where a product has no ACP server, we do not wrap it. Antigravity (`agy`) is the current
example: ACP is an open upstream request and Google's terms forbid third-party software using
an Antigravity login, so it stays documented-as-unsupported (R-018) until `agy --acp` exists —
at which point it needs no code from us.

## Consequences

- Provider coverage grows without releases; new agents appear as registry data, and anything
  unlisted is one profile away.
- "Which agents are supported?" becomes a generated, measured table instead of a promise.
- We must handle catalog staleness, offline mode, platform gaps and untrusted custom commands
  (user-authored, clearly labelled).
- No per-agent adapters — which is precisely what makes the `feat/acp` provider abstraction
  unnecessary.
