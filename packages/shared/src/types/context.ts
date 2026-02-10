/**
 * Context-Aware Mentor Mode Types
 * 
 * These types define the structured context payload that is extracted from
 * the browser and sent to the backend for context-aware AI responses.
 */

// ============================================================================
// Platform Detection Types
// ============================================================================

export type PlatformType =
  | 'azure'
  | 'aws'
  | 'gcp'
  | 'github'
  | 'gitlab'
  | 'datadog'
  | 'newrelic'
  | 'grafana'
  | 'jenkins'
  | 'kubernetes'
  | 'docker'
  | 'generic';

export interface PlatformDetection {
  type: PlatformType;
  confidence: number; // 0-1
  indicators: string[];
  specificProduct?: string; // e.g., "Azure DevOps", "AWS EC2"
  specificContext?: Record<string, unknown>; // Phase 2: Platform-specific context
}

// ============================================================================
// Error Detection Types
// ============================================================================

export type ErrorType = 'error' | 'warning' | 'info';
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorSource = 'console' | 'ui' | 'network' | 'dom';

export interface ExtractedError {
  type: ErrorType;
  message: string;
  source?: ErrorSource;
  severity: ErrorSeverity;
  context?: string; // Surrounding text
  element?: HTMLElementSnapshot;
  stackTrace?: string;
}

export interface HTMLElementSnapshot {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
}

// ============================================================================
// HTML Structure Types
// ============================================================================

export type SectionPurpose =
  | 'error-container'
  | 'alert'
  | 'panel'
  | 'table'
  | 'form'
  | 'code-block'
  | 'modal'
  | 'generic';

export interface HTMLSection {
  purpose: SectionPurpose;
  outerHTML: string; // Truncated to ~500 chars
  textContent: string;
  attributes: Record<string, string>;
  xpath?: string;
}

// ============================================================================
// Text Extraction Types
// ============================================================================

export interface Heading {
  level: 1 | 2 | 3;
  text: string;
  xpath?: string;
  hierarchy?: string; // Parent > Child hierarchy
}

export interface ConsoleLogs {
  errors: string[];
  warnings: string[];
  included: boolean;
  truncated: boolean;
}

// Phase 2: Console log capture type
export interface CapturedConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;
  stackTrace?: string;
}

// Phase 2: Network error capture type
export interface CapturedNetworkError {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface TextExtractionMetadata {
  totalLength: number;
  truncated: boolean;
  truncationReason?: string;
}

// ============================================================================
// User Intent Types (DEPRECATED in Phase 3 - kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Phase 3: The agent (LLM) now determines intent autonomously.
 * This type is kept for backward compatibility but fields are optional.
 */
export type IntentType = 'debug' | 'understand' | 'mentor' | 'help' | 'explain' | 'guide';

/**
 * @deprecated Phase 3: Intent is no longer computed by the extension.
 * The agent interprets user intent directly from their message.
 */
export interface UserIntent {
  primary: IntentType;
  keywords: string[];
  explicitGoal?: string;
  implicitSignals: string[];
}

// ============================================================================
// Session Context Types
// ============================================================================

/** Session type specifically for context-aware mode (extends base SessionType) */
export type ContextSessionType = 'devops' | 'debugging' | 'frontend' | 'general' | 'writing';

export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ============================================================================
// Visual Context Types (Phase 3)
// ============================================================================

export interface ScreenshotData {
  dataUrl: string; // base64 encoded image
  format: 'png' | 'jpeg';
  dimensions: { width: number; height: number };
  fileSize: number; // bytes
  quality?: number; // 0-100 for JPEG
}

export interface VisualContext {
  screenshot?: ScreenshotData;
  supported: boolean; // Model supports vision
  included: boolean; // Screenshot actually captured
  reason?: string; // Why included/excluded
}

// ============================================================================
// Privacy Types
// ============================================================================

export interface PrivacyInfo {
  redactedFields: string[];
  sensitiveDataDetected: boolean;
  consentGiven: boolean;
  dataRetention: 'session' | 'none';
  privacyMaskingApplied?: boolean;        // Whether privacy masking was applied
  sensitiveDataTypes?: string[];           // Types of data that were masked (e.g., 'email', 'token')
}

// ============================================================================
// Main Context Payload
// ============================================================================

export interface ContextPayload {
  // Core Metadata
  metadata: {
    captureTimestamp: string; // ISO 8601
    captureMode: 'auto' | 'manual';
    browserInfo: {
      userAgent: string;
      viewport: { width: number; height: number };
      language: string;
    };
    // Phase 2: Extended metadata
    phase2Features?: {
      consoleLogs: number;
      networkErrors: number;
      codeBlocks: number;
      tables: number;
      forms: number;
      hasModal: boolean;
    };
    // Extended features from context-extractor
    extendedFeatures?: {
      consoleLogs: number;
      networkErrors: number;
      runtimeErrors: number;
      codeBlocks: number;
      tables: number;
      forms: number;
      hasModal: boolean;
      uiState: string;
      privacyMaskingApplied: boolean;
      sensitiveDataTypesFound: string[];
    };
  };

  // Page Identity
  page: {
    url: string;
    urlParsed: {
      protocol: string;
      hostname: string;
      pathname: string;
      search: string;
      hash: string;
    };
    title: string;
    favicon?: string;
    platform: PlatformDetection;
    uiState?: Record<string, unknown>;
  };

  // Textual Context
  text: {
    selectedText?: string;
    visibleText: string;
    headings: Heading[];
    errors: ExtractedError[];
    logs?: ConsoleLogs;
    // Phase 2: Console and network error capture
    consoleLogs?: CapturedConsoleLog[];
    networkErrors?: CapturedNetworkError[];
    runtimeErrors?: Array<{
      message: string;
      source?: string;
      lineno?: number;
      colno?: number;
      stack?: string;
      timestamp: string;
      type?: string;
    }>;
    metadata: TextExtractionMetadata;
  };

  // Structural HTML Context
  structure: {
    relevantSections: HTMLSection[];
    errorContainers: HTMLSection[];
    // Phase 2: Extended structure extraction
    codeBlocks?: HTMLSection[];
    tables?: HTMLSection[];
    forms?: HTMLSection[];
    modal?: HTMLSection;
    activeElements: {
      focusedElement?: HTMLElementSnapshot;
      activeModals?: HTMLSection[];
      activePanels?: HTMLSection[];
    };
    metadata: {
      totalNodes: number;
      extractedNodes: number;
      relevanceScore: number; // 0-1 confidence
    };
  };

  // Visual Context (Optional - Phase 3)
  visual?: VisualContext;

  // Session Context
  session: {
    sessionId: string;
    sessionType: ContextSessionType;
    intent: UserIntent;
    previousMessages: {
      count: number;
      lastN: ContextMessage[];
    };
    userGoal?: string;
  };

  // Privacy & Safety
  privacy: PrivacyInfo;
}

// ============================================================================
// Extraction Request/Response Types
// ============================================================================

export interface ContextExtractionRequest {
  includeScreenshot?: boolean;
  maxTextLength?: number;
  maxHTMLSections?: number;
  selectedTextOnly?: boolean;
}

export interface ContextExtractionResponse {
  success: boolean;
  context?: ContextPayload;
  error?: string;
  extractionTimeMs: number;
}

// ============================================================================
// Size Limits Configuration
// ============================================================================

export const CONTEXT_SIZE_LIMITS = {
  visibleText: 10000,        // chars
  htmlSection: 500,          // chars per section
  totalHTML: 5000,           // chars total HTML
  headings: 50,              // max headings
  errors: 20,                // max errors
  consoleLogs: 100,          // lines
  screenshot: 1024 * 1024,   // 1MB
  selectedText: 5000,        // chars
} as const;
