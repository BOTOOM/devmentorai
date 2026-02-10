/**
 * Context-Aware Mentor Mode Types
 *
 * These types define the structured context payload that is extracted from
 * the browser and sent to the backend for context-aware AI responses.
 */
export type PlatformType = 'azure' | 'aws' | 'gcp' | 'github' | 'gitlab' | 'datadog' | 'newrelic' | 'grafana' | 'jenkins' | 'kubernetes' | 'docker' | 'generic';
export interface PlatformDetection {
    type: PlatformType;
    confidence: number;
    indicators: string[];
    specificProduct?: string;
    specificContext?: Record<string, unknown>;
}
export type ErrorType = 'error' | 'warning' | 'info';
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorSource = 'console' | 'ui' | 'network' | 'dom';
export interface ExtractedError {
    type: ErrorType;
    message: string;
    source?: ErrorSource;
    severity: ErrorSeverity;
    context?: string;
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
export type SectionPurpose = 'error-container' | 'alert' | 'panel' | 'table' | 'form' | 'code-block' | 'modal' | 'generic';
export interface HTMLSection {
    purpose: SectionPurpose;
    outerHTML: string;
    textContent: string;
    attributes: Record<string, string>;
    xpath?: string;
}
export interface Heading {
    level: 1 | 2 | 3;
    text: string;
    xpath?: string;
    hierarchy?: string;
}
export interface ConsoleLogs {
    errors: string[];
    warnings: string[];
    included: boolean;
    truncated: boolean;
}
export interface CapturedConsoleLog {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: string;
    stackTrace?: string;
}
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
/** Session type specifically for context-aware mode (extends base SessionType) */
export type ContextSessionType = 'devops' | 'debugging' | 'frontend' | 'general' | 'writing';
export interface ContextMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}
export interface ScreenshotData {
    dataUrl: string;
    format: 'png' | 'jpeg';
    dimensions: {
        width: number;
        height: number;
    };
    fileSize: number;
    quality?: number;
}
export interface VisualContext {
    screenshot?: ScreenshotData;
    supported: boolean;
    included: boolean;
    reason?: string;
}
export interface PrivacyInfo {
    redactedFields: string[];
    sensitiveDataDetected: boolean;
    consentGiven: boolean;
    dataRetention: 'session' | 'none';
    privacyMaskingApplied?: boolean;
    sensitiveDataTypes?: string[];
}
export interface ContextPayload {
    metadata: {
        captureTimestamp: string;
        captureMode: 'auto' | 'manual';
        browserInfo: {
            userAgent: string;
            viewport: {
                width: number;
                height: number;
            };
            language: string;
        };
        phase2Features?: {
            consoleLogs: number;
            networkErrors: number;
            codeBlocks: number;
            tables: number;
            forms: number;
            hasModal: boolean;
        };
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
    text: {
        selectedText?: string;
        visibleText: string;
        headings: Heading[];
        errors: ExtractedError[];
        logs?: ConsoleLogs;
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
    structure: {
        relevantSections: HTMLSection[];
        errorContainers: HTMLSection[];
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
            relevanceScore: number;
        };
    };
    visual?: VisualContext;
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
    privacy: PrivacyInfo;
}
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
export declare const CONTEXT_SIZE_LIMITS: {
    readonly visibleText: 10000;
    readonly htmlSection: 500;
    readonly totalHTML: 5000;
    readonly headings: 50;
    readonly errors: 20;
    readonly consoleLogs: 100;
    readonly screenshot: number;
    readonly selectedText: 5000;
};
//# sourceMappingURL=context.d.ts.map