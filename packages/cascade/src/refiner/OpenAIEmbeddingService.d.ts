/**
 * OpenAIEmbeddingService - Real embeddings from OpenAI or Ollama.
 *
 * Production-ready embedding service supporting:
 * - OpenAI API (text-embedding-3-small, text-embedding-3-large)
 * - Ollama local models (nomic-embed-text, mxbai-embed-large)
 * - Automatic fallback to local when API unavailable
 * - Batch processing for efficiency
 * - Error handling and retries
 *
 * @packageDocumentation
 */
export interface EmbeddingServiceConfig {
    /** OpenAI API key (from env or constructor) */
    apiKey?: string;
    /** Base URL for API (allows Ollama compatibility) */
    baseURL?: string;
    /** Model to use for embeddings */
    model?: "text-embedding-3-small" | "text-embedding-3-large" | "nomic-embed-text" | "mxbai-embed-large";
    /** Embedding dimensions (768 or 1536) */
    dimensions?: number;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Max retries for failed requests */
    maxRetries?: number;
    /** Enable fallback to hash-based embeddings */
    enableFallback?: boolean;
}
export interface EmbeddingResult {
    /** Embedding vector */
    embedding: Float32Array;
    /** Model used for generation */
    model: string;
    /** Time taken in milliseconds */
    latency: number;
    /** Whether fallback was used */
    usedFallback: boolean;
}
export interface EmbeddingError extends Error {
    /** Whether error is retryable */
    retryable: boolean;
    /** Original error */
    cause?: Error;
}
/**
 * OpenAIEmbeddingService - Production-ready embedding service.
 */
export declare class OpenAIEmbeddingService {
    private config;
    private initialized;
    private static readonly MODEL_DIMENSIONS;
    constructor(config?: EmbeddingServiceConfig);
    /**
     * Initialize the embedding service.
     */
    initialize(): Promise<void>;
    /**
     * Generate embedding for a single text.
     *
     * @param text - Text to embed
     * @returns Embedding result
     */
    embed(text: string): Promise<EmbeddingResult>;
    /**
     * Generate embeddings for multiple texts (batch processing).
     *
     * @param texts - Array of texts to embed
     * @returns Array of embedding results
     */
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
    /**
     * Shutdown the service.
     */
    shutdown(): Promise<void>;
    /**
     * Check if using Ollama backend.
     */
    private isOllama;
    /**
     * Health check for the API.
     */
    private healthCheck;
    /**
     * Embed with retry logic.
     */
    private embedWithRetry;
    /**
     * Batch embed with retry logic.
     */
    private embedBatchWithRetry;
    /**
     * Call the embedding API.
     */
    private callAPI;
    /**
     * Call OpenAI embeddings API.
     */
    private callOpenAIAPI;
    /**
     * Call Ollama embeddings API.
     */
    private callOllamaAPI;
    /**
     * Classify error as retryable or not.
     */
    private classifyError;
    /**
     * Hash-based embedding fallback.
     *
     * WARNING: This is a LAST RESORT fallback that generates pseudo-embeddings.
     * These embeddings are NOT semantically meaningful and should ONLY be used when:
     * 1. No API key is available
     * 2. API calls fail AND enableFallback is true
     *
     * Limitations:
     * - No semantic similarity (similar texts may have very different embeddings)
     * - Cannot be used for semantic search, clustering, or similarity matching
     * - Deterministic but arbitrary (same text always produces same embedding)
     * - Should NEVER be used in production for real semantic operations
     *
     * This fallback exists solely to prevent crashes during development/testing
     * when an API key is not configured. It allows the system to continue
     * functioning, but semantic features will NOT work correctly.
     *
     * @param text - Text to generate pseudo-embedding for
     * @returns Float32Array of deterministic but non-semantic values
     */
    private hashEmbed;
    /**
     * Sleep for specified milliseconds.
     */
    private sleep;
}
//# sourceMappingURL=OpenAIEmbeddingService.d.ts.map