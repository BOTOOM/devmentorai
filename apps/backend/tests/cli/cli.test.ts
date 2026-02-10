import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const CLI_PATH = path.resolve(__dirname, '../../dist/cli.js');

describe('CLI entry point', () => {
  it('should show help with --help flag', () => {
    const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf-8' });
    expect(output).toContain('devmentorai-server');
    expect(output).toContain('start');
    expect(output).toContain('stop');
    expect(output).toContain('status');
    expect(output).toContain('logs');
    expect(output).toContain('doctor');
  });

  it('should show version with --version flag', () => {
    const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should exit with error on unknown command', () => {
    try {
      execSync(`node ${CLI_PATH} unknown-command 2>&1`, { encoding: 'utf-8' });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).not.toBe(0);
      expect(err.stdout || err.stderr).toContain('Unknown command');
    }
  });
});
