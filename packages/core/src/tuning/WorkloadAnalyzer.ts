/**
 * @lsi/core/tuning - WorkloadAnalyzer for Aequor Cognitive Orchestration Platform
 *
 * The WorkloadAnalyzer analyzes query patterns to:
 * - Detect workload types (interactive, batch, periodic, burst, steady)
 * - Identify temporal patterns (time of day, day of week)
 * - Predict future workload
 * - Provide insights for parameter tuning
 */

import { QueryHistory } from "./AutoTuner.js";

/**
 * Workload type classification
 */
export type WorkloadType =
  | "interactive" // Low latency, random queries
  | "batch" // High throughput, sequential
  | "periodic" // Regular intervals
  | "burst" // Sudden spikes
  | "steady"; // Constant rate

/**
 * Workload pattern
 */
export interface WorkloadPattern {
  /** Pattern type */
  patternType: WorkloadType;

  // Temporal characteristics
  /** Hours when pattern is active (0-23) */
  timeOfDay: number[];
  /** Days when pattern is active (0-6, 0=Sunday) */
  dayOfWeek: number[];

  // Query characteristics
  /** Query types in this pattern */
  queryTypes: string[];
  /** Average complexity (0-1) */
  avgComplexity: number;
  /** Average query length */
  avgLength: number;

  // Performance characteristics
  /** Average latency in ms */
  avgLatency: number;
  /** Average throughput in req/s */
  avgThroughput: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  // Predictability
  /** How predictable this pattern is (0-1) */
  predictability: number;
}

/**
 * Burst information
 */
export interface BurstInfo {
  /** Burst start timestamp */
  startTime: number;
  /** Burst end timestamp */
  endTime: number;
  /** Queries per second */
  intensity: number;
  /** Burst duration in ms */
  duration: number;
}

/**
 * Workload prediction
 */
export interface WorkloadPrediction {
  /** Predicted workload type */
  predictedType: WorkloadType;
  /** Predicted throughput in req/s */
  predictedThroughput: number;
  /** Predicted latency in ms */
  predictedLatency: number;
  /** Confidence in prediction (0-1) */
  confidence: number;

  /** Prediction time window */
  timeWindow: {
    start: number;
    end: number;
  };
}

/**
 * Current workload state
 */
export interface WorkloadState {
  /** Current workload type */
  currentType: WorkloadType;
  /** Current throughput in req/s */
  throughput: number;
  /** Average latency in ms */
  avgLatency: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  /** Trend direction */
  trend: "increasing" | "stable" | "decreasing";

  /** Detected pattern if any */
  detectedPattern?: WorkloadPattern;
}

/**
 * Default analyzer configuration
 */
export interface WorkloadAnalyzerConfig {
  /** Window size for pattern detection (number of queries) */
  patternWindowSize: number;
  /** Burst detection threshold (multiplier of average rate) */
  burstThreshold: number;
  /** Minimum burst duration in ms */
  minBurstDuration: number;
  /** Prediction horizon in ms */
  predictionHorizon: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WorkloadAnalyzerConfig = {
  patternWindowSize: 100,
  burstThreshold: 2.0,
  minBurstDuration: 5000,
  predictionHorizon: 60000, // 1 minute
};

/**
 * WorkloadAnalyzer - Analyzes workload patterns for auto-tuning
 *
 * The WorkloadAnalyzer examines query history to detect patterns,
 * classify workload types, and predict future behavior.
 */
export class WorkloadAnalyzer {
  private currentState: WorkloadState;
  private detectedPatterns: WorkloadPattern[] = [];

  constructor(private config: WorkloadAnalyzerConfig = DEFAULT_CONFIG) {
    this.currentState = this.createInitialState();
  }

  /**
   * Analyze workload from recent history
   */
  async analyze(
    history: QueryHistory[],
    windowSize: number
  ): Promise<WorkloadPattern[]> {
    if (history.length === 0) {
      return [];
    }

    const window = history.slice(-windowSize);
    const pattern = await this.detectPattern(window);

    // Update current state
    this.currentState.currentType = pattern.patternType;
    this.currentState.throughput = this.calculateThroughput(window);
    this.currentState.avgLatency = pattern.avgLatency;
    this.currentState.cacheHitRate = pattern.cacheHitRate;
    this.currentState.detectedPattern = pattern;

    // Update trend
    this.currentState.trend = this.detectTrend(history);

    // Store pattern
    this.detectedPatterns = [...this.detectedPatterns, pattern].slice(-10);

    return [pattern];
  }

  /**
   * Detect workload type from query history
   */
  private detectWorkloadType(history: QueryHistory[]): WorkloadType {
    if (history.length < 10) {
      return "steady";
    }

    const throughput = this.calculateThroughput(history);
    const variance = this.calculateVariance(history.map(h => h.latency));
    const bursts = this.detectBursts(history);

    // Classification logic
    if (bursts.length > 0) {
      return "burst";
    }

    if (variance < 50 && throughput > 100) {
      return "batch";
    }

    if (this.isPeriodic(history)) {
      return "periodic";
    }

    if (throughput < 10) {
      return "interactive";
    }

    return "steady";
  }

  /**
   * Detect pattern from query history
   */
  private async detectPattern(
    history: QueryHistory[]
  ): Promise<WorkloadPattern> {
    const patternType = this.detectWorkloadType(history);

    // Temporal characteristics
    const timestamps = history.map(h => h.timestamp);
    const dates = timestamps.map(t => new Date(t));
    const hours = dates.map(d => d.getHours());
    const days = dates.map(d => d.getDay());

    const timeOfDay = this.getMostFrequent(hours);
    const dayOfWeek = this.getMostFrequent(days);

    // Query characteristics
    const queryTypes = [...new Set(history.map(h => h.queryType))];
    const avgComplexity =
      history.reduce((sum, h) => sum + h.complexity, 0) / history.length;
    const avgLength =
      history.reduce((sum, h) => sum + h.length, 0) / history.length;

    // Performance characteristics
    const latencies = history.map(h => h.latency);
    const avgLatency =
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const throughput = this.calculateThroughput(history);
    const cacheHits = history.filter(h => h.cacheHit).length;
    const cacheHitRate = cacheHits / history.length;

    // Predictability based on variance and periodicity
    const latencyVariance = this.calculateVariance(latencies);
    const predictability = Math.max(0, 1 - latencyVariance / avgLatency);

    return {
      patternType,
      timeOfDay,
      dayOfWeek,
      queryTypes,
      avgComplexity,
      avgLength,
      avgLatency,
      avgThroughput: throughput,
      cacheHitRate,
      predictability: Math.min(1, predictability),
    };
  }

  /**
   * Detect periodic patterns in query history
   */
  private detectPeriodicPatterns(history: QueryHistory[]): number[] {
    if (history.length < 20) {
      return [];
    }

    const intervals: number[] = [];
    const timestamps = history.map(h => h.timestamp).sort((a, b) => a - b);

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Find common intervals using histogram
    const intervalGroups = new Map<number, number>();

    for (const interval of intervals) {
      // Group into 1-second buckets
      const bucket = Math.round(interval / 1000) * 1000;
      intervalGroups.set(bucket, (intervalGroups.get(bucket) || 0) + 1);
    }

    // Return intervals that appear frequently
    const threshold = intervals.length / 10;
    const periods: number[] = [];

    for (const [period, count] of intervalGroups.entries()) {
      if (count >= threshold && period > 1000) {
        periods.push(period);
      }
    }

    return periods;
  }

  /**
   * Detect burst patterns
   */
  private detectBursts(history: QueryHistory[]): BurstInfo[] {
    if (history.length < 10) {
      return [];
    }

    const bursts: BurstInfo[] = [];
    const timestamps = history.map(h => h.timestamp).sort((a, b) => a - b);

    // Calculate moving average of query rate
    const windowSize = 10;
    const rates: number[] = [];

    for (let i = windowSize; i < timestamps.length; i++) {
      const windowStart = timestamps[i - windowSize];
      const windowEnd = timestamps[i];
      const duration = windowEnd - windowStart;

      if (duration > 0) {
        rates.push((windowSize / duration) * 1000);
      }
    }

    if (rates.length === 0) {
      return [];
    }

    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const threshold = avgRate * this.config.burstThreshold;

    // Find periods above threshold
    let inBurst = false;
    let burstStart = 0;

    for (let i = 0; i < rates.length; i++) {
      if (!inBurst && rates[i] > threshold) {
        inBurst = true;
        burstStart = timestamps[i];
      } else if (inBurst && rates[i] <= threshold) {
        inBurst = false;
        const burstEnd = timestamps[i];
        const duration = burstEnd - burstStart;

        if (duration >= this.config.minBurstDuration) {
          bursts.push({
            startTime: burstStart,
            endTime: burstEnd,
            intensity: rates[i],
            duration,
          });
        }
      }
    }

    return bursts;
  }

  /**
   * Predict future workload
   */
  async predict(
    patterns: WorkloadPattern[],
    horizon: number = this.config.predictionHorizon
  ): Promise<WorkloadPrediction> {
    if (patterns.length === 0) {
      return {
        predictedType: "steady",
        predictedThroughput: 50,
        predictedLatency: 100,
        confidence: 0.3,
        timeWindow: {
          start: Date.now(),
          end: Date.now() + horizon,
        },
      };
    }

    // Use most recent pattern
    const recent = patterns[patterns.length - 1];

    // Extrapolate based on pattern
    const predictedThroughput =
      recent.avgThroughput * (1 + (Math.random() - 0.5) * 0.2);
    const predictedLatency =
      recent.avgLatency * (1 + (Math.random() - 0.5) * 0.1);

    // Confidence based on predictability and pattern consistency
    let confidence = recent.predictability;

    if (patterns.length > 1) {
      const prev = patterns[patterns.length - 2];
      const typeConsistency = prev.patternType === recent.patternType ? 1 : 0.5;
      confidence = confidence * 0.7 + typeConsistency * 0.3;
    }

    return {
      predictedType: recent.patternType,
      predictedThroughput,
      predictedLatency,
      confidence: Math.min(1, Math.max(0, confidence)),
      timeWindow: {
        start: Date.now(),
        end: Date.now() + horizon,
      },
    };
  }

  /**
   * Get current workload state
   */
  getCurrentState(): WorkloadState {
    return { ...this.currentState };
  }

  /**
   * Check if workload is periodic
   */
  private isPeriodic(history: QueryHistory[]): boolean {
    const periods = this.detectPeriodicPatterns(history);
    return periods.length > 0;
  }

  /**
   * Calculate throughput from query history
   */
  private calculateThroughput(history: QueryHistory[]): number {
    if (history.length < 2) {
      return 0;
    }

    const timestamps = history.map(h => h.timestamp).sort((a, b) => a - b);
    const duration = timestamps[timestamps.length - 1] - timestamps[0];

    if (duration === 0) {
      return 0;
    }

    return (history.length / duration) * 1000; // queries per second
  }

  /**
   * Calculate variance of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  /**
   * Get most frequent values
   */
  private getMostFrequent(values: number[]): number[] {
    const frequency = new Map<number, number>();

    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }

    const maxFreq = Math.max(...frequency.values());
    const result: number[] = [];

    for (const [value, freq] of frequency.entries()) {
      if (freq === maxFreq) {
        result.push(value);
      }
    }

    return result;
  }

  /**
   * Detect trend in workload
   */
  private detectTrend(
    history: QueryHistory[]
  ): "increasing" | "stable" | "decreasing" {
    if (history.length < 20) {
      return "stable";
    }

    // Split into two halves
    const mid = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, mid);
    const secondHalf = history.slice(mid);

    const firstRate = this.calculateThroughput(firstHalf);
    const secondRate = this.calculateThroughput(secondHalf);

    const change = (secondRate - firstRate) / (firstRate || 1);

    if (change > 0.1) {
      return "increasing";
    } else if (change < -0.1) {
      return "decreasing";
    }

    return "stable";
  }

  /**
   * Create initial state
   */
  private createInitialState(): WorkloadState {
    return {
      currentType: "steady",
      throughput: 0,
      avgLatency: 100,
      cacheHitRate: 0,
      trend: "stable",
    };
  }
}

/**
 * Create a WorkloadAnalyzer with default configuration
 */
export function createWorkloadAnalyzer(
  config?: Partial<WorkloadAnalyzerConfig>
): WorkloadAnalyzer {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return new WorkloadAnalyzer(mergedConfig);
}
