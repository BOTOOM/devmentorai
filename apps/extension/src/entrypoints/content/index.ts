/**
 * Content script for DevMentorAI extension
 * Handles text selection, floating bubble, quick action toolbar, and context extraction
 */

import { createFloatingBubble, removeFloatingBubble } from './FloatingBubble';
import { createSelectionToolbar, removeSelectionToolbar } from './SelectionToolbar';
import { 
  extractContext, 
  detectPlatform, 
  extractErrors,
  startRuntimeErrorCapture,
  startConsoleCapture,
  startNetworkErrorCapture,
} from '../../lib/context-extractor';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  
  main() {
    console.log('[DevMentorAI] Content script loaded on:', window.location.href);

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
      
      // Selection retrieval
      if (message.type === 'GET_SELECTION') {
        const selection = window.getSelection();
        sendResponse({
          selectedText: selection?.toString() || null,
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
        sendResponse({
          url: window.location.href,
          title: document.title,
          selectedText: window.getSelection()?.toString() || null,
        });
        return true;
      }

      // Unknown message type - return false to allow other listeners
      return false;
    });

    // Track selection changes for toolbar
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);

    // Load user preferences
    loadPreferences();

    function handleMouseUp(e: MouseEvent) {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';

        if (selectedText.length > 3) {
          // Get selection position
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            showToolbar(rect, selectedText, e);
            isToolbarVisible = true;
          }
        } else if (isToolbarVisible) {
          // Check if click is outside toolbar
          const toolbar = document.getElementById('devmentorai-selection-toolbar');
          if (toolbar && !toolbar.contains(e.target as Node)) {
            removeSelectionToolbar();
            isToolbarVisible = false;
          }
        }
      }, 10);
    }

    function handleKeyUp(e: KeyboardEvent) {
      // Handle selection via keyboard (Shift+Arrow keys)
      if (e.shiftKey) {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';

        if (selectedText.length > 3) {
          const range = selection?.getRangeAt(0);
          if (range) {
            const rect = range.getBoundingClientRect();
            showToolbar(rect, selectedText);
            isToolbarVisible = true;
          }
        }
      }
    }

    function handleMouseDown(e: MouseEvent) {
      // Hide toolbar when clicking outside
      if (isToolbarVisible) {
        const toolbar = document.getElementById('devmentorai-selection-toolbar');
        if (toolbar && !toolbar.contains(e.target as Node)) {
          removeSelectionToolbar();
          isToolbarVisible = false;
        }
      }
    }

    function showToolbar(rect: DOMRect, selectedText: string, e?: MouseEvent) {
      // Position toolbar above selection
      const x = e ? e.clientX : rect.left + rect.width / 2;
      const y = rect.top - 10;

      createSelectionToolbar(x, y, selectedText, (action) => {
        // Handle quick action
        handleQuickAction(action, selectedText);
        removeSelectionToolbar();
        isToolbarVisible = false;
      });
    }

    function handleQuickAction(action: string, selectedText: string) {
      // Send to background script
      chrome.runtime.sendMessage({
        type: 'QUICK_ACTION',
        action,
        selectedText,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
    }

    async function loadPreferences() {
      try {
        const result = await chrome.storage.local.get(['showSelectionToolbar', 'floatingBubbleEnabled']);
        // Preferences loaded - toolbar enabled by default
        if (result.floatingBubbleEnabled) {
          createFloatingBubble();
          isBubbleVisible = true;
        }
      } catch (error) {
        console.error('[DevMentorAI] Failed to load preferences:', error);
      }
    }
  },
});
