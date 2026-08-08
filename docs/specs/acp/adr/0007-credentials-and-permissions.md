# ADR-0007 — Credentials stay out of the client; permissions become user decisions

Status: accepted (Phase 0)

## Context

Today the backend auto-approves every Copilot tool call (`approveAll`) and relies on the
Copilot SDK for auth. Under ACP, agents authenticate themselves: `initialize` returns
`authMethods`, and login is either an out-of-band CLI step (`copilot login`,
`devin auth login`) or the protocol's `authenticate` / `auth/login`. Some agents accept keys
via env (`COPILOT_PROVIDER_*`, `WINDSURF_API_KEY`, OpenAI-compatible endpoints). Meanwhile
ACP agents genuinely expect a human to answer `session/request_permission` before they edit
files or run commands.

## Decision

1. Prefer the agent's own login: surface `authMethods` and the agent's instructions verbatim,
   offer `auth/login` when the agent implements it, and never proxy or store provider tokens
   we don't need.
2. Where env credentials are unavoidable, store them encrypted at `~/.devmentorai/credentials`
   (`0600`), inject them only into that agent's process environment, and never return them
   over any API, log or error. The local key is stored beside the ciphertext with `0600`
   permissions, protecting against accidental disclosure (backups, logs and casual reads),
   not an attacker who already controls the user's local account.
3. Permission requests are answered by the user. `allow_always` decisions are remembered per
   agent+tool and are revocable; blanket auto-approve is an explicit per-agent opt-in, off by
   default, and shown in the session header.

## Consequences

- Removes today's silent auto-approval of file edits and command execution.
- Adds friction to flows that used to be invisible — mitigated by remembered choices.
- Auth failures become actionable UI states (`auth_required`) instead of opaque errors, which
  the spike showed is exactly what an unauthenticated Copilot CLI produces.
