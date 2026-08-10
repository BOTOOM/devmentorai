import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import type { AcpErrorPayload } from '@devmentorai/shared';
import { AcpError } from './errors.js';

export type LaunchSpec = {
  cmd: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  cwd: string;
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
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly stderrBuffer: RingBuffer;
  private exitResult: ProcessExit | undefined;

  constructor(child: ChildProcessWithoutNullStreams, stderrLimit = DEFAULT_STDERR_LIMIT) {
    this.child = child;
    this.pid = child.pid;
    this.stderrBuffer = new RingBuffer(stderrLimit);
    child.stderr.on('data', (chunk: Buffer) => this.stderrBuffer.append(chunk));
    this.exited = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        this.exitResult = {
          code,
          signal,
          stderr: this.stderrBuffer.toString(),
        };
        resolve(this.exitResult);
      });
      child.once('error', (error) => {
        this.exitResult = {
          code: null,
          signal: null,
          stderr: `${this.stderrBuffer.toString()}${error.message}`,
        };
        resolve(this.exitResult);
      });
    });
    this.stdin = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
    this.stdout = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
  }

  get exitedAlready(): ProcessExit | undefined {
    return this.exitResult;
  }

  get stderr(): string {
    return this.stderrBuffer.toString();
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (!this.child.killed && this.child.exitCode === null) {
      this.child.kill(signal);
    }
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

    const agentProcess = new AgentProcess(child, stderrLimit);
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
