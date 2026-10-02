import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileSyncMock, platformMock, homedirMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  platformMock: vi.fn(),
  homedirMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    platform: platformMock,
    homedir: homedirMock,
  };
});

import { getManifestPaths, install, uninstall } from '../../src/native/install-native-host.js';

const HOST_NAME = 'com.devmentorai.host';
const EXTENSION_ID = 'a'.repeat(32);

describe('native host installer', () => {
  let root: string;
  let wrapperDir: string;
  let localAppData: string;
  let originalLocalAppData: string | undefined;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'devmentorai-native-installer-'));
    wrapperDir = path.join(root, 'package', 'dist');
    localAppData = path.join(root, 'LocalAppData');
    fs.mkdirSync(wrapperDir, { recursive: true });
    originalLocalAppData = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = localAppData;
    platformMock.mockReturnValue('win32');
    homedirMock.mockReturnValue(root);
    execFileSyncMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocalAppData === undefined) {
      Reflect.deleteProperty(process.env, 'LOCALAPPDATA');
    } else {
      process.env.LOCALAPPDATA = originalLocalAppData;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('installs Windows manifests, wrappers, and registry entries, then uninstalls them', () => {
    const paths = getManifestPaths();
    install(EXTENSION_ID, wrapperDir);

    const manifestPaths = {
      chrome: path.join(paths.chrome, `${HOST_NAME}.json`),
      chromium: path.join(paths.chromium, `${HOST_NAME}.json`),
    };

    for (const manifestPath of Object.values(manifestPaths)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.allowed_origins).toContain(`chrome-extension://${EXTENSION_ID}/`);
      expect(manifest.path).toBe(path.join(wrapperDir, 'native-host.bat'));
    }

    const wrapper = fs.readFileSync(path.join(wrapperDir, 'native-host.bat'), 'utf-8');
    expect(wrapper).toContain(`"${process.execPath}"`);

    const registryKeys = {
      chrome: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
      chromium: `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`,
    };

    expect(execFileSyncMock).toHaveBeenNthCalledWith(
      1,
      'reg',
      ['add', registryKeys.chrome, '/ve', '/t', 'REG_SZ', '/d', manifestPaths.chrome, '/f'],
      { stdio: 'ignore' }
    );
    expect(execFileSyncMock).toHaveBeenNthCalledWith(
      2,
      'reg',
      ['add', registryKeys.chromium, '/ve', '/t', 'REG_SZ', '/d', manifestPaths.chromium, '/f'],
      { stdio: 'ignore' }
    );

    uninstall(wrapperDir);

    expect(execFileSyncMock).toHaveBeenCalledWith('reg', ['delete', registryKeys.chrome, '/f'], {
      stdio: 'ignore',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith('reg', ['delete', registryKeys.chromium, '/f'], {
      stdio: 'ignore',
    });
    expect(fs.existsSync(manifestPaths.chrome)).toBe(false);
    expect(fs.existsSync(manifestPaths.chromium)).toBe(false);
    expect(fs.existsSync(path.join(wrapperDir, 'native-host.bat'))).toBe(false);
    expect(fs.existsSync(path.join(wrapperDir, 'native-host.sh'))).toBe(false);
  });

  it('uses a shell wrapper and does not access the registry on Linux', () => {
    platformMock.mockReturnValue('linux');
    const paths = getManifestPaths();
    install(EXTENSION_ID, wrapperDir);

    const manifestPath = path.join(paths.chrome, `${HOST_NAME}.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.path).toBe(path.join(wrapperDir, 'native-host.sh'));
    expect(fs.readFileSync(manifest.path, 'utf-8')).toContain(`"${process.execPath}"`);
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });
});
