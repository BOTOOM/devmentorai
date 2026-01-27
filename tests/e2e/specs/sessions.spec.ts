import { test, expect } from '../fixtures';

test.describe('Session Management', () => {
  test('should display welcome message when no sessions exist', async ({ sidePanelPage }) => {
    await expect(sidePanelPage.getByText('Welcome to DevMentorAI')).toBeVisible();
  });

  test('should create a DevOps session', async ({ sidePanelPage }) => {
    // Click new session button
    await sidePanelPage.getByRole('button', { name: /new/i }).click();

    // Fill session name
    await sidePanelPage.getByPlaceholder(/session name/i).fill('AWS Migration');

    // Select DevOps type
    await sidePanelPage.getByText('DevOps Mentor').click();

    // Create session
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session created
    await expect(sidePanelPage.getByText('AWS Migration')).toBeVisible();
  });

  test('should create a Writing session', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('Email Draft');
    await sidePanelPage.getByText('Writing Assistant').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    await expect(sidePanelPage.getByText('Email Draft')).toBeVisible();
  });

  test('should switch between sessions', async ({ sidePanelPage }) => {
    // Create first session
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('Session 1');
    await sidePanelPage.getByText('DevOps Mentor').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Create second session
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('Session 2');
    await sidePanelPage.getByText('Writing Assistant').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify Session 2 is active
    await expect(sidePanelPage.getByText('Session 2')).toBeVisible();

    // Open session selector and switch to Session 1
    await sidePanelPage.locator('[class*="border-b"]').first().click();
    await sidePanelPage.getByText('Session 1').click();

    // Verify Session 1 is now active
    await expect(sidePanelPage.locator('[class*="text-primary"]').getByText('Session 1')).toBeVisible();
  });
});
