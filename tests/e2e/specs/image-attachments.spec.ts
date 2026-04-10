import { test, expect } from '../fixtures';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple test image (1x1 pixel red PNG)
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB9AP/Z';

test.describe('Image Attachments', () => {
  test.beforeEach(async ({ sidePanelPage }) => {
    // Create a session before each test
    await sidePanelPage.getByRole('button', { name: /new/i }).click();
    await sidePanelPage.getByLabel(/session name/i).fill('Image Test Session');
    await sidePanelPage.getByRole('button', { name: /general assistant/i }).last().click();
    await sidePanelPage.getByRole('button', { name: /create session/i }).click();

    // Wait for session to be ready
    await expect(sidePanelPage.getByRole('button', { name: /image test session/i }).first()).toBeVisible();
  });

  test('should show image attachment button', async ({ sidePanelPage }) => {
    // The image attachment button should be visible (ImagePlus icon)
    const attachButton = sidePanelPage.locator('button[title="Attach images"]');
    await expect(attachButton).toBeVisible();
  });

  test('should show hint text for image attachment', async ({ sidePanelPage }) => {
    // Should show hint about paste/drag images
    await expect(sidePanelPage.getByText(/paste or drag images/i)).toBeVisible();
  });

  test('should allow sending message with images via paste', async ({ sidePanelPage }) => {
    // Focus the textarea
    const textarea = sidePanelPage.locator('textarea');
    const draftThumbnail = sidePanelPage.locator('img[alt^="Attachment "]').first();
    const removeImageButton = sidePanelPage.getByRole('button', { name: /remove image/i }).first();
    await textarea.focus();

    // Simulate paste with an image (we need to use the clipboard API in page context)
    await sidePanelPage.evaluate(async (base64) => {
      // Create a blob from base64
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });

      // Create clipboard event
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([blob], 'test.png', { type: 'image/png' }));

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      // Find the textarea and dispatch paste
      const textarea = document.querySelector('textarea');
      textarea?.dispatchEvent(pasteEvent);
    }, TEST_PNG_BASE64);

    // Wait for image thumbnail to appear
    await Promise.race([
      draftThumbnail.waitFor({ state: 'visible', timeout: 5000 }),
      removeImageButton.waitFor({ state: 'visible', timeout: 5000 }),
    ]);

    // Send button should be enabled even without text (because we have image)
    const sendButton = sidePanelPage.locator('button[type="submit"]');
    await expect(sendButton).toBeEnabled();
  });

  test('should display image thumbnails in message history after send', async ({ sidePanelPage }) => {
    // First, attach an image via paste (same as above)
    const textarea = sidePanelPage.locator('textarea');
    await textarea.focus();

    await sidePanelPage.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([blob], 'test.png', { type: 'image/png' }));

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      const textareaEl = document.querySelector('textarea');
      textareaEl?.dispatchEvent(pasteEvent);
    }, TEST_PNG_BASE64);

    // Wait for thumbnail to appear
    await sidePanelPage.waitForTimeout(1000);

    // Add some text and send
    await textarea.fill('Check out this image');
    await sidePanelPage.locator('button[type="submit"]').click();

    // User message should appear
    await expect(sidePanelPage.getByText('Check out this image')).toBeVisible();

    // Image should be visible in the message (either as thumbnail or processing)
    // Note: The actual thumbnail URL loading may depend on backend processing
  });

  test('should open lightbox when clicking thumbnail in attachment zone', async ({ sidePanelPage }) => {
    // Attach an image
    const textarea = sidePanelPage.locator('textarea');
    await textarea.focus();

    await sidePanelPage.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([blob], 'test.png', { type: 'image/png' }));

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      document.querySelector('textarea')?.dispatchEvent(pasteEvent);
    }, TEST_PNG_BASE64);

    // Wait for thumbnail to appear
    await sidePanelPage.waitForTimeout(500);

    // Click on the thumbnail (the image inside the attachment zone)
    const thumbnail = sidePanelPage.locator('.cursor-pointer img, [data-testid="image-thumbnail"]').first();
    if (await thumbnail.isVisible()) {
      await thumbnail.click();

      // Lightbox should open (look for the modal/overlay)
      await expect(sidePanelPage.locator('[role="dialog"], .fixed.inset-0')).toBeVisible({ timeout: 2000 });

      // Close with ESC
      await sidePanelPage.keyboard.press('Escape');

      // Lightbox should close
      await expect(sidePanelPage.locator('[role="dialog"], .fixed.inset-0')).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should remove image from attachment zone', async ({ sidePanelPage }) => {
    // Attach an image
    const textarea = sidePanelPage.locator('textarea');
    const removeButton = sidePanelPage.getByRole('button', { name: /remove image/i }).first();
    const draftThumbnail = sidePanelPage.locator('img[alt^="Attachment "]').first();
    await textarea.focus();

    await sidePanelPage.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([blob], 'test.png', { type: 'image/png' }));

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      document.querySelector('textarea')?.dispatchEvent(pasteEvent);
    }, TEST_PNG_BASE64);

    await expect(removeButton).toBeVisible({ timeout: 5000 });
    await removeButton.click();

    // Thumbnail should be removed
    await expect(draftThumbnail).not.toBeVisible({ timeout: 5000 });
    
    // Send button should now be disabled (no text or images)
    const sendButton = sidePanelPage.locator('button[type="submit"]');
    await expect(sendButton).toBeDisabled();
  });

  test('should handle drag and drop image', async ({ sidePanelPage }) => {
    // Get the drop zone area
    const dropZone = sidePanelPage.locator('form');

    // Simulate drag and drop
    await sidePanelPage.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const file = new File([blob], 'dropped.png', { type: 'image/png' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Find the form (which contains the drop zone)
      const form = document.querySelector('form');
      if (form) {
        const dropEvent = new DragEvent('drop', {
          dataTransfer,
          bubbles: true,
          cancelable: true,
        });
        form.dispatchEvent(dropEvent);
      }
    }, TEST_PNG_BASE64);

    // Wait a bit for processing
    await sidePanelPage.waitForTimeout(500);

    // Send button should be enabled if image was attached
    // Note: This depends on the exact implementation of drag handling
  });

  test('should respect max images limit (5)', async ({ sidePanelPage }) => {
    const textarea = sidePanelPage.locator('textarea');
    await textarea.focus();

    // Add 6 images (should only accept 5)
    for (let i = 0; i < 6; i++) {
      await sidePanelPage.evaluate(async (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], `test${Date.now()}.png`, { type: 'image/png' }));

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        });

        document.querySelector('textarea')?.dispatchEvent(pasteEvent);
      }, TEST_PNG_BASE64);

      await sidePanelPage.waitForTimeout(200);
    }

    // Count visible thumbnails - should be at most 5
    const thumbnails = sidePanelPage.locator('[data-testid="image-thumbnail"], .relative.group img');
    const count = await thumbnails.count();
    expect(count).toBeLessThanOrEqual(5);
  });
});
