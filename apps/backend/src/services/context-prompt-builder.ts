/**
 * Context Prompt Builder Service
 * 
 * Builds context-enriched prompts for the Copilot SDK based on extracted page context.
 * 
 * PHASE 3 DESIGN PRINCIPLE - AUTONOMOUS AGENT:
 * ============================================
 * 1. We provide PURELY FACTUAL context (what's on the page)
 * 2. We do NOT tell the agent what to do (no "Task:" instructions)
 * 3. We do NOT interpret user intent (the LLM decides)
 * 4. We do NOT use keyword matching (multilingual support, agent autonomy)
 * 5. The agent (Copilot) is fully autonomous in deciding:
 *    - What the user wants
 *    - How to respond  
 *    - What context is relevant
 * 
 * CustomAgents (DevOps Mentor, etc.) are set at session creation and provide
 * domain expertise. This function ONLY adds situational context from the page.
 */

import type {
  ContextPayload,
  PlatformDetection,
  ExtractedError,
  HTMLSection,
  Heading,
} from '@devmentorai/shared';

// ============================================================================
// Platform-Specific Context Notes (Factual, NOT instructions)
// ============================================================================

/**
 * Platform context notes - FACTUAL ONLY
 * These describe where relevant information can be found, NOT what the agent should do.
 */
const PLATFORM_CONTEXT_NOTES: Record<string, string> = {
  azure: `**Platform:** Azure Portal
Common diagnostic locations: Activity Log, Diagnose and solve problems, Resource health`,

  aws: `**Platform:** AWS Console  
Common diagnostic locations: CloudTrail, CloudWatch Logs, IAM policies`,

  gcp: `**Platform:** Google Cloud Console
Common diagnostic locations: Cloud Logging, Error Reporting, IAM bindings`,

  github: `**Platform:** GitHub
Common diagnostic locations: Actions tab, Issues, Pull Requests`,

  gitlab: `**Platform:** GitLab
Common diagnostic locations: Pipelines, Merge Requests, Project settings`,

  kubernetes: `**Platform:** Kubernetes Dashboard
Common diagnostic commands: kubectl logs, kubectl describe, kubectl get events`,

  jenkins: `**Platform:** Jenkins
Common diagnostic locations: Console output, Pipeline syntax, Agent status`,

  datadog: `**Platform:** Datadog
Common diagnostic locations: Metric graphs, Alert conditions, Integration status`,

  grafana: `**Platform:** Grafana
Common diagnostic locations: Query editor, Data source config, Alert rules`,

  generic: ``,
};

// ============================================================================
// Context Formatting Functions
// ============================================================================

/**
 * Format page context section for the prompt
 */
function formatPageContext(page: ContextPayload['page']): string {
  const { platform } = page;
  const platformLabel = platform.specificProduct || platform.type.toUpperCase();
  
  let section = `## Page Context\n`;
  section += `- **Platform:** ${platformLabel}`;
  if (platform.confidence < 0.8) {
    section += ` (confidence: ${Math.round(platform.confidence * 100)}%)`;
  }
  section += '\n';
  section += `- **URL:** ${page.url}\n`;
  section += `- **Title:** ${page.title}\n`;
  
  return section;
}

/**
 * Format errors section for the prompt - FACTUAL ONLY
 * No severity emojis - the agent interprets severity
 */
function formatErrors(errors: ExtractedError[]): string {
  if (errors.length === 0) return '';

  let section = `## Errors and Alerts on Page\n`;
  section += `${errors.length} issue(s) detected:\n\n`;

  for (const error of errors) {
    section += `- **[${error.severity.toUpperCase()}]** ${error.message}\n`;
    if (error.source) section += `  Source: ${error.source}\n`;
    if (error.context) section += `  Context: ${error.context}\n`;
    if (error.stackTrace) section += `  Stack: ${error.stackTrace.slice(0, 200)}...\n`;
    section += '\n';
  }

  return section;
}

/**
 * Format headings hierarchy for the prompt
 */
function formatHeadings(headings: Heading[]): string {
  if (headings.length === 0) return '';

  let section = `## Page Structure (Headings)\n`;
  for (const heading of headings.slice(0, 10)) {
    const indent = '  '.repeat(heading.level - 1);
    section += `${indent}- ${heading.text}\n`;
  }
  return section + '\n';
}

/**
 * Format relevant HTML sections for the prompt
 */
function formatRelevantSections(sections: HTMLSection[]): string {
  if (sections.length === 0) return '';

  let section = `## Relevant UI Elements\n`;
  for (const s of sections.slice(0, 5)) {
    section += `### ${s.purpose.replace('-', ' ').toUpperCase()}\n`;
    section += `\`\`\`\n${s.textContent.slice(0, 300)}\n\`\`\`\n\n`;
  }
  return section;
}

/**
 * Format code blocks for the prompt (Phase 2)
 */
function formatCodeBlocks(codeBlocks?: HTMLSection[]): string {
  if (!codeBlocks || codeBlocks.length === 0) return '';

  let section = `## Code Snippets Found on Page\n`;
  for (const block of codeBlocks.slice(0, 3)) {
    const lang = block.attributes.detectedLanguage || 'text';
    section += `### ${lang.toUpperCase()}\n`;
    section += `\`\`\`${lang}\n${block.textContent.slice(0, 500)}\n\`\`\`\n\n`;
  }
  return section;
}

/**
 * Format tables for the prompt (Phase 2)
 */
function formatTables(tables?: HTMLSection[]): string {
  if (!tables || tables.length === 0) return '';

  let section = `## Data Tables\n`;
  for (const table of tables.slice(0, 2)) {
    const rows = table.attributes.rowCount || '?';
    const cols = table.attributes.columnCount || '?';
    section += `### Table (${rows} rows × ${cols} cols)\n`;
    section += `\`\`\`\n${table.textContent.slice(0, 400)}\n\`\`\`\n\n`;
  }
  return section;
}

/**
 * Format console logs for the prompt (Phase 2) - FACTUAL ONLY
 */
function formatConsoleLogs(logs?: Array<{ level: string; message: string; timestamp: string; stackTrace?: string }>): string {
  if (!logs || logs.length === 0) return '';

  const errors = logs.filter(l => l.level === 'error' || l.level === 'warn');
  if (errors.length === 0) return '';

  let section = `## Browser Console Logs\n`;
  section += `${errors.length} error/warning message(s):\n\n`;
  
  for (const log of errors.slice(0, 5)) {
    section += `- **${log.level.toUpperCase()}:** ${log.message.slice(0, 200)}\n`;
    if (log.stackTrace) {
      section += `  Stack: ${log.stackTrace.slice(0, 150)}...\n`;
    }
    section += '\n';
  }
  return section;
}

/**
 * Format network errors for the prompt (Phase 2) - FACTUAL ONLY
 */
function formatNetworkErrors(errors?: Array<{ url: string; method: string; status?: number; errorMessage?: string }>): string {
  if (!errors || errors.length === 0) return '';

  let section = `## Network Requests Failed\n`;
  section += `${errors.length} failed request(s):\n\n`;
  
  for (const err of errors.slice(0, 5)) {
    const status = err.status ? `HTTP ${err.status}` : (err.errorMessage || 'Failed');
    section += `- **${err.method}** ${err.url.slice(0, 80)}${err.url.length > 80 ? '...' : ''}\n`;
    section += `  Status: ${status}\n\n`;
  }
  return section;
}

/**
 * Format modal content for the prompt (Phase 2)
 */
function formatModalContent(modal?: HTMLSection): string {
  if (!modal) return '';

  let section = `## Active Modal/Dialog\n`;
  const title = modal.attributes.title || 'Modal';
  section += `### ${title}\n`;
  section += `\`\`\`\n${modal.textContent.slice(0, 400)}\n\`\`\`\n\n`;
  return section;
}

/**
 * Format platform-specific context for the prompt (Phase 2)
 */
function formatPlatformSpecificContext(platformContext?: Record<string, unknown>): string {
  if (!platformContext || Object.keys(platformContext).length === 0) return '';

  let section = `## Platform-Specific Details\n`;
  for (const [key, value] of Object.entries(platformContext)) {
    if (value !== undefined && value !== null) {
      section += `- **${key}:** ${String(value)}\n`;
    }
  }
  return section + '\n';
}

/**
 * Format UI state for the prompt
 */
function formatUIState(uiState: {
  pageState: string;
  loadingIndicators: number;
  disabledButtons: number;
  emptyStates: number;
  errorStates: number;
  toastNotifications: number;
  modalOpen: boolean;
  formValidationErrors: number;
}): string {
  let section = `## UI State\n`;
  section += `- **Page State:** ${uiState.pageState}\n`;
  
  const issues: string[] = [];
  if (uiState.loadingIndicators > 0) issues.push(`${uiState.loadingIndicators} loading indicator(s)`);
  if (uiState.errorStates > 0) issues.push(`${uiState.errorStates} error state(s)`);
  if (uiState.emptyStates > 0) issues.push(`${uiState.emptyStates} empty state(s)`);
  if (uiState.toastNotifications > 0) issues.push(`${uiState.toastNotifications} notification(s)`);
  if (uiState.formValidationErrors > 0) issues.push(`${uiState.formValidationErrors} form validation error(s)`);
  if (uiState.disabledButtons > 0) issues.push(`${uiState.disabledButtons} disabled button(s)`);
  if (uiState.modalOpen) issues.push(`modal/dialog open`);
  
  if (issues.length > 0) {
    section += `- **UI Issues:** ${issues.join(', ')}\n`;
  }
  
  return section + '\n';
}

/**
 * Format runtime JavaScript errors for the prompt
 */
function formatRuntimeErrors(errors: Array<{
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type: string;
}>): string {
  if (errors.length === 0) return '';

  let section = `## JavaScript Runtime Errors\n`;
  section += `${errors.length} runtime error(s) detected:\n\n`;
  
  for (const err of errors.slice(0, 5)) {
    const errType = err.type === 'unhandledrejection' ? 'Promise Rejection' : 'JS Error';
    section += `- **${errType}:** ${err.message.slice(0, 200)}\n`;
    if (err.source) {
      section += `  Source: ${err.source}${err.lineno ? `:${err.lineno}` : ''}${err.colno ? `:${err.colno}` : ''}\n`;
    }
    if (err.stack) {
      section += `  Stack: ${err.stack.slice(0, 150)}...\n`;
    }
    section += '\n';
  }
  return section;
}

/**
 * Format user selection for the prompt
 */
function formatSelectedText(selectedText?: string): string {
  if (!selectedText) return '';
  
  return `## User Selected Text\nThe user has highlighted this text on the page:\n\`\`\`\n${selectedText}\n\`\`\`\n\n`;
}

/**
 * Format session history for the prompt - FACTUAL ONLY
 */
function formatSessionHistory(messages: { count: number; lastN: Array<{ role: string; content: string }> }): string {
  if (messages.count === 0 || messages.lastN.length === 0) return '';

  let section = `## Recent Conversation (${messages.count} messages total)\n`;
  for (const msg of messages.lastN) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    section += `**${role}:** ${msg.content.slice(0, 200)}${msg.content.length > 200 ? '...' : ''}\n\n`;
  }
  return section;
}

// ============================================================================
// Main Prompt Builder
// ============================================================================

export interface ContextAwarePromptOptions {
  includePlatformNotes?: boolean;
  includeErrors?: boolean;
  includeStructure?: boolean;
  // Phase 2 options
  includeCodeBlocks?: boolean;
  includeTables?: boolean;
  includeConsoleLogs?: boolean;
  includeNetworkErrors?: boolean;
  includeModal?: boolean;
  includePlatformSpecific?: boolean;
  maxContextLength?: number;
  // Phase 3: intentInstructions REMOVED - agent is autonomous
}

const DEFAULT_OPTIONS: ContextAwarePromptOptions = {
  includePlatformNotes: true,
  includeErrors: true,
  includeStructure: true,
  // Phase 2 defaults
  includeCodeBlocks: true,
  includeTables: true,
  includeConsoleLogs: true,
  includeNetworkErrors: true,
  includeModal: true,
  includePlatformSpecific: true,
  maxContextLength: 10000, // Increased for Phase 2
};

/**
 * Build a context-enriched user prompt from extracted page context.
 * 
 * PHASE 3 - AUTONOMOUS AGENT DESIGN:
 * ==================================
 * - Returns ONLY factual context (what's on the page)
 * - Does NOT tell the agent what to do
 * - Does NOT interpret user intent
 * - The agent decides everything based on the context and user message
 * 
 * CustomAgents (DevOps Mentor, etc.) are set at session creation and provide
 * domain expertise. This function ONLY adds situational context.
 * 
 * IMPORTANT: The context comes from the user's authenticated browser session.
 * The agent should use this context to answer questions about private/internal
 * pages that are not publicly accessible.
 */
export function buildContextAwarePrompt(
  context: ContextPayload,
  userMessage: string,
  options: ContextAwarePromptOptions = {}
): { systemPrompt: string | null; userPrompt: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Build the enriched user prompt with FACTUAL context sections
  let enrichedPrompt = '';
  
  // Context header - explains that this data comes from user's browser
  enrichedPrompt += `# Browser Context (from user's authenticated session)\n\n`;
  enrichedPrompt += `The following context was extracted from the user's browser. `;
  enrichedPrompt += `This may include private or authenticated content that is not publicly accessible. `;
  enrichedPrompt += `Use this context to answer the user's question - DO NOT attempt to fetch URLs externally.\n\n`;

  // Page context (always included)
  enrichedPrompt += formatPageContext(context.page);

  // UI State (if available) - helps understand page state
  if ((context.page as any).uiState) {
    enrichedPrompt += formatUIState((context.page as any).uiState);
  }

  // Platform-specific notes (factual locations, NOT instructions)
  if (opts.includePlatformNotes) {
    const platformNotes = PLATFORM_CONTEXT_NOTES[context.page.platform.type] || 
                          PLATFORM_CONTEXT_NOTES.generic;
    if (platformNotes) {
      enrichedPrompt += platformNotes + '\n\n';
    }
  }

  // Phase 2: Platform-specific context details
  if (opts.includePlatformSpecific && context.page.platform.specificContext) {
    enrichedPrompt += formatPlatformSpecificContext(context.page.platform.specificContext);
  }

  // Errors (factual listing)
  if (opts.includeErrors) {
    enrichedPrompt += formatErrors(context.text.errors);
  }

  // Console errors
  if (opts.includeConsoleLogs && context.text.consoleLogs) {
    enrichedPrompt += formatConsoleLogs(context.text.consoleLogs);
  }

  // Network errors
  if (opts.includeNetworkErrors && context.text.networkErrors) {
    enrichedPrompt += formatNetworkErrors(context.text.networkErrors);
  }

  // Runtime JavaScript errors (new)
  if ((context.text as any).runtimeErrors?.length > 0) {
    enrichedPrompt += formatRuntimeErrors((context.text as any).runtimeErrors);
  }

  // Selected text (user highlighted something specific)
  enrichedPrompt += formatSelectedText(context.text.selectedText);

  // Modal content (if present)
  if (opts.includeModal && context.structure.modal) {
    enrichedPrompt += formatModalContent(context.structure.modal);
  }

  // Structure (headings + sections) - helps AI understand page layout
  if (opts.includeStructure) {
    enrichedPrompt += formatHeadings(context.text.headings);
    enrichedPrompt += formatRelevantSections(context.structure.relevantSections);
  }

  // Code blocks
  if (opts.includeCodeBlocks && context.structure.codeBlocks) {
    enrichedPrompt += formatCodeBlocks(context.structure.codeBlocks);
  }

  // Tables
  if (opts.includeTables && context.structure.tables) {
    enrichedPrompt += formatTables(context.structure.tables);
  }

  // Session history (for continuity)
  enrichedPrompt += formatSessionHistory(context.session.previousMessages);

  // Privacy note
  if (context.privacy?.privacyMaskingApplied) {
    enrichedPrompt += `\n**Note:** Some sensitive data (${context.privacy.sensitiveDataTypes?.join(', ') || 'various types'}) has been redacted for privacy.\n\n`;
  }

  // Add the actual user message
  enrichedPrompt += `---\n\n## User Message\n${userMessage}\n`;

  // Truncate if too long
  if (enrichedPrompt.length > (opts.maxContextLength || 10000)) {
    enrichedPrompt = truncatePrompt(enrichedPrompt, opts.maxContextLength || 10000, userMessage);
  }

  // Return null for systemPrompt - we don't override Copilot's default
  return { systemPrompt: null, userPrompt: enrichedPrompt };
}

/**
 * Truncate prompt while preserving the user's actual message
 */
function truncatePrompt(prompt: string, maxLength: number, userMessage: string): string {
  const userMessageSection = `## User Message\n${userMessage}\n`;
  const reservedLength = userMessageSection.length + 500; // Reserve space for user message + buffer
  const availableLength = maxLength - reservedLength;

  if (availableLength < 500) {
    // Not enough space for context, just return user message
    return userMessageSection;
  }

  // Find a good truncation point
  const truncatedContext = prompt.slice(0, availableLength);
  const lastNewline = truncatedContext.lastIndexOf('\n');
  
  return truncatedContext.slice(0, lastNewline) + '\n\n[Context truncated for length]\n\n' + userMessageSection;
}

/**
 * Build a simple prompt without full context (fallback)
 * 
 * This also does NOT replace Copilot's system prompt.
 * Just enriches the user message with available context.
 */
export function buildSimplePrompt(
  userMessage: string,
  pageUrl?: string,
  pageTitle?: string,
  selectedText?: string
): { systemPrompt: string | null; userPrompt: string } {
  let userPrompt = '';
  
  // Add any available context to the user message
  if (pageUrl || pageTitle || selectedText) {
    userPrompt += `**Context:**\n`;
    if (pageUrl) userPrompt += `- Page URL: ${pageUrl}\n`;
    if (pageTitle) userPrompt += `- Page Title: ${pageTitle}\n`;
    if (selectedText) userPrompt += `- Selected Text: "${selectedText.slice(0, 500)}${selectedText.length > 500 ? '...' : ''}"\n`;
    userPrompt += '\n**Question:** ';
  }
  
  userPrompt += userMessage;

  // Return null for systemPrompt - we don't override Copilot's default
  return { systemPrompt: null, userPrompt };
}

/**
 * Validate context payload before using it for prompt building
 */
export function validateContext(context: unknown): context is ContextPayload {
  if (!context || typeof context !== 'object') return false;
  
  const c = context as Record<string, unknown>;
  
  // Check required fields
  if (!c.metadata || typeof c.metadata !== 'object') return false;
  if (!c.page || typeof c.page !== 'object') return false;
  if (!c.text || typeof c.text !== 'object') return false;
  if (!c.session || typeof c.session !== 'object') return false;
  
  return true;
}

/**
 * Sanitize context payload by removing any remaining sensitive data
 */
export function sanitizeContext(context: ContextPayload): ContextPayload {
  // Create a deep copy to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(context)) as ContextPayload;

  // Additional sanitization patterns
  const sensitivePatterns = [
    /Bearer\s+[A-Za-z0-9\-_]+/gi,
    /api[_-]?key[=:]\s*[A-Za-z0-9\-_]+/gi,
    /password[=:]\s*\S+/gi,
    /token[=:]\s*[A-Za-z0-9\-_]+/gi,
  ];

  // Sanitize visible text
  let visibleText = sanitized.text.visibleText;
  for (const pattern of sensitivePatterns) {
    visibleText = visibleText.replace(pattern, '[REDACTED]');
  }
  sanitized.text.visibleText = visibleText;

  // Sanitize URL query params
  const url = new URL(sanitized.page.url);
  const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
  for (const param of sensitiveParams) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, '[REDACTED]');
    }
  }
  sanitized.page.url = url.toString();
  sanitized.page.urlParsed.search = url.search;

  return sanitized;
}
