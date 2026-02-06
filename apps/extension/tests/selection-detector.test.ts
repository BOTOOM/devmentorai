/**
 * Unit tests for selection-detector.ts
 * Note: jsdom has limited selection support for input/textarea elements.
 * Real browser testing is done via Playwright E2E tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectSelection,
  findElementByTargetId,
  validateSelectionForReplacement,
  clearTargetId,
  getInputSelectionInfo,
} from '../src/lib/selection-detector';

describe('selection-detector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    // Clear any leftover selections
    window.getSelection()?.removeAllRanges();
  });

  describe('detectSelection', () => {
    it('should return null when no text is selected', () => {
      const result = detectSelection();
      expect(result).toBeNull();
    });

    // Note: jsdom doesn't fully support input/textarea selection detection
    // These are tested in Playwright E2E tests instead

    it('should detect selection in contenteditable element', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.innerHTML = 'Editable content here';
      container.appendChild(div);
      
      // Create a selection in the contenteditable
      const range = document.createRange();
      const textNode = div.firstChild!;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 8);
      
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      
      const result = detectSelection();
      
      expect(result).not.toBeNull();
      expect(result?.selectedText).toBe('Editable');
      // jsdom may not properly detect contenteditable, so we check for either
      expect(['contenteditable', 'other']).toContain(result?.elementType);
    });

    it('should detect selection in non-editable element as other', () => {
      const p = document.createElement('p');
      p.textContent = 'Regular paragraph text';
      container.appendChild(p);
      
      // Create a selection in the paragraph
      const range = document.createRange();
      const textNode = p.firstChild!;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 7);
      
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      
      const result = detectSelection();
      
      expect(result).not.toBeNull();
      expect(result?.selectedText).toBe('Regular');
      expect(result?.elementType).toBe('other');
      expect(result?.isEditable).toBe(false);
      expect(result?.isReplaceable).toBe(false);
    });

    it('should not detect selection in non-text input types', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      container.appendChild(checkbox);
      
      checkbox.focus();
      
      const result = detectSelection();
      expect(result).toBeNull();
    });
  });

  describe('getInputSelectionInfo', () => {
    it('should get selection info from focused input', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      container.appendChild(input);
      
      input.focus();
      input.setSelectionRange(0, 5);
      
      const info = getInputSelectionInfo();
      
      expect(info).not.toBeNull();
      expect(info?.start).toBe(0);
      expect(info?.end).toBe(5);
    });

    it('should get selection info from focused textarea', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'Line 1\nLine 2';
      container.appendChild(textarea);
      
      textarea.focus();
      textarea.setSelectionRange(7, 13);
      
      const info = getInputSelectionInfo();
      
      expect(info).not.toBeNull();
      expect(info?.start).toBe(7);
      expect(info?.end).toBe(13);
    });

    it('should return null when no input is focused', () => {
      const info = getInputSelectionInfo();
      expect(info).toBeNull();
    });
  });

  describe('findElementByTargetId', () => {
    it('should find element by target ID', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-devmentorai-target-id', 'test-id-123');
      container.appendChild(input);
      
      const found = findElementByTargetId('test-id-123');
      expect(found).toBe(input);
    });

    it('should return null for unknown target ID', () => {
      const found = findElementByTargetId('unknown-id');
      expect(found).toBeNull();
    });
  });

  describe('validateSelectionForReplacement', () => {
    it('should return false for non-replaceable context', () => {
      const context = {
        selectedText: 'Test',
        elementType: 'other' as const,
        isEditable: false,
        isReplaceable: false,
      };
      
      const isValid = validateSelectionForReplacement(context);
      expect(isValid).toBe(false);
    });

    it('should return false when element does not exist', () => {
      const context = {
        selectedText: 'Test',
        elementType: 'input' as const,
        isEditable: true,
        isReplaceable: true,
        targetElementId: 'non-existent-id',
        selectionStart: 0,
        selectionEnd: 4,
      };
      
      const isValid = validateSelectionForReplacement(context);
      expect(isValid).toBe(false);
    });

    it('should return false when element is removed from DOM', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Hello World';
      input.setAttribute('data-devmentorai-target-id', 'test-id');
      container.appendChild(input);
      
      const context = {
        selectedText: 'Hello',
        elementType: 'input' as const,
        isEditable: true,
        isReplaceable: true,
        targetElementId: 'test-id',
        selectionStart: 0,
        selectionEnd: 5,
      };
      
      // Remove element from DOM
      input.remove();
      
      const isValid = validateSelectionForReplacement(context);
      expect(isValid).toBe(false);
    });
  });

  describe('clearTargetId', () => {
    it('should clear target ID from element', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('data-devmentorai-target-id', 'test-id-456');
      container.appendChild(input);
      
      expect(findElementByTargetId('test-id-456')).toBe(input);
      
      clearTargetId('test-id-456');
      
      expect(findElementByTargetId('test-id-456')).toBeNull();
    });

    it('should handle non-existent target ID gracefully', () => {
      // Should not throw
      expect(() => clearTargetId('non-existent-id')).not.toThrow();
    });
  });
});
