import { test, expect } from '../fixtures';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ sidePanelPage }) => {
    // Create a session before each test
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByPlaceholder(/session name/i).fill('Test Session');
    await sidePanelPage.getByText('General Assistant').click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();
  });

  test('should send a message and receive response', async ({ sidePanelPage }) => {
    // Type message
    await sidePanelPage.getByPlaceholder(/type a message/i).fill('Hello, how are you?');
    
    // Send message
    await sidePanelPage.getByRole('button', { name: /send/i }).click();

    // Verify user message appears
    await expect(sidePanelPage.getByText('Hello, how are you?')).toBeVisible();

    // Wait for assistant response (mock mode will respond quickly)
    await expect(sidePanelPage.getByText(/mock response/i)).toBeVisible({ timeout: 30000 });
  });

  test('should show processing indicator while streaming', async ({ sidePanelPage }) => {
    await sidePanelPage.getByPlaceholder(/type a message/i).fill('Tell me a long story');
    await sidePanelPage.getByRole('button', { name: /send/i }).click();

    // Processing indicator should appear
    await expect(sidePanelPage.getByText(/processing/i)).toBeVisible();

    // Wait for response to complete
    await expect(sidePanelPage.getByText(/mock response/i)).toBeVisible({ timeout: 30000 });
  });

  test('should handle Enter key to send message', async ({ sidePanelPage }) => {
    const input = sidePanelPage.getByPlaceholder(/type a message/i);
    await input.fill('Test message via Enter');
    await input.press('Enter');

    await expect(sidePanelPage.getByText('Test message via Enter')).toBeVisible();
  });

  test('should not send empty messages', async ({ sidePanelPage }) => {
    const sendButton = sidePanelPage.getByRole('button', { name: /send/i });
    
    // Button should be disabled with empty input
    await expect(sendButton).toBeDisabled();

    // Type spaces only
    await sidePanelPage.getByPlaceholder(/type a message/i).fill('   ');
    await expect(sendButton).toBeDisabled();
  });
});
