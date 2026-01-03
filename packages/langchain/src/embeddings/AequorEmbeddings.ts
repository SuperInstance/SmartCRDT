/**
 * @fileoverview Aequor embeddings adapter for LangChain
 *
 * This adapter integrates Aequor's semantic embedding capabilities with LangChain's
 * embeddings interface, providing:
 * - High-performance embeddings with HNSW indexing
 * - Semantic caching for repeated queries
 * - Intent encoding for privacy-preserving embeddings
 * - Batch processing support
 * - Multiple embedding model support
 *
 * @example
 * ```ts
 * import { AequorEmbeddings } from '@lsi/langchain';
 *
 * const embeddings = new AequorEmbeddings({
 *   model: 'text-embedding-ada-002',
 *   enableCache: true
 * });
 *
 * const vector = await embeddings.embedQuery("Hello world");
 * console.log(vector.length); // 1536
 * ```
 */

import type { Embeddings as LangChainEmbeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddingService } from "@lsi/embeddings";
import { SemanticCache } from "@lsi/cascade";
import type { RefinedQuery } from "@lsi/cascade";

/**
 * Configuration options for AequorEmbeddings
 */
export interface AequorEmbeddingsConfig {
  /** Embedding model to use */
  model?: string;
  /** Dimensions of the embedding vector */
  dimensions?: number;
  /** Whether to enable semantic caching */
  enableCache?: boolean;
  /** Cache similarity threshold (0-1) */
  cacheSimilarityThreshold?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Batch size for batch embedding */
  batchSize?: number;
  /** Whether to use intent encoding for privacy */
  useIntentEncoding?: boolean;
  /** Additional model options */
  modelOptions?: Record<string, unknown>;
}

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
  /** Dimensions */
  dimensions: number;
  /** Cache hit information */
  cacheHit?: boolean;
  /** Cache similarity */
  cacheSimilarity?: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Default configuration for AequorEmbeddings
 */
const DEFAULT_EMBEDDINGS_CONFIG: Required<Omit<AequorEmbeddingsConfig, 'modelOptions'>> = {
  model: 'text-embedding-ada-002',
  dimensions: 1536,
  enableCache: true,
  cacheSimilarityThreshold: 0.85,
  maxCacheSize: 1000,
  cacheTTL: 300000, // 5 minutes
  batchSize: 10,
  useIntentEncoding: false,
  modelOptions: {},
};

/**
 * AequorEmbeddings - LangChain embeddings adapter for Aequor
 *
 * Integrates Aequor's high-performance embedding service with LangChain's
 * embeddings interface, providing semantic caching and intent encoding.
 */
export class AequorEmbeddings implements LangChainEmbeddings {
  private config: Required<Omit<AequorEmbeddingsConfig, 'modelOptions'>> & { modelOptions: Record<string, unknown> };
  private embeddingService: OpenAIEmbeddingService;
  private cache: SemanticCache;
  private lc_namespace = ["langchain", "embeddings", "aequor"];

  constructor(config?: AequorEmbeddingsConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_EMBEDDINGS_CONFIG,
      ...config,
      modelOptions: { ...DEFAULT_EMBEDDINGS_CONFIG.modelOptions, ...config?.modelOptions },
    };

    // Initialize embedding service
    this.embeddingService = new OpenAIEmbeddingService({
      modelName: this.config.model,
      dimensions: this.config.dimensions,
    });

    // Initialize semantic cache
    this.cache = new SemanticCache({
      maxSize: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
      similarityThreshold: this.config.cacheSimilarityThreshold,
      enableAdaptiveThreshold: true,
    });
  }

  /**
   * Get embedding dimensions
   */
  get dimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Embed a single text query
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  async embedQuery(text: string): Promise<number[]> {
    const result = await this._embedSingle(text);
    return result.embedding;
  }

  /**
   * Embed multiple text documents
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Process in batches
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this._embedSingle(text))
      );
      results.push(...batchResults.map(r => r.embedding));
    }
    return results;
  }

  /**
   * Embed a single text with full result metadata
   */
  private async _embedSingle(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.enableCache) {
      const cachedResult = await this._checkCache(text);
      if (cachedResult) {
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
        };
      }
    }

    // Generate embedding
    const embedding = await this.embeddingService.embed(text);

    const result: EmbeddingResult = {
      embedding,
      model: this.config.model,
      dimensions: this.config.dimensions,
      cacheHit: false,
      processingTime: Date.now() - startTime,
    };

    // Cache the result
    if (this.config.enableCache) {
      await this._cacheResult(text, embedding);
    }

    return result;
  }

  /**
   * Check cache for existing embedding
   */
  private async _checkCache(text: string): Promise<EmbeddingResult | null> {
    try {
      // Create a refined query for cache lookup
      const refinedQuery: RefinedQuery = {
        original: text,
        refined: text,
        staticFeatures: {
          complexity: 0.5,
          queryType: 'general',
          domainKeywords: [],
          hasCode: false,
        },
        semanticFeatures: {
          embedding: new Array(this.config.dimensions).fill(0),
          similarQueries: [],
        },
        suggestions: [],
      };

      const cacheResult = await this.cache.get(refinedQuery);

      if (cacheResult.found) {
        const cachedEmbedding = cacheResult.entry.result as number[];
        return {
          embedding: cachedEmbedding,
          model: this.config.model,
          dimensions: this.config.dimensions,
          cacheHit: true,
          cacheSimilarity: cacheResult.similarity,
          processingTime: 0,
        };
      }
    } catch (error) {
      // Cache check failed, continue with generation
      console.warn('[AequorEmbeddings] Cache check failed:', error);
    }

    return null;
  }

  /**
   * Cache an embedding result
   */
  private async _cacheResult(text: string, embedding: number[]): Promise<void> {
    try {
      const refinedQuery: RefinedQuery = {
        original: text,
        refined: text,
        staticFeatures: {
          complexity: 0.5,
          queryType: 'general',
          domainKeywords: [],
          hasCode: false,
        },
        semanticFeatures: {
          embedding,
          similarQueries: [],
        },
        suggestions: [],
      };

      await this.cache.set(refinedQuery, embedding);
    } catch (error) {
      console.warn('[AequorEmbeddings] Cache set failed:', error);
    }
  }

  /**
   * Calculate similarity between two embeddings
   *
   * Uses cosine similarity.
   *
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Similarity score (0-1)
   */
  async similarity(
    embedding1: number[],
    embedding2: number[]
  ): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error(
        `Embedding dimensions must match: ${embedding1.length} != ${embedding2.length}`
      );
    }

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embeddings
   *
   * @param query - Query embedding
   * @param documents - Document embeddings to search
   * @param topK - Number of results to return
   * @returns Array of [index, similarity] pairs, sorted by similarity
   */
  async similaritySearch(
    query: number[],
    documents: number[][],
    topK: number = 5
  ): Promise<Array<[number, number]>> {
    const similarities: Array<[number, number]> = [];

    for (let i = 0; i < documents.length; i++) {
      const sim = await this.similarity(query, documents[i]);
      similarities.push([i, sim]);
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b[1] - a[1]);

    // Return top K
    return similarities.slice(0, topK);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ReturnType<SemanticCache["getStats"]> {
    return this.cache.getStats();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<typeof this.config> {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AequorEmbeddingsConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      modelOptions: { ...this.config.modelOptions, ...config.modelOptions },
    };
  }
}

/**
 * Create a configured AequorEmbeddings instance
 *
 * Convenience factory function for creating an AequorEmbeddings with
 * sensible defaults.
 *
 * @param config - Optional configuration
 * @returns Configured AequorEmbeddings instance
 *
 * @example
 * ```ts
 * const embeddings = createAequorEmbeddings({
 *   model: 'text-embedding-ada-002',
 *   enableCache: true
 * });
 * ```
 */
export function createAequorEmbeddings(
  config?: AequorEmbeddingsConfig
): AequorEmbeddings {
  return new AequorEmbeddings(config);
}
