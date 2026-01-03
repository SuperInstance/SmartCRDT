/**
 * OpenTelemetry Distributed Tracing for Aequor
 *
 * Provides distributed tracing capabilities using OpenTelemetry
 */

import { trace, context, Span, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { JaegerExporter } from "@opentelemetry/exporter-trace-jaeger";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { ObservabilityConfig } from "../metrics/types.js";

/**
 * Tracer options
 */
export interface TracerOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  exporter: "jaeger" | "otlp" | "console";
  endpoint?: string;
  sampleRate?: number;
  batch?: boolean;
}

/**
 * Aequor tracer wrapper
 */
export class AequorTracer {
  private tracer: any;
  private provider: NodeTracerProvider;
  private configured: boolean = false;

  constructor(private options: TracerOptions) {
    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion || "1.0.0",
        ["deployment.environment"]: options.environment || "production",
      }),
    });
  }

  /**
   * Configure and start the tracer
   */
  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    // Configure exporter based on type
    const exporter = this.createExporter();

    // Add span processor
    if (this.options.batch !== false) {
      this.provider.addSpanProcessor(
        new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
        })
      );
    } else {
      this.provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    }

    // Register the provider
    this.provider.register();
    this.tracer = trace.getTracer(
      this.options.serviceName,
      this.options.serviceVersion
    );

    this.configured = true;
  }

  /**
   * Create exporter based on configuration
   */
  private createExporter() {
    switch (this.options.exporter) {
      case "jaeger":
        return new JaegerExporter({
          endpoint: this.options.endpoint || "http://localhost:14268/api/traces",
        });

      case "console":
        // Console exporter for debugging
        return {
          export: (spans: any[]) => {
            console.log("Spans:", JSON.stringify(spans, null, 2));
            return Promise.resolve();
          },
          shutdown: () => Promise.resolve(),
        };

      default:
        throw new Error(`Unsupported exporter: ${this.options.exporter}`);
    }
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: any): Span {
    if (!this.configured) {
      throw new Error("Tracer not configured. Call configure() first.");
    }
    return this.tracer.startSpan(name, {
      kind: SpanKind.SERVER,
      ...options,
    });
  }

  /**
   * Start a span with context
   */
  startSpanWithContext(name: string, context: any, options?: any): Span {
    if (!this.configured) {
      throw new Error("Tracer not configured. Call configure() first.");
    }
    return this.tracer.startSpan(name, {
      context,
      kind: SpanKind.SERVER,
      ...options,
    });
  }

  /**
   * Run a function within a span
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(name);

    if (attributes) {
      span.setAttributes(attributes);
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Wrap a function with tracing
   */
  wrapWithTrace<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    attributes?: Record<string, any>
  ): T {
    return ((...args: any[]) => {
      return this.withSpan(name, async () => fn(...args), attributes);
    }) as T;
  }

  /**
   * Get current span
   */
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Add attributes to current span
   */
  addAttributes(attributes: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Record exception on current span
   */
  recordException(error: Error): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.recordException(error);
    }
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    if (this.configured) {
      await this.provider.shutdown();
      this.configured = false;
    }
  }

  /**
   * Force flush any pending spans
   */
  async forceFlush(): Promise<void> {
    if (this.configured) {
      await this.provider.forceFlush();
    }
  }
}

/**
 * Create tracer from config
 */
export async function createTracer(
  serviceName: string,
  config: ObservabilityConfig
): Promise<AequorTracer> {
  const tracer = new AequorTracer({
    serviceName,
    exporter: config.tracing.exporter,
    endpoint: config.tracing.endpoint,
    sampleRate: config.tracing.sampleRate,
    environment: "production",
  });

  if (config.tracing.enabled) {
    await tracer.configure();
  }

  return tracer;
}

/**
 * Global tracer instance
 */
let globalTracer: AequorTracer | null = null;

/**
 * Get or create global tracer
 */
export async function getGlobalTracer(config?: ObservabilityConfig): Promise<AequorTracer> {
  if (!globalTracer && config) {
    globalTracer = await createTracer("aequor", config);
  }
  return globalTracer!;
}

/**
 * Decorator for automatic method tracing
 */
export function traceable(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = await getGlobalTracer();
      if (!tracer) {
        return originalMethod.apply(this, args);
      }

      return tracer.withSpan(name, async (span) => {
        span.setAttributes({
          "class.name": target.constructor.name,
          "method.name": propertyKey,
        });
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
