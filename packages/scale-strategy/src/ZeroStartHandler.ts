/**
 * @lsi/scale-strategy - Zero Start Handler
 *
 * Handles zero-state detection and fast path scaling for zero cold start.
 */

import type {
  ZeroStartState,
  WorkerPoolState,
  ScaleOperationResult,
} from "./types.js";

/**
 * Zero-start handler configuration
 */
export interface ZeroStartHandlerConfig {
  /** Whether scale-to-zero is enabled */
  enableScaleToZero: boolean;
  /** Idle time before scale-to-zero (ms) */
  scaleToZeroIdleMs: number;
  /** Number of standby workers to maintain */
  standbyWorkerCount: number;
  /** Time to start first worker (ms) */
  timeToFirstWorkerMs: number;
  /** Time to start standby worker (ms) */
  timeToStandbyWorkerMs: number;
  /** Whether predictive pre-warming is enabled */
  enablePredictiveWarm: boolean;
  /** Predictive warm trigger threshold */
  predictiveWarmThreshold: number;
}

/**
 * Standby worker state
 */
interface StandbyWorker {
  id: string;
  state: "cold" | "warming" | "warm" | "active";
  lastUsed: number;
  warmStartTime: number;
}

/**
 * Activity record for prediction
 */
interface ActivityRecord {
  timestamp: number;
  requestCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ZeroStartHandlerConfig = {
  enableScaleToZero: true,
  scaleToZeroIdleMs: 600000, // 10 minutes
  standbyWorkerCount: 1,
  timeToFirstWorkerMs: 5000, // 5 seconds (cold start)
  timeToStandbyWorkerMs: 1000, // 1 second (warm start)
  enablePredictiveWarm: true,
  predictiveWarmThreshold: 0.7, // 70% confidence
};

/**
 * Handles zero-state detection and fast path scaling
 */
export class ZeroStartHandler {
  private config: ZeroStartHandlerConfig;
  private standbyWorkers: Map<string, StandbyWorker> = new Map();
  private idleStartTime: number | null = null;
  private activityHistory: ActivityRecord[] = [];
  private lastActivityTime: number = Date.now();

  constructor(config?: Partial<ZeroStartHandlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check current zero-state
   */
  async checkState(workerState: WorkerPoolState): Promise<ZeroStartState> {
    const now = Date.now();
    const isAtZero = workerState.total === 0;

    // Track activity
    this.recordActivity(workerState);

    // Calculate idle time
    let idleTimeMs = 0;
    if (workerState.queuedRequests === 0 && workerState.active === 0) {
      if (this.idleStartTime === null) {
        this.idleStartTime = now;
      }
      idleTimeMs = now - this.idleStartTime;
    } else {
      this.idleStartTime = null;
    }

    // Check if fast-start is available
    const hasFastStart = this.standbyWorkers.size > 0;

    // Estimate time to first worker
    const timeToFirstWorkerMs = hasFastStart
      ? this.config.timeToStandbyWorkerMs
      : this.config.timeToFirstWorkerMs;

    // Check if should scale to zero
    const shouldScaleToZero =
      this.config.enableScaleToZero &&
      idleTimeMs >= this.config.scaleToZeroIdleMs &&
      workerState.total > 0;

    return {
      isAtZero,
      idleTimeMs,
      pendingRequests: workerState.queuedRequests,
      hasFastStart,
      timeToFirstWorkerMs,
      shouldScaleToZero,
    };
  }

  /**
   * Fast start from zero state
   */
  async fastStart(count: number): Promise<ScaleOperationResult> {
    const startTime = Date.now();

    try {
      // Activate standby workers first
      const activated = await this.activateStandbyWorkers(count);

      // If more workers needed, start new ones
      const remaining = count - activated;
      if (remaining > 0) {
        await this.startNewWorkers(remaining);
      }

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        actualCount: count,
        durationMs,
        metadata: {
          standbyActivated: activated,
          newWorkersStarted: remaining,
          fastStart: true,
        },
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
   * Prepare standby workers
   */
  async prepareStandbyWorkers(count?: number): Promise<void> {
    const targetCount = count ?? this.config.standbyWorkerCount;

    // Remove excess standby workers
    const currentCount = this.standbyWorkers.size;
    if (currentCount > targetCount) {
      const toRemove = currentCount - targetCount;
      const entries = Array.from(this.standbyWorkers.entries()).slice(
        0,
        toRemove
      );
      for (const [id] of entries) {
        this.standbyWorkers.delete(id);
      }
    }

    // Add new standby workers if needed
    const toAdd = targetCount - this.standbyWorkers.size;
    for (let i = 0; i < toAdd; i++) {
      const id = `standby-${Date.now()}-${i}`;
      this.standbyWorkers.set(id, {
        id,
        state: "cold",
        lastUsed: 0,
        warmStartTime: 0,
      });

      // Start warming process
      this.warmWorker(id);
    }
  }

  /**
   * Predictive warm-up based on activity patterns
   */
  async predictiveWarm(): Promise<boolean> {
    if (!this.config.enablePredictiveWarm) {
      return false;
    }

    // Analyze activity patterns
    const prediction = this.predictActivity();

    if (prediction.confidence >= this.config.predictiveWarmThreshold) {
      // Prepare standby workers proactively
      await this.prepareStandbyWorkers();
      return true;
    }

    return false;
  }

  /**
   * Get standby worker status
   */
  getStandbyStatus(): {
    total: number;
    cold: number;
    warming: number;
    warm: number;
    active: number;
  } {
    const status = {
      total: this.standbyWorkers.size,
      cold: 0,
      warming: 0,
      warm: 0,
      active: 0,
    };

    for (const worker of this.standbyWorkers.values()) {
      status[worker.state]++;
    }

    return status;
  }

  /**
   * Reset handler state
   */
  reset(): void {
    this.standbyWorkers.clear();
    this.idleStartTime = null;
    this.activityHistory = [];
    this.lastActivityTime = Date.now();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ZeroStartHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ZeroStartHandlerConfig {
    return { ...this.config };
  }

  /**
   * Get activity history
   */
  getActivityHistory(): ActivityRecord[] {
    return [...this.activityHistory];
  }

  private async activateStandbyWorkers(count: number): Promise<number> {
    let activated = 0;

    // Activate warm workers first
    for (const [id, worker] of this.standbyWorkers.entries()) {
      if (activated >= count) {
        break;
      }

      if (worker.state === "warm") {
        worker.state = "active";
        worker.lastUsed = Date.now();
        activated++;
      }
    }

    // Then activate warming workers
    for (const [id, worker] of this.standbyWorkers.entries()) {
      if (activated >= count) {
        break;
      }

      if (worker.state === "warming") {
        // Wait for warm to complete
        await this.waitForWorkerWarm(id);
        worker.state = "active";
        worker.lastUsed = Date.now();
        activated++;
      }
    }

    return activated;
  }

  private async startNewWorkers(count: number): Promise<void> {
    // Start new workers from cold
    // This is a placeholder - actual implementation depends on integration target
    for (let i = 0; i < count; i++) {
      const id = `worker-${Date.now()}-${i}`;
      // Worker startup logic would go here
    }
  }

  private async warmWorker(id: string): Promise<void> {
    const worker = this.standbyWorkers.get(id);
    if (!worker) {
      return;
    }

    worker.state = "warming";
    worker.warmStartTime = Date.now();

    // Simulate warm-up time
    setTimeout(() => {
      const w = this.standbyWorkers.get(id);
      if (w) {
        w.state = "warm";
      }
    }, this.config.timeToStandbyWorkerMs);
  }

  private async waitForWorkerWarm(id: string): Promise<void> {
    const worker = this.standbyWorkers.get(id);
    if (!worker) {
      return;
    }

    // Wait for warm to complete
    const warmTime = this.config.timeToStandbyWorkerMs;
    const elapsed = Date.now() - worker.warmStartTime;
    const remaining = Math.max(0, warmTime - elapsed);

    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
  }

  private recordActivity(workerState: WorkerPoolState): void {
    const now = Date.now();

    // Record activity sample
    this.activityHistory.push({
      timestamp: now,
      requestCount: workerState.queuedRequests + workerState.active,
    });

    // Trim history to last 24 hours
    const cutoff = now - 86400000;
    this.activityHistory = this.activityHistory.filter(
      r => r.timestamp >= cutoff
    );

    // Update last activity time
    if (workerState.queuedRequests > 0 || workerState.active > 0) {
      this.lastActivityTime = now;
    }
  }

  private predictActivity(): {
    willHaveActivity: boolean;
    confidence: number;
    reason: string;
  } {
    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();

    // Analyze historical activity for this time
    const similarTimeHistory = this.activityHistory.filter(r => {
      const rDate = new Date(r.timestamp);
      return rDate.getHours() === hourOfDay && rDate.getDay() === dayOfWeek;
    });

    if (similarTimeHistory.length < 5) {
      // Not enough data
      return {
        willHaveActivity: false,
        confidence: 0,
        reason: "Insufficient historical data",
      };
    }

    // Calculate average activity
    const avgActivity =
      similarTimeHistory.reduce((sum, r) => sum + r.requestCount, 0) /
      similarTimeHistory.length;

    // Check for recent activity pattern
    const recentHistory = this.activityHistory.slice(-10);
    const trend = this.calculateTrend(recentHistory);

    // Predict based on patterns
    let willHaveActivity = false;
    let confidence = 0.5;

    if (avgActivity > 1) {
      willHaveActivity = true;
      confidence = Math.min(0.95, 0.6 + avgActivity / 10);
    }

    if (trend > 0.1) {
      willHaveActivity = true;
      confidence = Math.min(0.95, confidence + 0.2);
    }

    return {
      willHaveActivity,
      confidence,
      reason: `Average activity: ${avgActivity.toFixed(2)}, trend: ${trend.toFixed(2)}`,
    };
  }

  private calculateTrend(history: ActivityRecord[]): number {
    if (history.length < 2) {
      return 0;
    }

    // Simple linear regression
    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i].requestCount;
      sumXY += i * history[i].requestCount;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }
}
