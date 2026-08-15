# ADR-0001 — Adopt ACP v1 as the implementation target, keep v2 behind a flag

Status: accepted (Phase 0)

## Context

ACP publishes a stable v1 schema and a **draft** v2. The v2 docs explicitly tell
implementers to gate v2 behind version negotiation and feature flags and to keep serving v1
peers. The official TypeScript SDK 1.3.0 exports `PROTOCOL_VERSION = 1` from its main
entrypoint and hides v2 behind `@agentclientprotocol/sdk/experimental/v2` with a warning
that the wire format may change incompatibly in any release. Our spike measured
`copilot --acp --stdio` negotiating v1, and the SDK example agent likewise.

v2 is nonetheless where the protocol is going (upsert semantics, `state_update` lifecycle,
`session/resume` replay, display terminals, elicitation, forward-compatible enums).

## Decision

Implement v1 as the production path. Negotiate the version per connection. Keep a v2
implementation behind an `ACP_V2` flag (Phase 9). Confine every version-specific shape to
`acp/normalize/{v1,v2}.ts`, and design the internal `AcpEvent` union along v2 lines
(upserts, ids, complete-state notifications) so v1 is the constrained case rather than the
model.

## Consequences

- We can ship against every agent available today.
- v1's blocking `session/prompt` means the host must synthesise turn state (R-004).
- Adopting v2 later is a normaliser plus flag flip, not a rewrite.
- Cost: two normalisers and their golden-file tests.
- The version seam lives at the session-manager update boundary: negotiated
  notifications select the matching normaliser, while v1-only turn completion
  synthesis is skipped for v2. The event union, session shape, and UI remain
  version-neutral.
