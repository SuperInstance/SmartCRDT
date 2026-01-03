/**
 * OllamaAdapterError - Ollama-specific adapter errors
 *
 * Provides structured error handling for Ollama API interactions,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */
import { AdapterError } from "./AdapterError.js";
import type { AxiosError } from "axios";
/**
 * Ollama-specific error codes
 */
export declare enum OllamaErrorCode {
    /** Connection refused - Ollama not running */
    ECONNREFUSED = "OLLAMA_ECONNREFUSED",
    /** Request timeout */
    TIMEOUT = "OLLAMA_TIMEOUT",
    /** Model not found on server */
    MODEL_NOT_FOUND = "OLLAMA_MODEL_NOT_FOUND",
    /** Internal server error */
    INTERNAL_ERROR = "OLLAMA_INTERNAL_ERROR",
    /** Generic HTTP error */
    HTTP_ERROR = "OLLAMA_HTTP_ERROR",
    /** Invalid request format */
    INVALID_REQUEST = "OLLAMA_INVALID_REQUEST",
    /** Model loading failed */
    MODEL_LOAD_FAILED = "OLLAMA_MODEL_LOAD_FAILED",
    /** Generation failed */
    GENERATION_FAILED = "OLLAMA_GENERATION_FAILED",
    /** Unknown error */
    UNKNOWN_ERROR = "OLLAMA_UNKNOWN_ERROR"
}
/**
 * Error recovery information specific to Ollama
 */
export interface OllamaRecoveryInfo {
    /** Suggested wait time before retry (ms) */
    waitTime?: number;
    /** Suggested alternative model */
    alternativeModel?: string;
    /** Whether to check Ollama health */
    checkHealth?: boolean;
    /** Command to start Ollama (if applicable) */
    startCommand?: string;
}
/**
 * OllamaAdapterError - Ollama-specific error class
 *
 * @example
 * ```typescript
 * throw OllamaAdapterError.connectionRefused('http://localhost:11434');
 * throw OllamaAdapterError.modelNotFound('llama2');
 * throw OllamaAdapterError.timeout(30000);
 * ```
 */
export declare class OllamaAdapterError extends AdapterError {
    /** Ollama-specific recovery information */
    readonly ollamaRecovery?: OllamaRecoveryInfo;
    private constructor();
    /**
     * Create error for connection refused
     */
    static connectionRefused(baseUrl: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for timeout
     */
    static timeout(timeoutMs: number, operation?: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for model not found
     */
    static modelNotFound(modelName: string, availableModels?: string[], cause?: Error): OllamaAdapterError;
    /**
     * Create error for internal server error
     */
    static internalError(message?: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for invalid request
     */
    static invalidRequest(message: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for model load failure
     */
    static modelLoadFailed(modelName: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for generation failure
     */
    static generationFailed(modelName: string, cause?: Error): OllamaAdapterError;
    /**
     * Create error for unknown issues
     */
    static unknown(operation: string, message: string, cause?: Error): OllamaAdapterError;
    /**
     * Create OllamaAdapterError from Axios error
     * Overrides base class method to provide Ollama-specific error handling
     */
    static fromAxiosError(adapterName: string, operation: string, axiosError: AxiosError<unknown>): OllamaAdapterError;
    /**
     * Check if error is connection refused
     */
    isConnectionRefused(): boolean;
    /**
     * Check if error is timeout
     */
    isTimeout(): boolean;
    /**
     * Check if error is model not found
     */
    isModelNotFound(): boolean;
    /**
     * Get recovery information
     */
    getRecoveryInfo(): OllamaRecoveryInfo | undefined;
}
export default OllamaAdapterError;
//# sourceMappingURL=OllamaAdapterError.d.ts.map