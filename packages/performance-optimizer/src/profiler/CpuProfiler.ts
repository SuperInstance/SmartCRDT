/**
 * Enhanced CPU Profiler with Flame Graph Generation
 *
 * Features:
 * - CPU usage sampling with stack traces
 * - Flame graph generation for visualization
 * - Hot path detection and analysis
 * - Call graph construction
 * - Function-level timing statistics
 * - Bottleneck identification
 *
 * @module @lsi/performance-optimizer/profiler/CpuProfiler
 */

import type {
  CpuProfileSample,
  StackFrame,
  FlameGraphNode,
  HotPath,
  CpuProfilingReport,
  ProfilingOptions,
} from "@lsi/protocol";

/**
 * Enhanced CPU profiler with flame graph and hot path detection
 */
export class CpuProfiler {
  private samples: CpuProfileSample[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private samplingInterval: number;
  private enableStackTraces: boolean;
  private enableFlameGraph: boolean;
  private hotPathThreshold: number;
  private samplingTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private lastCpuUsage: NodeJS.CpuUsageResult = { user: 0, system: 0 };

  constructor(options: Required<ProfilingOptions["cpu"]>) {
    this.samplingInterval = options.samplingInterval;
    this.enableStackTraces = options.enableStackTraces;
    this.enableFlameGraph = options.enableFlameGraph;
    this.hotPathThreshold = options.hotPathThreshold;
  }

  /**
   * Start CPU profiling
   */
  start(): void {
    if (this.isRunning) {
      throw new Error("CPU profiler is already running");
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.samples = [];
    this.lastCpuUsage = process.cpuUsage();

    // Start sampling
    this.samplingTimer = setInterval(() => {
      this.collectSample();
    }, this.samplingInterval);
  }

  /**
   * Stop CPU profiling
   */
  stop(): void {
    if (!this.isRunning) {
      throw new Error("CPU profiler is not running");
    }

    this.isRunning = false;
    this.endTime = Date.now();

    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }

    // Collect final sample
    this.collectSample();
  }

  /**
   * Collect a CPU sample
   */
  private collectSample(): void {
    const cpuUsage = process.cpuUsage();
    const timestamp = Date.now();

    // Calculate CPU usage percentage based on delta since last sample
    const userDelta = cpuUsage.user - this.lastCpuUsage.user;
    const systemDelta = cpuUsage.system - this.lastCpuUsage.system;

    // Estimate elapsed time (in case setInterval drifted)
    const elapsedTime = this.samples.length > 0
      ? timestamp - this.samples[this.samples.length - 1].timestamp
      : this.samplingInterval;

    // CPU usage percentage: (cpu time / elapsed time) * 100
    // Both are in microseconds, so we divide by 1000 to get milliseconds
    const cpuTimeMs = (userDelta + systemDelta) / 1000;
    const cpuUsagePercent = Math.min(100, Math.max(0, (cpuTimeMs / elapsedTime) * 100));

    const sample: CpuProfileSample = {
      timestamp,
      cpuUsage: cpuUsagePercent,
      userCpuTime: userDelta / 1000,
      systemCpuTime: systemDelta / 1000,
    };

    // Update last CPU usage
    this.lastCpuUsage = cpuUsage;

    // Capture stack trace if enabled
    if (this.enableStackTraces) {
      sample.stackTrace = this.captureStackTrace();
    }

    this.samples.push(sample);
  }

  /**
   * Capture current stack trace
   */
  private captureStackTrace(): StackFrame[] {
    const stack = new Error().stack;
    if (!stack) return [];

    const frames: StackFrame[] = [];
    const lines = stack.split("\n").slice(2); // Skip "Error:" and this function

    for (const line of lines) {
      const match = line.match(/\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, name, file, lineNum, column] = match;
        frames.push({
          name: name.trim(),
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: parseInt(column, 10),
          isNative: file === "native",
          isFramework: this.isFrameworkFunction(file),
        });
      }
    }

    return frames;
  }

  /**
   * Determine if a function is from a framework
   */
  private isFrameworkFunction(file: string): boolean {
    return (
      file.includes("node_modules/") ||
      file.startsWith("internal/") ||
      file.startsWith("native ")
    );
  }

  /**
   * Generate flame graph from samples
   */
  private generateFlameGraph(): FlameGraphNode {
    // Group samples by call tree
    const callTree = new Map<string, FlameGraphNode>();
    const root: FlameGraphNode = {
      name: "root",
      file: "",
      line: 0,
      totalTime: 0,
      selfTime: 0,
      percentage: 0,
      sampleCount: 0,
      children: [],
      parent: null,
      depth: 0,
    };

    for (const sample of this.samples) {
      if (!sample.stackTrace || sample.stackTrace.length === 0) {
        root.totalTime += this.samplingInterval;
        root.sampleCount++;
        continue;
      }

      let currentNode = root;
      currentNode.totalTime += this.samplingInterval;
      currentNode.sampleCount++;

      // Walk up the stack (reverse order)
      for (let i = sample.stackTrace.length - 1; i >= 0; i--) {
        const frame = sample.stackTrace[i];
        const key = `${frame.file}:${frame.line}:${frame.name}`;

        let node = currentNode.children.find((child) => child.name === frame.name);

        if (!node) {
          node = {
            name: frame.name,
            file: frame.file,
            line: frame.line,
            totalTime: 0,
            selfTime: 0,
            percentage: 0,
            sampleCount: 0,
            children: [],
            parent: currentNode,
            depth: currentNode.depth + 1,
          };
          currentNode.children.push(node);
        }

        node.totalTime += this.samplingInterval;
        node.sampleCount++;

        // If this is the leaf frame, add to self time
        if (i === 0) {
          node.selfTime += this.samplingInterval;
        }

        currentNode = node;
      }
    }

    // Calculate percentages
    const totalSamples = root.sampleCount;
    this.calculatePercentages(root, root.totalTime);

    return root;
  }

  /**
   * Calculate percentages for flame graph nodes
   */
  private calculatePercentages(node: FlameGraphNode, totalTime: number): void {
    node.percentage = (node.totalTime / totalTime) * 100;

    for (const child of node.children) {
      this.calculatePercentages(child, totalTime);
    }
  }

  /**
   * Detect hot paths from flame graph
   */
  private detectHotPaths(flameGraph: FlameGraphNode): HotPath[] {
    const hotPaths: HotPath[] = [];
    const totalTime = flameGraph.totalTime;

    const traverse = (node: FlameGraphNode) => {
      // Skip root node
      if (node.name !== "root") {
        const impactScore = node.percentage / 100;
        const optimizationPotential = this.calculateOptimizationPotential(node);

        if (node.percentage >= this.hotPathThreshold) {
          hotPaths.push({
            functionName: node.name,
            file: node.file,
            line: node.line,
            totalTime: node.totalTime,
            percentage: node.percentage,
            callCount: node.sampleCount,
            avgTimePerCall: node.totalTime / node.sampleCount,
            impactScore,
            optimizationPotential,
          });
        }
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(flameGraph);

    // Sort by percentage descending
    hotPaths.sort((a, b) => b.percentage - a.percentage);

    return hotPaths.slice(0, 20); // Top 20 hot paths
  }

  /**
   * Calculate optimization potential for a function
   */
  private calculateOptimizationPotential(node: FlameGraphNode): number {
    // Factors that increase optimization potential:
    // 1. High self time vs total time (function does work itself)
    // 2. High call count (called frequently)
    // 3. Not a framework function (we can optimize it)
    // 4. Shallow depth (closer to application code)

    const selfTimeRatio = node.selfTime / node.totalTime;
    const isFramework = this.isFrameworkFunction(node.file);
    const depthFactor = Math.max(0, 1 - node.depth / 20); // Decreases with depth

    let potential = selfTimeRatio * 0.4 + depthFactor * 0.3;
    if (!isFramework) {
      potential += 0.3; // Bonus for non-framework code
    }

    return Math.min(1, Math.max(0, potential));
  }

  /**
   * Get top functions by self time
   */
  private getTopFunctionsBySelfTime(flameGraph: FlameGraphNode): Array<{
    name: string;
    file: string;
    line: number;
    selfTime: number;
    percentage: number;
  }> {
    const functions: Array<{
      name: string;
      file: string;
      line: number;
      selfTime: number;
      percentage: number;
    }> = [];

    const traverse = (node: FlameGraphNode) => {
      if (node.name !== "root" && node.selfTime > 0) {
        functions.push({
          name: node.name,
          file: node.file,
          line: node.line,
          selfTime: node.selfTime,
          percentage: (node.selfTime / flameGraph.totalTime) * 100,
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(flameGraph);

    // Sort by self time descending
    functions.sort((a, b) => b.selfTime - a.selfTime);

    return functions.slice(0, 10);
  }

  /**
   * Get top functions by total time
   */
  private getTopFunctionsByTotalTime(flameGraph: FlameGraphNode): Array<{
    name: string;
    file: string;
    line: number;
    totalTime: number;
    percentage: number;
  }> {
    const functions: Array<{
      name: string;
      file: string;
      line: number;
      totalTime: number;
      percentage: number;
    }> = [];

    const traverse = (node: FlameGraphNode) => {
      if (node.name !== "root") {
        functions.push({
          name: node.name,
          file: node.file,
          line: node.line,
          totalTime: node.totalTime,
          percentage: node.percentage,
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(flameGraph);

    // Sort by total time descending
    functions.sort((a, b) => b.totalTime - a.totalTime);

    return functions.slice(0, 10);
  }

  /**
   * Calculate call graph statistics
   */
  private calculateCallGraphStats(flameGraph: FlameGraphNode): {
    totalFunctions: number;
    maxDepth: number;
    avgDepth: number;
    branchingFactor: number;
  } {
    let totalFunctions = 0;
    let maxDepth = 0;
    let totalDepth = 0;
    let functionCount = 0;

    const traverse = (node: FlameGraphNode) => {
      if (node.name !== "root") {
        totalFunctions++;
        totalDepth += node.depth;
        functionCount++;
        maxDepth = Math.max(maxDepth, node.depth);
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(flameGraph);

    const avgDepth = functionCount > 0 ? totalDepth / functionCount : 0;
    const branchingFactor = functionCount > 0 ? totalFunctions / functionCount : 0;

    return {
      totalFunctions,
      maxDepth,
      avgDepth,
      branchingFactor,
    };
  }

  /**
   * Generate CPU usage histogram
   */
  private generateUsageHistogram(): Array<{
    range: string;
    count: number;
    percentage: number;
  }> {
    const buckets = [
      { range: "0-10%", min: 0, max: 10, count: 0 },
      { range: "10-20%", min: 10, max: 20, count: 0 },
      { range: "20-30%", min: 20, max: 30, count: 0 },
      { range: "30-40%", min: 30, max: 40, count: 0 },
      { range: "40-50%", min: 40, max: 50, count: 0 },
      { range: "50-60%", min: 50, max: 60, count: 0 },
      { range: "60-70%", min: 60, max: 70, count: 0 },
      { range: "70-80%", min: 70, max: 80, count: 0 },
      { range: "80-90%", min: 80, max: 90, count: 0 },
      { range: "90-100%", min: 90, max: 100, count: 0 },
    ];

    for (const sample of this.samples) {
      for (const bucket of buckets) {
        if (sample.cpuUsage >= bucket.min && sample.cpuUsage < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    const totalSamples = this.samples.length;

    return buckets.map((bucket) => ({
      range: bucket.range,
      count: bucket.count,
      percentage: totalSamples > 0 ? (bucket.count / totalSamples) * 100 : 0,
    }));
  }

  /**
   * Generate comprehensive CPU profiling report
   */
  generateReport(): CpuProfilingReport {
    if (this.samples.length === 0) {
      throw new Error("No samples collected. Run profiler first.");
    }

    const totalDuration = this.endTime - this.startTime || Date.now() - this.startTime;
    const cpuUsages = this.samples.map((s) => s.cpuUsage);
    const averageCpuUsage = cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length;
    const peakCpuUsage = Math.max(...cpuUsages);

    // Generate flame graph if enabled
    const flameGraph = this.enableFlameGraph ? this.generateFlameGraph() : {
      name: "root",
      file: "",
      line: 0,
      totalTime: totalDuration,
      selfTime: 0,
      percentage: 100,
      sampleCount: this.samples.length,
      children: [],
      parent: null,
      depth: 0,
    } as FlameGraphNode;

    // Detect hot paths
    const hotPaths = this.detectHotPaths(flameGraph);

    // Get top functions
    const topFunctionsBySelfTime = this.getTopFunctionsBySelfTime(flameGraph);
    const topFunctionsByTotalTime = this.getTopFunctionsByTotalTime(flameGraph);

    // Calculate call graph stats
    const callGraphStats = this.calculateCallGraphStats(flameGraph);

    // Generate usage histogram
    const usageHistogram = this.generateUsageHistogram();

    return {
      totalDuration,
      averageCpuUsage,
      peakCpuUsage,
      usageHistogram,
      flameGraph,
      hotPaths,
      topFunctionsBySelfTime,
      topFunctionsByTotalTime,
      callGraphStats,
    };
  }

  /**
   * Get raw samples
   */
  getSamples(): CpuProfileSample[] {
    return this.samples;
  }

  /**
   * Clear all samples
   */
  clear(): void {
    this.samples = [];
    this.startTime = 0;
    this.endTime = 0;
  }

  /**
   * Check if profiler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
