#!/usr/bin/env node
/**
 * Syncs the version from semantic-release into wxt.config.ts
 * Usage: node sync-extension-version.mjs <version>
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version) {
  console.error('Usage: node sync-extension-version.mjs <version>');
  process.exit(1);
}

const wxtConfigPath = resolve(__dirname, '../apps/extension/wxt.config.ts');
let content = readFileSync(wxtConfigPath, 'utf-8');

// Replace version in manifest
content = content.replace(
  /version:\s*['"][^'"]+['"]/,
  `version: '${version}'`
);

writeFileSync(wxtConfigPath, content, 'utf-8');
console.log(`✅ Updated wxt.config.ts version to ${version}`);
