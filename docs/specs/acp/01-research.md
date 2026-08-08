# 01 — Research: ACP protocol and agent ecosystem

Status: complete for the decisions in [adr/](./adr/). Sources are linked inline; a full
local mirror of the ACP docs (v1 + v2 markdown) was used while writing this.

## 1. What ACP is

- JSON-RPC 2.0, UTF-8, **newline-delimited JSON** messages.
- Transports: **stdio** (the Client launches the Agent as a subprocess — the recommended
  and universally supported one) and TCP/HTTP variants offered by individual agents.
  Streamable HTTP is still a draft proposal in the spec.
  <https://agentclientprotocol.com/protocol/v1/transports>
- Content model is MCP's `ContentBlock`, so `text`, `image`, `audio`, `resource`
  (embedded) and `resource_link` blocks flow unchanged between MCP tools and ACP.
- Markdown is the default rendering format for user-facing text.

### 1.1 Method surface (what we will implement as a Client)

Agent methods we call: `initialize`, `authenticate` (v1) / `auth/login` + `auth/logout` (v2),
`session/new`, `session/load` (v1) / `session/resume` (v2), `session/list`, `session/close`,
`session/prompt`, `session/set_config_option`, `session/delete`, and the
`session/cancel` notification.

Client methods we must implement (agent → us): `session/update` (notification),
`session/request_permission`, plus optional `fs/read_text_file`, `fs/write_text_file`,
`terminal/*` in v1 and `elicitation/create` in v2.

`session/update` variants carry everything the UI renders:

| Variant | Renders as |
| --- | --- |
| `user_message` / `user_message_chunk` | the echoed user turn (source of truth for `messageId`) |
| `agent_message` / `agent_message_chunk` | streamed assistant text |
| `agent_thought` / `agent_thought_chunk` | collapsible reasoning |
| `tool_call` (v1) / `tool_call_update` (upsert) | tool cards: `kind` (read/edit/delete/move/search/execute/think/fetch/other), `status` (pending/in_progress/completed/failed/cancelled), `content`, `locations`, `rawInput`/`rawOutput` |
| `tool_call_content_chunk` (v2) | appended tool output |
| `terminal_update` / `terminal_output_chunk` (v2) | display-only terminal with base64 byte chunks and exit status |
| `plan` (v1) / `plan_update` (v2) | agent plan / todo list with per-entry status + priority |
| `available_commands_update` | **slash commands**: `name`, `description`, optional `input.hint` |
| `config_option_update` | model / mode / reasoning selectors (complete state each time) |
| `session_info_update` | session title + metadata (auto-generated titles) |
| `usage_update` | context tokens used/size and cumulative cost |

### 1.2 Prompt lifecycle

- v1: `session/prompt` **blocks for the whole turn** and its response carries `stopReason`
  (`end_turn`, `max_tokens`, `max_turn_requests`, `refusal`, `cancelled`).
- v2: `session/prompt` returns `{}` as soon as the prompt is *accepted*; the turn is
  reported by `state_update` notifications (`running` / `idle` / `requires_action`) and the
  stop reason arrives on the idle `state_update`.
- Cancellation is the `session/cancel` notification in both versions. The Client should
  pre-mark unfinished tool calls as `cancelled` and must answer pending permission
  requests with the `cancelled` outcome.

### 1.3 Slash commands (a first-class protocol feature)

Agents advertise commands with the `available_commands_update` notification (push only,
there is no request to fetch them), re-sent as a **complete replacement** whenever the
set changes. Commands are invoked by sending the literal text `"/name args"` as a normal
text content block in `session/prompt` — no special method. Copilot CLI documents exactly
this behaviour and lists `/compact`, `/context`, `/usage`, `/env`, `/model`, `/mcp`,
`/plan`, `/review`, `/research`, `/session`, `/rename`, plus one command per enabled skill;
commands that need an interactive TUI (`/diff`, `/login`, `/theme`, …) are *not* advertised
and would be forwarded to the model as plain text.
<https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server#using-slash-commands>

### 1.4 Images and other content

- Prompt content beyond `text` and `resource_link` is capability-gated by the agent's
  `promptCapabilities`: `image`, `audio`, `embeddedContext`.
- Images are `{ type: "image", mimeType, data: <base64>, uri? }` — base64 in the JSON-RPC
  message, so message size (and our 50 MB body limit / image pipeline) matters.
- Page context, file context and @-mentions should be sent as embedded
  `resource` blocks (`{ uri, mimeType, text }`), which is what the spec recommends for
  context the agent cannot read itself — this is the natural home for DevMentorAI's
  browser-context payloads.
- A Client **MUST NOT** send a content type the agent did not advertise, so every content
  path needs a documented fallback (see R-030..R-033).

### 1.5 History

- `session/list` returns `SessionInfo[]` (`sessionId`, `cwd`, `title`, `updatedAt`, `_meta`)
  with opaque cursor pagination — but only for agents that keep sessions.
- Replay: v1 `session/load` (gated by the `loadSession` capability) or v2
  `session/resume` with `replayFrom: { type: "start" }`; the agent replays the whole
  conversation as `session/update` notifications before answering the request.
- Consequence: history *can* come from the agent, but support is per-agent and optional,
  and each agent has its own session store. A local index/cache is still needed for
  cross-agent listing and for offline rendering (see ADR-0004).

### 1.6 Configuration, modes, models

v2 removed the dedicated modes API; modes, **model selection**, and reasoning/thinking
level are all `ConfigOption`s (`select` or `boolean`, with `category` hints `mode`,
`model`, `model_config`, `thought_level`). The Client sets them with
`session/set_config_option` and always receives the *complete* option state back. This
replaces DevMentorAI's bespoke model catalog and reasoning-effort plumbing.

### 1.7 Authentication

`initialize` returns `authMethods`; a non-empty list means the agent implements
`authenticate` (v1) / `auth/login` + `auth/logout` (v2). Agents may also reject work with
an `auth_required` error at any time. The ACP registry only lists agents that return valid
`authMethods`. Some agents additionally accept credentials via environment variables
(e.g. Copilot CLI BYOK via `COPILOT_PROVIDER_*`, Devin CLI via `WINDSURF_API_KEY` or
`devin auth login`).

## 2. Protocol version reality check (drives ADR-0001)

- The published **stable** schema is **v1**. v2 is labelled *draft*: the docs say to gate
  it behind version negotiation and feature flags until it stabilises, and to keep serving
  v1 peers.
- The official TypeScript SDK `@agentclientprotocol/sdk@1.3.0` exports
  `PROTOCOL_VERSION = 1` from its main entrypoint; v2 lives behind
  `@agentclientprotocol/sdk/experimental/v2` and its own docs warn the wire format may
  change incompatibly in any release.
- Therefore: implement **v1 first**, negotiate per connection, and keep the v2 surface
  behind a flag with a normalisation layer that both versions map onto.

### 2.1 Spike evidence (measured, not assumed)

A throwaway ACP Client (SDK `client()` + `ndJsonStream` over a spawned subprocess) was run
against two agents:

**SDK example agent** (`dist/examples/agent.js`, no credentials): negotiated
`protocolVersion: 1`, `agentCapabilities: { loadSession: false }`. Observed update order:
`agent_message_chunk` → `tool_call` → `tool_call_update`. `session/request_permission`
arrived twice and was answered `{ outcome: { outcome: "selected", optionId: "allow" } }`.
`session/list`, `session/load` and `session/resume` all returned JSON-RPC `-32601`
(*Method not found*) — i.e. **unsupported methods are ordinary JSON-RPC errors**, so the
host must key behaviour off advertised capabilities rather than trying and catching.
`session/cancel` mid-turn produced `{ "stopReason": "cancelled" }` on the *prompt response*
(v1 semantics) and further `agent_message_chunk` notifications arrived **after** the cancel
was sent — the client must keep accepting updates post-cancel.

**Copilot CLI** (`copilot --acp --stdio`, binary resolved from the existing pnpm install):
negotiated `protocolVersion: 1` with `loadSession: true`,
`promptCapabilities: { image: true, audio: false, embeddedContext: true }`, MCP HTTP/SSE
support, a session-list capability, and one auth method
`{ id: "copilot-login", description: "Run \`copilot login\` in the terminal" }`.
Without credentials, `session/new` failed with
`{ "code": -32000, "message": "Authentication required" }`, so nothing past the handshake
could be exercised. This answers **Q1** (Copilot = v1 today, images and embedded context
supported, history replay available) and confirms the auth flow is out-of-band: the user
runs `copilot login` once, and our UI must surface that as an actionable error.

## 3. Agent matrix

Machine-readable catalog: `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
(38 agents at time of writing, schema documented in the registry repo). Each entry has
`id`, `name`, `version`, `description`, `repository`, `icon`, and a `distribution` block —
either `npx` (`package`, `args`, `env`) or `binary` (per-platform `archive`, `cmd`, `args`,
`sha256`). This is exactly the metadata our agent catalog needs, including checksums.

### 3.1 Coverage model

The goal is **every ACP agent on the market**, not a curated list, so coverage is defined by
tiers rather than by agent names:

| Tier | What it covers | Mechanism | Per-agent code |
| --- | --- | --- | --- |
| **T1 — registry** | Every agent in the ACP registry (38 today, growing without our releases) | catalog entry resolved from `registry.json` | none |
| **T2 — custom / variant** | ACP agents outside the registry, private/enterprise builds, and *variants* of a T1 agent (different flags, env, model, cloud relay) | user-defined `cmd`/`args`/`env` **agent profile** (R-016) | none |
| **T3 — non-ACP endpoints** | LM Studio, Ollama, vLLM, OpenRouter, any OpenAI-compatible API | our own ACP agent, `apps/acp-openai-agent` (ADR-0006) | one agent, not one adapter per vendor |
| **T4 — no ACP path** | Products with no ACP server and no licence to wrap one (see Antigravity below) | documented as unsupported, tracked upstream | none |

Because T1+T2 need no code, "supported agents" is a *data and verification* problem, which is
why the plan adds a conformance probe (R-017) instead of hand-written integrations.

### 3.2 T1 — the full registry (snapshot, 38 agents)

| Agent | id | Dist | Launch |
| --- | --- | --- | --- |
| Agoragentic | `agoragentic-acp` | npx | `npx agoragentic-mcp --acp` |
| Amp | `amp-acp` | binary | `amp-acp` |
| Auggie CLI | `auggie` | npx | `npx @augmentcode/auggie --acp` |
| Autohand Code | `autohand` | npx | `npx @autohandai/autohand-acp` |
| Claude Agent | `claude-acp` | npx | `npx @agentclientprotocol/claude-agent-acp` |
| Cline | `cline` | npx | `npx cline --acp` |
| Codebuddy Code | `codebuddy-code` | npx | `npx @tencent-ai/codebuddy-code --acp` |
| Codex | `codex-acp` | npx | `npx @agentclientprotocol/codex-acp` |
| Cortex Code | `cortex-code` | binary | `cortex acp` |
| Corust Agent | `corust-agent` | binary | — |
| crow-cli | `crow-cli` | binary | — |
| **Cursor** | `cursor` | binary | `cursor-agent acp` |
| DeepAgents | `deepagents` | npx | `npx deepagents-acp` |
| **Devin** | `devin` | binary | `devin acp` (+ `--cloud`, `--model`, `--agent-type`) |
| DimCode | `dimcode` | npx | `npx dimcode acp` |
| Dirac | `dirac` | npx | `npx dirac-cli --acp` |
| Factory Droid | `factory-droid` | npx | `npx droid exec --output-format acp-daemon` |
| fast-agent | `fast-agent` | uvx | `uvx fast-agent-acp -x` |
| Gemini CLI | `gemini` | npx | `npx @google/gemini-cli --acp` |
| **GitHub Copilot** | `github-copilot-cli` | npx | `npx @github/copilot --acp [--stdio\|--port N]` |
| **GLM Agent** | `glm-acp-agent` | npx | `npx glm-acp-agent` |
| goose | `goose` | binary | `goose acp` |
| Grok Build | `grok-build` | npx | `npx @xai-official/grok agent stdio` |
| Harn | `harn` | binary | — |
| Junie (JetBrains) | `junie` | binary | — |
| **Kilo** | `kilo` | binary | `kilo acp` (opencode-based, uses the ACP SDK) |
| Kimi CLI | `kimi` | binary | `kimi acp` |
| Minion Code | `minion-code` | uvx | `uvx minion-code acp` |
| Mistral Vibe | `mistral-vibe` | binary | — |
| Nova | `nova` | npx | `npx @compass-ai/nova acp` |
| **OpenCode** | `opencode` | binary | `opencode acp` |
| pi ACP | `pi-acp` | npx | `npx pi-acp` |
| Poolside | `poolside` | binary | — |
| Qoder CLI | `qoder` | npx | `npx @qoder-ai/qodercli --acp` |
| Qwen Code | `qwen-code` | npx | `npx @qwen-code/qwen-code --acp` |
| siGit Code | `sigit` | binary | — |
| Stakpak | `stakpak` | binary | — |
| VT Code | `vtcode` | binary | — |

Registry inclusion requires the agent to advertise valid `authMethods`, verified by their CI —
a useful quality floor for us. `uvx` distributions exist too, so the launcher must support
`npx`, `uvx` and downloaded binaries.

### 3.3 Agent-specific notes that affect the design

| Agent | Note |
| --- | --- |
| GitHub Copilot CLI | ACP is public preview (2026-01-28). Tool filtering and reasoning effort are **server-start flags**, not per-session — a regression vs today's SDK (R-021 AC3). BYOK via `COPILOT_PROVIDER_*` runs without GitHub login. Supports stdio **and** TCP. Measured: v1, `loadSession: true`, image + embeddedContext. |
| Copilot *cloud* | No ACP surface. The cloud coding agent is reachable over GitHub's own APIs/MCP, not ACP; "Copilot over ACP" means the CLI. Out of scope until GitHub ships one. |
| Devin CLI | `devin acp` over stdio, full slash-command set advertised, elicitation support, per-tool metadata. **`devin acp --cloud` (insiders) relays to Devin cloud** — i.e. local vs cloud is a *launch variant*, exactly what T2 profiles model. |
| Claude / Codex | Official `@agentclientprotocol/*` adapters; the old `@zed-industries/claude-agent-acp` is deprecated. |
| Gemini CLI | Native `--acp`, but Google announced the transition of Gemini CLI to **Antigravity CLI**; treat the Gemini entry as at-risk and pin versions (see risks in 04-roadmap). |
| **Antigravity (`agy`)** | **No ACP today.** `agy --acp` is an open feature request (`google-antigravity/antigravity-cli#31`); a community bridge (`agy-acp`) exists, but Google's ToS state that using third-party software with an Antigravity login violates the terms, and the ToS question raised by the bridge author is unresolved. **Decision: T4 — do not ship a wrapper.** Track the upstream issue; the moment `agy --acp` exists it becomes a registry/T2 entry with zero code from us. |
| Kilo | In the registry (`kilo acp`), built on opencode and the ACP SDK. |
| GLM (Zhipu) | In the registry as `glm-acp-agent`. |
| MiniMax | The MiniMax **CLI** has an open ACP request, but **Mini Agent ships an ACP server** (`mini-agent-acp`, `uv tool install`) documented for Zed. Not in the registry → supported as a T2 custom profile. |
| LM Studio / Ollama / vLLM / OpenRouter | Not ACP (OpenAI-compatible + MCP). T3 via `apps/acp-openai-agent` (ADR-0006). |

### 3.4 Consequence

Supporting "all the ACP agents of 2026" needs **zero per-agent code**: a catalog, a launcher
that speaks npx/uvx/binary/TCP, launch *profiles* for variants, a strictly capability-driven
UI, and an automated conformance probe that records what each agent actually supports.

## 4. What the existing `feat/acp` branch actually is

Audited `origin/feat/acp` (37 commits, 78 files, +5852/−923): despite the name it contains
**no ACP** — no `@agentclientprotocol/sdk`, no JSON-RPC framing, no ACP types. It is a
*multi-provider* abstraction: `llm-provider.service.ts` plus `providers/*` adapters
(Copilot wrapper, `cli-command.provider.ts` spawning CLIs and scraping stdout with
synthetic Copilot-shaped events, `openai-compatible.provider.ts` for Ollama/LM
Studio/OpenRouter/Groq), an encrypted credential store, `routes/providers.ts`, and
extension UI for provider-grouped models, provider badges and recovery states. Its
abstraction boundary is still typed in Copilot SDK event shapes and each adapter
re-implements its own history.

Keep from it: the encrypted credential store, the OpenAI-compatible client (as the guts of
our own ACP agent for local models), the provider-grouped model UI patterns and
availability/recovery UX. Discard: the CLI stdout-scraping adapters, the Copilot-shaped
event interface, and per-adapter history reconstruction.

## 5. Current DevMentorAI coupling (what the refactor has to move)

- `apps/backend/src/services/copilot.service.ts` (~1.1k lines): SDK client, session map,
  send/stream, retries, attachments, permissions auto-approved (`approveAll`), mock mode.
- `apps/backend/src/routes/chat.ts` (~710 lines): SDK event → SSE translation
  (`message_delta`, `message_complete`, `tool_start`, `tool_complete`, `error`, `done`),
  120 s turn / 30 s idle timeouts.
- `routes/sessions.ts`, `account.ts`, `models.ts`, `health.ts`, `tools.ts`: Copilot-specific
  lifecycle, auth/quota, model catalog, health and DevOps tools.
- SQLite (`~/.devmentorai/devmentorai.db`, raw `better-sqlite3`): `sessions`, `messages`,
  `session_contexts` — our own history, independent of the agent.
- Extension: `services/api-client.ts` (fetch + SSE parsing, no WebSocket), `hooks/useChat.ts`,
  `ChatView.tsx`, `MessageBubble.tsx`, quick actions in `background.ts`, writing assistant.
  No slash-command, permission, plan or diff UI exists today.

## 6. Findings that change the product, not just the code

1. **Permissions become real.** Today every tool call is auto-approved. ACP agents expect a
   Client that can ask the user; a permission UI is mandatory, and auto-approve must
   become an explicit, per-agent user setting.
2. **A workspace directory becomes mandatory.** `session/new` requires an absolute `cwd`
   and all protocol paths are absolute. A browser extension has no project directory, so
   DevMentorAI must own a configurable workspace root and treat it as a security boundary.
3. **Agents must be installed/launchable locally.** The backend must spawn them (npx or
   downloaded binary). Copilot no longer arrives "for free" with the SDK dependency; it is
   `npx @github/copilot --acp` plus its own auth.
4. **The UI must be capability-driven.** Models, modes, reasoning, slash commands, images
   and history availability all vary per agent and per session, pushed at runtime.
5. **Our message store stops being the source of truth** for agents that support replay,
   but cannot be deleted outright (cross-agent listing, offline, agents without replay).

## 7. Open questions

- ~~**Q1** Does the installed Copilot CLI negotiate ACP v1 or v2, and what
  `promptCapabilities` does it advertise?~~ **Answered by the spike (§2.1):** v1,
  `loadSession: true`, `image: true`, `audio: false`, `embeddedContext: true`.
- **Q2** Which of the *other* target agents support `session/load`/`session/resume` replay
  in practice? Copilot does; the SDK example does not. Determines how much of our local
  history we can retire (R-040). Measured per agent during Phase 5.
- **Q3** Do we bundle any agent (e.g. pin `@github/copilot`) or always resolve at runtime
  from the registry with a user-visible install step?
- **Q4** Native messaging host: keep it as-is, or route it through the same ACP host?
