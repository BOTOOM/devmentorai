# ADR-0002 — The backend is the ACP host; the extension never speaks ACP directly

Status: accepted (Phase 0)

## Context

ACP's universal transport is stdio: the Client spawns the agent as a subprocess and
exchanges NDJSON over its pipes. A browser extension cannot spawn processes, read stderr,
manage a `cwd`, or hold OS credentials. Some agents also offer TCP, but stdio is the only
mode every agent supports, and process lifecycle (crash, restart, shutdown) has to live
somewhere with an OS.

## Decision

`apps/backend` becomes the ACP host: it owns agent processes, the ACP Client implementation,
capabilities, credentials, the workspace root, and session↔agent mapping. The extension is
a thin view over a DevMentorAI-specific UI protocol (ADR-0003) and contains no ACP wire
knowledge. Only `apps/backend/src/acp/**` may import the ACP SDK.

## Consequences

- One place enforces capability checks, permissions and the workspace boundary.
- The backend becomes a required component for all agents (it already was for Copilot).
- Multiple UI clients (side panel, quick actions, writing assistant, native messaging) share
  one host and one session store.
- Alternative rejected: a native-messaging-only host — it would duplicate the host in a less
  testable place and lose the existing REST/DB infrastructure.
