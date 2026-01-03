/**
 * Cache Invalidation - Smart cache eviction strategies
 *
 * Cache invalidation is one of the hardest problems in computer science.
 * This utility provides multiple strategies for evicting cache entries:
 *
 * 1. TTL (Time-To-Live) - Expire after fixed duration
 * 2. Sliding Expiration - Reset TTL on access
 * 3. Semantic Drift - Invalidate when cached answer diverges from fresh
 * 4. Manual - Pattern-based eviction
 * 5. Tag-based - Group entries, invalidate by tag
 * 6. Dependency-based - Track dependencies, cascade invalidations
 * 7. LRU (Least Recently Used) - Evict oldest entries
 * 8. LFU (Least Frequently Used) - Evict entries with fewest hits
 * 9. FIFO (First In First Out) - Evict in creation order
 * 10. Adaptive - Dynamic strategy based on performance metrics
 *
 * Example:
 * ```ts
 * const invalidator = new CacheInvalidator(cache);
 * const count = invalidator.invalidate(InvalidationStrategy.LRU, {
 *   maxAge: 300000, // 5 minutes
 * });
 * console.log(`Invalidated ${count} entries`);
 * ```
 */

import { SemanticCache } from "../refiner/SemanticCache.js";
import type { SemanticCacheEntry } from "../types.js";
import type {
  CacheInvalidationStrategy as ProtocolInvalidationStrategy,
  CacheInvalidationTrigger,
  CacheEntryMetadata,
  InvalidationResult as ProtocolInvalidationResult,
  InvalidationEntry as ProtocolInvalidationEntry,
  InvalidationConfig,
  TTLInvalidationConfig,
  SlidingExpirationConfig,
  SemanticDriftConfig,
  TagInvalidationConfig,
  DependencyInvalidationConfig,
  LRUInvalidationConfig,
  LFUInvalidationConfig,
  FIFOInvalidationConfig,
  AdaptiveInvalidationConfig,
  CacheInvalidationPolicy,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  InvalidationStatistics,
  CacheInvalidationEvent,
} from "@lsi/protocol";

/**
 * Invalidation strategies (legacy enum for backwards compatibility)
 * @deprecated Use ProtocolInvalidationStrategy type from @lsi/protocol instead
 */
export enum InvalidationStrategy {
  /** Least recently used - evict oldest entries */
  LRU = "lru",
  /** Least frequently used - evict entries with fewest hits */
  LFU = "lfu",
  /** Time-based expiration - evict entries older than maxAge */
  TTL = "ttl",
  /** Adaptive - evict based on hit rate performance */
  ADAPTIVE = "adaptive",
  /** Manual - pattern-based eviction */
  MANUAL = "manual",
}

/**
 * Invalidation options
 */
export interface InvalidationOptions {
  /** Maximum age in milliseconds (for LRU/TTL) */
  maxAge?: number;
  /** Minimum hit count threshold (for LFU) */
  minHitCount?: number;
  /** Pattern for manual matching (regex) */
  pattern?: RegExp;
  /** Maximum number of entries to invalidate */
  maxEntries?: number;
  /** Dry run - don't actually invalidate */
  dryRun?: boolean;
}

/**
 * Invalidation result
 */
export interface InvalidationResult {
  /** Number of entries invalidated */
  count: number;
  /** Strategy used */
  strategy: InvalidationStrategy;
  /** Options used */
  options: InvalidationOptions;
  /** Entries that would be/were invalidated */
  entries?: Array<{
    key: string;
    query: string;
    reason: string;
  }>;
  /** Dry run indicator */
  dryRun: boolean;
}

/**
 * CacheInvalidator - Smart cache eviction strategies
 */
export class CacheInvalidator {
  constructor(private cache: SemanticCache) {}

  /**
   * Invalidate cache entries by strategy
   *
   * Applies the specified invalidation strategy with the given options.
   * Returns statistics about what was invalidated.
   *
   * @param strategy - Invalidation strategy to use
   * @param options - Strategy-specific options
   * @returns Invalidation result
   */
  invalidate(
    strategy: InvalidationStrategy,
    options: InvalidationOptions = {}
  ): InvalidationResult {
    const entries: Array<{ key: string; query: string; reason: string }> = [];
    let count = 0;

    switch (strategy) {
      case InvalidationStrategy.LRU:
        count = this.invalidateLRU(options, entries);
        break;

      case InvalidationStrategy.LFU:
        count = this.invalidateLFU(options as any).count;
        break;

      case InvalidationStrategy.TTL:
        count = this.invalidateByTTL(options as any).count;
        break;

      case InvalidationStrategy.ADAPTIVE:
        count = this.invalidateAdaptive(options as any).count;
        break;

      case InvalidationStrategy.MANUAL:
        count = this.invalidateManual(options, entries);
        break;

      default:
        console.warn(`[CacheInvalidator] Unknown strategy: ${strategy}`);
    }

    return {
      count,
      strategy,
      options,
      entries: options.dryRun ? entries : undefined,
      dryRun: options.dryRun ?? false,
    };
  }

  /**
   * Invalidate least recently used entries
   *
   * Evicts entries that haven't been accessed in a while.
   * Uses the lastAccessed timestamp to determine age.
   *
   * @param options - Invalidation options
   * @param entries - Array to collect invalidated entries
   * @returns Number of entries invalidated
   */
  private invalidateLRU(
    options: InvalidationOptions,
    entries: Array<{ key: string; query: string; reason: string }>
  ): number {
    const maxAge = options.maxAge ?? 300000; // 5 minutes default
    const maxEntries = options.maxEntries ?? Infinity;
    const now = Date.now();
    let count = 0;

    // Collect entries to invalidate
    const toInvalidate: Array<{ key: string; age: number }> = [];

    for (const [key, entry] of this.getCacheEntries()) {
      const age = now - entry.lastAccessed;

      if (age > maxAge) {
        toInvalidate.push({ key, age });

        if (entries.length < 100) {
          // Limit entries array size
          entries.push({
            key,
            query: entry.query,
            reason: `LRU: age ${(age / 1000).toFixed(1)}s > ${(maxAge / 1000).toFixed(1)}s`,
          });
        }
      }
    }

    // Sort by age (oldest first) and limit
    toInvalidate.sort((a, b) => b.age - a.age);

    for (const { key } of toInvalidate.slice(0, maxEntries)) {
      if (!options.dryRun) {
        this.cache.delete(key);
      }
      count++;
    }

    console.log(
      `[CacheInvalidator] LRU: Invalidated ${count} entries older than ${maxAge}ms`
    );

    return count;
  }


  /**
   * Get all cache entries
   *
   * Helper method to iterate over cache entries.
   * Uses public API methods to avoid accessing private members.
   *
   * @returns Array of [key, entry] tuples
   */
  private getCacheEntries(): Array<[string, SemanticCacheEntry]> {
    const entries: Array<[string, SemanticCacheEntry]> = [];

    // Use public keys() and peek() methods
    for (const key of this.cache.keys()) {
      const entry = this.cache.peek(key);
      if (entry) {
        entries.push([key, entry]);
      }
    }

    return entries;
  }

  /**
   * Get cache statistics
   *
   * Proxy to cache's getStats method.
   *
   * @returns Cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all cache entries
   *
   * Proxy to cache's clear method.
   */
  clear(): void {
    this.cache.clear();
    console.log("[CacheInvalidator] Cleared all cache entries");
  }

  /**
   * Estimate cache memory usage
   *
   * Estimates memory usage based on cache size and average entry size.
   * This is a rough estimate, not exact.
   *
   * @returns Estimated memory usage in bytes
   */
  estimateMemoryUsage(): number {
    const stats = this.cache.getStats();
    const avgEntrySize = 1024; // Rough estimate: 1KB per entry

    return stats.size * avgEntrySize;
  }

  /**
   * Get recommended invalidation strategy
   *
   * Analyzes cache statistics and recommends the best strategy
   * based on current state.
   *
   * @returns Recommended strategy and options
   */
  getRecommendation(): {
    strategy: InvalidationStrategy;
    options: InvalidationOptions;
    reason: string;
  } {
    const stats = this.cache.getStats();

    // If cache is small, no need to invalidate
    if (stats.size < 100) {
      return {
        strategy: InvalidationStrategy.TTL,
        options: { maxAge: 3600000 }, // 1 hour
        reason: "Cache is small, use TTL for basic cleanup",
      };
    }

    // If hit rate is low, try adaptive
    if (stats.hitRate < 0.5) {
      return {
        strategy: InvalidationStrategy.ADAPTIVE,
        options: {},
        reason: "Hit rate is low, adaptive invalidation may help",
      };
    }

    // If hit rate is high, use LRU
    if (stats.hitRate > 0.8) {
      return {
        strategy: InvalidationStrategy.LRU,
        options: { maxAge: 300000 }, // 5 minutes
        reason: "Hit rate is good, use LRU for maintenance",
      };
    }

    // Default to TTL
    return {
      strategy: InvalidationStrategy.TTL,
      options: { maxAge: 600000 }, // 10 minutes
      reason: "Default TTL strategy",
    };
  }

  // ============================================================================
  // NEW ENHANCED INVALIDATION STRATEGIES
  // ============================================================================

  /**
   * Invalidate with sliding expiration
   *
   * Resets TTL on each access, keeping frequently accessed entries fresh.
   * This is like a "sliding window" that extends as long as the entry is used.
   *
   * @param config - Sliding expiration configuration
   * @returns Invalidation result
   */
  invalidateSliding(
    config: SlidingExpirationConfig
  ): ProtocolInvalidationResult {
    const startTime = Date.now();
    const entries: ProtocolInvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    let examined = 0;

    const now = Date.now();
    const window = config.window;
    const minResetInterval = config.minResetInterval ?? 1000;
    const maxInvalidations = config.maxInvalidations ?? Infinity;

    for (const [key, entry] of this.getCacheEntries()) {
      examined++;

      if (count >= maxInvalidations) break;

      // Calculate time since last access
      const timeSinceAccess = now - entry.lastAccessed;

      // Check if entry should be invalidated
      // Entry expires if it hasn't been accessed within the sliding window
      if (timeSinceAccess > window) {
        const metadata = this.getEntryMetadata(key, entry);

        if (metadata.pinned) {
          skipped++;
          continue;
        }

        if (!config.dryRun) {
          this.cache.delete(key);
        }

        entries.push({
          key,
          query: entry.query,
          reason: `Sliding: not accessed for ${timeSinceAccess}ms > ${window}ms`,
          trigger: "time-expired",
          timestamp: now,
          wasPinned: metadata.pinned,
          age: now - entry.createdAt,
          hitCount: entry.hitCount,
        });

        count++;
      }
    }

    return {
      strategy: config.strategy,
      config,
      count,
      skipped,
      examined,
      duration: Date.now() - startTime,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Invalidate based on semantic drift
   *
   * Compares cached results against fresh results and invalidates when
   * they diverge beyond the similarity threshold. This requires actually
   * fetching fresh results for comparison.
   *
   * @param config - Semantic drift configuration
   * @param freshResults - Optional map of fresh results to compare against
   * @returns Invalidation result
   */
  invalidateSemanticDrift(
    config: SemanticDriftConfig,
    freshResults?: Map<string, unknown>
  ): ProtocolInvalidationResult {
    const startTime = Date.now();
    const entries: ProtocolInvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    let examined = 0;

    const now = Date.now();
    const threshold = config.similarityThreshold;
    const maxAge = config.maxAge ?? 30 * 60 * 1000; // 30 minutes default
    const maxInvalidations = config.maxInvalidations ?? Infinity;

    for (const [key, entry] of this.getCacheEntries()) {
      examined++;

      if (count >= maxInvalidations) break;

      const age = now - entry.createdAt;
      const metadata = this.getEntryMetadata(key, entry);

      if (metadata.pinned) {
        skipped++;
        continue;
      }

      // Check age first - don't invalidate very recent entries
      if (age < maxAge) {
        continue;
      }

      // If we have fresh results, compare them
      if (freshResults && freshResults.has(key)) {
        const freshResult = freshResults.get(key);
        const similarity = this.computeSimilarity(entry.result, freshResult);

        if (similarity < threshold) {
          if (!config.dryRun) {
            this.cache.delete(key);
          }

          entries.push({
            key,
            query: entry.query,
            reason: `Semantic drift: similarity ${similarity.toFixed(3)} < ${threshold.toFixed(3)}`,
            trigger: "semantic-threshold",
            timestamp: now,
            wasPinned: metadata.pinned,
            age,
            hitCount: entry.hitCount,
          });

          count++;
        }
      } else {
        // No fresh result available, invalidate based on age alone
        if (age > maxAge) {
          if (!config.dryRun) {
            this.cache.delete(key);
          }

          entries.push({
            key,
            query: entry.query,
            reason: `Semantic drift: age ${age}ms > ${maxAge}ms (no fresh result)`,
            trigger: "time-expired",
            timestamp: now,
            wasPinned: metadata.pinned,
            age,
            hitCount: entry.hitCount,
          });

          count++;
        }
      }
    }

    return {
      strategy: config.strategy,
      config,
      count,
      skipped,
      examined,
      duration: Date.now() - startTime,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Invalidate by tag
   *
   * Tag-based grouping allows invalidating multiple related entries at once.
   * Useful for invalidating all entries related to a specific topic, domain, or user.
   *
   * @param config - Tag invalidation configuration
   * @param entryMetadata - Map of entry metadata with tags
   * @returns Invalidation result
   */
  invalidateByTag(
    config: TagInvalidationConfig,
    entryMetadata?: Map<string, CacheEntryMetadata>
  ): ProtocolInvalidationResult {
    const startTime = Date.now();
    const entries: ProtocolInvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    let examined = 0;

    const now = Date.now();
    const tags = config.tags;
    const matchMode = config.matchMode;
    const maxInvalidations = config.maxInvalidations ?? Infinity;

    for (const [key, entry] of this.getCacheEntries()) {
      examined++;

      if (count >= maxInvalidations) break;

      const metadata = entryMetadata?.get(key) ?? this.getEntryMetadata(key, entry);

      if (metadata.pinned) {
        skipped++;
        continue;
      }

      // Check if entry has any of the specified tags
      const matches = this.tagsMatch(metadata.tags, tags, matchMode);

      if (matches) {
        if (!config.dryRun) {
          this.cache.delete(key);
        }

        entries.push({
          key,
          query: entry.query,
          reason: `Tag match: ${metadata.tags.join(", ")}`,
          trigger: "tag-invalidated",
          timestamp: now,
          wasPinned: metadata.pinned,
          age: now - entry.createdAt,
          hitCount: entry.hitCount,
        });

        count++;

        // Cascade to dependencies if enabled
        if (config.cascade && metadata.dependents.length > 0) {
          for (const dependentKey of metadata.dependents) {
            if (!config.dryRun) {
              this.cache.delete(dependentKey);
            }
            count++;
          }
        }
      }
    }

    return {
      strategy: config.strategy,
      config,
      count,
      skipped,
      examined,
      duration: Date.now() - startTime,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Invalidate by dependency
   *
   * Dependency tracking ensures that when a dependency changes, all
   * dependent cache entries are invalidated. This is crucial for
   * maintaining cache coherence in complex systems.
   *
   * @param config - Dependency invalidation configuration
   * @param entryMetadata - Map of entry metadata with dependencies
   * @returns Invalidation result
   */
  invalidateByDependency(
    config: DependencyInvalidationConfig,
    entryMetadata?: Map<string, CacheEntryMetadata>
  ): ProtocolInvalidationResult {
    const startTime = Date.now();
    const entries: ProtocolInvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    let examined = 0;

    const now = Date.now();
    const changedKeys = config.changedKeys;
    const cascadeDepth = config.cascadeDepth ?? 1;
    const maxInvalidations = config.maxInvalidations ?? Infinity;

    // Track visited keys to prevent infinite loops
    const visited = new Set<string>();

    // Process each changed key
    for (const changedKey of changedKeys) {
      this.invalidateDependencyCascade(
        changedKey,
        cascadeDepth,
        visited,
        entryMetadata,
        entries,
        count,
        skipped,
        examined,
        maxInvalidations,
        config.dryRun ?? false,
        now
      );
    }

    return {
      strategy: config.strategy,
      config,
      count: entries.length,
      skipped,
      examined,
      duration: Date.now() - startTime,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Invalidate with FIFO (First In First Out)
   *
   * Evicts entries in creation order, oldest first. Simple and predictable.
   *
   * @param config - FIFO configuration
   * @returns Invalidation result
   */
  invalidateFIFO(
    config: FIFOInvalidationConfig
  ): ProtocolInvalidationResult {
    const startTime = Date.now();
    const entries: ProtocolInvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    let examined = 0;

    const now = Date.now();
    const maxSize = config.maxSize;
    const respectPinned = config.respectPinned ?? true;

    // Get all entries and sort by creation time
    const allEntries = Array.from(this.getCacheEntries());
    allEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);

    // Calculate how many entries to invalidate
    const currentSize = allEntries.length;
    const toInvalidate = Math.max(0, currentSize - maxSize);

    for (let i = 0; i < toInvalidate && i < allEntries.length; i++) {
      const [key, entry] = allEntries[i];
      examined++;

      const metadata = this.getEntryMetadata(key, entry);

      if (respectPinned && metadata.pinned) {
        skipped++;
        continue;
      }

      if (!config.dryRun) {
        this.cache.delete(key);
      }

      entries.push({
        key,
        query: entry.query,
        reason: `FIFO: position ${i + 1} of ${toInvalidate} to evict`,
        trigger: "cache-full",
        timestamp: now,
        wasPinned: metadata.pinned,
        age: now - entry.createdAt,
        hitCount: entry.hitCount,
      });

      count++;
    }

    return {
      strategy: config.strategy,
      config,
      count,
      skipped,
      examined,
      duration: Date.now() - startTime,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Apply invalidation policy
   *
   * Evaluates and applies a cache invalidation policy with multiple strategies.
   *
   * @param policy - Invalidation policy to apply
   * @param context - Evaluation context
   * @returns Invalidation result
   */
  async applyPolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<ProtocolInvalidationResult> {
    const startTime = Date.now();

    // Evaluate if policy should be applied
    const evaluation = await this.evaluatePolicy(policy, context);

    if (!evaluation.shouldApply) {
      return {
        strategy: "adaptive",
        config: policy.strategies[0],
        count: 0,
        skipped: 0,
        examined: 0,
        duration: Date.now() - startTime,
        dryRun: false,
        success: true,
      };
    }

    // Apply strategies in priority order
    let totalCount = 0;
    const results: ProtocolInvalidationResult[] = [];

    for (const strategyConfig of policy.strategies) {
      if (!strategyConfig.enabled) continue;

      const result = await this.invalidateWithConfig(strategyConfig);
      results.push(result);
      totalCount += result.count;

      // Stop if we've invalidated enough
      if (totalCount >= 1000) break;
    }

    // Update policy metadata
    policy.lastApplied = Date.now();

    return {
      strategy: "adaptive",
      config: policy.strategies[0],
      count: totalCount,
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      examined: results.reduce((sum, r) => sum + r.examined, 0),
      duration: Date.now() - startTime,
      dryRun: false,
      success: true,
    };
  }

  /**
   * Evaluate if policy should be applied
   *
   * @param policy - Policy to evaluate
   * @param context - Evaluation context
   * @returns Evaluation result
   */
  async evaluatePolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    const shouldApply =
      policy.autoApply &&
      (context.cacheSize > (policy.maxCacheSize ?? Infinity) ||
        context.cacheMemoryUsage > (policy.maxCacheMemory ?? Infinity) ||
        context.cacheHitRate < 0.5);

    const confidence = shouldApply ? 0.9 : 0.1;
    const reasoning = shouldApply
      ? `Cache size (${context.cacheSize}) or memory usage (${context.cacheMemoryUsage}) exceeds limits, or hit rate (${context.cacheHitRate}) is low`
      : "Cache is healthy, no invalidation needed";

    return {
      shouldApply,
      confidence,
      reasoning,
      recommendedAdjustments: [],
      estimatedImpact: shouldApply
        ? {
            entriesToInvalidate: Math.floor(context.cacheSize * 0.2),
            memoryToFree: Math.floor(context.cacheMemoryUsage * 0.2),
            hitRateImprovement: 0.1,
          }
        : undefined,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Invalidate with protocol configuration
   *
   * Routes to the appropriate invalidation method based on config type.
   *
   * @param config - Invalidation configuration
   * @returns Invalidation result
   */
  private async invalidateWithConfig(
    config: InvalidationConfig
  ): Promise<ProtocolInvalidationResult> {
    switch (config.strategy) {
      case "ttl":
        return this.invalidateByTTL(config as TTLInvalidationConfig);
      case "sliding":
        return this.invalidateSliding(config as SlidingExpirationConfig);
      case "semantic-drift":
        return this.invalidateSemanticDrift(config as SemanticDriftConfig);
      case "tagged":
        return this.invalidateByTag(config as TagInvalidationConfig);
      case "dependency":
        return this.invalidateByDependency(config as DependencyInvalidationConfig);
      case "lru":
        return this.invalidateByLRU(config as LRUInvalidationConfig);
      case "lfu":
        return this.invalidateLFU(config as LFUInvalidationConfig);
      case "fifo":
        return this.invalidateFIFO(config as FIFOInvalidationConfig);
      case "adaptive":
        return this.invalidateAdaptive(config as AdaptiveInvalidationConfig);
      default:
        throw new Error(`Unknown strategy: ${(config as any).strategy}`);
    }
  }

  /**
   * Invalidate dependency cascade
   *
   * Recursively invalidates dependent entries.
   *
   * @param key - Dependency key
   * @param depth - Current cascade depth
   * @param visited - Visited keys set
   * @param entryMetadata - Entry metadata map
   * @param entries - Entries array to populate
   * @param count - Current count
   * @param skipped - Current skipped
   * @param examined - Current examined
   * @param maxInvalidations - Maximum invalidations
   * @param dryRun - Dry run mode
   * @param now - Current timestamp
   */
  private invalidateDependencyCascade(
    key: string,
    depth: number,
    visited: Set<string>,
    entryMetadata: Map<string, CacheEntryMetadata> | undefined,
    entries: ProtocolInvalidationEntry[],
    count: number,
    skipped: number,
    examined: number,
    maxInvalidations: number,
    dryRun: boolean,
    now: number
  ): void {
    if (depth <= 0 || visited.has(key)) return;

    visited.add(key);
    examined++;

    const metadata = entryMetadata?.get(key);
    if (!metadata) return;

    if (metadata.pinned) {
      skipped++;
      return;
    }

    if (count >= maxInvalidations) return;

    const entry = this.cache.peek(key);
    if (!entry) return;

    if (!dryRun) {
      this.cache.delete(key);
    }

    entries.push({
      key,
      query: entry.query,
      reason: `Dependency cascade: ${key}`,
      trigger: "dependency-changed",
      timestamp: now,
      wasPinned: metadata.pinned,
      age: now - entry.createdAt,
      hitCount: entry.hitCount,
    });

    count++;

    // Cascade to dependents
    for (const dependentKey of metadata.dependents) {
      this.invalidateDependencyCascade(
        dependentKey,
        depth - 1,
        visited,
        entryMetadata,
        entries,
        count,
        skipped,
        examined,
        maxInvalidations,
        dryRun,
        now
      );
    }
  }

  /**
   * Check if tags match
   *
   * @param entryTags - Entry's tags
   * @param matchTags - Tags to match against
   * @param mode - Match mode
   * @returns Whether tags match
   */
  private tagsMatch(
    entryTags: string[],
    matchTags: string[],
    mode: "exact" | "prefix" | "regex"
  ): boolean {
    switch (mode) {
      case "exact":
        return matchTags.some((tag) => entryTags.includes(tag));
      case "prefix":
        return matchTags.some((tag) =>
          entryTags.some((entryTag) => entryTag.startsWith(tag))
        );
      case "regex":
        return matchTags.some((tag) => {
          const regex = new RegExp(tag);
          return entryTags.some((entryTag) => regex.test(entryTag));
        });
    }
  }

  /**
   * Compute similarity between two results
   *
   * Simple string-based similarity. In production, you'd use embeddings.
   *
   * @param result1 - First result
   * @param result2 - Second result
   * @returns Similarity score (0-1)
   */
  private computeSimilarity(result1: unknown, result2: unknown): number {
    const str1 = JSON.stringify(result1);
    const str2 = JSON.stringify(result2);

    if (str1 === str2) return 1.0;

    // Simple Jaccard similarity
    const set1 = new Set(str1.split(""));
    const set2 = new Set(str2.split(""));
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Get entry metadata
   *
   * Extracts metadata from a cache entry.
   *
   * @param key - Cache key
   * @param entry - Cache entry
   * @returns Entry metadata
   */
  private getEntryMetadata(
    key: string,
    entry: SemanticCacheEntry
  ): CacheEntryMetadata {
    return {
      key,
      query: entry.query,
      createdAt: entry.createdAt,
      lastAccessed: entry.lastAccessed,
      hitCount: entry.hitCount,
      embedding: entry.embedding,
      tags: [], // Would be populated from actual metadata
      dependencies: [],
      dependents: [],
      priority: 0,
      size: 1024, // Estimate
      pinned: false,
      valid: true,
    };
  }

  /**
   * Invalidate by TTL (wrapper for existing method)
   *
   * @param config - TTL configuration
   * @returns Invalidation result
   */
  private invalidateByTTL(config: TTLInvalidationConfig): ProtocolInvalidationResult {
    const result = this.invalidate(InvalidationStrategy.TTL, {
      maxAge: config.ttl,
      dryRun: config.dryRun,
    });

    return {
      strategy: config.strategy,
      config,
      count: result.count,
      skipped: 0,
      examined: result.entries?.length ?? 0,
      duration: 0,
      entries: result.entries?.map((e) => ({
        key: e.key,
        query: e.query,
        reason: e.reason,
        trigger: "time-expired",
        timestamp: Date.now(),
        wasPinned: false,
        age: 0,
        hitCount: 0,
      })),
      dryRun: result.dryRun,
      success: true,
    };
  }

  /**
   * Invalidate by LRU (wrapper for existing method)
   *
   * @param config - LRU configuration
   * @returns Invalidation result
   */
  private invalidateByLRU(config: LRUInvalidationConfig): ProtocolInvalidationResult {
    const result = this.invalidate(InvalidationStrategy.LRU, {
      maxAge: config.maxAge,
      dryRun: config.dryRun,
    });

    return {
      strategy: config.strategy,
      config,
      count: result.count,
      skipped: 0,
      examined: result.entries?.length ?? 0,
      duration: 0,
      entries: result.entries?.map((e) => ({
        key: e.key,
        query: e.query,
        reason: e.reason,
        trigger: "time-expired",
        timestamp: Date.now(),
        wasPinned: false,
        age: 0,
        hitCount: 0,
      })),
      dryRun: result.dryRun,
      success: true,
    };
  }

  /**
   * Invalidate by LFU (wrapper for existing method)
   *
   * @param config - LFU configuration
   * @returns Invalidation result
   */
  private invalidateLFU(config: LFUInvalidationConfig): ProtocolInvalidationResult {
    const result = this.invalidate(InvalidationStrategy.LFU, {
      minHitCount: config.minHitCount,
      dryRun: config.dryRun,
    });

    return {
      strategy: config.strategy,
      config,
      count: result.count,
      skipped: 0,
      examined: result.entries?.length ?? 0,
      duration: 0,
      entries: result.entries?.map((e) => ({
        key: e.key,
        query: e.query,
        reason: e.reason,
        trigger: "cache-full",
        timestamp: Date.now(),
        wasPinned: false,
        age: 0,
        hitCount: 0,
      })),
      dryRun: result.dryRun,
      success: true,
    };
  }

  /**
   * Invalidate adaptive (wrapper for existing method)
   *
   * @param config - Adaptive configuration
   * @returns Invalidation result
   */
  private invalidateAdaptive(
    config: AdaptiveInvalidationConfig
  ): ProtocolInvalidationResult {
    const result = this.invalidate(InvalidationStrategy.ADAPTIVE, {
      dryRun: config.dryRun,
    });

    return {
      strategy: config.strategy,
      config,
      count: result.count,
      skipped: 0,
      examined: result.entries?.length ?? 0,
      duration: 0,
      entries: result.entries?.map((e) => ({
        key: e.key,
        query: e.query,
        reason: e.reason,
        trigger: "cache-full",
        timestamp: Date.now(),
        wasPinned: false,
        age: 0,
        hitCount: 0,
      })),
      dryRun: result.dryRun,
      success: true,
    };
  }

  /**
   * Invalidate manual (pattern-based eviction)
   *
   * @param options - Invalidation options
   * @param entries - Array to collect invalidated entries
   * @returns Number of entries invalidated
   */
  private invalidateManual(
    options: InvalidationOptions,
    entries: Array<{ key: string; query: string; reason: string }>
  ): number {
    const pattern = options.pattern;
    if (!pattern) {
      return 0;
    }

    let count = 0;

    for (const [key, entry] of this.getCacheEntries()) {
      if (pattern.test(key) || pattern.test(entry.query)) {
        this.cache.delete(key);
        count++;

        if (entries.length < 100) {
          entries.push({
            key,
            query: entry.query,
            reason: `Manual: matched pattern ${pattern.source}`,
          });
        }
      }
    }

    return count;
  }
}

/**
 * Default invalidation options
 */
export const DEFAULT_INVALIDATION_OPTIONS: InvalidationOptions = {
  maxAge: 300000, // 5 minutes
  minHitCount: 2,
  dryRun: false,
};

/**
 * InvalidationPolicy class
 *
 * Manages cache invalidation policies with multiple strategies.
 */
export class InvalidationPolicy {
  private policies: Map<string, CacheInvalidationPolicy> = new Map();
  private invalidator: CacheInvalidator;

  constructor(invalidator: CacheInvalidator) {
    this.invalidator = invalidator;
  }

  /**
   * Add a policy
   *
   * @param policy - Policy to add
   */
  addPolicy(policy: CacheInvalidationPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove a policy
   *
   * @param policyId - Policy ID to remove
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  /**
   * Get a policy
   *
   * @param policyId - Policy ID
   * @returns Policy or undefined
   */
  getPolicy(policyId: string): CacheInvalidationPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   *
   * @returns All policies
   */
  getAllPolicies(): CacheInvalidationPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Apply a policy
   *
   * @param policyId - Policy ID to apply
   * @param context - Evaluation context
   * @returns Invalidation result
   */
  async applyPolicy(
    policyId: string,
    context: PolicyEvaluationContext
  ): Promise<ProtocolInvalidationResult> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    return this.invalidator.applyPolicy(policy, context);
  }

  /**
   * Evaluate a policy
   *
   * @param policyId - Policy ID to evaluate
   * @param context - Evaluation context
   * @returns Evaluation result
   */
  async evaluatePolicy(
    policyId: string,
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    return this.invalidator.evaluatePolicy(policy, context);
  }

  /**
   * Apply all applicable policies
   *
   * @param context - Evaluation context
   * @returns Array of invalidation results
   */
  async applyAllPolicies(
    context: PolicyEvaluationContext
  ): Promise<ProtocolInvalidationResult[]> {
    const results: ProtocolInvalidationResult[] = [];

    for (const policy of this.policies.values()) {
      if (policy.autoApply) {
        const result = await this.invalidator.applyPolicy(policy, context);
        results.push(result);
      }
    }

    return results;
  }
}
