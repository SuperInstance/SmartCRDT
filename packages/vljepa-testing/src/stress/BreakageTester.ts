/**
 * BreakageTester - Find and analyze the exact breaking point
 * Provides detailed analysis of how and why the system fails.
 */

import type { TestRequest, StressTestConfig, LoadPoint } from "../types.js";

export interface BreakageTestConfig {
  startLoad: number;
  maxLoad: number;
  increment: number;
  holdTimePerLevel: number;
  convergenceThreshold: number;
  refineAfterBreak: boolean;
  refineGranularity: number;
}

export interface BreakageTestResult {
  breakingPoint: number;
  confidence: number;
  failureMode: FailureMode;
  breakingLatency: number;
  breakingErrorRate: number;
  systemStateAtBreak: SystemState;
  loadPoints: LoadPoint[];
  analysis: BreakageAnalysis;
  recommendations: string[];
}

export interface FailureMode {
  category:
    | "latency"
    | "error_rate"
    | "resource_exhaustion"
    | "cascading"
    | "unknown";
  description: string;
  severity: "minor" | "moderate" | "major" | "critical";
  recoverable: boolean;
}

export interface SystemState {
  cpu: number;
  memory: number;
  connections: number;
  queueDepth: number;
  errors: string[];
}

export interface BreakageAnalysis {
  degradationCurve: DegradationPoint[];
  tippingPoint: number;
  graceful: boolean;
  warningSigns: string[];
  resourceBottleneck: string | null;
}

export interface DegradationPoint {
  load: number;
  latencyRatio: number;
  errorRateRatio: number;
  healthScore: number;
}

export interface BreakageTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  healthCheck(): Promise<SystemState>;
  getMetrics(): Promise<{ cpu: number; memory: number; connections: number }>;
}

export class BreakageTester {
  /**
   * Execute breakage test to find exact breaking point
   */
  async execute(
    config: BreakageTestConfig,
    executor: BreakageTestExecutor
  ): Promise<BreakageTestResult> {
    const startTime = Date.now();

    // Coarse search to find approximate breaking point
    const coarseResult = await this.coarseSearch(config, executor);

    // Fine-grained refinement
    let breakingPoint = coarseResult.breakingPoint;
    let loadPoints = coarseResult.loadPoints;

    if (config.refineAfterBreak && breakingPoint > 0) {
      const refinedResult = await this.refineBreakage(
        config,
        executor,
        breakingPoint,
        coarseResult.lastSafeLoad
      );
      breakingPoint = refinedResult.breakingPoint;
      loadPoints = refinedResult.loadPoints;
    }

    // Analyze failure
    const failureMode = await this.classifyFailure(
      executor,
      breakingPoint,
      loadPoints
    );
    const analysis = await this.analyzeBreakage(loadPoints, breakingPoint);

    const endTime = Date.now();

    return {
      breakingPoint,
      confidence: this.calculateConfidence(loadPoints, breakingPoint),
      failureMode,
      breakingLatency: this.getLatencyAtBreak(loadPoints, breakingPoint),
      breakingErrorRate: this.getErrorRateAtBreak(loadPoints, breakingPoint),
      systemStateAtBreak: await this.getSystemState(executor, breakingPoint),
      loadPoints,
      analysis,
      recommendations: this.generateRecommendations(failureMode, analysis),
      success: true,
      duration: endTime - startTime,
      timestamp: startTime,
    };
  }

  /**
   * Coarse search to find approximate breaking point
   */
  private async coarseSearch(
    config: BreakageTestConfig,
    executor: BreakageTestExecutor
  ): Promise<{
    breakingPoint: number;
    lastSafeLoad: number;
    loadPoints: LoadPoint[];
  }> {
    const loadPoints: LoadPoint[] = [];
    let breakingPoint = 0;
    let lastSafeLoad = 0;
    let currentLoad = config.startLoad;

    while (currentLoad <= config.maxLoad) {
      const point = await this.testLoadPoint(currentLoad, config, executor);
      loadPoints.push(point);

      const isBreaking = this.isBreakingPoint(
        point,
        config.convergenceThreshold
      );

      if (isBreaking) {
        breakingPoint = currentLoad;
        break;
      }

      lastSafeLoad = currentLoad;
      currentLoad += config.increment;
    }

    // If we never broke, mark max load as breaking point
    if (breakingPoint === 0) {
      breakingPoint = config.maxLoad;
    }

    return { breakingPoint, lastSafeLoad, loadPoints };
  }

  /**
   * Refine breaking point with finer granularity
   */
  private async refineBreakage(
    config: BreakageTestConfig,
    executor: BreakageTestExecutor,
    coarseBreakPoint: number,
    lastSafeLoad: number
  ): Promise<{ breakingPoint: number; loadPoints: LoadPoint[] }> {
    const loadPoints: LoadPoint[] = [];
    const refinementRange = coarseBreakPoint - lastSafeLoad;
    const fineIncrement = Math.max(1, Math.floor(refinementRange / 10));

    let breakingPoint = coarseBreakPoint;
    let currentLoad = lastSafeLoad + fineIncrement;

    while (currentLoad <= coarseBreakPoint) {
      const point = await this.testLoadPoint(currentLoad, config, executor);
      loadPoints.push(point);

      if (this.isBreakingPoint(point, config.convergenceThreshold)) {
        breakingPoint = currentLoad;
        break;
      }

      currentLoad += fineIncrement;
    }

    return { breakingPoint, loadPoints };
  }

  /**
   * Test a specific load point
   */
  private async testLoadPoint(
    load: number,
    config: BreakageTestConfig,
    executor: BreakageTestExecutor
  ): Promise<LoadPoint> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let successes = 0;
    let failures = 0;

    while (Date.now() - startTime < config.holdTimePerLevel) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < Math.min(load, 50); i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i);
            const start = performance.now();

            try {
              const result = await executor.execute(request);
              const latency = performance.now() - start;
              latencies.push(latency);

              if (result.success) {
                successes++;
              } else {
                failures++;
              }
            } catch {
              failures++;
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    const sorted = latencies.sort((a, b) => a - b);

    return {
      load,
      requests: successes + failures,
      successes,
      failures,
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      errorRate:
        successes + failures > 0 ? failures / (successes + failures) : 0,
    };
  }

  /**
   * Determine if this is a breaking point
   */
  private isBreakingPoint(point: LoadPoint, threshold: number): boolean {
    return (
      point.errorRate > threshold ||
      point.p95Latency > 30000 ||
      (point.requests > 0 && point.successes / point.requests < 1 - threshold)
    );
  }

  /**
   * Classify the failure mode
   */
  private async classifyFailure(
    executor: BreakageTestExecutor,
    breakingPoint: number,
    loadPoints: LoadPoint[]
  ): Promise<FailureMode> {
    const breakingPointData = loadPoints.find(p => p.load === breakingPoint);
    const previousPoint = loadPoints.find(p => p.load === breakingPoint - 1);

    if (!breakingPointData) {
      return {
        category: "unknown",
        description: "Unknown failure",
        severity: "moderate",
        recoverable: true,
      };
    }

    // Check system state
    const systemState = await executor.healthCheck().catch(() => ({
      cpu: 100,
      memory: 100,
      connections: 0,
      queueDepth: 0,
      errors: [],
    }));

    // Determine failure category
    let category: FailureMode["category"] = "unknown";
    let description = "System failed at load " + breakingPoint;
    let severity: FailureMode["severity"] = "moderate";
    let recoverable = true;

    if (systemState.cpu > 90) {
      category = "resource_exhaustion";
      description = "CPU exhaustion - system at max capacity";
      severity = "major";
      recoverable = true;
    } else if (systemState.memory > 90) {
      category = "resource_exhaustion";
      description = "Memory exhaustion - OOM likely";
      severity = "critical";
      recoverable = false;
    } else if (breakingPointData.errorRate > 0.5) {
      category = "error_rate";
      description = "High error rate - system rejecting requests";
      severity = "major";
      recoverable = true;
    } else if (breakingPointData.p95Latency > 10000) {
      category = "latency";
      description = "Latency spike - requests timing out";
      severity = "moderate";
      recoverable = true;
    } else if (
      previousPoint &&
      breakingPointData.avgLatency > previousPoint.avgLatency * 3
    ) {
      category = "cascading";
      description = "Cascading failure - rapid performance degradation";
      severity = "critical";
      recoverable = false;
    }

    return { category, description, severity, recoverable };
  }

  /**
   * Analyze the breakage pattern
   */
  private async analyzeBreakage(
    loadPoints: LoadPoint[],
    breakingPoint: number
  ): Promise<BreakageAnalysis> {
    const degradationCurve: DegradationPoint[] = [];

    // Calculate degradation curve
    const baseline = loadPoints[0];
    if (baseline) {
      for (const point of loadPoints) {
        degradationCurve.push({
          load: point.load,
          latencyRatio:
            baseline.avgLatency > 0
              ? point.avgLatency / baseline.avgLatency
              : 1,
          errorRateRatio: point.errorRate / (baseline.errorRate + 0.001),
          healthScore: this.calculateHealthScore(point),
        });
      }
    }

    // Find tipping point (where health score drops below 0.5)
    const tippingPoint = this.findTippingPoint(degradationCurve);

    // Check if failure is graceful
    const graceful = this.isGracefulFailure(loadPoints, breakingPoint);

    // Identify warning signs
    const warningSigns = this.identifyWarningSigns(degradationCurve);

    // Identify resource bottleneck
    const resourceBottleneck = this.identifyBottleneck(degradationCurve);

    return {
      degradationCurve,
      tippingPoint,
      graceful,
      warningSigns,
      resourceBottleneck,
    };
  }

  /**
   * Calculate health score (0-1, 1 is healthy)
   */
  private calculateHealthScore(point: LoadPoint): number {
    const latencyScore = Math.max(0, 1 - point.avgLatency / 10000);
    const errorScore = Math.max(0, 1 - point.errorRate * 10);
    return (latencyScore + errorScore) / 2;
  }

  /**
   * Find tipping point in degradation curve
   */
  private findTippingPoint(curve: DegradationPoint[]): number {
    for (const point of curve) {
      if (point.healthScore < 0.5) {
        return point.load;
      }
    }
    return curve[curve.length - 1]?.load ?? 0;
  }

  /**
   * Check if failure is graceful
   */
  private isGracefulFailure(
    loadPoints: LoadPoint[],
    breakingPoint: number
  ): boolean {
    const breakingIdx = loadPoints.findIndex(p => p.load === breakingPoint);
    if (breakingIdx <= 0) return false;

    const prevPoint = loadPoints[breakingIdx - 1];
    const breakPoint = loadPoints[breakingIdx];

    // Graceful if gradual degradation, not sudden
    const latencyIncrease = breakPoint.avgLatency / (prevPoint.avgLatency || 1);
    return latencyIncrease < 5; // Less than 5x sudden increase
  }

  /**
   * Identify warning signs before breakage
   */
  private identifyWarningSigns(curve: DegradationPoint[]): string[] {
    const signs: string[] = [];

    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1];
      const curr = curve[i];

      if (curr.latencyRatio > prev.latencyRatio * 1.5) {
        signs.push(`Rapid latency increase at load ${curr.load}`);
      }
      if (curr.errorRateRatio > prev.errorRateRatio * 2) {
        signs.push(`Error rate spike at load ${curr.load}`);
      }
      if (curr.healthScore < 0.7) {
        signs.push(`Health score declining at load ${curr.load}`);
      }
    }

    return signs;
  }

  /**
   * Identify primary bottleneck
   */
  private identifyBottleneck(curve: DegradationPoint[]): string | null {
    if (curve.length === 0) return null;

    const last = curve[curve.length - 1];

    if (last.latencyRatio > last.errorRateRatio * 2) {
      return "latency";
    }
    if (last.errorRateRatio > last.latencyRatio * 2) {
      return "error_rate";
    }
    return "balanced";
  }

  /**
   * Calculate confidence in breaking point
   */
  private calculateConfidence(
    loadPoints: LoadPoint[],
    breakingPoint: number
  ): number {
    const breakingIdx = loadPoints.findIndex(p => p.load === breakingPoint);

    if (breakingIdx === -1) return 0.5;

    // Higher confidence if clear breakage pattern
    const breakPoint = loadPoints[breakingIdx];
    const prevPoint = loadPoints[breakingIdx - 1];

    if (!prevPoint) return 0.7;

    const errorJump = breakPoint.errorRate - prevPoint.errorRate;
    const latencyJump =
      (breakPoint.avgLatency - prevPoint.avgLatency) /
      (prevPoint.avgLatency || 1);

    if (errorJump > 0.3 || latencyJump > 2) {
      return 0.95; // Clear breaking point
    }
    if (errorJump > 0.1 || latencyJump > 1) {
      return 0.8; // Likely breaking point
    }
    return 0.6; // Uncertain
  }

  /**
   * Get latency at breaking point
   */
  private getLatencyAtBreak(
    loadPoints: LoadPoint[],
    breakingPoint: number
  ): number {
    const point = loadPoints.find(p => p.load === breakingPoint);
    return point?.avgLatency ?? 0;
  }

  /**
   * Get error rate at breaking point
   */
  private getErrorRateAtBreak(
    loadPoints: LoadPoint[],
    breakingPoint: number
  ): number {
    const point = loadPoints.find(p => p.load === breakingPoint);
    return point?.errorRate ?? 0;
  }

  /**
   * Get system state at breaking point
   */
  private async getSystemState(
    executor: BreakageTestExecutor,
    breakingPoint: number
  ): Promise<SystemState> {
    try {
      return await executor.healthCheck();
    } catch {
      return {
        cpu: 100,
        memory: 100,
        connections: 0,
        queueDepth: 0,
        errors: ["Health check failed"],
      };
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    failureMode: FailureMode,
    analysis: BreakageAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (failureMode.category === "resource_exhaustion") {
      recommendations.push("Scale up resources vertically");
      recommendations.push("Implement horizontal auto-scaling");
      recommendations.push("Add resource monitoring and alerts");
    }

    if (failureMode.category === "latency") {
      recommendations.push("Implement caching for common requests");
      recommendations.push("Optimize database queries");
      recommendations.push("Consider CDN for static content");
    }

    if (failureMode.category === "error_rate") {
      recommendations.push("Implement rate limiting");
      recommendations.push("Add circuit breakers");
      recommendations.push("Improve error handling and retry logic");
    }

    if (failureMode.category === "cascading") {
      recommendations.push("URGENT: Implement cascading failure protection");
      recommendations.push("Add bulkheads to isolate failures");
      recommendations.push("Implement graceful degradation");
    }

    if (!analysis.graceful) {
      recommendations.push("Implement gradual load shedding");
      recommendations.push("Add pre-breakage monitoring");
    }

    if (analysis.warningSigns.length > 0) {
      recommendations.push(
        `Monitor warning signs: ${analysis.warningSigns.slice(0, 3).join(", ")}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "System appears to handle load well. Continue monitoring."
      );
    }

    return recommendations;
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `breakage-req-${Date.now()}-${id}`,
      type: "breakage_test",
      payload: { breakage: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
