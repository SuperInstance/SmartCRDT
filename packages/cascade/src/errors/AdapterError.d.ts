/**
 * AdapterError - Base class for all adapter-related errors
 *
 * This error provides structured information about adapter failures,
 * including which adapter failed, what operation was being performed,
 * and whether the error is retryable.
 *
 * @packageDocumentation
 */
import type { AxiosError } from "axios";
/**
 * Severity level of the error
 */
export declare enum ErrorSeverity {
    /** Low severity - can be recovered automatically */
    LOW = "low",
    /** Medium severity - requires user attention or fallback */
    MEDIUM = "medium",
    /** High severity - critical failure, manual intervention required */
    HIGH = "high",
    /** Critical severity - system may be unstable */
    CRITICAL = "critical"
}
/**
 * Recovery strategy suggestion for the error
 */
export declare enum RecoveryStrategy {
    /** Retry the operation with exponential backoff */
    RETRY = "retry",
    /** Fall back to alternative adapter/service */
    FALLBACK = "fallback",
    /** Gracefully degrade functionality */
    DEGRADE = "degrade",
    /** Skip this operation and continue */
    SKIP = "skip",
    /** Manual intervention required */
    MANUAL = "manual",
    /** Abort the operation */
    ABORT = "abort"
}
/**
 * Base error context interface
 */
export interface ErrorContext {
    /** Additional contextual information */
    [key: string]: unknown;
}
/**
 * Adapter-specific error context
 */
export interface AdapterErrorContext extends ErrorContext {
    /** Name of the adapter that failed */
    adapterName: string;
    /** Operation being performed when error occurred */
    operation: string;
    /** HTTP status code if applicable */
    statusCode?: number;
    /** Request/response details */
    requestDetails?: {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
    };
    /** Underlying network error */
    networkError?: {
        code?: string;
        errno?: number;
        syscall?: string;
        address?: string;
        port?: number;
    };
}
/**
 * AdapterError - Base class for all adapter errors
 *
 * All adapter-specific errors should extend this class.
 *
 * @example
 * ```typescript
 * throw new AdapterError(
 *   'Ollama',
 *   'generate',
 *   'Connection refused',
 *   'ECONNREFUSED',
 *   { statusCode: undefined, retryable: true }
 * );
 * ```
 */
export declare class AdapterError extends Error {
    /** Error code for programmatic handling */
    readonly code: string;
    /** Severity level of the error */
    readonly severity: ErrorSeverity;
    /** Suggested recovery strategy */
    readonly recovery: RecoveryStrategy;
    /** Whether this error is retryable */
    readonly retryable: boolean;
    /** Request ID for tracing */
    readonly requestId?: string;
    /** Timestamp when error occurred */
    readonly timestamp: number;
    /** Adapter-specific context */
    readonly context: AdapterErrorContext;
    /** Original error that caused this error */
    readonly cause?: Error;
    /**
     * Create a new AdapterError
     *
     * @param adapterName - Name of the adapter that failed
     * @param operation - Operation being performed
     * @param message - Human-readable error message
     * @param code - Error code for programmatic handling
     * @param context - Additional error context
     * @param cause - Original error that caused this error
     */
    constructor(adapterName: string, operation: string, message: string, code: string, context?: Partial<AdapterErrorContext>, cause?: Error);
    /**
     * Adapter name (convenience property)
     */
    private readonly adapterName;
    /**
     * Operation (convenience property)
     */
    private readonly operation;
    /**
     * Convert error to JSON for logging/serialization
     */
    toJSON(): Record<string, unknown>;
    /**
     * Convert error to human-readable string
     */
    toString(): string;
    /**
     * Check if this error matches a given error code
     */
    isErrorCode(code: string): boolean;
    /**
     * Check if error has specific severity level or higher
     */
    hasSeverityAtLeast(minSeverity: ErrorSeverity): boolean;
    /**
     * Create an AdapterError from an Axios error
     * Note: Subclasses should override this method with their own specific error handling
     */
    static fromAxiosError(adapterName: string, operation: string, axiosError: AxiosError<unknown>): AdapterError;
}
export default AdapterError;
//# sourceMappingURL=AdapterError.d.ts.map