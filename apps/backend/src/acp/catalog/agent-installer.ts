import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AcpError } from '../errors.js';
import type { AgentCatalogEntry, BinaryDistribution } from './types.js';

export type InstallerOptions = {
  root?: string;
  fetcher?: (url: string) => Promise<Uint8Array>;
  onProgress?: (event: { phase: string; completed?: number; total?: number }) => void;
};

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Extractor exited ${code}`))
    );
  });
}

export class AgentInstaller {
  private readonly root: string;
  private readonly fetcher: (url: string) => Promise<Uint8Array>;
  private readonly onProgress?: InstallerOptions['onProgress'];

  constructor(options: InstallerOptions = {}) {
    this.root =
      options.root ?? path.join(process.env.HOME ?? process.cwd(), '.devmentorai', 'agents');
    this.fetcher =
      options.fetcher ??
      (async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Agent download failed with status ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      });
    this.onProgress = options.onProgress;
  }

  installPath(entry: AgentCatalogEntry): string {
    return path.join(this.root, safePathPart(entry.id), safePathPart(entry.version ?? 'unknown'));
  }

  async install(entry: AgentCatalogEntry): Promise<string> {
    const binary = this.selectBinary(entry);
    const target = this.installPath(entry);
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rm(temporary, { recursive: true, force: true });
    try {
      this.onProgress?.({ phase: 'download' });
      const bytes = await this.fetcher(binary.archive);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (binary.sha256 && digest.toLowerCase() !== binary.sha256.toLowerCase()) {
        throw new AcpError('agent_launch_failed', `Checksum mismatch for agent ${entry.id}`, {
          expected: binary.sha256,
          actual: digest,
        });
      }
      await fs.mkdir(temporary, { recursive: true });
      const archive = path.join(temporary, 'archive');
      await fs.writeFile(archive, bytes, { mode: 0o600 });
      this.onProgress?.({ phase: 'extract' });
      if (binary.archive.endsWith('.zip')) {
        await run('unzip', ['-q', archive, '-d', temporary], temporary);
      } else {
        await run('tar', ['-xf', archive, '-C', temporary], temporary);
      }
      await fs.rm(target, { recursive: true, force: true });
      await fs.rename(temporary, target);
      this.onProgress?.({ phase: 'complete' });
      return target;
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true });
      throw error instanceof AcpError
        ? error
        : new AcpError('agent_launch_failed', `Unable to install agent ${entry.id}`, {
            cause: error instanceof Error ? error.message : String(error),
          });
    }
  }

  async uninstall(entry: AgentCatalogEntry): Promise<void> {
    await fs.rm(this.installPath(entry), { recursive: true, force: true });
  }

  private selectBinary(entry: AgentCatalogEntry): BinaryDistribution {
    const binary = entry.distribution.binary?.[entry.platformAvailability.key];
    if (!binary) {
      throw new AcpError(
        'capability_unsupported',
        entry.platformAvailability.reason ?? 'Agent is unavailable on this platform'
      );
    }
    return binary;
  }
}

function safePathPart(value: string): string {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new AcpError('agent_launch_failed', 'Invalid agent installation path');
  }
  return value;
}
