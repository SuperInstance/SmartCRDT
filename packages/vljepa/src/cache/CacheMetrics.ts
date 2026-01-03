/**
 * CacheMetrics - Performance monitoring and hit rate tracking
 *
 * Tracks comprehensive metrics for cache performance:
 * - Hit rate: L1, L2, L3, L4, overall
 * - Latency: Per cache level
 * - Size: Total cache size
 * - Evictions: Number of entries evicted
 * - Savings: Processing time and cost saved
 *
 * Target Metrics:
 * - L1 hit rate: 60%
 * - L2 hit rate: 20%
 * - L3 hit rate: 5%
 * - L4 hit rate: 0%
 * - Overall hit rate: 85%+
 *
 * @version 1.0.0
 */

// ============================================================================
// METRICS TYPES
// ============================================================================

/**
 * Per-level cache metrics
 */
export interface LevelMetrics {
  /** Number of hits */
  hits: number;
  /** Number of misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Min latency in milliseconds */
  minLatency: number;
  /** Max latency in milliseconds */
  maxLatency: number;
  /** Total data size in bytes */
  totalSize: number;
  /** Number of entries */
  entryCount: number;
  /** Number of evictions */
  evictions: number;
}

/**
 * Overall cache metrics
 */
export interface CacheMetrics {
  /** Per-level metrics */
  hitRate: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    overall: number;
  };
  /** Latency metrics */
  latency: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    overall: number;
  };
  /** Savings metrics */
  savings: {
    /** Total queries processed */
    totalQueries: number;
    /** Total cache hits */
    cacheHits: number;
    /** Total processing time saved (ms) */
    processingTimeSaved: number;
    /** Estimated cost saved (USD) */
    costSaved: number;
  };
  /** Size metrics */
  size: {
    /** L1 size in bytes */
    l1: number;
    /** L2 size in bytes */
    l2: number;
    /** L3 size in bytes */
    l3: number;
    /** Total size in bytes */
    total: number;
  };
  /** Eviction metrics */
  evictions: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    total: number;
  };
  /** Semantic hit metrics */
  semanticHits: {
    count: number;
    avgSimilarity: number;
    minSimilarity: number;
    maxSimilarity: number;
  };
}

/**
 * Metrics snapshot for time-series analysis
 */
export interface MetricsSnapshot {
  /** Timestamp of snapshot */
  timestamp: number;
  /** Metrics at this point in time */
  metrics: CacheMetrics;
}

/**
 * Cache metrics configuration
 */
export interface CacheMetricsConfig {
  /** Enable detailed metrics tracking */
  enabled: boolean;
  /** Snapshot interval in milliseconds */
  snapshotInterval: number;
  /** Maximum number of snapshots to keep */
  maxSnapshots: number;
  /** Cost per millisecond of processing (USD) */
  costPerMs: number;
  /** Enable console logging */
  enableLogging: boolean;
  /** Log level */
  logLevel: "debug" | "info" | "warn" | "error";
}

// ============================================================================
// LEVEL-SPECIFIC METRICS TRACKER
// ============================================================================

/**
 * Level-specific metrics tracker
 *
 * Tracks metrics for a single cache level.
 */
class LevelMetricsTracker {
  private hits: number = 0;
  private misses: number = 0;
  private latencies: number[] = [];
  private totalSize: number = 0;
  private entryCount: number = 0;
  private evictions: number = 0;

  constructor(private level: "l1" | "l2" | "l3" | "l4") {}

  /**
   * Record a cache hit
   */
  recordHit(latency: number): void {
    this.hits++;
    this.latencies.push(latency);

    // Keep only last 1000 latencies for memory efficiency
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(): void {
    this.misses++;
  }

  /**
   * Record eviction
   */
  recordEviction(): void {
    this.evictions++;
  }

  /**
   * Update size metrics
   */
  updateSize(size: number, entryCount: number): void {
    this.totalSize = size;
    this.entryCount = entryCount;
  }

  /**
   * Get metrics for this level
   */
  getMetrics(): LevelMetrics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    let avgLatency = 0;
    let minLatency = 0;
    let maxLatency = 0;

    if (this.latencies.length > 0) {
      avgLatency =
        this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
      minLatency = Math.min(...this.latencies);
      maxLatency = Math.max(...this.latencies);
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      avgLatency,
      minLatency,
      maxLatency,
      totalSize: this.totalSize,
      entryCount: this.entryCount,
      evictions: this.evictions,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.latencies = [];
    this.evictions = 0;
  }

  /**
   * Get hit count
   */
  getHits(): number {
    return this.hits;
  }

  /**
   * Get miss count
   */
  getMisses(): number {
    return this.misses;
  }
}

// ============================================================================
// SEMANTIC HIT TRACKER
// ============================================================================

/**
 * Semantic hit tracker
 *
 * Tracks semantic similarity hits.
 */
class SemanticHitTracker {
  private count: number = 0;
  private similarities: number[] = [];

  /**
   * Record semantic hit
   */
  recordHit(similarity: number): void {
    this.count++;
    this.similarities.push(similarity);

    // Keep only last 1000 similarities
    if (this.similarities.length > 1000) {
      this.similarities.shift();
    }
  }

  /**
   * Get semantic hit metrics
   */
  getMetrics(): CacheMetrics["semanticHits"] {
    if (this.similarities.length === 0) {
      return {
        count: 0,
        avgSimilarity: 0,
        minSimilarity: 0,
        maxSimilarity: 0,
      };
    }

    const avgSimilarity =
      this.similarities.reduce((a, b) => a + b, 0) / this.similarities.length;
    const minSimilarity = Math.min(...this.similarities);
    const maxSimilarity = Math.max(...this.similarities);

    return {
      count: this.count,
      avgSimilarity,
      minSimilarity,
      maxSimilarity,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.count = 0;
    this.similarities = [];
  }
}

// ============================================================================
// CACHE METRICS (Main Class)
// ============================================================================

/**
 * Cache Metrics Manager
 *
 * Tracks and reports comprehensive cache metrics.
 */
export class CacheMetrics {
  private config: CacheMetricsConfig;
  private levelTrackers: Map<"l1" | "l2" | "l3" | "l4", LevelMetricsTracker>;
  private semanticTracker: SemanticHitTracker;
  private snapshots: MetricsSnapshot[] = [];
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private processingTimeSaved: number = 0;

  constructor(config?: Partial<CacheMetricsConfig>) {
    this.config = {
      enabled: true,
      snapshotInterval: 60000, // 1 minute
      maxSnapshots: 100,
      costPerMs: 0.000001, // $1 per second (stub)
      enableLogging: false,
      logLevel: "info",
      ...config,
    };

    this.levelTrackers = new Map([
      ["l1", new LevelMetricsTracker("l1")],
      ["l2", new LevelMetricsTracker("l2")],
      ["l3", new LevelMetricsTracker("l3")],
      ["l4", new LevelMetricsTracker("l4")],
    ]);

    this.semanticTracker = new SemanticHitTracker();

    // Start snapshot timer if enabled
    if (this.config.enabled) {
      this.startSnapshotTimer();
    }
  }

  /**
   * Record cache hit
   */
  recordHit(level: "l1" | "l2" | "l3" | "l4", latency: number): void {
    if (!this.config.enabled) return;

    const tracker = this.levelTrackers.get(level);
    if (tracker) {
      tracker.recordHit(latency);
      this.processingTimeSaved += latency;
    }

    this.log(
      "debug",
      `[CacheMetrics] Hit on ${level} (${latency.toFixed(2)}ms)`
    );
  }

  /**
   * Record cache miss
   */
  recordMiss(level: "l1" | "l2" | "l3" | "l4"): void {
    if (!this.config.enabled) return;

    const tracker = this.levelTrackers.get(level);
    if (tracker) {
      tracker.recordMiss();
    }

    this.log("debug", `[CacheMetrics] Miss on ${level}`);
  }

  /**
   * Record semantic hit
   */
  recordSemanticHit(similarity: number): void {
    if (!this.config.enabled) return;

    this.semanticTracker.recordHit(similarity);
    this.log("debug", `[CacheMetrics] Semantic hit (${similarity.toFixed(3)})`);
  }

  /**
   * Record eviction
   */
  recordEviction(level: "l1" | "l2" | "l3" | "l4"): void {
    if (!this.config.enabled) return;

    const tracker = this.levelTrackers.get(level);
    if (tracker) {
      tracker.recordEviction();
    }

    this.log("debug", `[CacheMetrics] Eviction on ${level}`);
  }

  /**
   * Update size metrics
   */
  updateSize(
    level: "l1" | "l2" | "l3" | "l4",
    size: number,
    entryCount: number
  ): void {
    if (!this.config.enabled) return;

    const tracker = this.levelTrackers.get(level);
    if (tracker) {
      tracker.updateSize(size, entryCount);
    }
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): CacheMetrics {
    const l1 = this.levelTrackers.get("l1")?.getMetrics();
    const l2 = this.levelTrackers.get("l2")?.getMetrics();
    const l3 = this.levelTrackers.get("l3")?.getMetrics();
    const l4 = this.levelTrackers.get("l4")?.getMetrics();

    if (!l1 || !l2 || !l3 || !l4) {
      throw new Error("Missing level tracker");
    }

    // Calculate overall hit rate
    const totalHits = l1.hits + l2.hits + l3.hits + l4.hits;
    const totalMisses = l1.misses + l2.misses + l3.misses + l4.misses;
    const totalQueries = totalHits + totalMisses;
    const overallHitRate = totalQueries > 0 ? totalHits / totalQueries : 0;

    // Calculate overall latency
    const allLatencies = [
      ...Array(l1.hits).fill(l1.avgLatency),
      ...Array(l2.hits).fill(l2.avgLatency),
      ...Array(l3.hits).fill(l3.avgLatency),
      ...Array(l4.hits).fill(l4.avgLatency),
    ];
    const overallLatency =
      allLatencies.length > 0
        ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
        : 0;

    return {
      hitRate: {
        l1: l1.hitRate,
        l2: l2.hitRate,
        l3: l3.hitRate,
        l4: l4.hitRate,
        overall: overallHitRate,
      },
      latency: {
        l1: l1.avgLatency,
        l2: l2.avgLatency,
        l3: l3.avgLatency,
        l4: l4.avgLatency,
        overall: overallLatency,
      },
      savings: {
        totalQueries,
        cacheHits: totalHits,
        processingTimeSaved: this.processingTimeSaved,
        costSaved: this.processingTimeSaved * this.config.costPerMs,
      },
      size: {
        l1: l1.totalSize,
        l2: l2.totalSize,
        l3: l3.totalSize,
        total: l1.totalSize + l2.totalSize + l3.totalSize,
      },
      evictions: {
        l1: l1.evictions,
        l2: l2.evictions,
        l3: l3.evictions,
        l4: l4.evictions,
        total: l1.evictions + l2.evictions + l3.evictions + l4.evictions,
      },
      semanticHits: this.semanticTracker.getMetrics(),
    };
  }

  /**
   * Get metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
    };
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MetricsSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const tracker of this.levelTrackers.values()) {
      tracker.reset();
    }
    this.semanticTracker.reset();
    this.processingTimeSaved = 0;
    this.snapshots = [];
  }

  /**
   * Get target achievement status
   */
  getTargetStatus(): {
    l1: { target: number; current: number; achieved: boolean };
    l2: { target: number; current: number; achieved: boolean };
    l3: { target: number; current: number; achieved: boolean };
    l4: { target: number; current: number; achieved: boolean };
    overall: { target: number; current: number; achieved: boolean };
  } {
    const metrics = this.getMetrics();

    return {
      l1: {
        target: 0.6,
        current: metrics.hitRate.l1,
        achieved: metrics.hitRate.l1 >= 0.6,
      },
      l2: {
        target: 0.2,
        current: metrics.hitRate.l2,
        achieved: metrics.hitRate.l2 >= 0.2,
      },
      l3: {
        target: 0.05,
        current: metrics.hitRate.l3,
        achieved: metrics.hitRate.l3 >= 0.05,
      },
      l4: {
        target: 0.0,
        current: metrics.hitRate.l4,
        achieved: metrics.hitRate.l4 >= 0.0,
      },
      overall: {
        target: 0.85,
        current: metrics.hitRate.overall,
        achieved: metrics.hitRate.overall >= 0.85,
      },
    };
  }

  /**
   * Print metrics report
   */
  printReport(): void {
    const metrics = this.getMetrics();
    const targets = this.getTargetStatus();

    console.log("\n=== Cache Metrics Report ===");
    console.log("\nHit Rates:");
    console.log(
      `  L1 (Memory):  ${(metrics.hitRate.l1 * 100).toFixed(1)}% (target: 60%) ${targets.l1.achieved ? "✓" : "✗"}`
    );
    console.log(
      `  L2 (IndexedDB): ${(metrics.hitRate.l2 * 100).toFixed(1)}% (target: 20%) ${targets.l2.achieved ? "✓" : "✗"}`
    );
    console.log(
      `  L3 (Redis):    ${(metrics.hitRate.l3 * 100).toFixed(1)}% (target: 5%) ${targets.l3.achieved ? "✓" : "✗"}`
    );
    console.log(
      `  L4 (Cloud):    ${(metrics.hitRate.l4 * 100).toFixed(1)}% (target: 0%) ${targets.l4.achieved ? "✓" : "✗"}`
    );
    console.log(
      `  Overall:       ${(metrics.hitRate.overall * 100).toFixed(1)}% (target: 85%) ${targets.overall.achieved ? "✓" : "✗"}`
    );

    console.log("\nLatency:");
    console.log(`  L1: ${metrics.latency.l1.toFixed(2)}ms`);
    console.log(`  L2: ${metrics.latency.l2.toFixed(2)}ms`);
    console.log(`  L3: ${metrics.latency.l3.toFixed(2)}ms`);
    console.log(`  L4: ${metrics.latency.l4.toFixed(2)}ms`);
    console.log(`  Overall: ${metrics.latency.overall.toFixed(2)}ms`);

    console.log("\nSavings:");
    console.log(`  Total Queries: ${metrics.savings.totalQueries}`);
    console.log(`  Cache Hits: ${metrics.savings.cacheHits}`);
    console.log(
      `  Time Saved: ${metrics.savings.processingTimeSaved.toFixed(0)}ms`
    );
    console.log(`  Cost Saved: $${metrics.savings.costSaved.toFixed(4)}`);

    console.log("\nSize:");
    console.log(`  L1: ${(metrics.size.l1 / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  L2: ${(metrics.size.l2 / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  L3: ${(metrics.size.l3 / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Total: ${(metrics.size.total / 1024 / 1024).toFixed(2)}MB`);

    console.log("\nEvictions:");
    console.log(`  L1: ${metrics.evictions.l1}`);
    console.log(`  L2: ${metrics.evictions.l2}`);
    console.log(`  L3: ${metrics.evictions.l3}`);
    console.log(`  Total: ${metrics.evictions.total}`);

    if (metrics.semanticHits.count > 0) {
      console.log("\nSemantic Hits:");
      console.log(`  Count: ${metrics.semanticHits.count}`);
      console.log(
        `  Avg Similarity: ${metrics.semanticHits.avgSimilarity.toFixed(3)}`
      );
      console.log(
        `  Min Similarity: ${metrics.semanticHits.minSimilarity.toFixed(3)}`
      );
      console.log(
        `  Max Similarity: ${metrics.semanticHits.maxSimilarity.toFixed(3)}`
      );
    }

    console.log("\n============================\n");
  }

  /**
   * Get configuration
   */
  getConfig(): CacheMetricsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CacheMetricsConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...updates };

    // Start or stop snapshot timer based on enabled state
    if (!wasEnabled && this.config.enabled) {
      this.startSnapshotTimer();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopSnapshotTimer();
    }
  }

  /**
   * Start snapshot timer
   */
  private startSnapshotTimer(): void {
    if (this.snapshotTimer) {
      return;
    }

    this.snapshotTimer = setInterval(() => {
      const snapshot = this.getSnapshot();
      this.snapshots.push(snapshot);

      // Trim snapshots if needed
      if (this.snapshots.length > this.config.maxSnapshots) {
        this.snapshots.shift();
      }
    }, this.config.snapshotInterval);
  }

  /**
   * Stop snapshot timer
   */
  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * Log message if enabled
   */
  private log(level: string, message: string): void {
    if (!this.config.enableLogging) return;

    const shouldLog =
      this.config.logLevel === "debug" ||
      (this.config.logLevel === "info" &&
        (level === "info" || level === "warn" || level === "error")) ||
      (this.config.logLevel === "warn" &&
        (level === "warn" || level === "error")) ||
      (this.config.logLevel === "error" && level === "error");

    if (shouldLog) {
      console.log(message);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopSnapshotTimer();
    this.reset();
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default cache metrics configuration
 */
export const DEFAULT_CACHE_METRICS_CONFIG: CacheMetricsConfig = {
  enabled: true,
  snapshotInterval: 60000, // 1 minute
  maxSnapshots: 100,
  costPerMs: 0.000001,
  enableLogging: false,
  logLevel: "info",
};

/**
 * Production cache metrics configuration
 */
export const PRODUCTION_CACHE_METRICS_CONFIG: CacheMetricsConfig = {
  enabled: true,
  snapshotInterval: 300000, // 5 minutes
  maxSnapshots: 288, // 24 hours at 5-minute intervals
  costPerMs: 0.000002, // $2 per second (estimated cloud cost)
  enableLogging: true,
  logLevel: "warn",
};

/**
 * Development cache metrics configuration
 */
export const DEVELOPMENT_CACHE_METRICS_CONFIG: CacheMetricsConfig = {
  enabled: true,
  snapshotInterval: 10000, // 10 seconds
  maxSnapshots: 60, // 10 minutes at 10-second intervals
  costPerMs: 0.000001,
  enableLogging: true,
  logLevel: "debug",
};
