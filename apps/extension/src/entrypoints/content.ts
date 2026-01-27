/**
 * Content script for DevMentorAI extension
 * Handles text selection and page context capture
 */

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[DevMentorAI] Content script loaded');

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_SELECTION') {
        const selection = window.getSelection();
        sendResponse({
          selectedText: selection?.toString() || null,
        });
      }
      return true;
    });

    // Track selection changes for potential floating UI (Phase 2)
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
  },
});

let lastSelection = '';

function handleSelectionChange() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  if (selectedText !== lastSelection && selectedText.length > 0) {
    lastSelection = selectedText;
    // Could emit event for floating UI in Phase 2
    // console.log('[DevMentorAI] Selection changed:', selectedText.substring(0, 50));
  }
}
