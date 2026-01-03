/**
 * @fileoverview Embedding State Management for VL-JEPA + CoAgents
 *
 * Manages combined embedding state from visual, intent, and goal sources.
 * Provides utilities for embedding fusion, similarity computation, and state tracking.
 *
 * @version 1.0.0
 */

import type { VLJEPABridgeState, VisualState } from "./VLJEPABridge.js";

// ============================================================================
// EMBEDDING STATE TYPES
// ============================================================================

/**
 * Embedding vector with metadata
 */
export interface EmbeddingVector {
  /** Embedding values */
  values: Float32Array;

  /** Embedding dimension */
  dimension: number;

  /** Source of embedding */
  source: "x-encoder" | "y-encoder" | "predictor" | "fusion";

  /** Timestamp */
  timestamp: number;

  /** Model version used */
  modelVersion?: string;

  /** Normalization status */
  isNormalized: boolean;
}

/**
 * Embedding similarity matrix
 */
export interface EmbeddingSimilarityMatrix {
  /** Visual-intent similarity */
  visualIntent: number;

  /** Visual-goal similarity */
  visualGoal: number;

  /** Intent-goal similarity */
  intentGoal: number;

  /** Overall coherence */
  coherence: number;
}

/**
 * Embedding state history
 */
export interface EmbeddingStateHistory {
  /** History entries */
  entries: EmbeddingHistoryEntry[];

  /** Maximum history size */
  maxSize: number;
}

/**
 * Single history entry
 */
export interface EmbeddingHistoryEntry {
  /** Entry ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Visual embedding */
  visual: EmbeddingVector;

  /** Intent embedding */
  intent: EmbeddingVector;

  /** Goal embedding */
  goal: EmbeddingVector;

  /** Fused embedding */
  fused: EmbeddingVector;

  /** Similarity matrix */
  similarities: EmbeddingSimilarityMatrix;

  /** Actions derived from embeddings */
  actionCount: number;

  /** User interaction result */
  result?: "approve" | "reject" | "modify";
}

/**
 * Embedding state configuration
 */
export interface EmbeddingStateConfig {
  /** Enable history tracking */
  enableHistory?: boolean;

  /** Maximum history size */
  maxHistorySize?: number;

  /** Enable similarity caching */
  enableCache?: boolean;

  /** Similarity cache TTL in milliseconds */
  cacheTTL?: number;

  /** Default fusion weights */
  fusionWeights?: {
    visual: number;
    intent: number;
  };
}

// ============================================================================
// EMBEDDING STATE MANAGER
// ============================================================================

/**
 * Embedding State Manager
 *
 * Manages embedding state, fusion, similarity computation, and history tracking.
 */
export class EmbeddingStateManager {
  private config: Required<EmbeddingStateConfig>;
  private history: EmbeddingStateHistory;
  private similarityCache: Map<string, { similarity: number; expiry: number }>;

  constructor(config: EmbeddingStateConfig = {}) {
    this.config = {
      enableHistory: true,
      maxHistorySize: 100,
      enableCache: true,
      cacheTTL: 60000, // 1 minute
      fusionWeights: { visual: 0.5, intent: 0.5 },
      ...config,
    };
    this.history = {
      entries: [],
      maxSize: this.config.maxHistorySize,
    };
    this.similarityCache = new Map();
  }

  // ========================================================================
  // EMBEDDING CREATION
  // ========================================================================

  /**
   * Create embedding vector
   *
   * @param values - Embedding values
   * @param source - Source of embedding
   * @param modelVersion - Model version
   * @returns Embedding vector
   */
  createEmbedding(
    values: Float32Array | number[],
    source: EmbeddingVector["source"],
    modelVersion?: string
  ): EmbeddingVector {
    const float32Values =
      values instanceof Float32Array ? values : new Float32Array(values);

    return {
      values: float32Values,
      dimension: float32Values.length,
      source,
      timestamp: Date.now(),
      modelVersion,
      isNormalized: false,
    };
  }

  /**
   * Create normalized embedding vector
   *
   * @param values - Embedding values
   * @param source - Source of embedding
   * @param modelVersion - Model version
   * @returns Normalized embedding vector
   */
  createNormalizedEmbedding(
    values: Float32Array | number[],
    source: EmbeddingVector["source"],
    modelVersion?: string
  ): EmbeddingVector {
    const embedding = this.createEmbedding(values, source, modelVersion);
    embedding.values = this.normalize(embedding.values);
    embedding.isNormalized = true;
    return embedding;
  }

  // ========================================================================
  // EMBEDDING FUSION
  // ========================================================================

  /**
   * Fuse multiple embeddings with weights
   *
   * @param embeddings - Embeddings to fuse with weights
   * @returns Fused embedding vector
   */
  fuseEmbeddings(
    embeddings: Array<{ embedding: EmbeddingVector; weight: number }>
  ): EmbeddingVector {
    if (embeddings.length === 0) {
      throw new Error("Cannot fuse empty embeddings array");
    }

    // Validate all embeddings have same dimension
    const dim = embeddings[0].embedding.dimension;
    for (const { embedding } of embeddings) {
      if (embedding.dimension !== dim) {
        throw new Error(
          `Embedding dimension mismatch: expected ${dim}, got ${embedding.dimension}`
        );
      }
    }

    // Calculate weighted sum
    const totalWeight = embeddings.reduce((sum, { weight }) => sum + weight, 0);
    const fusedValues = new Float32Array(dim).fill(0);

    for (const { embedding, weight } of embeddings) {
      const normalizedWeight = weight / totalWeight;
      for (let i = 0; i < dim; i++) {
        fusedValues[i] += embedding.values[i] * normalizedWeight;
      }
    }

    return this.createNormalizedEmbedding(
      fusedValues,
      "fusion",
      embeddings[0].embedding.modelVersion
    );
  }

  /**
   * Fuse visual and intent embeddings using config weights
   *
   * @param visual - Visual embedding
   * @param intent - Intent embedding
   * @returns Fused embedding vector
   */
  fuseVisualIntent(
    visual: EmbeddingVector,
    intent: EmbeddingVector
  ): EmbeddingVector {
    return this.fuseEmbeddings([
      { embedding: visual, weight: this.config.fusionWeights.visual },
      { embedding: intent, weight: this.config.fusionWeights.intent },
    ]);
  }

  /**
   * Update fusion weights
   *
   * @param weights - New fusion weights
   */
  updateFusionWeights(weights: { visual: number; intent: number }): void {
    const total = weights.visual + weights.intent;
    if (total <= 0) {
      throw new Error("Fusion weights must sum to positive value");
    }

    this.config.fusionWeights = {
      visual: weights.visual / total,
      intent: weights.intent / total,
    };
  }

  // ========================================================================
  // SIMILARITY COMPUTATION
  // ========================================================================

  /**
   * Compute cosine similarity between embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Cosine similarity (-1 to 1)
   */
  cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.dimension !== b.dimension) {
      throw new Error(`Dimension mismatch: ${a.dimension} vs ${b.dimension}`);
    }

    const cacheKey = this.cacheKey(a.values, b.values);
    const cached = this.similarityCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.similarity;
    }

    const similarity = this.computeCosineSimilarity(a.values, b.values);

    if (this.config.enableCache) {
      this.similarityCache.set(cacheKey, {
        similarity,
        expiry: Date.now() + this.config.cacheTTL,
      });
    }

    return similarity;
  }

  /**
   * Compute similarity matrix for three embeddings
   *
   * @param visual - Visual embedding
   * @param intent - Intent embedding
   * @param goal - Goal embedding
   * @returns Similarity matrix
   */
  similarityMatrix(
    visual: EmbeddingVector,
    intent: EmbeddingVector,
    goal: EmbeddingVector
  ): EmbeddingSimilarityMatrix {
    const visualIntent = this.cosineSimilarity(visual, intent);
    const visualGoal = this.cosineSimilarity(visual, goal);
    const intentGoal = this.cosineSimilarity(intent, goal);

    // Coherence: average of all similarities
    const coherence = (visualIntent + visualGoal + intentGoal) / 3;

    return {
      visualIntent,
      visualGoal,
      intentGoal,
      coherence,
    };
  }

  /**
   * Compute cosine similarity (internal)
   */
  private computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Compute Euclidean distance between embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Euclidean distance
   */
  euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.dimension !== b.dimension) {
      throw new Error(`Dimension mismatch: ${a.dimension} vs ${b.dimension}`);
    }

    let sum = 0;
    for (let i = 0; i < a.dimension; i++) {
      const diff = a.values[i] - b.values[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Compute Manhattan distance between embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Manhattan distance
   */
  manhattanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.dimension !== b.dimension) {
      throw new Error(`Dimension mismatch: ${a.dimension} vs ${b.dimension}`);
    }

    let sum = 0;
    for (let i = 0; i < a.dimension; i++) {
      sum += Math.abs(a.values[i] - b.values[i]);
    }

    return sum;
  }

  // ========================================================================
  // EMBEDDING NORMALIZATION
  // ========================================================================

  /**
   * Normalize embedding to unit length
   *
   * @param embedding - Embedding to normalize
   * @returns Normalized embedding
   */
  normalize(embedding: Float32Array): Float32Array {
    const norm = Math.sqrt(
      Array.from(embedding).reduce((sum, val) => sum + val * val, 0)
    );
    if (norm === 0) return new Float32Array(embedding);

    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / norm;
    }
    return normalized;
  }

  /**
   * L2 normalize embedding vector
   *
   * @param embedding - Embedding to normalize
   * @returns Normalized embedding vector
   */
  normalizeVector(embedding: EmbeddingVector): EmbeddingVector {
    return {
      ...embedding,
      values: this.normalize(embedding.values),
      isNormalized: true,
    };
  }

  // ========================================================================
  // HISTORY TRACKING
  // ========================================================================

  /**
   * Add embedding state to history
   *
   * @param visual - Visual embedding
   * @param intent - Intent embedding
   * @param goal - Goal embedding
   * @param fused - Fused embedding
   * @param actionCount - Number of actions derived
   * @returns History entry ID
   */
  addToHistory(
    visual: EmbeddingVector,
    intent: EmbeddingVector,
    goal: EmbeddingVector,
    fused: EmbeddingVector,
    actionCount: number
  ): string {
    const id = crypto.randomUUID();
    const similarities = this.similarityMatrix(visual, intent, goal);

    const entry: EmbeddingHistoryEntry = {
      id,
      timestamp: Date.now(),
      visual,
      intent,
      goal,
      fused,
      similarities,
      actionCount,
    };

    this.history.entries.push(entry);

    // Trim history if needed
    if (this.history.entries.length > this.history.maxSize) {
      this.history.entries.shift();
    }

    return id;
  }

  /**
   * Get history entry by ID
   *
   * @param id - Entry ID
   * @returns History entry or null
   */
  getHistoryEntry(id: string): EmbeddingHistoryEntry | null {
    return this.history.entries.find(e => e.id === id) ?? null;
  }

  /**
   * Get recent history entries
   *
   * @param count - Number of recent entries
   * @returns Recent entries
   */
  getRecentHistory(count: number = 10): EmbeddingHistoryEntry[] {
    return this.history.entries.slice(-count);
  }

  /**
   * Get all history entries
   *
   * @returns All entries
   */
  getAllHistory(): EmbeddingHistoryEntry[] {
    return [...this.history.entries];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.entries = [];
  }

  /**
   * Update history entry result
   *
   * @param id - Entry ID
   * @param result - User interaction result
   */
  updateHistoryResult(
    id: string,
    result: "approve" | "reject" | "modify"
  ): void {
    const entry = this.getHistoryEntry(id);
    if (entry) {
      entry.result = result;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Generate cache key for similarity
   */
  private cacheKey(a: Float32Array, b: Float32Array): string {
    // Use first few values as a simple hash
    const hash = (arr: Float32Array) =>
      Array.from(arr.slice(0, 8))
        .map(v => v.toFixed(4))
        .join(",");
    return `${hash(a)}:${hash(b)}`;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.similarityCache.entries()) {
      if (value.expiry <= now) {
        this.similarityCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.similarityCache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): Required<EmbeddingStateConfig> {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    historySize: number;
    cacheSize: number;
    avgCoherence: number;
  } {
    const avgCoherence =
      this.history.entries.length > 0
        ? this.history.entries.reduce(
            (sum, e) => sum + e.similarities.coherence,
            0
          ) / this.history.entries.length
        : 0;

    return {
      historySize: this.history.entries.length,
      cacheSize: this.similarityCache.size,
      avgCoherence,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create embedding state manager
 *
 * @param config - Manager configuration
 * @returns Embedding state manager instance
 */
export function createEmbeddingStateManager(
  config?: EmbeddingStateConfig
): EmbeddingStateManager {
  return new EmbeddingStateManager(config);
}

export default EmbeddingStateManager;
