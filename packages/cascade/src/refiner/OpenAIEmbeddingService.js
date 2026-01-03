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
/**
 * OpenAIEmbeddingService - Production-ready embedding service.
 */
export class OpenAIEmbeddingService {
    config;
    initialized = false;
    // Default dimensions for each model
    static MODEL_DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "nomic-embed-text": 768,
        "mxbai-embed-large": 1024,
    };
    constructor(config = {}) {
        const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
        const baseURL = config.baseURL ||
            process.env.OPENAI_BASE_URL ||
            "https://api.openai.com/v1";
        // Detect Ollama mode
        const isOllama = baseURL.includes("localhost") ||
            baseURL.includes("127.0.0.1") ||
            baseURL.includes("ollama");
        // Default model based on mode
        const defaultModel = isOllama
            ? "nomic-embed-text"
            : "text-embedding-3-small";
        const model = config.model || defaultModel;
        this.config = {
            apiKey,
            baseURL,
            model,
            dimensions: config.dimensions || OpenAIEmbeddingService.MODEL_DIMENSIONS[model],
            timeout: config.timeout || 30000,
            maxRetries: config.maxRetries || 3,
            enableFallback: config.enableFallback ?? true,
        };
    }
    /**
     * Initialize the embedding service.
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        // Validate configuration
        if (!this.config.apiKey && !this.isOllama()) {
            console.warn("[OpenAIEmbeddingService] No API key provided. Hash-based fallback will be used.");
            console.warn("[OpenAIEmbeddingService] WARNING: Hash-based embeddings are NOT semantically meaningful.");
            console.warn("[OpenAIEmbeddingService] For production use, provide OPENAI_API_KEY or use Ollama for local embeddings.");
        }
        // Test connection if API key available
        if (this.config.apiKey || this.isOllama()) {
            try {
                await this.healthCheck();
            }
            catch (error) {
                const message = this.isOllama()
                    ? "[OpenAIEmbeddingService] Ollama health check failed"
                    : "[OpenAIEmbeddingService] OpenAI health check failed";
                console.warn(message, error);
                if (!this.config.enableFallback) {
                    throw error;
                }
            }
        }
        this.initialized = true;
    }
    /**
     * Generate embedding for a single text.
     *
     * @param text - Text to embed
     * @returns Embedding result
     */
    async embed(text) {
        if (!this.initialized) {
            await this.initialize();
        }
        // Input validation
        if (!text || typeof text !== "string") {
            throw new Error("Text must be a non-empty string");
        }
        const trimmed = text.trim();
        if (trimmed.length === 0) {
            throw new Error("Text must not be empty or whitespace only");
        }
        const startTime = Date.now();
        // Try real embedding service
        try {
            const result = await this.embedWithRetry(trimmed);
            const latency = Date.now() - startTime;
            return {
                embedding: result,
                model: this.config.model,
                latency,
                usedFallback: false,
            };
        }
        catch (error) {
            // Fall back to hash-based if enabled
            if (this.config.enableFallback) {
                console.warn("[OpenAIEmbeddingService] API call failed, using hash-based fallback:", error);
                console.warn("[OpenAIEmbeddingService] WARNING: Fallback embeddings are NOT semantically meaningful.");
                console.warn("[OpenAIEmbeddingService] Semantic features (similarity, search, clustering) will NOT work correctly.");
                const fallback = this.hashEmbed(trimmed);
                const latency = Date.now() - startTime;
                return {
                    embedding: fallback,
                    model: `${this.config.model}-fallback`,
                    latency,
                    usedFallback: true,
                };
            }
            throw error;
        }
    }
    /**
     * Generate embeddings for multiple texts (batch processing).
     *
     * @param texts - Array of texts to embed
     * @returns Array of embedding results
     */
    async embedBatch(texts) {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!Array.isArray(texts)) {
            throw new Error("Input must be an array of strings");
        }
        if (texts.length === 0) {
            return [];
        }
        // Process in batches (OpenAI limit is 2048 texts per request)
        const batchSize = this.isOllama() ? 100 : 2048;
        const results = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const startTime = Date.now();
            try {
                const embeddings = await this.embedBatchWithRetry(batch);
                const latency = Date.now() - startTime;
                results.push(...embeddings.map(embedding => ({
                    embedding,
                    model: this.config.model,
                    latency: Math.floor(latency / batch.length),
                    usedFallback: false,
                })));
            }
            catch (error) {
                if (this.config.enableFallback) {
                    console.warn("[OpenAIEmbeddingService] Batch API call failed, using fallback:", error);
                    console.warn("[OpenAIEmbeddingService] WARNING: Fallback embeddings are NOT semantically meaningful.");
                    console.warn("[OpenAIEmbeddingService] Semantic features (similarity, search, clustering) will NOT work correctly.");
                    const latency = Date.now() - startTime;
                    results.push(...batch.map(text => ({
                        embedding: this.hashEmbed(text),
                        model: `${this.config.model}-fallback`,
                        latency: Math.floor(latency / batch.length),
                        usedFallback: true,
                    })));
                }
                else {
                    throw error;
                }
            }
        }
        return results;
    }
    /**
     * Shutdown the service.
     */
    async shutdown() {
        this.initialized = false;
    }
    /**
     * Check if using Ollama backend.
     */
    isOllama() {
        return (this.config.baseURL.includes("localhost") ||
            this.config.baseURL.includes("127.0.0.1") ||
            this.config.baseURL.includes("ollama"));
    }
    /**
     * Health check for the API.
     */
    async healthCheck() {
        // Try a simple embedding to verify connection
        const testText = "test";
        await this.callAPI([testText]);
    }
    /**
     * Embed with retry logic.
     */
    async embedWithRetry(text) {
        let lastError;
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const result = await this.callAPI([text]);
                return result[0];
            }
            catch (error) {
                lastError = error;
                const embeddingError = this.classifyError(error);
                if (!embeddingError.retryable) {
                    throw embeddingError;
                }
                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await this.sleep(delay);
            }
        }
        throw lastError || new Error("Embedding failed after retries");
    }
    /**
     * Batch embed with retry logic.
     */
    async embedBatchWithRetry(texts) {
        let lastError;
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                return await this.callAPI(texts);
            }
            catch (error) {
                lastError = error;
                const embeddingError = this.classifyError(error);
                if (!embeddingError.retryable) {
                    throw embeddingError;
                }
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await this.sleep(delay);
            }
        }
        throw lastError || new Error("Batch embedding failed after retries");
    }
    /**
     * Call the embedding API.
     */
    async callAPI(texts) {
        const isOllama = this.isOllama();
        if (isOllama) {
            return await this.callOllamaAPI(texts);
        }
        else {
            return await this.callOpenAIAPI(texts);
        }
    }
    /**
     * Call OpenAI embeddings API.
     */
    async callOpenAIAPI(texts) {
        if (!this.config.apiKey) {
            throw new Error("OpenAI API key is required");
        }
        const response = await fetch(`${this.config.baseURL}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: texts,
                dimensions: this.config.dimensions,
            }),
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${error}`);
        }
        const data = (await response.json());
        // Extract embeddings from response
        // OpenAI returns { data: [{ embedding: [...] }] }
        const embeddings = data.data.map((item) => item.embedding);
        return embeddings.map(e => new Float32Array(e));
    }
    /**
     * Call Ollama embeddings API.
     */
    async callOllamaAPI(texts) {
        // Ollama doesn't support batch embeddings, process individually
        const embeddings = [];
        for (const text of texts) {
            const response = await fetch(`${this.config.baseURL}/api/embed`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: text,
                }),
                signal: AbortSignal.timeout(this.config.timeout),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${error}`);
            }
            const data = (await response.json());
            // Ollama returns { embedding: [...] }
            const embedding = data.embedding;
            embeddings.push(new Float32Array(embedding));
        }
        return embeddings;
    }
    /**
     * Classify error as retryable or not.
     */
    classifyError(error) {
        const err = error;
        const cause = err instanceof Error ? err : undefined;
        // Network errors are retryable
        if (err.message.includes("ECONNREFUSED") ||
            err.message.includes("ETIMEDOUT") ||
            err.message.includes("ENOTFOUND")) {
            return { ...err, retryable: true, cause };
        }
        // 429 rate limit is retryable
        if (err.message.includes("429") || err.message.includes("rate limit")) {
            return { ...err, retryable: true, cause };
        }
        // 500 server errors are retryable
        if (err.message.includes("500") ||
            err.message.includes("502") ||
            err.message.includes("503")) {
            return { ...err, retryable: true, cause };
        }
        // 400 errors are not retryable
        if (err.message.includes("400") ||
            err.message.includes("401") ||
            err.message.includes("403")) {
            return { ...err, retryable: false, cause };
        }
        // Default to not retryable
        return { ...err, retryable: false, cause };
    }
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
    hashEmbed(text) {
        const dimensions = this.config.dimensions;
        const embedding = new Float32Array(dimensions);
        // Generate deterministic hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Fill embedding with deterministic values
        for (let i = 0; i < dimensions; i++) {
            const value = ((hash * (i + 1)) % 10000) / 5000 - 1;
            embedding[i] = value;
        }
        return embedding;
    }
    /**
     * Sleep for specified milliseconds.
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=OpenAIEmbeddingService.js.map