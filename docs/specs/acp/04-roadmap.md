# 04 — Implementation roadmap

Nine phases, each one or two reviewable PRs, each independently mergeable and leaving
`master` working. The Copilot SDK stays functional until Phase 8, behind a feature flag, so
the extension is never broken mid-migration.

Flags: `ACP_ENABLED` (route chat through the ACP host), `ACP_V2` (allow v2 negotiation).
Default: `ACP_ENABLED=false` until Phase 4 exits, then true.

---

### Phase 0 — Spec + spike ✅ (this PR)

Deliverable: `docs/specs/acp/**` and a validated protocol spike (SDK example agent +
`copilot --acp --stdio` handshake, see 01-research §2.1).
Exit: the user approves scope, ADRs and requirement priorities.

### Phase 1 — Protocol layer (backend only, no UI)

Scope: `acp/launcher.ts`, `acp/connection.ts`, `acp/normalize/v1.ts`, `acp/errors.ts`,
`AcpEvent` in `packages/shared`, and the **fixture agent** test harness (an SDK-based
agent that can emit every update variant, request permissions, stall, and crash).
Requirements: R-001..R-007, R-012, R-060.
Exit: integration tests drive a full turn (text, tool call, permission, cancel, crash)
against the fixture agent and the golden-file normalisation tests pass. No UI change.

### Phase 2 — Agent catalog, workspace, launch, auth surface

Scope: `catalog/*`, `workspace.ts`, `credentials.ts` (ported from `feat/acp`),
`agents` table, `ui/agents.*` methods, `auth_required` plumbing with the agent's own
instructions.
Requirements: R-010, R-012..R-015, R-013 (Copilot login path), R-062.
Exit: `copilot --acp --stdio` and one npx agent (Gemini or Claude adapter) can be launched
and authenticated from the backend; an unauthenticated agent produces the actionable
`auth_required` error.

### Phase 3 — WS gateway + extension chat over ACP (Copilot first)

Scope: `/acp` WebSocket JSON-RPC gateway, turn buffer + reconnect replay, extension
`AcpClient` replacing `api-client`'s SSE path, `useChat` rewritten onto the reduced
`AcpEvent` view model, plain text streaming, cancel.
Requirements: R-020, R-022, R-023, R-045, R-049 (read-only legacy sessions).
Exit: with `ACP_ENABLED=true`, a Copilot ACP session streams into the side panel; with the
flag off, the old SDK path is untouched. Old sessions still render.

### Phase 4 — The ACP-native UI (MVP completion)

Scope: slash-command palette, config-option selectors (model/mode/reasoning), tool-call
cards with kinds/status/diffs, plan checklist, permission prompt with remembered
`allow_always`, generic renderer for unknown content, usage/context indicator, error cards
with actions.
Requirements: R-021, R-025..R-027, R-035, R-036, R-038, R-039, R-030..R-032.
Exit: Copilot ACP is fully usable — commands, images, page context, tools, permissions.
`ACP_ENABLED` defaults to true. **This is the MVP.**

### Phase 5 — Multi-agent rollout

Scope: registry-driven catalog UI (search/install/uninstall), binary installer with sha256,
per-agent capability matrix surfaced in the UI, capability-driven control disabling, TCP
transport, agent switching per session.
Requirements: R-008, R-011, R-028, R-033, R-037, plus measuring Q2 (replay support) per agent.
Exit: verified end-to-end on at least Copilot, Gemini CLI, Claude adapter, OpenCode and
Devin CLI, with a results table committed to `docs/ACP.md`.

### Phase 6 — History: ACP-first with local cache

Scope: replay via `session/load` / `session/resume`, reconciliation by
`messageId`/`toolCallId`, `session/list` sync, stale-session marking, cache demoted to a
display cache, retention policy.
Requirements: R-046..R-048.
Exit: a replay-capable agent restores history from the agent; a non-replay agent falls back
to the cache with a visible notice; no duplicate messages in either case.

### Phase 7 — Local models as a real ACP agent

Scope: `apps/acp-openai-agent` — our own ACP *agent* (SDK agent side) fronting any
OpenAI-compatible endpoint (LM Studio, Ollama, vLLM, OpenRouter), reusing the
`openai-compatible.provider.ts` logic from `feat/acp`: streaming, tool calling, and
capability advertisement. Registered as a built-in catalog entry with an endpoint/model
config.
Requirements: R-010 AC3 (as a built-in), plus the A/C/F sets applied to this agent.
Exit: an LM Studio model runs through the identical ACP path — the host contains zero
special-casing for it.

### Phase 8 — Remove the Copilot SDK, clean up, document

Scope: delete `copilot.service.ts`, the SSE chat translation, mock mode, the model catalog
and Copilot auth/quota routes; drop `@github/copilot*`; drop superseded session columns;
rewrite `docs/ARCHITECTURE.md`, add `docs/ACP.md`, refresh README.
Requirements: R-064, R-065.
Exit: no Copilot-specific code remains; all P0 requirements verified; CI green.

### Phase 9 — v2 readiness (opt-in)

Scope: `normalize/v2.ts`, `state_update`-driven lifecycle, `session/resume` with
`replayFrom`, `plan_update`, `terminal_update`, elicitation, behind `ACP_V2`.
Requirements: R-002 AC2, R-003 AC2, R-040.
Exit: a v2-capable agent works with the flag on and v1 agents are unaffected with it off.

---

## Cross-cutting rules

- Every PR states its requirement IDs and runs `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- No phase merges with a red CI or an unverified P0 acceptance criterion.
- Migrations are additive; no user data is deleted before Phase 8, and even then only
  superseded columns (never `messages` rows).
- The fixture agent from Phase 1 is the primary test tool; real agents are used for
  verification, not for unit-level determinism.

## Risks

| Risk | Mitigation |
| --- | --- |
| ACP v2 stabilises mid-migration and shifts the target | All version-specific code lives in `normalize/*`; v2 stays flagged (ADR-0001) |
| Copilot ACP is public preview and may change | Pin the CLI version in the catalog; capability-driven UI degrades instead of breaking |
| Copilot ACP fixes reasoning/tool-filtering at server start | Expose them as agent-level (not session-level) settings; document the regression (R-021 AC3) |
| Agents must now be installed + authenticated locally | Registry-driven install + explicit auth UX (Phase 2/5); actionable errors instead of silent failures |
| Real permission prompts change the feel of the product | Remembered `allow_always` choices and an opt-in per-agent auto-approve |
| A browser extension has no project directory | Explicit configurable workspace root, shown in the UI (R-015) |
| Scope is large | Phases 1–4 deliver a complete single-agent product; 5–9 are additive |
