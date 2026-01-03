/**
 * Scheduler - Manages scheduled report generation
 */

import { EventEmitter } from "eventemitter3";
import type { ReportSchedule } from "../types.js";

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: ReportSchedule;
  lastRun?: number;
  nextRun: number;
  running: boolean;
}

export class Scheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private checkInterval: number = 60 * 1000; // 1 minute

  constructor() {
    super();
    this.start();
  }

  /**
   * Add a scheduled task
   */
  addTask(name: string, schedule: ReportSchedule): ScheduledTask {
    const task: ScheduledTask = {
      id: this.generateId(),
      name,
      schedule,
      nextRun: this.calculateNextRun(schedule),
      running: false,
    };

    this.tasks.set(task.id, task);
    this.emit("taskAdded", task);

    return task;
  }

  /**
   * Get a task
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): ScheduledTask[] {
    return this.getAllTasks().filter(t => t.schedule.enabled);
  }

  /**
   * Get due tasks
   */
  getDueTasks(): ScheduledTask[] {
    const now = Date.now();
    return this.getActiveTasks().filter(t => t.nextRun <= now && !t.running);
  }

  /**
   * Update a task
   */
  updateTask(
    id: string,
    updates: Partial<ScheduledTask>
  ): ScheduledTask | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);

    return updated;
  }

  /**
   * Remove a task
   */
  removeTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Enable/disable a task
   */
  toggleTask(id: string, enabled: boolean): void {
    const task = this.tasks.get(id);
    if (task) {
      task.schedule.enabled = enabled;
      if (enabled) {
        task.nextRun = this.calculateNextRun(task.schedule);
      }
    }
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task || task.running) return;

    task.running = true;
    task.lastRun = Date.now();

    this.emit("taskTriggered", task);

    try {
      // Emit for handler to execute
      this.emit("execute", task);
    } finally {
      task.running = false;
      task.nextRun = this.calculateNextRun(task.schedule);
      this.emit("taskCompleted", task);
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.checkAndExecute();
    }, this.checkInterval);

    this.emit("started");
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.emit("stopped");
  }

  /**
   * Check for due tasks and execute
   */
  private checkAndExecute(): void {
    const dueTasks = this.getDueTasks();

    for (const task of dueTasks) {
      this.triggerTask(task.id);
    }
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: ReportSchedule): number {
    const now = new Date();
    const timezone = schedule.timezone || "UTC";

    switch (schedule.type) {
      case "daily":
        // Next day at same time
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay.getTime();

      case "weekly":
        // Next week at same time
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.getTime();

      case "monthly":
        // Next month at same time
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth.getTime();

      default:
        return now.getTime() + 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    totalTasks: number;
    activeTasks: number;
    dueTasks: number;
    runningTasks: number;
  } {
    return {
      running: this.timer !== null,
      totalTasks: this.tasks.size,
      activeTasks: this.getActiveTasks().length,
      dueTasks: this.getDueTasks().length,
      runningTasks: this.getAllTasks().filter(t => t.running).length,
    };
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.stop();
    this.tasks.clear();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
