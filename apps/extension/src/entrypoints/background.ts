/**
 * Background service worker for DevMentorAI extension
 */

export default defineBackground(() => {
  console.log('[DevMentorAI] Background service worker started');

  // Set up side panel behavior
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[DevMentorAI] Failed to set panel behavior:', error));

  // Create context menus on install
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[DevMentorAI] Extension installed, setting up context menus');
    setupContextMenus();
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

  // Handle messages from content scripts and sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });
});

/**
 * Set up context menus for quick actions
 */
function setupContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Parent menu
    chrome.contextMenus.create({
      id: 'devmentorai-parent',
      title: 'DevMentorAI',
      contexts: ['selection'],
    });

    // Quick actions
    const actions = [
      { id: 'explain', title: chrome.i18n.getMessage('action_explain') || 'Explain this' },
      { id: 'translate', title: chrome.i18n.getMessage('action_translate') || 'Translate' },
      { id: 'rewrite', title: chrome.i18n.getMessage('action_rewrite') || 'Rewrite' },
      { id: 'fix_grammar', title: chrome.i18n.getMessage('action_fix_grammar') || 'Fix grammar' },
      { id: 'summarize', title: chrome.i18n.getMessage('action_summarize') || 'Summarize' },
    ];

    for (const action of actions) {
      chrome.contextMenus.create({
        id: `devmentorai-${action.id}`,
        parentId: 'devmentorai-parent',
        title: action.title,
        contexts: ['selection'],
      });
    }

    console.log('[DevMentorAI] Context menus created');
  });
}

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  const menuId = info.menuItemId.toString();
  if (!menuId.startsWith('devmentorai-') || menuId === 'devmentorai-parent') {
    return;
  }

  const action = menuId.replace('devmentorai-', '');
  const selectedText = info.selectionText;

  if (!selectedText || !tab?.id) {
    return;
  }

  console.log(`[DevMentorAI] Context menu action: ${action}`, { selectedText: selectedText.substring(0, 100) });

  // Store the action context for the sidepanel
  await chrome.storage.local.set({
    pendingAction: {
      action,
      selectedText,
      pageUrl: tab.url,
      pageTitle: tab.title,
      timestamp: Date.now(),
    },
  });

  // Open the side panel
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
}

/**
 * Handle messages from other parts of the extension
 */
async function handleMessage(
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) {
  console.log('[DevMentorAI] Received message:', message.type);

  switch (message.type) {
    case 'GET_PAGE_CONTEXT': {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        sendResponse({
          url: tab.url,
          title: tab.title,
        });
      } else {
        sendResponse(null);
      }
      break;
    }

    case 'GET_SELECTION': {
      // Request selection from content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
          sendResponse(response);
        } catch {
          sendResponse({ selectedText: null });
        }
      } else {
        sendResponse({ selectedText: null });
      }
      break;
    }

    case 'GET_PENDING_ACTION': {
      const result = await chrome.storage.local.get('pendingAction');
      sendResponse(result.pendingAction || null);
      // Clear the pending action
      await chrome.storage.local.remove('pendingAction');
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }
}
