/**
 * Unit tests for text-replacer.ts
 * Note: Some tests require browser-specific APIs not fully supported by jsdom.
 * Contenteditable tests are handled in Playwright E2E tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { replaceSelectedText, copyTextToClipboard } from '../src/lib/text-replacer';
import type { SelectionContext } from '@devmentorai/shared';

// Mock clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe('text-replacer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    container.remove();
    window.getSelection()?.removeAllRanges();
  });

  // Helper to create a valid selection context
  function createInputContext(
    input: HTMLInputElement,
    selectedText: string,
    start: number,
    end: number
  ): SelectionContext {
    const targetId = `test-target-${Date.now()}`;
    input.setAttribute('data-devmentorai-target-id', targetId);
    
    return {
      selectedText,
      elementType: 'input',
      isEditable: true,
      isReplaceable: true,
      selectionStart: start,
      selectionEnd: end,
      targetElementId: targetId,
    };
  }

  function createTextareaContext(
    textarea: HTMLTextAreaElement,
    selectedText: string,
    start: number,
    end: number
  ): SelectionContext {
    const targetId = `test-target-${Date.now()}`;
    textarea.setAttribute('data-devmentorai-target-id', targetId);
    
    return {
      selectedText,
      elementType: 'textarea',
      isEditable: true,
      isReplaceable: true,
      selectionStart: start,
      selectionEnd: end,
      targetElementId: targetId,
    };
  }

  describe('replaceSelectedText', () => {
    describe('input elements', () => {
      it('should replace selected text in input', async () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello World';
        container.appendChild(input);
        
        const context = createInputContext(input, 'World', 6, 11);
        
        // Set up selection
        input.focus();
        input.setSelectionRange(6, 11);
        
        const result = await replaceSelectedText(context, 'Universe');
        
        expect(result.success).toBe(true);
        expect(input.value).toBe('Hello Universe');
      });

      it('should replace text at start of input', async () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello World';
        container.appendChild(input);
        
        const context = createInputContext(input, 'Hello', 0, 5);
        
        input.focus();
        input.setSelectionRange(0, 5);
        
        const result = await replaceSelectedText(context, 'Hi');
        
        expect(result.success).toBe(true);
        expect(input.value).toBe('Hi World');
      });

      it('should replace entire input content', async () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello';
        container.appendChild(input);
        
        const context = createInputContext(input, 'Hello', 0, 5);
        
        input.focus();
        input.setSelectionRange(0, 5);
        
        const result = await replaceSelectedText(context, 'Goodbye');
        
        expect(result.success).toBe(true);
        expect(input.value).toBe('Goodbye');
      });

      it('should position cursor at end of replacement', async () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello World';
        container.appendChild(input);
        
        const context = createInputContext(input, 'World', 6, 11);
        
        input.focus();
        input.setSelectionRange(6, 11);
        
        await replaceSelectedText(context, 'Universe');
        
        expect(input.selectionStart).toBe(14); // "Hello Universe".length
        expect(input.selectionEnd).toBe(14);
      });

      it('should dispatch input events', async () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello World';
        container.appendChild(input);
        
        const context = createInputContext(input, 'World', 6, 11);
        
        input.focus();
        input.setSelectionRange(6, 11);
        
        let inputEventFired = false;
        let changeEventFired = false;
        
        input.addEventListener('input', () => { inputEventFired = true; });
        input.addEventListener('change', () => { changeEventFired = true; });
        
        await replaceSelectedText(context, 'Universe');
        
        expect(inputEventFired).toBe(true);
        expect(changeEventFired).toBe(true);
      });
    });

    describe('textarea elements', () => {
      it('should replace selected text in textarea', async () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'Line 1\nLine 2\nLine 3';
        container.appendChild(textarea);
        
        const context = createTextareaContext(textarea, 'Line 2', 7, 13);
        
        textarea.focus();
        textarea.setSelectionRange(7, 13);
        
        const result = await replaceSelectedText(context, 'New Line');
        
        expect(result.success).toBe(true);
        expect(textarea.value).toBe('Line 1\nNew Line\nLine 3');
      });

      it('should handle multi-line replacement', async () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'First line\nSecond line';
        container.appendChild(textarea);
        
        const context = createTextareaContext(textarea, 'Second line', 11, 22);
        
        textarea.focus();
        textarea.setSelectionRange(11, 22);
        
        const result = await replaceSelectedText(context, 'Line 2\nLine 3\nLine 4');
        
        expect(result.success).toBe(true);
        expect(textarea.value).toBe('First line\nLine 2\nLine 3\nLine 4');
      });
    });

    // Note: contenteditable tests are done in Playwright E2E tests
    // because jsdom's contenteditable support is limited

    describe('error handling', () => {
      it('should fallback to clipboard when element not found', async () => {
        const context: SelectionContext = {
          selectedText: 'test',
          elementType: 'input',
          isEditable: true,
          isReplaceable: true,
          targetElementId: 'non-existent-id',
          selectionStart: 0,
          selectionEnd: 4,
        };
        
        const result = await replaceSelectedText(context, 'replacement');
        
        expect(result.success).toBe(false);
        expect(result.copiedToClipboard).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith('replacement');
      });

      it('should return error when context is not replaceable', async () => {
        const context: SelectionContext = {
          selectedText: 'test',
          elementType: 'other',
          isEditable: false,
          isReplaceable: false,
        };
        
        const result = await replaceSelectedText(context, 'replacement');
        
        expect(result.success).toBe(false);
        expect(result.copiedToClipboard).toBe(true);
      });

      it('should handle missing targetElementId', async () => {
        const context: SelectionContext = {
          selectedText: 'test',
          elementType: 'input',
          isEditable: true,
          isReplaceable: true,
          // No targetElementId
        };
        
        const result = await replaceSelectedText(context, 'replacement');
        
        expect(result.success).toBe(false);
        expect(result.copiedToClipboard).toBe(true);
      });
    });
  });

  describe('copyTextToClipboard', () => {
    it('should copy text to clipboard', async () => {
      const result = await copyTextToClipboard('Test text');
      
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('Test text');
    });

    it('should handle clipboard failure', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
      
      // The fallback uses execCommand which may or may not work in jsdom
      const result = await copyTextToClipboard('Test text');
      
      // Either way, it should not throw
      expect(typeof result).toBe('boolean');
    });
  });
});
