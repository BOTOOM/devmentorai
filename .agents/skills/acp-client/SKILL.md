---
name: acp-client
description: How to talk to Agent Client Protocol (ACP) agents from Node/TypeScript — SDK usage, version differences, capability gating, slash commands, images, permissions, history replay, and how to probe a real agent. Use when working on the DevMentorAI ACP host (apps/backend/src/acp) or debugging an agent integration.
---

# ACP client integration (DevMentorAI)

Spec: <https://agentclientprotocol.com> · design docs: `docs/specs/acp/` (read `01-research.md`
before changing protocol code). ACP here means *Agent Client Protocol*, not IBM's "Agent
Communication Protocol".

## Ground rules

- **v1 is the production target.** `@agentclientprotocol/sdk` main entrypoint = v1
  (`PROTOCOL_VERSION === 1`); v2 is draft behind `@agentclientprotocol/sdk/experimental/v2`
  and gated by the `ACP_V2` flag. Version-specific shapes live only in `acp/normalize/*`.
- **Capability-first.** Never call a method or send a content type the agent did not
  advertise in `initialize` / `promptCapabilities`. Unsupported methods come back as
  JSON-RPC `-32601`, which means *unsupported*, not *broken*.
- **v1 `session/prompt` blocks for the whole turn** and its response carries `stopReason`.
  The host synthesises `running`/`idle` state from that. (v2 uses `state_update` instead.)
- Updates can still arrive **after** `session/cancel` — keep accepting them.
- Only `apps/backend/src/acp/**` may import the ACP SDK.

## Minimal client over stdio

```ts
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';

const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd, env });
const stream = acp.ndJsonStream(
  Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
  Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
);

const app = acp.client({ name: 'devmentorai', version: '…' })
  .sessionUpdate(async (params) => { /* normalise → AcpEvent */ })
  .requestPermission(async (params) => ({
    outcome: { outcome: 'selected', optionId: chosenOptionId },
  }));

const conn = await app.connect(stream);
const init = await conn.initialize({ protocolVersion: acp.PROTOCOL_VERSION, clientCapabilities: {} });
const { sessionId } = await conn.newSession({ cwd, mcpServers: [] });
const { stopReason } = await conn.prompt({ sessionId, prompt: [{ type: 'text', text: 'hi' }] });
```

`child.stderr` is diagnostics only — keep a bounded ring buffer and never parse it.

## Launching the agents we support

Launch specs are data, from `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
(`distribution.npx` = `{ package, args, env }`; `distribution.binary.<platform>` =
`{ archive, cmd, args, sha256 }`). Handy ones:

| Agent | Command |
| --- | --- |
| GitHub Copilot | `npx @github/copilot --acp --stdio` (or `--acp --port N` for TCP) |
| Gemini CLI | `npx @google/gemini-cli --acp` |
| Claude | `npx @agentclientprotocol/claude-agent-acp` |
| Codex | `npx @agentclientprotocol/codex-acp` |
| Devin CLI | `devin acp` (add `--cloud` to relay to Devin cloud, `--model`, `--agent-type`) |
| OpenCode / Cursor / goose | `opencode acp` / `cursor-agent acp` / `goose acp` |
| Kilo / GLM / Qwen / Kimi / Droid | `kilo acp` / `npx glm-acp-agent` / `npx @qwen-code/qwen-code --acp` / `kimi acp` / `npx droid exec --output-format acp-daemon` |

The registry also ships `uvx` distributions (fast-agent, Minion Code), so the launcher handles
`npx`, `uvx` and downloaded binaries. Anything not in the registry — private builds, MiniMax's
`mini-agent-acp` — is a user-defined **profile** (`cmd`/`args`/`env`); never add per-agent code.

Not ACP: LM Studio, Ollama and other OpenAI-compatible endpoints are served by our own agent,
`apps/acp-openai-agent`. Antigravity (`agy`) has no ACP server yet and must not be wrapped
(Google's ToS); track `google-antigravity/antigravity-cli#31`.

## Slash commands

Push-only: handle `session/update` with `sessionUpdate === 'available_commands_update'` and
treat each notification as a **complete replacement**. There is no request to fetch them.
Invoke a command by sending its text as an ordinary prompt: `[{ type: 'text', text: '/usage' }]`.
Commands that need an interactive TUI are not advertised and would be forwarded to the model
as plain text.

## Content blocks

```ts
{ type: 'text', text }                                        // baseline
{ type: 'image', mimeType: 'image/png', data: base64 }        // needs promptCapabilities.image
{ type: 'resource', resource: { uri, mimeType, text } }       // needs promptCapabilities.embeddedContext
{ type: 'resource_link', uri: 'file:///abs/path', name }      // baseline
```

Page/selection context goes in `resource` blocks, not concatenated into the text.

## History

`session/list` for listing, replay via v1 `session/load` (needs `agentCapabilities.loadSession`)
or v2 `session/resume` + `replayFrom: { type: 'start' }`. The agent replays the conversation as
`session/update` notifications; reconcile by `messageId` / `toolCallId` to avoid duplicates.
Support varies per agent — Copilot CLI has `loadSession: true`, many agents have nothing.

## Probing a real agent (debugging)

Use the SDK's own example agent for credential-free plumbing tests:

```
node node_modules/@agentclientprotocol/sdk/dist/examples/agent.js
```

For a real agent, log every frame verbatim before assuming anything. Measured behaviour:

- Copilot CLI: v1, `loadSession: true`, `promptCapabilities.image: true`, `audio: false`,
  `embeddedContext: true`, auth method `copilot-login`. Unauthenticated, `session/new` fails
  with `{ code: -32000, message: 'Authentication required' }` → run `copilot login` once.
- SDK example agent: v1, `loadSession: false`, `-32601` for `session/list`/`load`/`resume`,
  `session/cancel` → `{ stopReason: 'cancelled' }` with trailing chunks after the cancel.

## Testing

Integration tests run against a **fixture agent** built with the SDK's `agent()` side, scripted
to emit specific update variants, request permissions, stall, or crash. Do not mock our own
event shapes — mock at the protocol boundary.
