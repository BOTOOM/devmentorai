# 03 — Requirements and acceptance criteria

Format: each requirement has an ID, a statement, acceptance criteria (AC) in
Given/When/Then, and a verification method — `unit`, `integration` (backend against a
real ACP agent fixture), `contract` (shared types / schema), `e2e` (extension via
Playwright), or `manual` (recorded).

Test doubles: integration tests run against a **fixture agent** built with the ACP SDK's
agent side (`agent()`), which speaks the real protocol and can be scripted to emit any
update variant, request permissions, fail, hang, crash, or advertise arbitrary
capabilities. No hand-written mock of our own event shapes is acceptable.

Priority: **P0** = MVP (Phases 1–4), **P1** = multi-agent completeness (Phases 5–7),
**P2** = later.

---

## A. Protocol layer

**R-001 (P0)** The backend acts as an ACP Client using `@agentclientprotocol/sdk`, over
NDJSON on the agent's stdio.
- AC1 Given a launch spec, when a session is created, then `initialize` → `session/new` →
  `session/prompt` complete and updates stream back. `integration`
- AC2 `@agentclientprotocol/sdk` is imported only from `apps/backend/src/acp/**`. `unit` (lint rule / import test)

**R-002 (P0)** Protocol version is negotiated per connection: v1 is supported and used by
default; v2 is only used when the agent negotiates it and the `ACP_V2` flag is enabled.
- AC1 Given an agent answering `protocolVersion: 1`, then the v1 surface is used. `integration`
- AC2 Given an agent answering an unsupported version, then the connection fails with
  `protocol_version_unsupported` and no session is created. `integration`
- AC3 The negotiated version is recorded on the session and visible in diagnostics. `integration`

**R-003 (P0)** Both versions are normalised into the single `AcpEvent` union; no
version-specific shape escapes `acp/normalize/*`.
- AC1 For each documented v1 `sessionUpdate` variant, a golden-file test maps wire JSON →
  `AcpEvent`. `unit`
- AC2 Same for the v2 variants under the flag. `unit`
- AC3 An unknown `sessionUpdate` variant, unknown content type, unknown tool `kind`/`status`
  and an `_`-prefixed field are preserved as generic events, not dropped or thrown on. `unit`

**R-004 (P0)** In v1 the host synthesises turn state: `running` on prompt dispatch, `idle`
with the response's `stopReason` on completion.
- AC1 A completed turn yields exactly one `state: idle` with `stopReason: end_turn`. `integration`
- AC2 `stopReason` values `max_tokens`, `refusal`, `cancelled` propagate unchanged. `integration`

**R-005 (P0)** Capability-first: the host never calls a method or sends content the agent
did not advertise.
- AC1 Given `loadSession: false`, then no `session/load` is ever sent and the UI exposes no
  replay action. `integration`
- AC2 Given `promptCapabilities.image: false`, then no `image` block is sent (R-031). `integration`
- AC3 A `-32601` from an agent is reported as `capability_unsupported`, not a crash. `integration`

**R-006 (P0)** Cancellation: `session/cancel` is sent, updates arriving after it are still
accepted, unfinished tool calls are marked `cancelled`, and pending permission requests are
answered with the `cancelled` outcome.
- AC1 Given a turn cancelled mid-tool-call, then the turn ends with `stopReason: cancelled`
  and no unhandled promise/`ECONNRESET` appears in logs. `integration`
- AC2 Post-cancel `agent_message_chunk`s are appended without error. `integration`

**R-007 (P0)** One agent process per agent instance; the host multiplexes sessions over it
and owns its lifecycle (spawn, stderr ring buffer, exit detection, graceful shutdown).
- AC1 Two concurrent sessions on one agent interleave without cross-talk (updates land on
  the right session). `integration`
- AC2 Killing the agent process surfaces `agent_crashed` on every affected session within 1 s
  and does not take the backend down. `integration`
- AC3 Backend shutdown terminates all agent processes; no orphans remain. `integration`

**R-008 (P1)** TCP transport is supported for agents that offer it (e.g.
`copilot --acp --port N`).
- AC1 A session over TCP behaves identically to stdio for prompt/stream/cancel. `integration`

---

## B. Agent catalog, install, auth

**R-010 (P0)** An agent catalog exposes built-in curated agents, the **whole** ACP registry
(`registry.json`, cached with a TTL and an offline fallback), and user-defined custom
agents (`cmd` + `args` + `env`). No agent is hardcoded: a new registry entry becomes usable
without a DevMentorAI release.
- AC1 `ui/agents.list` returns id, name, description, icon, version, source, install state,
  auth state and platform availability. `integration`
- AC2 With the network unavailable, the cached/built-in catalog is still returned. `unit`
- AC3 A custom agent defined by the user can be launched and used end-to-end. `integration`
- AC4 Given a registry containing an agent unknown to our code, then it is listed and
  launchable with no code change. `integration`
- AC5 `npx`, `uvx` and `binary` distributions are all resolvable. `unit`
- AC6 `apps/acp-openai-agent` is registered as a built-in catalog entry and can be
  launched and used end-to-end with its endpoint/model configuration. `integration`

**R-016 (P0)** Agents are configured as **profiles**: a named `{ agentId | custom cmd, args,
env, cwd default, transport }` tuple, so the same agent can exist several times with
different configuration (e.g. `devin acp` vs `devin acp --cloud`, `copilot --acp --stdio` vs
`--acp --port N`, one profile per BYOK provider, `mini-agent-acp` from MiniMax).
- AC1 Two profiles of the same agent can run simultaneously with independent sessions and
  independent auth state. `integration`
- AC2 A profile is created, edited, duplicated and deleted from the UI, and the sessions it
  owns keep working after an edit (new sessions use the new config). `e2e`
- AC3 Profile `env` values that reference stored credentials are resolved at spawn time and
  never displayed. `unit`

**R-017 (P1)** A **conformance probe** can be run against any agent profile: it performs
`initialize`, `session/new`, a scripted prompt, a slash command, an image block, a permission
round-trip, a history probe and a cancel, then records the observed capabilities and results.
- AC1 Running the probe against a profile produces a machine-readable capability record
  (protocol version, `promptCapabilities`, `loadSession`, advertised commands, auth methods,
  failures) stored with the agent. `integration`
- AC2 The UI shows that record as the agent's support matrix, including "not verified". `e2e`
- AC3 A repo script regenerates the support table in `docs/ACP.md` from probe runs, so agent
  coverage is documented by measurement, not by hand. `manual`
- AC4 A probe failure never leaves a stray agent process running. `integration`

**R-018 (P2)** Agents with no ACP server are documented, not wrapped: where a vendor's terms
forbid third-party wrapping of their CLI (e.g. Antigravity `agy` today), DevMentorAI ships no
bridge and instead links the upstream tracking issue.
- AC1 `docs/ACP.md` lists the known non-ACP products, why, and what would unblock them. `manual`

**R-011 (P1)** Binary distributions can be installed on demand into
`~/.devmentorai/agents/<id>/<version>/`, verified against the registry `sha256`.
- AC1 Given a checksum mismatch, then installation fails, nothing is executed, and the
  error is `agent_launch_failed` with the mismatch detail. `unit`
- AC2 Install progress is streamed to the UI. `e2e`

**R-012 (P0)** Launch specs are resolved per platform (`linux-x86_64`, `darwin-aarch64`,
`windows-x86_64`, …); unsupported platforms are reported, never spawned blindly.
- AC1 On a platform absent from the entry, `ui/agents.list` marks it unavailable with a reason. `unit`

**R-013 (P0)** Authentication states are first-class: `authMethods` from `initialize` are
exposed; an auth error becomes `auth_required` with the agent's own instructions.
- AC1 Given Copilot CLI without credentials, then the session attempt yields `auth_required`
  and the UI shows "Run `copilot login`" (the agent's `authMethods[].description`). `integration`
- AC2 Given an agent with a protocol login method, then `authenticate`/`auth/login` is
  invoked from the UI and, on success, the session proceeds without restarting the process. `integration`
- AC3 After authenticating, the agent's auth state is reflected in the catalog. `e2e`

**R-014 (P1)** Secrets needed as env vars are stored encrypted at `~/.devmentorai/credentials`
(`0600`) and injected only into the target agent's process env.
- AC1 No API response, log line or error message ever contains a stored secret value. `unit`
- AC2 The file is unreadable by other users and unusable without the local key. `unit`

**R-015 (P0)** Every session declares an absolute workspace `cwd`, defaulting to a
configurable workspace root; the UI always shows it.
- AC1 `session/new` is rejected client-side if `cwd` is missing, relative, or outside the
  configured root. `unit`
- AC2 The session header displays the effective `cwd`. `e2e`

---

## C. Chat and streaming

**R-020 (P0)** The extension talks to the backend over a WebSocket JSON-RPC channel that
supports backend→UI *requests*.
- AC1 A prompt streams assistant text incrementally into the panel. `e2e`
- AC2 Closing and reopening the panel mid-turn restores the in-flight turn from the buffer
  without duplicated or lost text. `e2e`
- AC3 With the backend down, the UI shows a disconnected state and retries with backoff. `e2e`

**R-021 (P0)** Session configuration is driven exclusively by ACP config options (model,
mode, reasoning/thought level); DevMentorAI ships no hardcoded model list.
- AC1 Given `config_option_update`, then the UI renders exactly those options with current
  values. `e2e`
- AC2 Selecting one calls `session/set_config_option` and the UI adopts the returned
  complete state. `integration`
- AC3 Given an agent that advertises no model option (e.g. Copilot ACP, where reasoning and
  tool filtering are fixed at server start), then no model selector is shown and the
  limitation is explained in the UI. `e2e`

**R-022 (P0)** Streaming turn timeouts are configurable and no longer Copilot-specific;
an idle stall produces a recoverable error, not a hung UI.
- AC1 Given a fixture agent that stalls past the idle timeout, then the turn ends with a
  timeout error and the session stays usable. `integration`

**R-023 (P0)** Usage and session info are surfaced: token/context usage and
agent-generated titles.
- AC1 `usage_update` updates a context indicator. `e2e`
- AC2 `session_info_update` renames the session unless the user set a local title. `integration`

---

## D. Slash commands

**R-025 (P0)** Commands advertised via `available_commands_update` are stored per session as
a complete replacement of any previous list.
- AC1 Two consecutive notifications leave exactly the second list. `unit`

**R-026 (P0)** Typing `/` in the composer opens a palette of the advertised commands with
name, description and `input.hint`, filterable, keyboard-navigable.
- AC1 Given a session advertising `/plan` and `/usage`, then both appear with their
  descriptions and are insertable via keyboard. `e2e`
- AC2 Given a session advertising none, then no palette appears. `e2e`
- AC3 The palette updates live when a new `available_commands_update` arrives. `e2e`

**R-027 (P0)** A command is sent as an ordinary prompt whose text is `"/name args"` in a
single text block, and its output renders like any other turn.
- AC1 `/usage` produces the agent's output without a model turn. `integration`
- AC2 A command may be combined with images/context blocks in the same prompt when the
  agent supports them. `integration`

**R-028 (P1)** Unadvertised commands are handled honestly: the UI warns that the text will
be sent to the model as plain text.
- AC1 Typing an unknown `/foo` shows the warning before sending. `e2e`

---

## E. Content: images, context, files

**R-030 (P0)** Images are sent as `image` blocks (base64 + `mimeType`) through the existing
resize/compress pipeline.
- AC1 A pasted screenshot reaches the agent as one `image` block and the agent's reply
  references it. `integration` + `manual` (real agent)
- AC2 Oversized images are downscaled before encoding and the request stays under the body
  limit. `unit`

**R-031 (P0)** When `promptCapabilities.image` is false, the image control is disabled with
an explanation and no `image` block is ever sent.
- AC1 Fixture agent without image support: attaching is blocked and the outgoing prompt
  contains no image block. `integration` + `e2e`

**R-032 (P0)** Browser context (page text, selection, metadata) is sent as embedded
`resource` blocks with a stable `uri`, `mimeType` and `text`.
- AC1 Context-aware mode produces `resource` blocks, not a giant concatenated string. `integration`
- AC2 Without `embeddedContext`, the same content is inlined into the text block as fenced
  sections and the UI says so. `integration`

**R-033 (P1)** Workspace file references are sent as `resource_link`s.
- AC1 A referenced file appears as a `resource_link` with an absolute `file://` URI. `integration`

---

## F. Tool calls, terminals, plans, permissions

**R-035 (P0)** Tool calls render as upsert-keyed cards showing `kind`, `status`, title,
content and affected `locations`, with raw input/output available on demand.
- AC1 The `pending → in_progress → completed` sequence updates one card, never three. `e2e`
- AC2 An unknown `kind`/`status` renders generically. `unit`
- AC3 `failed` shows the failure content. `e2e`

**R-036 (P0)** Diff content in tool calls renders as a readable before/after diff with the
file path.
- AC1 An edit tool call with `diff` content renders added/removed lines. `e2e`

**R-037 (P1)** Terminal output renders as a live-appending block with exit status (v2
`terminal_update` / `terminal_output_chunk`; v1 embedded terminal tool content).
- AC1 Appended chunks stream in order and the exit code is shown on completion. `integration`

**R-038 (P0)** Agent plans render as a checklist with per-entry status/priority, updated in
place.
- AC1 Successive plan updates mutate the same list. `e2e`

**R-039 (P0)** `session/request_permission` blocks the turn and prompts the user with the
agent's title, subject and options; the chosen `optionId` is returned; the pending request
is answered `cancelled` if the user cancels the turn or the session closes.
- AC1 The prompt shows the requested tool/subject and all offered options. `e2e`
- AC2 Rejecting returns the reject option and the tool card shows `rejected`; the session
  survives. `integration`
- AC3 `allow_always` for a given agent+tool is remembered and later identical requests are
  auto-answered, with that state visible and revocable in settings. `integration`
- AC4 Auto-approve-everything is **off by default** and only enabled explicitly per agent. `unit`
- AC5 No permission request is ever silently auto-approved. `integration`

**R-040 (P1)** Elicitation (`elicitation/create`, v2 draft) renders a structured form when
the flag is on; otherwise the capability is not advertised.
- AC1 With the flag off, no elicitation capability is advertised. `unit`

---

## G. History and sessions

**R-045 (P0)** Session list shows sessions across all agents with agent identity, `cwd`,
title and last activity, sourced from the local index.
- AC1 Sessions created on two different agents both appear, correctly attributed. `integration`

**R-046 (P1)** For agents that support replay (`loadSession` / `session/resume`), opening an
existing session replays the agent's history and the local cache is reconciled by
`messageId`/`toolCallId` instead of duplicated.
- AC1 A replayed session shows each message exactly once. `integration`
- AC2 Local-only cached content that the agent no longer has is retained and marked. `integration`

**R-047 (P1)** For agents without replay, the local cache is displayed read-only and the UI
states that the agent cannot restore this conversation.
- AC1 Fixture agent with `loadSession: false`: history renders from cache with the notice,
  and no replay call is made. `integration` + `e2e`

**R-048 (P1)** `session/list` from an agent is reconciled with the local index: sessions
missing locally are adopted, locally-known sessions the agent dropped are marked stale.
- AC1 Both directions are handled without duplicates. `integration`

**R-049 (P0)** Existing pre-migration sessions/messages remain readable after the upgrade.
- AC1 Given a DB written by the current release, when the new backend starts, then
  migrations run and old sessions render read-only with an "imported (Copilot SDK)" marker. `integration`
- AC2 No destructive migration: `messages` rows are never deleted by the upgrade. `unit`

---

## H. Feature parity (must not regress)

**R-050 (P0)** Quick actions (explain/summarise/translate/…) run over ACP.
- AC1 Each quick action produces a streamed answer in the panel. `e2e`

**R-051 (P0)** The writing assistant runs over ACP with inline replacement intact.
- AC1 Selecting text and applying a rewrite replaces it in the page. `e2e`

**R-052 (P0)** Context-aware mode parity per R-032.
- AC1 A page-specific question is answered using page content. `e2e`

**R-053 (P1)** Native messaging host keeps working (or its removal is decided in an ADR).
- AC1 The host round-trips a prompt through the ACP path. `integration`

---

## I. Non-functional

**R-060 (P0)** `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass on every PR;
no `any`/`as unknown as` in the ACP layer.
- AC1 CI green; a lint rule forbids `any` under `src/acp/**`. `unit`

**R-061 (P0)** First streamed token arrives within 500 ms of the agent's first update
(host overhead only), and a 10-minute turn with 5k updates does not leak memory.
- AC1 Benchmark test on the fixture agent. `integration`

**R-062 (P0)** Diagnostics: a per-agent log with the last N stderr lines, the negotiated
version, capabilities and the last error, downloadable from the UI.
- AC1 After a crash, the diagnostics view contains the failing stderr tail. `e2e`

**R-063 (P1)** Optional protocol tracing (`ACP_TRACE=1`) writes redacted JSON-RPC traffic to
a file for bug reports.
- AC1 With tracing on, a session produces a trace file containing no credential values. `unit`

**R-064 (P0)** Docs are updated with the migration: `docs/ARCHITECTURE.md`, a new
`docs/ACP.md` (supported agents, install, auth, troubleshooting), and README screenshots of
the new UI surfaces.
- AC1 Docs reference no Copilot-SDK-only concepts once Phase 8 lands. `manual`

**R-065 (P0)** The Copilot SDK dependency is fully removed at the end of the migration.
- AC1 `@github/copilot*` appears in no `package.json` and no import. `unit`
