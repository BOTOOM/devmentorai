#!/usr/bin/env node
/**
 * Native Messaging Host Installation Script
 *
 * This script installs the Native Messaging host manifest in the appropriate
 * location for Chrome/Chromium browsers on different operating systems.
 *
 * Usage:
 *   node install-native-host.js <extension-id>
 *   node install-native-host.js <extension-id> --uninstall
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST_NAME = 'com.devmentorai.host';

interface ManifestPaths {
  chrome: string;
  chromium: string;
}

export function getManifestPaths(): ManifestPaths {
  const platform = os.platform();
  const home = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return {
        chrome: path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
        chromium: path.join(home, 'Library/Application Support/Chromium/NativeMessagingHosts'),
      };
    case 'linux':
      return {
        chrome: path.join(home, '.config/google-chrome/NativeMessagingHosts'),
        chromium: path.join(home, '.config/chromium/NativeMessagingHosts'),
      };
    case 'win32': {
      // Windows uses registry, but we'll use the user-level manifest location
      const appData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local');
      return {
        chrome: path.join(appData, 'Google/Chrome/User Data/NativeMessagingHosts'),
        chromium: path.join(appData, 'Chromium/User Data/NativeMessagingHosts'),
      };
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function createManifest(extensionId: string, wrapperDir = __dirname): object {
  // Get the path to the native host executable
  const hostPath = path.resolve(wrapperDir, 'host.js');

  // On Windows, we need a batch wrapper
  let executablePath: string;
  if (os.platform() === 'win32') {
    executablePath = path.resolve(wrapperDir, 'native-host.bat');
    // Create batch wrapper
    const batchContent = `@echo off\r\n"${process.execPath}" "${hostPath}" %*\r\n`;
    fs.writeFileSync(executablePath, batchContent);
  } else {
    // On Unix, create a shell wrapper
    executablePath = path.resolve(wrapperDir, 'native-host.sh');
    const shellContent = `#!/bin/sh\nexec "${process.execPath}" "${hostPath}" "$@"\n`;
    fs.writeFileSync(executablePath, shellContent, { mode: 0o755 });
  }

  return {
    name: HOST_NAME,
    description: 'DevMentorAI Native Messaging Host',
    path: executablePath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function install(extensionId: string, wrapperDir = __dirname): void {
  console.log(`Installing Native Messaging Host for extension: ${extensionId}`);

  const paths = getManifestPaths();
  const manifest = createManifest(extensionId, wrapperDir);
  const manifestJson = JSON.stringify(manifest, null, 2);

  // Install for both Chrome and Chromium
  for (const [browser, manifestDir] of Object.entries(paths)) {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
        console.log(`  Created directory: ${manifestDir}`);
      }

      const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);
      fs.writeFileSync(manifestPath, manifestJson);
      console.log(`  ✓ Installed for ${browser}: ${manifestPath}`);
    } catch (error) {
      console.error(`  ✗ Failed to install for ${browser}: ${error}`);
    }
  }

  if (os.platform() === 'win32') {
    const registryKeys = {
      chrome: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
      chromium: `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`,
    };

    for (const browser of ['chrome', 'chromium'] as const) {
      const manifestPath = path.join(paths[browser], `${HOST_NAME}.json`);
      try {
        execFileSync(
          'reg',
          ['add', registryKeys[browser], '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'],
          { stdio: 'ignore' }
        );
        console.log(`  ✓ Registered for ${browser}: ${manifestPath}`);
      } catch (error) {
        console.error(`  ✗ Failed to register ${browser}: ${error}`);
      }
    }
  }

  console.log('\n✓ Installation complete!');
  console.log('\nTo use Native Messaging:');
  console.log('1. Reload the extension in chrome://extensions');
  console.log('2. Enable "Native Messaging" in DevMentorAI settings');
}

export function uninstall(wrapperDir = __dirname): void {
  console.log('Uninstalling Native Messaging Host...');

  const paths = getManifestPaths();

  if (os.platform() === 'win32') {
    const registryKeys = {
      chrome: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
      chromium: `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`,
    };

    for (const browser of ['chrome', 'chromium'] as const) {
      try {
        execFileSync('reg', ['delete', registryKeys[browser], '/f'], { stdio: 'ignore' });
        console.log(`  ✓ Unregistered for ${browser}`);
      } catch {
        console.log(`  - Not registered for ${browser}`);
      }
    }
  }

  for (const [browser, manifestDir] of Object.entries(paths)) {
    const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);
    try {
      if (fs.existsSync(manifestPath)) {
        fs.unlinkSync(manifestPath);
        console.log(`  ✓ Removed for ${browser}: ${manifestPath}`);
      } else {
        console.log(`  - Not installed for ${browser}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to remove for ${browser}: ${error}`);
    }
  }

  // Remove wrapper scripts
  const wrappers = ['native-host.sh', 'native-host.bat'];
  for (const wrapper of wrappers) {
    const wrapperPath = path.resolve(wrapperDir, wrapper);
    if (fs.existsSync(wrapperPath)) {
      fs.unlinkSync(wrapperPath);
      console.log(`  ✓ Removed wrapper: ${wrapperPath}`);
    }
  }

  console.log('\n✓ Uninstallation complete!');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);

  if (args.includes('--uninstall')) {
    uninstall();
  } else if (args.length >= 1) {
    const extensionId = args[0];
    if (!/^[a-z]{32}$/i.test(extensionId)) {
      console.error('Error: Invalid extension ID format');
      console.error(
        'Extension ID should be 32 lowercase letters (e.g., abcdefghijklmnopqrstuvwxyzabcdef)'
      );
      process.exit(1);
    }
    install(extensionId);
  } else {
    console.log('DevMentorAI Native Messaging Host Installer');
    console.log('');
    console.log('Usage:');
    console.log('  Install:   node install-native-host.js <extension-id>');
    console.log('  Uninstall: node install-native-host.js --uninstall');
    console.log('');
    console.log('To find your extension ID:');
    console.log('1. Go to chrome://extensions');
    console.log('2. Enable Developer mode');
    console.log('3. Copy the ID from the DevMentorAI extension card');
    process.exit(1);
  }
}
