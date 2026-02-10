/**
 * Daemon management utilities
 *
 * Handles PID file, process spawning, and healthcheck for the background server.
 */

import { fork, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { PID_FILE, LOG_FILE, LOG_DIR, ensureDir } from './paths.js';
import { DEFAULT_CONFIG } from '@devmentorai/shared';

const DEFAULT_PORT = DEFAULT_CONFIG.DEFAULT_PORT;

/** Write PID to file */
export function writePid(pid: number): void {
  fs.writeFileSync(PID_FILE, String(pid), 'utf-8');
}

/** Read PID from file, returns null if not found */
export function readPid(): number | null {
  try {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/** Remove PID file */
export function removePid(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

/** Check if a process with the given PID is running */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** HTTP healthcheck against the running server */
export function healthcheck(port: number = DEFAULT_PORT, timeoutMs: number = 3000): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
}> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ ok: res.statusCode === 200, data });
        } catch {
          resolve({ ok: false });
        }
      });
    });

    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

/** Check if the server is already running (PID + healthcheck) */
export async function isServerRunning(port: number = DEFAULT_PORT): Promise<{
  running: boolean;
  pid: number | null;
  healthy: boolean;
}> {
  const pid = readPid();

  if (pid && isProcessRunning(pid)) {
    const { ok } = await healthcheck(port);
    return { running: true, pid, healthy: ok };
  }

  // PID file exists but process is dead — clean up stale PID
  if (pid) {
    removePid();
  }

  // Maybe the server is running without our PID file (unlikely but check)
  const { ok } = await healthcheck(port);
  return { running: ok, pid: null, healthy: ok };
}

/** Spawn the server as a detached background process */
export function spawnServer(port: number = DEFAULT_PORT): ChildProcess {
  ensureDir(LOG_DIR);

  const logFd = fs.openSync(LOG_FILE, 'a');
  const serverEntry = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'server.js');

  const child = fork(serverEntry, [], {
    detached: true,
    stdio: ['ignore', logFd, logFd, 'ipc'],
    env: {
      ...process.env,
      DEVMENTORAI_PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  // Write PID file
  if (child.pid) {
    writePid(child.pid);
  }

  // Disconnect IPC so parent can exit
  child.unref();
  child.disconnect();

  fs.closeSync(logFd);

  return child;
}

/** Wait for the server to become healthy */
export async function waitForHealthy(port: number = DEFAULT_PORT, maxWaitMs: number = 10000): Promise<boolean> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < maxWaitMs) {
    const { ok } = await healthcheck(port);
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/** Gracefully stop the server process */
export async function stopServer(): Promise<boolean> {
  const pid = readPid();
  if (!pid) return false;

  if (!isProcessRunning(pid)) {
    removePid();
    return false;
  }

  // Send SIGTERM for graceful shutdown
  process.kill(pid, 'SIGTERM');

  // Wait for process to exit
  const maxWait = 5000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (!isProcessRunning(pid)) {
      removePid();
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Force kill if still running
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process might have exited between check and kill
  }
  removePid();
  return true;
}
