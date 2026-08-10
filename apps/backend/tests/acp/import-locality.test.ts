import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ACP SDK import locality', () => {
  it('keeps ACP SDK imports within the ACP source tree', () => {
    const sourceRoot = path.resolve('src');
    const acpRoot = path.resolve('src/acp');
    const files: string[] = [];

    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (file.endsWith('.ts')) files.push(file);
      }
    };
    visit(sourceRoot);

    const importsSdk = (file: string): boolean =>
      fs.readFileSync(file, 'utf8').includes('@agentclientprotocol/sdk');
    const violations = files.filter((file) => importsSdk(file) && !file.startsWith(acpRoot));
    expect(violations).toEqual([]);
  });
});
