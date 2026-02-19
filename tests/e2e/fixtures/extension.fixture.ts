import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '../../../apps/extension/.output/chrome-mv3');

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  sidePanelPage: Page;
  optionsPage: Page;
}

export const test = base.extend<ExtensionFixtures>({
  // Override context to load extension
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      locale: 'en-US',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--lang=en-US',
        '--no-sandbox',
      ],
    });
    
    await use(context);
    await context.close();
  },

  // Get extension ID
  extensionId: async ({ context }, use) => {
    // Wait for service worker to be registered
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },

  // Get side panel page
  sidePanelPage: async ({ context, extensionId }, use) => {
    // Open side panel directly via extension URL
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    const page = await context.newPage();
    await page.goto(sidePanelUrl);
    
    // Wait for the app to render
    await page.waitForSelector('#root');
    
    await use(page);
  },

  // Get options page
  optionsPage: async ({ context, extensionId }, use) => {
    // Open options page directly via extension URL
    const optionsUrl = `chrome-extension://${extensionId}/options.html`;
    const page = await context.newPage();
    await page.goto(optionsUrl);
    
    // Wait for the app to render
    await page.waitForSelector('#root');
    
    await use(page);
  },
});

export { expect } from '@playwright/test';
