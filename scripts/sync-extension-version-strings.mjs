#!/usr/bin/env node
/**
 * Syncs extension version from package.json to version.ts
 * This is the single source of truth that all components import from
 * 
 * Used by semantic-release during prepare step
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const version = process.argv[2];
if (!version) {
  console.error('❌ Version argument required');
  process.exit(1);
}

const versionFilePath = join(__dirname, '../apps/extension/src/version.ts');
let content = readFileSync(versionFilePath, 'utf-8');

// Replace the EXTENSION_VERSION constant
const updated = content.replace(
  /export const EXTENSION_VERSION = ['"][\d.]+['"];/,
  `export const EXTENSION_VERSION = '${version}';`
);

if (content === updated) {
  console.error('❌ Failed to update EXTENSION_VERSION in version.ts');
  process.exit(1);
}

writeFileSync(versionFilePath, updated, 'utf-8');
console.log(`✅ Updated version.ts EXTENSION_VERSION to ${version}`);
