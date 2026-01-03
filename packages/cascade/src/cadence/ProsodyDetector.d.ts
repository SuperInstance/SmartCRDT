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
 * Temporal features extracted from user interaction
 */
export interface ProsodyFeatures {
    /** Words typed per minute */
    wordsPerMinute: number;
    /** Change in WPM from previous (positive = speeding up) */
    wpmAcceleration: number;
    /** Ratio of capitalized letters (0-1) */
    capitalizationRatio: number;
    /** Punctuation marks per word (0-1) */
    punctuationDensity: number;
    /** Time since last message in milliseconds */
    silenceDurationMs: number;
}
/**
 * Trend analysis over recent history
 */
export interface TrendAnalysis {
    /** Overall WPM trend */
    wpmTrend: "increasing" | "stable" | "decreasing";
    /** Average WPM over recent history */
    avgWpm: number;
    /** Average silence duration over recent history */
    avgSilence: number;
    /** Number of data points analyzed */
    sampleCount: number;
}
/**
 * Configuration for ProsodyDetector
 */
export interface ProsodyConfig {
    /** How many history entries to keep */
    maxHistorySize: number;
    /** How many entries to use for trend analysis */
    trendWindowSize: number;
    /** Minimum words per minute for "fast" threshold */
    fastWpmThreshold: number;
    /** Maximum silence for "continuous" interaction (ms) */
    continuousThresholdMs: number;
}
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
export declare class ProsodyDetector {
    private history;
    private lastTimestamp;
    private config;
    constructor(config?: Partial<ProsodyConfig>);
    /**
     * Detect prosody features from a text message
     * @param text - The user's message
     * @param timestamp - When the message was sent (default: Date.now())
     * @returns ProsodyFeatures for this message
     */
    detect(text: string, timestamp?: number): ProsodyFeatures;
    /**
     * Get trend analysis over recent history
     * @returns TrendAnalysis with patterns detected
     */
    getTrend(): TrendAnalysis;
    /**
     * Check if user is in "urgent" mode
     * @returns true if user is speeding up significantly
     */
    isUrgent(): boolean;
    /**
     * Check if user is in "deep thought" mode
     * @returns true if user has long pauses (thinking deeply)
     */
    isDeepThought(): boolean;
    /**
     * Check if user is in "flow" state
     * @returns true if continuous interaction with consistent pace
     */
    isInFlow(): boolean;
    /**
     * Clear history (e.g., new session)
     */
    clear(): void;
    /**
     * Get current history size
     */
    getHistorySize(): number;
    /**
     * Count words in text (simple tokenizer)
     */
    private countWords;
}
/**
 * Default export
 */
export default ProsodyDetector;
//# sourceMappingURL=ProsodyDetector.d.ts.map