/**
 * OllamaAdapter - Real implementation for local LLM inference via Ollama
 *
 * This adapter makes actual HTTP calls to the Ollama API to perform local inference.
 * It supports retry logic, health checks, and environment variable configuration.
 */
import type { RoutingDecision, ProcessResult, HealthCheckResult, OllamaAdapterConfig } from "@lsi/protocol";
import type { RateLimiter } from "../ratelimit/RateLimiter.js";
/**
 * Custom error for OllamaAdapter failures
 */
export declare class OllamaAdapterError extends Error {
    code: string;
    originalError?: unknown | undefined;
    constructor(message: string, code: string, originalError?: unknown | undefined);
}
/**
 * OllamaAdapter - Executes inference requests via Ollama API
 *
 * @example
 * ```typescript
 * const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5:3b');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export declare class OllamaAdapter {
    private axiosInstance;
    private config;
    private rateLimiter;
    /**
     * Create a new OllamaAdapter
     *
     * @param baseURL - Base URL for Ollama API (default: from OLLAMA_BASE_URL env or 'http://localhost:11434')
     * @param defaultModel - Default model to use (default: from OLLAMA_MODEL env or 'llama2')
     * @param config - Optional configuration overrides
     * @param rateLimiter - Optional rate limiter (defaults to token bucket with 60 req/min)
     */
    constructor(baseURL?: string, defaultModel?: string, config?: Partial<OllamaAdapterConfig>, rateLimiter?: RateLimiter);
    /**
     * Execute a routing decision with the given input
     *
     * @param decision - Routing decision containing backend, model, confidence
     * @param input - Input prompt to process
     * @returns Process result with content, metadata, latency
     * @throws OllamaAdapterError on failure after retries
     * @throws RateLimitError if rate limit is exceeded
     */
    execute(decision: RoutingDecision, input: string): Promise<ProcessResult>;
    /**
     * Process a prompt with the given model
     *
     * Alias for execute() for compatibility
     *
     * @param prompt - Input prompt to process
     * @param model - Model to use (optional, falls back to default)
     * @returns Process result
     */
    process(prompt: string, model?: string): Promise<ProcessResult>;
    /**
     * Check health of Ollama service and list available models
     *
     * Note: This does NOT retry aggressively like execute() does.
     * Health checks should fail fast to indicate service issues.
     *
     * @returns Health check result with available models
     */
    checkHealth(): Promise<HealthCheckResult>;
    /**
     * Execute a function with retry logic using exponential backoff
     *
     * @param fn - Function to execute
     * @returns Result of function
     * @throws Last error if all retries fail
     */
    private withRetry;
    /**
     * Check if an error is non-retryable
     *
     * @param error - Error to check
     * @returns True if error should not be retried
     */
    private isNonRetryableError;
    /**
     * Sleep for specified milliseconds
     *
     * @param ms - Milliseconds to sleep
     * @returns Promise that resolves after delay
     */
    private sleep;
    /**
     * Convert unknown error to OllamaAdapterError
     *
     * @param error - Error to convert
     * @param context - Context where error occurred
     * @returns OllamaAdapterError
     */
    private handleError;
    /**
     * Get current configuration
     *
     * @returns Current adapter configuration
     */
    getConfig(): Omit<OllamaAdapterConfig, "timeout" | "maxRetries" | "stream"> & {
        timeout?: number;
        maxRetries?: number;
        stream?: boolean;
    };
    /**
     * Update configuration
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<OllamaAdapterConfig>): void;
    /**
     * Set or replace the rate limiter
     *
     * @param rateLimiter - Rate limiter to use, or null to disable rate limiting
     */
    setRateLimiter(rateLimiter: RateLimiter | null): void;
    /**
     * Get the current rate limiter
     *
     * @returns Current rate limiter, or null if not set
     */
    getRateLimiter(): RateLimiter | null;
    /**
     * Get rate limit statistics
     *
     * @returns Rate limit statistics, or null if no rate limiter is set
     */
    getRateLimitStats(): import("../ratelimit/RateLimiter.js").RateLimitStats | null;
}
/**
 * Factory function to create an OllamaAdapter
 *
 * @param baseURL - Base URL for Ollama API (optional)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @param rateLimiter - Optional rate limiter
 * @returns Configured OllamaAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createOllamaAdapter();
 *
 * // Specify custom values
 * const adapter = createOllamaAdapter('http://localhost:11434', 'qwen2.5:3b', {
 *   timeout: 60000,
 *   maxRetries: 5,
 * });
 *
 * // With rate limiting
 * const limiter = createTokenBucketLimiter({
 *   maxRequests: 60,
 *   windowMs: 60000,
 *   refillRate: 1,
 *   burstCapacity: 10,
 * });
 * const adapter = createOllamaAdapter(undefined, undefined, undefined, limiter);
 * ```
 */
export declare function createOllamaAdapter(baseURL?: string, defaultModel?: string, config?: Partial<OllamaAdapterConfig>, rateLimiter?: RateLimiter): OllamaAdapter;
/**
 * Export default class as default
 */
export default OllamaAdapter;
//# sourceMappingURL=OllamaAdapter.d.ts.map