/**
 * PatternLearner - Learn query patterns from historical data
 *
 * Analyzes query logs to identify patterns that can be used for
 * proactive cache warming. Implements multiple learning techniques:
 *
 * 1. Frequency analysis - Most common queries
 * 2. Temporal analysis - Time-based patterns
 * 3. Semantic clustering - Similar query groups
 * 4. Sequential patterns - Query sequences
 * 5. Domain extraction - Topic-based patterns
 *
 * Example:
 * ```ts
 * const learner = new PatternLearner({
 *   minFrequency: 0.1,
 *   similarityThreshold: 0.85,
 *   maxPatterns: 100,
 * });
 * const result = await learner.learnFromLogs(queryLogs);
 * console.log(`Learned ${result.patternCount} patterns`);
 * ```
 */

import type {
  QueryPattern,
  PatternCluster,
  PatternLearningResult,
  QueryLogEntry,
  PatternLearnerConfig,
} from "@lsi/protocol";
import { QueryRefiner } from "../refiner/QueryRefiner.js";
import type { QueryRefinerConfig } from "../refiner/QueryRefiner.js";

/**
 * Pattern frequency map
 */
interface PatternFrequency {
  pattern: string;
  count: number;
  totalQueries: number;
  frequency: number;
  lastSeen: number;
  queryTypes: Set<string>;
  examples: string[];
}

/**
 * Temporal bucket for time-based analysis
 */
interface TemporalBucket {
  timeRange: { start: number; end: number };
  queries: string[];
  patterns: Map<string, number>;
}

/**
 * Sequential pattern for Markov prediction
 */
interface SequentialPattern {
  previousQueries: string[];
  nextQuery: string;
  confidence: number;
}

/**
 * PatternLearner - Learn query patterns for cache warming
 */
export class PatternLearner {
  private config: Required<PatternLearnerConfig>;
  private queryRefiner: QueryRefiner;
  private patternCache: Map<string, QueryPattern> = new Map();
  private clusterCache: Map<string, PatternCluster> = new Map();
  private sequentialPatterns: SequentialPattern[] = [];

  constructor(config: Partial<PatternLearnerConfig> = {}) {
    this.config = {
      minFrequency: config.minFrequency ?? 0.05,
      similarityThreshold: config.similarityThreshold ?? 0.85,
      maxPatterns: config.maxPatterns ?? 100,
      enableTemporalAnalysis: config.enableTemporalAnalysis ?? true,
      timeWindow: config.timeWindow ?? 3600000, // 1 hour
      enableClustering: config.enableClustering ?? true,
      maxClusters: config.maxClusters ?? 10,
    };

    // Initialize query refiner for semantic analysis
    const refinerConfig: Partial<QueryRefinerConfig> = {
      enableSemantic: true,
    };
    this.queryRefiner = new QueryRefiner(refinerConfig);
  }

  /**
   * Learn patterns from query logs
   *
   * Analyzes historical query logs to extract patterns that can be used
   * for proactive cache warming.
   *
   * @param queryLogs - Array of query log entries
   * @returns Pattern learning result
   */
  async learnFromLogs(queryLogs: QueryLogEntry[]): Promise<PatternLearningResult> {
    const startTime = Date.now();

    // Clear previous learning
    this.patternCache.clear();
    this.clusterCache.clear();
    this.sequentialPatterns = [];

    // Step 1: Frequency analysis
    const frequencyPatterns = await this.analyzeFrequency(queryLogs);

    // Step 2: Temporal analysis (if enabled)
    if (this.config.enableTemporalAnalysis) {
      const temporalPatterns = await this.analyzeTemporal(queryLogs);
      this.mergePatterns(temporalPatterns);
    }

    // Step 3: Sequential pattern analysis
    const sequentialPatterns = await this.analyzeSequential(queryLogs);
    this.sequentialPatterns = sequentialPatterns;

    // Step 4: Semantic clustering (if enabled)
    if (this.config.enableClustering) {
      await this.clusterPatterns();
    }

    const duration = Date.now() - startTime;

    // Convert to array and sort by frequency
    const topPatterns = Array.from(this.patternCache.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);

    return {
      patternCount: this.patternCache.size,
      clusterCount: this.clusterCache.size,
      duration,
      topPatterns,
    };
  }

  /**
   * Analyze frequency patterns
   *
   * Extracts patterns based on query frequency in the logs.
   *
   * @param queryLogs - Query log entries
   * @returns Map of pattern to frequency
   */
  private async analyzeFrequency(
    queryLogs: QueryLogEntry[]
  ): Promise<Map<string, PatternFrequency>> {
    const patternMap = new Map<string, PatternFrequency>();
    const totalQueries = queryLogs.length;

    for (const log of queryLogs) {
      // Normalize query to create pattern
      const pattern = this.normalizeToPattern(log.query);

      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, {
          pattern,
          count: 0,
          totalQueries,
          frequency: 0,
          lastSeen: 0,
          queryTypes: new Set(),
          examples: [],
        });
      }

      const entry = patternMap.get(pattern)!;
      entry.count++;
      entry.lastSeen = Math.max(entry.lastSeen, log.timestamp);
      if (log.queryType) {
        entry.queryTypes.add(log.queryType);
      }
      if (entry.examples.length < 5) {
        entry.examples.push(log.query);
      }
    }

    // Calculate frequencies and filter by minimum
    const validPatterns = new Map<string, PatternFrequency>();
    for (const [key, value] of patternMap.entries()) {
      value.frequency = value.count / totalQueries;
      if (value.frequency >= this.config.minFrequency) {
        validPatterns.set(key, value);
      }
    }

    // Convert to QueryPattern and cache
    for (const [key, value] of validPatterns.entries()) {
      this.patternCache.set(key, {
        pattern: value.pattern,
        frequency: value.frequency,
        avgSimilarity: 1.0, // Exact match
        lastSeen: value.lastSeen,
        queryTypes: Array.from(value.queryTypes),
        examples: value.examples,
      });
    }

    return validPatterns;
  }

  /**
   * Analyze temporal patterns
   *
   * Extracts patterns based on time-based query clustering.
   *
   * @param queryLogs - Query log entries
   * @returns Map of pattern to frequency
   */
  private async analyzeTemporal(
    queryLogs: QueryLogEntry[]
  ): Promise<Map<string, PatternFrequency>> {
    // Group queries into time buckets
    const buckets = this.createTimeBuckets(queryLogs);

    // Analyze patterns in each bucket
    const temporalPatternMap = new Map<string, PatternFrequency>();

    for (const bucket of buckets) {
      for (const query of bucket.queries) {
        const pattern = this.normalizeToPattern(query);

        if (!temporalPatternMap.has(pattern)) {
          temporalPatternMap.set(pattern, {
            pattern,
            count: 0,
            totalQueries: queryLogs.length,
            frequency: 0,
            lastSeen: bucket.timeRange.end,
            queryTypes: new Set(),
            examples: [],
          });
        }

        const entry = temporalPatternMap.get(pattern)!;
        entry.count++;
        if (entry.examples.length < 3 && !entry.examples.includes(query)) {
          entry.examples.push(query);
        }
      }
    }

    // Calculate frequencies
    for (const value of temporalPatternMap.values()) {
      value.frequency = value.count / value.totalQueries;
    }

    return temporalPatternMap;
  }

  /**
   * Analyze sequential patterns
   *
   * Identifies query sequences using Markov chain analysis.
   *
   * @param queryLogs - Query log entries
   * @returns Array of sequential patterns
   */
  private async analyzeSequential(
    queryLogs: QueryLogEntry[]
  ): Promise<SequentialPattern[]> {
    const sequences: SequentialPattern[] = [];
    const sessionMap = new Map<string, QueryLogEntry[]>();

    // Group by session
    for (const log of queryLogs) {
      if (!sessionMap.has(log.sessionId)) {
        sessionMap.set(log.sessionId, []);
      }
      sessionMap.get(log.sessionId)!.push(log);
    }

    // Extract sequences from each session
    for (const [sessionId, sessionLogs] of sessionMap.entries()) {
      sessionLogs.sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sessionLogs.length - 1; i++) {
        const current = sessionLogs[i];
        const next = sessionLogs[i + 1];

        // Create sequence pattern
        const previousPattern = this.normalizeToPattern(current.query);
        const nextPattern = this.normalizeToPattern(next.query);

        sequences.push({
          previousQueries: [previousPattern],
          nextQuery: nextPattern,
          confidence: 1, // Will be updated when counting
        });
      }
    }

    // Count and score sequences
    const sequenceMap = new Map<string, SequentialPattern>();
    for (const seq of sequences) {
      const key = `${seq.previousQueries.join(">")}:${seq.nextQuery}`;
      if (!sequenceMap.has(key)) {
        sequenceMap.set(key, seq);
      } else {
        const existing = sequenceMap.get(key)!;
        existing.confidence++;
      }
    }

    // Normalize confidences
    const maxConfidence = Math.max(
      ...Array.from(sequenceMap.values()).map(s => s.confidence)
    );

    for (const seq of sequenceMap.values()) {
      seq.confidence = seq.confidence / maxConfidence;
    }

    // Return top sequences
    return Array.from(sequenceMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPatterns);
  }

  /**
   * Cluster patterns semantically
   *
   * Groups similar patterns into clusters for better organization.
   */
  private async clusterPatterns(): Promise<void> {
    if (this.patternCache.size === 0) return;

    const patterns = Array.from(this.patternCache.values());
    const clusters: PatternCluster[] = [];

    // Simple clustering: group by similarity threshold
    const assigned = new Set<string>();

    for (const pattern of patterns) {
      if (assigned.has(pattern.pattern)) continue;

      // Create new cluster
      const cluster: PatternCluster = {
        id: `cluster_${clusters.length}`,
        patterns: [pattern],
        centroid: new Array(768).fill(0), // Placeholder for semantic centroid
        size: 1,
        priority: pattern.frequency,
      };

      assigned.add(pattern.pattern);

      // Find similar patterns
      for (const other of patterns) {
        if (assigned.has(other.pattern)) continue;

        const similarity = await this.calculateSimilarity(
          pattern.pattern,
          other.pattern
        );

        if (similarity >= this.config.similarityThreshold) {
          cluster.patterns.push(other);
          cluster.size++;
          cluster.priority += other.frequency;
          assigned.add(other.pattern);
        }

        if (cluster.size >= 10) break; // Max cluster size
      }

      // Normalize priority
      cluster.priority /= cluster.size;

      clusters.push(cluster);

      if (clusters.length >= this.config.maxClusters) break;
    }

    // Cache clusters
    for (const cluster of clusters) {
      this.clusterCache.set(cluster.id, cluster);
    }
  }

  /**
   * Create time buckets for temporal analysis
   *
   * @param queryLogs - Query log entries
   * @returns Array of time buckets
   */
  private createTimeBuckets(queryLogs: QueryLogEntry[]): TemporalBucket[] {
    if (queryLogs.length === 0) return [];

    const minTime = Math.min(...queryLogs.map(l => l.timestamp));
    const maxTime = Math.max(...queryLogs.map(l => l.timestamp));

    const buckets: TemporalBucket[] = [];
    const windowSize = this.config.timeWindow;

    let currentStart = minTime;
    while (currentStart < maxTime) {
      const currentEnd = currentStart + windowSize;

      const bucket: TemporalBucket = {
        timeRange: { start: currentStart, end: currentEnd },
        queries: [],
        patterns: new Map(),
      };

      // Add queries to bucket
      for (const log of queryLogs) {
        if (log.timestamp >= currentStart && log.timestamp < currentEnd) {
          bucket.queries.push(log.query);
        }
      }

      buckets.push(bucket);
      currentStart = currentEnd;
    }

    return buckets.filter(b => b.queries.length > 0);
  }

  /**
   * Normalize query to pattern
   *
   * Converts a specific query into a generalized pattern.
   *
   * @param query - Original query
   * @returns Normalized pattern
   */
  private normalizeToPattern(query: string): string {
    // Simple normalization: lowercase and remove specific values
    let pattern = query.toLowerCase().trim();

    // Replace numbers with placeholder
    pattern = pattern.replace(/\b\d+\b/g, "{n}");

    // Replace quoted strings with placeholder
    pattern = pattern.replace(/["'][^"']*["']/g, "{str}");

    // Remove extra whitespace
    pattern = pattern.replace(/\s+/g, " ");

    return pattern;
  }

  /**
   * Calculate semantic similarity between two patterns
   *
   * @param pattern1 - First pattern
   * @param pattern2 - Second pattern
   * @returns Similarity score (0-1)
   */
  private async calculateSimilarity(
    pattern1: string,
    pattern2: string
  ): Promise<number> {
    // Simple word overlap similarity for now
    const words1 = new Set(pattern1.split(" "));
    const words2 = new Set(pattern2.split(" "));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Merge patterns into cache
   *
   * @param patterns - Patterns to merge
   */
  private mergePatterns(patterns: Map<string, PatternFrequency>): void {
    for (const [key, value] of patterns.entries()) {
      if (this.patternCache.has(key)) {
        const existing = this.patternCache.get(key)!;
        existing.frequency = Math.max(existing.frequency, value.frequency);
        existing.lastSeen = Math.max(existing.lastSeen, value.lastSeen);
      } else {
        this.patternCache.set(key, {
          pattern: value.pattern,
          frequency: value.frequency,
          avgSimilarity: 1.0,
          lastSeen: value.lastSeen,
          queryTypes: Array.from(value.queryTypes),
          examples: value.examples,
        });
      }
    }
  }

  /**
   * Get learned patterns
   *
   * @returns Array of learned patterns
   */
  getPatterns(): QueryPattern[] {
    return Array.from(this.patternCache.values()).sort(
      (a, b) => b.frequency - a.frequency
    );
  }

  /**
   * Get pattern clusters
   *
   * @returns Array of pattern clusters
   */
  getClusters(): PatternCluster[] {
    return Array.from(this.clusterCache.values()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Get sequential patterns for prediction
   *
   * @returns Array of sequential patterns
   */
  getSequentialPatterns(): SequentialPattern[] {
    return this.sequentialPatterns;
  }

  /**
   * Predict next queries based on history
   *
   * @param recentQueries - Recent query history
   * @returns Predicted next queries
   */
  predictNextQueries(recentQueries: string[]): Array<{
    query: string;
    confidence: number;
  }> {
    const predictions: Array<{ query: string; confidence: number }> = [];

    // Normalize recent queries
    const normalized = recentQueries.map(q => this.normalizeToPattern(q));

    // Find matching sequential patterns
    for (const seq of this.sequentialPatterns) {
      if (seq.previousQueries.length === 0) continue;

      // Check if recent queries match pattern
      const match = normalized.some(q =>
        seq.previousQueries.some(p => p === q)
      );

      if (match) {
        predictions.push({
          query: seq.nextQuery,
          confidence: seq.confidence,
        });
      }
    }

    // Sort by confidence and return top predictions
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Clear learned patterns
   */
  clear(): void {
    this.patternCache.clear();
    this.clusterCache.clear();
    this.sequentialPatterns = [];
  }

  /**
   * Get learning statistics
   */
  getStats() {
    return {
      patternCount: this.patternCache.size,
      clusterCount: this.clusterCache.size,
      sequentialPatternCount: this.sequentialPatterns.length,
      avgPatternFrequency:
        Array.from(this.patternCache.values()).reduce(
          (sum, p) => sum + p.frequency,
          0
        ) / Math.max(this.patternCache.size, 1),
    };
  }
}

/**
 * Default pattern learner configuration
 */
export const DEFAULT_PATTERN_LEARNER_CONFIG: Partial<PatternLearnerConfig> = {
  minFrequency: 0.05,
  similarityThreshold: 0.85,
  maxPatterns: 100,
  enableTemporalAnalysis: true,
  timeWindow: 3600000, // 1 hour
  enableClustering: true,
  maxClusters: 10,
};
