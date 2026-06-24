/**
 * Context-Aware Mentor Mode Types
 *
 * These types define the structured context payload that is extracted from
 * the browser and sent to the backend for context-aware AI responses.
 */
// ============================================================================
// Size Limits Configuration
// ============================================================================
export const CONTEXT_SIZE_LIMITS = {
    visibleText: 10000, // chars
    htmlSection: 500, // chars per section
    totalHTML: 5000, // chars total HTML
    headings: 50, // max headings
    errors: 20, // max errors
    consoleLogs: 100, // lines
    screenshot: 1024 * 1024, // 1MB
    selectedText: 5000, // chars
};
//# sourceMappingURL=context.js.map