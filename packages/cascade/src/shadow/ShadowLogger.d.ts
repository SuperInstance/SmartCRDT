/**
 * @lsi/cascade - Shadow Logger for Privacy-Preserving Query/Response Logging
 *
 * Collects training data for ORPO (Odds Ratio Preference Optimization) training
 * while respecting user privacy through three-tier classification:
 * - SOVEREIGN data: Never logged
 * - SENSITIVE data: Redacted before logging
 * - PUBLIC data: Logged as-is
 *
 * Shadow logging runs alongside production - it logs queries and responses
 * but doesn't affect the output. The logged data is used to train preference pairs.
 */
import { DataSensitivity, PrivacyFilterConfig } from "./PrivacyFilter.js";
/**
 * Shadow log entry containing query, response, and metadata
 */
export interface ShadowLogEntry {
    /** Unique entry ID */
    id: string;
    /** Query text (may be redacted) */
    query: string;
    /** Response content (may be redacted) */
    response: string;
    /** Model used for generation */
    model: string;
    /** Timestamp (milliseconds since epoch) */
    timestamp: number;
    /** Privacy sensitivity level */
    sensitivity: DataSensitivity;
    /** Whether PII was redacted */
    piiRedacted: boolean;
    /** Backend used (local/cloud) */
    backend: "local" | "cloud";
    /** Optional metadata */
    metadata?: {
        /** Tokens used */
        tokensUsed?: number;
        /** Latency in milliseconds */
        latency?: number;
        /** Cost in USD */
        cost?: number;
        /** From cache */
        fromCache?: boolean;
        /** Session ID */
        sessionId?: string;
    };
}
/**
 * Shadow logger statistics
 */
export interface ShadowLoggerStats {
    /** Total entries logged (excluding SOVEREIGN) */
    totalEntries: number;
    /** Current buffer size */
    bufferSize: number;
    /** Privacy classification counts */
    privacyCounts: Record<DataSensitivity, number>;
    /** SOVEREIGN entries rejected (not logged) */
    sovereignRejected: number;
    /** SENSITIVE entries redacted */
    sensitiveRedacted: number;
    /** PUBLIC entries logged as-is */
    publicLogged: number;
}
/**
 * Shadow logger configuration
 */
export interface ShadowLoggerConfig {
    /** Enable shadow logging */
    enableLogging: boolean;
    /** Storage path for logs (future use) */
    storagePath: string;
    /** Privacy filter configuration */
    privacyFilter: PrivacyFilterConfig;
    /** Maximum entries to keep in memory */
    maxEntries: number;
    /** Whether to persist logs to disk */
    persistToDisk: boolean;
}
/**
 * ShadowLogger - Privacy-preserving query/response logging
 *
 * Collects training data for ORPO without compromising user privacy.
 *
 * Privacy Protection:
 * - SOVEREIGN data: NEVER logged (user's personal data)
 * - SENSITIVE data: Redacted before logging (PII masked)
 * - PUBLIC data: Logged as-is (general knowledge)
 *
 * Usage:
 * ```typescript
 * const logger = new ShadowLogger({
 *   enableLogging: true,
 *   maxEntries: 10000,
 * });
 *
 * await logger.log(
 *   'What is my email?',
 *   'Your email is user@example.com',
 *   'llama-3.2'
 * );
 * ```
 */
export declare class ShadowLogger {
    private privacyFilter;
    private logs;
    private config;
    private stats;
    private storagePath;
    private persistenceEnabled;
    private autoPersistInterval;
    private persistCount;
    constructor(config?: Partial<ShadowLoggerConfig>);
    /**
     * Initialize storage directory
     */
    private initializeStorage;
    /**
     * Log a query/response pair with privacy filtering
     *
     * Privacy handling:
     * - SOVEREIGN: Silently rejected (not logged)
     * - SENSITIVE: Redacted before logging
     * - PUBLIC: Logged as-is
     *
     * @param query - Query text
     * @param response - Response content
     * @param model - Model used
     * @param backend - Backend used (local/cloud)
     * @param metadata - Optional metadata
     * @returns Promise that resolves when logging is complete
     */
    log(query: string, response: string, model: string, backend?: "local" | "cloud", metadata?: ShadowLogEntry["metadata"]): Promise<void>;
    /**
     * Get all log entries
     *
     * @returns Copy of log entries array
     */
    getLogs(): ShadowLogEntry[];
    /**
     * Get logs by backend (local/cloud)
     *
     * @param backend - Backend filter
     * @returns Filtered log entries
     */
    getLogsByBackend(backend: "local" | "cloud"): ShadowLogEntry[];
    /**
     * Get logs by model
     *
     * @param model - Model name filter
     * @returns Filtered log entries
     */
    getLogsByModel(model: string): ShadowLogEntry[];
    /**
     * Get logs by sensitivity level
     *
     * @param sensitivity - Sensitivity level filter
     * @returns Filtered log entries
     */
    getLogsBySensitivity(sensitivity: DataSensitivity): ShadowLogEntry[];
    /**
     * Clear all logs
     */
    clear(): void;
    /**
     * Export logs for ORPO training
     *
     * Returns entries that can be used for preference pair generation.
     * Filters out SOVEREIGN data (never logged anyway).
     *
     * @returns Log entries suitable for training
     */
    exportForTraining(): ShadowLogEntry[];
    /**
     * Get statistics
     *
     * @returns Copy of statistics object
     */
    getStats(): ShadowLoggerStats;
    /**
     * Update configuration
     *
     * @param config - Partial configuration update
     */
    updateConfig(config: Partial<ShadowLoggerConfig>): void;
    /**
     * Get current configuration
     *
     * @returns Copy of configuration
     */
    getConfig(): Required<Omit<ShadowLoggerConfig, "privacyFilter">> & {
        privacyFilter: PrivacyFilterConfig;
    };
    /**
     * Generate unique entry ID
     *
     * @returns Unique ID string
     */
    private generateId;
    /**
     * Get log count by sensitivity
     *
     * @returns Object with counts per sensitivity level
     */
    getSensitivityBreakdown(): Record<DataSensitivity, number>;
    /**
     * Check if logging is enabled
     *
     * @returns True if logging is enabled
     */
    isEnabled(): boolean;
    /**
     * Enable or disable logging
     *
     * @param enabled - Whether to enable logging
     */
    setEnabled(enabled: boolean): void;
    /**
     * Get approximate memory usage
     *
     * @returns Approximate size in bytes
     */
    getMemoryUsage(): number;
    /**
     * Auto-persist logs to disk every N entries
     *
     * @private
     */
    private autoPersist;
    /**
     * Persist logs to disk (JSONL format)
     *
     * Creates a daily log file with timestamp in filename.
     * Each log entry is a JSON object on its own line.
     *
     * @returns Promise that resolves when persistence is complete
     */
    persistToDisk(): Promise<void>;
    /**
     * Load logs from disk
     *
     * Loads logs from a specific file. If no filename is provided,
     * loads from the latest available log file.
     *
     * @param filename - Optional specific filename to load from
     * @returns Array of loaded log entries
     */
    loadFromDisk(filename?: string): Promise<ShadowLogEntry[]>;
    /**
     * Get all available log files in the storage directory
     *
     * @returns Array of filenames
     */
    getAvailableLogFiles(): Promise<string[]>;
    /**
     * Shutdown logger (cleanup)
     *
     * Flushes logs to disk if persistence is enabled.
     */
    shutdown(): Promise<void>;
}
/**
 * Convenience function to create a shadow logger with default config
 *
 * @param config - Optional configuration overrides
 * @returns Configured ShadowLogger instance
 */
export declare function createShadowLogger(config?: Partial<ShadowLoggerConfig>): ShadowLogger;
//# sourceMappingURL=ShadowLogger.d.ts.map