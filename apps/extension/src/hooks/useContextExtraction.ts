/**
 * useContextExtraction Hook
 * 
 * Provides context extraction functionality for the UI.
 * Extracts page context from the active tab using the content script.
 */

import { useState, useCallback } from 'react';
import type { ContextPayload, ContextExtractionResponse, PlatformDetection } from '@devmentorai/shared';
import { 
  getContextFromActiveTab, 
  aggregateContext, 
  getQuickContext,
  type AggregatedContext,
} from '../services/context-aggregator';

export interface ScreenshotData {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: string;
}

export interface UseContextExtractionResult {
  extractedContext: ContextPayload | null;
  platform: PlatformDetection | null;
  isExtracting: boolean;
  extractionError: string | null;
  extractionTimeMs: number | null;
  screenshot: ScreenshotData | null;
  extractContext: (sessionId: string, userMessage?: string, captureScreenshot?: boolean) => Promise<AggregatedContext | null>;
  captureScreenshot: () => Promise<ScreenshotData | null>;
  captureVisibleTabScreenshot: () => Promise<string | null>;
  clearContext: () => void;
  hasErrors: boolean;
  errorCount: number;
}

/**
 * Capture a screenshot of the visible viewport
 */
async function captureVisibleTabScreenshot(): Promise<ScreenshotData | null> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('[useContextExtraction] No active tab for screenshot');
      return null;
    }
    
    // Check if we can capture this tab
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      console.warn('[useContextExtraction] Cannot capture screenshot of browser internal page');
      return null;
    }
    
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: 'jpeg',
      quality: 70, // Good balance between quality and size
    });
    
    // Get dimensions from the tab's window
    const window = await chrome.windows.getCurrent();
    
    return {
      dataUrl,
      width: window.width || 0,
      height: window.height || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[useContextExtraction] Screenshot capture failed:', error);
    return null;
  }
}

export function useContextExtraction(): UseContextExtractionResult {
  const [extractedContext, setExtractedContext] = useState<ContextPayload | null>(null);
  const [platform, setPlatform] = useState<PlatformDetection | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionTimeMs, setExtractionTimeMs] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);

  /**
   * Capture screenshot standalone
   */
  const captureScreenshot = useCallback(async (): Promise<ScreenshotData | null> => {
    const screenshotData = await captureVisibleTabScreenshot();
    setScreenshot(screenshotData);
    return screenshotData;
  }, []);

  /**
   * Capture visible tab screenshot and return just the dataUrl
   * This is a simplified version for direct use in ChatView
   */
  const captureVisibleTabScreenshotSimple = useCallback(async (): Promise<string | null> => {
    const screenshotData = await captureVisibleTabScreenshot();
    if (screenshotData) {
      setScreenshot(screenshotData);
      return screenshotData.dataUrl;
    }
    return null;
  }, []);

  /**
   * Extract context from the active tab
   */
  const extractContext = useCallback(async (
    sessionId: string,
    userMessage: string = '',
    includeScreenshot: boolean = false
  ): Promise<AggregatedContext | null> => {
    setIsExtracting(true);
    setExtractionError(null);

    try {
      console.log('[useContextExtraction] Starting context extraction...');
      
      // Run context extraction and screenshot capture in parallel if requested
      const [response, screenshotData] = await Promise.all([
        getContextFromActiveTab(),
        includeScreenshot ? captureVisibleTabScreenshot() : Promise.resolve(null),
      ]);
      
      if (screenshotData) {
        setScreenshot(screenshotData);
      }
      
      console.log('[useContextExtraction] getContextFromActiveTab response:', {
        success: response.success,
        error: response.error,
        hasContext: !!response.context,
        extractionTimeMs: response.extractionTimeMs,
        hasScreenshot: !!screenshotData,
      });
      
      setExtractionTimeMs(response.extractionTimeMs);

      if (!response.success || !response.context) {
        const errorMsg = response.error || 'Failed to extract context';
        console.error('[useContextExtraction] Extraction failed:', errorMsg);
        setExtractionError(errorMsg);
        return null;
      }

      // Aggregate with session info (Phase 3: no intent detection)
      const aggregated = aggregateContext(
        response.context,
        sessionId,
        userMessage
      );
      
      // Add screenshot reference to context if captured
      if (screenshotData) {
        (aggregated as any).screenshot = {
          available: true,
          width: screenshotData.width,
          height: screenshotData.height,
          timestamp: screenshotData.timestamp,
          // Note: dataUrl is NOT included in aggregated context to save bandwidth
          // It's stored separately and can be retrieved via the screenshot state
        };
      }

      setExtractedContext(aggregated);
      setPlatform(aggregated.page.platform);
      
      console.log('[useContextExtraction] Context extracted successfully:', {
        platform: aggregated.page.platform.type,
        confidence: aggregated.page.platform.confidence,
        errorsFound: aggregated.text.errors.length,
        extractionTimeMs: response.extractionTimeMs,
        hasScreenshot: !!screenshotData,
      });

      return aggregated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExtractionError(errorMessage);
      console.error('[useContextExtraction] Extraction threw error:', error);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  /**
   * Clear the extracted context
   */
  const clearContext = useCallback(() => {
    setExtractedContext(null);
    setPlatform(null);
    setExtractionError(null);
    setExtractionTimeMs(null);
    setScreenshot(null);
  }, []);

  return {
    extractedContext,
    platform,
    isExtracting,
    extractionError,
    extractionTimeMs,
    screenshot,
    extractContext,
    captureScreenshot,
    captureVisibleTabScreenshot: captureVisibleTabScreenshotSimple,
    clearContext,
    hasErrors: (extractedContext?.text.errors.length ?? 0) > 0,
    errorCount: extractedContext?.text.errors.length ?? 0,
  };
}

/**
 * Hook for quick context (lightweight, no full extraction)
 */
export function useQuickContext() {
  const [quickContext, setQuickContext] = useState<{
    url: string;
    title: string;
    hostname: string;
    selectedText?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQuickContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const context = await getQuickContext(tab.id);
        setQuickContext(context);
      }
    } catch (error) {
      console.error('[useQuickContext] Failed to get quick context:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    quickContext,
    isLoading,
    fetchQuickContext,
    clearQuickContext: () => setQuickContext(null),
  };
}
