import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const extensionOutputDir = path.join(repoRoot, 'apps/extension/.output/chrome-mv3');
const extensionManifestPath = path.join(extensionOutputDir, 'manifest.json');
const extensionLocalesDir = path.join(extensionOutputDir, '_locales');

const hasDisplayServer =
  process.platform !== 'linux' || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

const runPnpm = (args) => {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    cwd: repoRoot,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
};

const hasBuiltExtension =
  existsSync(extensionOutputDir) &&
  existsSync(extensionManifestPath) &&
  existsSync(extensionLocalesDir);

if (!hasDisplayServer) {
  console.log(
    '[e2e] Skipping Playwright extension tests: no display server available for headed Chromium extension runs.'
  );
  process.exit(0);
}

const executablePath = chromium.executablePath();

if (!existsSync(executablePath)) {
  console.log(
    '[e2e] Skipping Playwright extension tests: Chromium is not installed for Playwright.'
  );
  console.log(
    '[e2e] Install it with: pnpm --filter @devmentorai/e2e exec playwright install chromium'
  );
  process.exit(0);
}

if (!hasBuiltExtension) {
  console.log(
    '[e2e] Extension build output is missing or incomplete. Rebuilding @devmentorai/extension...'
  );
  const buildStatus = runPnpm(['--filter', '@devmentorai/extension', 'build']);

  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }
}

const result = runPnpm(['--filter', '@devmentorai/e2e', 'exec', 'playwright', 'test']);

process.exit(result);
