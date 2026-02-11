#!/usr/bin/env node
/**
 * Syncs backend version from package.json to hardcoded constant in start.ts
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

const startTsPath = join(__dirname, '../apps/backend/src/cli/start.ts');
let content = readFileSync(startTsPath, 'utf-8');

// Replace the BACKEND_VERSION constant
const updated = content.replace(
  /const BACKEND_VERSION = ['"][\d.]+['"];/,
  `const BACKEND_VERSION = '${version}';`
);

if (content === updated) {
  console.error('❌ Failed to update BACKEND_VERSION in start.ts');
  process.exit(1);
}

writeFileSync(startTsPath, updated, 'utf-8');
console.log(`✅ Updated start.ts BACKEND_VERSION to ${version}`);
