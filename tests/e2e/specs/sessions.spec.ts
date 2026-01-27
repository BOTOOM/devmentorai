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

  test('should create a session with custom model', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('Custom Model Test');
    await sidePanelPage.getByText('DevOps Mentor').click();
    
    // Open model selector
    await sidePanelPage.getByText('GPT-4.1').click();
    // Select a different model
    await sidePanelPage.getByText('Claude Sonnet 4.5').click();
    
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session created with model displayed
    await expect(sidePanelPage.getByText('Custom Model Test')).toBeVisible();
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

  test('should show session type indicator', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('DevOps Test');
    await sidePanelPage.getByText('DevOps Mentor').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify session info bar shows type icon
    await expect(sidePanelPage.getByText('🔧')).toBeVisible();
    await expect(sidePanelPage.getByText('DevOps Test')).toBeVisible();
  });

  test('should show quick prompts for session type', async ({ sidePanelPage }) => {
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('DevOps Quick');
    await sidePanelPage.getByText('DevOps Mentor').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Verify DevOps quick prompts are visible
    await expect(sidePanelPage.getByText('Explain Kubernetes pods')).toBeVisible();
    await expect(sidePanelPage.getByText('Best practices for CI/CD')).toBeVisible();
  });
});
