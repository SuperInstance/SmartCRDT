/**
 * ProsodyDetector - Temporal awareness for empathetic AI routing
 *
 * Detects patterns in user interaction timing and typing behavior:
 * - Words per minute (velocity of thought)
 * - WPM acceleration (change in velocity = urgency)
 * - Capitalization ratio (articulation precision)
 * - Punctuation density (emphasis/loudness)
 * - Silence duration (temporal gaps as signal)
 *
 * This enables the router to adapt to the user's cognitive state:
 * - Increasing WPM + acceleration → User is speeding up (urgent)
 * - Long pauses → Deep thinking (prefer quality)
 * - High punctuation → Emphasizing important points
 */
/**
 * ProsodyDetector - Tracks temporal patterns in user interaction
 *
 * Example usage:
 * ```ts
 * const detector = new ProsodyDetector();
 * const features = detector.detect("Hello world", Date.now());
 * const trend = detector.getTrend();
 * if (trend.wpmTrend === 'increasing' && features.wpmAcceleration > 20) {
 *   // User is speeding up - likely urgent
 * }
 * ```
 */
export class ProsodyDetector {
    history = [];
    lastTimestamp = 0;
    config;
    constructor(config) {
        this.config = {
            maxHistorySize: 100,
            trendWindowSize: 10,
            fastWpmThreshold: 100,
            continuousThresholdMs: 5000,
            ...config,
        };
    }
    /**
     * Detect prosody features from a text message
     * @param text - The user's message
     * @param timestamp - When the message was sent (default: Date.now())
     * @returns ProsodyFeatures for this message
     */
    detect(text, timestamp = Date.now()) {
        const now = timestamp;
        const timeSinceLast = this.lastTimestamp ? now - this.lastTimestamp : 0;
        // Calculate words per minute
        const wordCount = this.countWords(text);
        const wpm = timeSinceLast > 0 ? (wordCount / timeSinceLast) * 60000 : 0;
        // Calculate acceleration (change from previous)
        const prevWpm = this.history.length > 0
            ? this.history[this.history.length - 1].features.wordsPerMinute
            : wpm;
        const acceleration = wpm - prevWpm;
        // Calculate capitalization ratio
        const caps = (text.match(/[A-Z]/g) || []).length;
        const total = text.length;
        const capRatio = total > 0 ? caps / total : 0;
        // Calculate punctuation density
        const punct = (text.match(/[.!?]/g) || []).length;
        const punctDensity = wordCount > 0 ? punct / wordCount : 0;
        const features = {
            wordsPerMinute: wpm,
            wpmAcceleration: acceleration,
            capitalizationRatio: capRatio,
            punctuationDensity: punctDensity,
            silenceDurationMs: timeSinceLast,
        };
        // Store in history
        this.history.push({ features, timestamp: now });
        this.lastTimestamp = now;
        // Trim history to max size
        if (this.history.length > this.config.maxHistorySize) {
            this.history.shift();
        }
        return features;
    }
    /**
     * Get trend analysis over recent history
     * @returns TrendAnalysis with patterns detected
     */
    getTrend() {
        const windowSize = Math.min(this.config.trendWindowSize, this.history.length);
        if (windowSize < 2) {
            return {
                wpmTrend: "stable",
                avgWpm: 0,
                avgSilence: 0,
                sampleCount: this.history.length,
            };
        }
        const recent = this.history.slice(-windowSize);
        // Calculate averages
        const avgWpm = recent.reduce((sum, entry) => sum + entry.features.wordsPerMinute, 0) /
            recent.length;
        const silences = [];
        for (let i = 1; i < recent.length; i++) {
            silences.push(recent[i].features.silenceDurationMs);
        }
        const avgSilence = silences.length > 0
            ? silences.reduce((sum, val) => sum + val, 0) / silences.length
            : 0;
        // Determine trend by comparing first half to second half
        const midPoint = Math.floor(recent.length / 2);
        const firstHalf = recent.slice(0, midPoint);
        const secondHalf = recent.slice(midPoint);
        const firstWpm = firstHalf.length > 0
            ? firstHalf.reduce((sum, e) => sum + e.features.wordsPerMinute, 0) /
                firstHalf.length
            : avgWpm;
        const secondWpm = secondHalf.length > 0
            ? secondHalf.reduce((sum, e) => sum + e.features.wordsPerMinute, 0) /
                secondHalf.length
            : avgWpm;
        // Determine trend (20% threshold for significance)
        let wpmTrend;
        if (secondWpm > firstWpm * 1.2) {
            wpmTrend = "increasing";
        }
        else if (secondWpm < firstWpm * 0.8) {
            wpmTrend = "decreasing";
        }
        else {
            wpmTrend = "stable";
        }
        return {
            wpmTrend,
            avgWpm,
            avgSilence,
            sampleCount: recent.length,
        };
    }
    /**
     * Check if user is in "urgent" mode
     * @returns true if user is speeding up significantly
     */
    isUrgent() {
        const trend = this.getTrend();
        const latest = this.history[this.history.length - 1];
        if (!latest)
            return false;
        return (trend.wpmTrend === "increasing" && latest.features.wpmAcceleration > 20);
    }
    /**
     * Check if user is in "deep thought" mode
     * @returns true if user has long pauses (thinking deeply)
     */
    isDeepThought() {
        const trend = this.getTrend();
        return trend.avgSilence > 30000; // 30 seconds of thinking
    }
    /**
     * Check if user is in "flow" state
     * @returns true if continuous interaction with consistent pace
     */
    isInFlow() {
        const trend = this.getTrend();
        return (trend.avgSilence < this.config.continuousThresholdMs &&
            trend.wpmTrend === "stable" &&
            trend.sampleCount >= 5);
    }
    /**
     * Clear history (e.g., new session)
     */
    clear() {
        this.history = [];
        this.lastTimestamp = 0;
    }
    /**
     * Get current history size
     */
    getHistorySize() {
        return this.history.length;
    }
    /**
     * Count words in text (simple tokenizer)
     */
    countWords(text) {
        // Split by whitespace and filter empty strings
        const words = text
            .trim()
            .split(/\s+/)
            .filter(w => w.length > 0);
        return words.length;
    }
}
/**
 * Default export
 */
export default ProsodyDetector;
//# sourceMappingURL=ProsodyDetector.js.map