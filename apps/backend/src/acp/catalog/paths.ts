import os from 'node:os';
import path from 'node:path';

export function devmentorHome(): string {
  return path.join(os.homedir(), '.devmentorai');
}
