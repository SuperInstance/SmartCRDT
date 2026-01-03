/**
 * @lsi/vljepa-video/realtime/DropoutHandler
 *
 * Dropout handler for handling frame drops and recovery strategies.
 *
 * @version 1.0.0
 */

/**
 * Recovery strategy
 */
export type RecoveryStrategy =
  | "skip"
  | "reduce_quality"
  | "increase_buffer"
  | "none";

/**
 * Dropout event
 */
interface DropoutEvent {
  /** Event timestamp */
  timestamp: number;

  /** Number of consecutive drops */
  count: number;

  /** Recovery action taken */
  recoveryAction: string;

  /** Recovery parameter */
  recoveryParameter: number | string;
}

/**
 * Dropout handler configuration
 */
export interface DropoutHandlerConfig {
  /** Maximum consecutive drops before recovery */
  maxConsecutiveDrops: number;

  /** Recovery strategy */
  recoveryStrategy: RecoveryStrategy;

  /** Skip ratio for skip strategy */
  skipRatio: number;

  /** Quality reduction amount for quality strategy */
  qualityReduction: number;

  /** Buffer increase amount for buffer strategy */
  bufferIncrease: number;

  /** Whether to automatically recover */
  autoRecover: boolean;
}

/**
 * Dropout handler
 *
 * Handles frame drops and implements recovery strategies.
 */
export class DropoutHandler {
  private config: DropoutHandlerConfig;
  private consecutiveDrops: number = 0;
  private dropHistory: DropoutEvent[] = [];
  private totalDrops: number = 0;
  private totalProcessed: number = 0;
  private isInDropout: boolean = false;

  constructor(config: DropoutHandlerConfig) {
    this.config = {
      maxConsecutiveDrops: config.maxConsecutiveDrops || 5,
      recoveryStrategy: config.recoveryStrategy || "skip",
      skipRatio: config.skipRatio || 0.5,
      qualityReduction: config.qualityReduction || 0.2,
      bufferIncrease: config.bufferIncrease || 10,
      autoRecover: config.autoRecover !== false,
    };
  }

  /**
   * Handle frame drop
   */
  handleDrop(): {
    shouldRecover: boolean;
    recoveryAction?: { action: string; parameter: number | string };
  } {
    this.consecutiveDrops++;
    this.totalDrops++;
    this.isInDropout = true;

    const shouldRecover =
      this.consecutiveDrops >= this.config.maxConsecutiveDrops;

    let recoveryAction:
      | { action: string; parameter: number | string }
      | undefined;

    if (shouldRecover && this.config.autoRecover) {
      recoveryAction = this.getRecoveryAction();

      // Record recovery event
      this.dropHistory.push({
        timestamp: performance.now(),
        count: this.consecutiveDrops,
        recoveryAction: recoveryAction.action,
        recoveryParameter: recoveryAction.parameter,
      });

      // Trim history
      if (this.dropHistory.length > 100) {
        this.dropHistory.shift();
      }

      // Reset after recovery
      this.consecutiveDrops = 0;
    }

    return { shouldRecover, recoveryAction };
  }

  /**
   * Handle frame processed successfully
   */
  handleProcessed(): void {
    this.totalProcessed++;

    if (this.consecutiveDrops > 0) {
      // Record drop event that ended
      this.dropHistory.push({
        timestamp: performance.now(),
        count: this.consecutiveDrops,
        recoveryAction: "natural_recovery",
        recoveryParameter: 0,
      });

      this.consecutiveDrops = 0;
      this.isInDropout = false;
    }
  }

  /**
   * Get recovery action
   */
  getRecoveryAction(): { action: string; parameter: number | string } {
    switch (this.config.recoveryStrategy) {
      case "skip":
        return {
          action: "skip_frames",
          parameter: Math.ceil(this.consecutiveDrops * this.config.skipRatio),
        };

      case "reduce_quality":
        return {
          action: "reduce_quality",
          parameter: -this.config.qualityReduction,
        };

      case "increase_buffer":
        return {
          action: "increase_buffer",
          parameter: this.config.bufferIncrease,
        };

      case "none":
      default:
        return {
          action: "none",
          parameter: 0,
        };
    }
  }

  /**
   * Check if currently in dropout state
   */
  isInDropoutState(): boolean {
    return this.isInDropout;
  }

  /**
   * Get current consecutive drop count
   */
  getConsecutiveDrops(): number {
    return this.consecutiveDrops;
  }

  /**
   * Get drop statistics
   */
  getStats(): {
    consecutiveDrops: number;
    totalDrops: number;
    totalProcessed: number;
    totalDropEvents: number;
    avgDropsPerEvent: number;
    maxDropsInEvent: number;
    dropRate: number;
    isInDropout: boolean;
  } {
    const totalEvents = this.dropHistory.length;
    const totalDropsInEvents = this.dropHistory.reduce(
      (sum, e) => sum + e.count,
      0
    );
    const avgDropsPerEvent =
      totalEvents > 0 ? totalDropsInEvents / totalEvents : 0;
    const maxDropsInEvent =
      totalEvents > 0 ? Math.max(...this.dropHistory.map(e => e.count)) : 0;

    const total = this.totalProcessed + this.totalDrops;
    const dropRate = total > 0 ? this.totalDrops / total : 0;

    return {
      consecutiveDrops: this.consecutiveDrops,
      totalDrops: this.totalDrops,
      totalProcessed: this.totalProcessed,
      totalDropEvents: totalEvents,
      avgDropsPerEvent,
      maxDropsInEvent,
      dropRate,
      isInDropout: this.isInDropout,
    };
  }

  /**
   * Get recent dropout events
   */
  getRecentEvents(n: number = 10): DropoutEvent[] {
    return this.dropHistory.slice(-n);
  }

  /**
   * Get dropout history
   */
  getHistory(): DropoutEvent[] {
    return [...this.dropHistory];
  }

  /**
   * Get dropout rate in time window
   */
  getDropRateInWindow(windowMs: number): number {
    const now = performance.now();
    const recentEvents = this.dropHistory.filter(
      e => now - e.timestamp < windowMs
    );

    const dropsInWindow = recentEvents.reduce((sum, e) => sum + e.count, 0);

    // Estimate frames in window based on 30fps
    const estimatedFrames = (windowMs / 1000) * 30;

    return estimatedFrames > 0 ? dropsInWindow / estimatedFrames : 0;
  }

  /**
   * Set recovery strategy
   */
  setRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.config.recoveryStrategy = strategy;
  }

  /**
   * Set max consecutive drops
   */
  setMaxConsecutiveDrops(max: number): void {
    this.config.maxConsecutiveDrops = max;
  }

  /**
   * Set auto recover
   */
  setAutoRecover(auto: boolean): void {
    this.config.autoRecover = auto;
  }

  /**
   * Reset handler
   */
  reset(): void {
    this.consecutiveDrops = 0;
    this.totalDrops = 0;
    this.totalProcessed = 0;
    this.dropHistory = [];
    this.isInDropout = false;
  }

  /**
   * Get recommended actions based on current state
   */
  getRecommendations(): Array<{
    action: string;
    priority: "high" | "medium" | "low";
    reason: string;
  }> {
    const recommendations: Array<{
      action: string;
      priority: "high" | "medium" | "low";
      reason: string;
    }> = [];

    const stats = this.getStats();

    // High drop rate
    if (stats.dropRate > 0.1) {
      recommendations.push({
        action: "reduce_processing_complexity",
        priority: "high",
        reason: `Drop rate is ${(stats.dropRate * 100).toFixed(1)}%, consider reducing complexity`,
      });
    }

    // Consecutive drops
    if (stats.consecutiveDrops >= this.config.maxConsecutiveDrops * 0.7) {
      recommendations.push({
        action: "prepare_recovery",
        priority: "medium",
        reason: `${stats.consecutiveDrops} consecutive drops, approaching threshold`,
      });
    }

    // Frequent dropout events
    if (stats.totalDropEvents > 10 && stats.avgDropsPerEvent > 2) {
      recommendations.push({
        action: "increase_buffer_size",
        priority: "medium",
        reason: `Frequent dropout events (avg ${stats.avgDropsPerEvent.toFixed(1)} drops)`,
      });
    }

    return recommendations;
  }
}
