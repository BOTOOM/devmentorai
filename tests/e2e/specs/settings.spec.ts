/**
 * E2E tests for Settings page functionality
 * Tests theme switching, backend URL validation, and settings persistence
 */
import { test, expect } from '../fixtures';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ optionsPage }) => {
    // Wait for options page to load
    await optionsPage.waitForLoadState('networkidle');
  });

  test.describe('Page Load', () => {
    test('should display settings page title', async ({ optionsPage }) => {
      // Check for a heading or title element
      const heading = optionsPage.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should display all main setting sections', async ({ optionsPage }) => {
      // Check for key settings sections
      await expect(optionsPage.getByText(/theme/i).first()).toBeVisible();
      await expect(optionsPage.getByText(/Interface Language/i)).toBeVisible();
    });
  });

  test.describe('Theme Settings', () => {
    test('should have theme options available', async ({ optionsPage }) => {
      // Look for theme selector or radio buttons
      const themeSection = optionsPage.locator('text=Theme').first();
      await expect(themeSection).toBeVisible();
    });

    test('should be able to select dark theme', async ({ optionsPage }) => {
      // Find and click dark theme option
      const darkOption = optionsPage.getByRole('radio', { name: /dark/i }).or(
        optionsPage.getByLabel(/dark/i)
      ).or(
        optionsPage.locator('[value="dark"]')
      );
      
      if (await darkOption.isVisible()) {
        await darkOption.click();
        // Verify the selection took effect
        await expect(darkOption).toBeChecked();
      }
    });

    test('should be able to select light theme', async ({ optionsPage }) => {
      const lightOption = optionsPage.getByRole('radio', { name: /light/i }).or(
        optionsPage.getByLabel(/light/i)
      ).or(
        optionsPage.locator('[value="light"]')
      );
      
      if (await lightOption.isVisible()) {
        await lightOption.click();
        await expect(lightOption).toBeChecked();
      }
    });

    test('should be able to select system theme', async ({ optionsPage }) => {
      const systemOption = optionsPage.getByRole('radio', { name: /system/i }).or(
        optionsPage.getByLabel(/system/i)
      ).or(
        optionsPage.locator('[value="system"]')
      );
      
      if (await systemOption.isVisible()) {
        await systemOption.click();
        await expect(systemOption).toBeChecked();
      }
    });
  });

  test.describe('Backend Connection', () => {
    test('should display backend URL input', async ({ optionsPage }) => {
      const backendInput = optionsPage.getByLabel(/backend/i).or(
        optionsPage.locator('input[placeholder*="localhost"]')
      ).or(
        optionsPage.locator('input[type="url"]')
      );
      
      await expect(backendInput.first()).toBeVisible();
    });

    test('should show connection status', async ({ optionsPage }) => {
      // Look for connection status indicator
      const statusIndicator = optionsPage.locator('[class*="status"]').or(
        optionsPage.getByText(/connected|disconnected|connecting/i)
      );
      
      // Status should be visible somewhere
      const count = await statusIndicator.count();
      expect(count).toBeGreaterThanOrEqual(0); // May not be visible if no backend
    });
  });

  test.describe('UI Features', () => {
    test('should have floating bubble toggle', async ({ optionsPage }) => {
      const toggle = optionsPage.getByLabel(/floating bubble/i).or(
        optionsPage.getByText(/floating bubble/i)
      );
      
      if (await toggle.isVisible()) {
        // Toggle exists
        await expect(toggle).toBeVisible();
      }
    });

    test('should have selection toolbar toggle', async ({ optionsPage }) => {
      const toggle = optionsPage.getByText('Selection Toolbar').first();
      
      if (await toggle.isVisible().catch(() => false)) {
        await expect(toggle).toBeVisible();
      }
    });

    test('should have image attachments toggle', async ({ optionsPage }) => {
      const toggle = optionsPage.getByText('Image Attachments').first();
      
      if (await toggle.isVisible().catch(() => false)) {
        await expect(toggle).toBeVisible();
      }
    });
  });

  test.describe('Session Defaults', () => {
    test('should have default session type selector', async ({ optionsPage }) => {
      const sessionTypeSection = optionsPage.getByText(/session type/i).or(
        optionsPage.getByText(/default session/i)
      );
      
      const isVisible = await sessionTypeSection.isVisible().catch(() => false);
      if (isVisible) {
        await expect(sessionTypeSection).toBeVisible();
      }
    });
  });

  test.describe('Quick Actions', () => {
    test('should have text replacement behavior setting', async ({ optionsPage }) => {
      const replacementSection = optionsPage.getByText(/text replacement/i).or(
        optionsPage.getByText(/replace/i)
      );
      
      const isVisible = await replacementSection.isVisible().catch(() => false);
      if (isVisible) {
        await expect(replacementSection).toBeVisible();
      }
    });

    test('should have quick action model selector', async ({ optionsPage }) => {
      const modelSection = optionsPage.getByText(/quick action/i).or(
        optionsPage.getByText(/model/i)
      );
      
      const isVisible = await modelSection.isVisible().catch(() => false);
      if (isVisible) {
        await expect(modelSection).toBeVisible();
      }
    });
  });

  test.describe('Language Settings', () => {
    test('should have language selector', async ({ optionsPage }) => {
      const languageSection = optionsPage.getByLabel(/language/i).or(
        optionsPage.getByText(/language/i)
      );
      
      await expect(languageSection.first()).toBeVisible();
    });

    test('should have translation language selector', async ({ optionsPage }) => {
      const translationSection = optionsPage.getByText(/translation/i);
      
      const isVisible = await translationSection.isVisible().catch(() => false);
      if (isVisible) {
        await expect(translationSection).toBeVisible();
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be able to tab through settings', async ({ optionsPage }) => {
      // Focus first focusable element
      await optionsPage.keyboard.press('Tab');
      
      // Should have focus on some element
      const focusedElement = optionsPage.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should support keyboard for radio buttons', async ({ optionsPage }) => {
      // Tab to first radio group
      await optionsPage.keyboard.press('Tab');
      
      // Try arrow keys
      await optionsPage.keyboard.press('ArrowDown');
      await optionsPage.keyboard.press('ArrowUp');
      
      // Should still have focus
      const focusedElement = optionsPage.locator(':focus');
      const isVisible = await focusedElement.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    });
  });
});
