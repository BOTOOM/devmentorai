# ADR-0004 — History is ACP-first, with our store demoted to a display cache

Status: accepted (Phase 0)

## Context

The original request was to drop our own history now that ACP can provide it. ACP does offer
`session/list` plus replay (`session/load` in v1, `session/resume` + `replayFrom` in v2) —
but both are capability-gated and per-agent. The spike measured Copilot CLI with
`loadSession: true` and the SDK example agent returning `-32601` for `session/list`,
`session/load` *and* `session/resume`. Each agent also keeps its own separate session store,
and the side panel must list sessions across agents, offline, before any agent is spawned.

## Decision

The agent is the source of truth for conversation content when it advertises replay. We keep
a **local index** (session ⇄ agent, `cwd`, title, activity, capabilities) as the source of
truth for *listing*, and keep `messages`/`session_contexts` as an explicit display cache:
used for instant paint, offline viewing, and as the only history for agents without replay.
Cache entries are keyed by `messageId`/`toolCallId` so replay reconciles instead of
duplicating. Nothing is deleted by the migration.

## Consequences

- Cross-agent session listing keeps working without launching every agent.
- Users with non-replay agents do not lose their history.
- Cost: reconciliation logic and a retention policy; the cache can drift and must be marked
  as cache in the UI (R-047).
- Rejected: deleting our history entirely (breaks non-replay agents and cross-agent listing);
  keeping our store authoritative (diverges from the agent's real context and re-creates
  today's coupling).
