/**
 * Bottleneck Detection System
 *
 * Advanced algorithms for detecting performance bottlenecks:
 * - Statistical anomaly detection
 * - Trend analysis
 * - Correlation analysis
 * - Root cause identification
 */

import type { Bottleneck, CpuMetrics, MemoryMetrics, LatencyMetrics } from "../types/index.js";

export class BottleneckDetector {
  private sensitivity: number = 5; // 1-10 scale
  private history: Array<{
    timestamp: number;
    bottlenecks: Bottleneck[];
    metrics: any;
  }> = [];

  /**
   * Configure detection sensitivity
   */
  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(1, Math.min(10, sensitivity));
  }

  /**
   * Detect bottlenecks from performance metrics
   */
  detectBottlenecks(
    cpuMetrics: CpuMetrics | null,
    memoryMetrics: MemoryMetrics | null,
    latencyMetrics: LatencyMetrics | null,
    additionalMetrics?: Record<string, number>
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Detect CPU bottlenecks
    if (cpuMetrics) {
      const cpuBottlenecks = this.detectCpuBottlenecks(cpuMetrics);
      bottlenecks.push(...cpuBottlenecks);
    }

    // Detect memory bottlenecks
    if (memoryMetrics) {
      const memoryBottlenecks = this.detectMemoryBottlenecks(memoryMetrics);
      bottlenecks.push(...memoryBottlenecks);
    }

    // Detect latency bottlenecks
    if (latencyMetrics) {
      const latencyBottlenecks = this.detectLatencyBottlenecks(latencyMetrics);
      bottlenecks.push(...latencyBottlenecks);
    }

    // Detect I/O bottlenecks (if metrics available)
    if (additionalMetrics) {
      const ioBottlenecks = this.detectIoBottlenecks(additionalMetrics);
      bottlenecks.push(...ioBottlenecks);
    }

    // Store detection result
    this.history.push({
      timestamp: Date.now(),
      bottlenecks,
      metrics: {
        cpu: cpuMetrics,
        memory: memoryMetrics,
        latency: latencyMetrics,
        ...additionalMetrics
      }
    });

    // Keep history limited
    if (this.history.length > 100) {
      this.history.shift();
    }

    return bottlenecks;
  }

  /**
   * Detect CPU-related bottlenecks
   */
  private detectCpuBottlenecks(metrics: CpuMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const threshold = 80 - (this.sensitivity * 5); // Lower sensitivity = higher threshold

    // High CPU usage
    if (metrics.usage > 95) {
      bottlenecks.push({
        type: 'cpu',
        severity: 10,
        description: 'CPU usage at critical level (>95%)',
        impact: 0.9,
        confidence: 0.95,
        metrics: { usage: metrics.usage },
        duration: this.calculateBottleneckDuration('cpu', 'usage', metrics.usage)
      });
    } else if (metrics.usage > threshold) {
      bottlenecks.push({
        type: 'cpu',
        severity: Math.floor((metrics.usage - threshold) / 95 * 10),
        description: `High CPU usage detected (${metrics.usage.toFixed(1)}%)`,
        impact: metrics.usage / 100,
        confidence: 0.8,
        metrics: { usage: metrics.usage },
        duration: this.calculateBottleneckDuration('cpu', 'usage', metrics.usage)
      });
    }

    // CPU spikes
    if (metrics.spikes.length > 0) {
      const spikeImpact = metrics.spikes.reduce((sum, spike) =>
        sum + (spike.usage > 90 ? spike.duration : 0), 0) / 1000;

      bottlenecks.push({
        type: 'cpu',
        severity: Math.min(10, spikeImpact * 10),
        description: `${metrics.spikes.length} CPU spike${metrics.spikes.length > 1 ? 's' : ''} detected`,
        impact: Math.min(0.8, spikeImpact),
        confidence: 0.7,
        metrics: { spikeCount: metrics.spikes.length, spikeImpact },
        duration: spikeImpact
      });
    }

    // Unbalanced CPU time
    const breakdown = metrics.breakdown;
    const maxTime = Math.max(breakdown.user, breakdown.system, breakdown.idle, breakdown.iowait);
    const minTime = Math.min(breakdown.user, breakdown.system, breakdown.idle, breakdown.iowait);

    if (maxTime > 60 && minTime < 5) {
      const inefficientProcess = breakdown.user > breakdown.system ? 'user space' : 'kernel space';

      bottlenecks.push({
        type: 'cpu',
        severity: Math.floor((maxTime - minTime) / 100 * 10),
        description: `Unbalanced CPU time (${inefficientProcess} dominating)`,
        impact: (maxTime - minTime) / 100,
        confidence: 0.6,
        metrics: { timeDistribution: breakdown },
        duration: (maxTime - minTime) / 1000
      });
    }

    return bottlenecks;
  }

  /**
   * Detect memory-related bottlenecks
   */
  private detectMemoryBottlenecks(metrics: MemoryMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const heapUsagePercent = (metrics.heapUsed / metrics.heapTotal) * 100;
    const threshold = 85 - (this.sensitivity * 5);

    // High memory usage
    if (heapUsagePercent > 95) {
      bottlenecks.push({
        type: 'memory',
        severity: 10,
        description: 'Memory usage at critical level (>95%)',
        impact: 0.9,
        confidence: 0.95,
        metrics: { heapUsagePercent, heapUsed: metrics.heapUsed, heapTotal: metrics.heapTotal },
        duration: this.calculateBottleneckDuration('memory', 'heapUsagePercent', heapUsagePercent)
      });
    } else if (heapUsagePercent > threshold) {
      bottlenecks.push({
        type: 'memory',
        severity: Math.floor((heapUsagePercent - threshold) / 95 * 10),
        description: `High memory usage detected (${heapUsagePercent.toFixed(1)}%)`,
        impact: heapUsagePercent / 100,
        confidence: 0.8,
        metrics: { heapUsagePercent, heapUsed: metrics.heapUsed },
        duration: this.calculateBottleneckDuration('memory', 'heapUsagePercent', heapUsagePercent)
      });
    }

    // Memory leak detection
    if (metrics.leak?.suspected) {
      bottlenecks.push({
        type: 'memory',
        severity: Math.min(10, metrics.leak.ratePerMinute),
        description: `Memory leak detected (${metrics.leak.ratePerMinute.toFixed(2)} MB/min)`,
        impact: Math.min(0.9, metrics.leak.ratePerMinute / 10),
        confidence: 0.7,
        metrics: {
          leakRate: metrics.leak.ratePerMinute,
          totalGrowth: metrics.leak.totalGrowth
        },
        duration: metrics.leak.totalGrowth > 0 ? metrics.leak.totalGrowth : undefined
      });
    }

    // External memory growth
    if (metrics.external > 100) { // > 100MB
      bottlenecks.push({
        type: 'memory',
        severity: Math.min(8, metrics.external / 20),
        description: `High external memory usage (${metrics.external.toFixed(1)} MB)`,
        impact: Math.min(0.6, metrics.external / 200),
        confidence: 0.6,
        metrics: { external: metrics.external }
      });
    }

    return bottlenecks;
  }

  /**
   * Detect latency-related bottlenecks
   */
  private detectLatencyBottlenecks(metrics: LatencyMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const p99Threshold = 500; // 500ms P99 threshold
    const p95Threshold = 200; // 200ms P95 threshold

    // High latency
    if (metrics.p99 > p99Threshold) {
      bottlenecks.push({
        type: 'io',
        severity: Math.min(10, (metrics.p99 - p99Threshold) / 100),
        description: `High P99 latency (${metrics.p99.toFixed(1)}ms)`,
        impact: Math.min(0.9, metrics.p99 / 1000),
        confidence: 0.9,
        metrics: { p99: metrics.p99, p95: metrics.p95 },
        duration: this.calculateBottleneckDuration('latency', 'p99', metrics.p99)
      });
    } else if (metrics.p95 > p95Threshold) {
      bottlenecks.push({
        type: 'io',
        severity: Math.min(8, (metrics.p95 - p95Threshold) / 50),
        description: `High P95 latency (${metrics.p95.toFixed(1)}ms)`,
        impact: Math.min(0.7, metrics.p95 / 500),
        confidence: 0.8,
        metrics: { p95: metrics.p95, p50: metrics.p50 },
        duration: this.calculateBottleneckDuration('latency', 'p95', metrics.p95)
      });
    }

    // High latency variance
    if (metrics.stdDev > metrics.p50 * 0.5) {
      bottlenecks.push({
        type: 'io',
        severity: Math.min(7, metrics.stdDev / 100),
        description: `High latency variance (stdDev: ${metrics.stdDev.toFixed(1)}ms)`,
        impact: Math.min(0.6, metrics.stdDev / 500),
        confidence: 0.7,
        metrics: { stdDev: metrics.stdDev, p50: metrics.p50 }
      });
    }

    // Queue time dominance
    const breakdown = metrics.breakdown;
    const totalLatency = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (totalLatency > 0) {
      const queuePercent = breakdown.queue / totalLatency;
      if (queuePercent > 0.5) {
        bottlenecks.push({
          type: 'io',
          severity: Math.floor(queuePercent * 10),
          description: `Queue time dominates latency (${(queuePercent * 100).toFixed(1)}%)`,
          impact: queuePercent,
          confidence: 0.8,
          metrics: { queuePercent, queueTime: breakdown.queue }
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Detect I/O bottlenecks from additional metrics
   */
  private detectIoBottlenecks(metrics: Record<string, number>): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // High I/O wait
    if (metrics.ioWait && metrics.ioWait > 20) {
      bottlenecks.push({
        type: 'io',
        severity: Math.min(8, metrics.ioWait / 10),
        description: `High I/O wait time (${metrics.ioWait.toFixed(1)}%)`,
        impact: metrics.ioWait / 100,
        confidence: 0.7,
        metrics: { ioWait: metrics.ioWait }
      });
    }

    // Disk latency
    if (metrics.diskLatency && metrics.diskLatency > 50) {
      bottlenecks.push({
        type: 'io',
        severity: Math.min(7, metrics.diskLatency / 10),
        description: `High disk latency (${metrics.diskLatency.toFixed(1)}ms)`,
        impact: Math.min(0.6, metrics.diskLatency / 100),
        confidence: 0.8,
        metrics: { diskLatency: metrics.diskLatency }
      });
    }

    // Network latency
    if (metrics.networkLatency && metrics.networkLatency > 100) {
      bottlenecks.push({
        type: 'network',
        severity: Math.min(8, metrics.networkLatency / 20),
        description: `High network latency (${metrics.networkLatency.toFixed(1)}ms)`,
        impact: Math.min(0.7, metrics.networkLatency / 1000),
        confidence: 0.8,
        metrics: { networkLatency: metrics.networkLatency }
      });
    }

    return bottlenecks;
  }

  /**
   * Calculate bottleneck duration based on trend analysis
   */
  private calculateBottleneckDuration(type: string, metric: string, value: number): number | undefined {
    if (this.history.length < 3) return undefined;

    const recent = this.history.slice(-3);
    const durations: number[] = [];

    for (const entry of recent) {
      const bottleneck = entry.bottlenecks.find(b =>
        b.type === type && b.metrics[metric] === value
      );

      if (bottleneck?.duration) {
        durations.push(bottleneck.duration);
      }
    }

    if (durations.length > 0) {
      return durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    return undefined;
  }

  /**
   * Perform trend analysis on bottleneck history
   */
  analyzeTrends(): {
    trends: Array<{
      type: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      rate: number;
      confidence: number;
    }>;
    recommendations: string[];
  } {
    if (this.history.length < 10) {
      return {
        trends: [],
        recommendations: ['Collect more data for trend analysis']
      };
    }

    const trends: Array<{
      type: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      rate: number;
      confidence: number;
    }> = [];

    // Analyze CPU trends
    const cpuTrend = this.analyzeMetricTrend('cpu', 'usage');
    if (cpuTrend) trends.push(cpuTrend);

    // Analyze memory trends
    const memoryTrend = this.analyzeMetricTrend('memory', 'heapUsagePercent');
    if (memoryTrend) trends.push(memoryTrend);

    // Analyze latency trends
    const latencyTrend = this.analyzeMetricTrend('latency', 'p95');
    if (latencyTrend) trends.push(latencyTrend);

    // Generate recommendations based on trends
    const recommendations: string[] = [];

    const increasingTrends = trends.filter(t => t.direction === 'increasing');
    if (increasingTrends.length > 0) {
      recommendations.push(`Detected ${increasingTrends.length} worsening trends. Consider scaling or optimization.`);
    }

    const stableTrends = trends.filter(t => t.direction === 'stable');
    if (stableTrends.some(t => t.rate > 80)) {
      recommendations.push('High stable values detected. Consider capacity planning.');
    }

    return {
      trends,
      recommendations
    };
  }

  /**
   * Analyze trend for a specific metric
   */
  private analyzeMetricTrend(metricType: string, metricName: string) {
    const values = this.history
      .slice(-10)
      .map(entry => entry.metrics[metricType]?.[metricName])
      .filter(v => v !== undefined) as number[];

    if (values.length < 3) return null;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const rate = ((secondAvg - firstAvg) / firstAvg) * 100;
    const confidence = Math.min(1, values.length / 10);

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(rate) > 5) {
      direction = rate > 0 ? 'increasing' : 'decreasing';
    }

    return {
      type: metricName,
      direction,
      rate,
      confidence
    };
  }

  /**
   * Get bottleneck history
   */
  getHistory(): Array<{
    timestamp: number;
    bottlenecks: Bottleneck[];
    metrics: any;
  }> {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }
}