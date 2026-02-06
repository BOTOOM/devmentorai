/**
 * Text Replacer Utility
 * Handles text replacement in various editable elements
 */

import type { SelectionContext, TextReplacementResult } from '@devmentorai/shared';
import { findElementByTargetId, validateSelectionForReplacement } from './selection-detector';

/**
 * Dispatch input events to notify frameworks of changes
 * This ensures React, Vue, Angular, etc. detect the change
 */
function dispatchInputEvents(element: HTMLElement, inputType = 'insertText'): void {
  // InputEvent for modern frameworks
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType,
    data: null,
  });
  element.dispatchEvent(inputEvent);
  
  // Change event for form handling
  const changeEvent = new Event('change', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(changeEvent);
  
  // Some frameworks also listen to keyup
  const keyupEvent = new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: '',
  });
  element.dispatchEvent(keyupEvent);
}

/**
 * Replace text in an input or textarea element
 */
function replaceInInputOrTextarea(
  element: HTMLInputElement | HTMLTextAreaElement,
  newText: string,
  selectionStart?: number,
  selectionEnd?: number
): TextReplacementResult {
  try {
    // Use provided positions or current selection
    const start = selectionStart ?? element.selectionStart ?? 0;
    const end = selectionEnd ?? element.selectionEnd ?? 0;
    
    if (start === end) {
      return {
        success: false,
        error: 'No text selected',
      };
    }
    
    // Focus the element
    element.focus();
    
    // Use setRangeText for clean replacement
    // The 'end' parameter positions cursor at end of inserted text
    element.setRangeText(newText, start, end, 'end');
    
    // Dispatch events to notify frameworks
    dispatchInputEvents(element);
    
    // Ensure cursor is at end of new text
    const newCursorPos = start + newText.length;
    element.setSelectionRange(newCursorPos, newCursorPos);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to replace text',
    };
  }
}

/**
 * Replace text in a contenteditable element
 */
function replaceInContentEditable(
  element: HTMLElement,
  newText: string
): TextReplacementResult {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return {
        success: false,
        error: 'No selection available',
      };
    }
    
    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      return {
        success: false,
        error: 'No text selected',
      };
    }
    
    // Focus the element
    element.focus();
    
    // Delete the selected content
    range.deleteContents();
    
    // Create a text node with the new content
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);
    
    // Normalize to merge adjacent text nodes
    element.normalize();
    
    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Dispatch events
    dispatchInputEvents(element);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to replace text',
    };
  }
}

/**
 * Copy text to clipboard as fallback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers or restricted contexts
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Main function to replace selected text with new content
 * Uses the SelectionContext to determine how to perform replacement
 */
export async function replaceSelectedText(
  context: SelectionContext,
  newText: string
): Promise<TextReplacementResult> {
  // Validate the selection is still valid
  if (!validateSelectionForReplacement(context)) {
    // Try fallback to clipboard
    const copied = await copyToClipboard(newText);
    return {
      success: false,
      error: 'Selection is no longer valid',
      copiedToClipboard: copied,
    };
  }
  
  if (!context.targetElementId) {
    const copied = await copyToClipboard(newText);
    return {
      success: false,
      error: 'No target element',
      copiedToClipboard: copied,
    };
  }
  
  const element = findElementByTargetId(context.targetElementId);
  if (!element) {
    const copied = await copyToClipboard(newText);
    return {
      success: false,
      error: 'Target element not found',
      copiedToClipboard: copied,
    };
  }
  
  let result: TextReplacementResult;
  
  switch (context.elementType) {
    case 'input':
      if (element instanceof HTMLInputElement) {
        result = replaceInInputOrTextarea(
          element,
          newText,
          context.selectionStart,
          context.selectionEnd
        );
      } else {
        result = { success: false, error: 'Element type mismatch' };
      }
      break;
      
    case 'textarea':
      if (element instanceof HTMLTextAreaElement) {
        result = replaceInInputOrTextarea(
          element,
          newText,
          context.selectionStart,
          context.selectionEnd
        );
      } else {
        result = { success: false, error: 'Element type mismatch' };
      }
      break;
      
    case 'contenteditable':
      result = replaceInContentEditable(element, newText);
      break;
      
    default:
      result = { success: false, error: 'Element type not supported for replacement' };
  }
  
  // If replacement failed, try clipboard fallback
  if (!result.success && !result.copiedToClipboard) {
    result.copiedToClipboard = await copyToClipboard(newText);
  }
  
  return result;
}

/**
 * Copy text to clipboard (exposed for direct use)
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  return copyToClipboard(text);
}
