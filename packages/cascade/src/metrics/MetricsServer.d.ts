/**
 * MetricsServer - HTTP and WebSocket server for metrics
 *
 * Provides:
 * - REST API for metrics queries
 * - WebSocket for real-time streaming
 * - Web dashboard hosting
 * - Prometheus export endpoint
 *
 * Example:
 * ```ts
 * const server = new MetricsServer(collector, { port: 3000 });
 * await server.start();
 * // Access dashboard at http://localhost:3000/metrics
 * ```
 */
import type { MetricsCollector } from "./MetricsCollector.js";
import type { MetricsConfig } from "./types.js";
/**
 * MetricsServer - HTTP/WebSocket server
 */
export declare class MetricsServer {
    private collector;
    private config;
    private server;
    private wsClients;
    private broadcastInterval;
    constructor(collector: MetricsCollector, config?: Partial<MetricsConfig>);
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
    /**
     * Handle HTTP request
     */
    private handleRequest;
    /**
     * Serve dashboard HTML
     */
    private serveDashboard;
    /**
     * Serve all metrics
     */
    private serveMetrics;
    /**
     * Serve request metrics
     */
    private serveRequestMetrics;
    /**
     * Serve latency metrics
     */
    private serveLatencyMetrics;
    /**
     * Serve cache metrics
     */
    private serveCacheMetrics;
    /**
     * Serve cost metrics
     */
    private serveCostMetrics;
    /**
     * Serve health metrics
     */
    private serveHealthMetrics;
    /**
     * Serve request logs
     */
    private serveLogs;
    /**
     * Serve error logs
     */
    private serveErrors;
    /**
     * Serve custom query
     */
    private serveQuery;
    /**
     * Serve Prometheus export
     */
    private servePrometheus;
    /**
     * Serve data export
     */
    private serveExport;
    /**
     * Handle WebSocket upgrade
     */
    private handleWebSocketUpgrade;
    /**
     * Broadcast metrics to all WebSocket clients
     */
    private broadcastMetrics;
    /**
     * Send message to a WebSocket client
     */
    private sendToClient;
    /**
     * Create WebSocket frame (simplified)
     */
    private createWebSocketFrame;
    /**
     * Generate WebSocket accept key
     */
    private generateWebSocketAccept;
    /**
     * Convert JSON to CSV
     */
    private jsonToCsv;
    /**
     * Get dashboard HTML
     */
    private getDashboardHTML;
}
//# sourceMappingURL=MetricsServer.d.ts.map