/**
 * ReportGenerator - Generates scheduled reports from dashboards
 */

import type {
  Report,
  ReportSchedule,
  ExportFormat,
  DateRange,
} from "../types.js";

export interface ReportConfig {
  name: string;
  description: string;
  dashboardId: string;
  dateRange: DateRange;
  format: ExportFormat;
  includeSections: string[];
}

export class ReportGenerator {
  private schedules: Map<string, ReportSchedule> = new Map();
  private reports: Map<string, Report> = new Map();
  private scheduleTimer: NodeJS.Timeout | null = null;

  /**
   * Create a report
   */
  createReport(config: ReportConfig, createdBy: string): Report {
    const report: Report = {
      id: this.generateId(),
      name: config.name,
      description: config.description,
      dashboardId: config.dashboardId,
      dateRange: config.dateRange,
      format: config.format,
      createdAt: Date.now(),
      createdBy,
    };

    this.reports.set(report.id, report);

    return report;
  }

  /**
   * Get a report
   */
  getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  /**
   * Get all reports
   */
  getAllReports(): Report[] {
    return Array.from(this.reports.values());
  }

  /**
   * Delete a report
   */
  deleteReport(id: string): boolean {
    return this.reports.delete(id);
  }

  /**
   * Create a schedule
   */
  createSchedule(schedule: Omit<ReportSchedule, "id">): ReportSchedule {
    const newSchedule: ReportSchedule = {
      id: this.generateId(),
      ...schedule,
    };

    this.schedules.set(newSchedule.id, newSchedule);
    this.startScheduleTimer();

    return newSchedule;
  }

  /**
   * Get a schedule
   */
  getSchedule(id: string): ReportSchedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ReportSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Update a schedule
   */
  updateSchedule(
    id: string,
    updates: Partial<ReportSchedule>
  ): ReportSchedule | undefined {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;

    const updated = { ...schedule, ...updates };
    this.schedules.set(id, updated);

    return updated;
  }

  /**
   * Enable/disable a schedule
   */
  toggleSchedule(id: string, enabled: boolean): void {
    const schedule = this.schedules.get(id);
    if (schedule) {
      schedule.enabled = enabled;
    }
  }

  /**
   * Delete a schedule
   */
  deleteSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }

  /**
   * Generate report for a schedule
   */
  async generateReportForSchedule(scheduleId: string): Promise<Report | null> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) return null;

    const report = this.createReport(
      {
        name: schedule.name,
        description: `Scheduled report (${schedule.type})`,
        dashboardId: schedule.dashboardId,
        dateRange: this.calculateDateRange(schedule.type),
        format: schedule.format,
        includeSections: [],
      },
      "system"
    );

    // Update next run time
    schedule.nextRun = this.calculateNextRun(schedule);

    return report;
  }

  /**
   * Calculate date range for schedule type
   */
  private calculateDateRange(type: "daily" | "weekly" | "monthly"): DateRange {
    const now = new Date();
    const end = now;
    let start: Date;

    switch (type) {
      case "daily":
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        break;
      case "weekly":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case "monthly":
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return { start, end };
  }

  /**
   * Calculate next run time for schedule
   */
  private calculateNextRun(schedule: ReportSchedule): number {
    const now = Date.now();
    let nextRun: number;

    switch (schedule.type) {
      case "daily":
        nextRun = now + 24 * 60 * 60 * 1000;
        break;
      case "weekly":
        nextRun = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case "monthly":
        nextRun = now + 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        nextRun = now + 24 * 60 * 60 * 1000;
    }

    return nextRun;
  }

  /**
   * Start schedule timer
   */
  private startScheduleTimer(): void {
    if (this.scheduleTimer) return;

    this.scheduleTimer = setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Check for due schedules
   */
  private checkSchedules(): void {
    const now = Date.now();

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled && schedule.nextRun <= now) {
        this.generateReportForSchedule(schedule.id);
      }
    }
  }

  /**
   * Stop schedule timer
   */
  stopScheduleTimer(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get report statistics
   */
  getStats(): {
    totalReports: number;
    totalSchedules: number;
    activeSchedules: number;
    reportsByDashboard: Record<string, number>;
  } {
    const reportsByDashboard: Record<string, number> = {};

    for (const report of this.reports.values()) {
      reportsByDashboard[report.dashboardId] =
        (reportsByDashboard[report.dashboardId] || 0) + 1;
    }

    return {
      totalReports: this.reports.size,
      totalSchedules: this.schedules.size,
      activeSchedules: Array.from(this.schedules.values()).filter(
        s => s.enabled
      ).length,
      reportsByDashboard,
    };
  }

  /**
   * Clear all
   */
  clear(): void {
    this.stopScheduleTimer();
    this.schedules.clear();
    this.reports.clear();
  }
}
