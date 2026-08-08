import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentConnection } from '../../src/acp/connection.js';
import { AcpError } from '../../src/acp/errors.js';
import { AgentLauncher } from '../../src/acp/launcher.js';
import { AcpSessionManager } from '../../src/acp/session-manager.js';

const fixture = path.resolve('src/acp/fixtures/fixture-agent.ts');
const tsx = path.resolve('node_modules/.bin/tsx');
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'devmentorai-acp-'));

const launches = new Set<AgentLauncher>();

function launchSpec(env: Record<string, string | undefined> = {}) {
  return {
    cmd: tsx,
    args: [fixture],
    cwd,
    env,
  };
}

afterEach(async () => {
  await Promise.all([...launches].map((launcher) => launcher.shutdown()));
  launches.clear();
});

describe('ACP v1 fixture integration', () => {
  it('completes a turn and routes normalized updates', async () => {
    const events: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => events.push(event.type),
    });
    const connection = manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec(),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    await manager.prompt(session.id, [{ type: 'text', text: 'hello' }]);
    expect(connection.capabilities.protocolVersion).toBe(1);
    expect(events).toEqual(
      expect.arrayContaining([
        'message',
        'tool_call',
        'plan',
        'commands',
        'config',
        'usage',
        'state',
      ])
    );
    await manager.shutdown();
  });

  it('uses distinct turn and role-scoped message ids for chunks', async () => {
    const messages: Array<{ role: string; messageId: string }> = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'message') {
          messages.push({ role: event.role, messageId: event.messageId });
        }
      },
    });
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec(),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    await manager.prompt(session.id, [{ type: 'text', text: 'first' }]);
    await manager.prompt(session.id, [{ type: 'text', text: 'second' }]);
    const assistantIds = messages
      .filter((message) => message.role === 'assistant')
      .map((message) => message.messageId);
    const thoughtIds = messages
      .filter((message) => message.role === 'thought')
      .map((message) => message.messageId);
    expect(new Set(assistantIds).size).toBe(2);
    expect(new Set(thoughtIds).size).toBe(2);
    expect(new Set([...assistantIds, ...thoughtIds]).size).toBe(4);
    await manager.shutdown();
  });

  it('uses the default permission policy without auto approval', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      launcher,
    });
    await connection.connect();
    const session = await connection.newSession(cwd);
    const response = await connection.prompt(session.sessionId, [{ type: 'text', text: 'hello' }]);
    expect(response.stopReason).toBe('end_turn');
    await connection.shutdown();
  });

  it('cancels a turn and accepts updates sent after cancellation', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const updates: Record<string, unknown>[] = [];
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_STALL: '1' }),
      launcher,
      onSessionUpdate: ({ update }) => updates.push(update),
    });
    await connection.connect();
    const session = await connection.newSession(cwd);
    const prompt = connection.prompt(session.sessionId, [{ type: 'text', text: 'stall' }]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await connection.cancel(session.sessionId);
    await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
    expect(updates.some((update) => update.messageId === 'fixture-after-cancel')).toBe(true);
    await connection.shutdown();
  });

  it('marks unfinished tool calls cancelled', async () => {
    const events: Array<{ type: string; status?: string }> = [];
    const sequence: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'tool_call') {
          events.push(event);
          sequence.push(`tool:${event.status}`);
        }
        if (event.type === 'state') sequence.push(`state:${event.state}`);
      },
    });
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_STALL_AFTER_TOOL: '1' }),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec({ ACP_FIXTURE_STALL_AFTER_TOOL: '1' }),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    const prompt = manager.prompt(session.id, [{ type: 'text', text: 'stall' }]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await manager.cancelPrompt(session.id);
    await expect(prompt).resolves.toBeUndefined();
    expect(events).toContainEqual({
      type: 'tool_call',
      toolCallId: 'fixture-tool',
      status: 'cancelled',
      mode: 'replace',
    });
    expect(sequence.indexOf('tool:cancelled')).toBeGreaterThan(sequence.indexOf('tool:pending'));
    expect(sequence.indexOf('tool:cancelled')).toBeGreaterThan(sequence.indexOf('state:running'));
    await manager.shutdown();
  });

  it('does not overwrite a post-cancel completed tool call', async () => {
    const statuses: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'tool_call') statuses.push(event.status ?? '');
      },
    });
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec({
        ACP_FIXTURE_STALL_AFTER_TOOL: '1',
        ACP_FIXTURE_COMPLETE_TOOL_AFTER_CANCEL: '1',
      }),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec({
          ACP_FIXTURE_STALL_AFTER_TOOL: '1',
          ACP_FIXTURE_COMPLETE_TOOL_AFTER_CANCEL: '1',
        }),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    const prompt = manager.prompt(session.id, [{ type: 'text', text: 'stall' }]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await manager.cancelPrompt(session.id);
    await expect(prompt).resolves.toBeUndefined();
    expect(statuses).toContain('completed');
    expect(statuses).not.toContain('cancelled');
    await manager.shutdown();
  });

  it('surfaces a crashed agent without crashing the host', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_CRASH: '1' }),
      launcher,
    });
    await connection.connect();
    const session = await connection.newSession(cwd);
    await expect(
      connection.prompt(session.sessionId, [{ type: 'text', text: 'crash' }])
    ).rejects.toSatisfy((error: unknown) => error instanceof AcpError || error instanceof Error);
    expect(process.pid).toBeGreaterThan(0);
    await connection.shutdown();
  });

  it('rejects unsupported negotiated protocol versions before session creation', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_PROTOCOL_VERSION: '2' }),
      launcher,
    });
    await expect(connection.connect()).rejects.toMatchObject({
      code: 'protocol_version_unsupported',
    });
    expect(() => connection.capabilities).toThrow();
    await connection.shutdown();
  });

  it('supports multiple sessions on one connection without cross-talk', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const updates = new Map<string, string[]>();
    const manager = new AcpSessionManager({
      onEvent: (sessionId, event) => {
        const current = updates.get(sessionId) ?? [];
        current.push(event.type);
        updates.set(sessionId, current);
      },
    });
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec(),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const first = await manager.createSession({ agentId: 'fixture', cwd });
    const second = await manager.createSession({ agentId: 'fixture', cwd });
    await Promise.all([
      manager.prompt(first.id, [{ type: 'text', text: 'first' }]),
      manager.prompt(second.id, [{ type: 'text', text: 'second' }]),
    ]);
    expect(updates.get(first.id)?.length).toBeGreaterThan(1);
    expect(updates.get(second.id)?.length).toBeGreaterThan(1);
    await manager.shutdown();
  });

  it('routes same ACP session ids by agent', async () => {
    const messages = new Map<string, string[]>();
    const launcherA = new AgentLauncher();
    const launcherB = new AgentLauncher();
    launches.add(launcherA);
    launches.add(launcherB);
    const manager = new AcpSessionManager({
      onEvent: (sessionId, event) => {
        if (event.type !== 'message') return;
        const current = messages.get(sessionId) ?? [];
        current.push(event.messageId);
        messages.set(sessionId, current);
      },
    });
    manager.registerAgent({
      agentId: 'fixture-a',
      launchSpec: launchSpec({ ACP_FIXTURE_SESSION_ID: 'shared-acp-session' }),
      connection: new AgentConnection({
        agentId: 'fixture-a',
        launchSpec: launchSpec({ ACP_FIXTURE_SESSION_ID: 'shared-acp-session' }),
        launcher: launcherA,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    manager.registerAgent({
      agentId: 'fixture-b',
      launchSpec: launchSpec({ ACP_FIXTURE_SESSION_ID: 'shared-acp-session' }),
      connection: new AgentConnection({
        agentId: 'fixture-b',
        launchSpec: launchSpec({ ACP_FIXTURE_SESSION_ID: 'shared-acp-session' }),
        launcher: launcherB,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const first = await manager.createSession({ agentId: 'fixture-a', cwd });
    const second = await manager.createSession({ agentId: 'fixture-b', cwd });
    await Promise.all([
      manager.prompt(first.id, [{ type: 'text', text: 'first' }]),
      manager.prompt(second.id, [{ type: 'text', text: 'second' }]),
    ]);
    expect(messages.get(first.id)).toHaveLength(4);
    expect(messages.get(second.id)).toHaveLength(4);
    expect(messages.get(first.id)).not.toEqual(messages.get(second.id));
    await manager.shutdown();
  });
});
