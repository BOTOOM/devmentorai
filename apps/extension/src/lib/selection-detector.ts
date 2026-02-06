/**
 * Selection Detector Utility
 * Detects and captures context about text selections in editable fields
 */

import type { SelectionContext, SelectionElementType } from '@devmentorai/shared';

// Attribute used to identify elements for later targeting
const TARGET_ID_ATTR = 'data-devmentorai-target-id';

// Counter for generating unique IDs
let targetIdCounter = 0;

/**
 * Generate a unique target element ID
 */
function generateTargetId(): string {
  return `devmentorai-target-${Date.now()}-${++targetIdCounter}`;
}

/**
 * Check if an element is a text input (not checkbox, radio, etc.)
 */
function isTextInput(element: HTMLInputElement): boolean {
  const textTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
  return textTypes.includes(element.type.toLowerCase());
}

/**
 * Check if an element is editable (not disabled or readonly)
 */
function isElementEditable(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  
  // For contenteditable, check the attribute
  if (element.isContentEditable) {
    return true;
  }
  
  return false;
}

/**
 * Find the contenteditable ancestor of an element
 */
function findContentEditableAncestor(element: Element | null): HTMLElement | null {
  while (element) {
    if (element instanceof HTMLElement && element.isContentEditable) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

/**
 * Get or create a target ID for an element
 */
function getOrCreateTargetId(element: HTMLElement): string {
  let targetId = element.getAttribute(TARGET_ID_ATTR);
  if (!targetId) {
    targetId = generateTargetId();
    element.setAttribute(TARGET_ID_ATTR, targetId);
  }
  return targetId;
}

/**
 * Find an element by its target ID
 */
export function findElementByTargetId(targetId: string): HTMLElement | null {
  return document.querySelector(`[${TARGET_ID_ATTR}="${targetId}"]`);
}

/**
 * Detect the current selection and return context information
 * This is the main entry point for selection detection
 */
export function detectSelection(): SelectionContext | null {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';
  
  if (!selectedText) {
    return null;
  }
  
  // Get the active element (where focus is)
  const activeElement = document.activeElement;
  
  // Check for input/textarea selection
  if (activeElement instanceof HTMLInputElement && isTextInput(activeElement)) {
    const selectionStart = activeElement.selectionStart ?? 0;
    const selectionEnd = activeElement.selectionEnd ?? 0;
    
    // Verify there's actually a selection
    if (selectionStart === selectionEnd) {
      return null;
    }
    
    const isEditable = isElementEditable(activeElement);
    
    return {
      selectedText: activeElement.value.substring(selectionStart, selectionEnd),
      elementType: 'input',
      isEditable,
      isReplaceable: isEditable && selectionStart !== selectionEnd,
      selectionStart,
      selectionEnd,
      targetElementId: isEditable ? getOrCreateTargetId(activeElement) : undefined,
    };
  }
  
  if (activeElement instanceof HTMLTextAreaElement) {
    const selectionStart = activeElement.selectionStart ?? 0;
    const selectionEnd = activeElement.selectionEnd ?? 0;
    
    // Verify there's actually a selection
    if (selectionStart === selectionEnd) {
      return null;
    }
    
    const isEditable = isElementEditable(activeElement);
    
    return {
      selectedText: activeElement.value.substring(selectionStart, selectionEnd),
      elementType: 'textarea',
      isEditable,
      isReplaceable: isEditable && selectionStart !== selectionEnd,
      selectionStart,
      selectionEnd,
      targetElementId: isEditable ? getOrCreateTargetId(activeElement) : undefined,
    };
  }
  
  // Check for contenteditable selection
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    const startElement = startContainer instanceof Element 
      ? startContainer 
      : startContainer.parentElement;
    
    const contentEditableElement = findContentEditableAncestor(startElement);
    
    if (contentEditableElement) {
      const isEditable = !contentEditableElement.hasAttribute('contenteditable') || 
                         contentEditableElement.getAttribute('contenteditable') !== 'false';
      
      return {
        selectedText,
        elementType: 'contenteditable',
        isEditable,
        isReplaceable: isEditable && !range.collapsed,
        targetElementId: isEditable ? getOrCreateTargetId(contentEditableElement) : undefined,
      };
    }
  }
  
  // Selection is in a non-editable element
  return {
    selectedText,
    elementType: 'other',
    isEditable: false,
    isReplaceable: false,
  };
}

/**
 * Get selection context for input/textarea elements
 * Returns current selection positions for the focused element
 */
export function getInputSelectionInfo(): { start: number; end: number } | null {
  const activeElement = document.activeElement;
  
  if (activeElement instanceof HTMLInputElement && isTextInput(activeElement)) {
    return {
      start: activeElement.selectionStart ?? 0,
      end: activeElement.selectionEnd ?? 0,
    };
  }
  
  if (activeElement instanceof HTMLTextAreaElement) {
    return {
      start: activeElement.selectionStart ?? 0,
      end: activeElement.selectionEnd ?? 0,
    };
  }
  
  return null;
}

/**
 * Check if the current selection is still valid for replacement
 * Call this before attempting replacement to ensure the context hasn't changed
 */
export function validateSelectionForReplacement(context: SelectionContext): boolean {
  if (!context.isReplaceable || !context.targetElementId) {
    return false;
  }
  
  const element = findElementByTargetId(context.targetElementId);
  if (!element) {
    return false;
  }
  
  // Check if element is still in DOM and editable
  if (!document.contains(element)) {
    return false;
  }
  
  if (!isElementEditable(element)) {
    return false;
  }
  
  // For input/textarea, verify selection positions are still valid
  if (context.elementType === 'input' || context.elementType === 'textarea') {
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
    const currentStart = inputElement.selectionStart ?? 0;
    const currentEnd = inputElement.selectionEnd ?? 0;
    
    // Selection must still exist and match original positions
    if (currentStart === currentEnd) {
      return false;
    }
    
    if (context.selectionStart !== undefined && context.selectionEnd !== undefined) {
      // Allow some tolerance - the important thing is that text is selected
      // The user might have adjusted the selection slightly
      return currentStart !== currentEnd;
    }
  }
  
  // For contenteditable, check if there's still an active selection
  if (context.elementType === 'contenteditable') {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return false;
    }
    
    // Verify selection is still within the same contenteditable element
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer instanceof Element 
      ? range.startContainer 
      : range.startContainer.parentElement;
    
    const contentEditableAncestor = findContentEditableAncestor(startElement);
    if (!contentEditableAncestor || contentEditableAncestor !== element) {
      return false;
    }
  }
  
  return true;
}

/**
 * Clear the target ID from an element (cleanup)
 */
export function clearTargetId(targetId: string): void {
  const element = findElementByTargetId(targetId);
  if (element) {
    element.removeAttribute(TARGET_ID_ATTR);
  }
}
