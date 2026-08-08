# ADR-0003 — Replace SSE with a bidirectional WebSocket JSON-RPC channel

Status: accepted (Phase 0)

## Context

Today the extension receives Copilot events over SSE (`/api/sessions/:id/chat`), which is
one-way. ACP requires the Client to *answer requests from the agent* mid-turn:
`session/request_permission` blocks the turn until the user chooses, and v2 adds
`elicitation/create`. Cancellation, config changes and session control also need to travel
upstream while a turn is running. Bolting POST callbacks onto SSE would reinvent a worse
JSON-RPC.

## Decision

A single WebSocket endpoint `/acp` carrying JSON-RPC 2.0 in both directions. UI→backend
requests (`ui/prompt`, `ui/cancel`, `ui/setConfigOption`, `ui/agents.*`, `ui/sessions.*`),
backend→UI notifications (`ui/event`, `ui/agentStatus`, `ui/error`), and backend→UI requests
answered by the UI (`ui/permission.request`, `ui/elicitation.create`). The backend keeps a
per-session turn buffer so a reconnecting panel can replay the in-flight turn. REST survives
only for non-streaming utilities (health, image upload, catalog).

## Consequences

- The UI protocol mirrors ACP's shape, so the host is a thin, testable relay.
- Permission and elicitation UX becomes possible at all.
- Reconnect handling and message ordering are now our responsibility (turn buffer, ids).
- The extension gains a WebSocket client it does not currently have; SSE parsing code is
  deleted in Phase 8.
