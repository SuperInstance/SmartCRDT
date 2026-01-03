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
/**
 * RequestRateMonitor - Traffic pattern detection
 */
export class RequestRateMonitor {
    requests = [];
    windowSeconds;
    lastSpikeCheck = 0;
    previousRpm = 0;
    constructor(windowSeconds = 60) {
        this.windowSeconds = windowSeconds;
    }
    /**
     * Record a request timestamp
     */
    recordRequest(timestamp = Date.now()) {
        this.requests.push({ timestamp });
        this.cleanupOldRequests(timestamp);
    }
    /**
     * Get current requests per minute
     */
    getCurrentRpm(timestamp = Date.now()) {
        this.cleanupOldRequests(timestamp);
        return (this.requests.length / this.windowSeconds) * 60;
    }
    /**
     * Get average RPM over a period
     */
    getAverageRpm(periodSeconds, timestamp = Date.now()) {
        const cutoff = timestamp - periodSeconds * 1000;
        const recentRequests = this.requests.filter(r => r.timestamp > cutoff);
        return (recentRequests.length / periodSeconds) * 60;
    }
    /**
     * Get comprehensive metrics
     */
    getMetrics(timestamp = Date.now()) {
        this.cleanupOldRequests(timestamp);
        const currentRpm = this.getCurrentRpm(timestamp);
        const windowStart = timestamp - this.windowSeconds * 1000;
        const windowRequests = this.requests.filter(r => r.timestamp > windowStart);
        // Calculate statistics
        const rpms = this.calculateBinnedRpm(windowRequests, this.windowSeconds, timestamp);
        const averageRpm = rpms.reduce((a, b) => a + b, 0) / Math.max(rpms.length, 1);
        const peakRpm = Math.max(...rpms, 0);
        const troughRpm = Math.min(...rpms, Infinity);
        // Calculate standard deviation
        const variance = rpms.reduce((sum, rpm) => sum + Math.pow(rpm - averageRpm, 2), 0) /
            Math.max(rpms.length, 1);
        const stdDev = Math.sqrt(variance);
        // Detect spike (sudden increase >50%)
        const spikeDetected = this.detectSpike(currentRpm, timestamp);
        // Determine trend
        const trend = this.determineTrend(rpms);
        return {
            currentRpm,
            averageRpm,
            peakRpm,
            troughRpm,
            stdDev,
            spikeDetected,
            trend,
        };
    }
    /**
     * Detect if there's a traffic spike
     */
    detectSpike(currentRpm, timestamp = Date.now()) {
        const now = timestamp;
        const spikeWindowMs = 5000; // Check every 5 seconds
        if (now - this.lastSpikeCheck < spikeWindowMs) {
            return false;
        }
        this.lastSpikeCheck = now;
        // Spike = 50% increase over previous RPM
        const spikeThreshold = this.previousRpm * 1.5;
        this.previousRpm = currentRpm;
        return currentRpm > spikeThreshold && currentRpm > 5;
    }
    /**
     * Determine trend direction
     */
    determineTrend(rpms) {
        if (rpms.length < 3) {
            return "stable";
        }
        // Calculate linear regression slope
        const n = rpms.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += rpms[i];
            sumXY += i * rpms[i];
            sumX2 += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const avgRpm = sumY / n;
        // Normalize slope by average
        const normalizedSlope = slope / Math.max(avgRpm, 1);
        if (normalizedSlope > 0.1) {
            return "increasing";
        }
        else if (normalizedSlope < -0.1) {
            return "decreasing";
        }
        return "stable";
    }
    /**
     * Calculate RPM in bins for statistical analysis
     */
    calculateBinnedRpm(requests, windowSeconds, currentTime) {
        const binCount = 12; // 5-second bins in 60-second window
        const binMs = (windowSeconds * 1000) / binCount;
        const bins = new Array(binCount).fill(0);
        for (const req of requests) {
            const age = currentTime - req.timestamp;
            const binIndex = Math.floor(age / binMs);
            if (binIndex >= 0 && binIndex < binCount) {
                bins[binIndex]++;
            }
        }
        // Convert counts to RPM
        return bins.map(count => (count / (binMs / 1000)) * 60);
    }
    /**
     * Remove requests outside the time window
     */
    cleanupOldRequests(timestamp) {
        const cutoff = timestamp - this.windowSeconds * 1000;
        this.requests = this.requests.filter(r => r.timestamp > cutoff);
    }
    /**
     * Get raw request count in window
     */
    getRequestCount(timestamp = Date.now()) {
        this.cleanupOldRequests(timestamp);
        return this.requests.length;
    }
    /**
     * Clear all request history
     */
    clear() {
        this.requests = [];
        this.previousRpm = 0;
        this.lastSpikeCheck = 0;
    }
    /**
     * Get detailed statistics for debugging
     */
    getDebugStats(timestamp = Date.now()) {
        this.cleanupOldRequests(timestamp);
        const oldestRequest = this.requests.length > 0 ? this.requests[0].timestamp : null;
        const newestRequest = this.requests.length > 0
            ? this.requests[this.requests.length - 1].timestamp
            : null;
        return {
            totalRequests: this.requests.length,
            windowRequests: this.requests.length,
            currentRpm: this.getCurrentRpm(timestamp),
            oldestRequest,
            newestRequest,
            windowSize: this.windowSeconds,
        };
    }
}
//# sourceMappingURL=RequestRateMonitor.js.map