/**
 * HTTP Health Check
 *
 * Checks HTTP/HTTPS endpoints for availability and response time.
 */

import type {
  HttpCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";

/**
 * HTTP Health Check class
 */
export class HttpCheck {
  private config: HttpCheckConfig;

  constructor(config: HttpCheckConfig) {
    this.config = {
      ...config,
      expectedStatuses: config.expectedStatuses || [200],
      method: config.method || "GET",
      followRedirects: config.followRedirects !== false,
    };
  }

  /**
   * Execute HTTP health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      const response = await fetch(this.config.url!, {
        method: this.config.method,
        headers: this.config.headers,
        body: this.config.body,
        signal: controller.signal,
        // Note: redirect option not available in standard fetch
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Check status code
      const expectedStatuses = this.config.expectedStatuses || [200];
      const statusMatch = expectedStatuses.includes(response.status);

      // Check response time for degraded status
      const maxResponseTime = this.config.maxResponseTime || 1000;
      const isDegraded = responseTime > maxResponseTime;

      let passed = statusMatch && !isDegraded;

      return {
        name: "http-check",
        passed,
        responseTime,
        metadata: {
          statusCode: response.status,
          statusText: response.statusText,
          url: this.config.url,
          method: this.config.method,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: "http-check",
        passed: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          url: this.config.url,
          method: this.config.method,
        },
      };
    }
  }

  /**
   * Execute check and return as health metric
   */
  async executeAsMetric(): Promise<HealthMetric> {
    const result = await this.execute();
    const maxResponseTime = this.config.maxResponseTime || 1000;

    let status: "healthy" | "degraded" | "unhealthy" | "unknown";
    if (!result.passed) {
      status = "unhealthy";
    } else if (result.responseTime > maxResponseTime) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      name: "http-endpoint",
      value: result.responseTime,
      unit: "ms",
      warningThreshold: maxResponseTime * 0.8,
      criticalThreshold: maxResponseTime,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Check multiple URLs
   */
  static async executeMultiple(
    configs: HttpCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new HttpCheck(config));
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
  getConfig(): HttpCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HttpCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Parse URL and extract basic info
   */
  static parseUrl(url: string): {
    protocol: string;
    host: string;
    port?: string;
    path: string;
  } | null {
    try {
      const parsed = new URL(url);
      return {
        protocol: parsed.protocol,
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate HTTP check configuration
   */
  static validateConfig(config: HttpCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.url) {
      errors.push("URL is required");
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push("Invalid URL format");
      }
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push("Timeout must be positive");
    }

    if (config.failureThreshold !== undefined && config.failureThreshold <= 0) {
      errors.push("Failure threshold must be positive");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
