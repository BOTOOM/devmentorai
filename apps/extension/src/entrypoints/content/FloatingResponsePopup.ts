/**
 * Floating Response Popup Component
 * Shows AI response with streaming support and Replace/Copy actions
 */

import type { SelectionContext, TextReplacementBehavior } from '@devmentorai/shared';
import { replaceSelectedText, copyTextToClipboard } from '../../lib/text-replacer';

let popupContainer: HTMLDivElement | null = null;
let currentContent = '';
let isComplete = false;
let currentContext: SelectionContext | null = null;
let onDismissCallback: (() => void) | null = null;

interface PopupPosition {
  x: number;
  y: number;
}

/**
 * Create and show the floating response popup
 */
export function createFloatingResponsePopup(
  position: PopupPosition,
  context: SelectionContext,
  behavior: TextReplacementBehavior,
  onDismiss?: () => void
): void {
  removeFloatingResponsePopup();
  
  currentContext = context;
  currentContent = '';
  isComplete = false;
  onDismissCallback = onDismiss || null;
  
  // Create shadow host for style isolation
  popupContainer = document.createElement('div');
  popupContainer.id = 'devmentorai-response-popup';
  popupContainer.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  const shadow = popupContainer.attachShadow({ mode: 'open' });
  
  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = getStyles();
  shadow.appendChild(styles);
  
  // Create popup element
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.id = 'popup-content';
  renderLoadingState(popup);
  shadow.appendChild(popup);
  
  document.body.appendChild(popupContainer);
  
  // Position popup
  positionPopup(position);
  
  // Setup keyboard handlers
  setupKeyboardHandlers(shadow);
  
  // Attach button handlers for initial loading state (dismiss button)
  attachButtonHandlers(shadow);
  
  // Auto-replace if behavior is 'auto'
  if (behavior === 'auto') {
    // Will be handled when content is complete
  }
}

/**
 * Update the popup with streaming content
 */
export function updateFloatingResponseContent(content: string, isStreaming: boolean): void {
  console.log('[FloatingPopup] updateContent:', { hasContainer: !!popupContainer, contentLength: content.length, isStreaming });
  
  if (!popupContainer) {
    console.warn('[FloatingPopup] No container, cannot update content');
    return;
  }
  
  currentContent = content;
  isComplete = !isStreaming;
  
  const shadow = popupContainer.shadowRoot;
  if (!shadow) {
    console.warn('[FloatingPopup] No shadowRoot');
    return;
  }
  
  const popup = shadow.getElementById('popup-content');
  if (!popup) {
    console.warn('[FloatingPopup] No popup element');
    return;
  }
  
  renderContentState(popup, content, isStreaming ? 'streaming' : 'complete');
  
  // Attach button handlers
  attachButtonHandlers(shadow);
}

/**
 * Show error state in the popup
 */
export function showFloatingResponseError(error: string): void {
  if (!popupContainer) return;
  
  isComplete = true;
  
  const shadow = popupContainer.shadowRoot;
  if (!shadow) return;
  
  const popup = shadow.getElementById('popup-content');
  if (!popup) return;
  
  renderErrorState(popup, error);
  
  // Attach button handlers
  attachButtonHandlers(shadow);
}

/**
 * Show success notice briefly then dismiss
 */
export function showSuccessNotice(message: string): void {
  if (!popupContainer) return;
  
  const shadow = popupContainer.shadowRoot;
  if (!shadow) return;
  
  const popup = shadow.getElementById('popup-content');
  if (!popup) return;
  
  renderSuccessState(popup, message);
  
  // Auto-dismiss after delay
  setTimeout(() => {
    removeFloatingResponsePopup();
  }, 1500);
}

/**
 * Remove the popup
 */
export function removeFloatingResponsePopup(): void {
  if (popupContainer) {
    popupContainer.remove();
    popupContainer = null;
  }
  currentContent = '';
  isComplete = false;
  currentContext = null;
  if (onDismissCallback) {
    onDismissCallback();
    onDismissCallback = null;
  }
}

/**
 * Check if popup is currently visible
 */
export function isFloatingResponsePopupVisible(): boolean {
  return popupContainer !== null;
}

/**
 * Get current popup content
 */
export function getCurrentContent(): string {
  return currentContent;
}

// ============================================================================
// Private Helpers
// ============================================================================

function positionPopup(position: PopupPosition): void {
  if (!popupContainer) return;
  
  const popupWidth = 360;
  const popupHeight = 200;
  const padding = 10;
  const toolbarHeight = 60; // Avoid collision with selection toolbar
  
  let left = position.x - popupWidth / 2;
  let top = position.y + toolbarHeight; // Position below toolbar
  
  // Ensure popup stays within viewport
  const maxX = window.innerWidth - popupWidth - padding;
  const maxY = window.innerHeight - popupHeight - padding;
  
  left = Math.max(padding, Math.min(left, maxX));
  top = Math.max(padding, Math.min(top, maxY));
  
  popupContainer.style.left = `${left}px`;
  popupContainer.style.top = `${top}px`;
}

function setupKeyboardHandlers(_shadow: ShadowRoot): void {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      removeFloatingResponsePopup();
    } else if (e.key === 'Enter' && isComplete && currentContent) {
      e.preventDefault();
      e.stopPropagation();
      handleReplace();
    }
  };
  
  document.addEventListener('keydown', handleKeydown);
  
  // Cleanup on popup removal (stored in container for access)
  if (popupContainer) {
    (popupContainer as any).__keydownHandler = handleKeydown;
  }
}

function attachButtonHandlers(shadow: ShadowRoot): void {
  console.log('[FloatingPopup] attachButtonHandlers called');
  
  // Use event delegation on the popup content instead of individual button handlers
  const popup = shadow.getElementById('popup-content');
  if (!popup) {
    console.warn('[FloatingPopup] No popup element for event delegation');
    return;
  }
  
  // Remove existing handler if any
  const existingHandler = (popup as any).__clickHandler;
  if (existingHandler) {
    popup.removeEventListener('click', existingHandler);
  }
  
  // Create and store new handler
  const clickHandler = (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;
    
    const buttonId = button.id;
    console.log('[FloatingPopup] Button clicked:', buttonId, { 
      currentContent: currentContent?.substring(0, 50), 
      isComplete,
      hasContext: !!currentContext 
    });
    
    e.preventDefault();
    e.stopPropagation();
    
    if (buttonId === 'btn-replace') {
      handleReplace();
    } else if (buttonId === 'btn-copy') {
      handleCopy();
    } else if (buttonId === 'btn-dismiss') {
      removeFloatingResponsePopup();
    }
  };
  
  (popup as any).__clickHandler = clickHandler;
  popup.addEventListener('click', clickHandler);
}

async function handleReplace(): Promise<void> {
  console.log('[FloatingPopup] handleReplace:', { 
    hasContext: !!currentContext, 
    contentLength: currentContent?.length,
    targetId: currentContext?.targetElementId 
  });
  
  if (!currentContext || !currentContent) {
    console.warn('[FloatingPopup] Cannot replace - missing context or content');
    return;
  }
  
  const result = await replaceSelectedText(currentContext, currentContent);
  console.log('[FloatingPopup] Replace result:', result);
  
  if (result.success) {
    showSuccessNotice('Text replaced ✓');
  } else if (result.copiedToClipboard) {
    showSuccessNotice('Copied to clipboard');
  } else {
    showFloatingResponseError(result.error || 'Failed to replace text');
  }
}

async function handleCopy(): Promise<void> {
  console.log('[FloatingPopup] handleCopy:', { contentLength: currentContent?.length });
  
  if (!currentContent) {
    console.warn('[FloatingPopup] Cannot copy - no content');
    return;
  }
  
  const success = await copyTextToClipboard(currentContent);
  console.log('[FloatingPopup] Copy success:', success);
  
  if (success) {
    showSuccessNotice('Copied to clipboard ✓');
  } else {
    showFloatingResponseError('Failed to copy to clipboard');
  }
}

function getStyles(): string {
  return `
    .popup {
      width: 360px;
      max-height: 300px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.08);
      overflow: hidden;
      animation: slideIn 0.2s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      color: white;
    }
    
    .header-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .dismiss-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      opacity: 0.8;
      transition: opacity 0.15s;
      font-size: 16px;
      line-height: 1;
    }
    
    .dismiss-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .content {
      padding: 12px 14px;
      max-height: 180px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.5;
      color: #374151;
    }
    
    .content-text {
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px;
      color: #6b7280;
    }
    
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .streaming-indicator {
      display: inline-block;
      width: 6px;
      height: 14px;
      background: #3b82f6;
      margin-left: 2px;
      animation: blink 0.8s infinite;
    }
    
    @keyframes blink {
      50% { opacity: 0.3; }
    }
    
    .actions {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #f3f4f6;
      background: #fafafa;
    }
    
    .action-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }
    
    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #e5e7eb;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
    }
    
    .error {
      padding: 12px 14px;
      color: #dc2626;
      background: #fef2f2;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .success {
      padding: 20px;
      text-align: center;
      color: #059669;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      animation: fadeIn 0.2s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .kbd {
      display: inline-block;
      padding: 2px 5px;
      font-size: 11px;
      font-family: monospace;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 3px;
      margin-left: 4px;
    }
    
    /* Dark mode support - detect via media query */
    @media (prefers-color-scheme: dark) {
      .popup {
        background: #1f2937;
        border-color: rgba(255, 255, 255, 0.1);
      }
      
      .content {
        color: #e5e7eb;
      }
      
      .loading {
        color: #9ca3af;
      }
      
      .actions {
        background: #111827;
        border-color: #374151;
      }
      
      .btn-secondary {
        background: #374151;
        color: #e5e7eb;
        border-color: #4b5563;
      }
      
      .btn-secondary:hover:not(:disabled) {
        background: #4b5563;
        border-color: #6b7280;
      }
      
      .error {
        background: #450a0a;
        color: #fca5a5;
      }
    }
  `;
}

function createHeader(): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'header';

  const title = document.createElement('span');
  title.className = 'header-title';
  title.textContent = '✨ AI Response';

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'dismiss-btn';
  dismissBtn.id = 'btn-dismiss';
  dismissBtn.title = 'Dismiss (Esc)';
  dismissBtn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(dismissBtn);

  return header;
}

function renderLoadingState(popup: HTMLElement): void {
  const loading = document.createElement('div');
  loading.className = 'loading';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  const text = document.createElement('span');
  text.textContent = 'Generating response...';

  loading.appendChild(spinner);
  loading.appendChild(text);

  popup.replaceChildren(createHeader(), loading);
}

function renderContentState(popup: HTMLElement, content: string, status: 'streaming' | 'complete'): void {
  const isStreaming = status === 'streaming';

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content';

  const contentText = document.createElement('div');
  contentText.className = 'content-text';
  contentText.textContent = content;

  if (isStreaming) {
    const streamingIndicator = document.createElement('span');
    streamingIndicator.className = 'streaming-indicator';
    contentText.appendChild(streamingIndicator);
  }

  contentWrapper.appendChild(contentText);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const replaceBtn = document.createElement('button');
  replaceBtn.className = 'action-btn btn-primary';
  replaceBtn.id = 'btn-replace';
  replaceBtn.disabled = isStreaming;
  replaceBtn.appendChild(document.createTextNode('↩️ Replace'));
  const kbd = document.createElement('span');
  kbd.className = 'kbd';
  kbd.textContent = '↵';
  replaceBtn.appendChild(kbd);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn btn-secondary';
  copyBtn.id = 'btn-copy';
  copyBtn.disabled = isStreaming;
  copyBtn.textContent = '📋 Copy';

  actions.appendChild(replaceBtn);
  actions.appendChild(copyBtn);

  popup.replaceChildren(createHeader(), contentWrapper, actions);
}

function renderErrorState(popup: HTMLElement, error: string): void {
  const errorBlock = document.createElement('div');
  errorBlock.className = 'error';
  errorBlock.textContent = `⚠️ ${error}`;

  const actions = document.createElement('div');
  actions.className = 'actions';

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'action-btn btn-secondary';
  dismissBtn.id = 'btn-dismiss';
  dismissBtn.textContent = 'Dismiss';
  actions.appendChild(dismissBtn);

  popup.replaceChildren(createHeader(), errorBlock, actions);
}

function renderSuccessState(popup: HTMLElement, message: string): void {
  const successBlock = document.createElement('div');
  successBlock.className = 'success';
  successBlock.textContent = message;
  popup.replaceChildren(successBlock);
}
