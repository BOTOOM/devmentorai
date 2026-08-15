---
name: testing-extension-chat
description: How to end-to-end test the DevMentorAI browser-extension side-panel chat UI (apps/extension) without GitHub Copilot credentials. Use when testing chat features (input, Markdown rendering, streaming, XSS) in the Chrome MV3 side panel.
---

# Testing the DevMentorAI extension chat (side panel)

## Build & load the extension
```
pnpm --filter @devmentorai/extension exec wxt prepare
pnpm --filter @devmentorai/extension build   # -> apps/extension/.output/chrome-mv3
```
Load unpacked in Chrome. The chat lives in the **side panel** (MV3 `side_panel`, `sidepanel.html`),
opened by clicking the extension action icon (`openPanelOnActionClick` is set).

Tip: this env launches Chrome with `--remote-debugging-port=29229`, `--user-data-dir=/home/ubuntu/.browser_data_dir`,
and `--load-extension=.../adblock`. To add the built extension, kill Chrome and relaunch appending
`,/home/ubuntu/repos/devmentorai/apps/extension/.output/chrome-mv3` to the existing `--load-extension` value
(preserve all other flags). The side-panel target appears in `http://localhost:29229/json` as a `page`
with url ending `sidepanel.html`. The extension service worker shows as `chrome-extension://hngnabdfcjlmbekianjfjkddjmnobodp/background.js`.

### Reliable relaunch (do NOT rely on the GTK "Load unpacked" dialog)
chrome://extensions → Load unpacked opens a GTK file chooser whose **file list does not populate**
in this env, so you cannot select the folder. `Extensions.loadUnpacked` over CDP also returns
"Method not available" (Chrome not launched with the needed flags). Instead relaunch via CLI:
```bash
export DISPLAY=:0                 # required or Chrome won't start (silent, empty log)
# copy the running Chrome's flags and just swap --load-extension:
python3 - <<'PY'
args=[a for a in open('/proc/<CHROME_PID>/cmdline').read().split('\x00') if a]
# replace --load-extension=... with adblock,<built-ext-path>; then exec
PY
nohup <chrome> ...flags... --remote-debugging-port=29229 \
  --load-extension=/opt/.devin/package/chrome_extensions/adblock,/home/ubuntu/repos/devmentorai/apps/extension/.output/chrome-mv3 \
  --user-data-dir=/home/ubuntu/.browser_data_dir https://example.com >/tmp/chrome.log 2>&1 &
```
Sessions persist in the backend DB, so reopening the side panel restores prior chats.

### Env can reset mid-run
The environment may restart Chrome (dropping your `--load-extension`, leaving only adblock) **and**
kill the backend — e.g. around context compaction/handoffs. Symptoms: side panel gone, DevMentorAI
missing from chrome://extensions, `/api/health` returns empty. Recovery: restart backend with
`DEVMENTORAI_FORCE_MOCK=1`, relaunch Chrome via CLI (above), reopen side panel. Chrome's parent being
`init` (orphaned) means no respawn watchdog, so your manual relaunch is stable.

## Backend + mock mode (no Copilot creds)
The chat talks to a Fastify backend at `http://localhost:3847`. Run it separately:
`pnpm --filter devmentorai-server dev`. Health is at `/api/health` (NOT `/health`).
The bundled Copilot CLI returns 403 without a valid GitHub token, so **force mock mode**.
There is no built-in env flag; add a TEMPORARY test-only short-circuit at the top of
`CopilotService.initialize()` in `apps/backend/src/services/copilot.service.ts`:
```ts
if (process.env.DEVMENTORAI_FORCE_MOCK === '1') { this.mockMode = true; this.initialized = true; return; }
```
Run with `DEVMENTORAI_FORCE_MOCK=1`. Confirm `copilotConnected:false` in `/api/health`. **Revert the edit after testing.**
(`tsx watch` auto-restarts on edits and drops the env var — start it fresh with the env var set, and `pkill -f "tsx"` old watchers.)

Mock chat endpoint: `POST /api/sessions/:id/chat/stream` with body `{"prompt":"..."}` (field is `prompt`, not `message`).
Mock replies are Markdown but plain-ish: `**Mock Response:**` + paragraphs + numbered list, echoing `prompt.slice(0,100)`.
So verify RICH Markdown (tables/headings/fenced code) on **user** messages — they use the same
`MarkdownContent` component/path as assistant messages.

## Driving multi-line input without sending
Enter sends; Shift+Enter = newline. Two ways to enter a multi-line message (Markdown/XSS payloads):
- **Native (best for recordings):** `type` each line then `key: shift+Return` between lines, then `key: Return` to send.
- **One-shot:** CDP `Input.insertText` against the sidepanel target (dispatches an input event, not keydown,
  so React state updates and the Enter handler does not fire), then press Enter via the UI.

## Objective measurements via CDP (side panel is a separate document)
`browser_console` runs in the foreground page, NOT the side panel. Use a small CDP websocket client
against the sidepanel target's `webSocketDebuggerUrl` and call `Runtime.evaluate`.
**Python lib:** use `websockets` (asyncio) — `websocket-client`/`import websocket` is NOT installed.
Get the target URL: `curl -s localhost:29229/json | ...` filter url containing `sidepanel`.
Useful checks:
- Auto-resize: `getComputedStyle(textarea).height` and `.overflowY` (expect 48px→…→128px+auto, reset to 48px).
- Markdown: `div.text-sm.break-words` wraps each message; query `h1/strong/em/a/ul/ol/blockquote/table/th/td/pre/code/br`.
  Links must have `target=_blank` and `rel` containing `noopener noreferrer nofollow`.
- XSS: rendered bubble must have `querySelectorAll('script').length===0`, `img===0`, and a `javascript:` link's
  `getAttribute('href')` must be `""` (neutralized). No `alert()` should fire.

## Long-code containment (fixed at commit 24e4a7c — verify with the regression below)
Previously a very long unbreakable line in a fenced code block expanded the whole user bubble beyond
the panel width (838px in a 360px panel, off-screen left). Fixed by `min-w-0 max-w-[85%]` on the message
column + `min-w-0 max-w-full` on the bubble (`MessageBubble.tsx`) and `max-w-full` on `<pre>` +
`min-w-0 max-w-full` on the wrapper (`MarkdownContent.tsx`).
Regression check (both USER and ASSISTANT): send a fenced block with a ~100-char unbreakable identifier;
via CDP expect bubble `width ≤ ~310` in the 360px panel (`left≥0`, `right≤360`) and
`pre.scrollWidth > pre.clientWidth` with `overflow-x:auto` (setting `pre.scrollLeft` should change it).

### Testing the ASSISTANT (rich Markdown) path in mock mode
Mock replies are plain-ish. To exercise rich assistant Markdown + long-code containment, add a
TEMPORARY branch at the top of `generateMockResponse(prompt)` returning heading/bold/italic/link +
a fenced JS block with a long identifier + a GFM table when `prompt.includes('LONGCODE')`; then send a
message containing `LONGCODE`. **Revert after testing** (same file as the force-mock edit).
Note: a GFM table only renders when preceded by a blank line (standard Markdown), so include one.

## Devin Secrets Needed
None for mock-mode testing. Real Copilot responses would require a valid GitHub Copilot token
(`GITHUB_TOKEN`/`COPILOT_TOKEN`) — not needed if mock mode is used.

## Testing ACP over the side panel (pairing, fixture agent) — Phase 10A onward

Use **Node 22** (`. ~/.nvm/nvm.sh && nvm use 22`); better-sqlite3 fails to load on Node 24.

Start the backend as an ACP host with a deterministic agent and **no** origin env vars, so the
trust-on-first-use pairing path is what gets exercised:
```bash
rm -f ~/.devmentorai/pairing.json        # or: pnpm acp:unpair
ACP_FIXTURE_AGENT=1 pnpm --filter devmentorai-server dev 2>&1 | tee /tmp/backend.log
```
`ACP_FIXTURE_AGENT=1` registers the "Deterministic ACP fixture" profile
(`apps/backend/src/acp/catalog/agent-service.ts`). Do **not** set `ACP_FIXTURE_EXTENSION_ORIGIN`
or `ACP_EXTENSION_ORIGIN` when testing pairing — they bypass it.

UI path: side panel → **Browse ACP agents** button → "ACP agents and profiles" modal
(`SidePanel.tsx`, `AcpCatalogView.tsx`) → select profile → **Use selected profile for ACP session**.
Then type a prompt in the chat box. The fixture streams `fixture` → `thinking` → `echo` →
"Fixture tool" → a **permission prompt** (click *Allow once*) → `done` + plan/usage rows. If the
turn hangs on "Thinking…", an unanswered permission request is the usual cause.

Pairing mechanics worth asserting:
- `POST /acp/pair` with an extension Origin returns `{origin, token, pairedAt}` and writes
  `~/.devmentorai/pairing.json` (0600, 64-hex token).
- The WS at `/acp` needs origin + token via the `devmentorai-pairing.<token>` subprotocol.
  Curl probe: `curl -i http://localhost:3847/acp -H "Origin: <origin>" -H "Connection: Upgrade"
  -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
  -H "Sec-WebSocket-Protocol: devmentorai-pairing.<token>"` → 403 for a foreign/page origin or a
  missing token.
- Second extension → `409 pairing_conflict`; page origin → `403 pairing_rejected`.
- To force the conflict in the UI without a second extension, rewrite `pairing.json` with a
  different `chrome-extension://…` origin + random token and reload the panel: the modal should show
  a red error mentioning `pnpm acp:unpair` / `ACP_EXTENSION_ORIGIN`.
- Note the header status dot reflects **HTTP** backend health, not the ACP WS — it can stay green
  while ACP is refused, so assert on the modal contents, not the dot.

Theme toggle lives in the extension **options page** (gear icon in the side-panel header, opens a
`chrome://extensions?options=…` dialog) → Appearance → Light/Dark; the side panel restyles live.

## Testing ACP agent management in the options page (Phase 10B–10D onward)

Open the options page as a **full tab** (easier to drive than the dialog):
`chrome-extension://<extension-id>/options.html`. The **Agents** card sits between "Backend
Connection" and "Appearance" (`OptionsPage.tsx`, `AcpAgentsSection.tsx`).

Useful facts when asserting states:
- Badges come from `STATE_LABEL`: `Enabled` / `Auth required` / `Unavailable` / `Not enabled`.
  Removing a token flips an enabled agent from `Enabled` to `Auth required`.
- `Enable` creates an **implicit profile server-side** (no manual cmd/args/cwd form) and sets the
  agent as default if none exists; the star is `disabled` until the agent is enabled.
- Storing a token requires enabling first: otherwise the section shows the inline error
  `Enable <agentId> before storing a token`. That inline alert renders at the **top of the section**,
  which may be scrolled out of view when the `⋯` form is far down — scroll up to see it.
- The error alert (`role="alert"`) with **Retry** covers all failure modes: backend down →
  `ACP WebSocket connection failed`; foreign pairing → the `pnpm acp:unpair` message. While the
  error is shown the list also renders a misleading `No agent matches “”.` line.
- Options page "Backend Connection" indicator only refreshes on load / **Test Connection**, so it can
  read `Disconnected` even after a successful Agents **Retry**. Reload to re-check.

Verifying token secrecy (dummy token, no real creds needed):
```bash
grep -c DUMMYTOK /tmp/backend.log                     # expect 0
grep -rl DUMMYTOK ~/.devmentorai/                     # expect no matches (credentials is AES-GCM "v1:...")
```
and in the options-page console: `chrome.storage.local.get(null)` / `.sync.get(null)` — should only
hold `activeSessionId,theme,updateState`; the profile row in `acp_profiles.env_json` must hold only
`credential:<agentId>:<ENV_VAR>`.

Backend-level check for "session without a profile" (the side panel always sends the selected
profile id, so the fallback needs a direct RPC). Run from `apps/backend` so `ws`/`better-sqlite3`
resolve:
```js
// apps/backend/ws-default.mjs — read ~/.devmentorai/pairing.json, connect
// ws://127.0.0.1:3847/acp with Origin: <paired origin> and subprotocol devmentorai-pairing.<token>,
// then call ui/session.create with {} and assert the returned agentId === default profile id.
```

Known quirk to expect (may still be present): after enabling a catalog agent whose id matches an
existing custom profile (e.g. the fixture), the list shows **two cards with the same name** — the
catalog identity and the profile-derived entry (`agent-catalog.ts` merges custom profiles by id).
The side panel's profile dropdown then also shows two identical names and auto-selects the first,
which may be the stale custom profile rather than the default agent's implicit one.
