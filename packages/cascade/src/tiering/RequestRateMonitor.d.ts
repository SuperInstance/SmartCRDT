/**
 * RequestRateMonitor - Monitor and analyze request rates
 *
 * Tracks request patterns to detect spikes, trends, and calculate
 * requests per minute (RPM) for tier detection.
 *
 * Features:
 * - Sliding window RPM calculation
 * - Spike detection (sudden increases)
 * - Trend analysis (increasing/stable/decreasing)
 * - Statistical metrics (average, std dev, peak)
 *
 * Example:
 * ```ts
 * const monitor = new RequestRateMonitor(60); // 60 second window
 * monitor.recordRequest(Date.now());
 * const metrics = monitor.getMetrics();
 * if (metrics.spikeDetected) {
 *   // Handle traffic spike
 * }
 * ```
 */
import type { RequestRateMetrics } from "./types.js";
/**
 * RequestRateMonitor - Traffic pattern detection
 */
export declare class RequestRateMonitor {
    private requests;
    private windowSeconds;
    private lastSpikeCheck;
    private previousRpm;
    constructor(windowSeconds?: number);
    /**
     * Record a request timestamp
     */
    recordRequest(timestamp?: number): void;
    /**
     * Get current requests per minute
     */
    getCurrentRpm(timestamp?: number): number;
    /**
     * Get average RPM over a period
     */
    getAverageRpm(periodSeconds: number, timestamp?: number): number;
    /**
     * Get comprehensive metrics
     */
    getMetrics(timestamp?: number): RequestRateMetrics;
    /**
     * Detect if there's a traffic spike
     */
    detectSpike(currentRpm: number, timestamp?: number): boolean;
    /**
     * Determine trend direction
     */
    private determineTrend;
    /**
     * Calculate RPM in bins for statistical analysis
     */
    private calculateBinnedRpm;
    /**
     * Remove requests outside the time window
     */
    private cleanupOldRequests;
    /**
     * Get raw request count in window
     */
    getRequestCount(timestamp?: number): number;
    /**
     * Clear all request history
     */
    clear(): void;
    /**
     * Get detailed statistics for debugging
     */
    getDebugStats(timestamp?: number): {
        totalRequests: number;
        windowRequests: number;
        currentRpm: number;
        oldestRequest: number | null;
        newestRequest: number | null;
        windowSize: number;
    };
}
//# sourceMappingURL=RequestRateMonitor.d.ts.map