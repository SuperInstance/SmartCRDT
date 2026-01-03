/**
 * TCP Health Check
 *
 * Checks TCP port availability and connectivity.
 */

import type {
  TcpCheckConfig,
  HealthCheckResult,
  HealthMetric,
} from "../types.js";

// Conditional import for Node.js net module
let netModule: any;
try {
  netModule = await import("net");
} catch {
  // Running in browser environment
  netModule = null;
}

/**
 * TCP Health Check class
 */
export class TcpCheck {
  private config: TcpCheckConfig;

  constructor(config: TcpCheckConfig) {
    this.config = {
      ...config,
      connectionTimeout: config.connectionTimeout || config.timeout,
    };
  }

  /**
   * Execute TCP health check
   */
  async execute(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    return new Promise(resolve => {
      if (!netModule) {
        resolve({
          name: "tcp-check",
          passed: false,
          responseTime: 0,
          error: "TCP check not available in browser environment",
          metadata: {
            host: this.config.host,
            port: this.config.port,
          },
        });
        return;
      }

      const socket = netModule.createSocket(
        this.config.host.includes(":") ? "tcp6" : "tcp4"
      );

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          name: "tcp-check",
          passed: false,
          responseTime: this.config.timeout,
          error: "Connection timeout",
          metadata: {
            host: this.config.host,
            port: this.config.port,
          },
        });
      }, this.config.connectionTimeout || this.config.timeout);

      socket.connect(this.config.port, this.config.host);

      socket.on("connect", async () => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        // If send data is configured, send it
        if (this.config.sendData) {
          socket.write(this.config.sendData);
        }

        // Wait for response if expected
        if (this.config.expectResponse) {
          let responseData = Buffer.alloc(0);

          socket.on("data", (data: Buffer | string) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            responseData = Buffer.concat([responseData, chunk]);
          });

          // Wait a bit for response
          setTimeout(() => {
            socket.destroy();

            const responseStr = responseData.toString();
            const responseMatch = responseStr.includes(
              this.config.expectResponse!
            );

            resolve({
              name: "tcp-check",
              passed: responseMatch,
              responseTime,
              metadata: {
                host: this.config.host,
                port: this.config.port,
                responseReceived: responseStr.length > 0,
                expectedResponse: this.config.expectResponse,
                actualResponse: responseStr.substring(0, 100),
              },
            });
          }, 500);
        } else {
          socket.destroy();

          resolve({
            name: "tcp-check",
            passed: true,
            responseTime,
            metadata: {
              host: this.config.host,
              port: this.config.port,
            },
          });
        }
      });

      socket.on("error", (error: Error) => {
        clearTimeout(timeout);
        socket.destroy();

        resolve({
          name: "tcp-check",
          passed: false,
          responseTime: Date.now() - startTime,
          error: error.message,
          metadata: {
            host: this.config.host,
            port: this.config.port,
          },
        });
      });
    });
  }

  /**
   * Execute check and return as health metric
   */
  async executeAsMetric(): Promise<HealthMetric> {
    const result = await this.execute();

    let status: "healthy" | "degraded" | "unhealthy" | "unknown";
    if (result.passed) {
      const maxResponseTime = this.config.maxResponseTime || 500;
      if (result.responseTime > maxResponseTime) {
        status = "degraded";
      } else {
        status = "healthy";
      }
    } else {
      status = "unhealthy";
    }

    return {
      name: "tcp-connection",
      value: result.passed ? 1 : 0,
      unit: "boolean",
      status,
      timestamp: new Date(),
      metadata: {
        responseTime: result.responseTime,
        error: result.error,
      },
    };
  }

  /**
   * Check multiple TCP endpoints
   */
  static async executeMultiple(
    configs: TcpCheckConfig[]
  ): Promise<HealthCheckResult[]> {
    const checks = configs.map(config => new TcpCheck(config));
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
  getConfig(): TcpCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TcpCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate TCP check configuration
   */
  static validateConfig(config: TcpCheckConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.host) {
      errors.push("Host is required");
    }

    if (!config.port || config.port <= 0 || config.port > 65535) {
      errors.push("Valid port (1-65535) is required");
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push("Timeout must be positive");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if port is commonly used for specific service
   */
  static getServiceName(port: number): string {
    const commonPorts: Record<number, string> = {
      21: "FTP",
      22: "SSH",
      23: "Telnet",
      25: "SMTP",
      53: "DNS",
      80: "HTTP",
      110: "POP3",
      143: "IMAP",
      443: "HTTPS",
      465: "SMTPS",
      587: "SMTP (Submission)",
      993: "IMAPS",
      995: "POP3S",
      3306: "MySQL",
      3389: "RDP",
      5432: "PostgreSQL",
      5672: "RabbitMQ",
      6379: "Redis",
      8080: "HTTP Proxy",
      9200: "Elasticsearch",
      27017: "MongoDB",
    };

    return commonPorts[port] || "Unknown";
  }
}
