/**
 * Example: Integrating @lsi/observability into an Aequor service
 *
 * This demonstrates how to add comprehensive observability to any service.
 */

import express from "express";
import {
  getGlobalRegistry,
  defineAequorMetrics,
  PrometheusExporter,
  createMetricsMiddleware,
  createTracer,
  ServiceComponent,
  MetricNamespace
} from "@lsi/observability";

async function main() {
  // 1. Initialize Metrics Registry
  const registry = getGlobalRegistry();
  defineAequorMetrics(registry);

  // 2. Start Prometheus Exporter
  const exporter = new PrometheusExporter({
    port: 9182,
    endpoint: "/metrics"
  });
  await exporter.start();
  console.log("Prometheus exporter started on port 9182");

  // 3. Initialize Tracing
  const tracer = await createTracer("aequor-cascade-router", {
    enabled: true,
    exporter: "jaeger",
    endpoint: "http://localhost:14268/api/traces",
    sampleRate: 0.1
  });
  console.log("Tracing initialized");

  // 4. Create Express App with Metrics Middleware
  const app = express();

  // Add metrics collection middleware
  app.use(createMetricsMiddleware({
    component: ServiceComponent.CASCADE_ROUTER,
    excludePaths: ["/health", "/metrics"],
    labelExtractor: (req) => ({
      backend: req.headers["x-backend"] as "local" | "cloud" | "hybrid" || "local",
      model: req.headers["x-model"] as string || "unknown",
      query_type: req.headers["x-query-type"] as string || "general",
      complexity_tier: req.headers["x-complexity"] as "simple" | "medium" | "complex" || "medium"
    })
  }));

  // 5. Add custom metrics
  const cacheHitRate = registry.registerGauge({
    name: "cache_hit_rate",
    type: "gauge",
    namespace: MetricNamespace.CACHE,
    help: "Current cache hit rate",
    labels: {
      cache_type: "semantic"
    }
  });

  // 6. Example Routes with Tracing

  app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  app.post("/api/query", async (req, res) => {
    // Automatic tracing from middleware
    const span = tracer.getCurrentSpan();

    // Extract labels from request
    const backend = extractBackend(req);
    const complexity = extractComplexity(req);

    // Add custom attributes to span
    span?.setAttributes({
      "query.length": req.body.query?.length || 0,
      "query.backend": backend,
      "query.complexity": complexity
    });

    try {
      // Process the query
      const result = await processQuery(req.body.query, backend, complexity);

      // Update custom metrics
      cacheHitRate.set({ cache_type: "semantic" }, result.cacheHitRate);

      // Add result attributes
      span?.setAttributes({
        "result.latency_ms": result.latency,
        "result.cache_hit": result.fromCache
      });

      res.json(result);
    } catch (error) {
      // Record error in span
      span?.recordException(error as Error);

      // Increment error counter (automatic from middleware)
      res.status(500).json({ error: "Query processing failed" });
    }
  });

  // 7. Start server
  const port = 3000;
  app.listen(port, () => {
    console.log(`Service listening on port ${port}`);
    console.log(`Metrics available at http://localhost:${port}/metrics`);
  });
}

// Helper functions
function extractBackend(req: any): "local" | "cloud" | "hybrid" {
  const header = req.headers["x-backend"];
  if (["local", "cloud", "hybrid"].includes(header)) {
    return header as "local" | "cloud" | "hybrid";
  }
  return "local";
}

function extractComplexity(req: any): "simple" | "medium" | "complex" {
  const header = req.headers["x-complexity"];
  if (["simple", "medium", "complex"].includes(header)) {
    return header as "simple" | "medium" | "complex";
  }
  return "medium";
}

async function processQuery(query: string, backend: string, complexity: string) {
  // Simulate processing
  return {
    result: "Response",
    latency: Math.random() * 100,
    fromCache: Math.random() > 0.5,
    cacheHitRate: 0.85
  };
}

// Start the service
main().catch(console.error);
