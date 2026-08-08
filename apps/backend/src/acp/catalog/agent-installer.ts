import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AcpError } from '../errors.js';
import { devmentorHome } from './paths.js';
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

function runCapture(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve(output) : reject(new Error(`Extractor exited ${code}`))
    );
  });
}

function validateArchiveEntries(entries: string[]): void {
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/');
    if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
      throw new AcpError(
        'agent_launch_failed',
        'Archive contains a path outside the install directory',
        {
          entry,
        }
      );
    }
  }
}

export class AgentInstaller {
  private readonly root: string;
  private readonly fetcher: (url: string) => Promise<Uint8Array>;
  private readonly onProgress?: InstallerOptions['onProgress'];

  constructor(options: InstallerOptions = {}) {
    this.root = options.root ?? path.join(devmentorHome(), 'agents');
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

  async isInstalled(entry: AgentCatalogEntry): Promise<boolean> {
    try {
      const binary = this.selectBinary(entry);
      const target = this.installPath(entry);
      const command = path.resolve(target, binary.cmd);
      if (!isWithin(target, command)) return false;
      const stat = await fs.stat(command);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async install(entry: AgentCatalogEntry): Promise<string> {
    const binary = this.selectBinary(entry);
    const target = this.installPath(entry);
    const extractor = binary.archive.endsWith('.zip') ? 'unzip' : 'tar';
    if (await this.isInstalled(entry)) return target;
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
      const isZip = extractor === 'unzip';
      const listed = isZip
        ? await runCapture(extractor, ['-Z1', archive], temporary)
        : await runCapture(extractor, ['-tf', archive], temporary);
      validateArchiveEntries(listed.split(/\r?\n/).filter(Boolean));
      if (isZip) {
        await run(extractor, ['-q', archive, '-d', temporary], temporary);
      } else {
        await run(extractor, ['--no-absolute-names', '-xf', archive, '-C', temporary], temporary);
      }
      const command = path.resolve(temporary, binary.cmd);
      if (!isWithin(temporary, command)) {
        throw new AcpError('agent_launch_failed', 'Agent command escapes the install directory');
      }
      const commandStat = await fs.stat(command);
      if (!commandStat.isFile()) {
        throw new AcpError('agent_launch_failed', 'Installed agent command was not found');
      }
      await fs.rm(target, { recursive: true, force: true });
      await fs.rename(temporary, target);
      this.onProgress?.({ phase: 'complete' });
      return target;
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true });
      if (isMissingCommand(error)) {
        throw new AcpError(
          'agent_launch_failed',
          `Required archive extractor '${extractor}' is not installed; install it and retry`
        );
      }
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

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isMissingCommand(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function safePathPart(value: string): string {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new AcpError('agent_launch_failed', 'Invalid agent installation path');
  }
  return value;
}
