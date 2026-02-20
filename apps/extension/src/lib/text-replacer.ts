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

function isRangeInsideElement(range: Range, element: HTMLElement): boolean {
  const container = range.commonAncestorContainer;
  return container === element || element.contains(container);
}

function findTextPositionByOffset(
  root: HTMLElement,
  targetOffset: number
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let lastNode: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    lastNode = node;
    const nextOffset = currentOffset + node.data.length;

    if (targetOffset <= nextOffset) {
      return {
        node,
        offset: Math.max(0, targetOffset - currentOffset),
      };
    }

    currentOffset = nextOffset;
  }

  if (lastNode && targetOffset === currentOffset) {
    return { node: lastNode, offset: lastNode.data.length };
  }

  return null;
}

function findRangeBySelectedText(element: HTMLElement, selectedText: string): Range | null {
  const fullText = element.textContent || '';
  if (!fullText || !selectedText) {
    return null;
  }

  const candidates = Array.from(
    new Set([selectedText, selectedText.trim()].filter((value) => value.length > 0))
  );

  let matchedText = '';
  let startIndex = -1;

  for (const candidate of candidates) {
    const index = fullText.indexOf(candidate);
    if (index !== -1) {
      matchedText = candidate;
      startIndex = index;
      break;
    }
  }

  if (startIndex === -1 || !matchedText) {
    return null;
  }

  const endIndex = startIndex + matchedText.length;
  const start = findTextPositionByOffset(element, startIndex);
  const end = findTextPositionByOffset(element, endIndex);

  if (!start || !end) {
    return null;
  }

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/**
 * Replace text in a contenteditable element
 */
function replaceInContentEditable(
  element: HTMLElement,
  newText: string,
  originalSelectedText?: string
): TextReplacementResult {
  try {
    const selection = globalThis.getSelection?.() ?? null;
    let range: Range | null = null;

    if (selection && selection.rangeCount > 0) {
      const selectionRange = selection.getRangeAt(0);
      if (!selectionRange.collapsed && isRangeInsideElement(selectionRange, element)) {
        range = selectionRange;
      }
    }

    // Some editors (e.g. Teams) lose selection when user clicks Replace button.
    // Fallback: reconstruct a range by locating the originally selected text.
    if (!range && originalSelectedText) {
      range = findRangeBySelectedText(element, originalSelectedText);
    }

    if (!range || range.collapsed) {
      return {
        success: false,
        error: 'No selection available for replacement',
      };
    }
    
    // Focus the element
    element.focus();
    
    // Delete the selected content
    range.deleteContents();
    
    // Create a text node with the new content
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    const nextSelection = globalThis.getSelection?.() ?? null;
    if (nextSelection) {
      const caretRange = document.createRange();
      caretRange.setStartAfter(textNode);
      caretRange.setEndAfter(textNode);
      nextSelection.removeAllRanges();
      nextSelection.addRange(caretRange);
    }
    
    // Normalize to merge adjacent text nodes
    element.normalize();
    
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
      textarea.remove();
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
  if (context.elementType !== 'contenteditable' && !validateSelectionForReplacement(context)) {
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
      result = replaceInContentEditable(element, newText, context.selectedText);
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
