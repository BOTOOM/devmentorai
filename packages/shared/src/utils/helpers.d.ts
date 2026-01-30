/**
 * Utility functions for DevMentorAI
 */
/**
 * Generate a unique ID
 */
export declare function generateId(prefix?: string): string;
/**
 * Generate a session ID
 */
export declare function generateSessionId(): string;
/**
 * Generate a message ID
 */
export declare function generateMessageId(): string;
/**
 * Format a date as ISO string
 */
export declare function formatDate(date?: Date): string;
/**
 * Parse an ISO date string to Date
 */
export declare function parseDate(dateString: string): Date;
/**
 * Truncate text to a maximum length
 */
export declare function truncate(text: string, maxLength: number, suffix?: string): string;
/**
 * Sleep for a given number of milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}): Promise<T>;
/**
 * Create an AbortController with timeout
 */
export declare function createTimeoutController(timeoutMs: number): AbortController;
//# sourceMappingURL=helpers.d.ts.map