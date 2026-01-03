/**
 * CPU Health Check
 *
 * Checks CPU load average and usage percentage.
 */

import type {
  CpuCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";
import { readFileSync, existsSync } from "fs";
import { cpus } from "os";

/**
 * CPU Health Check class
 */
export class CpuCheck {
  private config: CpuCheckConfig;
  private previousCpuTimes: Map<number, { idle: number; total: number }>;

  constructor(config: CpuCheckConfig) {
    this.config = {
      ...config,
      maxLoadAverage1: config.maxLoadAverage1 || cpus().length,
      maxLoadAverage5: config.maxLoadAverage5 || cpus().length * 0.8,
      maxCpuUsage: config.maxCpuUsage || 80,
    };
    this.previousCpuTimes = new Map();
  }

  /**
   * Execute CPU health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const cpuStats = await this.getCpuStats();

      let passed = true;
      const errors: string[] = [];

      // Check 1-minute load average
      if (this.config.maxLoadAverage1) {
        if (cpuStats.loadAverage1 > this.config.maxLoadAverage1) {
          passed = false;
          errors.push(
            `1-min load average ${cpuStats.loadAverage1.toFixed(2)} exceeds threshold ${this.config.maxLoadAverage1}`
          );
        }
      }

      // Check 5-minute load average
      if (this.config.maxLoadAverage5) {
        if (cpuStats.loadAverage5 > this.config.maxLoadAverage5) {
          passed = false;
          errors.push(
            `5-min load average ${cpuStats.loadAverage5.toFixed(2)} exceeds threshold ${this.config.maxLoadAverage5}`
          );
        }
      }

      // Check CPU usage
      if (this.config.maxCpuUsage) {
        if (cpuStats.usagePercent > this.config.maxCpuUsage) {
          passed = false;
          errors.push(
            `CPU usage ${cpuStats.usagePercent.toFixed(1)}% exceeds threshold ${this.config.maxCpuUsage}%`
          );
        }
      }

      return {
        name: "cpu-check",
        passed,
        responseTime: Date.now() - startTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        metadata: {
          loadAverage1: cpuStats.loadAverage1,
          loadAverage5: cpuStats.loadAverage5,
          loadAverage15: cpuStats.loadAverage15,
          usagePercent: cpuStats.usagePercent.toFixed(1),
          cpuCount: cpuStats.cpuCount,
        },
      };
    } catch (error) {
      return {
        name: "cpu-check",
        passed: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute check and return as health metric
   */
  async executeAsMetric(): Promise<HealthMetric> {
    const result = await this.execute();
    const metadata = result.metadata as any;

    let status: "healthy" | "degraded" | "unhealthy" | "unknown";
    if (!result.passed) {
      status = "unhealthy";
    } else {
      const usagePercent = parseFloat(metadata.usagePercent || "0");
      const warningThreshold = (this.config.maxCpuUsage || 80) * 0.8;
      const criticalThreshold = this.config.maxCpuUsage || 80;

      if (usagePercent > criticalThreshold) {
        status = "unhealthy";
      } else if (usagePercent > warningThreshold) {
        status = "degraded";
      } else {
        status = "healthy";
      }
    }

    return {
      name: "cpu-usage",
      value: parseFloat(metadata.usagePercent || "0"),
      unit: "%",
      warningThreshold: (this.config.maxCpuUsage || 80) * 0.8,
      criticalThreshold: this.config.maxCpuUsage || 80,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Get CPU statistics
   */
  private async getCpuStats(): Promise<{
    loadAverage1: number;
    loadAverage5: number;
    loadAverage15: number;
    usagePercent: number;
    cpuCount: number;
  }> {
    try {
      const os = await import("os");

      // Get load averages
      const loadAvg = os.loadavg();
      const loadAverage1 = loadAvg[0];
      const loadAverage5 = loadAvg[1];
      const loadAverage15 = loadAvg[2];

      // Get CPU count
      const cpuCount = os.cpus().length;

      // Calculate CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      }

      const usagePercent = ((totalTick - totalIdle) / totalTick) * 100;

      return {
        loadAverage1,
        loadAverage5,
        loadAverage15,
        usagePercent,
        cpuCount,
      };
    } catch {
      return {
        loadAverage1: 0,
        loadAverage5: 0,
        loadAverage15: 0,
        usagePercent: 0,
        cpuCount: 0,
      };
    }
  }

  /**
   * Get CPU stats from /proc/stat (Linux)
   */
  private async getLinuxCpuStats(): Promise<{
    user: number;
    nice: number;
    system: number;
    idle: number;
    iowait: number;
  }> {
    try {
      const statPath = "/proc/stat";
      if (!existsSync(statPath)) {
        throw new Error("Cannot read CPU stats");
      }

      const content = readFileSync(statPath, "utf-8");
      const lines = content.split("\n");
      const cpuLine = lines.find(line => line.startsWith("cpu "));

      if (!cpuLine) {
        throw new Error("CPU line not found");
      }

      const parts = cpuLine.split(/\s+/).slice(1);
      return {
        user: parseInt(parts[0] || "0"),
        nice: parseInt(parts[1] || "0"),
        system: parseInt(parts[2] || "0"),
        idle: parseInt(parts[3] || "0"),
        iowait: parseInt(parts[4] || "0"),
      };
    } catch {
      return {
        user: 0,
        nice: 0,
        system: 0,
        idle: 0,
        iowait: 0,
      };
    }
  }

  /**
   * Get per-CPU usage
   */
  static getPerCpuUsage(): Array<{
    cpu: string;
    usagePercent: number;
  }> {
    const os = require("os");
    const cpus = os.cpus();

    return cpus.map((cpu: any, index: number) => {
      const times = cpu.times;
      const total = Object.values(times).reduce(
        (a: number, b: any) => a + b,
        0
      );
      const idle = times.idle;
      const usagePercent = ((total - idle) / total) * 100;

      return {
        cpu: `CPU${index}`,
        usagePercent,
      };
    });
  }

  /**
   * Check multiple CPU configurations
   */
  static async executeMultiple(
    configs: CpuCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new CpuCheck(config));
    return Promise.all(checks.map(check => check.execute()));
  }

  /**
   * Create health check function
   */
  toFunction(): () => Promise<boolean> {
    return async () => {
      const result = await this.execute();
      return result.passed;
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CpuCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CpuCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate CPU check configuration
   */
  static validateConfig(config: CpuCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (config.maxLoadAverage1 !== undefined && config.maxLoadAverage1 <= 0) {
      errors.push("Max load average (1 min) must be positive");
    }

    if (config.maxLoadAverage5 !== undefined && config.maxLoadAverage5 <= 0) {
      errors.push("Max load average (5 min) must be positive");
    }

    if (
      config.maxCpuUsage !== undefined &&
      (config.maxCpuUsage < 0 || config.maxCpuUsage > 100)
    ) {
      errors.push("Max CPU usage must be between 0 and 100");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get CPU info
   */
  static getCpuInfo(): {
    model: string;
    speed: number;
    cores: number;
  } {
    const os = require("os");
    const cpus = os.cpus();

    return {
      model: cpus[0]?.model || "Unknown",
      speed: cpus[0]?.speed || 0,
      cores: cpus.length,
    };
  }
}
