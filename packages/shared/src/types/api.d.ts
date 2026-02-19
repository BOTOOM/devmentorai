/**
 * API type definitions for DevMentorAI
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    copilotConnected: boolean;
    uptime: number;
    timestamp: string;
    /** Latest available version (if update check has run) */
    latestVersion?: string;
    /** Whether a newer version is available */
    updateAvailable?: boolean;
}
export type ModelPricingTier = 'free' | 'cheap' | 'standard' | 'premium';
export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    available: boolean;
    description?: string;
    isDefault?: boolean;
    pricingTier?: ModelPricingTier;
    pricingMultiplier?: number;
    supportedReasoningEfforts?: string[];
}
export interface CopilotAuthStatus {
    isAuthenticated: boolean;
    login?: string | null;
    reason?: string;
}
export interface CopilotQuotaStatus {
    used?: number | null;
    included?: number | null;
    remaining?: number | null;
    percentageUsed?: number | null;
    percentageRemaining?: number | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    raw?: Record<string, unknown>;
}
//# sourceMappingURL=api.d.ts.map