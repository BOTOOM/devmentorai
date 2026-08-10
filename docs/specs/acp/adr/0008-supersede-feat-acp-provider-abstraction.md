# ADR-0008 — Supersede the `feat/acp` provider abstraction; keep three pieces of it

Status: accepted (Phase 0)

## Context

`origin/feat/acp` (37 commits, +5852/−923) is named for ACP but contains none: no ACP SDK, no
JSON-RPC framing, no protocol types. It adds an in-house multi-provider layer —
`llm-provider.service.ts`, `providers/copilot.provider.ts`,
`providers/cli-command.provider.ts` (spawns CLIs and scrapes stdout into synthetic
Copilot-shaped events), `providers/openai-compatible.provider.ts`, `credential.service.ts`,
`routes/providers.ts` — plus extension UI for provider-grouped models and availability
states. Its interface is still typed in Copilot SDK event shapes and each adapter
reconstructs its own history; `restoreSession()` is a stub.

## Decision

Do not merge or build on that abstraction. ACP *is* the provider abstraction, standardised
and maintained upstream, and stdout scraping is exactly the fragility ACP removes. Cherry-pick
three things:

1. `credential.service.ts` → `acp/credentials.ts` (ADR-0007).
2. `openai-compatible.provider.ts` → the guts of `apps/acp-openai-agent` (ADR-0006).
3. The extension UX patterns: provider-grouped selectors, agent badges, availability and
   recovery states → reused for the agent catalog and capability-driven controls.

The branch stays as a reference and is not merged; `master` is the base for the ACP work.

## Consequences

- Avoids maintaining two competing abstractions.
- Real work from the branch is preserved where it is still correct.
- The branch's per-provider event shapes, CLI scraping and per-adapter history are abandoned
  deliberately — this ADR is the record of why.
