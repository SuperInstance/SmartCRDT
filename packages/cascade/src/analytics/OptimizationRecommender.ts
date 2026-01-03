/**
 * OptimizationRecommender - ML-based cache optimization recommendations
 *
 * Analyzes cache metrics and generates actionable optimization recommendations
 * using rule-based and ML-based techniques.
 *
 * Features:
 * - Threshold optimization
 * - Cache size optimization
 * - TTL optimization
 * - Cache warming recommendations
 * - Eviction policy recommendations
 * - Priority-based ranking
 * - Expected improvement calculation
 * - Risk assessment
 */

import type {
  OptimizationRecommendation,
  OptimizationCategory,
  RecommendationPriority,
  OptimizationSummary,
  CacheMetricsSnapshot,
  Anomaly,
  EfficiencyScore,
} from "@lsi/protocol";

/**
 * Recommendation context for generation
 */
interface RecommendationContext {
  /** Current metrics snapshot */
  metrics: CacheMetricsSnapshot;
  /** Active anomalies */
  anomalies: Anomaly[];
  /** Current efficiency score */
  efficiency: EfficiencyScore;
  /** Historical data points */
  history: {
    hitRate: number[];
    memoryUsage: number[];
    latency: number[];
  };
}

/**
 * Optimization rule definition
 */
interface OptimizationRule {
  /** Rule identifier */
  id: string;
  /** Category */
  category: OptimizationCategory;
  /** Check if rule applies */
  check: (context: RecommendationContext) => boolean;
  /** Generate recommendation */
  generate: (context: RecommendationContext) => OptimizationRecommendation;
  /** Priority level */
  priority: RecommendationPriority;
}

/**
 * OptimizationRecommender - Intelligent cache optimization recommendations
 */
export class OptimizationRecommender {
  private rules: OptimizationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(context: RecommendationContext): OptimizationSummary {
    const recommendations: OptimizationRecommendation[] = [];

    // Apply all rules
    for (const rule of this.rules) {
      if (rule.check(context)) {
        recommendations.push(rule.generate(context));
      }
    }

    // Deduplicate and prioritize
    const uniqueRecommendations = this.deduplicate(recommendations);

    // Sort by priority and confidence
    const sorted = this.sortByPriority(uniqueRecommendations);

    // Count by category and priority
    const countByPriority: Partial<Record<RecommendationPriority, number>> = {};
    const countByCategory: Partial<Record<OptimizationCategory, number>> = {};

    for (const rec of sorted) {
      countByPriority[rec.priority] = (countByPriority[rec.priority] || 0) + 1;
      countByCategory[rec.category] = (countByCategory[rec.category] || 0) + 1;
    }

    // Calculate total potential improvement
    const totalPotentialImprovement = this.calculateTotalImprovement(sorted);

    // Identify quick wins
    const quickWins = sorted.filter(
      (r) =>
        (r.priority === "high" || r.priority === "urgent") &&
        (r.effort === "trivial" || r.effort === "easy")
    );

    return {
      recommendations: sorted,
      countByPriority,
      countByCategory,
      totalPotentialImprovement,
      quickWins,
      generatedAt: Date.now(),
    };
  }

  /**
   * Initialize optimization rules
   */
  private initializeRules(): void {
    // Hit rate optimization rules
    this.rules.push({
      id: "low_hit_rate_decrease_threshold",
      category: "threshold",
      check: (ctx) => ctx.metrics.hitRate.overall < 0.7,
      generate: (ctx) => this.generateDecreaseThreshold(ctx),
      priority: "urgent",
    });

    this.rules.push({
      id: "moderate_hit_rate_decrease_threshold",
      category: "threshold",
      check: (ctx) =>
        ctx.metrics.hitRate.overall >= 0.7 && ctx.metrics.hitRate.overall < 0.78,
      generate: (ctx) => this.generateModerateThresholdDecrease(ctx),
      priority: "high",
    });

    this.rules.push({
      id: "high_hit_rate_increase_threshold",
      category: "threshold",
      check: (ctx) =>
        ctx.metrics.hitRate.overall > 0.88 && ctx.metrics.similarity.average > 0.85,
      generate: (ctx) => this.generateIncreaseThreshold(ctx),
      priority: "low",
    });

    // Memory optimization rules
    this.rules.push({
      id: "high_memory_usage_reduce_size",
      category: "size",
      check: (ctx) => ctx.metrics.memory.usagePercent > 0.9,
      generate: (ctx) => this.generateReduceCacheSize(ctx),
      priority: "high",
    });

    this.rules.push({
      id: "memory_leak_increase_size",
      category: "size",
      check: (ctx) =>
        ctx.metrics.memory.trend === "growing" &&
        ctx.metrics.entries.evictionRate > 5,
      generate: (ctx) => this.generateIncreaseCacheSize(ctx),
      priority: "high",
    });

    this.rules.push({
      id: "underutilized_cache_increase_size",
      category: "size",
      check: (ctx) =>
        ctx.metrics.size / ctx.metrics.maxSize < 0.3 &&
        ctx.metrics.hitRate.overall < 0.75,
      generate: (ctx) => this.generateIncreaseSizeForHitRate(ctx),
      priority: "medium",
    });

    // TTL optimization rules
    this.rules.push({
      id: "high_eviction_increase_ttl",
      category: "ttl",
      check: (ctx) => ctx.metrics.entries.evictionRate > 10,
      generate: (ctx) => this.generateIncreaseTTL(ctx),
      priority: "high",
    });

    this.rules.push({
      id: "low_hit_rate_decrease_ttl",
      category: "ttl",
      check: (ctx) =>
        ctx.metrics.hitRate.overall < 0.7 &&
        ctx.metrics.entries.avgEntryAge > 24 * 60 * 60 * 1000,
      generate: (ctx) => this.generateDecreaseTTL(ctx),
      priority: "medium",
    });

    // Cache warming rules
    this.rules.push({
      id: "cold_start_warming",
      category: "warming",
      check: (ctx) =>
        ctx.metrics.hitRate.trend === "improving" &&
        ctx.metrics.patterns.repetitionRate > 0.3,
      generate: (ctx) => this.generateCacheWarming(ctx),
      priority: "medium",
    });

    this.rules.push({
      id: "low_repetition_warming",
      category: "warming",
      check: (ctx) =>
        ctx.metrics.patterns.repetitionRate < 0.2 &&
        ctx.metrics.hitRate.overall < 0.7,
      generate: (ctx) => this.generatePredictiveWarming(ctx),
      priority: "low",
    });

    // Eviction policy rules
    this.rules.push({
      id: "high_eviction_change_policy",
      category: "eviction",
      check: (ctx) => ctx.metrics.entries.evictionRate > 20,
      generate: (ctx) => this.generateEvictionPolicyChange(ctx),
      priority: "urgent",
    });

    // Prefetching rules
    this.rules.push({
      id: "high_repetition_prefetch",
      category: "prefetching",
      check: (ctx) =>
        ctx.metrics.patterns.repetitionRate > 0.5 &&
        ctx.metrics.hitRate.overall > 0.8,
      generate: (ctx) => this.generatePrefetching(ctx),
      priority: "low",
    });

    // Compression rules
    this.rules.push({
      id: "high_memory_compression",
      category: "compression",
      check: (ctx) =>
        ctx.metrics.memory.usagePercent > 0.8 &&
        ctx.metrics.memory.bytesPerEntry > 50_000,
      generate: (ctx) => this.generateCompression(ctx),
      priority: "medium",
    });

    // Monitoring rules
    this.rules.push({
      id: "anomaly_detected_monitoring",
      category: "monitoring",
      check: (ctx) =>
        ctx.anomalies.some((a) => a.severity === "critical" || a.severity === "high"),
      generate: (ctx) => this.generateEnhancedMonitoring(ctx),
      priority: "high",
    });
  }

  /**
   * Generate decrease threshold recommendation
   */
  private generateDecreaseThreshold(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentThreshold = ctx.metrics.threshold;
    const newThreshold = Math.max(0.7, currentThreshold - 0.1);
    const hitRateImprovement = 0.15;

    return {
      id: `rec_decrease_threshold_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "urgent",
      category: "threshold",
      title: "Significantly Decrease Similarity Threshold",
      description: `Hit rate is critically low (${(ctx.metrics.hitRate.overall * 100).toFixed(1)}%). Decreasing the similarity threshold will increase cache hits at the cost of precision.`,
      currentState: `Threshold: ${currentThreshold.toFixed(3)}, Hit rate: ${(ctx.metrics.hitRate.overall * 100).toFixed(1)}%`,
      recommendedState: `Threshold: ${newThreshold.toFixed(3)}, Expected hit rate: ${((ctx.metrics.hitRate.overall + hitRateImprovement) * 100).toFixed(1)}%`,
      expectedImprovement: {
        hitRateImprovement,
        latencyImprovement: 0.2,
      },
      action: `Set similarity threshold to ${newThreshold.toFixed(3)}`,
      effort: "trivial",
      risk: 0.3,
      confidence: 0.9,
      evidence: [
        {
          metric: "hitRate",
          currentValue: ctx.metrics.hitRate.overall,
          targetValue: 0.78,
          reason: "Hit rate is below minimum acceptable threshold",
        },
        {
          metric: "similarity",
          currentValue: ctx.metrics.similarity.average,
          targetValue: newThreshold,
          reason: "Similarity scores suggest threshold can be lowered",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate moderate threshold decrease
   */
  private generateModerateThresholdDecrease(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentThreshold = ctx.metrics.threshold;
    const newThreshold = Math.max(0.75, currentThreshold - 0.05);
    const hitRateImprovement = 0.08;

    return {
      id: `rec_mod_decrease_threshold_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "high",
      category: "threshold",
      title: "Moderately Decrease Similarity Threshold",
      description: `Hit rate is below target (${(ctx.metrics.hitRate.overall * 100).toFixed(1)}%). A moderate decrease in threshold should improve hit rate while maintaining acceptable precision.`,
      currentState: `Threshold: ${currentThreshold.toFixed(3)}`,
      recommendedState: `Threshold: ${newThreshold.toFixed(3)}`,
      expectedImprovement: {
        hitRateImprovement,
        latencyImprovement: 0.1,
      },
      action: `Set similarity threshold to ${newThreshold.toFixed(3)}`,
      effort: "trivial",
      risk: 0.2,
      confidence: 0.85,
      evidence: [
        {
          metric: "hitRate",
          currentValue: ctx.metrics.hitRate.overall,
          targetValue: 0.78,
          reason: "Hit rate is below 78% target",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate increase threshold recommendation
   */
  private generateIncreaseThreshold(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentThreshold = ctx.metrics.threshold;
    const newThreshold = Math.min(0.95, currentThreshold + 0.02);
    const hitRateChange = -0.05;

    return {
      id: `rec_increase_threshold_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "low",
      category: "threshold",
      title: "Slightly Increase Similarity Threshold",
      description: `Hit rate is excellent (${(ctx.metrics.hitRate.overall * 100).toFixed(1)}%). Increasing threshold will improve result quality with minimal hit rate impact.`,
      currentState: `Threshold: ${currentThreshold.toFixed(3)}`,
      recommendedState: `Threshold: ${newThreshold.toFixed(3)}`,
      expectedImprovement: {
        hitRateImprovement: hitRateChange,
        efficiencyImprovement: 0.05,
      },
      action: `Set similarity threshold to ${newThreshold.toFixed(3)}`,
      effort: "trivial",
      risk: 0.1,
      confidence: 0.75,
      evidence: [
        {
          metric: "hitRate",
          currentValue: ctx.metrics.hitRate.overall,
          targetValue: 0.85,
          reason: "High hit rate allows for quality optimization",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate reduce cache size recommendation
   */
  private generateReduceCacheSize(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentSize = ctx.metrics.maxSize;
    const newSize = Math.floor(currentSize * 0.7);

    return {
      id: `rec_reduce_cache_size_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "high",
      category: "size",
      title: "Reduce Cache Size",
      description: `Cache is using ${(ctx.metrics.memory.usagePercent * 100).toFixed(1)}% of available memory. Reducing cache size will free memory while maintaining performance.`,
      currentState: `Max size: ${currentSize} entries`,
      recommendedState: `Max size: ${newSize} entries`,
      expectedImprovement: {
        memoryImprovement: 0.3,
        latencyImprovement: 0.05,
      },
      action: `Set max cache size to ${newSize}`,
      effort: "easy",
      risk: 0.2,
      confidence: 0.8,
      evidence: [
        {
          metric: "memoryUsage",
          currentValue: ctx.metrics.memory.usagePercent,
          targetValue: 0.7,
          reason: "Memory usage is too high",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate increase cache size recommendation
   */
  private generateIncreaseCacheSize(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentSize = ctx.metrics.maxSize;
    const newSize = Math.floor(currentSize * 1.5);

    return {
      id: `rec_increase_cache_size_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "high",
      category: "size",
      title: "Increase Cache Size",
      description: `Cache is experiencing high eviction rate (${ctx.metrics.entries.evictionRate.toFixed(1)}/s). Increasing cache size will reduce evictions and improve hit rate.`,
      currentState: `Max size: ${currentSize} entries`,
      recommendedState: `Max size: ${newSize} entries`,
      expectedImprovement: {
        hitRateImprovement: 0.1,
        latencyImprovement: 0.15,
      },
      action: `Set max cache size to ${newSize}`,
      effort: "easy",
      risk: 0.15,
      confidence: 0.85,
      evidence: [
        {
          metric: "evictionRate",
          currentValue: ctx.metrics.entries.evictionRate,
          targetValue: 1,
          reason: "High eviction rate indicates cache is too small",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate increase size for hit rate
   */
  private generateIncreaseSizeForHitRate(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const currentSize = ctx.metrics.maxSize;
    const utilization = ctx.metrics.size / ctx.metrics.maxSize;
    const newSize = Math.floor(currentSize * 2);

    return {
      id: `rec_increase_size_hitrate_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "medium",
      category: "size",
      title: "Increase Cache Size to Improve Hit Rate",
      description: `Cache is underutilized (${(utilization * 100).toFixed(1)}% full) but hit rate is low. Increasing cache size may help capture more queries.`,
      currentState: `Max size: ${currentSize}, Utilization: ${(utilization * 100).toFixed(1)}%`,
      recommendedState: `Max size: ${newSize}`,
      expectedImprovement: {
        hitRateImprovement: 0.08,
      },
      action: `Set max cache size to ${newSize}`,
      effort: "easy",
      risk: 0.1,
      confidence: 0.7,
      evidence: [
        {
          metric: "cacheUtilization",
          currentValue: utilization,
          targetValue: 0.6,
          reason: "Cache has room to grow",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate increase TTL recommendation
   */
  private generateIncreaseTTL(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_increase_ttl_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "high",
      category: "ttl",
      title: "Increase Entry TTL",
      description: `High eviction rate (${ctx.metrics.entries.evictionRate.toFixed(1)}/s) suggests entries are expiring too quickly. Increasing TTL will keep entries longer.`,
      currentState: "Current TTL: 24 hours",
      recommendedState: "Recommended TTL: 48 hours",
      expectedImprovement: {
        hitRateImprovement: 0.12,
        latencyImprovement: 0.1,
      },
      action: "Increase cache entry TTL to 48 hours",
      effort: "trivial",
      risk: 0.15,
      confidence: 0.8,
      evidence: [
        {
          metric: "evictionRate",
          currentValue: ctx.metrics.entries.evictionRate,
          targetValue: 2,
          reason: "High eviction rate indicates TTL may be too short",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate decrease TTL recommendation
   */
  private generateDecreaseTTL(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_decrease_ttl_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "medium",
      category: "ttl",
      title: "Decrease Entry TTL",
      description: `Old entries are degrading cache quality. Decreasing TTL will ensure fresher data.`,
      currentState: "Current TTL: 24 hours",
      recommendedState: "Recommended TTL: 12 hours",
      expectedImprovement: {
        efficiencyImprovement: 0.1,
      },
      action: "Decrease cache entry TTL to 12 hours",
      effort: "trivial",
      risk: 0.2,
      confidence: 0.7,
      evidence: [
        {
          metric: "avgEntryAge",
          currentValue: ctx.metrics.entries.avgEntryAge,
          targetValue: 12 * 60 * 60 * 1000,
          reason: "Entries are older than optimal",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: true,
    };
  }

  /**
   * Generate cache warming recommendation
   */
  private generateCacheWarming(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_cache_warming_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "medium",
      category: "warming",
      title: "Implement Static Cache Warming",
      description: `Cache hit rate is improving with ${(ctx.metrics.patterns.repetitionRate * 100).toFixed(1)}% query repetition. Static cache warming will preload common queries.`,
      currentState: "No cache warming configured",
      recommendedState: "Static warming with top 100 queries",
      expectedImprovement: {
        hitRateImprovement: 0.15,
        latencyImprovement: 0.2,
      },
      action: "Configure static cache warming with top 100 frequent queries",
      effort: "moderate",
      risk: 0.1,
      confidence: 0.85,
      evidence: [
        {
          metric: "repetitionRate",
          currentValue: ctx.metrics.patterns.repetitionRate,
          targetValue: 0.4,
          reason: "High query repetition makes warming effective",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Generate predictive warming recommendation
   */
  private generatePredictiveWarming(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_predictive_warming_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "low",
      category: "warming",
      title: "Implement Predictive Cache Warming",
      description: `Low query repetition (${(ctx.metrics.patterns.repetitionRate * 100).toFixed(1)}%) suggests predictive warming could help anticipate queries.`,
      currentState: "No predictive warming configured",
      recommendedState: "Markov chain or neural predictive warming",
      expectedImprovement: {
        hitRateImprovement: 0.1,
      },
      action: "Implement predictive cache warming using query patterns",
      effort: "significant",
      risk: 0.3,
      confidence: 0.6,
      evidence: [
        {
          metric: "repetitionRate",
          currentValue: ctx.metrics.patterns.repetitionRate,
          targetValue: 0.3,
          reason: "Low repetition benefits from prediction",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Generate eviction policy change recommendation
   */
  private generateEvictionPolicyChange(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_eviction_policy_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "urgent",
      category: "eviction",
      title: "Change Eviction Policy to LFU",
      description: `Critical eviction storm (${ctx.metrics.entries.evictionRate.toFixed(1)}/s). LFU (Least Frequently Used) may perform better than current LRU policy.`,
      currentState: "Current policy: LRU (Least Recently Used)",
      recommendedState: "Recommended policy: LFU (Least Frequently Used)",
      expectedImprovement: {
        hitRateImprovement: 0.15,
        latencyImprovement: 0.2,
      },
      action: "Change cache eviction policy from LRU to LFU",
      effort: "moderate",
      risk: 0.25,
      confidence: 0.75,
      evidence: [
        {
          metric: "evictionRate",
          currentValue: ctx.metrics.entries.evictionRate,
          targetValue: 2,
          reason: "LRU is causing eviction storm",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Generate prefetching recommendation
   */
  private generatePrefetching(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_prefetching_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "low",
      category: "prefetching",
      title: "Implement Query Prefetching",
      description: `High query repetition (${(ctx.metrics.patterns.repetitionRate * 100).toFixed(1)}%) makes prefetching effective. Predict and prefetch likely queries.`,
      currentState: "No prefetching configured",
      recommendedState: "Pattern-based prefetching",
      expectedImprovement: {
        latencyImprovement: 0.3,
        hitRateImprovement: 0.1,
      },
      action: "Implement query prefetching based on pattern analysis",
      effort: "significant",
      risk: 0.2,
      confidence: 0.7,
      evidence: [
        {
          metric: "repetitionRate",
          currentValue: ctx.metrics.patterns.repetitionRate,
          targetValue: 0.5,
          reason: "Very high repetition enables effective prefetching",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Generate compression recommendation
   */
  private generateCompression(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    return {
      id: `rec_compression_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "medium",
      category: "compression",
      title: "Enable Entry Compression",
      description: `Large entry size (${(ctx.metrics.memory.bytesPerEntry / 1024).toFixed(1)} KB) and high memory usage (${(ctx.metrics.memory.usagePercent * 100).toFixed(1)}%). Compression will reduce memory footprint.`,
      currentState: "No compression enabled",
      recommendedState: "LZ4 or Zstd compression for embeddings",
      expectedImprovement: {
        memoryImprovement: 0.4,
        latencyImprovement: -0.05,
      },
      action: "Enable compression for cache entries",
      effort: "moderate",
      risk: 0.2,
      confidence: 0.8,
      evidence: [
        {
          metric: "bytesPerEntry",
          currentValue: ctx.metrics.memory.bytesPerEntry,
          targetValue: 30_000,
          reason: "Entry size is large, compression effective",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Generate enhanced monitoring recommendation
   */
  private generateEnhancedMonitoring(
    ctx: RecommendationContext
  ): OptimizationRecommendation {
    const criticalCount = ctx.anomalies.filter(
      (a) => a.severity === "critical"
    ).length;
    const highCount = ctx.anomalies.filter((a) => a.severity === "high").length;

    return {
      id: `rec_enhanced_monitoring_${Date.now()}`,
      generatedAt: Date.now(),
      priority: "high",
      category: "monitoring",
      title: "Enable Enhanced Monitoring and Alerting",
      description: `${criticalCount} critical and ${highCount} high-severity anomalies detected. Enhanced monitoring will provide faster detection and response.`,
      currentState: "Standard monitoring",
      recommendedState: "Enhanced monitoring with real-time alerts",
      expectedImprovement: {
        efficiencyImprovement: 0.1,
      },
      action: "Configure real-time anomaly alerts and dashboard",
      effort: "easy",
      risk: 0.05,
      confidence: 0.95,
      evidence: [
        {
          metric: "activeAnomalies",
          currentValue: ctx.anomalies.length,
          targetValue: 0,
          reason: "Active anomalies require enhanced monitoring",
        },
      ],
      relatedRecommendations: [],
      autoApplicable: false,
    };
  }

  /**
   * Deduplicate recommendations by category
   */
  private deduplicate(
    recommendations: OptimizationRecommendation[]
  ): OptimizationRecommendation[] {
    const byCategory = new Map<OptimizationCategory, OptimizationRecommendation>();

    for (const rec of recommendations) {
      const existing = byCategory.get(rec.category);
      if (!existing || rec.priority === "urgent" || rec.confidence > existing.confidence) {
        byCategory.set(rec.category, rec);
      }
    }

    return Array.from(byCategory.values());
  }

  /**
   * Sort recommendations by priority and confidence
   */
  private sortByPriority(
    recommendations: OptimizationRecommendation[]
  ): OptimizationRecommendation[] {
    const priorityOrder = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // Same priority, sort by confidence descending
      return b.confidence - a.confidence;
    });
  }

  /**
   * Calculate total potential improvement
   */
  private calculateTotalImprovement(
    recommendations: OptimizationRecommendation[]
  ): {
    hitRate: number;
    latency: number;
    memory: number;
  } {
    let hitRate = 0;
    let latency = 0;
    let memory = 0;

    for (const rec of recommendations) {
      if (rec.expectedImprovement.hitRateImprovement) {
        hitRate += rec.expectedImprovement.hitRateImprovement;
      }
      if (rec.expectedImprovement.latencyImprovement) {
        latency += rec.expectedImprovement.latencyImprovement;
      }
      if (rec.expectedImprovement.memoryImprovement) {
        memory += rec.expectedImprovement.memoryImprovement;
      }
    }

    // Cap improvements at reasonable values
    return {
      hitRate: Math.min(1, hitRate),
      latency: Math.min(1, latency),
      memory: Math.min(1, memory),
    };
  }
}
