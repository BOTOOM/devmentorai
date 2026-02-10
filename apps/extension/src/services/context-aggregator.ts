/**
 * Context Aggregator Service
 * 
 * Aggregates context from content scripts and prepares the context payload
 * for the backend.
 * 
 * PHASE 3 DESIGN PRINCIPLE:
 * =========================
 * This service provides PURELY FACTUAL context data. It does NOT attempt to:
 * - Detect user intent (let the LLM decide)
 * - Parse user messages for keywords (multilingual users, agent autonomy)
 * - Infer session types from message content (agent's responsibility)
 * 
 * The agent (Copilot) is fully autonomous and decides:
 * - What the user wants
 * - How to respond
 * - What context is relevant
 * 
 * Platform detection is kept because it's based on URL patterns (factual),
 * NOT on interpreting user intent.
 */

import type {
  ContextPayload,
  ContextExtractionRequest,
  ContextExtractionResponse,
  ContextSessionType,
  ContextMessage,
} from '@devmentorai/shared';

// ============================================================================
// Session Type Inference (Platform-based ONLY)
// ============================================================================

/**
 * Infer session type from platform ONLY.
 * 
 * This is based purely on where the user IS (URL), not what they SAY.
 * The agent decides what to do with the user's message.
 */
export function inferSessionTypeFromPlatform(
  platform: string,
  existingType?: ContextSessionType
): ContextSessionType {
  // If already explicitly set by user, keep it
  if (existingType && existingType !== 'general') {
    return existingType;
  }

  // Infer from platform (factual URL-based detection)
  const devopsPlatforms = ['azure', 'aws', 'gcp', 'jenkins', 'kubernetes', 'docker', 'datadog', 'grafana'];
  if (devopsPlatforms.includes(platform)) {
    return 'devops';
  }

  const codePlatforms = ['github', 'gitlab'];
  if (codePlatforms.includes(platform)) {
    return 'debugging'; // GitHub/GitLab usually means code-related help
  }

  return 'general';
}

// ============================================================================
// Content Script Injection
// ============================================================================

/**
 * Check if a URL can have content scripts injected
 */
function canInjectContentScript(url: string | undefined): boolean {
  if (!url) return false;
  
  // Cannot inject into browser internal pages
  const blockedProtocols = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'brave://',
    'opera://',
    'vivaldi://',
    'moz-extension://',
    'file://', // May work but often restricted
  ];
  
  return !blockedProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * Inject content script into a tab if not already present
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    // First, try to ping the content script to see if it's already loaded
    const isLoaded = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 500);
      
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          resolve(false);
        } else {
          resolve(response?.pong === true);
        }
      });
    });
    
    if (isLoaded) {
      console.log('[context-aggregator] Content script already loaded in tab:', tabId);
      return true;
    }
    
    // Content script not loaded, inject it programmatically
    console.log('[context-aggregator] Injecting content script into tab:', tabId);
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
    });
    
    // Wait a bit for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[context-aggregator] Content script injected successfully');
    return true;
  } catch (error) {
    console.error('[context-aggregator] Failed to inject content script:', error);
    return false;
  }
}

// ============================================================================
// Context Aggregation
// ============================================================================

export interface AggregatedContext extends ContextPayload {
  aggregationTimestamp: string;
}

/**
 * Request context extraction from the active tab's content script
 * with retry logic and programmatic injection fallback
 */
export async function requestContextFromTab(
  tabId: number,
  options: ContextExtractionRequest = {},
  retryCount: number = 2
): Promise<ContextExtractionResponse> {
  const attemptExtraction = (): Promise<ContextExtractionResponse> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[context-aggregator] Context extraction timed out for tab:', tabId);
        resolve({
          success: false,
          error: 'Context extraction timed out',
          extractionTimeMs: 5000,
        });
      }, 5000);

      try {
        console.log('[context-aggregator] Sending EXTRACT_CONTEXT to tab:', tabId);
        chrome.tabs.sendMessage(
          tabId,
          { type: 'EXTRACT_CONTEXT', options },
          (response: ContextExtractionResponse | undefined) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              console.error('[context-aggregator] chrome.runtime.lastError:', chrome.runtime.lastError);
              resolve({
                success: false,
                error: chrome.runtime.lastError.message || 'Failed to communicate with content script',
                extractionTimeMs: 0,
              });
              return;
            }

            if (!response) {
              console.warn('[context-aggregator] No response from content script');
              resolve({
                success: false,
                error: 'No response from content script',
                extractionTimeMs: 0,
              });
              return;
            }

            console.log('[context-aggregator] Received response from content script:', {
              success: response.success,
              hasContext: !!response.context,
              error: response.error,
            });
            resolve(response);
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        console.error('[context-aggregator] Exception in requestContextFromTab:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          extractionTimeMs: 0,
        });
      }
    });
  };

  // First attempt
  let result = await attemptExtraction();
  
  // If failed due to connection error, try injecting content script and retry
  if (!result.success && result.error?.includes('Could not establish connection') && retryCount > 0) {
    console.log('[context-aggregator] Connection failed, attempting to inject content script...');
    
    const injected = await ensureContentScriptInjected(tabId);
    if (injected) {
      // Retry with exponential backoff
      for (let i = 0; i < retryCount; i++) {
        const delay = Math.pow(2, i) * 200; // 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`[context-aggregator] Retry attempt ${i + 1}/${retryCount}`);
        result = await attemptExtraction();
        
        if (result.success) {
          break;
        }
      }
    }
  }
  
  return result;
}

/**
 * Get context from the currently active tab
 */
export async function getContextFromActiveTab(
  options: ContextExtractionRequest = {}
): Promise<ContextExtractionResponse> {
  try {
    console.log('[context-aggregator] Getting active tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    console.log('[context-aggregator] Active tab:', {
      id: tab?.id,
      url: tab?.url?.substring(0, 50),
      title: tab?.title?.substring(0, 50),
    });
    
    if (!tab?.id) {
      return {
        success: false,
        error: 'No active tab found',
        extractionTimeMs: 0,
      };
    }

    // Check if we can inject into this tab
    if (!canInjectContentScript(tab.url)) {
      console.warn('[context-aggregator] Cannot extract from browser internal page:', tab.url);
      return {
        success: false,
        error: 'Cannot extract context from browser internal pages',
        extractionTimeMs: 0,
        // Return minimal context with what we can get from tab info
        context: {
          page: {
            url: tab.url || '',
            title: tab.title || '',
            hostname: tab.url ? new URL(tab.url).hostname : '',
            path: '',
            platform: { type: 'unknown', confidence: 0, signals: [] },
            viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0 },
            visibility: 'visible',
            timestamp: new Date().toISOString(),
          },
          content: {
            visibleText: '',
            selectedText: undefined,
            headings: [],
            htmlSections: [],
            codeBlocks: [],
          },
          errors: [],
        } as unknown as ContextPayload,
      };
    }

    return await requestContextFromTab(tab.id, options);
  } catch (error) {
    console.error('[context-aggregator] Exception in getContextFromActiveTab:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active tab',
      extractionTimeMs: 0,
    };
  }
}

/**
 * Aggregate context with session information.
 * 
 * PHASE 3: This function provides PURELY FACTUAL data.
 * - NO intent detection from user message
 * - NO keyword parsing
 * - Session type is based on PLATFORM only (URL-based, factual)
 * - The agent decides what to do with the context
 */
export function aggregateContext(
  extractedContext: ContextPayload,
  sessionId: string,
  _userMessage: string, // Kept for API compatibility, but NOT parsed
  previousMessages: ContextMessage[] = [],
  existingSessionType?: ContextSessionType
): AggregatedContext {
  // Infer session type from PLATFORM ONLY (factual, URL-based)
  const sessionType = inferSessionTypeFromPlatform(
    extractedContext.page.platform.type,
    existingSessionType
  );

  // Return context with MINIMAL session metadata
  // The agent interprets everything - we just provide facts
  return {
    ...extractedContext,
    session: {
      sessionId,
      sessionType,
      // Phase 3: Simplified intent - agent decides, we just provide data
      intent: {
        primary: 'help', // Default, agent will interpret actual intent
        keywords: [],    // No keyword extraction - agent's job
        implicitSignals: [],
      },
      previousMessages: {
        count: previousMessages.length,
        lastN: previousMessages.slice(-3), // Last 3 messages for context
      },
      // No userGoal extraction - agent interprets the message directly
    },
    aggregationTimestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Quick Context (Lightweight)
// ============================================================================

export interface QuickContext {
  url: string;
  title: string;
  hostname: string;
  selectedText?: string;
  platform?: string;
  hasErrors?: boolean;
}

/**
 * Get quick/lightweight context without full extraction
 */
export async function getQuickContext(tabId: number): Promise<QuickContext | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 1000);

    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: 'GET_PAGE_CONTEXT' },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError || !response) {
            // Fallback to tab info
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError || !tab) {
                resolve(null);
                return;
              }
              resolve({
                url: tab.url || '',
                title: tab.title || '',
                hostname: tab.url ? new URL(tab.url).hostname : '',
              });
            });
            return;
          }

          resolve({
            url: response.url,
            title: response.title,
            hostname: new URL(response.url).hostname,
            selectedText: response.selectedText || undefined,
          });
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
