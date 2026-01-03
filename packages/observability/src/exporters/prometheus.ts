/**
 * Prometheus Metrics Exporter
 *
 * HTTP server for exposing Prometheus metrics endpoint
 */

import { EventEmitter } from "events";
import { MetricsRegistry, getGlobalRegistry, defineAequorMetrics } from "../metrics/registry.js";
import { ObservabilityConfig } from "../metrics/types.js";

/**
 * Prometheus exporter options
 */
export interface PrometheusExporterOptions {
  port?: number;
  endpoint?: string;
  host?: string;
  registry?: MetricsRegistry;
  collectDefaultMetrics?: boolean;
}

/**
 * Prometheus metrics exporter
 */
export class PrometheusExporter extends EventEmitter {
  private port: number;
  private endpoint: string;
  private host: string;
  private registry: MetricsRegistry;
  private server: any | null = null; // Will be HTTP server
  private running: boolean = false;

  constructor(options: PrometheusExporterOptions = {}) {
    super();
    this.port = options.port || 9182;
    this.endpoint = options.endpoint || "/metrics";
    this.host = options.host || "0.0.0.0";
    this.registry = options.registry || getGlobalRegistry();

    // Define all Aequor metrics
    defineAequorMetrics(this.registry);
  }

  /**
   * Start the metrics server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Prometheus exporter is already running");
    }

    return new Promise((resolve, reject) => {
      try {
        // Dynamic import to avoid hard dependency on http
        import("http").then(({ createServer }) => {
          this.server = createServer(async (req, res) => {
            if (req.url === this.endpoint) {
              try {
                const metrics = await this.registry.getMetrics();
                res.setHeader("Content-Type", "text/plain");
                res.end(metrics);
              } catch (error) {
                res.statusCode = 500;
                res.end("Error collecting metrics");
                this.emit("error", error);
              }
            } else {
              res.statusCode = 404;
              res.end("Not Found");
            }
          });

          this.server.listen(this.port, this.host, () => {
            this.running = true;
            this.emit("started", { port: this.port, host: this.host });
            resolve();
          });

          this.server.on("error", (error: Error) => {
            this.emit("error", error);
            reject(error);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the metrics server
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err: Error) => {
        this.running = false;
        this.server = null;
        if (err) {
          this.emit("error", err);
          reject(err);
        } else {
          this.emit("stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get metrics as string
   */
  async getMetrics(): Promise<string> {
    return await this.registry.getMetrics();
  }

  /**
   * Get the metrics registry
   */
  getRegistry(): MetricsRegistry {
    return this.registry;
  }
}

/**
 * Create and start a Prometheus exporter with config
 */
export async function createPrometheusExporter(
  config: ObservabilityConfig
): Promise<PrometheusExporter> {
  const exporter = new PrometheusExporter({
    port: config.prometheus.port,
    endpoint: config.prometheus.endpoint,
  });

  if (config.prometheus.enabled) {
    await exporter.start();
  }

  return exporter;
}
