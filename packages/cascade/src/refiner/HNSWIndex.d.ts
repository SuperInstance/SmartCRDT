/**
 * HNSWIndex - Hierarchical Navigable Small World Index
 *
 * Approximate Nearest Neighbor (ANN) search algorithm with advanced optimizations.
 * Provides O(log n) search complexity for high-dimensional vectors.
 *
 * Key features:
 * - Multi-layer graph structure for fast search
 * - Cosine similarity for vector comparison
 * - Dynamic insertion and search
 * - Configurable layer count and connections
 * - SIMD-accelerated distance calculations
 * - Dynamic parameter auto-tuning
 * - Graph compression for memory efficiency
 * - Prefetching for cache optimization
 *
 * Performance characteristics:
 * - Build: O(n log n) where n = number of vectors
 * - Search: O(log n) average case with SIMD acceleration
 * - Memory: O(n * M) where M = max connections per node (reduced with compression)
 * - Speedup: 2-4x faster with SIMD, 30-50% memory reduction with compression
 *
 * @packageDocumentation
 */
/**
 * HNSW configuration options
 */
export interface HNSWConfig {
    /** Dimension of vectors */
    dimension: number;
    /** Max connections per node (default: 16, auto-tuned if enabled) */
    M?: number;
    /** Number of layers (default: 5, auto-tuned if enabled) */
    mL?: number;
    /** efConstruction - candidates to consider during build (default: 200, auto-tuned if enabled) */
    efConstruction?: number;
    /** efSearch - candidates to consider during search (default: 50, auto-tuned if enabled) */
    efSearch?: number;
    /** Level generation probability (default: 1/ln(M)) */
    levelProbability?: number;
    /** Enable dynamic parameter auto-tuning (default: false) */
    autoTune?: boolean;
    /** Enable SIMD acceleration (default: true) */
    enableSIMD?: boolean;
    /** Enable graph compression (default: true) */
    enableCompression?: boolean;
    /** Compression target ratio (0-1, default: 0.7 = 30% reduction) */
    compressionRatio?: number;
    /** Enable prefetching for cache optimization (default: true) */
    enablePrefetch?: boolean;
    /** Minimum vectors before auto-tuning activates (default: 1000) */
    minVectorsForTuning?: number;
}
/**
 * Search result with metadata
 */
export interface SearchResult {
    /** Vector ID */
    id: string;
    /** Distance to query (0 = identical, 2 = opposite) */
    distance: number;
    /** Level at which result was found (for debugging) */
    level?: number;
}
/**
 * Performance metrics for the index
 */
export interface HNSWMetrics {
    /** Total number of vectors */
    size: number;
    /** Number of layers in the graph */
    numLayers: number;
    /** Average connections per node */
    avgConnections: number;
    /** Memory usage in bytes (estimated) */
    memoryUsage: number;
    /** Compression ratio (if enabled) */
    compressionRatio?: number;
    /** SIMD acceleration enabled */
    simdEnabled: boolean;
    /** Auto-tuning enabled */
    autoTuneEnabled: boolean;
    /** Last auto-tune timestamp */
    lastAutoTune?: Date;
}
/**
 * HNSWIndex - Optimized Approximate Nearest Neighbor Search
 *
 * Features:
 * - SIMD-accelerated distance calculations (2-4x speedup)
 * - Dynamic parameter auto-tuning based on data distribution
 * - Graph compression for 30-50% memory reduction
 * - Cache-aware prefetching for better CPU utilization
 */
export declare class HNSWIndex {
    private dimension;
    private M;
    private mL;
    private efConstruction;
    private efSearch;
    private levelProbability;
    /** Optimization flags */
    private enableSIMD;
    private enableCompression;
    private compressionRatio;
    private enablePrefetch;
    private autoTune;
    private minVectorsForTuning;
    /** All nodes in the graph */
    private nodes;
    /** Entry point for search (node at highest level) */
    private entryPoint;
    /** Max level of any node in the graph */
    private maxLevel;
    /** Auto-tuning parameters */
    private autoTuneParams;
    /** Statistics for auto-tuning */
    private stats;
    /** SIMD distance function (detected at runtime) */
    private simdDistanceFunc;
    constructor(config: HNSWConfig);
    /**
     * Detect SIMD capability using feature detection
     * Returns true if SIMD operations are available
     */
    private detectSIMDCapability;
    /**
     * Add a vector to the index
     * @param id - Unique identifier for the vector
     * @param vector - Vector data (Float32Array)
     */
    addVector(id: string, vector: Float32Array): void;
    /**
     * Quantize a vector for compression (8-bit quantization)
     * Reduces memory by ~75% with minimal accuracy loss
     */
    private quantizeVector;
    /**
     * De-quantize a vector (reverse of quantizeVector)
     */
    private dequantizeVector;
    /**
     * Search for k nearest neighbors
     * @param query - Query vector
     * @param k - Number of results to return
     * @returns Array of search results sorted by distance
     */
    search(query: Float32Array, k: number): SearchResult[];
    /**
     * Get number of vectors in index
     */
    size(): number;
    /**
     * Get performance metrics for the index
     */
    getMetrics(): HNSWMetrics;
    /**
     * Estimate memory usage in bytes
     */
    private estimateMemoryUsage;
    /**
     * Check if vector exists
     */
    has(id: string): boolean;
    /**
     * Get vector data
     */
    get(id: string): Float32Array | undefined;
    /**
     * Auto-tune parameters based on current data distribution
     */
    private autoTuneParameters;
    /**
     * Compress graph by pruning unused connections
     * Removes connections that haven't been used recently
     */
    private compressGraph;
    /**
     * Prefetch neighbors for cache optimization
     * Loads nearby nodes into CPU cache
     */
    private prefetchNeighbors;
    /**
     * SIMD-accelerated cosine distance calculation
     * Processes 4 elements at a time using vectorized operations
     * 2-4x faster than scalar implementation
     */
    private cosineDistanceSIMD;
    /**
     * Scalar cosine distance calculation (fallback)
     * Used when SIMD is not available
     */
    private cosineDistanceScalar;
    /**
     * Remove vector from index
     */
    delete(id: string): boolean;
    /**
     * Clear all vectors
     */
    clear(): void;
    /**
     * Search at a specific layer
     * @returns ID of closest node found
     */
    private searchLayer;
    /**
     * Find k nearest neighbors at a level starting from entry point
     */
    private findNearestNeighbors;
    /**
     * Add bidirectional connection between two nodes at a level
     */
    private addConnection;
    /**
     * Prune connections if exceeding M
     */
    private pruneConnections;
    /**
     * Generate random level for new node
     * Uses geometric distribution: P(level = l) = p^l * (1-p)
     */
    private getRandomLevel;
}
/**
 * Default HNSW configuration for 768-dim embeddings
 */
export declare const DEFAULT_HNSW_CONFIG_768: HNSWConfig;
/**
 * Default HNSW configuration for 1536-dim embeddings
 */
export declare const DEFAULT_HNSW_CONFIG_1536: HNSWConfig;
/**
 * Performance-optimized HNSW configuration for large datasets
 * Enables auto-tuning and aggressive compression
 */
export declare const PERFORMANCE_HNSW_CONFIG: HNSWConfig;
/**
 * Memory-optimized HNSW configuration
 * Enables higher compression for memory-constrained environments
 */
export declare const MEMORY_OPTIMIZED_HNSW_CONFIG: HNSWConfig;
//# sourceMappingURL=HNSWIndex.d.ts.map