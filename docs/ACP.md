# ACP support

DevMentorAI uses ACP v1 as its product protocol. The backend is an ACP client/host and has no
provider-specific model branches. Agents are selected from the catalog or configured as profiles;
GitHub Copilot is launched through its ACP interface, and OpenAI-compatible endpoints use the
bundled `apps/acp-openai-agent` ACP agent.

## Extension pairing

The extension origin (`chrome-extension://<id>`) is only known once the extension is loaded, so
the backend pairs on first use: the first extension that calls `POST /acp/pair` is stored in
`~/.devmentorai/pairing.json` (mode `0600`) together with a random token, and the WebSocket at
`/acp` then requires that origin plus the token, sent as the `devmentorai-pairing.<token>`
subprotocol so it never reaches request logs. Any other extension gets `409 pairing_conflict`
and the UI shows how to recover; page origins get `403 pairing_rejected`.

Run `pnpm acp:unpair` to forget the pairing (for example after reinstalling the extension with a
new ID). `ACP_EXTENSION_ORIGIN` and `ACP_ALLOWED_ORIGINS` remain explicit overrides and skip
pairing entirely. REST is restricted to extension origins, loopback origins and those overrides,
so the WebSocket policy is no longer stricter than the HTTP one.

The extension derives controls from advertised capabilities. Images and embedded resources are
sent only when supported. Tool calls are permission-gated, remembered grants are backend-owned,
and the agent enforces its workspace boundary.

Replay-capable agents are authoritative for restored conversations (`session/load`). SQLite is a
reconciled display cache keyed by message and tool-call IDs. Local-only rows remain visible and
marked stale; unreachable agents and agents without `session/list` do not mark history stale.
Imported Copilot-SDK sessions remain readable and read-only.

This table is generated from conformance probe results. It records observed support rather
than claims made by the catalog.

<!-- GENERATED ACP SUPPORT TABLE: do not edit manually -->
| Agent | Protocol | History load capability | Advertised commands | Image capability | Auth methods |
| --- | ---: | --- | --- | --- | --- |
| acp-sdk-example | 1 | unsupported | unmeasured | unmeasured | 0 |
| github-copilot-cli | 1 | supported | unmeasured | supported | 1 |
| claude-acp | 1 | supported | supported | supported | 0 |
| codex-acp | 1 | supported | unmeasured | supported | 2 |
| gemini-cli | 1 | supported | unmeasured | supported | 4 |
| qwen-code | 1 | supported | unmeasured | supported | 1 |
<!-- END GENERATED ACP SUPPORT TABLE -->

Maintainers regenerate this table by running `pnpm tsx scripts/run-acp-probes.ts` with the desired
profiles, then `pnpm tsx scripts/generate-acp-support-table.ts`. Probe measurements distinguish
advertised capability from request outcomes, so authentication or network failures are not
reported as unsupported.
