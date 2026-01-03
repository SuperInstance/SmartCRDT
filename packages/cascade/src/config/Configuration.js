/**
 * Configuration Module for @lsi/cascade
 *
 * Provides type-safe environment configuration with validation and defaults.
 * Loads from environment variables with sensible defaults for local development.
 *
 * @module config
 */
/**
 * Configuration error class
 */
export class ConfigurationError extends Error {
    field;
    constructor(message, field) {
        super(message);
        this.field = field;
        this.name = "ConfigurationError";
    }
}
/**
 * Default configuration values
 */
const DEFAULTS = {
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama2",
    embeddingModel: "text-embedding-3-small",
    inferenceModel: "gpt-4",
    logLevel: "info",
    maxCacheSize: 1000,
    cacheTtl: 3600,
    localOnly: false,
    rateLimitEnabled: true,
};
/**
 * Default rate limit configuration for Ollama
 *
 * Ollama is local, so we can be more permissive.
 */
const DEFAULT_OLLAMA_RATE_LIMIT = {
    maxRequests: 60,
    windowMs: 60000,
    algorithm: "token-bucket",
    refillRate: 1,
    burstCapacity: 10,
};
/**
 * Default rate limit configuration for OpenAI
 *
 * OpenAI has stricter limits, so we're more conservative.
 */
const DEFAULT_OPENAI_RATE_LIMIT = {
    maxRequests: 100,
    windowMs: 60000,
    algorithm: "sliding-window",
};
/**
 * Valid embedding models
 */
const VALID_EMBEDDING_MODELS = [
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
];
/**
 * Valid inference models
 */
const VALID_INFERENCE_MODELS = [
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
];
/**
 * Valid Ollama models
 */
const VALID_OLLAMA_MODELS = [
    "llama2",
    "llama2:13b",
    "llama2:70b",
    "mistral",
    "mistral:7b",
    "codellama",
    "phi",
    "neural-chat",
    "starling-lm",
];
/**
 * Valid log levels
 */
const VALID_LOG_LEVELS = [
    "debug",
    "info",
    "warn",
    "error",
    "silent",
];
/**
 * Validate URL format
 */
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    catch {
        return false;
    }
}
/**
 * Validate OpenAI API key format
 */
function isValidOpenAIApiKey(key) {
    // OpenAI API keys start with 'sk-' and are typically 51 characters
    return /^sk-[a-zA-Z0-9]{32,}$/.test(key);
}
/**
 * Validate configuration options
 *
 * @throws {ConfigurationError} If configuration is invalid
 */
export function validateConfig(options) {
    // Validate OpenAI API key if provided
    if (options.openaiApiKey && !isValidOpenAIApiKey(options.openaiApiKey)) {
        throw new ConfigurationError('OpenAI API key must start with "sk-" followed by at least 32 alphanumeric characters', "openaiApiKey");
    }
    // Validate OpenAI base URL if provided
    if (options.openaiBaseUrl && !isValidUrl(options.openaiBaseUrl)) {
        throw new ConfigurationError(`Invalid OpenAI base URL: ${options.openaiBaseUrl}. Must be a valid HTTP/HTTPS URL.`, "openaiBaseUrl");
    }
    // Validate Ollama base URL
    const ollamaBaseUrl = options.ollamaBaseUrl ?? DEFAULTS.ollamaBaseUrl;
    if (!isValidUrl(ollamaBaseUrl)) {
        throw new ConfigurationError(`Invalid Ollama base URL: ${ollamaBaseUrl}. Must be a valid HTTP/HTTPS URL.`, "ollamaBaseUrl");
    }
    // Validate embedding model
    const embeddingModel = options.embeddingModel ?? DEFAULTS.embeddingModel;
    if (!VALID_EMBEDDING_MODELS.includes(embeddingModel)) {
        throw new ConfigurationError(`Invalid embedding model: ${embeddingModel}. Must be one of: ${VALID_EMBEDDING_MODELS.join(", ")}`, "embeddingModel");
    }
    // Validate inference model
    const inferenceModel = options.inferenceModel ?? DEFAULTS.inferenceModel;
    if (!VALID_INFERENCE_MODELS.includes(inferenceModel)) {
        throw new ConfigurationError(`Invalid inference model: ${inferenceModel}. Must be one of: ${VALID_INFERENCE_MODELS.join(", ")}`, "inferenceModel");
    }
    // Validate Ollama model
    const ollamaModel = options.ollamaModel ?? DEFAULTS.ollamaModel;
    if (!VALID_OLLAMA_MODELS.includes(ollamaModel)) {
        throw new ConfigurationError(`Invalid Ollama model: ${ollamaModel}. Must be one of: ${VALID_OLLAMA_MODELS.join(", ")}`, "ollamaModel");
    }
    // Validate log level
    const logLevel = options.logLevel ?? DEFAULTS.logLevel;
    if (!VALID_LOG_LEVELS.includes(logLevel)) {
        throw new ConfigurationError(`Invalid log level: ${logLevel}. Must be one of: ${VALID_LOG_LEVELS.join(", ")}`, "logLevel");
    }
    // Validate cache size
    const maxCacheSize = options.maxCacheSize ?? DEFAULTS.maxCacheSize;
    if (maxCacheSize < 0 || !Number.isInteger(maxCacheSize)) {
        throw new ConfigurationError(`Invalid max cache size: ${maxCacheSize}. Must be a non-negative integer.`, "maxCacheSize");
    }
    // Validate cache TTL
    const cacheTtl = options.cacheTtl ?? DEFAULTS.cacheTtl;
    if (cacheTtl < 0 || !Number.isInteger(cacheTtl)) {
        throw new ConfigurationError(`Invalid cache TTL: ${cacheTtl}. Must be a non-negative integer (seconds).`, "cacheTtl");
    }
}
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
export function loadFromEnv() {
    return {
        openaiApiKey: process.env.OPENAI_API_KEY,
        openaiBaseUrl: process.env.OPENAI_BASE_URL,
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
        ollamaModel: process.env.OLLAMA_MODEL,
        embeddingModel: process.env.EMBEDDING_MODEL,
        inferenceModel: process.env.INFERENCE_MODEL,
        logLevel: process.env.LOG_LEVEL,
        maxCacheSize: process.env.MAX_CACHE_SIZE
            ? parseInt(process.env.MAX_CACHE_SIZE, 10)
            : undefined,
        cacheTtl: process.env.CACHE_TTL
            ? parseInt(process.env.CACHE_TTL, 10)
            : undefined,
        localOnly: process.env.LOCAL_ONLY === "true" || process.env.LOCAL_ONLY === "1",
    };
}
/**
 * Create a validated configuration object
 *
 * @param options - Configuration options (optional, loaded from env if not provided)
 * @returns Validated configuration with defaults applied
 * @throws {ConfigurationError} If configuration is invalid
 */
export function createConfiguration(options) {
    const envOptions = options ?? loadFromEnv();
    // Validate before applying defaults
    validateConfig(envOptions);
    return {
        openaiApiKey: envOptions.openaiApiKey,
        openaiBaseUrl: envOptions.openaiBaseUrl ?? "https://api.openai.com/v1",
        ollamaBaseUrl: envOptions.ollamaBaseUrl ?? DEFAULTS.ollamaBaseUrl,
        ollamaModel: envOptions.ollamaModel ?? DEFAULTS.ollamaModel,
        embeddingModel: envOptions.embeddingModel ?? DEFAULTS.embeddingModel,
        inferenceModel: envOptions.inferenceModel ?? DEFAULTS.inferenceModel,
        logLevel: envOptions.logLevel ?? DEFAULTS.logLevel,
        maxCacheSize: envOptions.maxCacheSize ?? DEFAULTS.maxCacheSize,
        cacheTtl: envOptions.cacheTtl ?? DEFAULTS.cacheTtl,
        localOnly: envOptions.localOnly ?? DEFAULTS.localOnly,
        rateLimitEnabled: envOptions.rateLimitEnabled ?? DEFAULTS.rateLimitEnabled,
        ollamaRateLimit: envOptions.ollamaRateLimit,
        openaiRateLimit: envOptions.openaiRateLimit,
    };
}
/**
 * Global configuration instance
 *
 * Initialized on first access from environment variables.
 * Can be overridden by calling `initializeConfiguration()`.
 */
let globalConfig = null;
/**
 * Get the global configuration instance
 *
 * @returns Current configuration
 * @throws {ConfigurationError} If configuration has not been initialized
 */
export function getConfiguration() {
    if (!globalConfig) {
        globalConfig = createConfiguration();
    }
    return globalConfig;
}
/**
 * Initialize the global configuration
 *
 * @param options - Configuration options (optional, loaded from env if not provided)
 * @returns Validated configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
export function initializeConfiguration(options) {
    globalConfig = createConfiguration(options);
    return globalConfig;
}
/**
 * Reset the global configuration
 *
 * Primarily useful for testing
 */
export function resetConfiguration() {
    globalConfig = null;
}
/**
 * Check if cloud features are available
 *
 * @returns true if OpenAI API key is configured and not in local-only mode
 */
export function isCloudAvailable() {
    const config = getConfiguration();
    return !config.localOnly && !!config.openaiApiKey;
}
/**
 * Get a summary of the current configuration
 *
 * Useful for logging (excludes sensitive values)
 */
export function getConfigurationSummary() {
    const config = getConfiguration();
    return {
        openaiConfigured: !!config.openaiApiKey,
        openaiBaseUrl: config.openaiBaseUrl,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
        embeddingModel: config.embeddingModel,
        inferenceModel: config.inferenceModel,
        logLevel: config.logLevel,
        maxCacheSize: config.maxCacheSize,
        cacheTtl: config.cacheTtl,
        localOnly: config.localOnly,
        rateLimitEnabled: config.rateLimitEnabled,
        ollamaRateLimit: config.ollamaRateLimit,
        openaiRateLimit: config.openaiRateLimit,
        cloudAvailable: isCloudAvailable(),
    };
}
/**
 * Re-export configuration instance as default
 */
export default getConfiguration;
//# sourceMappingURL=Configuration.js.map