/**
 * Performance Report - Comprehensive performance analysis and bottleneck identification
 *
 * Features:
 * - Aggregate performance metrics from all profilers
 * - Bottleneck identification and prioritization
 * - Optimization recommendations
 * - Trend analysis
 * - Report generation (HTML, JSON, Markdown)
 */

import { FlameGraph } from './FlameGraph.js';

/**
 * Performance metrics from different sources
 */
export interface PerformanceMetrics {
  cpu?: {
    totalSamples: number;
    averageLoad: number;
    peakLoad: number;
    hotFunctions: Array<{ name: string; time: number; percentage: number }>;
  };
  memory?: {
    totalSamples: number;
    averageHeapUsed: number;
    peakHeapUsed: number;
    heapUsageLimit: number;
    leakDetected: boolean;
  };
  io?: {
    networkRequests: number;
    fileOperations: number;
    databaseQueries: number;
    cacheHitRate: number;
    averageLatency: number;
  };
  async?: {
    totalOperations: number;
    resolutionRate: number;
    eventLoopLag: number;
    averageConcurrency: number;
  };
  cache?: {
    hitRate: number;
    missRate: number;
    averageLatency: number;
    totalSize: number;
  };
}

/**
 * Bottleneck severity
 */
export type BottleneckSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Bottleneck
 */
export interface Bottleneck {
  type: string;
  severity: BottleneckSeverity;
  category: 'cpu' | 'memory' | 'io' | 'async' | 'cache';
  description: string;
  location: string;
  impact: number; // 0-1
  metrics: any;
  recommendation: string;
  priority: number; // 1-10
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  title: string;
  description: string;
  category: string;
  estimatedImprovement: number; // percentage
  effort: 'low' | 'medium' | 'high';
  priority: number;
  steps: string[];
}

/**
 * Performance report
 */
export interface PerformanceReport {
  timestamp: number;
  duration: number;
  metrics: PerformanceMetrics;
  bottlenecks: Bottleneck[];
  recommendations: OptimizationRecommendation[];
  flameGraph?: FlameGraph;
  summary: {
    overallScore: number; // 0-100
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
}

/**
 * Performance report generator
 */
export class PerformanceReportGenerator {
  private metrics: PerformanceMetrics = {};
  private bottlenecks: Bottleneck[] = [];
  private flameGraph?: FlameGraph;
  private startTime = 0;
  private endTime = 0;

  /**
   * Start performance collection
   */
  start(): void {
    this.startTime = Date.now();
    this.metrics = {};
    this.bottlenecks = [];
  }

  /**
   * End performance collection
   */
  end(): void {
    this.endTime = Date.now();
  }

  /**
   * Add CPU metrics
   */
  addCPUMetrics(metrics: PerformanceMetrics['cpu']): void {
    this.metrics.cpu = metrics;
    this.analyzeCPUBottlenecks();
  }

  /**
   * Add memory metrics
   */
  addMemoryMetrics(metrics: PerformanceMetrics['memory']): void {
    this.metrics.memory = metrics;
    this.analyzeMemoryBottlenecks();
  }

  /**
   * Add I/O metrics
   */
  addIOMetrics(metrics: PerformanceMetrics['io']): void {
    this.metrics.io = metrics;
    this.analyzeIOBottlenecks();
  }

  /**
   * Add async metrics
   */
  addAsyncMetrics(metrics: PerformanceMetrics['async']): void {
    this.metrics.async = metrics;
    this.analyzeAsyncBottlenecks();
  }

  /**
   * Add cache metrics
   */
  addCacheMetrics(metrics: PerformanceMetrics['cache']): void {
    this.metrics.cache = metrics;
    this.analyzeCacheBottlenecks();
  }

  /**
   * Set flame graph
   */
  setFlameGraph(graph: FlameGraph): void {
    this.flameGraph = graph;
  }

  /**
   * Analyze CPU bottlenecks
   */
  private analyzeCPUBottlenecks(): void {
    if (!this.metrics.cpu) return;

    const { averageLoad, peakLoad, hotFunctions } = this.metrics.cpu;

    // High CPU usage
    if (averageLoad > 0.8) {
      this.bottlenecks.push({
        type: 'high-cpu-usage',
        severity: averageLoad > 0.95 ? 'critical' : 'high',
        category: 'cpu',
        description: `High average CPU usage: ${(averageLoad * 100).toFixed(1)}%`,
        location: 'cpu',
        impact: averageLoad,
        metrics: { averageLoad, peakLoad },
        recommendation: 'Identify and optimize CPU-intensive functions, consider offloading to worker threads',
        priority: 8,
      });
    }

    // Hot functions
    for (const func of hotFunctions.slice(0, 5)) {
      if (func.percentage > 10) {
        this.bottlenecks.push({
          type: 'hot-function',
          severity: func.percentage > 20 ? 'high' : 'medium',
          category: 'cpu',
          description: `Hot function detected: ${func.name} (${func.percentage.toFixed(1)}% of time)`,
          location: func.name,
          impact: func.percentage / 100,
          metrics: func,
          recommendation: `Optimize ${func.name}, consider caching or memoization`,
          priority: Math.ceil(func.percentage / 5),
        });
      }
    }
  }

  /**
   * Analyze memory bottlenecks
   */
  private analyzeMemoryBottlenecks(): void {
    if (!this.metrics.memory) return;

    const { averageHeapUsed, peakHeapUsed, heapUsageLimit, leakDetected } = this.metrics.memory;

    // High memory usage
    const usagePercent = peakHeapUsed / heapUsageLimit;
    if (usagePercent > 0.8) {
      this.bottlenecks.push({
        type: 'high-memory-usage',
        severity: usagePercent > 0.95 ? 'critical' : 'high',
        category: 'memory',
        description: `High memory usage: ${(usagePercent * 100).toFixed(1)}% of limit`,
        location: 'heap',
        impact: usagePercent,
        metrics: { peakHeapUsed, heapUsageLimit, usagePercent },
        recommendation: 'Identify memory leaks, optimize data structures, increase heap limit',
        priority: 9,
      });
    }

    // Memory leak
    if (leakDetected) {
      this.bottlenecks.push({
        type: 'memory-leak',
        severity: 'critical',
        category: 'memory',
        description: 'Potential memory leak detected',
        location: 'heap',
        impact: 1.0,
        metrics: { leakDetected },
        recommendation: 'Investigate memory allocation patterns, check for event listener leaks, close unused connections',
        priority: 10,
      });
    }
  }

  /**
   * Analyze I/O bottlenecks
   */
  private analyzeIOBottlenecks(): void {
    if (!this.metrics.io) return;

    const { cacheHitRate, averageLatency } = this.metrics.io;

    // Low cache hit rate
    if (cacheHitRate < 0.5) {
      this.bottlenecks.push({
        type: 'low-cache-hit-rate',
        severity: cacheHitRate < 0.3 ? 'high' : 'medium',
        category: 'cache',
        description: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
        location: 'cache',
        impact: 1 - cacheHitRate,
        metrics: { cacheHitRate },
        recommendation: 'Review cache key strategy, increase cache size, adjust TTL settings',
        priority: 6,
      });
    }

    // High I/O latency
    if (averageLatency > 500) {
      this.bottlenecks.push({
        type: 'high-io-latency',
        severity: averageLatency > 2000 ? 'critical' : 'high',
        category: 'io',
        description: `High I/O latency: ${averageLatency.toFixed(0)}ms average`,
        location: 'io-layer',
        impact: Math.min(1, averageLatency / 2000),
        metrics: { averageLatency },
        recommendation: 'Optimize database queries, use connection pooling, implement batching',
        priority: 7,
      });
    }
  }

  /**
   * Analyze async bottlenecks
   */
  private analyzeAsyncBottlenecks(): void {
    if (!this.metrics.async) return;

    const { resolutionRate, eventLoopLag, averageConcurrency } = this.metrics.async;

    // High rejection rate
    if (resolutionRate < 0.9) {
      this.bottlenecks.push({
        type: 'high-async-rejection-rate',
        severity: resolutionRate < 0.7 ? 'critical' : 'high',
        category: 'async',
        description: `High async operation rejection rate: ${((1 - resolutionRate) * 100).toFixed(1)}%`,
        location: 'async-operations',
        impact: 1 - resolutionRate,
        metrics: { resolutionRate },
        recommendation: 'Review error handling, implement retry logic, check for unhandled promise rejections',
        priority: 8,
      });
    }

    // Event loop lag
    if (eventLoopLag > 100) {
      this.bottlenecks.push({
        type: 'event-loop-lag',
        severity: eventLoopLag > 500 ? 'critical' : 'high',
        category: 'async',
        description: `High event loop lag: ${eventLoopLag.toFixed(0)}ms`,
        location: 'event-loop',
        impact: Math.min(1, eventLoopLag / 500),
        metrics: { eventLoopLag },
        recommendation: 'Identify blocking synchronous operations, break up heavy computation, use worker threads',
        priority: 9,
      });
    }

    // High concurrency
    if (averageConcurrency > 100) {
      this.bottlenecks.push({
        type: 'high-concurrency',
        severity: 'medium',
        category: 'async',
        description: `High async concurrency: ${averageConcurrency.toFixed(0)} average operations`,
        location: 'async-operations',
        impact: Math.min(1, averageConcurrency / 500),
        metrics: { averageConcurrency },
        recommendation: 'Implement request throttling, queues, or rate limiting',
        priority: 5,
      });
    }
  }

  /**
   * Analyze cache bottlenecks
   */
  private analyzeCacheBottlenecks(): void {
    if (!this.metrics.cache) return;

    const { hitRate, averageLatency, totalSize } = this.metrics.cache;

    // Low hit rate
    if (hitRate < 0.6) {
      this.bottlenecks.push({
        type: 'low-cache-hit-rate',
        severity: hitRate < 0.4 ? 'high' : 'medium',
        category: 'cache',
        description: `Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`,
        location: 'cache',
        impact: 1 - hitRate,
        metrics: { hitRate },
        recommendation: 'Review cache key strategy, increase cache size, optimize TTL settings',
        priority: 6,
      });
    }

    // Slow cache
    if (averageLatency > 10) {
      this.bottlenecks.push({
        type: 'slow-cache',
        severity: averageLatency > 50 ? 'high' : 'medium',
        category: 'cache',
        description: `Slow cache operations: ${averageLatency.toFixed(2)}ms average`,
        location: 'cache',
        impact: Math.min(1, averageLatency / 50),
        metrics: { averageLatency },
        recommendation: 'Consider using a faster cache backend, optimize serialization',
        priority: 5,
      });
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze bottlenecks and generate recommendations
    for (const bottleneck of this.bottlenecks) {
      switch (bottleneck.type) {
        case 'high-cpu-usage':
          recommendations.push({
            title: 'Optimize CPU-intensive operations',
            description: 'Reduce CPU usage through code optimization and better algorithms',
            category: 'cpu',
            estimatedImprovement: 30,
            effort: 'medium',
            priority: bottleneck.priority,
            steps: [
              'Profile hot functions',
              'Optimize algorithms and data structures',
              'Consider using worker threads for CPU-bound tasks',
              'Implement memoization for repeated calculations',
            ],
          });
          break;

        case 'memory-leak':
          recommendations.push({
            title: 'Fix memory leaks',
            description: 'Identify and fix memory leaks to prevent out-of-memory errors',
            category: 'memory',
            estimatedImprovement: 50,
            effort: 'high',
            priority: bottleneck.priority,
            steps: [
              'Use heap snapshots to identify leaking objects',
              'Check for event listener leaks',
              'Close unused database connections and file handles',
              'Review closure usage',
            ],
          });
          break;

        case 'low-cache-hit-rate':
          recommendations.push({
            title: 'Improve cache effectiveness',
            description: 'Increase cache hit rate to reduce latency and resource usage',
            category: 'cache',
            estimatedImprovement: 40,
            effort: 'low',
            priority: bottleneck.priority,
            steps: [
              'Review cache key generation strategy',
              'Increase cache size if possible',
              'Optimize TTL values',
              'Implement cache warming',
            ],
          });
          break;

        case 'event-loop-lag':
          recommendations.push({
            title: 'Reduce event loop blocking',
            description: 'Minimize blocking operations to keep event loop responsive',
            category: 'async',
            estimatedImprovement: 35,
            effort: 'medium',
            priority: bottleneck.priority,
            steps: [
              'Identify blocking synchronous operations',
              'Break up heavy computation into smaller chunks',
              'Use worker threads for CPU-bound tasks',
              'Implement proper async/await patterns',
            ],
          });
          break;

        case 'high-io-latency':
          recommendations.push({
            title: 'Optimize I/O operations',
            description: 'Reduce I/O latency through batching, pooling, and optimization',
            category: 'io',
            estimatedImprovement: 45,
            effort: 'medium',
            priority: bottleneck.priority,
            steps: [
              'Implement connection pooling',
              'Batch database operations',
              'Use prepared statements',
              'Add appropriate database indexes',
            ],
          });
          break;
      }
    }

    // Remove duplicates and sort by priority
    const uniqueRecommendations = new Map<string, OptimizationRecommendation>();
    for (const rec of recommendations) {
      const key = `${rec.category}-${rec.title}`;
      const existing = uniqueRecommendations.get(key);
      if (!existing || rec.priority > existing.priority) {
        uniqueRecommendations.set(key, rec);
      }
    }

    return Array.from(uniqueRecommendations.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(): number {
    let score = 100;

    // Deduct points for bottlenecks
    for (const bottleneck of this.bottlenecks) {
      switch (bottleneck.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const recommendations = this.generateRecommendations();
    const overallScore = this.calculateOverallScore();

    // Count issues by severity
    const criticalIssues = this.bottlenecks.filter((b) => b.severity === 'critical').length;
    const highIssues = this.bottlenecks.filter((b) => b.severity === 'high').length;
    const mediumIssues = this.bottlenecks.filter((b) => b.severity === 'medium').length;
    const lowIssues = this.bottlenecks.filter((b) => b.severity === 'low').length;

    return {
      timestamp: Date.now(),
      duration: this.endTime - this.startTime,
      metrics: this.metrics,
      bottlenecks: this.bottlenecks,
      recommendations,
      flameGraph: this.flameGraph,
      summary: {
        overallScore,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
      },
    };
  }

  /**
   * Generate HTML report
   */
  generateHTML(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html>');
    lines.push('<head>');
    lines.push('  <title>Performance Report</title>');
    lines.push('  <style>');
    lines.push('    body { font-family: Arial, sans-serif; margin: 20px; }');
    lines.push('    .score { font-size: 48px; font-weight: bold; }');
    lines.push('    .score.good { color: green; }');
    lines.push('    .score.warning { color: orange; }');
    lines.push('    .score.critical { color: red; }');
    lines.push('    .bottleneck { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }');
    lines.push('    .bottleneck.critical { border-left-color: red; }');
    lines.push('    .bottleneck.high { border-left-color: orange; }');
    lines.push('    .bottleneck.medium { border-left-color: yellow; }');
    lines.push('    .bottleneck.low { border-left-color: green; }');
    lines.push('    .recommendation { margin: 10px 0; padding: 10px; background: #f5f5f5; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');
    lines.push(`  <h1>Performance Report</h1>`);
    lines.push(`  <p>Generated: ${new Date(report.timestamp).toISOString()}</p>`);
    lines.push(`  <p>Duration: ${report.duration}ms</p>`);

    // Overall score
    const scoreClass = report.summary.overallScore >= 80 ? 'good' : report.summary.overallScore >= 50 ? 'warning' : 'critical';
    lines.push(`  <div class="score ${scoreClass}">${report.summary.overallScore}/100</div>`);
    lines.push(`  <p>Critical: ${report.summary.criticalIssues} | High: ${report.summary.highIssues} | Medium: ${report.summary.mediumIssues} | Low: ${report.summary.lowIssues}</p>`);

    // Bottlenecks
    lines.push('  <h2>Bottlenecks</h2>');
    for (const bottleneck of report.bottlenecks) {
      lines.push(`  <div class="bottleneck ${bottleneck.severity}">`);
      lines.push(`    <h3>${bottleneck.type}</h3>`);
      lines.push(`    <p><strong>Severity:</strong> ${bottleneck.severity}</p>`);
      lines.push(`    <p><strong>Description:</strong> ${bottleneck.description}</p>`);
      lines.push(`    <p><strong>Location:</strong> ${bottleneck.location}</p>`);
      lines.push(`    <p><strong>Impact:</strong> ${(bottleneck.impact * 100).toFixed(1)}%</p>`);
      lines.push(`    <p><strong>Recommendation:</strong> ${bottleneck.recommendation}</p>`);
      lines.push(`  </div>`);
    }

    // Recommendations
    lines.push('  <h2>Recommendations</h2>');
    for (const rec of report.recommendations) {
      lines.push(`  <div class="recommendation">`);
      lines.push(`    <h3>${rec.title}</h3>`);
      lines.push(`    <p><strong>Category:</strong> ${rec.category}</p>`);
      lines.push(`    <p><strong>Estimated Improvement:</strong> ${rec.estimatedImprovement}%</p>`);
      lines.push(`    <p><strong>Effort:</strong> ${rec.effort}</p>`);
      lines.push(`    <p><strong>Priority:</strong> ${rec.priority}/10</p>`);
      lines.push(`    <p>${rec.description}</p>`);
      lines.push(`    <ol>`);
      for (const step of rec.steps) {
        lines.push(`      <li>${step}</li>`);
      }
      lines.push(`    </ol>`);
      lines.push(`  </div>`);
    }

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Generate Markdown report
   */
  generateMarkdown(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('# Performance Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(report.timestamp).toISOString()}`);
    lines.push(`**Duration:** ${report.duration}ms`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`**Overall Score:** ${report.summary.overallScore}/100`);
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    lines.push(`| Critical | ${report.summary.criticalIssues} |`);
    lines.push(`| High | ${report.summary.highIssues} |`);
    lines.push(`| Medium | ${report.summary.mediumIssues} |`);
    lines.push(`| Low | ${report.summary.lowIssues} |`);
    lines.push('');

    // Bottlenecks
    lines.push('## Bottlenecks');
    lines.push('');
    for (const bottleneck of report.bottlenecks) {
      lines.push(`### ${bottleneck.type}`);
      lines.push('');
      lines.push(`- **Severity:** ${bottleneck.severity}`);
      lines.push(`- **Description:** ${bottleneck.description}`);
      lines.push(`- **Location:** ${bottleneck.location}`);
      lines.push(`- **Impact:** ${(bottleneck.impact * 100).toFixed(1)}%`);
      lines.push(`- **Recommendation:** ${bottleneck.recommendation}`);
      lines.push('');
    }

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`### ${rec.title}`);
      lines.push('');
      lines.push(`- **Category:** ${rec.category}`);
      lines.push(`- **Estimated Improvement:** ${rec.estimatedImprovement}%`);
      lines.push(`- **Effort:** ${rec.effort}`);
      lines.push(`- **Priority:** ${rec.priority}/10`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      lines.push('**Steps:**');
      for (const step of rec.steps) {
        lines.push(`1. ${step}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get bottlenecks
   */
  getBottlenecks(): Bottleneck[] {
    return [...this.bottlenecks];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metrics = {};
    this.bottlenecks = [];
    this.flameGraph = undefined;
    this.startTime = 0;
    this.endTime = 0;
  }
}
