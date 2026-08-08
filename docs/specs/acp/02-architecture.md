# 02 — Target architecture

## 1. Shape of the system

```
┌──────────────────────────── browser ────────────────────────────┐
│ extension (WXT)                                                 │
│  side panel chat · quick actions · writing assistant            │
│  slash-command palette · tool-call cards · permission prompts   │
│  plan view · config selectors (model/mode/reasoning)            │
└───────────────▲─────────────────────────────────────────────────┘
                │  WebSocket, JSON-RPC 2.0 (bidirectional)
                │  ui/* requests  ·  session/update fan-out
┌───────────────▼─────────────────────────────────────────────────┐
│ backend (Fastify)  ── the ACP HOST ──                           │
│  ws gateway ──► session router ──► AcpConnection (1 per agent)  │
│                     │                    │                      │
│                     │                    └─ @agentclientprotocol/sdk
│                     │                       client() + ndJsonStream
│                     ├─ agent catalog (registry.json + custom)   │
│                     ├─ agent launcher (spawn npx / binary / TCP)│
│                     ├─ credential store (encrypted, env-only)   │
│                     ├─ workspace manager (cwd policy)           │
│                     └─ session index + display cache (SQLite)   │
└───────────────▲─────────────────────────────────────────────────┘
                │ stdio NDJSON (one subprocess per agent)
   ┌────────────┴───────────┬──────────────┬─────────────────┐
   │ copilot --acp --stdio  │ gemini --acp │ devin acp  …    │
   └────────────────────────┴──────────────┴─────────────────┘
                                    │
                     apps/acp-openai-agent (ours)
                     ACP agent fronting LM Studio / Ollama /
                     any OpenAI-compatible endpoint
```

Key property: **the backend is an ACP Client and nothing else.** There is no
provider abstraction, no per-vendor adapter, and no Copilot-specific code path. Adding an
agent is a catalog entry (or a user-supplied command line), never new code.

Rationale for each boundary: [ADR-0002](./adr/0002-backend-as-acp-host.md) (browser cannot
spawn processes), [ADR-0003](./adr/0003-websocket-jsonrpc-ui-transport.md) (SSE cannot carry
agent→UI *requests* such as permissions), [ADR-0006](./adr/0006-local-models-via-own-acp-agent.md).

## 2. Backend modules

`apps/backend/src/acp/`

| Module | Responsibility |
| --- | --- |
| `catalog/agent-catalog.ts` | Built-in curated agents + the full cached ACP registry (`registry.json`) + user-defined agents, all exposed as **profiles** (named launch tuples, so `devin acp` and `devin acp --cloud` are two entries). Resolves a platform-specific `LaunchSpec { kind: npx\|uvx\|binary\|command\|tcp, cmd, args, env, sha256? }`. |
| `catalog/agent-installer.ts` | Optional download/extract of binary distributions into `~/.devmentorai/agents/<id>/<version>/`, sha256-verified; `npx`/`uvx` agents resolve lazily. |
| `catalog/conformance.ts` | Scripted probe of a profile (initialize → prompt → command → image → permission → history → cancel) that records what the agent really supports; feeds the UI support matrix and the generated table in `docs/ACP.md`. |
| `launcher.ts` | Spawns the agent, wires `stdin`/`stdout` into `ndJsonStream`, keeps `stderr` in a bounded ring buffer for diagnostics, owns process lifecycle (exit, crash, kill on idle timeout, graceful shutdown). |
| `connection.ts` | One `AcpConnection` per running agent: `initialize` + version negotiation, capability record, `authenticate`/`auth/login`, and all Client-side handlers (`sessionUpdate`, `requestPermission`, `elicitation/create` when v2). |
| `normalize/v1.ts`, `normalize/v2.ts` | Map version-specific wire shapes onto one internal `AcpEvent` union (see §4). All version differences are confined here. |
| `session-manager.ts` | DevMentorAI session ⇄ `{ agentId, acpSessionId, cwd, protocolVersion, capabilities, configOptions }`. `session/new`, replay/resume, `close`, `cancel`, `set_config_option`, `prompt`. |
| `permissions.ts` | Correlates `session/request_permission` with a UI prompt; applies per-agent policy (`ask` / `allow_always` remembered choices / `deny`); auto-answers `cancelled` on cancellation. |
| `content.ts` | Builds `ContentBlock[]` for prompts from user text, images, page context and selections — strictly gated by `promptCapabilities`, with documented degradation. |
| `workspace.ts` | Resolves and validates the absolute `cwd` for a session; enforces the workspace root as a boundary. |
| `credentials.ts` | Encrypted at-rest store (`~/.devmentorai/credentials`, `0600`); values are only ever injected into an agent process `env`, never returned over HTTP/WS. |
| `errors.ts` | JSON-RPC / process failures → typed `AcpError` (§5). |

`apps/backend/src/acp/` is the only place allowed to import `@agentclientprotocol/sdk`.

## 3. UI transport (extension ⇄ backend)

WebSocket at `/acp` carrying JSON-RPC 2.0 both ways.

UI → backend (requests): `ui/agents.list`, `ui/agents.install`, `ui/agents.auth`,
`ui/sessions.list`, `ui/sessions.create`, `ui/sessions.resume`, `ui/sessions.close`,
`ui/prompt`, `ui/cancel`, `ui/setConfigOption`, `ui/permission.respond`,
`ui/elicitation.respond`.

Backend → UI (notifications): `ui/event` wrapping the normalised `AcpEvent`s, plus
`ui/agentStatus` (process up/down/crashed, auth state) and `ui/error`.

Backend → UI (requests, answered by the UI): `ui/permission.request`,
`ui/elicitation.create`. These are why the transport must be bidirectional: SSE cannot
carry them, and a turn *blocks* on the answer.

Reconnection: the UI resubscribes per session and requests a replay of the current turn
from the backend's in-memory turn buffer, so a panel close/reopen mid-turn does not lose
content. REST endpoints are kept only for non-streaming utilities (health, images,
catalog) — see [ADR-0003](./adr/0003-websocket-jsonrpc-ui-transport.md).

## 4. Internal event model (`packages/shared`)

One union, version-agnostic, upsert-shaped — the UI reduces it into a session view model:

```ts
type AcpEvent =
  | { type: 'message';        role: 'user' | 'assistant' | 'thought'; messageId: string;
                              content: ContentBlock[]; mode: 'replace' | 'append' }
  | { type: 'tool_call';      toolCallId: string; title?: string; kind?: ToolKind;
                              status?: ToolCallStatus; content?: ToolCallContent[];
                              locations?: ToolCallLocation[]; raw?: { input?: unknown; output?: unknown };
                              mode: 'replace' | 'append' }
  | { type: 'terminal';       terminalId: string; command?: string; cwd?: string;
                              output?: { data: string; mode: 'snapshot' | 'append' };
                              exitStatus?: { exitCode?: number | null; signal?: string | null } }
  | { type: 'plan';           planId?: string; entries: PlanEntry[] }
  | { type: 'commands';       commands: AvailableCommand[] }       // complete replacement
  | { type: 'config';         options: ConfigOption[] }            // complete state
  | { type: 'session_info';   title?: string | null; updatedAt?: string | null }
  | { type: 'usage';          used: number; size: number; cost?: { amount: number; currency: string } }
  | { type: 'state';          state: 'running' | 'idle' | 'requires_action';
                              stopReason?: StopReason }
  | { type: 'error';          error: AcpErrorPayload };
```

Normalisation rules that hide the v1/v2 split:

- v1 `tool_call` and `tool_call_update` both become `tool_call` with `mode: 'replace'`;
  v2 `tool_call_content_chunk` becomes `mode: 'append'`.
  Consumers merge tool-call events field-wise: absent fields are unchanged, present `content`
  replaces the previous array, and `mode: 'append'` appends to it.
- v1 has no `state_update`: the host **synthesises** `state: running` when it sends
  `session/prompt` and `state: idle` with the `stopReason` from the prompt *response*.
  In v2 the notifications are passed through and the prompt response is ignored.
- v1 `plan` → `plan` with no `planId`; v2 `plan_update` keeps it.
- Chunk variants (`*_message_chunk`) become `message` with `mode: 'append'`; whole-message
  updates use `mode: 'replace'`, keyed by `messageId` (chunk-then-replace ordering per spec).
- Unknown `sessionUpdate` variants, unknown content types, unknown `kind`/`status` values
  and `_`-prefixed extensions are **preserved and rendered generically**, never dropped.

## 5. Error taxonomy

| `AcpError.code` | Cause | UI treatment |
| --- | --- | --- |
| `agent_not_installed` | catalog entry has no resolvable binary/npx | "Install" action |
| `agent_launch_failed` | spawn/ENOENT/non-zero exit at startup | show last stderr lines + retry |
| `agent_crashed` | process exited mid-session | mark session degraded, offer resume |
| `protocol_version_unsupported` | agent negotiated a version we don't support | block with explanation |
| `auth_required` | `authMethods` present and unauthenticated, or `-32000`-class auth error | actionable instructions (e.g. run `copilot login`) or `auth/login` button |
| `capability_unsupported` | UI asked for something not advertised (image, replay, config) | disable control + tooltip; never send it anyway |
| `permission_denied` | user rejected | tool card shows rejected, turn continues |
| `cancelled` | user cancelled | not an error state in the UI |
| `agent_error` | any other JSON-RPC error from the agent | surfaced verbatim (code + message) with a copy action |

Rules: JSON-RPC `-32601` means *unsupported*, not *broken* (spike §2.1) — capability checks
come first, errors are the backstop. Errors are persisted with the turn so a reopened
session shows why it stopped.

## 6. Data model

`sessions` gains: `agent_id`, `acp_session_id`, `cwd`, `protocol_version`,
`capabilities_json`, `config_options_json`, `title_source` (`agent` | `local`),
`replay_supported`. `model`/`reasoning_effort`/`custom_agent` are superseded by
`config_options_json` and removed after the migration window.

New `agents` table: installed/known agents with `id`, `source` (`builtin` | `registry` | `custom`),
`version`, `launch_json`, `auth_state`, `last_error`.

`messages` and `session_contexts` are retained as a **display cache** (fast paint, offline,
and the only history for agents without replay), explicitly not the source of truth. Cache
entries are keyed by `messageId`/`toolCallId` so a replay reconciles rather than duplicates.
See [ADR-0004](./adr/0004-history-acp-first-with-local-cache.md).

## 7. Content mapping (prompts)

| DevMentorAI input | ACP block | Requires | Degradation |
| --- | --- | --- | --- |
| chat text | `text` | baseline | — |
| slash command | `text` = `"/name args"` | advertised command | send as plain text with a warning |
| screenshot / pasted image | `image` (base64, after the existing sharp pipeline) | `promptCapabilities.image` | drop the image, insert a note, warn in UI |
| page context / selection / DOM extract | `resource` (`uri: devmentor://tab/<id>…`, `mimeType`, `text`) | `promptCapabilities.embeddedContext` | inline as fenced text in the `text` block |
| referenced file in the workspace | `resource_link` | baseline | — |
| audio | `audio` | `promptCapabilities.audio` | unsupported today |

## 8. Security model

- Agents are local subprocesses with the user's privileges. The workspace root is the
  declared `cwd` boundary; the UI always shows which directory a session runs in.
- Permissions are user decisions by default. Auto-approve is an explicit per-agent opt-in
  and is surfaced in the session header — no silent `approveAll` as today.
- Credentials: prefer the agent's own out-of-band login (`copilot login`, `devin auth login`)
  or ACP `auth/login`. Where an agent needs env keys, they live in the encrypted store,
  are injected into that agent's process env only, and are never echoed by any API.
- The WS gateway stays bound to loopback and validates the extension origin.
- Agent stderr is captured for diagnostics but treated as untrusted text in the UI.

## 9. What gets deleted

`copilot.service.ts`, the Copilot SDK dependencies, the SSE chat translation layer, the
bespoke model catalog + reasoning-effort plumbing, Copilot auth/quota routes, and mock mode
(replaced by a test-only ACP agent fixture that speaks the real protocol).
