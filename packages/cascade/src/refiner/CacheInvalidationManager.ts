/**
 * Cache Invalidation Manager
 *
 * Implements smart cache invalidation strategies for the SemanticCache.
 * Supports multiple strategies: TTL, sliding expiration, semantic drift,
 * manual, tag-based, dependency-based, LRU, LFU, FIFO, and adaptive.
 *
 * This is the implementation of the ICacheInvalidationManager interface
 * defined in @lsi/protocol/src/cache-invalidation.ts.
 */

import type {
  CacheEntryMetadata,
  CacheInvalidationStrategy,
  CacheInvalidationTrigger,
  InvalidationConfig,
  InvalidationResult,
  InvalidationEntry,
  CacheInvalidationPolicy,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  InvalidationStatistics,
  CacheInvalidationEvent,
  CacheInvalidationEventListener,
  TTLInvalidationConfig,
  SlidingExpirationConfig,
  SemanticDriftConfig,
  TagInvalidationConfig,
  DependencyInvalidationConfig,
  LRUInvalidationConfig,
  LFUInvalidationConfig,
  FIFOInvalidationConfig,
  AdaptiveInvalidationConfig,
  isTTLConfig,
  isSlidingConfig,
  isSemanticDriftConfig,
  isTagConfig,
  isDependencyConfig,
  isLRUConfig,
  isLFUConfig,
  isFIFOConfig,
  isAdaptiveConfig,
} from "@lsi/protocol";

/**
 * Internal cache entry with invalidation metadata
 */
interface InternalCacheEntry {
  key: string;
  query: string;
  result: unknown;
  embedding: number[];
  createdAt: number;
  lastAccessed: number;
  hitCount: number;
  expiresAt?: number;
  slidingWindow?: number;
  tags: Set<string>;
  dependencies: Set<string>;
  dependents: Set<string>;
  priority: number;
  size: number;
  pinned: boolean;
  valid: boolean;
  invalidationReason?: string;
}

/**
 * CacheInvalidationManager - Smart cache invalidation strategies
 */
export class CacheInvalidationManager {
  private cache: Map<string, InternalCacheEntry> = new Map();
  private invalidationStats: InvalidationStatistics = this.createEmptyStats();
  private eventListeners: Set<CacheInvalidationEventListener> = new Set();
  private activePolicies: Map<string, CacheInvalidationPolicy> = new Map();
  private autoApplyIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Invalidate cache entries using the specified strategy
   */
  async invalidate(config: InvalidationConfig): Promise<InvalidationResult> {
    const startTime = Date.now();
    const entries: InvalidationEntry[] = [];
    let count = 0;
    let skipped = 0;
    const maxInvalidations = config.maxInvalidations ?? Infinity;

    // Collect entries to invalidate
    const toInvalidate: Array<{ key: string; entry: InternalCacheEntry }> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.pinned) {
        skipped++;
        continue;
      }

      if (this.shouldInvalidateEntry(entry, config)) {
        toInvalidate.push({ key, entry });
        if (toInvalidate.length >= maxInvalidations) break;
      }
    }

    // Process invalidations
    for (const { key, entry } of toInvalidate) {
      entries.push(this.createInvalidationEntry(entry, config.strategy));
      if (!config.dryRun) {
        this.invalidateEntry(key, entry, config.strategy);
      }
      count++;
    }

    const duration = Date.now() - startTime;
    this.updateStats(config.strategy, count, duration);

    return {
      strategy: config.strategy,
      config,
      count,
      skipped,
      examined: this.cache.size,
      duration,
      entries: config.dryRun ? entries : undefined,
      dryRun: config.dryRun ?? false,
      success: true,
    };
  }

  /**
   * Invalidate a specific cache entry by key
   */
  async invalidateKey(key: string, reason: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.pinned) return false;

    this.invalidateEntry(key, entry, "manual", reason);
    return true;
  }

  /**
   * Invalidate cache entries by tag
   */
  async invalidateByTags(tags: string[], cascade = false): Promise<number> {
    let count = 0;
    const toInvalidate: string[] = [];

    // Find entries with matching tags
    for (const [key, entry] of this.cache.entries()) {
      if (entry.pinned) continue;

      for (const tag of tags) {
        if (entry.tags.has(tag)) {
          toInvalidate.push(key);
          break;
        }
      }
    }

    // Invalidate entries
    for (const key of toInvalidate) {
      const entry = this.cache.get(key);
      if (entry) {
        this.invalidateEntry(key, entry, "tag-invalidated" as any, `Tag matched: ${tags.join(", ")}`);
        count++;
      }
    }

    // Cascade to dependents if requested
    if (cascade) {
      for (const key of toInvalidate) {
        const dependents = await this.getDependents(key);
        for (const depKey of dependents) {
          await this.invalidateKey(depKey, `Cascade from tag invalidation: ${key}`);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Invalidate entries by dependency
   */
  async invalidateByDependency(
    dependencyKey: string,
    cascadeDepth = 1
  ): Promise<number> {
    let count = 0;
    const visited = new Set<string>();

    const invalidateDependents = async (key: string, depth: number) => {
      if (depth > cascadeDepth || visited.has(key)) return;
      visited.add(key);

      const entry = this.cache.get(key);
      if (!entry) return;

      for (const depKey of entry.dependents) {
        const depEntry = this.cache.get(depKey);
        if (depEntry && !depEntry.pinned) {
          this.invalidateEntry(depKey, depEntry, "dependency-changed" as any, `Dependency changed: ${key}`);
          count++;
          await invalidateDependents(depKey, depth + 1);
        }
      }
    };

    await invalidateDependents(dependencyKey, 0);
    return count;
  }

  /**
   * Manually trigger semantic drift detection
   */
  async detectSemanticDrift(sampleKeys?: string[]): Promise<number> {
    let count = 0;

    const keysToCheck = sampleKeys || Array.from(this.cache.keys());

    for (const key of keysToCheck) {
      const entry = this.cache.get(key);
      if (!entry || !entry.embedding || entry.embedding.length === 0) continue;

      // In a real implementation, this would:
      // 1. Re-compute the embedding for the query
      // 2. Compare with cached embedding
      // 3. Invalidate if similarity is below threshold

      // For now, we'll invalidate entries older than maxAge
      const maxAge = 30 * 60 * 1000; // 30 minutes
      const age = Date.now() - entry.createdAt;

      if (age > maxAge) {
        this.invalidateEntry(key, entry, "semantic-threshold" as any, "Entry too old (semantic drift)");
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  async clearAll(reason: string): Promise<number> {
    const count = this.cache.size;
    this.cache.clear();
    this.emitEvent({
      type: "cleared",
      timestamp: Date.now(),
      trigger: "manual-clear",
      entriesAffected: count,
      data: { reason },
    });
    return count;
  }

  /**
   * Apply an invalidation policy
   */
  async applyPolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<InvalidationResult> {
    const startTime = Date.now();
    let totalCount = 0;
    let totalSkipped = 0;
    const allEntries: InvalidationEntry[] = [];

    // Apply strategies in priority order
    const sortedStrategies = [...policy.strategies].sort((a, b) => b.priority - a.priority);

    for (const strategy of sortedStrategies) {
      if (!strategy.enabled) continue;

      const result = await this.invalidate(strategy);
      totalCount += result.count;
      totalSkipped += result.skipped;
      if (result.entries) {
        allEntries.push(...result.entries);
      }
    }

    const duration = Date.now() - startTime;
    policy.lastApplied = Date.now();

    this.emitEvent({
      type: "policy-applied",
      timestamp: Date.now(),
      trigger: "manual-clear",
      entriesAffected: totalCount,
      policyId: policy.id,
    });

    return {
      strategy: "adaptive",
      config: policy.strategies[0] || {},
      count: totalCount,
      skipped: totalSkipped,
      examined: this.cache.size,
      duration,
      entries: allEntries,
      dryRun: false,
      success: true,
    };
  }

  /**
   * Evaluate whether a policy should be applied
   */
  async evaluatePolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    let shouldApply = false;
    let confidence = 0.0;
    const reasons: string[] = [];

    // Check if cache size exceeds threshold
    if (policy.maxCacheSize && context.cacheSize > policy.maxCacheSize) {
      shouldApply = true;
      confidence = Math.max(confidence, 0.9);
      reasons.push(`Cache size (${context.cacheSize}) exceeds threshold (${policy.maxCacheSize})`);
    }

    // Check if memory usage exceeds threshold
    if (policy.maxCacheMemory && context.cacheMemoryUsage > policy.maxCacheMemory) {
      shouldApply = true;
      confidence = Math.max(confidence, 0.95);
      reasons.push(`Memory usage (${context.cacheMemoryUsage}) exceeds threshold (${policy.maxCacheMemory})`);
    }

    // Check if hit rate is low
    if (context.cacheHitRate < 0.5) {
      shouldApply = true;
      confidence = Math.max(confidence, 0.7);
      reasons.push(`Low cache hit rate (${(context.cacheHitRate * 100).toFixed(1)}%)`);
    }

    // Check if enough time has passed since last invalidation
    if (policy.autoApplyInterval) {
      const timeSinceLast = context.timeSinceLastInvalidation;
      if (timeSinceLast > policy.autoApplyInterval) {
        shouldApply = true;
        confidence = Math.max(confidence, 0.6);
        reasons.push(`Time since last invalidation (${(timeSinceLast / 1000).toFixed(0)}s) exceeds interval`);
      }
    }

    return {
      shouldApply,
      confidence,
      reasoning: reasons.join("; ") || "No conditions met",
      estimatedImpact: {
        entriesToInvalidate: Math.floor(context.cacheSize * 0.2),
        memoryToFree: Math.floor(context.cacheMemoryUsage * 0.2),
        hitRateImprovement: 0.1,
      },
    };
  }

  /**
   * Get invalidation statistics
   */
  async getInvalidationStats(): Promise<InvalidationStatistics> {
    return { ...this.invalidationStats };
  }

  /**
   * Check if a cache entry is valid
   */
  async isEntryValid(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return entry.valid;
  }

  /**
   * Pin an entry to prevent eviction
   */
  async pinEntry(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.pinned = true;
    return true;
  }

  /**
   * Unpin an entry to allow eviction
   */
  async unpinEntry(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.pinned = false;
    return true;
  }

  /**
   * Add tags to a cache entry
   */
  async addTags(key: string, tags: string[]): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    for (const tag of tags) {
      entry.tags.add(tag);
    }
    return true;
  }

  /**
   * Remove tags from a cache entry
   */
  async removeTags(key: string, tags: string[]): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    for (const tag of tags) {
      entry.tags.delete(tag);
    }
    return true;
  }

  /**
   * Add dependency relationship
   */
  async addDependency(
    dependentKey: string,
    dependencyKey: string
  ): Promise<boolean> {
    const dependent = this.cache.get(dependentKey);
    const dependency = this.cache.get(dependencyKey);

    if (!dependent || !dependency) return false;

    dependent.dependencies.add(dependencyKey);
    dependency.dependents.add(dependentKey);
    return true;
  }

  /**
   * Remove dependency relationship
   */
  async removeDependency(
    dependentKey: string,
    dependencyKey: string
  ): Promise<boolean> {
    const dependent = this.cache.get(dependentKey);
    const dependency = this.cache.get(dependencyKey);

    if (!dependent || !dependency) return false;

    dependent.dependencies.delete(dependencyKey);
    dependency.dependents.delete(dependentKey);
    return true;
  }

  /**
   * Get dependencies for a cache entry
   */
  async getDependencies(key: string): Promise<string[]> {
    const entry = this.cache.get(key);
    if (!entry) return [];
    return Array.from(entry.dependencies);
  }

  /**
   * Get dependents for a cache entry
   */
  async getDependents(key: string): Promise<string[]> {
    const entry = this.cache.get(key);
    if (!entry) return [];
    return Array.from(entry.dependents);
  }

  /**
   * Register or update a cache entry (for external cache integration)
   */
  registerEntry(
    key: string,
    query: string,
    result: unknown,
    embedding: number[] = [],
    options: Partial<InternalCacheEntry> = {}
  ): void {
    const now = Date.now();
    const entry: InternalCacheEntry = {
      key,
      query,
      result,
      embedding,
      createdAt: now,
      lastAccessed: now,
      hitCount: 0,
      tags: new Set(options.tags || []),
      dependencies: new Set(options.dependencies || []),
      dependents: new Set(),
      priority: options.priority ?? 0,
      size: options.size ?? this.estimateSize(query, result),
      pinned: options.pinned ?? false,
      valid: true,
      expiresAt: options.expiresAt,
      slidingWindow: options.slidingWindow,
    };

    this.cache.set(key, entry);
  }

  /**
   * Update access time for a cache entry
   */
  updateAccess(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;

    entry.lastAccessed = Date.now();
    entry.hitCount++;

    // Update sliding window if applicable
    if (entry.slidingWindow) {
      entry.expiresAt = Date.now() + entry.slidingWindow;
    }
  }

  /**
   * Add event listener
   */
  onInvalidation(listener: CacheInvalidationEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  offInvalidation(listener: CacheInvalidationEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Register an invalidation policy
   */
  registerPolicy(policy: CacheInvalidationPolicy): void {
    this.activePolicies.set(policy.id, policy);

    // Set up auto-apply interval if specified
    if (policy.autoApply && policy.autoApplyInterval) {
      const interval = setInterval(async () => {
        const context = await this.createEvaluationContext();
        const evalResult = await this.evaluatePolicy(policy, context);
        if (evalResult.shouldApply && evalResult.confidence > 0.7) {
          await this.applyPolicy(policy, context);
        }
      }, policy.autoApplyInterval);

      this.autoApplyIntervals.set(policy.id, interval);
    }
  }

  /**
   * Unregister an invalidation policy
   */
  unregisterPolicy(policyId: string): void {
    this.activePolicies.delete(policyId);

    // Clear auto-apply interval
    const interval = this.autoApplyIntervals.get(policyId);
    if (interval) {
      clearInterval(interval);
      this.autoApplyIntervals.delete(policyId);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Determine if an entry should be invalidated based on config
   */
  private shouldInvalidateEntry(
    entry: InternalCacheEntry,
    config: InvalidationConfig
  ): boolean {
    if (!entry.valid) return false;

    switch (config.strategy) {
      case "ttl":
        return this.shouldInvalidateTTL(entry, config as TTLInvalidationConfig);

      case "sliding":
        return this.shouldInvalidateSliding(entry, config as SlidingExpirationConfig);

      case "semantic-drift":
        return this.shouldInvalidateSemanticDrift(entry, config as SemanticDriftConfig);

      case "tagged":
        return this.shouldInvalidateTagged(entry, config as TagInvalidationConfig);

      case "dependency":
        return this.shouldInvalidateDependency(entry, config as DependencyInvalidationConfig);

      case "lru":
        return this.shouldInvalidateLRU(entry, config as LRUInvalidationConfig);

      case "lfu":
        return this.shouldInvalidateLFU(entry, config as LFUInvalidationConfig);

      case "fifo":
        return this.shouldInvalidateFIFO(entry, config as FIFOInvalidationConfig);

      case "adaptive":
        return this.shouldInvalidateAdaptive(entry, config as AdaptiveInvalidationConfig);

      default:
        return false;
    }
  }

  /**
   * TTL invalidation logic
   */
  private shouldInvalidateTTL(
    entry: InternalCacheEntry,
    config: TTLInvalidationConfig
  ): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() >= entry.expiresAt;
  }

  /**
   * Sliding expiration logic
   */
  private shouldInvalidateSliding(
    entry: InternalCacheEntry,
    config: SlidingExpirationConfig
  ): boolean {
    if (!entry.expiresAt) return false;

    const now = Date.now();

    // Check if enough time has passed since last access for reset
    const timeSinceAccess = now - entry.lastAccessed;
    if (timeSinceAccess < (config.minResetInterval || 1000)) {
      // Recently accessed, would have been reset
      return false;
    }

    // Check if expired
    return now >= entry.expiresAt;
  }

  /**
   * Semantic drift logic
   */
  private shouldInvalidateSemanticDrift(
    entry: InternalCacheEntry,
    config: SemanticDriftConfig
  ): boolean {
    // Check max age
    if (config.maxAge) {
      const age = Date.now() - entry.createdAt;
      if (age > config.maxAge) return true;
    }

    // In a real implementation, we would re-compute embedding and compare
    // For now, we use age as a proxy
    return false;
  }

  /**
   * Tag-based invalidation logic
   */
  private shouldInvalidateTagged(
    entry: InternalCacheEntry,
    config: TagInvalidationConfig
  ): boolean {
    for (const tag of config.tags) {
      if (config.matchMode === "exact") {
        if (entry.tags.has(tag)) return true;
      } else if (config.matchMode === "prefix") {
        for (const entryTag of entry.tags) {
          if (entryTag.startsWith(tag)) return true;
        }
      } else if (config.matchMode === "regex") {
        const regex = new RegExp(tag);
        for (const entryTag of entry.tags) {
          if (regex.test(entryTag)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Dependency-based invalidation logic
   */
  private shouldInvalidateDependency(
    entry: InternalCacheEntry,
    config: DependencyInvalidationConfig
  ): boolean {
    for (const depKey of config.changedKeys) {
      if (entry.dependencies.has(depKey)) return true;
    }
    return false;
  }

  /**
   * LRU invalidation logic
   */
  private shouldInvalidateLRU(
    entry: InternalCacheEntry,
    config: LRUInvalidationConfig
  ): boolean {
    const age = Date.now() - entry.lastAccessed;
    return age > config.maxAge;
  }

  /**
   * LFU invalidation logic
   */
  private shouldInvalidateLFU(
    entry: InternalCacheEntry,
    config: LFUInvalidationConfig
  ): boolean {
    if (entry.hitCount < config.minHitCount) return true;

    if (config.considerRecency) {
      const age = Date.now() - entry.lastAccessed;
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (age > maxAge && entry.hitCount < 5) return true;
    }

    return false;
  }

  /**
   * FIFO invalidation logic
   */
  private shouldInvalidateFIFO(
    entry: InternalCacheEntry,
    config: FIFOInvalidationConfig
  ): boolean {
    // This is typically handled at the cache level, not per-entry
    return false;
  }

  /**
   * Adaptive invalidation logic
   */
  private shouldInvalidateAdaptive(
    entry: InternalCacheEntry,
    config: AdaptiveInvalidationConfig
  ): boolean {
    // Adaptive strategy delegates to other strategies
    // This is a placeholder - real implementation would be more sophisticated
    return false;
  }

  /**
   * Invalidate a single entry
   */
  private invalidateEntry(
    key: string,
    entry: InternalCacheEntry,
    strategy: CacheInvalidationStrategy,
    reason?: string
  ): void {
    entry.valid = false;
    entry.invalidationReason = reason || `Strategy: ${strategy}`;

    // Notify dependents
    for (const depKey of entry.dependents) {
      const depEntry = this.cache.get(depKey);
      if (depEntry) {
        depEntry.dependencies.delete(key);
      }
    }

    // Remove from dependencies
    for (const depKey of entry.dependencies) {
      const depEntry = this.cache.get(depKey);
      if (depEntry) {
        depEntry.dependents.delete(key);
      }
    }

    this.cache.delete(key);

    this.emitEvent({
      type: "invalidation",
      timestamp: Date.now(),
      strategy,
      trigger: this.getTriggerFromStrategy(strategy),
      entriesAffected: 1,
      data: { key, reason },
    });
  }

  /**
   * Create invalidation entry for result
   */
  private createInvalidationEntry(
    entry: InternalCacheEntry,
    strategy: CacheInvalidationStrategy
  ): InvalidationEntry {
    return {
      key: entry.key,
      query: entry.query,
      reason: entry.invalidationReason || `Strategy: ${strategy}`,
      trigger: this.getTriggerFromStrategy(strategy),
      timestamp: Date.now(),
      wasPinned: entry.pinned,
      age: Date.now() - entry.createdAt,
      hitCount: entry.hitCount,
    };
  }

  /**
   * Map strategy to trigger
   */
  private getTriggerFromStrategy(
    strategy: CacheInvalidationStrategy
  ): CacheInvalidationTrigger {
    const triggerMap: Record<CacheInvalidationStrategy, CacheInvalidationTrigger> = {
      ttl: "time-expired",
      sliding: "time-expired",
      "semantic-drift": "semantic-threshold",
      manual: "manual-clear",
      tagged: "tag-invalidated",
      dependency: "dependency-changed",
      lru: "explicit-eviction",
      lfu: "explicit-eviction",
      fifo: "cache-full",
      adaptive: "explicit-eviction",
    };
    return triggerMap[strategy];
  }

  /**
   * Update invalidation statistics
   */
  private updateStats(
    strategy: CacheInvalidationStrategy,
    count: number,
    duration: number
  ): void {
    this.invalidationStats.totalInvalidations++;
    this.invalidationStats.invalidationsByStrategy[strategy] =
      (this.invalidationStats.invalidationsByStrategy[strategy] || 0) + count;
    this.invalidationStats.invalidationsByTrigger[this.getTriggerFromStrategy(strategy)] =
      (this.invalidationStats.invalidationsByTrigger[this.getTriggerFromStrategy(strategy)] || 0) + count;
    this.invalidationStats.totalInvalidationTime += duration;
    this.invalidationStats.avgInvalidationTime =
      this.invalidationStats.totalInvalidationTime / this.invalidationStats.totalInvalidations;
    this.invalidationStats.lastInvalidation = Date.now();
    this.invalidationStats.avgEntriesPerInvalidation =
      (this.invalidationStats.avgEntriesPerInvalidation *
        (this.invalidationStats.totalInvalidations - 1) +
        count) /
      this.invalidationStats.totalInvalidations;
  }

  /**
   * Create empty statistics
   */
  private createEmptyStats(): InvalidationStatistics {
    return {
      totalInvalidations: 0,
      invalidationsByStrategy: {
        ttl: 0,
        sliding: 0,
        "semantic-drift": 0,
        manual: 0,
        tagged: 0,
        dependency: 0,
        lru: 0,
        lfu: 0,
        fifo: 0,
        adaptive: 0,
      },
      invalidationsByTrigger: {
        "data-source-changed": 0,
        "user-action": 0,
        "time-expired": 0,
        "semantic-threshold": 0,
        "manual-clear": 0,
        "memory-pressure": 0,
        "dependency-changed": 0,
        "tag-invalidated": 0,
        "explicit-eviction": 0,
        "cache-full": 0,
      },
      avgEntriesPerInvalidation: 0,
      totalInvalidationTime: 0,
      avgInvalidationTime: 0,
      hitRateBefore: 0,
      hitRateAfter: 0,
      memoryFreed: 0,
      entriesPinned: 0,
      pendingInvalidations: 0,
      recentHistory: [],
    };
  }

  /**
   * Estimate size of cache entry
   */
  private estimateSize(query: string, result: unknown): number {
    const querySize = query.length * 2; // UTF-16
    const resultSize = JSON.stringify(result).length * 2;
    return querySize + resultSize + 200; // Overhead estimate
  }

  /**
   * Emit invalidation event
   */
  private emitEvent(event: CacheInvalidationEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in invalidation event listener:", error);
      }
    }

    // Add to history
    this.invalidationStats.recentHistory.push({
      strategy: event.strategy ?? 'ttl' as any,
      config: {} as any,
      count: event.entriesAffected,
      skipped: 0,
      examined: 0,
      duration: 0,
      dryRun: false,
      success: true,
    });

    // Keep history manageable
    if (this.invalidationStats.recentHistory.length > 100) {
      this.invalidationStats.recentHistory.shift();
    }
  }

  /**
   * Create evaluation context from current state
   */
  private async createEvaluationContext(): Promise<PolicyEvaluationContext> {
    return {
      cacheSize: this.cache.size,
      cacheMemoryUsage: this.calculateMemoryUsage(),
      cacheHitRate: 0.8, // Would come from actual cache stats
      timeSinceLastInvalidation: this.invalidationStats.lastInvalidation
        ? Date.now() - this.invalidationStats.lastInvalidation
        : Infinity,
      pendingInvalidations: 0,
      availableMemory: 1e9, // 1GB estimate
      systemLoad: 0.5,
    };
  }

  /**
   * Calculate total memory usage
   */
  private calculateMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Cleanup - clear all intervals
   */
  destroy(): void {
    for (const interval of this.autoApplyIntervals.values()) {
      clearInterval(interval);
    }
    this.autoApplyIntervals.clear();
    this.eventListeners.clear();
    this.cache.clear();
  }
}

/**
 * Default invalidation manager instance
 */
export function createInvalidationManager(): CacheInvalidationManager {
  return new CacheInvalidationManager();
}
