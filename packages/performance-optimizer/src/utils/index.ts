/**
 * Performance Optimization Utilities
 *
 * Helper functions for performance analysis and optimization:
 * - Performance calculation utilities
 * - Format conversion utilities
 * - Validation helpers
 * - Statistical analysis functions
 */

import type {
  Bottleneck,
  OptimizationSuggestion,
  PerformanceReport,
  BenchmarkResult,
  LatencyMetrics,
  MemoryMetrics,
  CpuMetrics
} from "../types/index.js";

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format milliseconds to human readable string
 */
export function formatMilliseconds(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

/**
 * Format percentage with precision
 */
export function formatPercentage(value: number, precision: number = 1): string {
  return `${value.toFixed(precision)}%`;
}

/**
 * Calculate performance score from metrics
 */
export function calculatePerformanceScore(
  cpuMetrics: CpuMetrics,
  memoryMetrics: MemoryMetrics,
  latencyMetrics: LatencyMetrics,
  errorRate: number = 0
): number {
  // Calculate component scores (0-100)
  const cpuScore = Math.max(0, 100 - cpuMetrics.usage);
  const memoryScore = Math.max(0, 100 - (memoryMetrics.heapUsed / memoryMetrics.heapTotal) * 100);
  const latencyScore = Math.max(0, 100 - (latencyMetrics.p95 / 1000) * 100); // Assuming 1000ms is bad
  const errorScore = Math.max(0, 100 - errorRate * 100);

  // Weighted average (latency is most important)
  const weights = {
    cpu: 0.2,
    memory: 0.2,
    latency: 0.5,
    errors: 0.1
  };

  return Math.min(100, Math.max(0,
    cpuScore * weights.cpu +
    memoryScore * weights.memory +
    latencyScore * weights.latency +
    errorScore * weights.errors
  ));
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovement(
  current: number,
  baseline: number
): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

/**
 * Calculate throughput (operations per second)
 */
export function calculateThroughput(
  operations: number,
  durationMs: number
): number {
  if (durationMs === 0) return 0;
  return (operations / durationMs) * 1000;
}

/**
 * Standard deviation calculation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate percentiles from sorted array
 */
export function calculatePercentiles(sortedValues: number[], percentiles: number[] = [50, 90, 95, 99]): number[] {
  return percentiles.map(p => {
    const index = Math.floor((p / 100) * sortedValues.length);
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  });
}

/**
 * Check if value is within threshold range
 */
export function isWithinThreshold(
  value: number,
  warningThreshold: number,
  criticalThreshold: number,
  isLowerBetter: boolean = false
): 'normal' | 'warning' | 'critical' {
  if (isLowerBetter) {
    if (value < criticalThreshold) return 'critical';
    if (value < warningThreshold) return 'warning';
  } else {
    if (value > criticalThreshold) return 'critical';
    if (value > warningThreshold) return 'warning';
  }
  return 'normal';
}

/**
 * Generate a unique ID for performance reports
 */
export function generateReportId(): string {
  return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone performance metrics
 */
export function cloneMetrics(metrics: any): any {
  return JSON.parse(JSON.stringify(metrics));
}

/**
 * Convert milliseconds to human readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const end = i + 1;
    const window = values.slice(start, end);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }

  return result;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: number[]): number[] {
  if (values.length < 4) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return values.filter(value => value < lowerBound || value > upperBound);
}

/**
 * Calculate correlation coefficient between two arrays
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate exponential moving average
 */
export function calculateEMA(values: number[], alpha: number = 0.2): number[] {
  if (values.length === 0) return [];

  const ema: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
  }

  return ema;
}

/**
 * Normalize values to 0-1 range
 */
export function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 0.5);

  return values.map(value => (value - min) / range);
}

/**
 * Convert performance metrics to chart-friendly format
 */
export function formatForChart(
  metrics: Array<{
    timestamp: number;
    value: number;
    label?: string;
  }>
): {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
} {
  const sorted = [...metrics].sort((a, b) => a.timestamp - b.timestamp);
  const labels = sorted.map(m => new Date(m.timestamp).toLocaleTimeString());
  const data = sorted.map(m => m.value);

  return {
    labels,
    datasets: [{
      label: metrics[0]?.label || 'Value',
      data,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)'
    }]
  };
}

/**
 * Performance event aggregator
 */
export class PerformanceEventAggregator {
  private events: Array<{
    timestamp: number;
    type: string;
    data: any;
  }> = [];
  private maxEvents: number = 1000;

  addEvent(type: string, data: any): void {
    this.events.push({
      timestamp: Date.now(),
      type,
      data
    });

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getEvents(type?: string): Array<{
    timestamp: number;
    type: string;
    data: any;
  }> {
    if (!type) return [...this.events];

    return this.events.filter(event => event.type === type);
  }

  clearEvents(): void {
    this.events = [];
  }

  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    this.events.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });

    return counts;
  }
}

/**
 * Performance threshold checker
 */
export class PerformanceThresholdChecker {
  private thresholds: Map<string, {
    warning: number;
    critical: number;
    isLowerBetter: boolean;
  }> = new Map();

  addThreshold(
    metric: string,
    warning: number,
    critical: number,
    isLowerBetter: boolean = false
  ): void {
    this.thresholds.set(metric, { warning, critical, isLowerBetter });
  }

  checkMetric(
    metric: string,
    value: number
  ): 'normal' | 'warning' | 'critical' {
    const threshold = this.thresholds.get(metric);
    if (!threshold) return 'normal';

    return isWithinThreshold(
      value,
      threshold.warning,
      threshold.critical,
      threshold.isLowerBetter
    );
  }

  checkAllMetrics(metrics: Record<string, number>): Array<{
    metric: string;
    value: number;
    status: 'normal' | 'warning' | 'critical';
  }> {
    const results: Array<{
      metric: string;
      value: number;
      status: 'normal' | 'warning' | 'critical';
    }> = [];

    for (const [metric, value] of Object.entries(metrics)) {
      results.push({
        metric,
        value,
        status: this.checkMetric(metric, value)
      });
    }

    return results;
  }
}