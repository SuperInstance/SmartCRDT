/**
 * Configuration Module for @lsi/cascade
 *
 * Provides type-safe environment configuration with validation and defaults.
 * Loads from environment variables with sensible defaults for local development.
 *
 * @module config
 */
/**
 * Supported embedding models
 */
export type EmbeddingModel = "text-embedding-3-small" | "text-embedding-3-large" | "text-embedding-ada-002";
/**
 * Supported inference models
 */
export type InferenceModel = "gpt-4" | "gpt-4-turbo" | "gpt-4-turbo-preview" | "gpt-3.5-turbo" | "gpt-3.5-turbo-16k";
/**
 * Supported Ollama models
 */
export type OllamaModel = "llama2" | "llama2:13b" | "llama2:70b" | "mistral" | "mistral:7b" | "codellama" | "phi" | "neural-chat" | "starling-lm";
/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
/**
 * Rate limiter algorithms
 */
export type RateLimitAlgorithm = "token-bucket" | "sliding-window";
/**
 * Configuration interface
 */
export interface ConfigurationOptions {
    /** OpenAI API key (required for cloud features) */
    openaiApiKey?: string;
    /** OpenAI base URL (optional, for proxy/custom endpoint) */
    openaiBaseUrl?: string;
    /** Ollama base URL (default: http://localhost:11434) */
    ollamaBaseUrl?: string;
    /** Ollama model to use (default: llama2) */
    ollamaModel?: OllamaModel;
    /** Embedding model to use (default: text-embedding-3-small) */
    embeddingModel?: EmbeddingModel;
    /** Inference model to use (default: gpt-4) */
    inferenceModel?: InferenceModel;
    /** Log level (default: info) */
    logLevel?: LogLevel;
    /** Maximum cache size (default: 1000) */
    maxCacheSize?: number;
    /** Cache TTL in seconds (default: 3600) */
    cacheTtl?: number;
    /** Enable local-only mode (default: false) */
    localOnly?: boolean;
    /** Rate limit configuration - Ollama adapter */
    ollamaRateLimit?: RateLimitConfigOptions;
    /** Rate limit configuration - OpenAI adapter */
    openaiRateLimit?: RateLimitConfigOptions;
    /** Global rate limit enabled (default: true) */
    rateLimitEnabled?: boolean;
}
/**
 * Rate limit configuration options
 */
export interface RateLimitConfigOptions {
    /** Maximum requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Algorithm to use (default: token-bucket) */
    algorithm?: RateLimitAlgorithm;
    /** Refill rate for token bucket (tokens per second) */
    refillRate?: number;
    /** Burst capacity for token bucket */
    burstCapacity?: number;
}
/**
 * Validated configuration with all defaults applied
 */
export interface Configuration extends Required<Pick<ConfigurationOptions, "ollamaBaseUrl" | "ollamaModel" | "embeddingModel" | "inferenceModel" | "logLevel" | "maxCacheSize" | "cacheTtl" | "localOnly" | "rateLimitEnabled">> {
    openaiApiKey?: string;
    openaiBaseUrl: string;
    ollamaRateLimit?: RateLimitConfigOptions;
    openaiRateLimit?: RateLimitConfigOptions;
}
/**
 * Configuration error class
 */
export declare class ConfigurationError extends Error {
    field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
/**
 * Validate configuration options
 *
 * @throws {ConfigurationError} If configuration is invalid
 */
export declare function validateConfig(options: ConfigurationOptions): void;
/**
 * Load configuration from environment variables
 *
 * Reads the following environment variables:
 * - `OPENAI_API_KEY`: OpenAI API key (optional if localOnly is true)
 * - `OPENAI_BASE_URL`: OpenAI base URL (optional, defaults to OpenAI's API)
 * - `OLLAMA_BASE_URL`: Ollama base URL (default: http://localhost:11434)
 * - `OLLAMA_MODEL`: Ollama model to use (default: llama2)
 * - `EMBEDDING_MODEL`: Embedding model (default: text-embedding-3-small)
 * - `INFERENCE_MODEL`: Inference model (default: gpt-4)
 * - `LOG_LEVEL`: Log level (default: info)
 * - `MAX_CACHE_SIZE`: Maximum cache size (default: 1000)
 * - `CACHE_TTL`: Cache TTL in seconds (default: 3600)
 * - `LOCAL_ONLY`: Enable local-only mode (default: false)
 *
 * @returns Configuration options from environment
 */
export declare function loadFromEnv(): ConfigurationOptions;
/**
 * Create a validated configuration object
 *
 * @param options - Configuration options (optional, loaded from env if not provided)
 * @returns Validated configuration with defaults applied
 * @throws {ConfigurationError} If configuration is invalid
 */
export declare function createConfiguration(options?: ConfigurationOptions): Configuration;
/**
 * Get the global configuration instance
 *
 * @returns Current configuration
 * @throws {ConfigurationError} If configuration has not been initialized
 */
export declare function getConfiguration(): Configuration;
/**
 * Initialize the global configuration
 *
 * @param options - Configuration options (optional, loaded from env if not provided)
 * @returns Validated configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
export declare function initializeConfiguration(options?: ConfigurationOptions): Configuration;
/**
 * Reset the global configuration
 *
 * Primarily useful for testing
 */
export declare function resetConfiguration(): void;
/**
 * Check if cloud features are available
 *
 * @returns true if OpenAI API key is configured and not in local-only mode
 */
export declare function isCloudAvailable(): boolean;
/**
 * Get a summary of the current configuration
 *
 * Useful for logging (excludes sensitive values)
 */
export declare function getConfigurationSummary(): Record<string, unknown>;
/**
 * Re-export configuration instance as default
 */
export default getConfiguration;
//# sourceMappingURL=Configuration.d.ts.map