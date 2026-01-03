/**
 * @lsi/scale-strategy - Scale Manager
 *
 * Core scaling logic with zero cold start support.
 */

import type {
  ScaleDecision,
  ScaleDirection,
  ScalePolicy,
  ScaleEvent,
  ScaleManagerConfig,
  ScaleMetric,
  ScaleOperationResult,
  WorkerPoolState,
  ZeroStartState,
  CooldownState,
} from "./types.js";
import { MetricType } from "./types.js";
import { CooldownManager } from "./CooldownManager.js";
import { ZeroStartHandler } from "./ZeroStartHandler.js";
import { QueueDepthMetric } from "./metrics/QueueDepthMetric.js";
import { CpuUsageMetric } from "./metrics/CpuUsageMetric.js";
import { MemoryUsageMetric } from "./metrics/MemoryUsageMetric.js";
import { LatencyMetric } from "./metrics/LatencyMetric.js";
import { ErrorRateMetric } from "./metrics/ErrorRateMetric.js";
import { ThresholdStrategy } from "./strategies/ThresholdStrategy.js";
import { PredictiveStrategy } from "./strategies/PredictiveStrategy.js";
import { TimeBasedStrategy } from "./strategies/TimeBasedStrategy.js";
import { CostOptimizedStrategy } from "./strategies/CostOptimizedStrategy.js";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ScaleManagerConfig = {
  minWorkers: 1,
  maxWorkers: 10,
  initialWorkers: 2,
  policy: "balanced",
  scaleUpCooldownMs: 60000, // 1 minute
  scaleDownCooldownMs: 300000, // 5 minutes
  enableScaleToZero: true,
  scaleToZeroIdleMs: 600000, // 10 minutes
  enablePredictiveScaling: true,
  predictionHorizonMs: 300000, // 5 minutes
  emergencyThreshold: 100, // queue depth
};

/**
 * Scale Manager - Main scaling orchestrator
 */
export class ScaleManager {
  private config: ScaleManagerConfig;
  private cooldownManager: CooldownManager;
  private zeroStartHandler: ZeroStartHandler;
  private metrics: Map<string, ScaleMetric>;
  private history: ScaleEvent[];
  private currentWorkerCount: number;
  private targetWorkerCount: number;

  // Metric collectors
  private queueDepthMetric: QueueDepthMetric;
  private cpuUsageMetric: CpuUsageMetric;
  private memoryUsageMetric: MemoryUsageMetric;
  private latencyMetric: LatencyMetric;
  private errorRateMetric: ErrorRateMetric;

  // Scale strategies
  private thresholdStrategy: ThresholdStrategy;
  private predictiveStrategy: PredictiveStrategy;
  private timeBasedStrategy: TimeBasedStrategy;
  private costOptimizedStrategy: CostOptimizedStrategy;

  // State tracking
  private lastEvaluationTime: number;
  private evaluationCount: number;

  constructor(config: Partial<ScaleManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cooldownManager = new CooldownManager({
      scaleUpCooldownMs: this.config.scaleUpCooldownMs,
      scaleDownCooldownMs: this.config.scaleDownCooldownMs,
    });
    this.zeroStartHandler = new ZeroStartHandler({
      enableScaleToZero: this.config.enableScaleToZero,
      scaleToZeroIdleMs: this.config.scaleToZeroIdleMs,
    });

    this.metrics = new Map();
    this.history = [];
    this.currentWorkerCount = this.config.initialWorkers;
    this.targetWorkerCount = this.config.initialWorkers;
    this.lastEvaluationTime = Date.now();
    this.evaluationCount = 0;

    // Initialize metric collectors
    this.queueDepthMetric = new QueueDepthMetric();
    this.cpuUsageMetric = new CpuUsageMetric();
    this.memoryUsageMetric = new MemoryUsageMetric();
    this.latencyMetric = new LatencyMetric();
    this.errorRateMetric = new ErrorRateMetric();

    // Initialize strategies
    this.thresholdStrategy = new ThresholdStrategy(this.config);
    this.predictiveStrategy = new PredictiveStrategy(this.config);
    this.timeBasedStrategy = new TimeBasedStrategy(this.config);
    this.costOptimizedStrategy = new CostOptimizedStrategy(this.config);
  }

  /**
   * Evaluate current state and make scaling decision
   */
  async evaluateScaling(
    workerState: WorkerPoolState,
    customMetrics?: ScaleMetric[]
  ): Promise<ScaleDecision> {
    const startTime = Date.now();
    this.evaluationCount++;

    // Collect current metrics
    await this.collectMetrics(workerState);

    // Add custom metrics if provided
    if (customMetrics) {
      for (const metric of customMetrics) {
        this.metrics.set(metric.name, metric);
      }
    }

    // Check cooldown state
    const cooldownState = this.cooldownManager.getState();
    const canScaleUp =
      !cooldownState.isInCooldown || cooldownState.remainingMs === 0;
    const canScaleDown =
      !cooldownState.isInCooldown || cooldownState.remainingMs === 0;

    // Check zero-start state
    const zeroStartState = await this.zeroStartHandler.checkState(workerState);

    // Handle zero-state with fast path
    if (zeroStartState.isAtZero && workerState.queuedRequests > 0) {
      return this.handleZeroStart(workerState, zeroStartState);
    }

    // Evaluate using all strategies
    const decisions: ScaleDecision[] = [];

    if (this.thresholdStrategy.isEnabled()) {
      decisions.push(
        await this.thresholdStrategy.evaluate(
          Array.from(this.metrics.values()),
          workerState
        )
      );
    }

    if (
      this.predictiveStrategy.isEnabled() &&
      this.config.enablePredictiveScaling
    ) {
      decisions.push(
        await this.predictiveStrategy.evaluate(
          Array.from(this.metrics.values()),
          workerState
        )
      );
    }

    if (this.timeBasedStrategy.isEnabled()) {
      decisions.push(
        await this.timeBasedStrategy.evaluate(
          Array.from(this.metrics.values()),
          workerState
        )
      );
    }

    if (this.costOptimizedStrategy.isEnabled()) {
      decisions.push(
        await this.costOptimizedStrategy.evaluate(
          Array.from(this.metrics.values()),
          workerState
        )
      );
    }

    // Combine decisions based on policy
    const finalDecision = this.combineDecisions(
      decisions,
      canScaleUp,
      canScaleDown,
      workerState
    );

    // Apply emergency scaling if needed
    if (this.isEmergency(workerState)) {
      return this.makeEmergencyDecision(workerState);
    }

    this.lastEvaluationTime = Date.now();
    return finalDecision;
  }

  /**
   * Scale up to target count
   */
  async scaleUp(count: number): Promise<ScaleOperationResult> {
    const startTime = Date.now();
    const previousCount = this.currentWorkerCount;

    try {
      // Validate target count
      const targetCount = Math.min(count, this.config.maxWorkers);

      if (targetCount <= this.currentWorkerCount) {
        return {
          success: false,
          actualCount: this.currentWorkerCount,
          durationMs: Date.now() - startTime,
          error: "Target count must be greater than current count",
        };
      }

      // Execute scale up
      await this.executeScaleUp(targetCount);

      this.currentWorkerCount = targetCount;
      this.targetWorkerCount = targetCount;

      // Record scale event
      this.recordScaleEvent({
        timestamp: Date.now(),
        direction: "up",
        fromCount: previousCount,
        toCount: targetCount,
        trigger: "manual",
        metrics: this.getMetricsSnapshot(),
        confidence: 1.0,
        durationMs: Date.now() - startTime,
        success: true,
      });

      // Update cooldown
      this.cooldownManager.recordScale("up");

      return {
        success: true,
        actualCount: this.currentWorkerCount,
        durationMs: Date.now() - startTime,
        metadata: { previousCount, targetCount },
      };
    } catch (error) {
      return {
        success: false,
        actualCount: this.currentWorkerCount,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Scale down to target count
   */
  async scaleDown(count: number): Promise<ScaleOperationResult> {
    const startTime = Date.now();
    const previousCount = this.currentWorkerCount;

    try {
      // Validate target count
      const targetCount = Math.max(
        count,
        this.config.enableScaleToZero ? 0 : this.config.minWorkers
      );

      if (targetCount >= this.currentWorkerCount) {
        return {
          success: false,
          actualCount: this.currentWorkerCount,
          durationMs: Date.now() - startTime,
          error: "Target count must be less than current count",
        };
      }

      // Execute scale down
      await this.executeScaleDown(targetCount);

      this.currentWorkerCount = targetCount;
      this.targetWorkerCount = targetCount;

      // Record scale event
      this.recordScaleEvent({
        timestamp: Date.now(),
        direction: "down",
        fromCount: previousCount,
        toCount: targetCount,
        trigger: "manual",
        metrics: this.getMetricsSnapshot(),
        confidence: 1.0,
        durationMs: Date.now() - startTime,
        success: true,
      });

      // Update cooldown
      this.cooldownManager.recordScale("down");

      return {
        success: true,
        actualCount: this.currentWorkerCount,
        durationMs: Date.now() - startTime,
        metadata: { previousCount, targetCount },
      };
    } catch (error) {
      return {
        success: false,
        actualCount: this.currentWorkerCount,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Scale to zero gracefully
   */
  async scaleToZero(): Promise<ScaleOperationResult> {
    if (!this.config.enableScaleToZero) {
      return {
        success: false,
        actualCount: this.currentWorkerCount,
        durationMs: 0,
        error: "Scale to zero is not enabled",
      };
    }

    return this.scaleDown(0);
  }

  /**
   * Scale from zero (fast start)
   */
  async scaleFromZero(count?: number): Promise<ScaleOperationResult> {
    const targetCount = count ?? this.config.initialWorkers;

    if (this.currentWorkerCount > 0) {
      return {
        success: false,
        actualCount: this.currentWorkerCount,
        durationMs: 0,
        error: "Not currently at zero workers",
      };
    }

    const startTime = Date.now();

    try {
      // Fast path: activate standby workers
      await this.zeroStartHandler.fastStart(targetCount);

      this.currentWorkerCount = targetCount;
      this.targetWorkerCount = targetCount;

      // Record scale event
      this.recordScaleEvent({
        timestamp: Date.now(),
        direction: "up",
        fromCount: 0,
        toCount: targetCount,
        trigger: "zero-start",
        metrics: this.getMetricsSnapshot(),
        confidence: 1.0,
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        actualCount: this.currentWorkerCount,
        durationMs: Date.now() - startTime,
        metadata: { fastStart: true },
      };
    } catch (error) {
      return {
        success: false,
        actualCount: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Set scaling policy
   */
  setPolicy(policy: ScalePolicy): void {
    this.config.policy = policy;
    this.thresholdStrategy.setPolicy(policy);
    this.predictiveStrategy.setPolicy(policy);
    this.costOptimizedStrategy.setPolicy(policy);
  }

  /**
   * Get scale history
   */
  getHistory(limit?: number): ScaleEvent[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get current metrics
   */
  getMetrics(): ScaleMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get current configuration
   */
  getConfig(): ScaleManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ScaleManagerConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update dependent components
    this.cooldownManager.updateConfig({
      scaleUpCooldownMs: this.config.scaleUpCooldownMs,
      scaleDownCooldownMs: this.config.scaleDownCooldownMs,
    });

    this.zeroStartHandler.updateConfig({
      enableScaleToZero: this.config.enableScaleToZero,
      scaleToZeroIdleMs: this.config.scaleToZeroIdleMs,
    });
  }

  /**
   * Get current worker count
   */
  getCurrentWorkerCount(): number {
    return this.currentWorkerCount;
  }

  /**
   * Get target worker count
   */
  getTargetWorkerCount(): number {
    return this.targetWorkerCount;
  }

  /**
   * Get statistics
   */
  getStats(): {
    evaluationCount: number;
    lastEvaluationTime: number;
    totalScaleEvents: number;
    scaleUpCount: number;
    scaleDownCount: number;
    averageScaleTime: number;
  } {
    const scaleUpEvents = this.history.filter(e => e.direction === "up");
    const scaleDownEvents = this.history.filter(e => e.direction === "down");
    const averageScaleTime =
      this.history.length > 0
        ? this.history.reduce((sum, e) => sum + e.durationMs, 0) /
          this.history.length
        : 0;

    return {
      evaluationCount: this.evaluationCount,
      lastEvaluationTime: this.lastEvaluationTime,
      totalScaleEvents: this.history.length,
      scaleUpCount: scaleUpEvents.length,
      scaleDownCount: scaleDownEvents.length,
      averageScaleTime,
    };
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.metrics.clear();
    this.history = [];
    this.currentWorkerCount = this.config.initialWorkers;
    this.targetWorkerCount = this.config.initialWorkers;
    this.evaluationCount = 0;
    this.cooldownManager.reset();
    this.zeroStartHandler.reset();
  }

  // Private methods

  private async collectMetrics(workerState: WorkerPoolState): Promise<void> {
    // Queue depth
    const queueDepth = await this.queueDepthMetric.collect(workerState);
    this.metrics.set("queue_depth", queueDepth);

    // CPU usage
    const cpuUsage = await this.cpuUsageMetric.collect(workerState);
    this.metrics.set("cpu_usage", cpuUsage);

    // Memory usage
    const memoryUsage = await this.memoryUsageMetric.collect(workerState);
    this.metrics.set("memory_usage", memoryUsage);

    // Latency
    const latency = await this.latencyMetric.collect(workerState);
    this.metrics.set("latency", latency);

    // Error rate
    const errorRate = await this.errorRateMetric.collect(workerState);
    this.metrics.set("error_rate", errorRate);
  }

  private handleZeroStart(
    workerState: WorkerPoolState,
    zeroStartState: ZeroStartState
  ): ScaleDecision {
    // Fast scale up from zero
    const targetCount = Math.min(
      Math.ceil(workerState.queuedRequests / 10), // 10 requests per worker
      this.config.maxWorkers
    );

    return {
      direction: "up",
      targetCount: Math.max(targetCount, this.config.initialWorkers),
      currentCount: 0,
      reason: "Zero-start fast path: activating workers for queued requests",
      confidence: 1.0,
      triggeredBy: ["queue_depth", "zero_start"],
      estimatedTimeMs: zeroStartState.timeToFirstWorkerMs,
      isEmergency: true,
    };
  }

  private combineDecisions(
    decisions: ScaleDecision[],
    canScaleUp: boolean,
    canScaleDown: boolean,
    workerState: WorkerPoolState
  ): ScaleDecision {
    if (decisions.length === 0) {
      return {
        direction: "none",
        targetCount: this.currentWorkerCount,
        currentCount: this.currentWorkerCount,
        reason: "No scaling strategies available",
        confidence: 0.5,
        triggeredBy: [],
        estimatedTimeMs: 0,
        isEmergency: false,
      };
    }

    // Weight decisions by confidence
    const totalConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0);

    // Calculate weighted target count
    const weightedTargetCount =
      decisions.reduce((sum, d) => {
        return sum + d.targetCount * d.confidence;
      }, 0) / totalConfidence;

    // Determine dominant direction
    const scaleUpVotes = decisions.filter(d => d.direction === "up").length;
    const scaleDownVotes = decisions.filter(d => d.direction === "down").length;
    const noneVotes = decisions.filter(d => d.direction === "none").length;

    let direction: ScaleDirection = "none";
    if (scaleUpVotes > scaleDownVotes && scaleUpVotes > noneVotes) {
      direction = "up";
    } else if (scaleDownVotes > scaleUpVotes && scaleDownVotes > noneVotes) {
      direction = "down";
    }

    // Apply cooldown constraints
    let targetCount = Math.round(weightedTargetCount);
    if (direction === "up" && !canScaleUp) {
      direction = "none";
      targetCount = this.currentWorkerCount;
    }
    if (direction === "down" && !canScaleDown) {
      direction = "none";
      targetCount = this.currentWorkerCount;
    }

    // Enforce bounds
    targetCount = Math.max(
      this.config.enableScaleToZero ? 0 : this.config.minWorkers,
      Math.min(this.config.maxWorkers, targetCount)
    );

    // Apply policy adjustments
    if (this.config.policy === "conservative" && direction === "up") {
      targetCount = Math.min(targetCount, this.currentWorkerCount + 1);
    }
    if (this.config.policy === "aggressive" && direction === "up") {
      targetCount = Math.max(targetCount, this.currentWorkerCount + 2);
    }

    // Collect all triggers
    const triggeredBy = decisions.flatMap(d => d.triggeredBy);

    return {
      direction,
      targetCount,
      currentCount: this.currentWorkerCount,
      reason: `Combined decision from ${decisions.length} strategies (${direction})`,
      confidence: totalConfidence / decisions.length,
      triggeredBy: [...new Set(triggeredBy)],
      estimatedTimeMs: this.estimateScaleTime(direction, targetCount),
      isEmergency: false,
    };
  }

  private isEmergency(workerState: WorkerPoolState): boolean {
    return workerState.queuedRequests >= this.config.emergencyThreshold;
  }

  private makeEmergencyDecision(workerState: WorkerPoolState): ScaleDecision {
    // Aggressive scale up for emergency
    const targetCount = Math.min(
      this.currentWorkerCount * 2,
      Math.ceil(workerState.queuedRequests / 5),
      this.config.maxWorkers
    );

    return {
      direction: "up",
      targetCount,
      currentCount: this.currentWorkerCount,
      reason: `Emergency scale up: queue depth ${workerState.queuedRequests} exceeds threshold ${this.config.emergencyThreshold}`,
      confidence: 1.0,
      triggeredBy: ["queue_depth", "emergency"],
      estimatedTimeMs: 5000, // Fast emergency scale
      isEmergency: true,
    };
  }

  private estimateScaleTime(
    direction: ScaleDirection,
    targetCount: number
  ): number {
    if (direction === "none") {
      return 0;
    }

    const countDiff = Math.abs(targetCount - this.currentWorkerCount);
    const timePerWorker = direction === "up" ? 2000 : 5000; // ms

    return countDiff * timePerWorker;
  }

  private async executeScaleUp(targetCount: number): Promise<void> {
    // Integration with worker pool or container orchestration
    // This is a placeholder - actual implementation depends on integration target
  }

  private async executeScaleDown(targetCount: number): Promise<void> {
    // Integration with worker pool or container orchestration
    // This is a placeholder - actual implementation depends on integration target
  }

  private recordScaleEvent(event: ScaleEvent): void {
    this.history.push(event);

    // Keep only last 1000 events
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }

  private getMetricsSnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const [name, metric] of this.metrics.entries()) {
      snapshot[name] = metric.value;
    }
    return snapshot;
  }
}
