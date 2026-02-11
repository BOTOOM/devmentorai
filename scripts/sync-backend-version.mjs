#!/usr/bin/env node
/**
 * Syncs backend version from package.json to version.ts
 * This is the single source of truth that all modules import from
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

const versionFilePath = join(__dirname, '../apps/backend/src/version.ts');
let content = readFileSync(versionFilePath, 'utf-8');

// Replace the BACKEND_VERSION constant
const updated = content.replace(
  /export const BACKEND_VERSION = ['"][\d.]+['"];/,
  `export const BACKEND_VERSION = '${version}';`
);

if (content === updated) {
  console.error('❌ Failed to update BACKEND_VERSION in version.ts');
  process.exit(1);
}

writeFileSync(versionFilePath, updated, 'utf-8');
console.log(`✅ Updated version.ts BACKEND_VERSION to ${version}`);
