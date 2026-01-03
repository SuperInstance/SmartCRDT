/**
 * Metrics Integration Examples
 *
 * This file demonstrates how to integrate the metrics system
 * with existing Aequor components.
 */
import { MetricsCollector } from "./MetricsCollector.js";
import type { RouteDecision } from "../types.js";
/**
 * Example 1: Recording metrics from routing decisions
 *
 * Shows how to wrap routing to collect metrics.
 */
export declare function recordRouteMetrics(collector: MetricsCollector, decision: RouteDecision, query: string, latency: number, context?: {
    sessionId?: string;
}): void;
/**
 * Example 2: Recording routing errors
 */
export declare function recordRouteError(collector: MetricsCollector, error: Error, query: string, latency: number, context?: {
    sessionId?: string;
}): void;
/**
 * Example 3: Recording cache operations
 */
export declare function recordCacheOperation(collector: MetricsCollector, cacheType: "semantic" | "embedding" | "lru", hit: boolean, entrySize?: number): void;
/**
 * Example 4: Recording adapter requests
 */
export declare function recordAdapterRequest(collector: MetricsCollector, backend: "local" | "cloud" | "hybrid", model: string, latency: number, success: boolean, cost: number, query: string, sessionId: string, error?: string): void;
/**
 * Example 5: Setting up health monitoring
 */
export declare class HealthMonitor {
    private collector;
    private interval;
    constructor(collector: MetricsCollector);
    /**
     * Start periodic health checks
     */
    start(checkIntervalMs?: number): void;
    /**
     * Stop health checks
     */
    stop(): void;
    /**
     * Check all backends and record health status
     */
    private checkAllBackends;
    /**
     * Check local backend health
     */
    private checkLocalBackend;
    /**
     * Check cloud backend health
     */
    private checkCloudBackend;
}
/**
 * Example 6: Monitoring system metrics
 */
export declare class SystemMetricsMonitor {
    private collector;
    private interval;
    constructor(collector: MetricsCollector);
    /**
     * Start monitoring system metrics
     */
    start(updateIntervalMs?: number): void;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Update system metrics
     */
    private updateSystemMetrics;
}
/**
 * Example 7: Cost tracking helper
 */
export declare class CostTracker {
    private costPer1kTokens;
    /**
     * Calculate cost for a request
     */
    calculateCost(model: string, inputTokens: number, outputTokens: number): number;
    /**
     * Record request with cost
     */
    recordRequestWithCost(collector: MetricsCollector, model: string, inputTokens: number, outputTokens: number, backend: "local" | "cloud", latency: number, sessionId: string, query: string): void;
    /**
     * Set custom pricing
     */
    setPricing(model: string, costPer1k: number): void;
}
/**
 * Example 8: Complete setup example
 *
 * Shows how to set up a fully instrumented system.
 */
export declare function setupMetrics(): Promise<{
    collector: MetricsCollector;
    server: import("./MetricsServer.js").MetricsServer;
    healthMonitor: HealthMonitor;
    systemMonitor: SystemMetricsMonitor;
}>;
//# sourceMappingURL=integration.d.ts.map