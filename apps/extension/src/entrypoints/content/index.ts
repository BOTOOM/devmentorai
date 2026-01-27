/**
 * Content script for DevMentorAI extension
 * Handles text selection, floating bubble, and quick action toolbar
 */

import { createFloatingBubble, removeFloatingBubble } from './FloatingBubble';
import { createSelectionToolbar, removeSelectionToolbar } from './SelectionToolbar';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  
  main() {
    console.log('[DevMentorAI] Content script loaded');

    let isToolbarVisible = false;
    let isBubbleVisible = false;

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_SELECTION') {
        const selection = window.getSelection();
        sendResponse({
          selectedText: selection?.toString() || null,
        });
      }
      
      if (message.type === 'TOGGLE_BUBBLE') {
        if (isBubbleVisible) {
          removeFloatingBubble();
          isBubbleVisible = false;
        } else {
          createFloatingBubble();
          isBubbleVisible = true;
        }
        sendResponse({ visible: isBubbleVisible });
      }
      
      if (message.type === 'GET_PAGE_CONTEXT') {
        sendResponse({
          url: window.location.href,
          title: document.title,
          selectedText: window.getSelection()?.toString() || null,
        });
      }
      
      return true;
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
