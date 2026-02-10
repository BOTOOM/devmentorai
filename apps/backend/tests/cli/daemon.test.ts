import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Must use inline values in vi.mock factory (hoisted above variable declarations)
const TEST_BASE = path.join(os.tmpdir(), 'devmentorai-test-' + process.pid);

vi.mock('../../src/lib/paths.js', () => {
  const _path = require('node:path');
  const _os = require('node:os');
  const _fs = require('node:fs');
  const base = _path.join(_os.tmpdir(), 'devmentorai-test-' + process.pid);
  return {
    PID_FILE: _path.join(base, 'server.pid'),
    LOG_FILE: _path.join(base, 'logs', 'server.log'),
    LOG_DIR: _path.join(base, 'logs'),
    DATA_DIR: base,
    IMAGES_DIR: _path.join(base, 'images'),
    CONFIG_FILE: _path.join(base, 'config.json'),
    ensureDir: (dir: string) => {
      if (!_fs.existsSync(dir)) _fs.mkdirSync(dir, { recursive: true });
    },
  };
});

import {
  writePid,
  readPid,
  removePid,
  isProcessRunning,
  healthcheck,
  isServerRunning,
} from '../../src/lib/daemon.js';

describe('daemon utilities', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_BASE, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  });

  describe('PID management', () => {
    it('should write and read a PID file', () => {
      writePid(12345);
      expect(readPid()).toBe(12345);
    });

    it('should return null when PID file does not exist', () => {
      expect(readPid()).toBeNull();
    });

    it('should remove PID file', () => {
      writePid(12345);
      removePid();
      expect(readPid()).toBeNull();
    });

    it('should handle removing non-existent PID file', () => {
      expect(() => removePid()).not.toThrow();
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('should return false for non-existent PID', () => {
      expect(isProcessRunning(99999999)).toBe(false);
    });
  });

  describe('healthcheck', () => {
    it('should return ok: false when no server is running', async () => {
      const result = await healthcheck(19999, 1000);
      expect(result.ok).toBe(false);
    });
  });

  describe('isServerRunning', () => {
    it('should return not running when no PID file and no server', async () => {
      const result = await isServerRunning(19999);
      expect(result.running).toBe(false);
      expect(result.pid).toBeNull();
    });

    it('should clean up stale PID file when process is dead', async () => {
      writePid(99999999); // Non-existent PID
      const result = await isServerRunning(19999);
      expect(result.running).toBe(false);
      expect(readPid()).toBeNull(); // PID file should be cleaned up
    });
  });
});
