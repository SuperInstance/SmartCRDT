/**
 * @lsi/scale-strategy - Time-Based Strategy
 *
 * Schedule-based scaling according to defined schedules.
 */

import type {
  ScaleDecision,
  ScalePolicy,
  ScaleMetric,
  ScaleManagerConfig,
  WorkerPoolState,
  TimeBasedSchedule,
} from "../types.js";

/**
 * Time-based strategy configuration
 */
export interface TimeBasedStrategyConfig {
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Scale policy */
  policy: ScalePolicy;
  /** Defined schedules */
  schedules: TimeBasedSchedule[];
  /** Timezone for schedule evaluation */
  timezone: string;
}

/**
 * Schedule override
 */
interface ScheduleOverride {
  startTime: number;
  endTime: number;
  workerCount: number;
  reason: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TimeBasedStrategyConfig = {
  enabled: true,
  policy: "balanced",
  schedules: [],
  timezone: "UTC",
};

/**
 * Time-based scaling strategy
 */
export class TimeBasedStrategy {
  private config: TimeBasedStrategyConfig;
  private managerConfig: ScaleManagerConfig;
  private overrides: ScheduleOverride[] = [];

  constructor(
    managerConfig: ScaleManagerConfig,
    config?: Partial<TimeBasedStrategyConfig>
  ) {
    this.managerConfig = managerConfig;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate current time and make scaling decision
   */
  async evaluate(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): Promise<ScaleDecision> {
    if (!this.config.enabled) {
      return this.noActionDecision(workerState);
    }

    // Check for active overrides
    const override = this.getActiveOverride();
    if (override) {
      return this.applyOverride(override, workerState);
    }

    // Find matching schedule
    const schedule = this.findCurrentSchedule();
    if (!schedule) {
      return this.noMatchDecision(workerState);
    }

    const targetCount = schedule.workerCount;
    const direction = this.determineDirection(targetCount, workerState);

    return {
      direction,
      targetCount,
      currentCount: workerState.active,
      reason: `Time-based strategy: schedule "${schedule.id}" matched (${schedule.dayOfWeek} ${schedule.hour}:${schedule.minute.toString().padStart(2, "0")})`,
      confidence: 0.9,
      triggeredBy: ["time_schedule", schedule.id],
      estimatedTimeMs: this.estimateTime(direction, targetCount, workerState),
      isEmergency: false,
    };
  }

  /**
   * Add a schedule
   */
  addSchedule(schedule: TimeBasedSchedule): void {
    // Remove existing schedule with same ID
    this.config.schedules = this.config.schedules.filter(
      s => s.id !== schedule.id
    );
    this.config.schedules.push(schedule);
  }

  /**
   * Remove a schedule
   */
  removeSchedule(scheduleId: string): void {
    this.config.schedules = this.config.schedules.filter(
      s => s.id !== scheduleId
    );
  }

  /**
   * Get all schedules
   */
  getSchedules(): TimeBasedSchedule[] {
    return [...this.config.schedules];
  }

  /**
   * Add a temporary override
   */
  addOverride(workerCount: number, durationMs: number, reason: string): void {
    this.overrides.push({
      startTime: Date.now(),
      endTime: Date.now() + durationMs,
      workerCount,
      reason,
    });

    // Clean up expired overrides
    this.cleanupOverrides();
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.overrides = [];
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set policy
   */
  setPolicy(policy: ScalePolicy): void {
    this.config.policy = policy;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimeBasedStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): TimeBasedStrategyConfig {
    return {
      ...this.config,
      schedules: [...this.config.schedules],
    };
  }

  private findCurrentSchedule(): TimeBasedSchedule | null {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Find schedules matching current day and time
    const matching = this.config.schedules.filter(
      s =>
        s.enabled &&
        s.dayOfWeek === dayOfWeek &&
        s.hour === hour &&
        s.minute === minute
    );

    // Return highest priority (first match)
    return matching.length > 0 ? matching[0] : null;
  }

  private getActiveOverride(): ScheduleOverride | null {
    this.cleanupOverrides();

    if (this.overrides.length === 0) {
      return null;
    }

    // Return most recent override
    return this.overrides[this.overrides.length - 1];
  }

  private cleanupOverrides(): void {
    const now = Date.now();
    this.overrides = this.overrides.filter(o => o.endTime > now);
  }

  private applyOverride(
    override: ScheduleOverride,
    workerState: WorkerPoolState
  ): ScaleDecision {
    const targetCount = override.workerCount;
    const direction = this.determineDirection(targetCount, workerState);

    return {
      direction,
      targetCount,
      currentCount: workerState.active,
      reason: `Time-based strategy: override - ${override.reason}`,
      confidence: 1.0,
      triggeredBy: ["time_override"],
      estimatedTimeMs: this.estimateTime(direction, targetCount, workerState),
      isEmergency: false,
    };
  }

  private determineDirection(
    targetCount: number,
    workerState: WorkerPoolState
  ): ScaleDirection {
    if (targetCount > workerState.active) {
      return "up";
    } else if (targetCount < workerState.active) {
      return "down";
    }
    return "none";
  }

  private estimateTime(
    direction: ScaleDirection,
    targetCount: number,
    workerState: WorkerPoolState
  ): number {
    if (direction === "none") {
      return 0;
    }

    const countDiff = Math.abs(targetCount - workerState.active);
    const timePerWorker = direction === "up" ? 2000 : 5000;

    return countDiff * timePerWorker;
  }

  private noActionDecision(workerState: WorkerPoolState): ScaleDecision {
    return {
      direction: "none",
      targetCount: workerState.active,
      currentCount: workerState.active,
      reason: "Time-based strategy is disabled",
      confidence: 0,
      triggeredBy: [],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }

  private noMatchDecision(workerState: WorkerPoolState): ScaleDecision {
    return {
      direction: "none",
      targetCount: workerState.active,
      currentCount: workerState.active,
      reason: "Time-based strategy: no matching schedule for current time",
      confidence: 0.5,
      triggeredBy: ["time_schedule", "no_match"],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }
}
