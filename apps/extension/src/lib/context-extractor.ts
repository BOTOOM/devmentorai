/**
 * Context Extractor for DevMentorAI
 * 
 * Extracts structured context from the current page for context-aware AI mentoring.
 * This module handles:
 * - Page metadata extraction
 * - Platform detection (Azure, AWS, GitHub, etc.)
 * - Error detection from DOM
 * - Text extraction with privacy redaction
 * - Heading hierarchy extraction
 */

import type {
  ContextPayload,
  ContextExtractionRequest,
  ContextExtractionResponse,
  PlatformDetection,
  PlatformType,
  ExtractedError,
  ErrorType,
  ErrorSeverity,
  HTMLSection,
  SectionPurpose,
  Heading,
  HTMLElementSnapshot,
} from '@devmentorai/shared';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely get className as a lowercase string.
 * Handles SVG elements where className is SVGAnimatedString, not string.
 */
function getClassNameString(element: Element): string {
  if (!element.className) return '';
  
  // SVG elements have className as SVGAnimatedString
  if (typeof element.className === 'string') {
    return element.className.toLowerCase();
  }
  
  // For SVGAnimatedString, use baseVal
  if (element.className && typeof (element.className as SVGAnimatedString).baseVal === 'string') {
    return (element.className as SVGAnimatedString).baseVal.toLowerCase();
  }
  
  // Fallback: use getAttribute
  return (element.getAttribute('class') || '').toLowerCase();
}

// ============================================================================
// Size Limits (duplicated here to avoid import issues in content script)
// ============================================================================

const SIZE_LIMITS = {
  visibleText: 10000,
  htmlSection: 500,
  totalHTML: 5000,
  headings: 50,
  errors: 20,
  consoleLogs: 100,
  selectedText: 5000,
  runtimeErrors: 50,
  networkErrors: 50,
};

// ============================================================================
// Runtime Error Capture (window.onerror, unhandled rejections)
// ============================================================================

interface CapturedRuntimeError {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  error?: string;
  timestamp: string;
  type: 'error' | 'unhandledrejection';
}

const capturedRuntimeErrors: CapturedRuntimeError[] = [];
let isRuntimeErrorCapturing = false;
let originalOnError: OnErrorEventHandler;
let originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null;

/**
 * Start capturing runtime JavaScript errors
 */
export function startRuntimeErrorCapture(): void {
  if (isRuntimeErrorCapturing) return;
  isRuntimeErrorCapturing = true;

  // Capture window.onerror
  originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    capturedRuntimeErrors.push({
      message: String(message),
      source: source || undefined,
      lineno: lineno || undefined,
      colno: colno || undefined,
      error: error?.stack || error?.message || undefined,
      timestamp: new Date().toISOString(),
      type: 'error',
    });
    trimRuntimeErrors();
    
    // Call original handler if exists
    if (typeof originalOnError === 'function') {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Capture unhandled promise rejections
  originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    capturedRuntimeErrors.push({
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      error: reason?.stack || undefined,
      timestamp: new Date().toISOString(),
      type: 'unhandledrejection',
    });
    trimRuntimeErrors();
    
    // Call original handler if exists
    if (typeof originalOnUnhandledRejection === 'function') {
      originalOnUnhandledRejection(event);
    }
  };
}

/**
 * Stop capturing runtime errors
 */
export function stopRuntimeErrorCapture(): void {
  if (!isRuntimeErrorCapturing) return;
  isRuntimeErrorCapturing = false;
  
  window.onerror = originalOnError;
  window.onunhandledrejection = originalOnUnhandledRejection;
}

function trimRuntimeErrors(): void {
  while (capturedRuntimeErrors.length > SIZE_LIMITS.runtimeErrors) {
    capturedRuntimeErrors.shift();
  }
}

/**
 * Get captured runtime errors
 */
export function getCapturedRuntimeErrors(): CapturedRuntimeError[] {
  return [...capturedRuntimeErrors];
}

/**
 * Clear captured runtime errors
 */
export function clearCapturedRuntimeErrors(): void {
  capturedRuntimeErrors.length = 0;
}

// ============================================================================
// UI State Detection
// ============================================================================

export interface UIStateAnalysis {
  loadingIndicators: number;
  disabledButtons: number;
  emptyStates: number;
  errorStates: number;
  toastNotifications: number;
  modalOpen: boolean;
  formValidationErrors: number;
  pageState: 'loading' | 'loaded' | 'error' | 'empty' | 'normal';
  interactiveElements: {
    buttons: number;
    links: number;
    inputs: number;
    disabledElements: number;
  };
}

/**
 * Analyze UI state of the current page
 */
export function analyzeUIState(): UIStateAnalysis {
  // Loading indicators
  const loadingSelectors = [
    '[class*="loading"]', '[class*="Loading"]',
    '[class*="spinner"]', '[class*="Spinner"]',
    '[class*="skeleton"]', '[class*="Skeleton"]',
    '[aria-busy="true"]',
    '.loader', '.loading-indicator',
    '[class*="progress"]', '[role="progressbar"]',
  ];
  const loadingIndicators = document.querySelectorAll(loadingSelectors.join(',')).length;

  // Disabled buttons
  const disabledButtons = document.querySelectorAll(
    'button[disabled], input[type="submit"][disabled], [role="button"][aria-disabled="true"]'
  ).length;

  // Empty states
  const emptyStateSelectors = [
    '[class*="empty-state"]', '[class*="EmptyState"]',
    '[class*="no-results"]', '[class*="NoResults"]',
    '[class*="no-data"]', '[class*="NoData"]',
    '[class*="zero-state"]', '[class*="ZeroState"]',
  ];
  const emptyStates = document.querySelectorAll(emptyStateSelectors.join(',')).length;

  // Error states
  const errorStateSelectors = [
    '[class*="error-state"]', '[class*="ErrorState"]',
    '[class*="error-page"]', '[class*="ErrorPage"]',
    '[class*="error-boundary"]', '[class*="ErrorBoundary"]',
  ];
  const errorStates = document.querySelectorAll(errorStateSelectors.join(',')).length;

  // Toast notifications
  const toastSelectors = [
    '[class*="toast"]', '[class*="Toast"]',
    '[class*="snackbar"]', '[class*="Snackbar"]',
    '[class*="notification"]', '[class*="Notification"]',
    '[role="status"]', '[role="alert"]',
  ];
  const toastNotifications = document.querySelectorAll(toastSelectors.join(',')).length;

  // Modal open
  const modalSelectors = [
    '[role="dialog"]', '[role="alertdialog"]',
    '[aria-modal="true"]',
    '.modal.show', '.modal.open', '[class*="modal-open"]',
  ];
  const modalOpen = document.querySelectorAll(modalSelectors.join(',')).length > 0;

  // Form validation errors
  const validationErrorSelectors = [
    '[class*="validation-error"]', '[class*="ValidationError"]',
    '[class*="field-error"]', '[class*="FieldError"]',
    '[aria-invalid="true"]',
    '.invalid-feedback:not(:empty)', '.error-message:not(:empty)',
  ];
  const formValidationErrors = document.querySelectorAll(validationErrorSelectors.join(',')).length;

  // Interactive elements count
  const buttons = document.querySelectorAll('button, [role="button"]').length;
  const links = document.querySelectorAll('a[href]').length;
  const inputs = document.querySelectorAll('input, textarea, select').length;
  const disabledElements = document.querySelectorAll('[disabled], [aria-disabled="true"]').length;

  // Determine overall page state
  let pageState: UIStateAnalysis['pageState'] = 'normal';
  if (loadingIndicators > 0 && loadingIndicators > errorStates) {
    pageState = 'loading';
  } else if (errorStates > 0) {
    pageState = 'error';
  } else if (emptyStates > 0) {
    pageState = 'empty';
  } else if (document.readyState !== 'complete') {
    pageState = 'loading';
  }

  return {
    loadingIndicators,
    disabledButtons,
    emptyStates,
    errorStates,
    toastNotifications,
    modalOpen,
    formValidationErrors,
    pageState,
    interactiveElements: {
      buttons,
      links,
      inputs,
      disabledElements,
    },
  };
}

// ============================================================================
// Enhanced Privacy Masking
// ============================================================================

const PRIVACY_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Account/User IDs (common patterns)
  accountId: /\b(user[_-]?id|account[_-]?id|customer[_-]?id|uid)[:\s=]["']?([a-zA-Z0-9_-]{8,})["']?/gi,
  // Resource IDs (AWS, Azure, GCP patterns)
  awsArn: /arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d*:[a-zA-Z0-9\-\/_]+/g,
  azureResourceId: /\/subscriptions\/[a-f0-9-]+\/resourceGroups\/[^\/]+\/providers\/[^\s"']+/gi,
  gcpResourceId: /projects\/[a-z][a-z0-9-]*\/[^\s"']+/gi,
  // JWT tokens
  jwt: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
  // API keys and tokens (generic patterns)
  apiKey: /\b(api[_-]?key|apikey|access[_-]?token|auth[_-]?token|bearer)[:\s=]["']?([a-zA-Z0-9_-]{20,})["']?/gi,
  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // IP addresses
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Phone numbers (various formats)
  phone: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  // SSN (US)
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  // Long hex strings (potential secrets)
  hexSecret: /\b[a-fA-F0-9]{32,}\b/g,
  // Base64 encoded strings that look like secrets
  base64Secret: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
};

/**
 * Mask sensitive data in text with placeholders
 */
export function maskSensitiveData(text: string): string {
  let masked = text;
  
  // Apply each pattern
  masked = masked.replace(PRIVACY_PATTERNS.email, '[EMAIL_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.jwt, '[JWT_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.awsArn, '[AWS_ARN_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.azureResourceId, '[AZURE_RESOURCE_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.gcpResourceId, '[GCP_RESOURCE_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.creditCard, '[CARD_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.ssn, '[SSN_REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.phone, '[PHONE_REDACTED]');
  
  // API keys and account IDs - preserve the key name but redact the value
  masked = masked.replace(PRIVACY_PATTERNS.apiKey, '$1=[REDACTED]');
  masked = masked.replace(PRIVACY_PATTERNS.accountId, '$1=[REDACTED]');
  
  // Only redact IP addresses if they look internal (10.x, 172.16-31.x, 192.168.x)
  masked = masked.replace(/\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '[INTERNAL_IP]');
  masked = masked.replace(/\b(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g, '[INTERNAL_IP]');
  masked = masked.replace(/\b(192\.168\.\d{1,3}\.\d{1,3})\b/g, '[INTERNAL_IP]');
  
  // Hex secrets - only if they look like tokens (not CSS colors, etc.)
  masked = masked.replace(/([^#]|^)([a-fA-F0-9]{40,})/g, '$1[HEX_SECRET_REDACTED]');
  
  return masked;
}

/**
 * Detect what types of sensitive data are present
 */
export function detectSensitiveDataTypes(text: string): string[] {
  const detected: string[] = [];
  
  if (PRIVACY_PATTERNS.email.test(text)) detected.push('email');
  if (PRIVACY_PATTERNS.jwt.test(text)) detected.push('jwt_token');
  if (PRIVACY_PATTERNS.awsArn.test(text)) detected.push('aws_resource');
  if (PRIVACY_PATTERNS.azureResourceId.test(text)) detected.push('azure_resource');
  if (PRIVACY_PATTERNS.gcpResourceId.test(text)) detected.push('gcp_resource');
  if (PRIVACY_PATTERNS.creditCard.test(text)) detected.push('credit_card');
  if (PRIVACY_PATTERNS.phone.test(text)) detected.push('phone');
  if (PRIVACY_PATTERNS.apiKey.test(text)) detected.push('api_key');
  
  // Reset lastIndex for global patterns
  Object.values(PRIVACY_PATTERNS).forEach(p => { if (p.global) p.lastIndex = 0; });
  
  return detected;
}

// ============================================================================
// Network Failures via Performance API
// ============================================================================

interface PerformanceNetworkError {
  url: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  failed: boolean;
  timestamp: string;
}

/**
 * Get failed network requests from Performance API
 * This doesn't require intercepting fetch/XHR
 */
export function getNetworkFailuresFromPerformance(): PerformanceNetworkError[] {
  const errors: PerformanceNetworkError[] = [];
  
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    for (const entry of entries) {
      // A request is considered failed if:
      // - transferSize is 0 and duration is > 0 (request made but no response)
      // - or responseStatus is 4xx/5xx (if available in newer browsers)
      const failed = (entry.transferSize === 0 && entry.duration > 100) ||
                    (entry as any).responseStatus >= 400;
      
      if (failed) {
        errors.push({
          url: truncateText(entry.name, 200),
          initiatorType: entry.initiatorType,
          duration: Math.round(entry.duration),
          transferSize: entry.transferSize,
          failed: true,
          timestamp: new Date(performance.timeOrigin + entry.startTime).toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn('[context-extractor] Failed to read performance entries:', e);
  }
  
  return errors.slice(-SIZE_LIMITS.networkErrors);
}

// ============================================================================
// Platform Detection
// ============================================================================

interface PlatformSignature {
  hostnames: string[];
  selectors: string[];
  urlPatterns: RegExp[];
  metaTags?: string[];
}

const PLATFORM_SIGNATURES: Record<string, PlatformSignature> = {
  azure: {
    hostnames: ['portal.azure.com', 'dev.azure.com', 'azure.microsoft.com', 'aex.dev.azure.com'],
    selectors: ['[data-telemetry-area]', '.fxs-blade', '#azure-portal', '[class*="azurePortal"]'],
    urlPatterns: [/portal\.azure\.com/, /dev\.azure\.com/, /\.azure\.com/],
  },
  aws: {
    hostnames: ['console.aws.amazon.com', 'aws.amazon.com', 'signin.aws.amazon.com'],
    selectors: ['[data-testid*="awsui"]', '#awsgnav', '[class*="awsui"]', 'awsui-app-layout'],
    urlPatterns: [/console\.aws\.amazon\.com/, /\.aws\.amazon\.com/],
  },
  gcp: {
    hostnames: ['console.cloud.google.com', 'cloud.google.com'],
    selectors: ['[jsname]', '.cfc-panel', 'mat-sidenav-container', '[cloud-nav]'],
    urlPatterns: [/console\.cloud\.google\.com/, /cloud\.google\.com/],
  },
  github: {
    hostnames: ['github.com', 'gist.github.com'],
    selectors: ['[data-turbo-body]', '.AppHeader', '[data-pjax-container]', '.repository-content'],
    urlPatterns: [/github\.com/, /gist\.github\.com/],
  },
  gitlab: {
    hostnames: ['gitlab.com'],
    selectors: ['[data-testid="super-sidebar"]', '.gl-display-flex', '[class*="gitlab"]'],
    urlPatterns: [/gitlab\.com/],
  },
  datadog: {
    hostnames: ['app.datadoghq.com', 'datadoghq.com', 'app.datadoghq.eu'],
    selectors: ['[data-dd]', '.datadog-app', '[class*="datadog"]'],
    urlPatterns: [/datadoghq\.(com|eu)/],
  },
  grafana: {
    hostnames: ['grafana.com'],
    selectors: ['[class*="grafana"]', '.dashboard-container', 'grafana-app'],
    urlPatterns: [/grafana/],
  },
  jenkins: {
    hostnames: [],
    selectors: ['#side-panel', '.jenkins-app-bar', '[class*="jenkins"]', '#main-panel'],
    urlPatterns: [/jenkins/],
  },
  kubernetes: {
    hostnames: [],
    selectors: ['[class*="kubernetes"]', '[class*="k8s"]', '.kube-dashboard'],
    urlPatterns: [/kubernetes|k8s/],
  },
};

/**
 * Detect the platform/product being viewed in the browser
 */
export function detectPlatform(): PlatformDetection {
  let maxScore = 0;
  let detectedPlatform: PlatformType = 'generic';
  const indicators: string[] = [];

  const hostname = window.location.hostname;
  const url = window.location.href;

  for (const [platform, signature] of Object.entries(PLATFORM_SIGNATURES)) {
    let score = 0;
    const platformIndicators: string[] = [];

    // Check hostname (high weight)
    for (const h of signature.hostnames) {
      if (hostname.includes(h)) {
        score += 50;
        platformIndicators.push(`hostname: ${h}`);
        break;
      }
    }

    // Check URL patterns (medium weight)
    for (const pattern of signature.urlPatterns) {
      if (pattern.test(url)) {
        score += 30;
        platformIndicators.push(`url pattern match`);
        break;
      }
    }

    // Check selectors (medium weight)
    for (const selector of signature.selectors) {
      try {
        if (document.querySelector(selector)) {
          score += 20;
          platformIndicators.push(`selector: ${selector}`);
          break;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    if (score > maxScore) {
      maxScore = score;
      detectedPlatform = platform as PlatformType;
      indicators.length = 0;
      indicators.push(...platformIndicators);
    }
  }

  return {
    type: detectedPlatform,
    confidence: Math.min(maxScore / 100, 1),
    indicators,
    specificProduct: detectSpecificProduct(detectedPlatform),
  };
}

/**
 * Detect specific product within a platform (e.g., Azure DevOps vs Azure Portal)
 */
function detectSpecificProduct(platform: PlatformType): string | undefined {
  const url = window.location.href;
  const pathname = window.location.pathname;

  switch (platform) {
    case 'azure':
      if (url.includes('dev.azure.com')) return 'Azure DevOps';
      if (pathname.includes('/pipelines')) return 'Azure Pipelines';
      if (pathname.includes('/repos')) return 'Azure Repos';
      if (pathname.includes('/boards')) return 'Azure Boards';
      return 'Azure Portal';

    case 'aws':
      const awsMatch = url.match(/console\.aws\.amazon\.com\/([^\/\?]+)/);
      if (awsMatch) {
        const service = awsMatch[1].toUpperCase();
        return `AWS ${service}`;
      }
      return 'AWS Console';

    case 'gcp':
      const gcpMatch = url.match(/console\.cloud\.google\.com\/([^\/\?]+)/);
      if (gcpMatch) return `GCP ${gcpMatch[1]}`;
      return 'GCP Console';

    case 'github':
      if (pathname.includes('/actions')) return 'GitHub Actions';
      if (pathname.includes('/pull/')) return 'GitHub Pull Request';
      if (pathname.includes('/issues')) return 'GitHub Issues';
      if (pathname.includes('/settings')) return 'GitHub Settings';
      return 'GitHub';

    default:
      return undefined;
  }
}

// ============================================================================
// Error Detection
// ============================================================================

const ERROR_SELECTORS = [
  '[role="alert"]',
  '[role="alertdialog"]',
  '[aria-live="polite"]',
  '[aria-live="assertive"]',
  '.error',
  '.error-message',
  '.alert-error',
  '.alert-danger',
  '.alert-warning',
  '.notification-error',
  '.toast-error',
  '.message-error',
  '[class*="error"]',
  '[class*="Error"]',
  '[class*="warning"]',
  '[class*="Warning"]',
  '[data-error]',
  '[data-error-message]',
];

/**
 * Extract visible errors from the DOM
 */
export function extractErrors(): ExtractedError[] {
  const errors: ExtractedError[] = [];
  const seen = new Set<string>();

  // Query all potential error elements
  const selector = ERROR_SELECTORS.join(',');
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    const text = el.textContent?.trim() || '';
    
    // Skip empty or very short text
    if (text.length < 5) continue;
    
    // Skip if already seen (dedup)
    const hash = text.slice(0, 100);
    if (seen.has(hash)) continue;
    seen.add(hash);

    // Check if it's actually visible
    if (!isElementVisible(el as HTMLElement)) continue;

    // Classify the error
    const errorType = classifyErrorType(el);
    const severity = classifyErrorSeverity(text, el);

    errors.push({
      type: errorType,
      message: truncateText(text, 500),
      source: 'ui',
      severity,
      context: getElementContext(el as HTMLElement),
      element: snapshotElement(el as HTMLElement),
    });

    if (errors.length >= SIZE_LIMITS.errors) break;
  }

  return errors;
}

/**
 * Classify the type of error element
 */
function classifyErrorType(el: Element): ErrorType {
  const classes = getClassNameString(el);
  const role = el.getAttribute('role') || '';
  
  if (classes.includes('warning') || classes.includes('warn')) {
    return 'warning';
  }
  if (classes.includes('info') || role === 'status') {
    return 'info';
  }
  return 'error';
}

/**
 * Classify error severity based on content and styling
 */
function classifyErrorSeverity(text: string, el: Element): ErrorSeverity {
  const lowerText = text.toLowerCase();
  const classes = getClassNameString(el);

  // Critical indicators
  if (
    lowerText.includes('critical') ||
    lowerText.includes('fatal') ||
    lowerText.includes('crash') ||
    classes.includes('critical')
  ) {
    return 'critical';
  }

  // High severity indicators
  if (
    lowerText.includes('error') ||
    lowerText.includes('failed') ||
    lowerText.includes('exception') ||
    classes.includes('danger') ||
    classes.includes('error')
  ) {
    return 'high';
  }

  // Medium severity indicators
  if (
    lowerText.includes('warning') ||
    lowerText.includes('warn') ||
    classes.includes('warning')
  ) {
    return 'medium';
  }

  return 'low';
}

/**
 * Get surrounding context for an element
 */
function getElementContext(el: HTMLElement): string {
  // Try to get parent container text for context
  const parent = el.parentElement;
  if (parent) {
    const parentText = parent.textContent?.trim() || '';
    if (parentText.length > (el.textContent?.length || 0) + 10) {
      return truncateText(parentText, 200);
    }
  }
  return '';
}

// ============================================================================
// Text Extraction
// ============================================================================

/**
 * Extract visible text from the page (within viewport focus)
 */
export function extractVisibleText(): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip script, style, and hidden elements
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        if (!isElementVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip empty text
        const text = node.textContent?.trim();
        if (!text) return NodeFilter.FILTER_REJECT;
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const texts: string[] = [];
  let totalLength = 0;
  let node: Node | null;

  while ((node = walker.nextNode()) && totalLength < SIZE_LIMITS.visibleText) {
    const text = node.textContent?.trim() || '';
    if (text) {
      texts.push(text);
      totalLength += text.length;
    }
  }

  return texts.join(' ').slice(0, SIZE_LIMITS.visibleText);
}

/**
 * Extract heading hierarchy (h1-h3)
 */
export function extractHeadings(): Heading[] {
  const headings: Heading[] = [];
  const elements = document.querySelectorAll('h1, h2, h3');

  for (const el of elements) {
    if (headings.length >= SIZE_LIMITS.headings) break;
    
    const text = el.textContent?.trim();
    if (!text || !isElementVisible(el as HTMLElement)) continue;

    const level = parseInt(el.tagName.charAt(1)) as 1 | 2 | 3;
    headings.push({
      level,
      text: truncateText(text, 200),
    });
  }

  return headings;
}

/**
 * Get user-selected text
 */
export function getSelectedText(): string | undefined {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  return text ? truncateText(text, SIZE_LIMITS.selectedText) : undefined;
}

// ============================================================================
// HTML Section Extraction
// ============================================================================

/**
 * Extract relevant HTML sections from the page
 */
export function extractRelevantSections(): HTMLSection[] {
  const sections: HTMLSection[] = [];
  const candidates = document.querySelectorAll(
    'main, section, article, [role="main"], [role="region"], form, table, pre, code, ' +
    '[class*="error"], [class*="alert"], [class*="panel"], [class*="modal"]'
  );

  const scored = Array.from(candidates)
    .map(el => ({
      element: el as HTMLElement,
      score: scoreElementRelevance(el as HTMLElement),
    }))
    .filter(item => item.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let totalHTMLLength = 0;

  for (const { element } of scored) {
    if (totalHTMLLength >= SIZE_LIMITS.totalHTML) break;

    const html = truncateText(element.outerHTML, SIZE_LIMITS.htmlSection);
    totalHTMLLength += html.length;

    sections.push({
      purpose: inferSectionPurpose(element),
      outerHTML: redactSensitiveHTML(html),
      textContent: truncateText(element.textContent || '', 500),
      attributes: extractRelevantAttributes(element),
    });
  }

  return sections;
}

/**
 * Score element relevance for extraction
 */
function scoreElementRelevance(element: HTMLElement): number {
  let score = 0;
  const text = element.textContent?.toLowerCase() || '';
  const classes = getClassNameString(element);

  // Error indicators (+high score)
  if (element.matches('[role="alert"], .error, .warning, .alert')) score += 50;
  if (text.includes('error')) score += 30;
  if (text.includes('failed')) score += 25;
  if (text.includes('warning')) score += 20;

  // Structural importance
  if (['H1', 'H2', 'H3'].includes(element.tagName)) score += 20;
  if (element.matches('main, [role="main"]')) score += 15;
  if (element.matches('form, table, pre, code')) score += 10;

  // Visibility (only visible content matters)
  if (!isElementVisible(element)) score = 0;

  // Active/focused elements
  if (element.contains(document.activeElement)) score += 40;

  // Modal/dialog/panels (high priority UI)
  if (element.matches('[role="dialog"], [role="alertdialog"], .modal')) score += 35;
  if (classes.includes('panel') || classes.includes('card')) score += 15;

  // Size penalty (too large = likely container, not content)
  const textLength = element.textContent?.length || 0;
  if (textLength > 5000) score -= 20;
  if (textLength < 10) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Infer the purpose of an HTML section
 */
function inferSectionPurpose(element: HTMLElement): SectionPurpose {
  const classes = getClassNameString(element);
  const role = element.getAttribute('role') || '';

  if (role === 'alert' || role === 'alertdialog' || classes.includes('alert')) {
    return 'alert';
  }
  if (classes.includes('error')) return 'error-container';
  if (element.tagName === 'FORM') return 'form';
  if (element.tagName === 'TABLE') return 'table';
  if (['PRE', 'CODE'].includes(element.tagName)) return 'code-block';
  if (classes.includes('panel') || classes.includes('card')) return 'panel';
  
  return 'generic';
}

/**
 * Extract relevant attributes from an element
 */
function extractRelevantAttributes(element: HTMLElement): Record<string, string> {
  const relevant = ['id', 'class', 'role', 'aria-label', 'data-testid', 'name'];
  const attrs: Record<string, string> = {};

  for (const attr of relevant) {
    const value = element.getAttribute(attr);
    if (value) {
      attrs[attr] = truncateText(value, 100);
    }
  }

  return attrs;
}

// ============================================================================
// Privacy & Redaction
// ============================================================================

const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api[_-]?key/i,
  /bearer/i,
  /authorization/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
];

const SENSITIVE_SELECTORS = [
  'input[type="password"]',
  'input[name*="password"]',
  'input[name*="token"]',
  'input[name*="secret"]',
  'input[name*="key"]',
  '[data-sensitive]',
  '[aria-label*="password"]',
];

/**
 * Redact sensitive data from HTML string
 */
export function redactSensitiveHTML(html: string): string {
  let redacted = html;

  // Redact password input values
  redacted = redacted.replace(
    /(<input[^>]*type=["']password["'][^>]*value=["'])[^"']*["']/gi,
    '$1[REDACTED]"'
  );

  // Redact token/key values in attributes
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(
      new RegExp(`(${pattern.source}[^=]*=["'])[^"']*["']`, 'gi'),
      '$1[REDACTED]"'
    );
  }

  return redacted;
}

/**
 * Check if text contains potentially sensitive data
 */
export function containsSensitiveData(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }

  // Check for patterns that look like tokens/keys
  if (/[a-zA-Z0-9]{32,}/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Get list of redacted field names in the page
 */
export function getRedactedFields(): string[] {
  const fields: string[] = [];
  const sensitiveInputs = document.querySelectorAll(SENSITIVE_SELECTORS.join(','));

  for (const input of sensitiveInputs) {
    const name = input.getAttribute('name') || input.getAttribute('id') || 'unknown';
    fields.push(name);
  }

  return fields;
}

// ============================================================================
// Console Log Capture (Phase 2)
// ============================================================================

interface ConsoleCapturedLog {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;
  stackTrace?: string;
}

// Store for captured console logs
const capturedLogs: ConsoleCapturedLog[] = [];
let isConsoleCapturing = false;

// Original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

/**
 * Start capturing console logs for context extraction
 */
export function startConsoleCapture(): void {
  if (isConsoleCapturing) return;
  isConsoleCapturing = true;

  const captureLog = (level: ConsoleCapturedLog['level']) => (...args: unknown[]) => {
    // Call original console method
    originalConsole[level].apply(console, args);

    // Capture the log
    const message = args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    // Capture stack trace for errors
    let stackTrace: string | undefined;
    if (level === 'error') {
      const err = new Error();
      stackTrace = err.stack?.split('\n').slice(2).join('\n');
    }

    capturedLogs.push({
      level,
      message: truncateText(message, 1000),
      timestamp: new Date().toISOString(),
      stackTrace: stackTrace ? truncateText(stackTrace, 500) : undefined,
    });

    // Keep only recent logs
    while (capturedLogs.length > SIZE_LIMITS.consoleLogs) {
      capturedLogs.shift();
    }
  };

  // Override console methods
  console.log = captureLog('log');
  console.warn = captureLog('warn');
  console.error = captureLog('error');
  console.info = captureLog('info');
  console.debug = captureLog('debug');
}

/**
 * Stop capturing console logs
 */
export function stopConsoleCapture(): void {
  if (!isConsoleCapturing) return;
  isConsoleCapturing = false;

  // Restore original console methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
}

/**
 * Get captured console logs
 */
export function getCapturedLogs(): ConsoleCapturedLog[] {
  return [...capturedLogs];
}

/**
 * Clear captured console logs
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0;
}

/**
 * Get only error-level logs
 */
export function getCapturedErrors(): ConsoleCapturedLog[] {
  return capturedLogs.filter(log => log.level === 'error' || log.level === 'warn');
}

// ============================================================================
// Network Error Detection (Phase 2)
// ============================================================================

interface CapturedNetworkError {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  errorMessage?: string;
  timestamp: string;
}

const capturedNetworkErrors: CapturedNetworkError[] = [];
let isNetworkCapturing = false;
let originalFetch: typeof fetch;
let originalXHROpen: XMLHttpRequest['open'];
let originalXHRSend: XMLHttpRequest['send'];

/**
 * Start capturing network errors
 */
export function startNetworkErrorCapture(): void {
  if (isNetworkCapturing) return;
  isNetworkCapturing = true;

  // Capture fetch errors
  originalFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : args[0]?.href || 'unknown';
    const method = (args[1]?.method || 'GET').toUpperCase();
    
    try {
      const response = await originalFetch.apply(window, args);
      
      if (!response.ok) {
        capturedNetworkErrors.push({
          url: truncateText(url, 200),
          method,
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString(),
        });
        trimNetworkErrors();
      }
      
      return response;
    } catch (error) {
      capturedNetworkErrors.push({
        url: truncateText(url, 200),
        method,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      trimNetworkErrors();
      throw error;
    }
  };

  // Capture XHR errors
  originalXHROpen = XMLHttpRequest.prototype.open;
  originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
    this._devmentor_url = String(url);
    this._devmentor_method = method.toUpperCase();
    return originalXHROpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function(...args: any[]) {
    this.addEventListener('loadend', () => {
      if (this.status >= 400) {
        capturedNetworkErrors.push({
          url: truncateText(this._devmentor_url || 'unknown', 200),
          method: this._devmentor_method || 'UNKNOWN',
          status: this.status,
          statusText: this.statusText,
          timestamp: new Date().toISOString(),
        });
        trimNetworkErrors();
      }
    });

    this.addEventListener('error', () => {
      capturedNetworkErrors.push({
        url: truncateText(this._devmentor_url || 'unknown', 200),
        method: this._devmentor_method || 'UNKNOWN',
        errorMessage: 'Network request failed',
        timestamp: new Date().toISOString(),
      });
      trimNetworkErrors();
    });

    return originalXHRSend.apply(this, args as any);
  };
}

/**
 * Stop capturing network errors
 */
export function stopNetworkErrorCapture(): void {
  if (!isNetworkCapturing) return;
  isNetworkCapturing = false;

  window.fetch = originalFetch;
  XMLHttpRequest.prototype.open = originalXHROpen;
  XMLHttpRequest.prototype.send = originalXHRSend;
}

/**
 * Trim network errors to size limit
 */
function trimNetworkErrors(): void {
  while (capturedNetworkErrors.length > 50) {
    capturedNetworkErrors.shift();
  }
}

/**
 * Get captured network errors
 */
export function getCapturedNetworkErrors(): CapturedNetworkError[] {
  return [...capturedNetworkErrors];
}

/**
 * Clear captured network errors
 */
export function clearCapturedNetworkErrors(): void {
  capturedNetworkErrors.length = 0;
}

// Add XHR type declarations
declare global {
  interface XMLHttpRequest {
    _devmentor_url?: string;
    _devmentor_method?: string;
  }
}

// ============================================================================
// Advanced HTML Section Extraction (Phase 2)
// ============================================================================

/**
 * Extract code blocks and configuration snippets
 */
export function extractCodeBlocks(): HTMLSection[] {
  const codeBlocks: HTMLSection[] = [];
  const codeElements = document.querySelectorAll('pre, code, .hljs, .CodeMirror, .monaco-editor, [class*="code-block"]');

  for (const el of codeElements) {
    if (codeBlocks.length >= 10) break;
    if (!isElementVisible(el as HTMLElement)) continue;

    const text = el.textContent?.trim() || '';
    if (text.length < 10) continue;

    // Detect language from classes
    const language = detectCodeLanguage(el as HTMLElement);

    codeBlocks.push({
      purpose: 'code-block',
      outerHTML: truncateText(el.outerHTML, SIZE_LIMITS.htmlSection),
      textContent: truncateText(text, 2000),
      attributes: {
        ...extractRelevantAttributes(el as HTMLElement),
        detectedLanguage: language || 'unknown',
      },
    });
  }

  return codeBlocks;
}

/**
 * Detect programming language from code element
 */
function detectCodeLanguage(element: HTMLElement): string | undefined {
  const classes = getClassNameString(element);
  
  // Common language class patterns
  const languagePatterns = [
    { pattern: /language-(\w+)/, group: 1 },
    { pattern: /lang-(\w+)/, group: 1 },
    { pattern: /hljs-?(\w+)?/, group: 1 },
    { pattern: /(javascript|typescript|python|go|rust|java|yaml|json|bash|shell|sql|html|css)/i, group: 1 },
  ];

  for (const { pattern, group } of languagePatterns) {
    const match = classes.match(pattern);
    if (match && match[group]) {
      return match[group];
    }
  }

  // Check data attributes
  const langAttr = element.getAttribute('data-language') || 
                   element.getAttribute('data-lang') ||
                   element.getAttribute('lang');
  if (langAttr) return langAttr;

  // Infer from content
  const text = element.textContent || '';
  if (text.includes('apiVersion:') || text.includes('kind:')) return 'yaml';
  if (text.startsWith('{') || text.startsWith('[')) return 'json';
  if (text.includes('#!/bin/bash') || text.includes('#!/bin/sh')) return 'bash';
  if (text.includes('import ') || text.includes('from ')) {
    if (text.includes('def ') || text.includes('class ')) return 'python';
    if (text.includes('interface ') || text.includes('type ')) return 'typescript';
    return 'javascript';
  }

  return undefined;
}

/**
 * Extract tables with data
 */
export function extractTables(): HTMLSection[] {
  const tables: HTMLSection[] = [];
  const tableElements = document.querySelectorAll('table');

  for (const table of tableElements) {
    if (tables.length >= 5) break;
    if (!isElementVisible(table as HTMLElement)) continue;

    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) continue;

    // Extract header and first few rows as text
    const headers = Array.from(table.querySelectorAll('th'))
      .map(th => th.textContent?.trim())
      .filter(Boolean);
    
    const dataRows = Array.from(rows).slice(0, 5).map(row =>
      Array.from(row.querySelectorAll('td'))
        .map(td => td.textContent?.trim())
        .filter(Boolean)
    );

    tables.push({
      purpose: 'table',
      outerHTML: truncateText(table.outerHTML, SIZE_LIMITS.htmlSection),
      textContent: [
        headers.join(' | '),
        ...dataRows.map(row => row.join(' | '))
      ].join('\n'),
      attributes: {
        ...extractRelevantAttributes(table as HTMLElement),
        rowCount: String(rows.length),
        columnCount: String(headers.length || (dataRows[0]?.length || 0)),
      },
    });
  }

  return tables;
}

/**
 * Extract form fields and their current values (redacted if sensitive)
 */
export function extractFormContext(): HTMLSection[] {
  const forms: HTMLSection[] = [];
  const formElements = document.querySelectorAll('form, [role="form"]');

  for (const form of formElements) {
    if (forms.length >= 3) break;
    if (!isElementVisible(form as HTMLElement)) continue;

    const inputs = form.querySelectorAll('input, select, textarea');
    const fieldSummary: string[] = [];

    for (const input of inputs) {
      const name = input.getAttribute('name') || input.getAttribute('id') || 'unnamed';
      const type = input.getAttribute('type') || input.tagName.toLowerCase();
      const label = findLabelForInput(input as HTMLElement);
      
      // Don't include actual values for sensitive fields
      const isSensitive = type === 'password' || 
                         SENSITIVE_PATTERNS.some(p => p.test(name));
      
      const value = isSensitive ? '[REDACTED]' : 
                    ((input as HTMLInputElement).value?.slice(0, 50) || '(empty)');
      
      fieldSummary.push(`${label || name} (${type}): ${value}`);
    }

    forms.push({
      purpose: 'form',
      outerHTML: truncateText(redactSensitiveHTML(form.outerHTML), SIZE_LIMITS.htmlSection),
      textContent: fieldSummary.join('\n'),
      attributes: {
        ...extractRelevantAttributes(form as HTMLElement),
        fieldCount: String(inputs.length),
        action: form.getAttribute('action') || 'none',
        method: form.getAttribute('method') || 'get',
      },
    });
  }

  return forms;
}

/**
 * Find label text for an input element
 */
function findLabelForInput(input: HTMLElement): string | undefined {
  const id = input.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim();
  }
  
  // Check parent label
  const parentLabel = input.closest('label');
  if (parentLabel) {
    const labelText = parentLabel.textContent?.replace(input.textContent || '', '').trim();
    if (labelText) return labelText;
  }
  
  // Check aria-label
  return input.getAttribute('aria-label') || undefined;
}

/**
 * Extract modal/dialog content if present
 */
export function extractModalContent(): HTMLSection | undefined {
  const modalSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal',
    '.dialog',
    '[class*="modal"]',
    '[class*="Modal"]',
    '[aria-modal="true"]',
  ];

  for (const selector of modalSelectors) {
    const modal = document.querySelector(selector);
    if (modal && isElementVisible(modal as HTMLElement)) {
      return {
        purpose: 'modal',
        outerHTML: truncateText(modal.outerHTML, SIZE_LIMITS.htmlSection * 2), // Allow larger modal content
        textContent: truncateText(modal.textContent || '', 1000),
        attributes: {
          ...extractRelevantAttributes(modal as HTMLElement),
          title: (modal.querySelector('[class*="title"], h1, h2, h3') as HTMLElement)?.textContent?.trim() || 'Modal',
        },
      };
    }
  }

  return undefined;
}

// ============================================================================
// Platform-Specific Extractors (Phase 2)
// ============================================================================

/**
 * Azure-specific context extraction
 */
function extractAzureContext(): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Extract blade name
  const bladeName = document.querySelector('[data-telemetry-area]')?.getAttribute('data-telemetry-area');
  if (bladeName) context.bladeName = bladeName;

  // Extract resource info from URL
  const url = window.location.href;
  const resourceMatch = url.match(/\/resource\/([^\/]+)/);
  if (resourceMatch) context.resourceType = resourceMatch[1];

  // Extract subscription from URL
  const subMatch = url.match(/subscriptions\/([^\/]+)/);
  if (subMatch) context.subscriptionId = subMatch[1];

  // Extract resource group
  const rgMatch = url.match(/resourceGroups\/([^\/]+)/);
  if (rgMatch) context.resourceGroup = rgMatch[1];

  // Check for activity log entries
  const activityEntries = document.querySelectorAll('[class*="activity-log"], [class*="event-entry"]');
  if (activityEntries.length > 0) {
    context.activityLogEntries = activityEntries.length;
  }

  return context;
}

/**
 * AWS-specific context extraction
 */
function extractAWSContext(): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Extract service name from URL
  const url = window.location.href;
  const serviceMatch = url.match(/console\.aws\.amazon\.com\/([^\/\?]+)/);
  if (serviceMatch) context.service = serviceMatch[1];

  // Extract region
  const regionMatch = url.match(/region=([^&]+)/);
  if (regionMatch) context.region = regionMatch[1];

  // Check for CloudWatch alarm indicators
  const alarms = document.querySelectorAll('[class*="alarm"], [class*="ALARM"]');
  if (alarms.length > 0) {
    context.activeAlarms = alarms.length;
  }

  // Check for error banners
  const errors = document.querySelectorAll('[class*="awsui-flash-error"], .awsui-alert-type-error');
  if (errors.length > 0) {
    context.errorBanners = errors.length;
  }

  return context;
}

/**
 * GCP-specific context extraction
 */
function extractGCPContext(): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Extract project from URL
  const url = window.location.href;
  const projectMatch = url.match(/project=([^&]+)/);
  if (projectMatch) context.project = decodeURIComponent(projectMatch[1]);

  // Extract service from URL
  const serviceMatch = url.match(/console\.cloud\.google\.com\/([^\/\?]+)/);
  if (serviceMatch) context.service = serviceMatch[1];

  return context;
}

/**
 * GitHub-specific context extraction
 */
function extractGitHubContext(): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  const pathname = window.location.pathname;

  // Extract repo info
  const repoMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)/);
  if (repoMatch) {
    context.owner = repoMatch[1];
    context.repo = repoMatch[2];
  }

  // Check for Actions workflow
  if (pathname.includes('/actions')) {
    context.section = 'actions';
    
    // Check workflow status
    const failedJobs = document.querySelectorAll('[class*="failed"], [class*="failing"]');
    if (failedJobs.length > 0) {
      context.failedJobs = failedJobs.length;
    }
  }

  // Check for PR
  const prMatch = pathname.match(/\/pull\/(\d+)/);
  if (prMatch) {
    context.section = 'pull-request';
    context.prNumber = prMatch[1];
    
    // Check for merge conflicts
    const conflicts = document.querySelector('[class*="conflict"]');
    if (conflicts) context.hasConflicts = true;
  }

  return context;
}

/**
 * Get platform-specific context based on detected platform
 */
export function getPlatformSpecificContext(platform: PlatformType): Record<string, unknown> {
  switch (platform) {
    case 'azure':
      return extractAzureContext();
    case 'aws':
      return extractAWSContext();
    case 'gcp':
      return extractGCPContext();
    case 'github':
      return extractGitHubContext();
    default:
      return {};
  }
}

/**
 * Check if an element is visible
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Create a snapshot of an HTML element
 */
function snapshotElement(el: HTMLElement): HTMLElementSnapshot {
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || undefined,
    className: el.className || undefined,
    textContent: truncateText(el.textContent || '', 200),
    attributes: extractRelevantAttributes(el),
  };
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Main Context Extraction Function
// ============================================================================

export interface ExtendedExtractionOptions extends ContextExtractionRequest {
  /** Include captured console logs */
  includeConsoleLogs?: boolean;
  /** Include captured network errors */
  includeNetworkErrors?: boolean;
  /** Include code blocks */
  includeCodeBlocks?: boolean;
  /** Include tables */
  includeTables?: boolean;
  /** Include form context */
  includeFormContext?: boolean;
  /** Include platform-specific context */
  includePlatformSpecific?: boolean;
  /** Include UI state analysis */
  includeUIState?: boolean;
  /** Include runtime JS errors */
  includeRuntimeErrors?: boolean;
  /** Include Performance API network failures */
  includePerformanceNetworkErrors?: boolean;
  /** Apply privacy masking to text */
  applyPrivacyMasking?: boolean;
}

/**
 * Extract full context from the current page
 */
export function extractContext(options: ExtendedExtractionOptions = {}): ContextExtractionResponse {
  const startTime = performance.now();

  try {
    const platform = detectPlatform();
    const selectedText = getSelectedText();
    let visibleText = options.selectedTextOnly && selectedText 
      ? selectedText 
      : extractVisibleText();
    const headings = extractHeadings();
    const errors = extractErrors();
    const relevantSections = extractRelevantSections();
    const errorContainers = relevantSections.filter(s => s.purpose === 'error-container' || s.purpose === 'alert');
    const redactedFields = getRedactedFields();

    // Extended extraction options
    const codeBlocks = options.includeCodeBlocks !== false ? extractCodeBlocks() : [];
    const tables = options.includeTables !== false ? extractTables() : [];
    const formContext = options.includeFormContext !== false ? extractFormContext() : [];
    const modalContent = extractModalContent();
    const consoleLogs = options.includeConsoleLogs !== false ? getCapturedErrors() : [];
    const networkErrors = options.includeNetworkErrors !== false ? getCapturedNetworkErrors() : [];
    const platformSpecific = options.includePlatformSpecific !== false 
      ? getPlatformSpecificContext(platform.type) 
      : {};
    
    // NEW: UI State analysis
    const uiState = options.includeUIState !== false ? analyzeUIState() : undefined;
    
    // NEW: Runtime JS errors
    const runtimeErrors = options.includeRuntimeErrors !== false ? getCapturedRuntimeErrors() : [];
    
    // NEW: Performance API network failures
    const performanceNetworkErrors = options.includePerformanceNetworkErrors !== false 
      ? getNetworkFailuresFromPerformance() 
      : [];
    
    // NEW: Privacy masking
    const applyMasking = options.applyPrivacyMasking !== false;
    const sensitiveDataTypes = detectSensitiveDataTypes(visibleText);
    if (applyMasking && sensitiveDataTypes.length > 0) {
      visibleText = maskSensitiveData(visibleText);
    }

    // Merge additional sections
    const allSections = [
      ...relevantSections,
      ...codeBlocks,
      ...tables,
      ...formContext,
    ];
    if (modalContent) allSections.push(modalContent);

    const context: ContextPayload = {
      metadata: {
        captureTimestamp: new Date().toISOString(),
        captureMode: 'manual',
        browserInfo: {
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          language: navigator.language,
        },
        // Extended metadata
        extendedFeatures: {
          consoleLogs: consoleLogs.length,
          networkErrors: networkErrors.length + performanceNetworkErrors.length,
          runtimeErrors: runtimeErrors.length,
          codeBlocks: codeBlocks.length,
          tables: tables.length,
          forms: formContext.length,
          hasModal: !!modalContent,
          uiState: uiState?.pageState || 'unknown',
          privacyMaskingApplied: applyMasking && sensitiveDataTypes.length > 0,
          sensitiveDataTypesFound: sensitiveDataTypes,
        },
      },
      page: {
        url: applyMasking ? maskSensitiveData(window.location.href) : window.location.href,
        urlParsed: {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          pathname: window.location.pathname,
          search: applyMasking ? maskSensitiveData(window.location.search) : window.location.search,
          hash: window.location.hash,
        },
        title: document.title,
        platform: {
          ...platform,
          specificContext: Object.keys(platformSpecific).length > 0 ? platformSpecific : undefined,
        },
        // NEW: UI State
        uiState: uiState ? {
          pageState: uiState.pageState,
          loadingIndicators: uiState.loadingIndicators,
          disabledButtons: uiState.disabledButtons,
          emptyStates: uiState.emptyStates,
          errorStates: uiState.errorStates,
          toastNotifications: uiState.toastNotifications,
          modalOpen: uiState.modalOpen,
          formValidationErrors: uiState.formValidationErrors,
          interactiveElements: uiState.interactiveElements,
        } : undefined,
      },
      text: {
        selectedText: applyMasking && selectedText ? maskSensitiveData(selectedText) : selectedText,
        visibleText,
        headings,
        errors,
        // Console logs
        consoleLogs: consoleLogs.map(log => ({
          level: log.level,
          message: applyMasking ? maskSensitiveData(log.message) : log.message,
          timestamp: log.timestamp,
          stackTrace: log.stackTrace,
        })),
        // Network errors (both intercepted and from Performance API)
        networkErrors: [
          ...networkErrors.map(err => ({
            url: applyMasking ? maskSensitiveData(err.url) : err.url,
            method: err.method,
            status: err.status,
            statusText: err.statusText,
            errorMessage: err.errorMessage,
            timestamp: err.timestamp,
            source: 'intercepted' as const,
          })),
          ...performanceNetworkErrors.map(err => ({
            url: applyMasking ? maskSensitiveData(err.url) : err.url,
            method: 'UNKNOWN',
            status: undefined,
            statusText: undefined,
            errorMessage: err.failed ? 'Request failed' : undefined,
            timestamp: err.timestamp,
            source: 'performance-api' as const,
          })),
        ],
        // NEW: Runtime JavaScript errors
        runtimeErrors: runtimeErrors.map(err => ({
          message: applyMasking ? maskSensitiveData(err.message) : err.message,
          source: err.source,
          lineno: err.lineno,
          colno: err.colno,
          stack: err.error,
          timestamp: err.timestamp,
          type: err.type,
        })),
        metadata: {
          totalLength: document.body.textContent?.length || 0,
          truncated: visibleText.length >= SIZE_LIMITS.visibleText,
          truncationReason: visibleText.length >= SIZE_LIMITS.visibleText ? 'max length exceeded' : undefined,
        },
      },
      structure: {
        relevantSections: allSections.slice(0, 15), // Limit total sections
        errorContainers,
        codeBlocks,
        tables,
        forms: formContext,
        modal: modalContent,
        activeElements: {
          focusedElement: document.activeElement 
            ? snapshotElement(document.activeElement as HTMLElement)
            : undefined,
        },
        metadata: {
          totalNodes: document.getElementsByTagName('*').length,
          extractedNodes: allSections.length,
          relevanceScore: allSections.length > 0 ? 0.7 : 0.3,
        },
      },
      session: {
        sessionId: '', // Will be filled by caller
        sessionType: 'general',
        intent: {
          primary: 'help',
          keywords: [],
          implicitSignals: [],
        },
        previousMessages: {
          count: 0,
          lastN: [],
        },
      },
      privacy: {
        redactedFields,
        sensitiveDataDetected: redactedFields.length > 0 || sensitiveDataTypes.length > 0,
        sensitiveDataTypes,
        privacyMaskingApplied: applyMasking && sensitiveDataTypes.length > 0,
        consentGiven: true, // Assumed since user invoked the extraction
        dataRetention: 'session',
      },
    };

    const extractionTimeMs = performance.now() - startTime;

    return {
      success: true,
      context,
      extractionTimeMs,
    };
  } catch (error) {
    const extractionTimeMs = performance.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during context extraction',
      extractionTimeMs,
    };
  }
}

/**
 * Message listener for context extraction requests from background script
 */
export function setupContextExtractionListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTEXT') {
      const result = extractContext(message.options || {});
      sendResponse(result);
      return true;
    }
    
    if (message.type === 'GET_PLATFORM') {
      const platform = detectPlatform();
      sendResponse({ platform });
      return true;
    }
    
    if (message.type === 'GET_ERRORS') {
      const errors = extractErrors();
      sendResponse({ errors });
      return true;
    }
    
    return false;
  });
}
