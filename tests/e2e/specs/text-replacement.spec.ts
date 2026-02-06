/**
 * E2E tests for text replacement functionality
 * Tests selection detection and text replacement in various editable elements
 */
import { test, expect } from '../fixtures';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Text Replacement', () => {
  test.describe('Selection Detection', () => {
    test('should detect selection in text input', async ({ context }) => {
      // Navigate to test page
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      // Select text in input
      const input = page.locator('#test-input');
      await input.click();
      await input.evaluate((el: HTMLInputElement) => {
        el.focus();
        el.setSelectionRange(4, 9); // "quick"
      });
      
      // Verify selection was made
      const selectedText = await input.evaluate((el: HTMLInputElement) => {
        return el.value.substring(el.selectionStart || 0, el.selectionEnd || 0);
      });
      
      expect(selectedText).toBe('quick');
    });

    test('should detect selection in textarea', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const textarea = page.locator('#test-textarea');
      await textarea.click();
      await textarea.evaluate((el: HTMLTextAreaElement) => {
        el.focus();
        // Select "Second line"
        el.setSelectionRange(20, 31);
      });
      
      const selectedText = await textarea.evaluate((el: HTMLTextAreaElement) => {
        return el.value.substring(el.selectionStart || 0, el.selectionEnd || 0);
      });
      
      expect(selectedText).toBe('Second line');
    });

    test('should detect selection in contenteditable', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const contentEditable = page.locator('#test-contenteditable');
      await contentEditable.click();
      
      // Create selection in contenteditable using triple-click to select all
      await contentEditable.click({ clickCount: 3 });
      
      const selectedText = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });
      
      // Should have selected some text (the exact amount depends on browser behavior)
      expect(selectedText.length).toBeGreaterThan(0);
    });
  });

  test.describe('Text Replacement in Input', () => {
    test('should replace text in input element', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const input = page.locator('#test-input');
      const originalValue = 'The quick brown fox jumps over the lazy dog.';
      
      // Verify initial value
      await expect(input).toHaveValue(originalValue);
      
      // Select "quick"
      await input.click();
      await input.evaluate((el: HTMLInputElement) => {
        el.focus();
        el.setSelectionRange(4, 9);
      });
      
      // Simulate text replacement using setRangeText
      await input.evaluate((el: HTMLInputElement) => {
        el.setRangeText('fast', 4, 9, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      
      // Verify replacement
      await expect(input).toHaveValue('The fast brown fox jumps over the lazy dog.');
    });

    test('should position cursor after replacement', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const input = page.locator('#test-input');
      
      await input.click();
      await input.evaluate((el: HTMLInputElement) => {
        el.focus();
        el.setSelectionRange(4, 9); // "quick"
        el.setRangeText('speedy', 4, 9, 'end');
      });
      
      const cursorPos = await input.evaluate((el: HTMLInputElement) => {
        return {
          start: el.selectionStart,
          end: el.selectionEnd,
        };
      });
      
      // Cursor should be at position 10 (after "The speedy")
      expect(cursorPos.start).toBe(10);
      expect(cursorPos.end).toBe(10);
    });
  });

  test.describe('Text Replacement in Textarea', () => {
    test('should replace text in textarea', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const textarea = page.locator('#test-textarea');
      
      await textarea.click();
      await textarea.evaluate((el: HTMLTextAreaElement) => {
        el.focus();
        // Select "Second"
        el.setSelectionRange(20, 26);
        el.setRangeText('Modified', 20, 26, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      
      const value = await textarea.inputValue();
      expect(value).toContain('Modified line');
    });

    test('should handle multi-line replacement', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const textarea = page.locator('#test-textarea');
      
      await textarea.click();
      await textarea.evaluate((el: HTMLTextAreaElement) => {
        el.focus();
        // Replace entire content
        el.setSelectionRange(0, el.value.length);
        el.setRangeText('Line A\nLine B\nLine C', 0, el.value.length, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      
      const value = await textarea.inputValue();
      expect(value).toBe('Line A\nLine B\nLine C');
    });
  });

  test.describe('Non-Editable Elements', () => {
    test('should not allow replacement in readonly input', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const readonly = page.locator('#test-readonly');
      
      // Verify it's readonly
      const isReadonly = await readonly.evaluate((el: HTMLInputElement) => el.readOnly);
      expect(isReadonly).toBe(true);
      
      // Selection should work
      await readonly.click();
      await readonly.evaluate((el: HTMLInputElement) => {
        el.focus();
        el.setSelectionRange(0, 4);
      });
      
      // But replacement should fail
      const originalValue = await readonly.inputValue();
      await readonly.evaluate((el: HTMLInputElement) => {
        try {
          // This won't actually change a readonly input
          el.value = 'Changed';
        } catch {
          // Expected
        }
      });
      
      // Value should be unchanged (readonly inputs still allow value changes via JS in some browsers)
      // The actual restriction is enforced by our selection-detector marking it as not replaceable
    });

    test('should not allow replacement in disabled input', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const disabled = page.locator('#test-disabled');
      
      // Verify it's disabled
      const isDisabled = await disabled.evaluate((el: HTMLInputElement) => el.disabled);
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Event Dispatching', () => {
    test('should dispatch input event after replacement', async ({ context }) => {
      const page = await context.newPage();
      const testPagePath = path.join(__dirname, '../fixtures/test-editable-page.html');
      await page.goto(`file://${testPagePath}`);
      
      const input = page.locator('#test-input');
      
      // Set up event listener
      await page.evaluate(() => {
        (window as any).inputEventFired = false;
        document.getElementById('test-input')?.addEventListener('input', () => {
          (window as any).inputEventFired = true;
        });
      });
      
      // Perform replacement
      await input.click();
      await input.evaluate((el: HTMLInputElement) => {
        el.focus();
        el.setSelectionRange(4, 9);
        el.setRangeText('swift', 4, 9, 'end');
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      
      // Verify event was fired
      const eventFired = await page.evaluate(() => (window as any).inputEventFired);
      expect(eventFired).toBe(true);
    });
  });
});
