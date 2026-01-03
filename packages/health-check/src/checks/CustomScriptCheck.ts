/**
 * Custom Script Health Check
 *
 * Executes custom scripts and checks exit codes and output.
 */

import type {
  CustomScriptCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";
import { spawn } from "child_process";
import { existsSync } from "fs";

/**
 * Custom Script Health Check class
 */
export class CustomScriptCheck {
  private config: CustomScriptCheckConfig;

  constructor(config: CustomScriptCheckConfig) {
    this.config = {
      ...config,
      expectedExitCode: config.expectedExitCode || 0,
      args: config.args || [],
      env: config.env || {},
    };
  }

  /**
   * Execute custom script health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if script exists
      if (!existsSync(this.config.scriptPath)) {
        return {
          name: "custom-script-check",
          passed: false,
          responseTime: Date.now() - startTime,
          error: `Script "${this.config.scriptPath}" does not exist`,
          metadata: {
            scriptPath: this.config.scriptPath,
          },
        };
      }

      // Execute script
      const result = await this.executeScript();

      let passed = result.exitCode === this.config.expectedExitCode;
      let value = 0;

      // Parse output as metric if configured
      if (this.config.parseMetric && result.stdout) {
        const match = result.stdout.match(/[-+]?\d*\.?\d+/);
        if (match) {
          value = parseFloat(match[0]);
        }
      }

      return {
        name: "custom-script-check",
        passed,
        responseTime: result.executionTime,
        error: result.stderr || undefined,
        metadata: {
          scriptPath: this.config.scriptPath,
          exitCode: result.exitCode,
          stdout: result.stdout?.substring(0, 500),
          stderr: result.stderr?.substring(0, 500),
          metricValue: this.config.parseMetric ? value : undefined,
        },
      };
    } catch (error) {
      return {
        name: "custom-script-check",
        passed: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          scriptPath: this.config.scriptPath,
        },
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
      status = "healthy";
    }

    let value = result.passed ? 1 : 0;
    if (this.config.parseMetric && metadata.metricValue !== undefined) {
      value = metadata.metricValue;
    }

    return {
      name: `script-${this.config.scriptPath.split("/").pop()}`,
      value,
      unit: this.config.parseMetric ? "number" : "boolean",
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Execute the script
   */
  private executeScript(): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    executionTime: number;
  }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = "";
      let stderr = "";

      const child = spawn(this.config.scriptPath, this.config.args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        resolve({
          exitCode: -1,
          stdout: stdout.substring(0, 1000),
          stderr: stderr.substring(0, 1000) || "Script execution timeout",
          executionTime: this.config.timeout,
        });
      }, this.config.timeout);

      child.stdout?.on("data", data => {
        stdout += data.toString();
      });

      child.stderr?.on("data", data => {
        stderr += data.toString();
      });

      child.on("close", code => {
        clearTimeout(timeout);
        const executionTime = Date.now() - startTime;
        resolve({
          exitCode: code || 0,
          stdout: stdout.substring(0, 10000),
          stderr: stderr.substring(0, 10000),
          executionTime,
        });
      });

      child.on("error", error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Execute multiple scripts
   */
  static async executeMultiple(
    configs: CustomScriptCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new CustomScriptCheck(config));
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
  getConfig(): CustomScriptCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CustomScriptCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate custom script check configuration
   */
  static validateConfig(config: CustomScriptCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.scriptPath) {
      errors.push("Script path is required");
    } else if (!existsSync(config.scriptPath)) {
      errors.push(`Script "${config.scriptPath}" does not exist`);
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push("Timeout must be positive");
    }

    if (config.expectedExitCode !== undefined && config.expectedExitCode < 0) {
      errors.push("Expected exit code must be non-negative");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a simple bash script check
   */
  static createBashCheck(
    script: string,
    config: Partial<CustomScriptCheckConfig> = {}
  ): CustomScriptCheck {
    const fullConfig: CustomScriptCheckConfig = {
      scriptPath: "/bin/bash",
      args: ["-c", script],
      timeout: 5000,
      checkInterval: 30000,
      failureThreshold: 3,
      successThreshold: 2,
      ...config,
    };

    return new CustomScriptCheck(fullConfig);
  }

  /**
   * Common health check scripts
   */
  static getCommonChecks(): Record<string, (...args: any[]) => string> {
    return {
      // Check if a service is running (systemd)
      serviceRunning: (serviceName: string) =>
        `systemctl is-active ${serviceName}`,

      // Check if a port is listening
      portListening: (port: number) => `netstat -tuln | grep -q ":${port} "`,

      // Check disk space
      diskSpace: (path: string, threshold: number) =>
        `df ${path} | awk 'NR==2 {print ($5+0)}' | awk -v t=${threshold} '$1 > t {exit 1}'`,

      // Check memory usage
      memoryUsage: (threshold: number) =>
        `free | awk 'NR==2 {printf "%.0f", ($3/$2)*100}' | awk -v t=${threshold} '$1 > t {exit 1}'`,

      // Check CPU load
      cpuLoad: (threshold: number) =>
        `uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | awk -F',' -v t=${threshold} '$1 > t {exit 1}'`,

      // Check if file exists
      fileExists: (filePath: string) => `test -f ${filePath}`,

      // Check if directory exists
      dirExists: (dirPath: string) => `test -d ${dirPath}`,

      // Ping check
      ping: (host: string, count = 1) =>
        `ping -c ${count} ${host} > /dev/null 2>&1`,
    };
  }
}
