/**
 * Background service worker for DevMentorAI extension
 */

import type { SelectionContext, TextReplacementBehavior } from '@devmentorai/shared';
import { streamQuickAction } from '../services/writing-assistant-session';
import { setupUpdateAlarm, getUpdateState, forceUpdateCheck, dismissUpdateBadge } from '../services/update-checker';

/**
 * Get language name from code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    it: 'Italian',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
    ru: 'Russian',
  };
  return languages[code] || 'English';
}

export default defineBackground(() => {
  console.log('[DevMentorAI] Background service worker started');

  // Set up update checker
  setupUpdateAlarm();

  // Set up side panel behavior (Chrome only)
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true })
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

    // Tone submenu for rewrite
    chrome.contextMenus.create({
      id: 'devmentorai-tone',
      parentId: 'devmentorai-parent',
      title: '🎨 Rewrite with tone...',
      contexts: ['selection'],
    });

    const tones = [
      { id: 'formal', title: '👔 Formal' },
      { id: 'casual', title: '😊 Casual' },
      { id: 'technical', title: '⚙️ Technical' },
      { id: 'friendly', title: '🤝 Friendly' },
      { id: 'professional', title: '💼 Professional' },
    ];

    for (const tone of tones) {
      chrome.contextMenus.create({
        id: `devmentorai-rewrite_${tone.id}`,
        parentId: 'devmentorai-tone',
        title: tone.title,
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
  if (!menuId.startsWith('devmentorai-') || menuId === 'devmentorai-parent' || menuId === 'devmentorai-tone') {
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
  message: { type: string; payload?: unknown; selectedText?: string },
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
      // Clear the pending action and badge
      await chrome.storage.local.remove('pendingAction');
      chrome.action?.setBadgeText({ text: '' });
      break;
    }

    case 'OPEN_SIDE_PANEL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        chrome.sidePanel?.open({ windowId: tab.windowId });
      }
      sendResponse({ success: true });
      break;
    }

    case 'OPEN_SIDE_PANEL_WITH_TEXT': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId) {
        // Store text to be used in chat
        await chrome.storage.local.set({
          pendingAction: {
            action: 'chat',
            selectedText: message.selectedText,
            pageUrl: tab.url,
            pageTitle: tab.title,
            timestamp: Date.now(),
          },
        });
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      sendResponse({ success: true });
      break;
    }

    case 'QUICK_ACTION': {
      const { action, selectedText, pageUrl, pageTitle, selectionContext, textReplacementBehavior } = message as {
        type: string;
        action: string;
        selectedText: string;
        pageUrl: string;
        pageTitle: string;
        selectionContext?: SelectionContext;
        textReplacementBehavior?: TextReplacementBehavior;
      };
      
      // Check if this is a replaceable action (from editable field)
      const isReplaceable = selectionContext?.isReplaceable && 
                            textReplacementBehavior !== 'never';
      
      if (isReplaceable && sender.tab?.id) {
        // Stream the response to content script for inline replacement
        await handleStreamingQuickAction(
          sender.tab.id,
          action,
          selectedText,
          pageUrl,
          pageTitle,
          true // isReplaceable - use target language for translations
        );
        sendResponse({ success: true, streamed: true });
      } else {
        // Fallback to traditional sidepanel flow
        await chrome.storage.local.set({
          pendingAction: {
            action,
            selectedText,
            pageUrl,
            pageTitle,
            timestamp: Date.now(),
          },
        });

        // Show badge to indicate pending action (Chrome only)
        chrome.action?.setBadgeText({ text: '1' });
        chrome.action?.setBadgeBackgroundColor({ color: '#3b82f6' });

        // Try to open side panel, but don't fail if we can't due to user gesture requirement
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            chrome.sidePanel?.open({ windowId: tab.windowId });
            // Clear badge if we successfully opened
            chrome.action?.setBadgeText({ text: '' });
          }
        } catch (err) {
          // User needs to click the extension icon to see the pending action
          console.log('[DevMentorAI] Stored pending action, user needs to open side panel');
        }
        
        sendResponse({ success: true, streamed: false });
      }
      break;
    }

    case 'TOGGLE_FLOATING_BUBBLE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_BUBBLE' });
          sendResponse(response);
        } catch {
          sendResponse({ visible: false, error: 'Content script not available' });
        }
      }
      break;
    }

    case 'GET_SETTINGS': {
      const settings = await chrome.storage.local.get([
        'theme',
        'floatingBubbleEnabled',
        'showSelectionToolbar',
        'defaultSessionType',
        'language',
        'textReplacementBehavior',
        'quickActionModel',
      ]);
      sendResponse(settings);
      break;
    }

    case 'CHECK_UPDATES': {
      const updateState = await forceUpdateCheck();
      sendResponse(updateState);
      break;
    }

    case 'GET_UPDATE_STATE': {
      const state = await getUpdateState();
      sendResponse(state);
      break;
    }

    case 'DISMISS_UPDATE_BADGE': {
      await dismissUpdateBadge();
      sendResponse({ success: true });
      break;
    }

    case 'SAVE_SETTINGS': {
      const { settings } = message as { type: string; settings: Record<string, unknown> };
      await chrome.storage.local.set(settings);
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

/**
 * Build prompt for quick action
 * @param action - The action type
 * @param selectedText - The text to process
 * @param targetLanguage - Target language for translation (optional)
 */
function buildQuickActionPrompt(action: string, selectedText: string, targetLanguage?: string): string {
  const actionPrompts: Record<string, string> = {
    explain: `Explain the following text clearly and concisely:\n\n${selectedText}`,
    translate: targetLanguage 
      ? `Translate the following text to ${targetLanguage}. Return only the translated text without any explanation:\n\n${selectedText}`
      : `Translate the following text:\n\n${selectedText}`,
    rewrite: `Rewrite the following text for clarity and improved style. Return only the rewritten text without any explanation:\n\n${selectedText}`,
    fix_grammar: `Fix the grammar and spelling in the following text. Return only the corrected text without any explanation:\n\n${selectedText}`,
    summarize: `Summarize the following text briefly:\n\n${selectedText}`,
    expand: `Expand on the following text with more details:\n\n${selectedText}`,
  };
  
  // Handle tone-specific rewrites
  if (action.startsWith('rewrite_')) {
    const tone = action.replace('rewrite_', '');
    return `Rewrite the following text in a ${tone} tone. Return only the rewritten text without any explanation:\n\n${selectedText}`;
  }
  
  return actionPrompts[action] || `Process the following text:\n\n${selectedText}`;
}

/**
 * Handle streaming quick action to content script
 * @param isReplaceable - Whether the action is from an editable field (affects translation language)
 */
async function handleStreamingQuickAction(
  tabId: number,
  action: string,
  selectedText: string,
  _pageUrl: string,
  _pageTitle: string,
  isReplaceable: boolean = true
): Promise<void> {
  const actionId = `qa-${Date.now()}`;
  
  // Clear any pending action to prevent duplicate processing by SidePanel
  await chrome.storage.local.remove('pendingAction');
  
  // Get settings
  const settings = await chrome.storage.local.get([
    'quickActionModel', 
    'translationLanguage',      // Native language (for reading)
    'targetTranslationLanguage' // Target language (for writing)
  ]);
  const model = settings.quickActionModel || 'gpt-4.1';
  
  // Smart translation: use target language for editable fields, native for reading
  let targetLanguage: string | undefined;
  if (action === 'translate') {
    const nativeLanguage = getLanguageName(settings.translationLanguage || 'es');
    const outputLanguage = getLanguageName(settings.targetTranslationLanguage || 'en');
    targetLanguage = isReplaceable ? outputLanguage : nativeLanguage;
    console.log('[DevMentorAI] Smart translate:', { isReplaceable, targetLanguage });
  }
  
  // Build the prompt with optional target language
  const prompt = buildQuickActionPrompt(action, selectedText, targetLanguage);
  
  // Send stream start message to content script
  try {
    console.log('[DevMentorAI] Sending STREAM_START to tab', tabId, 'for action:', action);
    await chrome.tabs.sendMessage(tabId, {
      type: 'QUICK_ACTION_STREAM_START',
      actionId,
      action,
    });
  } catch (err) {
    console.error('[DevMentorAI] Failed to send stream start:', err);
    return;
  }
  
  // Stream the response
  try {
    console.log('[DevMentorAI] Starting streamQuickAction...');
    await streamQuickAction(
      prompt,
      model,
      async (event) => {
        try {
          console.log('[DevMentorAI] Stream event:', event.type, { contentLength: event.content?.length });
          switch (event.type) {
            case 'start':
              // Already sent stream start
              break;
              
            case 'delta':
              console.log('[DevMentorAI] Sending STREAM_DELTA, content length:', event.content?.length);
              await chrome.tabs.sendMessage(tabId, {
                type: 'QUICK_ACTION_STREAM_DELTA',
                actionId,
                delta: '',
                fullContent: event.content || '',
              });
              break;
              
            case 'complete':
              console.log('[DevMentorAI] Sending STREAM_COMPLETE to tab', tabId, 'content length:', event.content?.length);
              await chrome.tabs.sendMessage(tabId, {
                type: 'QUICK_ACTION_STREAM_COMPLETE',
                actionId,
                finalContent: event.content || '',
              });
              
              // NOTE: Do NOT store pendingAction here to avoid duplicate processing
              // The streaming flow handles the response inline via the floating popup
              break;
              
            case 'error':
              await chrome.tabs.sendMessage(tabId, {
                type: 'QUICK_ACTION_STREAM_ERROR',
                actionId,
                error: event.error || 'Unknown error',
              });
              break;
          }
        } catch (error_) {
          console.error('[DevMentorAI] Failed to send stream event:', error_);
        }
      }
    );
  } catch (error_) {
    console.error('[DevMentorAI] Streaming quick action failed:', error_);
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'QUICK_ACTION_STREAM_ERROR',
        actionId,
        error: error_ instanceof Error ? error_.message : 'Unknown error',
      });
    } catch {
      // Content script may not be available
    }
  }
}
