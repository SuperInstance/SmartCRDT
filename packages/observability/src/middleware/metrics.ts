/**
 * Metrics collection middleware for Express
 *
 * Automatically collects request metrics for Express applications
 */

import { Request, Response, NextFunction } from "express";
import { MetricsRegistry, getGlobalRegistry } from "../metrics/registry.js";
import { RoutingLabels, ServiceComponent } from "../metrics/types.js";

/**
 * Middleware options
 */
export interface MetricsMiddlewareOptions {
  registry?: MetricsRegistry;
  component: ServiceComponent;
  excludePaths?: string[];
  labelExtractor?: (req: Request) => Partial<RoutingLabels>;
}

/**
 * Create Express middleware for metrics collection
 */
export function createMetricsMiddleware(options: MetricsMiddlewareOptions) {
  const registry = options.registry || getGlobalRegistry();
  const component = options.component;
  const excludePaths = options.excludePaths || [];

  // Get or create metrics
  const requestCounter = registry.registerCounter({
    name: "requests_total",
    type: "counter",
    namespace: "cascade",
    help: "Total HTTP requests",
    labels: {} as RoutingLabels,
  });

  const requestDuration = registry.registerHistogram({
    name: "request_duration_seconds",
    type: "histogram",
    namespace: "cascade",
    help: "HTTP request duration in seconds",
    labels: {} as RoutingLabels,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  const errorCounter = registry.registerCounter({
    name: "errors_total",
    type: "counter",
    namespace: "cascade",
    help: "Total HTTP errors",
    labels: {} as RoutingLabels,
  });

  const activeRequestsGauge = registry.registerGauge({
    name: "active_requests",
    type: "gauge",
    namespace: "cascade",
    help: "Number of active HTTP requests",
    labels: {} as RoutingLabels,
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if path should be excluded
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const start = Date.now();
    const labels = extractLabels(req, component, options.labelExtractor);

    // Increment active requests
    activeRequestsGauge.inc(labels);

    // Track response
    const originalJson = res.json;
    res.json = function (body) {
      const duration = (Date.now() - start) / 1000;

      // Increment request counter
      requestCounter.inc(labels);

      // Record duration
      requestDuration.observe(labels, duration);

      // Track errors
      if (res.statusCode >= 400) {
        errorCounter.inc(labels);
      }

      // Decrement active requests
      activeRequestsGauge.dec(labels);

      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Extract labels from request
 */
function extractLabels(
  req: Request,
  component: ServiceComponent,
  customExtractor?: (req: Request) => Partial<RoutingLabels>
): RoutingLabels {
  const baseLabels: RoutingLabels = {
    component,
    backend: req.headers["x-backend"] as "local" | "cloud" | "hybrid" | "fallback" || "local",
    model: req.headers["x-model"] as string || "unknown",
    query_type: req.headers["x-query-type"] as string || "general",
    complexity_tier: req.headers["x-complexity"] as "simple" | "medium" | "complex" || "medium",
    session_id: req.headers["x-session-id"] as string | undefined,
    user_id: req.headers["x-user-id"] as string | undefined,
  };

  if (customExtractor) {
    return { ...baseLabels, ...customExtractor(req) };
  }

  return baseLabels;
}

/**
 * Extract backend from request headers or query
 */
export function extractBackend(req: Request): "local" | "cloud" | "hybrid" | "fallback" {
  const header = req.headers["x-backend"];
  if (header && typeof header === "string") {
    if (["local", "cloud", "hybrid", "fallback"].includes(header)) {
      return header as "local" | "cloud" | "hybrid" | "fallback";
    }
  }
  return "local";
}

/**
 * Extract model from request headers or query
 */
export function extractModel(req: Request): string {
  const header = req.headers["x-model"];
  if (header && typeof header === "string") {
    return header;
  }
  const query = req.query.model as string;
  return query || "unknown";
}

/**
 * Extract complexity tier from request
 */
export function extractComplexity(req: Request): "simple" | "medium" | "complex" {
  const header = req.headers["x-complexity"];
  if (header && typeof header === "string") {
    if (["simple", "medium", "complex"].includes(header)) {
      return header as "simple" | "medium" | "complex";
    }
  }
  const query = req.query.complexity as string;
  if (["simple", "medium", "complex"].includes(query)) {
    return query as "simple" | "medium" | "complex";
  }
  return "medium";
}
