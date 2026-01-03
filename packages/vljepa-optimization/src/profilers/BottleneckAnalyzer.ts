/**
 * Bottleneck Analyzer
 * Analyzes profiling results to identify and categorize performance bottlenecks
 */

import type {
  ProfileResult,
  Bottleneck,
  OperationProfile,
  OptimizationRecommendation,
} from "../types.js";

export interface BottleneckReport {
  summary: BottleneckSummary;
  critical: Bottleneck[];
  high: Bottleneck[];
  medium: Bottleneck[];
  low: Bottleneck[];
  categories: BottleneckCategory[];
  optimizationPlan: OptimizationPlan;
}

export interface BottleneckSummary {
  totalBottlenecks: number;
  totalImpact: number;
  potentialSpeedup: number;
  currentLatency: number;
  targetLatency: number;
  achievable: boolean;
}

export interface BottleneckCategory {
  name: string;
  count: number;
  totalImpact: number;
  bottlenecks: Bottleneck[];
}

export interface OptimizationPlan {
  phases: OptimizationPhase[];
  expectedReduction: number;
  estimatedEffort: string;
}

export interface OptimizationPhase {
  phase: number;
  title: string;
  bottlenecks: Bottleneck[];
  expectedReduction: number;
  effort: "trivial" | "easy" | "medium" | "hard";
  duration: string;
}

export class BottleneckAnalyzer {
  constructor(private targetLatency: number = 50) {}

  /**
   * Analyze profiling results and generate bottleneck report
   */
  analyze(results: ProfileResult): BottleneckReport {
    const summary = this.generateSummary(results);
    const categorized = this.categorizeBottlenecks(results.bottlenecks);
    const categories = this.groupByCategory(results.bottlenecks);
    const optimizationPlan = this.createOptimizationPlan(categorized, results);

    return {
      summary,
      critical: categorized.critical,
      high: categorized.high,
      medium: categorized.medium,
      low: categorized.low,
      categories,
      optimizationPlan,
    };
  }

  /**
   * Get quick assessment of profile results
   */
  assess(results: ProfileResult): BottleneckAssessment {
    const totalImpact = results.bottlenecks.reduce(
      (sum, b) => sum + b.impact,
      0
    );
    const potentialLatency = results.totalLatency - totalImpact;
    const achievable = potentialLatency <= this.targetLatency;

    return {
      current: results.totalLatency,
      potential: potentialLatency,
      target: this.targetLatency,
      achievable,
      gap: achievable ? 0 : potentialLatency - this.targetLatency,
      priority: this.calculatePriority(results.totalLatency),
      topBottleneck: results.bottlenecks[0]?.operation || "None",
    };
  }

  /**
   * Find bottlenecks by operation type
   */
  findByType(results: ProfileResult, type: string): Bottleneck[] {
    return results.bottlenecks.filter(b => b.operation.includes(type));
  }

  /**
   * Find bottlenecks by severity
   */
  findBySeverity(
    results: ProfileResult,
    severity: Bottleneck["severity"]
  ): Bottleneck[] {
    return results.bottlenecks.filter(b => b.severity === severity);
  }

  /**
   * Calculate ROI for addressing a bottleneck
   */
  calculateROI(
    bottleneck: Bottleneck,
    effort: "trivial" | "easy" | "medium" | "hard"
  ): number {
    const effortScore = { trivial: 1, easy: 2, medium: 4, hard: 8 };
    return bottleneck.impact / effortScore[effort];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateSummary(results: ProfileResult): BottleneckSummary {
    const totalImpact = results.bottlenecks.reduce(
      (sum, b) => sum + b.impact,
      0
    );
    const potentialLatency = results.totalLatency - totalImpact;
    const potentialSpeedup =
      results.totalLatency / Math.max(potentialLatency, 1);
    const achievable = potentialLatency <= this.targetLatency;

    return {
      totalBottlenecks: results.bottlenecks.length,
      totalImpact,
      potentialSpeedup,
      currentLatency: results.totalLatency,
      targetLatency: this.targetLatency,
      achievable,
    };
  }

  private categorizeBottlenecks(
    bottlenecks: Bottleneck[]
  ): CategorizedBottlenecks {
    return {
      critical: bottlenecks.filter(b => b.severity === "critical"),
      high: bottlenecks.filter(b => b.severity === "high"),
      medium: bottlenecks.filter(b => b.severity === "medium"),
      low: bottlenecks.filter(b => b.severity === "low"),
    };
  }

  private groupByCategory(bottlenecks: Bottleneck[]): BottleneckCategory[] {
    const groups = new Map<string, Bottleneck[]>();

    for (const bottleneck of bottlenecks) {
      const category = this.categorizeOperation(bottleneck.operation);
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(bottleneck);
    }

    return Array.from(groups.entries())
      .map(([name, bottlenecks]) => ({
        name,
        count: bottlenecks.length,
        totalImpact: bottlenecks.reduce((sum, b) => sum + b.impact, 0),
        bottlenecks,
      }))
      .sort((a, b) => b.totalImpact - a.totalImpact);
  }

  private categorizeOperation(operation: string): string {
    if (operation.includes("matmul") || operation.includes("gemm")) {
      return "Matrix Operations";
    }
    if (operation.includes("conv") || operation.includes("pool")) {
      return "Convolution/Pooling";
    }
    if (operation.includes("encoder") || operation.includes("decoder")) {
      return "Encoder/Decoder";
    }
    if (operation.includes("attention") || operation.includes("self_attn")) {
      return "Attention";
    }
    if (
      operation.includes("norm") ||
      operation.includes("layer") ||
      operation.includes("batch")
    ) {
      return "Normalization";
    }
    if (operation.includes("memory") || operation.includes("alloc")) {
      return "Memory Management";
    }
    if (operation.includes("transfer") || operation.includes("copy")) {
      return "Data Transfer";
    }
    return "Other";
  }

  private createOptimizationPlan(
    categorized: CategorizedBottlenecks,
    results: ProfileResult
  ): OptimizationPlan {
    const phases: OptimizationPhase[] = [];
    let expectedReduction = 0;

    // Phase 1: Quick wins (trivial/easy, critical/high severity)
    const quickWins = [
      ...categorized.critical.filter(b => this.hasQuickWin(b)),
      ...categorized.high.filter(b => this.hasQuickWin(b)),
    ];

    if (quickWins.length > 0) {
      const reduction = quickWins.reduce((sum, b) => sum + b.impact * 0.3, 0);
      expectedReduction += reduction;
      phases.push({
        phase: 1,
        title: "Quick Wins",
        bottlenecks: quickWins,
        expectedReduction: reduction,
        effort: "easy",
        duration: this.estimateDuration(quickWins, "easy"),
      });
    }

    // Phase 2: Medium effort fixes
    const mediumFixes = [
      ...categorized.critical.filter(b => !this.hasQuickWin(b)),
      ...categorized.high,
      ...categorized.medium.filter(b => b.impact > 10),
    ];

    if (mediumFixes.length > 0) {
      const reduction = mediumFixes.reduce((sum, b) => sum + b.impact * 0.5, 0);
      expectedReduction += reduction;
      phases.push({
        phase: 2,
        title: "Medium-Effort Optimizations",
        bottlenecks: mediumFixes,
        expectedReduction: reduction,
        effort: "medium",
        duration: this.estimateDuration(mediumFixes, "medium"),
      });
    }

    // Phase 3: Hard fixes if needed
    const potentialLatency = results.totalLatency - expectedReduction;
    if (potentialLatency > this.targetLatency) {
      const hardFixes = [...categorized.medium, ...categorized.low];
      const reduction = hardFixes.reduce((sum, b) => sum + b.impact * 0.7, 0);
      phases.push({
        phase: 3,
        title: "Advanced Optimizations",
        bottlenecks: hardFixes,
        expectedReduction: reduction,
        effort: "hard",
        duration: this.estimateDuration(hardFixes, "hard"),
      });
    }

    return {
      phases,
      expectedReduction,
      estimatedEffort: this.estimateTotalEffort(phases),
    };
  }

  private hasQuickWin(bottleneck: Bottleneck): boolean {
    const quickWinPatterns = ["memory", "copy", "transfer", "alloc"];
    return quickWinPatterns.some(pattern =>
      bottleneck.operation.toLowerCase().includes(pattern)
    );
  }

  private estimateDuration(bottlenecks: Bottleneck[], effort: string): string {
    const baseDurations = {
      trivial: 0.5, // days
      easy: 2,
      medium: 5,
      hard: 10,
    };

    const base = baseDurations[effort as keyof typeof baseDurations] || 5;
    const total = base * bottlenecks.length;

    if (total < 1) return "< 1 day";
    if (total < 5) return `${Math.ceil(total)} days`;
    if (total < 20) return `${Math.ceil(total / 5)} weeks`;
    return `${Math.ceil(total / 20)} months`;
  }

  private estimateTotalEffort(phases: OptimizationPhase[]): string {
    const totalDays = phases.reduce((sum, phase) => {
      const duration = phase.duration;
      if (duration.includes("< 1 day")) return sum + 0.5;
      if (duration.includes("days")) return sum + parseInt(duration);
      if (duration.includes("weeks")) return sum + parseInt(duration) * 5;
      if (duration.includes("months")) return sum + parseInt(duration) * 20;
      return sum;
    }, 0);

    if (totalDays < 5) return `${Math.ceil(totalDays)} days`;
    if (totalDays < 20) return `${Math.ceil(totalDays / 5)} weeks`;
    return `${Math.ceil(totalDays / 20)} months`;
  }

  private calculatePriority(
    latency: number
  ): "low" | "medium" | "high" | "critical" {
    if (latency < 50) return "low";
    if (latency < 100) return "medium";
    if (latency < 200) return "high";
    return "critical";
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface CategorizedBottlenecks {
  critical: Bottleneck[];
  high: Bottleneck[];
  medium: Bottleneck[];
  low: Bottleneck[];
}

export interface BottleneckAssessment {
  current: number;
  potential: number;
  target: number;
  achievable: boolean;
  gap: number;
  priority: "low" | "medium" | "high" | "critical";
  topBottleneck: string;
}

// ============================================================================
// MEMORY PROFILER
// ============================================================================

export interface MemoryProfile {
  peakMemory: number;
  averageMemory: number;
  allocations: number[];
  deallocations: number[];
  fragmentation: number;
  timeline: MemoryEvent[];
}

export interface MemoryEvent {
  timestamp: number;
  type: "allocate" | "deallocate" | "peak";
  size: number;
  operation?: string;
}

export class MemoryProfiler {
  private events: MemoryEvent[] = [];
  private allocations: Map<
    number,
    { size: number; operation: string; timestamp: number }
  > = new Map();
  private nextId = 0;
  private peakMemory = 0;
  private currentMemory = 0;

  /**
   * Start memory profiling
   */
  start(): void {
    this.events = [];
    this.allocations.clear();
    this.peakMemory = 0;
    this.currentMemory = 0;
  }

  /**
   * Record a memory allocation
   */
  allocate(size: number, operation: string): number {
    const id = this.nextId++;
    this.allocations.set(id, { size, operation, timestamp: performance.now() });
    this.currentMemory += size;
    this.peakMemory = Math.max(this.peakMemory, this.currentMemory);

    this.events.push({
      timestamp: performance.now(),
      type: "allocate",
      size,
      operation,
    });

    return id;
  }

  /**
   * Record a memory deallocation
   */
  deallocate(id: number): void {
    const allocation = this.allocations.get(id);
    if (!allocation) return;

    this.currentMemory -= allocation.size;
    this.allocations.delete(id);

    this.events.push({
      timestamp: performance.now(),
      type: "deallocate",
      size: allocation.size,
      operation: allocation.operation,
    });
  }

  /**
   * Stop profiling and get results
   */
  stop(): MemoryProfile {
    const allocations = this.events
      .filter(e => e.type === "allocate")
      .map(e => e.size);

    const deallocations = this.events
      .filter(e => e.type === "deallocate")
      .map(e => e.size);

    return {
      peakMemory: this.peakMemory,
      averageMemory: this.calculateAverageMemory(),
      allocations,
      deallocations,
      fragmentation: this.calculateFragmentation(),
      timeline: [...this.events],
    };
  }

  /**
   * Get memory usage at a specific time
   */
  getMemoryAtTime(timestamp: number): number {
    let memory = 0;
    for (const event of this.events) {
      if (event.timestamp > timestamp) break;
      if (event.type === "allocate") {
        memory += event.size;
      } else {
        memory -= event.size;
      }
    }
    return memory;
  }

  /**
   * Find memory leaks (allocations without deallocations)
   */
  findLeaks(): Array<{ operation: string; size: number; age: number }> {
    const now = performance.now();
    return Array.from(this.allocations.values()).map(alloc => ({
      operation: alloc.operation,
      size: alloc.size,
      age: now - alloc.timestamp,
    }));
  }

  private calculateAverageMemory(): number {
    if (this.events.length === 0) return 0;

    let total = 0;
    let lastTime = this.events[0].timestamp;
    let memory = 0;

    for (const event of this.events) {
      const duration = event.timestamp - lastTime;
      total += memory * duration;
      lastTime = event.timestamp;

      if (event.type === "allocate") {
        memory += event.size;
      } else {
        memory -= event.size;
      }
    }

    const totalTime =
      this.events[this.events.length - 1].timestamp - this.events[0].timestamp;
    return total / totalTime;
  }

  private calculateFragmentation(): number {
    const totalAllocated = this.currentMemory;
    const totalReserved = Array.from(this.allocations.values()).reduce(
      (sum, a) => sum + a.size,
      0
    );
    return totalReserved > 0 ? 1 - totalAllocated / totalReserved : 0;
  }
}
