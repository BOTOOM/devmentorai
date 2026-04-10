import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '../fixtures';

interface ApiResponse<T> {
  data?: T;
}

interface SessionSummary {
  id: string;
}

interface PaginatedResponse<T> {
  items: T[];
}

test.describe('Session Management', () => {
  const newSessionTypeButton = (sidePanelPage: Page, name: RegExp) =>
    sidePanelPage.getByRole('button', { name }).last();

  const clearSessions = async (request: APIRequestContext) => {
    const response = await request.get('http://127.0.0.1:3847/api/sessions?page=1&pageSize=100');
    expect(response.ok()).toBeTruthy();

    const payload = (await response.json()) as ApiResponse<PaginatedResponse<SessionSummary>>;

    for (const session of payload.data?.items ?? []) {
      const deleteResponse = await request.delete(`http://127.0.0.1:3847/api/sessions/${session.id}`);
      expect(deleteResponse.ok() || deleteResponse.status() === 404).toBeTruthy();
    }
  };

  test.beforeEach(async ({ request }) => {
    await clearSessions(request);
  });

  test('should display welcome message when no sessions exist', async ({ sidePanelPage }) => {
    await expect(sidePanelPage.getByText('Welcome to DevMentorAI')).toBeVisible();
  });

  test('should create a DevOps session', async ({ sidePanelPage }) => {
    // Click new session button
    await sidePanelPage.getByRole('button', { name: /new/i }).click();

    // Fill session name
    await sidePanelPage.getByLabel(/session name/i).fill('AWS Migration');

    // Select DevOps type
    await newSessionTypeButton(sidePanelPage, /devops mentor/i).click();

    // Create session
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session created
    await expect(sidePanelPage.getByRole('button', { name: /aws migration/i }).first()).toBeVisible();
  });

  test('should create a Writing session', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Email Draft');
    await newSessionTypeButton(sidePanelPage, /writing assistant/i).click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    await expect(sidePanelPage.getByRole('button', { name: /email draft/i }).first()).toBeVisible();
  });

  test('should create a session with custom model', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Custom Model Test');
    await newSessionTypeButton(sidePanelPage, /devops mentor/i).click();
    
    // Open model selector
    await sidePanelPage.getByRole('button', { name: /gpt-4\.1/i }).last().click();
    // Select a different model
    await sidePanelPage.getByRole('button', { name: /claude sonnet 4\.5/i }).click();
    
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session created with model displayed
    await expect(sidePanelPage.getByRole('button', { name: /custom model test/i }).first()).toBeVisible();
  });

  test('should switch between sessions', async ({ sidePanelPage }) => {
    // Create first session
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Session 1');
    await newSessionTypeButton(sidePanelPage, /devops mentor/i).click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Create second session
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Session 2');
    await newSessionTypeButton(sidePanelPage, /writing assistant/i).click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify Session 2 is active
    await expect(sidePanelPage.getByRole('button', { name: /session 2/i }).first()).toBeVisible();

    // Open session selector and switch to Session 1
    await sidePanelPage.locator('div.relative.border-b > button').click();
    await sidePanelPage.locator('div.absolute').getByRole('button', { name: /session 1/i }).click();

    // Verify Session 1 is now active
    await expect(sidePanelPage.getByRole('button', { name: /session 1/i }).first()).toBeVisible();
  });

  test('should show session type indicator', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('DevOps Test');
    await newSessionTypeButton(sidePanelPage, /devops mentor/i).click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session info bar shows type icon
    await expect(sidePanelPage.getByRole('button', { name: /🛠️.*devops test.*devops mentor/i }).first()).toBeVisible();
  });

  test('should show quick prompts for session type', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('DevOps Quick');
    await newSessionTypeButton(sidePanelPage, /devops mentor/i).click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify DevOps quick prompts are visible
    await expect(sidePanelPage.getByText('Explain Kubernetes pods')).toBeVisible();
    await expect(sidePanelPage.getByText('Best practices for CI/CD')).toBeVisible();
  });
});
