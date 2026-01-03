/**
 * QueryRefiner - Static and semantic query analysis
 *
 * The Refiner Pattern combines:
 * 1. Static Analysis: Fast, deterministic feature extraction (no LLM needed)
 * 2. Semantic Analysis: Embedding-based similarity and clustering
 *
 * This enables:
 * - 80% cache hit rate (through semantic similarity matching)
 * - Zero-cost query optimization (static analysis is free)
 * - Intelligent routing decisions (complexity + semantic context)
 *
 * Example:
 * ```ts
 * const refiner = new QueryRefiner();
 * const refined = await refiner.refine("How do I optimize TypeScript?");
 * // Returns: complexity, type, semanticVector, cacheKey, suggestions
 * ```
 */
import type { RefinedQuery } from "../types.js";
/**
 * QueryRefiner configuration
 */
export interface QueryRefinerConfig {
    /** Enable semantic analysis */
    enableSemantic?: boolean;
    /** Cache history size */
    cacheHistorySize?: number;
    /** Embedding dimensions */
    embeddingDim?: number;
    /** OpenAI API key */
    apiKey?: string;
    /** Base URL for embedding API */
    baseURL?: string;
    /** Embedding model */
    model?: "text-embedding-3-small" | "text-embedding-3-large" | "nomic-embed-text" | "mxbai-embed-large";
    /** Enable fallback to hash-based embeddings */
    enableFallback?: boolean;
}
/**
 * QueryRefiner - Two-stage analysis (static + semantic)
 */
export declare class QueryRefiner {
    private config?;
    private semanticCache;
    private queryHistory;
    private embeddingService;
    private embeddingCache;
    constructor(config?: QueryRefinerConfig | undefined);
    /**
     * Refine a query with static + semantic analysis
     * @param query - The user's query
     * @returns RefinedQuery with features and suggestions
     */
    refine(query: string): Promise<RefinedQuery>;
    /**
     * Static Analysis - No LLM needed, pure computation
     */
    private analyzeStatic;
    /**
     * Semantic Analysis - Embedding-based using real embeddings
     */
    private analyzeSemantic;
    /**
     * Detect query type from patterns
     */
    private detectQueryType;
    /**
     * Calculate complexity score (0-1)
     */
    private calculateComplexity;
    /**
     * Check if query contains code snippet
     */
    private hasCodeSnippet;
    /**
     * Check if query contains SQL
     */
    private hasSQL;
    /**
     * Check if query contains URL
     */
    private hasUrl;
    /**
     * Check if query contains email
     */
    private hasEmail;
    /**
     * Calculate capitalization ratio
     */
    private calculateCapitalizationRatio;
    /**
     * Calculate punctuation density
     */
    private calculatePunctuationDensity;
    /**
     * Extract technical terms
     */
    private extractTechnicalTerms;
    /**
     * Extract domain keywords
     */
    private extractDomainKeywords;
    /**
     * Find semantically similar queries (cosine similarity)
     */
    private findSimilarQueries;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Detect query cluster (topic grouping)
     */
    private detectCluster;
    /**
     * Calculate semantic complexity (entropy of embedding)
     */
    private calculateSemanticComplexity;
    /**
     * Generate cache key from features
     */
    private generateCacheKey;
    /**
     * Normalize query for caching
     */
    private normalizeQuery;
    /**
     * Generate refinement suggestions
     */
    private generateSuggestions;
    /**
     * Track query for semantic cache
     */
    private trackQuery;
    /**
     * Count words in query
     */
    private countWords;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        semanticCacheSize: number;
        queryHistorySize: number;
        topQueries: Array<{
            query: string;
            count: number;
        }>;
        embeddingCache: {
            size: number;
            hits: number;
            misses: number;
            hitRate: number;
            evictions: number;
        };
    };
    /**
     * Clear all caches
     */
    clear(): void;
}
/**
 * Default configuration
 */
export declare const DEFAULT_REFINER_CONFIG: QueryRefinerConfig;
//# sourceMappingURL=QueryRefiner.d.ts.map