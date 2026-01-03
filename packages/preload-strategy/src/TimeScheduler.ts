/**
 * Time Scheduler - Cron-like scheduling for time-based preloading
 *
 * Manages scheduled module preloading based on cron expressions
 * and time-based triggers.
 */

import { CronJob } from "cron";
import type {
  Schedule,
  ScheduleResult,
  TimeSchedulerConfig,
  ModuleLoadState,
  ModuleMetadata,
} from "./types.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: TimeSchedulerConfig = {
  enabled: true,
  defaultTimeZone: "UTC",
  maxConcurrentSchedules: 10,
  scheduleTimeout: 30000, // 30 seconds
};

// ============================================================================
// Time Scheduler Class
// ============================================================================

export class TimeScheduler {
  private config: TimeSchedulerConfig;
  private schedules: Map<string, Schedule>;
  private cronJobs: Map<string, CronJob>;
  private moduleRegistry: Map<string, ModuleMetadata>;
  private loadState: Map<string, ModuleLoadState>;
  private runningExecutions: Set<string>;
  private executionHistory: ScheduleResult[];

  constructor(config: Partial<TimeSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.schedules = new Map();
    this.cronJobs = new Map();
    this.moduleRegistry = new Map();
    this.loadState = new Map();
    this.runningExecutions = new Set();
    this.executionHistory = [];
  }

  // ========================================================================
  // Module Management
  // ========================================================================

  /**
   * Register a module for scheduled preloading
   */
  registerModule(metadata: ModuleMetadata): void {
    this.moduleRegistry.set(metadata.id, metadata);
    this.loadState.set(metadata.id, {
      moduleId: metadata.id,
      loaded: false,
    });
  }

  /**
   * Unregister a module
   */
  unregisterModule(moduleId: string): void {
    this.moduleRegistry.delete(moduleId);
    this.loadState.delete(moduleId);

    // Remove schedules for this module
    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (schedule.moduleName === moduleId) {
        this.removeSchedule(scheduleId);
      }
    }
  }

  /**
   * Get module metadata
   */
  getModule(moduleId: string): ModuleMetadata | undefined {
    return this.moduleRegistry.get(moduleId);
  }

  /**
   * Get all registered modules
   */
  getAllModules(): ModuleMetadata[] {
    return Array.from(this.moduleRegistry.values());
  }

  // ========================================================================
  // Schedule Management
  // ========================================================================

  /**
   * Add a new schedule
   */
  addSchedule(
    schedule: Omit<
      Schedule,
      "id" | "createdAt" | "nextRun" | "updatedAt" | "applicationCount"
    >
  ): string {
    const id = this.generateScheduleId();
    const now = Date.now();

    const newSchedule: Schedule = {
      id,
      ...schedule,
      createdAt: now,
      updatedAt: now,
      applicationCount: 0,
      nextRun: now + 3600000, // Placeholder: 1 hour from now
    };

    // Calculate next run time
    newSchedule.nextRun = this.calculateNextRun(newSchedule);

    this.schedules.set(id, newSchedule);

    // Start cron job if enabled
    if (newSchedule.enabled && this.config.enabled) {
      this.startSchedule(newSchedule);
    }

    return id;
  }

  /**
   * Remove a schedule
   */
  removeSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Stop cron job
    this.stopSchedule(scheduleId);

    // Remove from schedules
    this.schedules.delete(scheduleId);

    return true;
  }

  /**
   * Update a schedule
   */
  updateSchedule(
    scheduleId: string,
    updates: Partial<Omit<Schedule, "id" | "createdAt">>
  ): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    const updated: Schedule = {
      ...schedule,
      ...updates,
      updatedAt: Date.now(),
    };

    // Recalculate next run if cron changed
    if (updates.cron || updates.timeZone) {
      updated.nextRun = this.calculateNextRun(updated);
    }

    this.schedules.set(scheduleId, updated);

    // Restart cron job if schedule was modified
    if (updates.enabled !== undefined || updates.cron) {
      this.stopSchedule(scheduleId);
      if (updated.enabled && this.config.enabled) {
        this.startSchedule(updated);
      }
    }

    return true;
  }

  /**
   * Get a schedule
   */
  getSchedule(scheduleId: string): Schedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedules for a specific module
   */
  getSchedulesForModule(moduleName: string): Schedule[] {
    return Array.from(this.schedules.values()).filter(
      s => s.moduleName === moduleName
    );
  }

  /**
   * Get active schedules (enabled and not exceeded)
   */
  getActiveSchedules(): Schedule[] {
    return Array.from(this.schedules.values()).filter(
      s =>
        s.enabled &&
        (!s.maxApplications || s.applicationCount < s.maxApplications)
    );
  }

  // ========================================================================
  // Execution Control
  // ========================================================================

  /**
   * Start all active schedules
   */
  start(): void {
    this.config.enabled = true;

    for (const schedule of this.getActiveSchedules()) {
      this.startSchedule(schedule);
    }
  }

  /**
   * Stop all schedules
   */
  stop(): void {
    this.config.enabled = false;

    for (const [scheduleId] of this.cronJobs.keys()) {
      this.stopSchedule(scheduleId);
    }
  }

  /**
   * Execute a schedule immediately
   */
  async executeSchedule(scheduleId: string): Promise<ScheduleResult> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return {
        scheduleId,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: "Schedule not found",
      };
    }

    // Check if already running
    if (this.runningExecutions.has(scheduleId)) {
      return {
        scheduleId,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: "Schedule already running",
      };
    }

    // Check max applications
    if (
      schedule.maxApplications &&
      schedule.applicationCount >= schedule.maxApplications
    ) {
      return {
        scheduleId,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: "Maximum applications reached",
      };
    }

    // Check concurrent limit
    if (this.runningExecutions.size >= this.config.maxConcurrentSchedules) {
      return {
        scheduleId,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: "Maximum concurrent schedules reached",
      };
    }

    this.runningExecutions.add(scheduleId);

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(schedule);

      // Update schedule
      schedule.lastRun = result.timestamp;
      schedule.applicationCount++;

      // Update next run time
      if (schedule.recurring) {
        schedule.nextRun = this.calculateNextRun(schedule);
      } else {
        schedule.enabled = false;
        this.stopSchedule(scheduleId);
      }

      // Record result
      this.executionHistory.push(result);
      if (this.executionHistory.length > 1000) {
        this.executionHistory = this.executionHistory.slice(-500);
      }

      return result;
    } catch (error) {
      const result: ScheduleResult = {
        scheduleId,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.executionHistory.push(result);
      return result;
    } finally {
      this.runningExecutions.delete(scheduleId);
    }
  }

  /**
   * Execute all schedules that are due
   */
  async executeDueSchedules(): Promise<ScheduleResult[]> {
    const now = Date.now();
    const dueSchedules = this.getActiveSchedules().filter(
      s => s.nextRun <= now
    );

    const results: ScheduleResult[] = [];
    for (const schedule of dueSchedules) {
      const result = await this.executeSchedule(schedule.id);
      results.push(result);
    }

    return results;
  }

  // ========================================================================
  // Statistics & History
  // ========================================================================

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 100): ScheduleResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    upcomingRuns: Array<{
      scheduleId: string;
      moduleName: string;
      nextRun: number;
    }>;
  } {
    const successful = this.executionHistory.filter(r => r.success).length;
    const failed = this.executionHistory.filter(r => !r.success).length;

    const upcoming = this.getActiveSchedules()
      .filter(s => s.nextRun > Date.now())
      .sort((a, b) => a.nextRun - b.nextRun)
      .slice(0, 10)
      .map(s => ({
        scheduleId: s.id,
        moduleName: s.moduleName,
        nextRun: s.nextRun,
      }));

    return {
      totalSchedules: this.schedules.size,
      activeSchedules: this.getActiveSchedules().length,
      totalExecutions: this.executionHistory.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      avgExecutionTime: 0, // Would need to track timing
      upcomingRuns: upcoming,
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private startSchedule(schedule: Schedule): void {
    if (this.cronJobs.has(schedule.id)) {
      return; // Already running
    }

    try {
      const job = new CronJob(
        schedule.cron,
        () => this.executeSchedule(schedule.id),
        null,
        true,
        schedule.timeZone
      );

      this.cronJobs.set(schedule.id, job);
    } catch (error) {
      console.error(`Failed to start schedule ${schedule.id}:`, error);
    }
  }

  private stopSchedule(scheduleId: string): void {
    const job = this.cronJobs.get(scheduleId);
    if (job) {
      job.stop();
      this.cronJobs.delete(scheduleId);
    }
  }

  private calculateNextRun(schedule: Schedule): number {
    try {
      const job = new CronJob(
        schedule.cron,
        null,
        null,
        false,
        schedule.timeZone
      );
      // Get next run from cron job
      // Note: CronJob doesn't expose this directly, so we use the timeout
      const now = Date.now();
      // Simple approximation: use job.running or next invocation
      // For accurate calculation, we'd need to parse the cron expression ourselves
      return now + 60000; // Placeholder: 1 minute from now
    } catch (error) {
      // Invalid cron expression, return far future
      return Number.MAX_SAFE_INTEGER;
    }
  }

  private async executeWithTimeout(
    schedule: Schedule
  ): Promise<ScheduleResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Schedule execution timeout"));
      }, this.config.scheduleTimeout);

      this.doExecuteSchedule(schedule)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async doExecuteSchedule(schedule: Schedule): Promise<ScheduleResult> {
    const modulesPreloaded: string[] = [];

    // Get module metadata
    const module = this.moduleRegistry.get(schedule.moduleName);
    if (!module) {
      return {
        scheduleId: schedule.id,
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: "Module not found",
      };
    }

    // Load dependencies first
    for (const depId of module.dependencies) {
      const depLoaded = await this.loadModule(depId);
      if (depLoaded) {
        modulesPreloaded.push(depId);
      }
    }

    // Load the module itself
    const loaded = await this.loadModule(module.id);
    if (loaded) {
      modulesPreloaded.push(module.id);
    }

    return {
      scheduleId: schedule.id,
      timestamp: Date.now(),
      modulesPreloaded,
      success: true,
    };
  }

  private async loadModule(moduleId: string): Promise<boolean> {
    const state = this.loadState.get(moduleId);
    if (!state) {
      return false;
    }

    // If already loaded, consider it a cache hit
    if (state.loaded) {
      state.fromCache = true;
      return true;
    }

    // Simulate loading (in real implementation, this would import/preload the module)
    const startTime = Date.now();
    try {
      // Simulate async load
      await new Promise(resolve => setTimeout(resolve, 10));

      state.loaded = true;
      state.loadedAt = Date.now();
      state.loadTime = Date.now() - startTime;
      state.fromCache = false;

      return true;
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  private generateScheduleId(): string {
    return `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.schedules.clear();
    this.cronJobs.clear();
    this.moduleRegistry.clear();
    this.loadState.clear();
    this.executionHistory = [];
  }
}
