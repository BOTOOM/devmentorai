/**
 * Content script for DevMentorAI extension
 * Handles text selection, floating bubble, quick action toolbar, and context extraction
 */

import { createFloatingBubble, removeFloatingBubble } from './FloatingBubble';
import { createSelectionToolbar, removeSelectionToolbar } from './SelectionToolbar';
import {
  createFloatingResponsePopup,
  updateFloatingResponseContent,
  showFloatingResponseError,
  isFloatingResponsePopupVisible,
  showSuccessNotice,
} from './FloatingResponsePopup';
import { 
  extractContext, 
  detectPlatform, 
  extractErrors,
  startRuntimeErrorCapture,
  startConsoleCapture,
  startNetworkErrorCapture,
} from '../../lib/context-extractor';
import { storageGet } from '../../lib/browser-utils';
import { detectSelection } from '../../lib/selection-detector';
import { replaceSelectedText } from '../../lib/text-replacer';
import type { SelectionContext, TextReplacementBehavior, QuickActionStreamMessage } from '@devmentorai/shared';

const QUICK_ACTION_CONNECTION_HINT = 'Please check if the local DevMentorAI server is running.';

function isLikelyQuickActionConnectionError(error: string): boolean {
  const normalized = error.toLowerCase();

  return [
    'failed to fetch',
    'networkerror',
    'network error',
    'econnrefused',
    'connection refused',
    'stream request failed',
    'failed to get writing assistant session',
  ].some((token) => normalized.includes(token));
}

function formatQuickActionError(error: string): string {
  const normalized = error.trim() || 'Connection error';

  if (!isLikelyQuickActionConnectionError(normalized)) {
    return normalized;
  }

  if (normalized.toLowerCase().includes('server is running')) {
    return normalized;
  }

  if (normalized.endsWith('.')) {
    return `${normalized} ${QUICK_ACTION_CONNECTION_HINT}`;
  }

  return `${normalized}. ${QUICK_ACTION_CONNECTION_HINT}`;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  
  main() {
    console.log('[DevMentorAI] Content script loaded on:', globalThis.location.href);

    // Start capturing runtime errors, console logs, and network errors
    // These run passively and collect data for context extraction
    try {
      startRuntimeErrorCapture();
      startConsoleCapture();
      startNetworkErrorCapture();
      console.log('[DevMentorAI] Error capture initialized');
    } catch (e) {
      console.warn('[DevMentorAI] Failed to initialize error capture:', e);
    }

    let isToolbarVisible = false;
    let isBubbleVisible = false;
    let currentSelectionContext: SelectionContext | null = null;
    let currentTextReplacementBehavior: TextReplacementBehavior = 'ask';
    let lastSelectionRect: DOMRect | null = null;
    
    // Store pending action context - preserved even when toolbar is dismissed
    let pendingQuickActionContext: SelectionContext | null = null;
    let pendingQuickActionRect: DOMRect | null = null;

    // Unified message listener for all message types
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log('[DevMentorAI] Received message:', message.type);
      
      // Health check ping - used to verify content script is loaded
      if (message.type === 'PING') {
        sendResponse({ pong: true });
        return true;
      }
      
      // Context extraction
      if (message.type === 'EXTRACT_CONTEXT') {
        try {
          const result = extractContext(message.options || {});
          sendResponse(result);
        } catch (error) {
          console.error('[DevMentorAI] Context extraction error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown extraction error',
            extractionTimeMs: 0,
          });
        }
        return true;
      }
      
      // Platform detection
      if (message.type === 'GET_PLATFORM') {
        const platform = detectPlatform();
        sendResponse({ platform });
        return true;
      }
      
      // Error extraction
      if (message.type === 'GET_ERRORS') {
        const errors = extractErrors();
        sendResponse({ errors });
        return true;
      }
      
      // Selection retrieval (enhanced with editable context)
      if (message.type === 'GET_SELECTION') {
        const selectionContext = detectSelection();
        sendResponse({
          selectedText: selectionContext?.selectedText || null,
          selectionContext,
        });
        return true;
      }
      
      // Floating bubble toggle
      if (message.type === 'TOGGLE_BUBBLE') {
        if (isBubbleVisible) {
          removeFloatingBubble();
          isBubbleVisible = false;
        } else {
          createFloatingBubble();
          isBubbleVisible = true;
        }
        sendResponse({ visible: isBubbleVisible });
        return true;
      }
      
      // Page context (lightweight)
      if (message.type === 'GET_PAGE_CONTEXT') {
        const selectionContext = detectSelection();
        sendResponse({
          url: globalThis.location.href,
          title: document.title,
          selectedText: selectionContext?.selectedText || null,
          selectionContext,
        });
        return true;
      }

      // Quick action stream messages
      if (message.type === 'QUICK_ACTION_STREAM_START') {
        // Use pending context first, fallback to current
        const contextToUse = pendingQuickActionContext || currentSelectionContext;
        const rectToUse = pendingQuickActionRect || lastSelectionRect;
        
        console.log('[DevMentorAI] Stream START received', { 
          hasContext: !!contextToUse, 
          hasRect: !!rectToUse,
          isReplaceable: contextToUse?.isReplaceable,
          usedPending: !!pendingQuickActionContext,
        });
        
        const streamMsg = message as QuickActionStreamMessage;
        if (streamMsg.type === 'QUICK_ACTION_STREAM_START' && contextToUse && rectToUse) {
          // Show floating popup for streaming response
          createFloatingResponsePopup(
            { x: rectToUse.left + rectToUse.width / 2, y: rectToUse.bottom },
            contextToUse,
            currentTextReplacementBehavior,
            () => {
              // Cleanup on dismiss
              currentSelectionContext = null;
              pendingQuickActionContext = null;
              pendingQuickActionRect = null;
            }
          );
          console.log('[DevMentorAI] Popup created');
          
          // Clear pending since we've used it
          pendingQuickActionContext = null;
          pendingQuickActionRect = null;
        } else {
          console.warn('[DevMentorAI] Cannot create popup - missing context or rect');
        }
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'QUICK_ACTION_STREAM_DELTA') {
        console.log('[DevMentorAI] Stream DELTA received, length:', message.fullContent?.length);
        const streamMsg = message as QuickActionStreamMessage;
        if (streamMsg.type === 'QUICK_ACTION_STREAM_DELTA') {
          updateFloatingResponseContent(streamMsg.fullContent, true);
        }
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'QUICK_ACTION_STREAM_COMPLETE') {
        console.log('[DevMentorAI] Stream COMPLETE received, length:', message.finalContent?.length);
        const streamMsg = message as QuickActionStreamMessage;
        if (streamMsg.type === 'QUICK_ACTION_STREAM_COMPLETE') {
          updateFloatingResponseContent(streamMsg.finalContent, false);
          
          // Handle auto-replace behavior
          if (currentTextReplacementBehavior === 'auto' && currentSelectionContext) {
            handleAutoReplace(streamMsg.finalContent);
          }
        }
        sendResponse({ success: true });
        return true;
      }
      
      if (message.type === 'QUICK_ACTION_STREAM_ERROR') {
        console.log('[DevMentorAI] Stream ERROR received:', message.error);
        const streamMsg = message as QuickActionStreamMessage;
        if (streamMsg.type === 'QUICK_ACTION_STREAM_ERROR') {
          showFloatingResponseError(formatQuickActionError(streamMsg.error));
        }
        sendResponse({ success: true });
        return true;
      }

      // Unknown message type - return false to allow other listeners
      return false;
    });

    // Handle auto-replace when behavior is set to 'auto'
    async function handleAutoReplace(content: string) {
      if (!currentSelectionContext) return;
      
      const result = await replaceSelectedText(currentSelectionContext, content);
      
      if (result.success) {
        showSuccessNotice('Text replaced ✓');
      } else if (result.copiedToClipboard) {
        showSuccessNotice('Copied to clipboard');
      } else {
        // Keep popup open with error
        showFloatingResponseError(result.error || 'Failed to replace');
      }
    }

    // Track selection changes for toolbar
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);

    // Load user preferences
    loadPreferences();

    function handleMouseUp(e: MouseEvent) {
      // IMPORTANT: Capture composedPath synchronously — it returns [] after event dispatch ends
      const toolbar = document.getElementById('devmentorai-selection-toolbar');
      const popup = document.getElementById('devmentorai-response-popup');
      const path = e.composedPath?.() || [];
      const clickedInsideToolbar = !!toolbar && path.includes(toolbar);
      const clickedInsidePopup = !!popup && path.includes(popup);
      
      // Small delay to ensure selection is complete
      setTimeout(() => {
        // If toolbar is visible and click was inside it — don't recreate
        if (isToolbarVisible && (clickedInsideToolbar || clickedInsidePopup)) {
          return;
        }
        
        if (isToolbarVisible) {
          // Click was outside toolbar — check if there's a new selection
          const selection = globalThis.getSelection?.() ?? null;
          const selectedText = selection?.toString().trim() || '';
          
          if (selectedText.length > 3) {
            // New selection — recreate toolbar at new position
            const range = selection?.getRangeAt(0);
            if (range) {
              const rect = range.getBoundingClientRect();
              lastSelectionRect = rect;
              const selectionContext = detectSelection();
              currentSelectionContext = selectionContext;
              showToolbar(rect, selectedText, selectionContext, e);
            }
          } else {
            // No selection and click outside — close toolbar
            removeSelectionToolbar();
            isToolbarVisible = false;
            if (!isFloatingResponsePopupVisible()) {
              currentSelectionContext = null;
            }
          }
          return;
        }
        
        // No toolbar visible yet — check if we should show one
        const selection = globalThis.getSelection?.() ?? null;
        const selectedText = selection?.toString().trim() || '';

        if (selectedText.length > 3) {
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            lastSelectionRect = rect;
            const selectionContext = detectSelection();
            currentSelectionContext = selectionContext;
            showToolbar(rect, selectedText, selectionContext, e);
            isToolbarVisible = true;
          }
        }
      }, 10);
    }

    function handleKeyUp(e: KeyboardEvent) {
      // Handle selection via keyboard (Shift+Arrow keys)
      if (e.shiftKey) {
        const selection = globalThis.getSelection?.() ?? null;
        const selectedText = selection?.toString().trim() || '';

        if (selectedText.length > 3) {
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            lastSelectionRect = rect;
            
            // Detect editable context
            const selectionContext = detectSelection();
            currentSelectionContext = selectionContext;
            
            showToolbar(rect, selectedText, selectionContext);
            isToolbarVisible = true;
          }
        }
      }
    }

    function handleMouseDown(e: MouseEvent) {
      // Hide toolbar when clicking outside
      if (isToolbarVisible) {
        const toolbar = document.getElementById('devmentorai-selection-toolbar');
        const popup = document.getElementById('devmentorai-response-popup');
        const path = e.composedPath?.() || [];
        const isClickInsideToolbar = !!toolbar && path.includes(toolbar);
        const isClickInsidePopup = !!popup && path.includes(popup);
        
        if (!isClickInsideToolbar && !isClickInsidePopup) {
          removeSelectionToolbar();
          isToolbarVisible = false;
        }
      }
    }

    function showToolbar(rect: DOMRect, selectedText: string, selectionContext: SelectionContext | null, e?: MouseEvent) {
      // Position toolbar above selection
      const x = e ? e.clientX : rect.left + rect.width / 2;
      const y = rect.top - 10;

      createSelectionToolbar(x, y, selectedText, (action) => {
        // Handle quick action
        handleQuickAction(action, selectedText, selectionContext);
        removeSelectionToolbar();
        isToolbarVisible = false;
      });
    }

    function handleQuickAction(action: string, selectedText: string, selectionContext: SelectionContext | null) {
      // Store the context for the pending quick action BEFORE sending
      // This ensures we have the context when STREAM_START arrives
      if (selectionContext?.isReplaceable && lastSelectionRect) {
        pendingQuickActionContext = selectionContext;
        pendingQuickActionRect = lastSelectionRect;
        console.log('[DevMentorAI] Stored pending quick action context');
      }
      
      // Send to background script with editable context
      chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action,
        selectedText,
        pageUrl: globalThis.location.href,
        pageTitle: document.title,
        selectionContext: selectionContext?.isReplaceable ? selectionContext : null,
        textReplacementBehavior: currentTextReplacementBehavior,
      });
    }

    async function loadPreferences() {
      try {
        const result = await storageGet<{
          showSelectionToolbar?: boolean;
          floatingBubbleEnabled?: boolean;
          textReplacementBehavior?: TextReplacementBehavior;
        }>([
          'showSelectionToolbar',
          'floatingBubbleEnabled',
          'textReplacementBehavior',
        ]);
        
        // Update text replacement behavior
        if (result.textReplacementBehavior) {
          currentTextReplacementBehavior = result.textReplacementBehavior;
        }
        
        // Preferences loaded - toolbar enabled by default
        if (result.floatingBubbleEnabled) {
          createFloatingBubble();
          isBubbleVisible = true;
        }
      } catch (error) {
        console.error('[DevMentorAI] Failed to load preferences:', error);
      }
    }

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      
      if (changes.textReplacementBehavior) {
        currentTextReplacementBehavior = changes.textReplacementBehavior.newValue || 'ask';
      }
      
      if (changes.floatingBubbleEnabled) {
        if (changes.floatingBubbleEnabled.newValue) {
          createFloatingBubble();
          isBubbleVisible = true;
        } else {
          removeFloatingBubble();
          isBubbleVisible = false;
        }
      }
    });
  },
});
