import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import net from 'node:net';
import { Readable, Writable } from 'node:stream';
import type { AcpErrorPayload } from '@devmentorai/shared';
import { AcpError } from './errors.js';

export type LaunchSpec = {
  cmd: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  cwd: string;
  transport?: 'stdio' | 'tcp';
  host?: string;
  port?: number;
};

export type ProcessExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
};

const DEFAULT_STDERR_LIMIT = 16 * 1024;

class RingBuffer {
  private value = '';

  constructor(private readonly limit: number) {}

  append(chunk: Buffer | string): void {
    this.value += chunk.toString();
    if (this.value.length > this.limit) {
      this.value = this.value.slice(-this.limit);
    }
  }

  toString(): string {
    return this.value;
  }
}

export class AgentProcess {
  readonly stdin: WritableStream<Uint8Array>;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly exited: Promise<ProcessExit>;
  readonly pid: number | undefined;
  private readonly child?: ChildProcessWithoutNullStreams;
  private readonly socket?: net.Socket;
  private readonly stderrBuffer: RingBuffer;
  private exitResult: ProcessExit | undefined;

  constructor(
    process: ChildProcessWithoutNullStreams | net.Socket,
    stderrLimit = DEFAULT_STDERR_LIMIT
  ) {
    this.child = process instanceof net.Socket ? undefined : process;
    this.socket = process instanceof net.Socket ? process : undefined;
    this.pid = this.child?.pid;
    this.stderrBuffer = new RingBuffer(stderrLimit);
    if (this.child)
      this.child.stderr.on('data', (chunk: Buffer) => this.stderrBuffer.append(chunk));
    this.exited = new Promise((resolve) => {
      const finish = (code: number | null, signal: NodeJS.Signals | null) => {
        this.exitResult = {
          code,
          signal,
          stderr: this.stderrBuffer.toString(),
        };
        resolve(this.exitResult);
      };
      this.child?.once('exit', finish);
      this.socket?.once('close', () => finish(0, null));
      this.child?.once('error', (error) => {
        this.exitResult = {
          code: null,
          signal: null,
          stderr: `${this.stderrBuffer.toString()}${error.message}`,
        };
        resolve(this.exitResult);
      });
      this.socket?.once('error', (error) => {
        this.exitResult = {
          code: null,
          signal: null,
          stderr: `${this.stderrBuffer.toString()}${error.message}`,
        };
        resolve(this.exitResult);
      });
    });
    const writable = this.child?.stdin ?? this.socket;
    const readable = this.child?.stdout ?? this.socket;
    if (!writable || !readable) throw new Error('Agent process has no transport streams');
    this.stdin = Writable.toWeb(writable) as WritableStream<Uint8Array>;
    this.stdout = Readable.toWeb(readable) as ReadableStream<Uint8Array>;
  }

  get exitedAlready(): ProcessExit | undefined {
    return this.exitResult;
  }

  get stderr(): string {
    return this.stderrBuffer.toString();
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.child && !this.child.killed && this.child.exitCode === null) this.child.kill(signal);
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
  }

  async shutdown(timeoutMs = 1_000): Promise<ProcessExit | undefined> {
    if (this.exitResult) return this.exitResult;
    this.kill('SIGTERM');
    const timeout = new Promise<undefined>((resolve) => {
      setTimeout(() => {
        if (!this.exitResult) this.kill('SIGKILL');
        resolve(undefined);
      }, timeoutMs).unref();
    });
    const result = await Promise.race([this.exited, timeout]);
    if (result) return result;
    this.kill('SIGKILL');
    return this.exited;
  }
}

export class AgentLauncher {
  private readonly processes = new Set<AgentProcess>();

  launch(spec: LaunchSpec, stderrLimit = DEFAULT_STDERR_LIMIT): AgentProcess {
    if (spec.transport === 'tcp') {
      const host = spec.host;
      const port = spec.port;
      if (
        !host ||
        typeof port !== 'number' ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        (!net.isIP(host) && !/^[a-zA-Z0-9.-]+$/.test(host))
      ) {
        throw new AcpError('agent_launch_failed', 'TCP profile has an invalid host or port');
      }
      const socket = net.createConnection({ host, port });
      return this.track(new AgentProcess(socket, stderrLimit));
    }
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(spec.cmd, spec.args ?? [], {
        cwd: spec.cwd,
        env: {
          ...process.env,
          ...spec.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new AcpError('agent_launch_failed', `Failed to launch ${spec.cmd}`, {
        cause: error instanceof Error ? error.message : String(error),
        command: spec.cmd,
      });
    }

    return this.track(new AgentProcess(child, stderrLimit));
  }

  private track(agentProcess: AgentProcess): AgentProcess {
    this.processes.add(agentProcess);
    void agentProcess.exited.finally(() => this.processes.delete(agentProcess));
    return agentProcess;
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.processes].map((process) => process.shutdown()));
  }

  get activeCount(): number {
    return this.processes.size;
  }
}

export function launchErrorPayload(error: AcpError): AcpErrorPayload {
  return error.toPayload();
}
