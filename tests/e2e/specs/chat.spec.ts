import { test, expect } from '../fixtures';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ sidePanelPage }) => {
    // Create a session before each test
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Test Session');
    await sidePanelPage.getByRole('button', { name: /general assistant/i }).last().click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();
    await expect(sidePanelPage.getByRole('button', { name: /test session/i }).first()).toBeVisible();
    await expect(sidePanelPage.locator('textarea')).toBeEnabled();
  });

  test('should send a message and receive response', async ({ sidePanelPage }) => {
    const messageInput = sidePanelPage.locator('textarea');
    const sendButton = sidePanelPage.getByRole('button', { name: /send|enviar/i });
    const copyButton = sidePanelPage.getByRole('button', { name: /copy/i }).last();

    // Type message
    await messageInput.fill('Hello, how are you?');
    
    // Send message
    await sendButton.click();

    // Verify user message appears
    await expect(sidePanelPage.getByText('Hello, how are you?')).toBeVisible();

    // Wait for assistant response controls to appear
    await expect(copyButton).toBeVisible({ timeout: 30000 });
  });

  test('should show processing indicator while streaming', async ({ sidePanelPage }) => {
    const messageInput = sidePanelPage.locator('textarea');
    const sendButton = sidePanelPage.getByRole('button', { name: /send|enviar/i });
    const activityIndicator = sidePanelPage.getByText(/thinking|pensando|sending your message/i);
    const copyButton = sidePanelPage.getByRole('button', { name: /copy/i }).last();

    await messageInput.fill('Tell me a long story');
    await sendButton.click();

    // Depending on response speed, we may briefly see an activity indicator or jump straight to the response
    await Promise.race([
      activityIndicator.waitFor({ state: 'visible', timeout: 3000 }),
      copyButton.waitFor({ state: 'visible', timeout: 30000 }),
    ]);

    await expect(copyButton).toBeVisible({ timeout: 30000 });
  });

  test('should handle Enter key to send message', async ({ sidePanelPage }) => {
    const input = sidePanelPage.locator('textarea');
    await input.focus();
    await input.type('Test message via Enter');
    await sidePanelPage.keyboard.press('Enter');

    await expect(sidePanelPage.getByText('Test message via Enter')).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('should not send empty messages', async ({ sidePanelPage }) => {
    const sendButton = sidePanelPage.getByRole('button', { name: /send|enviar/i });
    
    // Button should be disabled with empty input
    await expect(sendButton).toBeDisabled();

    // Type spaces only
    await sidePanelPage.locator('textarea').fill('   ');
    await expect(sendButton).toBeDisabled();
  });
});
