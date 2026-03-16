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
    activeProvider?: string;
    providerStates?: Record<string, {
        ready: boolean;
        mockMode: boolean;
    }>;
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
    supportsVision?: boolean;
    supportsAttachments?: boolean;
}
export type ProviderSessionRecoveryMode = 'native' | 'replay' | 'summary' | 'none';
export interface ProviderAuthStatus {
    provider: string;
    isAuthenticated: boolean;
    login?: string | null;
    reason?: string;
    requiresCredential?: boolean;
    credentialConfigured?: boolean;
    keyPreview?: string | null;
    credentialLastUpdated?: string | null;
    supportsNativeResume?: boolean;
    sessionRecoveryMode?: ProviderSessionRecoveryMode;
}
export interface ProviderQuotaStatus {
    provider: string;
    used?: number | null;
    included?: number | null;
    remaining?: number | null;
    percentageUsed?: number | null;
    percentageRemaining?: number | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    raw?: Record<string, unknown>;
}
export interface ProviderCredentialStatus {
    provider: string;
    configured: boolean;
    keyPreview?: string | null;
    updatedAt?: string | null;
    storage: 'local-backend-encrypted';
}
export interface SetProviderCredentialRequest {
    provider: string;
    apiKey: string;
}
export type CopilotAuthStatus = ProviderAuthStatus;
export type CopilotQuotaStatus = ProviderQuotaStatus;
//# sourceMappingURL=api.d.ts.map