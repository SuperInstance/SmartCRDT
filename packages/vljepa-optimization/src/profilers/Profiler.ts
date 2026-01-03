/**
 * VL-JEPA Profiler
 * Profiles inference operations to identify bottlenecks and optimization opportunities
 */

import type {
  ProfilerConfig,
  ProfileResult,
  OperationProfile,
  Bottleneck,
  OptimizationRecommendation,
  ProfileMetadata,
  DeviceInfo,
  ModelInfo,
} from "../types.js";

export class Profiler {
  private config: ProfilerConfig;
  private operations: Map<string, OperationData>;
  private startTime: number = 0;
  private endTime: number = 0;
  private memorySnapshots: MemorySnapshot[] = [];
  private gpuSnapshots: GPUSnapshot[] = [];
  private callStack: CallFrame[] = [];
  private enabled: boolean = false;

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      trackMemory: true,
      trackGPU: true,
      samplingRate: 1000,
      detailedTraces: true,
      enableStackTraces: true,
      maxTraceDepth: 10,
      ...config,
    };
    this.operations = new Map();
  }

  /**
   * Start profiling session
   */
  start(): void {
    this.enabled = true;
    this.startTime = performance.now();
    this.operations.clear();
    this.memorySnapshots = [];
    this.gpuSnapshots = [];
    this.callStack = [];

    if (this.config.trackMemory) {
      this.startMemorySampling();
    }

    if (this.config.trackGPU) {
      this.startGPUSampling();
    }
  }

  /**
   * Stop profiling session
   */
  stop(): void {
    this.enabled = false;
    this.endTime = performance.now();

    if (this.config.trackMemory) {
      this.stopMemorySampling();
    }

    if (this.config.trackGPU) {
      this.stopGPUSampling();
    }
  }

  /**
   * Profile an operation
   */
  profile<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const opStart = performance.now();
    const startMemory = this.getCurrentMemory();

    const pushFrame = () => {
      if (this.config.enableStackTraces) {
        this.callStack.push({
          name,
          start: opStart,
          depth: this.callStack.length,
        });
      }
    };

    const popFrame = () => {
      if (this.config.enableStackTraces && this.callStack.length > 0) {
        this.callStack.pop();
      }
    };

    pushFrame();

    try {
      const result = fn();

      // Handle async operations
      if (result instanceof Promise) {
        return result.then(
          value => {
            const opEnd = performance.now();
            const endMemory = this.getCurrentMemory();
            this.recordOperation(name, opStart, opEnd, startMemory, endMemory);
            popFrame();
            return value;
          },
          error => {
            const opEnd = performance.now();
            const endMemory = this.getCurrentMemory();
            this.recordOperation(
              name,
              opStart,
              opEnd,
              startMemory,
              endMemory,
              true
            );
            popFrame();
            throw error;
          }
        );
      }

      const opEnd = performance.now();
      const endMemory = this.getCurrentMemory();
      this.recordOperation(name, opStart, opEnd, startMemory, endMemory);
      popFrame();

      return result;
    } catch (error) {
      const opEnd = performance.now();
      const endMemory = this.getCurrentMemory();
      this.recordOperation(name, opStart, opEnd, startMemory, endMemory, true);
      popFrame();
      throw error;
    }
  }

  /**
   * Get profiling results
   */
  getResults(metadata?: Partial<ProfileMetadata>): ProfileResult {
    const totalTime = this.endTime - this.startTime;
    const ops = this.buildOperationProfiles(totalTime);
    const bottlenecks = this.identifyBottlenecks(ops, totalTime);
    const recommendations = this.generateRecommendations(bottlenecks, ops);

    return {
      operations: ops,
      totalLatency: totalTime,
      peakMemory: this.calculatePeakMemory(),
      averageGPUUtilization: this.calculateAverageGPU(),
      bottlenecks,
      recommendations,
      metadata: this.buildMetadata(metadata),
    };
  }

  /**
   * Reset profiler state
   */
  reset(): void {
    this.operations.clear();
    this.memorySnapshots = [];
    this.gpuSnapshots = [];
    this.callStack = [];
    this.startTime = 0;
    this.endTime = 0;
  }

  /**
   * Get current profiler state
   */
  getState(): ProfilerState {
    return {
      enabled: this.enabled,
      duration: this.enabled
        ? performance.now() - this.startTime
        : this.endTime - this.startTime,
      operationCount: this.operations.size,
      memorySnapshots: this.memorySnapshots.length,
      gpuSnapshots: this.gpuSnapshots.length,
      callStackDepth: this.callStack.length,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private recordOperation(
    name: string,
    start: number,
    end: number,
    startMemory: number,
    endMemory: number,
    failed: boolean = false
  ): void {
    let opData = this.operations.get(name);

    if (!opData) {
      opData = {
        name,
        latencies: [],
        memoryDeltas: [],
        calls: 0,
        failures: 0,
      };
      this.operations.set(name, opData);
    }

    const latency = end - start;
    const memoryDelta = endMemory - startMemory;

    opData.latencies.push(latency);
    opData.memoryDeltas.push(memoryDelta);
    opData.calls++;

    if (failed) {
      opData.failures++;
    }
  }

  private buildOperationProfiles(totalTime: number): OperationProfile[] {
    const profiles: OperationProfile[] = [];

    for (const [name, data] of this.operations.entries()) {
      const latencies = data.latencies;
      const avgLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const variance =
        latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) /
        latencies.length;
      const stdDev = Math.sqrt(variance);
      const avgMemory =
        data.memoryDeltas.reduce((a, b) => a + b, 0) / data.memoryDeltas.length;
      const totalTimeForOp = latencies.reduce((a, b) => a + b, 0);

      profiles.push({
        name,
        latency: totalTimeForOp,
        memory: avgMemory,
        percentage: (totalTimeForOp / totalTime) * 100,
        calls: data.calls,
        avgLatency,
        minLatency,
        maxLatency,
        stdDev,
        startTime: 0, // Could be tracked separately
        endTime: 0,
      });
    }

    return profiles.sort((a, b) => b.latency - a.latency);
  }

  private identifyBottlenecks(
    ops: OperationProfile[],
    totalTime: number
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const threshold = totalTime * 0.05; // 5% of total time

    for (const op of ops) {
      if (op.latency > threshold) {
        let severity: Bottleneck["severity"] = "low";
        const impact = op.latency;

        if (op.percentage > 30) {
          severity = "critical";
        } else if (op.percentage > 15) {
          severity = "high";
        } else if (op.percentage > 10) {
          severity = "medium";
        }

        bottlenecks.push({
          operation: op.name,
          severity,
          impact,
          description: this.describeBottleneck(op),
          suggestedOptimizations: this.suggestOptimizations(op),
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private describeBottleneck(op: OperationProfile): string {
    if (op.avgLatency > 100) {
      return `${op.name} is taking an average of ${op.avgLatency.toFixed(2)}ms per call (${op.calls} calls total). This is a critical performance bottleneck.`;
    } else if (op.stdDev / op.avgLatency > 0.5) {
      return `${op.name} has high variance (stddev: ${op.stdDev.toFixed(2)}ms). Performance is inconsistent.`;
    } else if (op.calls > 100) {
      return `${op.name} is called very frequently (${op.calls} times). Consider caching or batching.`;
    } else {
      return `${op.name} accounts for ${op.percentage.toFixed(1)}% of total inference time.`;
    }
  }

  private suggestOptimizations(op: OperationProfile): string[] {
    const suggestions: string[] = [];

    // High-frequency operations
    if (op.calls > 100) {
      suggestions.push("Consider caching the results of this operation");
      suggestions.push("Batch multiple calls together if possible");
    }

    // High latency operations
    if (op.avgLatency > 50) {
      suggestions.push("Profile internal operations to find sub-bottlenecks");
      suggestions.push("Consider using a more efficient algorithm");
      suggestions.push("Check if GPU acceleration is available");
    }

    // High variance
    if (op.stdDev / op.avgLatency > 0.5) {
      suggestions.push(
        "Investigate inconsistent performance - may be resource contention"
      );
      suggestions.push("Consider adding queue management or throttling");
    }

    // Memory intensive
    if (op.memory > 10) {
      suggestions.push(
        "This operation uses significant memory - consider in-place operations"
      );
      suggestions.push("Use buffer pooling to reduce allocation overhead");
    }

    return suggestions;
  }

  private generateRecommendations(
    bottlenecks: Bottleneck[],
    ops: OperationProfile[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === "critical") {
        recommendations.push({
          priority: "critical",
          category: "kernel_optimization",
          title: `Optimize ${bottleneck.operation}`,
          description: bottleneck.description,
          expectedImpact: bottleneck.impact * 0.4,
          effort: "medium",
          implementation: "Use optimized GPU kernels or WebGPU compute shaders",
        });
      }

      if (
        bottleneck.operation.includes("matmul") ||
        bottleneck.operation.includes("conv")
      ) {
        recommendations.push({
          priority: "high",
          category: "operator_fusion",
          title: `Fuse ${bottleneck.operation} with adjacent operations`,
          description: "Fusing matrix operations reduces memory transfers",
          expectedImpact: bottleneck.impact * 0.2,
          effort: "easy",
          implementation:
            "Use operator fusion to combine matmul/conv with activation functions",
        });
      }
    }

    // General recommendations based on overall profile
    const totalCalls = ops.reduce((sum, op) => sum + op.calls, 0);
    if (totalCalls > 500) {
      recommendations.push({
        priority: "medium",
        category: "caching",
        title: "Implement result caching",
        description: "High operation count suggests caching opportunities",
        expectedImpact: 10,
        effort: "easy",
        implementation: "Cache embeddings and intermediate results",
      });
    }

    return recommendations.sort((a, b) => b.expectedImpact - a.expectedImpact);
  }

  private buildMetadata(partial?: Partial<ProfileMetadata>): ProfileMetadata {
    return {
      timestamp: Date.now(),
      deviceInfo: this.getDeviceInfo(),
      modelInfo: this.getModelInfo(),
      inputShape: [],
      batchSize: 1,
      framework: "webgpu",
      ...partial,
    };
  }

  private getDeviceInfo(): DeviceInfo {
    // Try to get GPU info from WebGPU
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      const adapter = (navigator as any).gpu;
      return {
        gpuModel: adapter?.adapter || "unknown",
        vram: 0, // WebGPU doesn't expose VRAM
        computeUnits: 0,
        maxFrequency: 0,
        os: navigator.platform,
        browser: navigator.userAgent,
      };
    }

    return {
      gpuModel: "unknown",
      vram: 0,
      computeUnits: 0,
      maxFrequency: 0,
      os: "unknown",
    };
  }

  private getModelInfo(): ModelInfo {
    return {
      name: "VL-JEPA",
      version: "1.0.0",
      parameters: 0,
      quantization: "float16",
    };
  }

  private getCurrentMemory(): number {
    if (typeof performance !== "undefined" && "memory" in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  private calculatePeakMemory(): number {
    if (this.memorySnapshots.length === 0) {
      return 0;
    }
    return Math.max(...this.memorySnapshots.map(s => s.memory));
  }

  private calculateAverageGPU(): number {
    if (this.gpuSnapshots.length === 0) {
      return 0;
    }
    return (
      this.gpuSnapshots.reduce((sum, s) => sum + s.utilization, 0) /
      this.gpuSnapshots.length
    );
  }

  private startMemorySampling(): void {
    const interval = 1000 / this.config.samplingRate;
    let sampleId: number | null = null;

    const sample = () => {
      if (!this.enabled) {
        return;
      }

      this.memorySnapshots.push({
        timestamp: performance.now(),
        memory: this.getCurrentMemory(),
      });

      sampleId = window.setTimeout(sample, interval);
    };

    sample();
  }

  private stopMemorySampling(): void {
    // Sampling will stop naturally when enabled = false
  }

  private startGPUSampling(): void {
    // GPU sampling requires WebGPU timestamp queries
    // This is a placeholder for GPU-specific sampling logic
  }

  private stopGPUSampling(): void {
    // GPU sampling cleanup
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface OperationData {
  name: string;
  latencies: number[];
  memoryDeltas: number[];
  calls: number;
  failures: number;
}

interface MemorySnapshot {
  timestamp: number;
  memory: number;
}

interface GPUSnapshot {
  timestamp: number;
  utilization: number;
}

interface CallFrame {
  name: string;
  start: number;
  depth: number;
}

export interface ProfilerState {
  enabled: boolean;
  duration: number;
  operationCount: number;
  memorySnapshots: number;
  gpuSnapshots: number;
  callStackDepth: number;
}

// ============================================================================
// BOTTLENECK ANALYZER
// ============================================================================

export class BottleneckAnalyzer {
  constructor(private profiler: Profiler) {}

  /**
   * Get top N bottlenecks by impact
   */
  getTopBottlenecks(n: number = 5): Bottleneck[] {
    const results = this.profiler.getResults();
    return results.bottlenecks.slice(0, n);
  }

  /**
   * Get bottlenecks by severity
   */
  getBottlenecksBySeverity(severity: Bottleneck["severity"]): Bottleneck[] {
    const results = this.profiler.getResults();
    return results.bottlenecks.filter(b => b.severity === severity);
  }

  /**
   * Get optimization roadmap
   */
  getOptimizationRoadmap(): OptimizationRoadmap {
    const results = this.profiler.getResults();
    const totalImpact = results.bottlenecks.reduce(
      (sum, b) => sum + b.impact,
      0
    );
    const potentialSpeedup =
      results.totalLatency / (results.totalLatency - totalImpact);

    return {
      currentLatency: results.totalLatency,
      targetLatency: 50, // 50ms target
      potentialLatency: results.totalLatency - totalImpact,
      potentialSpeedup,
      bottlenecks: results.bottlenecks.length,
      recommendations: results.recommendations.length,
      priority: this.determinePriority(results.totalLatency),
    };
  }

  private determinePriority(
    latency: number
  ): "low" | "medium" | "high" | "critical" {
    if (latency < 50) return "low";
    if (latency < 100) return "medium";
    if (latency < 200) return "high";
    return "critical";
  }
}

interface OptimizationRoadmap {
  currentLatency: number;
  targetLatency: number;
  potentialLatency: number;
  potentialSpeedup: number;
  bottlenecks: number;
  recommendations: number;
  priority: "low" | "medium" | "high" | "critical";
}
