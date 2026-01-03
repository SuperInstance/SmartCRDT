/**
 * SemanticCacheBridge - Unified cache interface for text + visual caching
 *
 * Bridges the visual embedding cache with the existing SemanticCache
 * for text queries, providing a unified caching interface.
 *
 * Features:
 * - Unified cache interface for text and visual queries
 * - Shared metrics tracking (combined hit rates)
 * - Coordinated invalidation (text + visual cache together)
 * - Multi-modal cache key generation
 * - Cross-modality similarity matching
 *
 * @version 1.0.0
 */

import type { Float32Array } from "../types.js";
import {
  VisualEmbeddingCache,
  type VisualCacheConfig,
  type CacheLookupResult,
} from "./VisualEmbeddingCache.js";
import {
  SemanticKeyGenerator,
  type SemanticKey,
} from "./SemanticKeyGenerator.js";
import {
  CacheInvalidation,
  type InvalidationEvent,
} from "./CacheInvalidation.js";

// ============================================================================
// BRIDGE TYPES
// ============================================================================

/**
 * Multi-modal cache entry type
 */
export type CacheEntryType = "text" | "visual" | "multimodal";

/**
 * Multi-modal cache query
 */
export interface MultiModalQuery {
  /** Query type */
  type: CacheEntryType;
  /** Text query (for text/multimodal) */
  text?: string;
  /** Visual input (for visual/multimodal) */
  visual?: ImageData | HTMLCanvasElement | string;
  /** Semantic key (optional, pre-computed) */
  semanticKey?: SemanticKey;
  /** Text embedding (optional, pre-computed) */
  textEmbedding?: Float32Array;
  /** Visual embedding (optional, pre-computed) */
  visualEmbedding?: Float32Array;
}

/**
 * Multi-modal cache result
 */
export interface MultiModalCacheResult {
  /** Whether cache hit was found */
  found: boolean;
  /** Which cache level was hit */
  level: "l1" | "l2" | "l3" | "l4" | null;
  /** Cache entry type */
  type: CacheEntryType;
  /** Text result (if applicable) */
  textResult?: unknown;
  /** Visual embedding (if applicable) */
  visualEmbedding?: Float32Array;
  /** Text embedding (if applicable) */
  textEmbedding?: Float32Array;
  /** Similarity score (0-1) for semantic matches */
  similarity?: number;
  /** Lookup time in milliseconds */
  lookupTime: number;
  /** Whether this was a combined text+visual hit */
  combinedHit?: boolean;
}

/**
 * Unified cache metrics
 */
export interface UnifiedCacheMetrics {
  /** Text-only cache metrics */
  text: {
    hitRate: number;
    totalQueries: number;
    cacheHits: number;
  };
  /** Visual-only cache metrics */
  visual: {
    hitRate: number;
    totalQueries: number;
    cacheHits: number;
  };
  /** Multi-modal cache metrics */
  multimodal: {
    hitRate: number;
    totalQueries: number;
    cacheHits: number;
  };
  /** Overall combined metrics */
  overall: {
    hitRate: number;
    totalQueries: number;
    cacheHits: number;
    processingTimeSaved: number;
    costSaved: number;
  };
}

/**
 * Semantic cache bridge configuration
 */
export interface SemanticCacheBridgeConfig {
  /** Visual cache configuration */
  visualCache: Partial<VisualCacheConfig>;
  /** Enable text caching */
  enableTextCache: boolean;
  /** Enable visual caching */
  enableVisualCache: boolean;
  /** Enable multi-modal caching */
  enableMultiModal: boolean;
  /** Similarity threshold for cross-modality matching */
  crossModalityThreshold: number;
  /** Enable unified metrics */
  enableUnifiedMetrics: boolean;
}

// ============================================================================
// TEXT CACHE STUB
// ============================================================================

/**
 * Text Cache Stub
 *
 * Stub implementation for text cache.
 * In production, this would integrate with the existing SemanticCache.
 */
class TextCache {
  private cache: Map<
    string,
    { result: unknown; embedding?: Float32Array; timestamp: number }
  > = new Map();

  /**
   * Get from text cache
   */
  async get(
    key: string
  ): Promise<{ result: unknown; embedding?: Float32Array } | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL (1 hour)
    if (Date.now() - entry.timestamp > 3600000) {
      this.cache.delete(key);
      return null;
    }

    return { result: entry.result, embedding: entry.embedding };
  }

  /**
   * Set in text cache
   */
  async set(
    key: string,
    result: unknown,
    embedding?: Float32Array
  ): Promise<void> {
    this.cache.set(key, {
      result,
      embedding,
      timestamp: Date.now(),
    });
  }

  /**
   * Delete from text cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all text cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================================================
// SEMANTIC CACHE BRIDGE (Main Class)
// ============================================================================

/**
 * Semantic Cache Bridge
 *
 * Unified interface for text + visual caching with coordinated invalidation.
 */
export class SemanticCacheBridge {
  private visualCache: VisualEmbeddingCache;
  private textCache: TextCache;
  private keyGenerator: SemanticKeyGenerator;
  private config: SemanticCacheBridgeConfig;
  private textMetrics: { hits: number; misses: number };
  private multimodalMetrics: { hits: number; misses: number };

  constructor(config?: Partial<SemanticCacheBridgeConfig>) {
    this.config = {
      visualCache: {},
      enableTextCache: true,
      enableVisualCache: true,
      enableMultiModal: true,
      crossModalityThreshold: 0.85,
      enableUnifiedMetrics: true,
      ...config,
    };

    this.visualCache = new VisualEmbeddingCache({
      version: "1.0",
      l1: {
        maxSize: this.config.visualCache.l1?.maxSize || 50,
        maxEntries: this.config.visualCache.l1?.maxEntries || 100,
        ttl: this.config.visualCache.l1?.ttl || 3600,
      },
      l2: {
        dbName: this.config.visualCache.l2?.dbName || "vljepa_visual_cache",
        maxEntries: this.config.visualCache.l2?.maxEntries || 1000,
        ttl: this.config.visualCache.l2?.ttl || 86400,
      },
      l3: {
        redisUrl:
          this.config.visualCache.l3?.redisUrl || "redis://localhost:6379",
        keyPrefix: this.config.visualCache.l3?.keyPrefix || "vljepa:visual:",
        ttl: this.config.visualCache.l3?.ttl || 604800,
      },
      l4: {
        enabled: this.config.visualCache.l4?.enabled || false,
        bucket: this.config.visualCache.l4?.bucket || "vljepa-cache",
        cdn: this.config.visualCache.l4?.cdn || "cdn.vljepa.example.com",
      },
      global: this.config.visualCache.global,
    });

    this.textCache = new TextCache();
    this.keyGenerator = new SemanticKeyGenerator();

    this.textMetrics = { hits: 0, misses: 0 };
    this.multimodalMetrics = { hits: 0, misses: 0 };
  }

  /**
   * Get from unified cache (text, visual, or multi-modal)
   */
  async get(query: MultiModalQuery): Promise<MultiModalCacheResult> {
    const startTime = performance.now();

    try {
      switch (query.type) {
        case "text":
          return await this.getText(query, startTime);

        case "visual":
          return await this.getVisual(query, startTime);

        case "multimodal":
          return await this.getMultiModal(query, startTime);

        default:
          return {
            found: false,
            level: null,
            type: query.type,
            lookupTime: performance.now() - startTime,
          };
      }
    } catch (error) {
      console.error("[SemanticCacheBridge] Error getting from cache:", error);
      return {
        found: false,
        level: null,
        type: query.type,
        lookupTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Set in unified cache
   */
  async set(
    query: MultiModalQuery,
    result: unknown,
    embedding?: Float32Array
  ): Promise<void> {
    switch (query.type) {
      case "text":
        await this.setText(query, result, embedding);
        break;

      case "visual":
        await this.setVisual(query, embedding);
        break;

      case "multimodal":
        await this.setMultiModal(query, result, embedding);
        break;
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(
    type: CacheEntryType,
    context?: {
      textKey?: string;
      visualInput?: ImageData | HTMLCanvasElement | string;
    }
  ): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];

    if (type === "text" || type === "multimodal") {
      if (context?.textKey) {
        this.textCache.delete(context.textKey);
        events.push({
          type: "text_invalidation",
          timestamp: Date.now(),
          keysAffected: [context.textKey],
          reason: "Text cache invalidation",
          scope: "single",
          trigger: "explicit",
        });
      }
    }

    if (type === "visual" || type === "multimodal") {
      if (context?.visualInput) {
        const key = await this.keyGenerator.generate(context.visualInput);
        const visualEvents = await this.visualCache.invalidate("explicit");
        events.push(...visualEvents);
      }
    }

    return events;
  }

  /**
   * Get unified metrics
   */
  async getMetrics(): Promise<UnifiedCacheMetrics> {
    const visualMetrics = this.visualCache.getMetrics();

    const textTotal = this.textMetrics.hits + this.textMetrics.misses;
    const textHitRate = textTotal > 0 ? this.textMetrics.hits / textTotal : 0;

    const multimodalTotal =
      this.multimodalMetrics.hits + this.multimodalMetrics.misses;
    const multimodalHitRate =
      multimodalTotal > 0 ? this.multimodalMetrics.hits / multimodalTotal : 0;

    const overallHits =
      this.textMetrics.hits +
      this.multimodalMetrics.hits +
      visualMetrics.hitRate.overall;
    const overallTotal =
      textTotal + multimodalTotal + visualMetrics.savings.totalQueries;
    const overallHitRate = overallTotal > 0 ? overallHits / overallTotal : 0;

    return {
      text: {
        hitRate: textHitRate,
        totalQueries: textTotal,
        cacheHits: this.textMetrics.hits,
      },
      visual: {
        hitRate: visualMetrics.hitRate.overall,
        totalQueries: visualMetrics.savings.totalQueries,
        cacheHits: visualMetrics.savings.cacheHits,
      },
      multimodal: {
        hitRate: multimodalHitRate,
        totalQueries: multimodalTotal,
        cacheHits: this.multimodalMetrics.hits,
      },
      overall: {
        hitRate: overallHitRate,
        totalQueries: overallTotal,
        cacheHits: overallHits,
        processingTimeSaved: visualMetrics.savings.processingTimeSaved,
        costSaved: visualMetrics.savings.costSaved,
      },
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.textCache.clear();
    await this.visualCache.clear();
    this.textMetrics = { hits: 0, misses: 0 };
    this.multimodalMetrics = { hits: 0, misses: 0 };
  }

  /**
   * Get text cache entry
   */
  private async getText(
    query: MultiModalQuery,
    startTime: number
  ): Promise<MultiModalCacheResult> {
    if (!this.config.enableTextCache || !query.text) {
      this.textMetrics.misses++;
      return {
        found: false,
        level: null,
        type: "text",
        lookupTime: performance.now() - startTime,
      };
    }

    const entry = await this.textCache.get(query.text);
    if (entry) {
      this.textMetrics.hits++;
      return {
        found: true,
        level: "l1",
        type: "text",
        textResult: entry.result,
        textEmbedding: entry.embedding,
        lookupTime: performance.now() - startTime,
      };
    }

    this.textMetrics.misses++;
    return {
      found: false,
      level: null,
      type: "text",
      lookupTime: performance.now() - startTime,
    };
  }

  /**
   * Get visual cache entry
   */
  private async getVisual(
    query: MultiModalQuery,
    startTime: number
  ): Promise<MultiModalCacheResult> {
    if (!this.config.enableVisualCache || !query.visual) {
      return {
        found: false,
        level: null,
        type: "visual",
        lookupTime: performance.now() - startTime,
      };
    }

    const result = await this.visualCache.get(query.visual, query.semanticKey);
    return {
      found: result.found,
      level: result.level,
      type: "visual",
      visualEmbedding: result.embedding,
      similarity: result.similarity,
      lookupTime: result.lookupTime,
    };
  }

  /**
   * Get multi-modal cache entry
   */
  private async getMultiModal(
    query: MultiModalQuery,
    startTime: number
  ): Promise<MultiModalCacheResult> {
    if (!this.config.enableMultiModal) {
      this.multimodalMetrics.misses++;
      return {
        found: false,
        level: null,
        type: "multimodal",
        lookupTime: performance.now() - startTime,
      };
    }

    // Try text cache first
    let textResult: { result: unknown; embedding?: Float32Array } | null = null;
    if (query.text) {
      textResult = await this.textCache.get(query.text);
    }

    // Try visual cache
    let visualResult: CacheLookupResult | null = null;
    if (query.visual) {
      visualResult = await this.visualCache.get(
        query.visual,
        query.semanticKey
      );
    }

    // Check for combined hit
    const textHit = textResult !== null;
    const visualHit = visualResult?.found || false;

    if (textHit && visualHit) {
      // Combined hit - both text and visual found
      this.multimodalMetrics.hits++;
      return {
        found: true,
        level: visualResult?.level || "l1",
        type: "multimodal",
        textResult: textResult.result,
        textEmbedding: textResult.embedding,
        visualEmbedding: visualResult?.embedding,
        combinedHit: true,
        lookupTime: performance.now() - startTime,
      };
    }

    // Cross-modality matching - try to find similar embeddings
    if (textHit && query.visualEmbedding && textResult.embedding) {
      const similarity = this.keyGenerator.embeddingSimilarity(
        query.visualEmbedding,
        textResult.embedding
      );

      if (similarity >= this.config.crossModalityThreshold) {
        this.multimodalMetrics.hits++;
        return {
          found: true,
          level: "l1",
          type: "multimodal",
          textResult: textResult.result,
          textEmbedding: textResult.embedding,
          similarity,
          lookupTime: performance.now() - startTime,
        };
      }
    }

    if (visualHit && query.textEmbedding && visualResult?.embedding) {
      const similarity = this.keyGenerator.embeddingSimilarity(
        query.textEmbedding,
        visualResult.embedding
      );

      if (similarity >= this.config.crossModalityThreshold) {
        this.multimodalMetrics.hits++;
        return {
          found: true,
          level: visualResult.level,
          type: "multimodal",
          visualEmbedding: visualResult.embedding,
          similarity,
          lookupTime: performance.now() - startTime,
        };
      }
    }

    // No combined hit, return individual hits if any
    if (textHit) {
      this.multimodalMetrics.hits++;
      return {
        found: true,
        level: "l1",
        type: "multimodal",
        textResult: textResult.result,
        textEmbedding: textResult.embedding,
        combinedHit: false,
        lookupTime: performance.now() - startTime,
      };
    }

    if (visualHit) {
      this.multimodalMetrics.hits++;
      return {
        found: true,
        level: visualResult!.level,
        type: "multimodal",
        visualEmbedding: visualResult!.embedding,
        combinedHit: false,
        lookupTime: performance.now() - startTime,
      };
    }

    // Complete miss
    this.multimodalMetrics.misses++;
    return {
      found: false,
      level: null,
      type: "multimodal",
      lookupTime: performance.now() - startTime,
    };
  }

  /**
   * Set text cache entry
   */
  private async setText(
    query: MultiModalQuery,
    result: unknown,
    embedding?: Float32Array
  ): Promise<void> {
    if (!this.config.enableTextCache || !query.text) return;
    await this.textCache.set(query.text, result, embedding);
  }

  /**
   * Set visual cache entry
   */
  private async setVisual(
    query: MultiModalQuery,
    embedding?: Float32Array
  ): Promise<void> {
    if (!this.config.enableVisualCache || !query.visual || !embedding) return;

    await this.visualCache.set(query.visual, embedding, {
      frameSize: { width: 1920, height: 1080 },
      uiContext: "unknown",
      confidence: 1.0,
      processingTime: 0,
    });
  }

  /**
   * Set multi-modal cache entry
   */
  private async setMultiModal(
    query: MultiModalQuery,
    result: unknown,
    embedding?: Float32Array
  ): Promise<void> {
    if (!this.config.enableMultiModal) return;

    // Set text cache
    if (query.text) {
      await this.setText(query, result, embedding);
    }

    // Set visual cache
    if (query.visual && embedding) {
      await this.setVisual(query, embedding);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): SemanticCacheBridgeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SemanticCacheBridgeConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default semantic cache bridge configuration
 */
export const DEFAULT_SEMANTIC_CACHE_BRIDGE_CONFIG: SemanticCacheBridgeConfig = {
  visualCache: {},
  enableTextCache: true,
  enableVisualCache: true,
  enableMultiModal: true,
  crossModalityThreshold: 0.85,
  enableUnifiedMetrics: true,
};

/**
 * Production semantic cache bridge configuration
 */
export const PRODUCTION_SEMANTIC_CACHE_BRIDGE_CONFIG: SemanticCacheBridgeConfig =
  {
    visualCache: {
      l1: { maxSize: 100, maxEntries: 500, ttl: 7200 },
      l2: { maxEntries: 5000, ttl: 604800 },
      global: { enableMetrics: true },
    },
    enableTextCache: true,
    enableVisualCache: true,
    enableMultiModal: true,
    crossModalityThreshold: 0.9,
    enableUnifiedMetrics: true,
  };

/**
 * Minimal semantic cache bridge configuration
 */
export const MINIMAL_SEMANTIC_CACHE_BRIDGE_CONFIG: SemanticCacheBridgeConfig = {
  visualCache: {
    l1: { maxSize: 20, maxEntries: 50, ttl: 1800 },
    l2: { maxEntries: 200, ttl: 3600 },
    global: { enableMetrics: false },
  },
  enableTextCache: false,
  enableVisualCache: true,
  enableMultiModal: false,
  crossModalityThreshold: 0.95,
  enableUnifiedMetrics: false,
};
