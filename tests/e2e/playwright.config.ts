import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const extensionPath = path.join(__dirname, '../../apps/extension/.output/chrome-mv3');

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Extension tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Load the extension
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox',
          ],
        },
      },
    },
  ],
  // Run backend before tests
  webServer: {
    command: 'pnpm --filter @devmentorai/backend dev',
    url: 'http://localhost:3847/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
