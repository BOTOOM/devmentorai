/**
 * Utility functions for DevMentorAI
 */
/**
 * Generate a unique ID
 */
export function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
/**
 * Generate a session ID
 */
export function generateSessionId() {
    return generateId('session');
}
/**
 * Generate a message ID
 */
export function generateMessageId() {
    return generateId('msg');
}
/**
 * Format a date as ISO string
 */
export function formatDate(date = new Date()) {
    return date.toISOString();
}
/**
 * Parse an ISO date string to Date
 */
export function parseDate(dateString) {
    return new Date(dateString);
}
/**
 * Truncate text to a maximum length
 */
export function truncate(text, maxLength, suffix = '...') {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
}
/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, options = {}) {
    const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, } = options;
    let lastError;
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxAttempts)
                break;
            await sleep(delay);
            delay = Math.min(delay * backoffFactor, maxDelay);
        }
    }
    throw lastError;
}
/**
 * Create an AbortController with timeout
 */
export function createTimeoutController(timeoutMs) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller;
}
//# sourceMappingURL=helpers.js.map