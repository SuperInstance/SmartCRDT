/**
 * OpenAIAdapter - Real implementation for cloud LLM inference via OpenAI API
 *
 * This adapter makes actual HTTP calls to the OpenAI API to perform cloud inference.
 * It supports retry logic with jitter, streaming responses, health checks, and
 * environment variable configuration.
 */
import type { RoutingDecision, ProcessResult, HealthCheckResult, OpenAIAdapterConfig } from "@lsi/protocol";
/**
 * Custom error for OpenAIAdapter failures
 */
export declare class OpenAIAdapterError extends Error {
    code: string;
    originalError?: unknown | undefined;
    constructor(message: string, code: string, originalError?: unknown | undefined);
}
/**
 * OpenAIAdapter - Executes inference requests via OpenAI API
 *
 * @example
 * ```typescript
 * const adapter = new OpenAIAdapter('sk-...', 'gpt-4');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export declare class OpenAIAdapter {
    private axiosInstance;
    private config;
    /**
     * Create a new OpenAIAdapter
     *
     * @param apiKey - OpenAI API key (default: from OPENAI_API_KEY env)
     * @param defaultModel - Default model to use (default: from OPENAI_MODEL env or 'gpt-3.5-turbo')
     * @param config - Optional configuration overrides
     * @throws Error if API key is not provided
     */
    constructor(apiKey?: string, defaultModel?: string, config?: Partial<OpenAIAdapterConfig>);
    /**
     * Build headers for API requests
     *
     * @returns Headers object
     */
    private buildHeaders;
    /**
     * Execute a routing decision with the given input
     *
     * @param decision - Routing decision containing backend, model, confidence
     * @param input - Input prompt to process
     * @returns Process result with content, metadata, latency
     * @throws OpenAIAdapterError on failure after retries
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
     * Process a prompt with streaming response
     *
     * @param prompt - Input prompt to process
     * @param model - Model to use (optional, falls back to default)
     * @param onChunk - Callback for each chunk received
     * @returns Process result with accumulated content
     */
    processStream(prompt: string, model?: string, onChunk?: (chunk: string, done: boolean) => void): Promise<ProcessResult>;
    /**
     * Check health of OpenAI service and list available models
     *
     * Note: This does NOT retry aggressively like execute() does.
     * Health checks should fail fast to indicate service issues.
     *
     * @returns Health check result with available models
     */
    checkHealth(): Promise<HealthCheckResult>;
    /**
     * Execute a function with retry logic using exponential backoff with jitter
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
     * Convert unknown error to OpenAIAdapterError
     *
     * @param error - Error to convert
     * @param context - Context where error occurred
     * @returns OpenAIAdapterError
     */
    private handleError;
    /**
     * Get current configuration
     *
     * Note: API key is redacted for security
     *
     * @returns Current adapter configuration
     */
    getConfig(): Omit<OpenAIAdapterConfig, "apiKey"> & {
        apiKey: string;
    };
    getConfig(): OpenAIAdapterConfig;
    /**
     * Get actual API key (use with caution)
     *
     * @returns API key
     */
    getApiKey(): string;
    /**
     * Update configuration
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<OpenAIAdapterConfig>): void;
}
/**
 * Factory function to create an OpenAIAdapter
 *
 * @param apiKey - OpenAI API key (optional, from env by default)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @returns Configured OpenAIAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createOpenAIAdapter();
 *
 * // Specify custom values
 * const adapter = createOpenAIAdapter('sk-...', 'gpt-4', {
 *   timeout: 120000,
 *   maxRetries: 5,
 * });
 * ```
 */
export declare function createOpenAIAdapter(apiKey?: string, defaultModel?: string, config?: Partial<OpenAIAdapterConfig>): OpenAIAdapter;
/**
 * Export default class as default
 */
export default OpenAIAdapter;
//# sourceMappingURL=OpenAIAdapter.d.ts.map