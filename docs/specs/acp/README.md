# ACP Migration Spec (Agent Client Protocol)

This directory holds the spec-driven-development artifacts for migrating DevMentorAI
from the GitHub Copilot SDK to the **Agent Client Protocol (ACP)** as its only
agent integration surface.

Nothing in this directory changes runtime behaviour. It is the contract that the
implementation PRs are written against and reviewed with.

## Read in this order

| Doc | Purpose |
| --- | --- |
| [01-research.md](./01-research.md) | Protocol facts, agent/ecosystem matrix, evidence, open questions |
| [02-architecture.md](./02-architecture.md) | Target architecture, transports, data model, error taxonomy, security |
| [03-requirements.md](./03-requirements.md) | Numbered requirements + acceptance criteria (the definition of done) |
| [04-roadmap.md](./04-roadmap.md) | Phased, PR-sized implementation plan with per-phase exit criteria |
| [adr/](./adr/) | Architecture Decision Records for the choices the plan depends on |

## Working agreement (spec-driven)

1. A change starts as a requirement in `03-requirements.md` with acceptance criteria.
2. A decision that constrains more than one requirement becomes an ADR in `adr/`.
3. An implementation PR must state which requirement IDs (`R-xxx`) it satisfies and
   how each acceptance criterion is verified (unit / integration / E2E / manual).
4. A requirement is only done when its acceptance criteria are verified by an
   automated test, or explicitly marked `manual` with a recorded verification.
5. Requirements and ADRs are amended, never silently dropped. Removing a
   requirement requires a note in the doc explaining why.

## Terminology

- **ACP** — Agent Client Protocol (<https://agentclientprotocol.com>), a JSON-RPC 2.0
  protocol between a *Client* (editor / UI) and an *Agent* (coding agent).
  Not to be confused with IBM's "Agent Communication Protocol".
- **Agent** — an ACP server process such as `copilot --acp`, `gemini --acp`,
  `opencode acp`, `devin acp`, `cursor-agent acp`.
- **ACP host** — the DevMentorAI backend component that spawns agents, speaks ACP as
  a Client, and multiplexes sessions to the extension.
- **Session** — an ACP conversation (`session/new` → `sessionId`), owned by the agent.
