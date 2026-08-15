import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('supports TCP turns, peer death, and clean shutdown', async () => {
    let child: ChildProcessWithoutNullStreams | undefined;
    const server = net.createServer((socket) => {
      child = spawn(tsx, [fixture], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.pipe(socket);
      socket.pipe(child.stdin);
      child.once('exit', () => socket.destroy());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TCP fixture did not bind');
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const crashes: string[] = [];
    const connection = new AgentConnection({
      agentId: 'tcp-fixture',
      launchSpec: {
        cmd: tsx,
        args: [],
        cwd,
        transport: 'tcp',
        host: '127.0.0.1',
        port: address.port,
      },
      launcher,
      onAgentCrash: async (error) => crashes.push(error.code),
    });
    await connection.connect();
    const session = await connection.newSession(cwd);
    await connection.prompt(session.sessionId, [{ type: 'text', text: 'hello' }]);
    expect(connection.capabilities.protocolVersion).toBe(1);
    child?.kill('SIGKILL');
    await vi.waitFor(() => expect(crashes).toContain('agent_crashed'), { timeout: 5_000 });
    await connection.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(server.listening).toBe(false);
  }, 20_000);

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

  it('streams a quick-action prompt through ACP (R-050)', async () => {
    const messages: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'message' && event.role === 'assistant') {
          messages.push(
            event.content
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('')
          );
        }
      },
    });
    manager.registerAgent({
      agentId: 'quick-action-fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'quick-action-fixture',
        launchSpec: launchSpec(),
        launcher,
      }),
    });
    const session = await manager.createSession({ agentId: 'quick-action-fixture', cwd });
    await manager.prompt(session.id, [{ type: 'text', text: 'Explain this selected text: hello' }]);
    expect(messages.join('')).toContain('fixture');
    await manager.shutdown();
  });

  it('preserves a resource context block through an ACP prompt (R-052)', async () => {
    const events: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => events.push(event.type),
    });
    manager.registerAgent({
      agentId: 'context-fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'context-fixture',
        launchSpec: launchSpec(),
        launcher,
      }),
    });
    const session = await manager.createSession({ agentId: 'context-fixture', cwd });
    await manager.prompt(session.id, [
      { type: 'text', text: 'Help with this page' },
      {
        type: 'resource',
        resource: {
          uri: 'devmentorai://context/test',
          mimeType: 'text/plain',
          text: '{"page":{"title":"Fixture page"}}',
        },
      },
    ]);
    expect(events).toContain('message');
    expect(
      manager.getSession(session.id)?.capabilities.agentCapabilities.promptCapabilities
    ).toMatchObject({ embeddedContext: true });
    await manager.shutdown();
  });

  it('replays an existing session through ACP history and can replay twice', async () => {
    const events: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'message') events.push(event.messageId);
      },
    });
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_LOAD_SESSION: '1' }),
      launcher,
      permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
    });
    const loadSession = vi.spyOn(connection, 'loadSession');
    manager.registerAgent({ agentId: 'fixture', launchSpec: launchSpec(), connection });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    await expect(manager.loadSession(session.id)).resolves.toEqual({ supported: false });
    expect(loadSession).not.toHaveBeenCalled();
    await manager.shutdown();

    const replayLauncher = new AgentLauncher();
    launches.add(replayLauncher);
    const replayManager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        if (event.type === 'message') events.push(event.messageId);
      },
    });
    const replayConnection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec({
        ACP_FIXTURE_LOAD_SESSION: '1',
        ACP_FIXTURE_CAPABILITIES: JSON.stringify({ loadSession: true }),
      }),
      launcher: replayLauncher,
    });
    replayManager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      connection: replayConnection,
    });
    const replaySession = await replayManager.createSession({ agentId: 'fixture', cwd });
    await expect(replayManager.loadSession(replaySession.id)).resolves.toEqual({ supported: true });
    await expect(replayManager.loadSession(replaySession.id)).resolves.toEqual({ supported: true });
    expect(events.filter((id) => id === 'replay-assistant')).toHaveLength(2);
    await replayManager.shutdown();
  });

  it('continues updates when the event consumer rejects', async () => {
    const seen: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) => {
        seen.push(event.type);
        if (event.type === 'tool_call') {
          throw new Error('consumer failed');
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
    await expect(
      manager.prompt(session.id, [{ type: 'text', text: 'hello' }])
    ).resolves.toBeUndefined();
    expect(seen).toContain('plan');
    expect(seen).toContain('state');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
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

  it('emits idle and clears unfinished tools when a turn fails', async () => {
    const events: string[] = [];
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager({
      onEvent: (_sessionId, event) =>
        events.push(event.type === 'state' ? event.state : event.type),
    });
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec({ ACP_FIXTURE_CRASH: '1' }),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec({ ACP_FIXTURE_CRASH: '1' }),
        launcher,
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    await expect(manager.prompt(session.id, [{ type: 'text', text: 'crash' }])).rejects.toThrow();
    expect(events).toEqual(expect.arrayContaining(['running', 'error', 'idle']));
    await manager.shutdown();
  });

  it('does not reactivate a completed tool from a partial update', async () => {
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
      launchSpec: launchSpec({ ACP_FIXTURE_PARTIAL_AFTER_COMPLETE: '1' }),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec({ ACP_FIXTURE_PARTIAL_AFTER_COMPLETE: '1' }),
        launcher,
        permissionPolicy: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }),
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    const prompt = manager.prompt(session.id, [{ type: 'text', text: 'partial' }]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await manager.cancelPrompt(session.id);
    await expect(prompt).resolves.toBeUndefined();
    expect(statuses).toContain('completed');
    expect(statuses).not.toContain('cancelled');
    await manager.shutdown();
  });

  it('retains local session state when the agent rejects close', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const manager = new AcpSessionManager();
    manager.registerAgent({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      connection: new AgentConnection({
        agentId: 'fixture',
        launchSpec: launchSpec(),
        launcher,
      }),
    });
    const session = await manager.createSession({ agentId: 'fixture', cwd });
    await expect(manager.closeSession(session.id)).rejects.toMatchObject({
      code: 'capability_unsupported',
    });
    expect(manager.getSession(session.id)).toBeDefined();
    await manager.shutdown();
  });

  it('deduplicates concurrent connection handshakes', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'fixture',
      launchSpec: launchSpec(),
      launcher,
    });
    const capabilities = await Promise.all([connection.connect(), connection.connect()]);
    expect(capabilities[0]).toEqual(capabilities[1]);
    expect(launcher.activeCount).toBe(1);
    await connection.shutdown();
  });

  it('rejects a missing agent command instead of hanging during handshake', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'missing',
      launchSpec: { cmd: '/definitely/missing/devmentorai-agent', cwd },
      launcher,
    });
    await expect(connection.connect()).rejects.toMatchObject({ code: 'agent_launch_failed' });
    await connection.shutdown();
  });

  it('times out instead of hanging when the agent never answers initialize', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'silent',
      launchSpec: {
        cmd: process.execPath,
        args: ['-e', 'process.stdin.resume(); setInterval(() => {}, 1000);'],
        cwd,
      },
      launcher,
      handshakeTimeoutMs: 100,
    });
    await expect(connection.connect()).rejects.toMatchObject({
      code: 'agent_launch_failed',
      message: 'ACP initialization timed out',
    });
    await connection.shutdown();
  });

  it('fails the handshake when the agent exits before initializing', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const connection = new AgentConnection({
      agentId: 'exits-early',
      launchSpec: { cmd: process.execPath, args: ['-e', 'process.exit(3)'], cwd },
      launcher,
    });
    await expect(connection.connect()).rejects.toMatchObject({ code: 'agent_launch_failed' });
    await connection.shutdown();
  });

  it('waits for a child to exit after escalating shutdown', async () => {
    const launcher = new AgentLauncher();
    launches.add(launcher);
    const agentProcess = launcher.launch({
      cmd: process.execPath,
      args: ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"],
      cwd,
    });
    const exit = await agentProcess.shutdown(10);
    expect(exit).toBeDefined();
    expect(agentProcess.exitedAlready).toEqual(exit);
    await launcher.shutdown();
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
