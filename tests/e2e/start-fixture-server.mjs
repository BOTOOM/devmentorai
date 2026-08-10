import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';

const extensionPath = path.resolve('../../apps/extension/.output/chrome-mv3');
const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
  ],
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
const extensionOrigin = new URL(worker.url()).origin;
await context.close();

const server = spawn('pnpm', ['--filter', 'devmentorai-server', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOME: path.resolve('.e2e-home'),
    ACP_FIXTURE_EXTENSION_ORIGIN: extensionOrigin,
  },
});

const shutdown = (signal) => {
  server.kill(signal);
  void context.close();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
