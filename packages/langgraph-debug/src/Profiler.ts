/**
 * Execution Profiler for LangGraph
 *
 * Provides performance profiling, bottleneck detection, and
 * resource usage tracking for agent workflows.
 */

import type {
  NodeProfile,
  Bottleneck,
  PerformanceReport,
  ExecutionTrace,
  TraceEvent,
  ExecutionMetrics,
} from "./types.js";

/**
 * Timing data for a single execution
 */
interface NodeTiming {
  nodeId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart?: number;
  memoryEnd?: number;
}

/**
 * Execution context for profiling
 */
interface ProfileContext {
  traceId: string;
  activeTimings: Map<string, NodeTiming>;
  completedTimings: NodeTiming[];
}

/**
 * Execution Profiler Class
 *
 * Tracks execution timing, memory usage, and detects performance bottlenecks.
 */
export class Profiler {
  private profiles: Map<string, NodeProfile> = new Map();
  private contexts: Map<string, ProfileContext> = new Map();
  private memoryBaseline = 0;

  /**
   * Start profiling a trace
   */
  startProfiling(traceId: string): void {
    this.memoryBaseline = this.getMemoryUsage();

    const context: ProfileContext = {
      traceId,
      activeTimings: new Map(),
      completedTimings: [],
    };

    this.contexts.set(traceId, context);
  }

  /**
   * End profiling a trace and generate report
   */
  endProfiling(traceId: string, graphId: string): PerformanceReport {
    const context = this.contexts.get(traceId);
    if (!context) {
      throw new Error(`No profiling context found for trace ${traceId}`);
    }

    // End any remaining active timings
    for (const [nodeId, timing] of context.activeTimings) {
      if (timing.endTime === undefined) {
        timing.endTime = Date.now();
        timing.duration = timing.endTime - timing.startTime;
      }
      context.completedTimings.push(timing);
    }

    // Calculate profiles
    this.calculateProfiles(traceId, context.completedTimings);

    // Generate report
    const report = this.generateReport(graphId, context.completedTimings);

    this.contexts.delete(traceId);
    return report;
  }

  /**
   * Record node execution start
   */
  recordNodeStart(traceId: string, nodeId: string, nodeName: string): void {
    const context = this.contexts.get(traceId);
    if (!context) {
      return;
    }

    const timing: NodeTiming = {
      nodeId,
      startTime: Date.now(),
      memoryStart: this.getMemoryUsage(),
    };

    context.activeTimings.set(nodeId, timing);
  }

  /**
   * Record node execution end
   */
  recordNodeEnd(traceId: string, nodeId: string, success = true): void {
    const context = this.contexts.get(traceId);
    if (!context) {
      return;
    }

    const timing = context.activeTimings.get(nodeId);
    if (!timing) {
      return;
    }

    timing.endTime = Date.now();
    timing.duration = timing.endTime - timing.startTime;
    timing.memoryEnd = this.getMemoryUsage();

    context.activeTimings.delete(nodeId);
    context.completedTimings.push(timing);

    if (!success) {
      let profile = this.profiles.get(nodeId);
      if (!profile) {
        profile = this.createProfile(nodeId, nodeId);
        this.profiles.set(nodeId, profile);
      }
      profile.error_count++;
    }
  }

  /**
   * Calculate node profiles from completed timings
   */
  private calculateProfiles(traceId: string, timings: NodeTiming[]): void {
    // Group by node
    const timingsByNode = new Map<string, number[]>();

    for (const timing of timings) {
      if (timing.duration !== undefined) {
        const durations = timingsByNode.get(timing.nodeId) ?? [];
        durations.push(timing.duration);
        timingsByNode.set(timing.nodeId, durations);
      }
    }

    // Calculate statistics for each node
    for (const [nodeId, durations] of timingsByNode.entries()) {
      const profile = this.createProfile(nodeId, nodeId);

      profile.execution_count = durations.length;
      profile.total_time_ms = durations.reduce((sum, d) => sum + d, 0);
      profile.avg_time_ms = profile.total_time_ms / durations.length;
      profile.min_time_ms = Math.min(...durations);
      profile.max_time_ms = Math.max(...durations);

      // Calculate standard deviation
      const variance =
        durations.reduce(
          (sum, d) => sum + Math.pow(d - profile.avg_time_ms, 2),
          0
        ) / durations.length;
      profile.std_dev_ms = Math.sqrt(variance);

      this.profiles.set(nodeId, profile);
    }
  }

  /**
   * Create a new node profile
   */
  private createProfile(id: string, name: string): NodeProfile {
    return {
      id,
      name,
      execution_count: 0,
      total_time_ms: 0,
      avg_time_ms: 0,
      min_time_ms: 0,
      max_time_ms: 0,
      std_dev_ms: 0,
      error_count: 0,
      success_rate: 1,
    };
  }

  /**
   * Generate performance report
   */
  private generateReport(
    graphId: string,
    timings: NodeTiming[]
  ): PerformanceReport {
    const nodeProfiles = Array.from(this.profiles.values());
    const bottlenecks = this.detectBottlenecks(nodeProfiles);
    const totalTime = timings.reduce((sum, t) => sum + (t.duration ?? 0), 0);

    // Calculate overall metrics
    const totalExecutions = nodeProfiles.reduce(
      (sum, p) => sum + p.execution_count,
      0
    );
    const avgTime = totalTime / Math.max(totalExecutions, 1);
    const errorCount = nodeProfiles.reduce((sum, p) => sum + p.error_count, 0);
    const errorRate = errorCount / Math.max(totalExecutions, 1);
    const throughput = totalExecutions / Math.max(totalTime / 1000, 1);

    const report: PerformanceReport = {
      report_id: `report_${Date.now()}`,
      graph_id: graphId,
      generated_at: Date.now(),
      time_period: {
        start: timings.length > 0 ? timings[0].startTime : Date.now(),
        end:
          timings.length > 0
            ? Math.max(...timings.map(t => t.endTime ?? t.startTime))
            : Date.now(),
      },
      node_profiles: nodeProfiles,
      bottlenecks,
      overall_metrics: {
        total_executions: totalExecutions,
        total_time_ms: totalTime,
        avg_time_ms: avgTime,
        throughput_per_second: throughput,
        error_rate: errorRate,
      },
      recommendations: this.generateRecommendations(bottlenecks, nodeProfiles),
    };

    return report;
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(profiles: NodeProfile[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    if (profiles.length === 0) {
      return bottlenecks;
    }

    const avgExecutionTime =
      profiles.reduce((sum, p) => sum + p.avg_time_ms, 0) / profiles.length;
    const avgErrorRate =
      profiles.reduce((sum, p) => sum + (1 - p.success_rate), 0) /
      profiles.length;

    // Detect slow nodes (2x average)
    for (const profile of profiles) {
      if (
        profile.avg_time_ms > avgExecutionTime * 2 &&
        profile.execution_count >= 3
      ) {
        bottlenecks.push({
          id: `bottleneck_slow_${profile.id}`,
          type: "slow_node",
          node_id: profile.id,
          severity: Math.min(profile.avg_time_ms / (avgExecutionTime * 3), 1),
          description: `Node ${profile.name} is averaging ${profile.avg_time_ms.toFixed(2)}ms per execution, ${(
            profile.avg_time_ms / avgExecutionTime
          ).toFixed(1)}x slower than average`,
          recommendation: this.getSlowNodeRecommendation(profile),
          metrics: {
            avg_time_ms: profile.avg_time_ms,
            execution_count: profile.execution_count,
          },
        });
      }
    }

    // Detect frequent errors
    for (const profile of profiles) {
      const errorRate =
        profile.error_count / Math.max(profile.execution_count, 1);
      if (errorRate > 0.1 && profile.execution_count >= 5) {
        bottlenecks.push({
          id: `bottleneck_error_${profile.id}`,
          type: "frequent_error",
          node_id: profile.id,
          severity: Math.min(errorRate * 2, 1),
          description: `Node ${profile.name} has ${(errorRate * 100).toFixed(1)}% error rate (${profile.error_count}/${profile.execution_count} executions)`,
          recommendation: this.getErrorNodeRecommendation(profile),
          metrics: {
            error_rate: errorRate,
            error_count: profile.error_count,
          },
        });
      }
    }

    // Detect memory leaks (increasing memory over time)
    for (const profile of profiles) {
      if (profile.memory_usage) {
        const growthRatio =
          profile.memory_usage.max_bytes /
          Math.max(profile.memory_usage.min_bytes, 1);
        if (
          growthRatio > 2 &&
          profile.memory_usage.max_bytes > 10 * 1024 * 1024
        ) {
          bottlenecks.push({
            id: `bottleneck_memory_${profile.id}`,
            type: "memory_leak",
            node_id: profile.id,
            severity: Math.min(growthRatio / 5, 1),
            description: `Node ${profile.name} shows memory growth from ${this.formatBytes(
              profile.memory_usage.min_bytes
            )} to ${this.formatBytes(profile.memory_usage.max_bytes)}`,
            recommendation: this.getMemoryRecommendation(profile),
            metrics: {
              growth_ratio: growthRatio,
              max_bytes: profile.memory_usage.max_bytes,
            },
          });
        }
      }
    }

    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Get recommendation for slow nodes
   */
  private getSlowNodeRecommendation(profile: NodeProfile): string {
    if (profile.avg_time_ms > 1000) {
      return `Consider caching results, implementing parallel processing, or moving ${profile.name} to a more powerful compute resource.`;
    } else if (profile.std_dev_ms / profile.avg_time_ms > 0.5) {
      return `High timing variability detected. Check for external dependencies or network calls in ${profile.name}.`;
    } else {
      return `Profile ${profile.name} for optimization opportunities. Consider algorithmic improvements or reducing work done in each call.`;
    }
  }

  /**
   * Get recommendation for error-prone nodes
   */
  private getErrorNodeRecommendation(profile: NodeProfile): string {
    return `Add error handling, input validation, and retry logic to ${profile.name}. Consider implementing a circuit breaker pattern for external dependencies.`;
  }

  /**
   * Get recommendation for memory issues
   */
  private getMemoryRecommendation(profile: NodeProfile): string {
    return `Review ${profile.name} for memory leaks, ensure proper cleanup of resources, and consider streaming or batching large data sets.`;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    bottlenecks: Bottleneck[],
    profiles: NodeProfile[]
  ): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length === 0) {
      recommendations.push(
        "No significant bottlenecks detected. Performance is good."
      );
      return recommendations;
    }

    // Add bottleneck-specific recommendations
    for (const bottleneck of bottlenecks.slice(0, 3)) {
      recommendations.push(bottleneck.recommendation);
    }

    // General recommendations based on overall patterns
    const slowNodes = profiles.filter(p => p.avg_time_ms > 500);
    if (slowNodes.length > 2) {
      recommendations.push(
        `Multiple slow nodes detected (${slowNodes.length}). Consider parallel execution where possible.`
      );
    }

    const errorProneNodes = profiles.filter(p => p.error_count > 0);
    if (errorProneNodes.length > 1) {
      recommendations.push(
        `Multiple nodes with errors detected. Review error handling across the graph.`
      );
    }

    return recommendations;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Format bytes for human readable output
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get profile for a node
   */
  getProfile(nodeId: string): NodeProfile | undefined {
    return this.profiles.get(nodeId);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): NodeProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Reset all profiles
   */
  resetProfiles(): void {
    this.profiles.clear();
  }

  /**
   * Calculate metrics from trace events
   */
  calculateMetricsFromEvents(events: TraceEvent[]): ExecutionMetrics {
    const nodeTimes = new Map<string, number>();
    const nodeStartTimes = new Map<string, number>();

    let nodesExecuted = 0;
    let edgesTraversed = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const event of events) {
      switch (event.event_type) {
        case "node_start":
          if (event.node_name) {
            nodeStartTimes.set(event.node_name, event.timestamp);
          }
          nodesExecuted++;
          break;

        case "node_end":
          if (event.node_name) {
            const startTime = nodeStartTimes.get(event.node_name);
            if (startTime !== undefined) {
              const duration = event.timestamp - startTime;
              const current = nodeTimes.get(event.node_name) ?? 0;
              nodeTimes.set(event.node_name, current + duration);
              nodeStartTimes.delete(event.node_name);
            }
          }
          break;

        case "edge_traversal":
          edgesTraversed++;
          break;

        case "error":
          errorCount++;
          break;

        case "warning":
          warningCount++;
          break;
      }
    }

    const totalTime = Array.from(nodeTimes.values()).reduce(
      (sum, t) => sum + t,
      0
    );

    // Find slowest and fastest nodes
    let slowestNode: { name: string; time_ms: number } | undefined;
    let fastestNode: { name: string; time_ms: number } | undefined;

    for (const [name, time] of nodeTimes.entries()) {
      if (!slowestNode || time > slowestNode.time_ms) {
        slowestNode = { name, time_ms: time };
      }
      if (!fastestNode || time < fastestNode.time_ms) {
        fastestNode = { name, time_ms: time };
      }
    }

    return {
      total_time_ms: totalTime,
      node_times: nodeTimes,
      nodes_executed: nodesExecuted,
      edges_traversed: edgesTraversed,
      error_count,
      warning_count,
      avg_node_time_ms: nodesExecuted > 0 ? totalTime / nodesExecuted : 0,
      slowest_node: slowestNode,
      fastest_node: fastestNode,
    };
  }

  /**
   * Analyze execution trace for performance insights
   */
  analyzeTrace(trace: ExecutionTrace): {
    executionTime: number;
    bottleneckNodes: string[];
    recommendations: string[];
  } {
    const metrics = trace.metrics;
    const bottleneckNodes: string[] = [];
    const recommendations: string[] = [];

    // Find bottlenecks (nodes taking >20% of total time)
    const threshold = metrics.total_time_ms * 0.2;
    for (const [node, time] of metrics.node_times.entries()) {
      if (time > threshold) {
        bottleneckNodes.push(node);
      }
    }

    // Generate recommendations
    if (metrics.error_count > 0) {
      recommendations.push(
        `${metrics.error_count} errors occurred. Review error handling.`
      );
    }

    if (
      metrics.slowest_node &&
      metrics.slowest_node.time_ms > metrics.avg_node_time_ms * 3
    ) {
      recommendations.push(
        `Node "${metrics.slowest_node.name}" is significantly slower than average (${metrics.slowest_node.time_ms.toFixed(2)}ms vs ${metrics.avg_node_time_ms.toFixed(2)}ms average). Consider optimization.`
      );
    }

    if (nodesExecuted > 50) {
      recommendations.push(
        `High number of nodes executed (${nodesExecuted}). Consider if some operations can be batched.`
      );
    }

    return {
      executionTime: metrics.total_time_ms,
      bottleneckNodes,
      recommendations,
    };
  }

  /**
   * Compare two profiles
   */
  compareProfiles(
    profile1: NodeProfile,
    profile2: NodeProfile
  ): {
    timeDiff: number;
    timeDiffPercent: number;
    errorRateChange: number;
    verdict: "improved" | "degraded" | "stable";
  } {
    const timeDiff = profile2.avg_time_ms - profile1.avg_time_ms;
    const timeDiffPercent = (timeDiff / profile1.avg_time_ms) * 100;

    const errorRate1 =
      profile1.error_count / Math.max(profile1.execution_count, 1);
    const errorRate2 =
      profile2.error_count / Math.max(profile2.execution_count, 1);
    const errorRateChange = errorRate2 - errorRate1;

    let verdict: "improved" | "degraded" | "stable" = "stable";
    if (timeDiff < -0.1 * profile1.avg_time_ms && errorRateChange <= 0) {
      verdict = "improved";
    } else if (
      timeDiff > 0.1 * profile1.avg_time_ms ||
      errorRateChange > 0.05
    ) {
      verdict = "degraded";
    }

    return {
      timeDiff,
      timeDiffPercent,
      errorRateChange,
      verdict,
    };
  }

  /**
   * Get real-time performance snapshot
   */
  getPerformanceSnapshot(traceId: string): {
    activeNodes: string[];
    currentMemory: number;
    memoryDelta: number;
  } {
    const context = this.contexts.get(traceId);
    const activeNodes = context ? Array.from(context.activeTimings.keys()) : [];
    const currentMemory = this.getMemoryUsage();
    const memoryDelta = currentMemory - this.memoryBaseline;

    return {
      activeNodes,
      currentMemory,
      memoryDelta,
    };
  }

  /**
   * Export profile data as JSON
   */
  exportProfiles(): string {
    return JSON.stringify(Array.from(this.profiles.values()), null, 2);
  }

  /**
   * Import profile data from JSON
   */
  importProfiles(jsonData: string): void {
    const profiles = JSON.parse(jsonData) as NodeProfile[];
    for (const profile of profiles) {
      this.profiles.set(profile.id, profile);
    }
  }
}
