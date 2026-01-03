/**
 * BottleneckAnalyzer - Identify and categorize performance bottlenecks
 *
 * Analyzes profiling data to identify bottlenecks and suggest optimizations
 */

import type {
  Bottleneck,
  BottleneckCategory,
  BottleneckSeverity,
  OptimizationSuggestion,
  OptimizationCategory,
  ProfileReport,
  KernelExecution,
  MemoryAllocation,
  TransferRecord,
  PerformanceMetric,
} from "../types.js";

/**
 * Bottleneck analysis result
 */
interface BottleneckAnalysis {
  /** Identified bottlenecks */
  bottlenecks: Bottleneck[];
  /** Optimization suggestions */
  optimizations: OptimizationSuggestion[];
  /** Overall bottleneck score (0-100) */
  bottleneckScore: number;
}

/**
 * Analysis thresholds
 */
interface Thresholds {
  /** Kernel duration threshold (ms) for considering as bottleneck */
  slowKernelThreshold: number;
  /** Memory leak threshold (bytes) */
  memoryLeakThreshold: number;
  /** Low bandwidth threshold (GB/s) */
  lowBandwidthThreshold: number;
  /** High transfer time threshold (ms) */
  highTransferTimeThreshold: number;
}

/**
 * BottleneckAnalyzer - Analyzes profiling data for performance issues
 *
 * @example
 * ```typescript
 * const analyzer = new BottleneckAnalyzer();
 *
 * const report = await profiler.stopProfiling();
 * const analysis = analyzer.analyzeReport(report);
 *
 * console.log(`Found ${analysis.bottlenecks.length} bottlenecks`);
 * for (const suggestion of analysis.optimizations) {
 *   console.log(suggestion.title, suggestion.expectedImprovement);
 * }
 * ```
 */
export class BottleneckAnalyzer {
  /** Analysis thresholds */
  private thresholds: Thresholds;

  /**
   * Create a new bottleneck analyzer
   *
   * @param thresholds - Custom analysis thresholds
   */
  constructor(thresholds?: Partial<Thresholds>) {
    this.thresholds = {
      slowKernelThreshold: 5, // 5ms
      memoryLeakThreshold: 1024 * 1024, // 1MB
      lowBandwidthThreshold: 1, // 1 GB/s
      highTransferTimeThreshold: 10, // 10ms
      ...thresholds,
    };
  }

  /**
   * Analyze a complete profile report
   *
   * @param report - Profile report to analyze
   * @returns Analysis results
   */
  analyzeReport(report: ProfileReport): BottleneckAnalysis {
    const bottlenecks: Bottleneck[] = [];
    const optimizations: OptimizationSuggestion[] = [];

    // Analyze kernels
    const kernelBottlenecks = this.analyzeKernels(
      report.kernelSummary.slowestKernels,
      report.kernelSummary
    );
    bottlenecks.push(...kernelBottlenecks.bottlenecks);
    optimizations.push(...kernelBottlenecks.optimizations);

    // Analyze memory
    const memoryBottlenecks = this.analyzeMemory(report.memorySummary);
    bottlenecks.push(...memoryBottlenecks.bottlenecks);
    optimizations.push(...memoryBottlenecks.optimizations);

    // Analyze transfers
    const transferBottlenecks = this.analyzeTransfers(report.transferSummary);
    bottlenecks.push(...transferBottlenecks.bottlenecks);
    optimizations.push(...transferBottlenecks.optimizations);

    // Analyze metrics
    const metricBottlenecks = this.analyzeMetrics(report.metrics);
    bottlenecks.push(...metricBottlenecks.bottlenecks);
    optimizations.push(...metricBottlenecks.optimizations);

    // Calculate overall bottleneck score
    const bottleneckScore = this.calculateBottleneckScore(bottlenecks);

    // Sort by severity
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    // Sort optimizations by priority
    optimizations.sort((a, b) => b.priority - a.priority);

    return {
      bottlenecks,
      optimizations,
      bottleneckScore,
    };
  }

  /**
   * Analyze kernel executions for bottlenecks
   */
  private analyzeKernels(
    kernels: KernelExecution[],
    summary: ProfileReport["kernelSummary"]
  ): BottleneckAnalysis {
    const bottlenecks: Bottleneck[] = [];
    const optimizations: OptimizationSuggestion[] = [];

    // Check for slow kernels
    for (const kernel of kernels) {
      const durationMs = kernel.duration / 1_000_000;

      if (durationMs > this.thresholds.slowKernelThreshold) {
        const severity = this.getKernelSeverity(durationMs);
        const bottleneck = this.createKernelBottleneck(
          kernel,
          durationMs,
          severity
        );
        bottlenecks.push(bottleneck);

        // Add optimization suggestions
        optimizations.push(...this.getKernelOptimizations(kernel, durationMs));
      }
    }

    // Check for high variance kernels
    if (
      summary.avgDuration > 0 &&
      summary.maxDuration > summary.avgDuration * 3
    ) {
      bottlenecks.push({
        category: "synchronization",
        severity: "medium",
        description:
          "High variance in kernel execution times indicates potential synchronization issues",
        affectedComponent: ["kernel-execution"],
        impact:
          ((summary.maxDuration - summary.avgDuration) / summary.maxDuration) *
          100,
        evidence: [],
        suggestions: [],
      });

      optimizations.push({
        category: "pipeline-optimization",
        title: "Reduce Synchronization Overhead",
        description:
          "Use async compute pipelines and reduce synchronization points between kernels",
        expectedImprovement: 20,
        effort: "medium",
        priority: 5,
      });
    }

    return { bottlenecks, optimizations, bottleneckScore: 0 };
  }

  /**
   * Analyze memory usage for bottlenecks
   */
  private analyzeMemory(
    summary: ProfileReport["memorySummary"]
  ): BottleneckAnalysis {
    const bottlenecks: Bottleneck[] = [];
    const optimizations: OptimizationSuggestion[] = [];

    // Check for memory leaks
    if (
      summary.leakCount > 0 &&
      summary.currentMemory > this.thresholds.memoryLeakThreshold
    ) {
      bottlenecks.push({
        category: "memory-bound",
        severity: "high",
        description: `Memory leak detected: ${summary.leakCount} unfreed allocations (${(summary.currentMemory / 1024 / 1024).toFixed(2)} MB)`,
        affectedComponent: ["memory-management"],
        impact: Math.min(
          (summary.currentMemory / summary.peakMemory) * 100,
          100
        ),
        evidence: [],
        suggestions: [],
      });

      optimizations.push({
        category: "resource-management",
        title: "Fix Memory Leaks",
        description:
          "Ensure all GPU buffers and textures are properly destroyed when no longer needed",
        expectedImprovement: 30,
        effort: "low",
        priority: 10,
      });
    }

    // Check for high memory usage
    if (summary.peakMemory > 512 * 1024 * 1024) {
      // 512 MB
      bottlenecks.push({
        category: "memory-bound",
        severity: "medium",
        description: `High peak memory usage: ${(summary.peakMemory / 1024 / 1024).toFixed(2)} MB`,
        affectedComponent: ["memory-management"],
        impact: 50,
        evidence: [],
        suggestions: [],
      });

      optimizations.push({
        category: "memory-layout",
        title: "Implement Memory Pooling",
        description:
          "Use memory pools to reduce allocation overhead and fragmentation",
        expectedImprovement: 15,
        effort: "medium",
        priority: 6,
      });
    }

    return { bottlenecks, optimizations, bottleneckScore: 0 };
  }

  /**
   * Analyze transfer performance for bottlenecks
   */
  private analyzeTransfers(
    summary: ProfileReport["transferSummary"]
  ): BottleneckAnalysis {
    const bottlenecks: Bottleneck[] = [];
    const optimizations: OptimizationSuggestion[] = [];

    // Check for low bandwidth
    if (summary.avgBandwidth < this.thresholds.lowBandwidthThreshold) {
      bottlenecks.push({
        category: "transfer-bound",
        severity: "high",
        description: `Low transfer bandwidth: ${summary.avgBandwidth.toFixed(2)} GB/s`,
        affectedComponent: ["data-transfer"],
        impact:
          ((this.thresholds.lowBandwidthThreshold - summary.avgBandwidth) /
            this.thresholds.lowBandwidthThreshold) *
          100,
        evidence: [],
        suggestions: [],
      });

      optimizations.push({
        category: "transfer-reduction",
        title: "Increase Transfer Bandwidth",
        description:
          "Use larger buffers, batch transfers, or consider unified memory architecture",
        expectedImprovement: 25,
        effort: "low",
        priority: 8,
      });
    }

    // Check for high transfer time overhead
    const avgTransferTime =
      summary.totalTransferTime / Math.max(summary.totalTransfers, 1);
    if (
      avgTransferTime >
      this.thresholds.highTransferTimeThreshold * 1_000_000
    ) {
      bottlenecks.push({
        category: "transfer-bound",
        severity: "medium",
        description: `High average transfer time: ${(avgTransferTime / 1_000_000).toFixed(2)} ms`,
        affectedComponent: ["data-transfer"],
        impact: 40,
        evidence: [],
        suggestions: [],
      });

      optimizations.push({
        category: "transfer-reduction",
        title: "Reduce Transfer Overhead",
        description:
          "Use staging buffers, async transfers, and overlap compute with transfers",
        expectedImprovement: 20,
        effort: "medium",
        priority: 7,
      });
    }

    return { bottlenecks, optimizations, bottleneckScore: 0 };
  }

  /**
   * Analyze performance metrics for bottlenecks
   */
  private analyzeMetrics(metrics: PerformanceMetric[]): BottleneckAnalysis {
    const bottlenecks: Bottleneck[] = [];
    const optimizations: OptimizationSuggestion[] = [];

    for (const metric of metrics) {
      // Check for high variance
      if (metric.stdDev && metric.stdDev > metric.avg * 0.5) {
        bottlenecks.push({
          category: "synchronization",
          severity: "low",
          description: `High variance in ${metric.name}: ${((metric.stdDev / metric.avg) * 100).toFixed(1)}%`,
          affectedComponent: [metric.name],
          impact: Math.min((metric.stdDev / metric.avg) * 50, 100),
          evidence: [metric],
          suggestions: [],
        });
      }
    }

    return { bottlenecks, optimizations, bottleneckScore: 0 };
  }

  /**
   * Get kernel bottleneck severity
   */
  private getKernelSeverity(durationMs: number): BottleneckSeverity {
    if (durationMs > 50) return "critical";
    if (durationMs > 20) return "high";
    if (durationMs > 10) return "medium";
    return "low";
  }

  /**
   * Create kernel bottleneck
   */
  private createKernelBottleneck(
    kernel: KernelExecution,
    durationMs: number,
    severity: BottleneckSeverity
  ): Bottleneck {
    const category: BottleneckCategory =
      durationMs > 20 ? "compute-bound" : "latency-bound";

    return {
      category,
      severity,
      description: `Slow kernel execution: ${kernel.name} took ${durationMs.toFixed(2)} ms`,
      affectedComponent: [kernel.name],
      impact: Math.min((durationMs / 50) * 100, 100),
      evidence: [],
      suggestions: [],
    };
  }

  /**
   * Get kernel-specific optimization suggestions
   */
  private getKernelOptimizations(
    kernel: KernelExecution,
    durationMs: number
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check workgroup size
    if (kernel.workgroupSize) {
      const [x, y, z] = kernel.workgroupSize;
      if (x < 32 || (y === 1 && z === 1)) {
        suggestions.push({
          category: "workgroup-size",
          title: "Optimize Workgroup Size",
          description: `Current workgroup size [${x}, ${y}, ${z}] may not match GPU warp/wavefront size. Consider using [32, 1, 1] or [64, 1, 1] for better occupancy.`,
          expectedImprovement: 15,
          effort: "low",
          priority: 7,
        });
      }
    }

    // General kernel optimizations for slow kernels
    if (durationMs > 10) {
      suggestions.push({
        category: "kernel-optimization",
        title: "Optimize Kernel Memory Access",
        description:
          "Ensure memory accesses are coalesced and use shared memory when possible",
        expectedImprovement: 20,
        effort: "medium",
        priority: 6,
      });

      suggestions.push({
        category: "memory-layout",
        title: "Use Structure of Arrays (SoA)",
        description:
          "Convert Array of Structures (AoS) to Structure of Arrays (SoA) for better memory coalescing",
        expectedImprovement: 10,
        effort: "medium",
        priority: 5,
      });
    }

    // Check for insufficient parallelism
    const totalWorkGroups =
      kernel.dispatchSize[0] * kernel.dispatchSize[1] * kernel.dispatchSize[2];
    if (totalWorkGroups < 100) {
      suggestions.push({
        category: "insufficient-parallelism",
        title: "Increase Parallelism",
        description: `Only ${totalWorkGroups} workgroups dispatched. Consider increasing workload for better GPU utilization.`,
        expectedImprovement: 25,
        effort: "low",
        priority: 8,
      });
    }

    return suggestions;
  }

  /**
   * Calculate overall bottleneck score
   */
  private calculateBottleneckScore(bottlenecks: Bottleneck[]): number {
    if (bottlenecks.length === 0) return 0;

    const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
    const totalScore = bottlenecks.reduce(
      (sum, b) => sum + severityWeights[b.severity],
      0
    );

    return Math.min(totalScore, 100);
  }

  /**
   * Generate a text summary of bottlenecks
   *
   * @param bottlenecks - Bottlenecks to summarize
   * @returns Formatted summary string
   */
  summarizeBottlenecks(bottlenecks: Bottleneck[]): string {
    if (bottlenecks.length === 0) {
      return "No significant bottlenecks detected.";
    }

    const lines: string[] = [];
    lines.push(`Found ${bottlenecks.length} bottleneck(s):\n`);

    for (let i = 0; i < bottlenecks.length; i++) {
      const b = bottlenecks[i];
      lines.push(`${i + 1}. [${b.severity.toUpperCase()}] ${b.category}`);
      lines.push(`   ${b.description}`);
      lines.push(`   Impact: ${b.impact.toFixed(1)}%\n`);
    }

    return lines.join("\n");
  }

  /**
   * Generate a text summary of optimizations
   *
   * @param optimizations - Optimizations to summarize
   * @returns Formatted summary string
   */
  summarizeOptimizations(optimizations: OptimizationSuggestion[]): string {
    if (optimizations.length === 0) {
      return "No optimization suggestions.";
    }

    const lines: string[] = [];
    lines.push(`Top ${optimizations.length} optimization(s):\n`);

    for (let i = 0; i < Math.min(optimizations.length, 10); i++) {
      const opt = optimizations[i];
      lines.push(
        `${i + 1}. ${opt.title} (${opt.expectedImprovement}% expected)`
      );
      lines.push(`   ${opt.description}`);
      lines.push(`   Effort: ${opt.effort}, Priority: ${opt.priority}\n`);
    }

    return lines.join("\n");
  }

  /**
   * Update analysis thresholds
   *
   * @param thresholds - New thresholds
   */
  setThresholds(thresholds: Partial<Thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): Thresholds {
    return { ...this.thresholds };
  }
}
