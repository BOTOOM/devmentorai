# ADR-0006 — Local/OpenAI-compatible models are supported by shipping our own ACP agent

Status: accepted (Phase 0)

## Context

The request named LM Studio alongside the ACP agents. LM Studio exposes an OpenAI-compatible
API (with MCP support), **not** ACP; the same is true of Ollama, vLLM, llama.cpp and
OpenRouter. Third-party bridges exist (e.g. `acp-bridge`, a Rust adapter in the registry
pipeline), and the `feat/acp` branch already contains a working
`openai-compatible.provider.ts` with streaming and tool calls.

Options: (a) special-case a non-ACP provider inside the host, (b) depend on a third-party
bridge, (c) ship our own minimal ACP *agent* that fronts an OpenAI-compatible endpoint.

## Decision

Option (c): `apps/acp-openai-agent`, built with the ACP SDK's agent side, reusing the
OpenAI-compatible client from `feat/acp`. It is registered as a built-in catalog entry and
spawned like any other agent. The host stays a pure ACP Client with zero special cases.

## Consequences

- One code path for every model, local or hosted; the capability negotiation is honest
  (we advertise only what the endpoint really supports).
- We own an agent implementation (tool-call loop, streaming, cancellation) — real work, but
  isolated in its own package and independently testable.
- Rejected (a): reintroduces the provider abstraction the refactor exists to remove.
- Rejected (b): an unvetted external binary in the trust path for a core feature; may be
  revisited as an optional extra catalog entry.
