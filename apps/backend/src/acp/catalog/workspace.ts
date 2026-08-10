import fs from 'node:fs/promises';
import path from 'node:path';

export type WorkspaceOptions = {
  root: string;
  defaultCwd?: string;
};

export class WorkspaceService {
  readonly root: string;
  readonly defaultCwd: string;

  constructor(options: WorkspaceOptions) {
    this.root = path.resolve(options.root);
    const requested = options.defaultCwd ?? this.root;
    this.defaultCwd = path.isAbsolute(requested)
      ? path.resolve(requested)
      : path.resolve(this.root, requested);
    this.assertInsideRoot(this.defaultCwd);
  }

  async resolve(cwd?: string): Promise<string> {
    const requested = cwd ?? this.defaultCwd;
    if (!path.isAbsolute(requested)) throw new Error('Workspace cwd must be absolute');
    const resolved = path.resolve(requested);
    this.assertInsideRoot(resolved);
    await fs.mkdir(resolved, { recursive: true });
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) throw new Error(`Workspace is not a directory: ${resolved}`);
    return resolved;
  }

  private assertInsideRoot(candidate: string): void {
    const relative = path.relative(this.root, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Workspace escapes configured root: ${candidate}`);
    }
  }
}
