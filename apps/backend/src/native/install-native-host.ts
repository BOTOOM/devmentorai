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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST_NAME = 'com.devmentorai.host';

interface ManifestPaths {
  chrome: string;
  chromium: string;
}

function getManifestPaths(): ManifestPaths {
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
    case 'win32':
      // Windows uses registry, but we'll use the user-level manifest location
      const appData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local');
      return {
        chrome: path.join(appData, 'Google/Chrome/User Data/NativeMessagingHosts'),
        chromium: path.join(appData, 'Chromium/User Data/NativeMessagingHosts'),
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function createManifest(extensionId: string): object {
  // Get the path to the native host executable
  const hostPath = path.resolve(__dirname, 'host.js');
  
  // On Windows, we need a batch wrapper
  let executablePath: string;
  if (os.platform() === 'win32') {
    executablePath = path.resolve(__dirname, 'native-host.bat');
    // Create batch wrapper
    const batchContent = `@echo off\nnode "${hostPath}"\n`;
    fs.writeFileSync(executablePath, batchContent);
  } else {
    // On Unix, create a shell wrapper
    executablePath = path.resolve(__dirname, 'native-host.sh');
    const shellContent = `#!/bin/bash\nexec node "${hostPath}"\n`;
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

function install(extensionId: string): void {
  console.log(`Installing Native Messaging Host for extension: ${extensionId}`);

  const paths = getManifestPaths();
  const manifest = createManifest(extensionId);
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

  // Windows: Also register in registry
  if (os.platform() === 'win32') {
    console.log('\n⚠️  Windows: You may need to add a registry entry manually:');
    console.log(`   Key: HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`);
    console.log(`   Value: ${path.join(paths.chrome, `${HOST_NAME}.json`)}`);
  }

  console.log('\n✓ Installation complete!');
  console.log('\nTo use Native Messaging:');
  console.log('1. Reload the extension in chrome://extensions');
  console.log('2. Enable "Native Messaging" in DevMentorAI settings');
}

function uninstall(): void {
  console.log('Uninstalling Native Messaging Host...');

  const paths = getManifestPaths();

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
    const wrapperPath = path.resolve(__dirname, wrapper);
    if (fs.existsSync(wrapperPath)) {
      fs.unlinkSync(wrapperPath);
      console.log(`  ✓ Removed wrapper: ${wrapperPath}`);
    }
  }

  console.log('\n✓ Uninstallation complete!');
}

// Main
const args = process.argv.slice(2);

if (args.includes('--uninstall')) {
  uninstall();
} else if (args.length >= 1) {
  const extensionId = args[0];
  if (!/^[a-z]{32}$/i.test(extensionId)) {
    console.error('Error: Invalid extension ID format');
    console.error('Extension ID should be 32 lowercase letters (e.g., abcdefghijklmnopqrstuvwxyzabcdef)');
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
