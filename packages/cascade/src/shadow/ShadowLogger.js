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
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { DataSensitivity, PrivacyFilter, } from "./PrivacyFilter.js";
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    enableLogging: true,
    storagePath: "./shadow-logs",
    maxEntries: 10000,
    persistToDisk: false,
    privacyFilter: {
        enablePIIDetection: true,
        enableSemanticAnalysis: true,
        redactionToken: "[REDACTED]",
    },
};
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
export class ShadowLogger {
    privacyFilter;
    logs = [];
    config;
    stats = {
        totalEntries: 0,
        bufferSize: 0,
        privacyCounts: {
            [DataSensitivity.SOVEREIGN]: 0,
            [DataSensitivity.SENSITIVE]: 0,
            [DataSensitivity.PUBLIC]: 0,
        },
        sovereignRejected: 0,
        sensitiveRedacted: 0,
        publicLogged: 0,
    };
    storagePath;
    persistenceEnabled;
    autoPersistInterval;
    persistCount = 0;
    constructor(config = {}) {
        // Merge with defaults
        this.config = {
            enableLogging: config.enableLogging ?? DEFAULT_CONFIG.enableLogging,
            storagePath: config.storagePath ?? DEFAULT_CONFIG.storagePath,
            maxEntries: config.maxEntries ?? DEFAULT_CONFIG.maxEntries,
            persistToDisk: config.persistToDisk ?? DEFAULT_CONFIG.persistToDisk,
            privacyFilter: {
                ...DEFAULT_CONFIG.privacyFilter,
                ...config.privacyFilter,
            },
        };
        this.privacyFilter = new PrivacyFilter(this.config.privacyFilter);
        // Initialize persistence settings
        this.storagePath = this.config.storagePath;
        this.persistenceEnabled = this.config.persistToDisk;
        this.autoPersistInterval = 100; // Persist every 100 logs
        // Initialize storage directory if persistence is enabled
        if (this.persistenceEnabled) {
            this.initializeStorage().catch(err => {
                console.error("[ShadowLogger] Failed to initialize storage:", err);
            });
        }
    }
    /**
     * Initialize storage directory
     */
    async initializeStorage() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
        }
        catch (err) {
            console.error("[ShadowLogger] Failed to create storage directory:", err);
        }
    }
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
    async log(query, response, model, backend = "local", metadata) {
        // Check if logging is enabled
        if (!this.config.enableLogging) {
            return;
        }
        // Apply privacy filter
        const filterResult = await this.privacyFilter.filter(query, response);
        // Update stats
        this.stats.privacyCounts[filterResult.sensitivity]++;
        // SOVEREIGN data: Never log
        if (filterResult.sensitivity === DataSensitivity.SOVEREIGN) {
            this.stats.sovereignRejected++;
            return;
        }
        // SENSITIVE: Use redacted version
        // PUBLIC: Use original
        const loggedQuery = filterResult.redactedQuery ?? query;
        const loggedResponse = filterResult.redactedResponse ?? response;
        const piiRedacted = filterResult.sensitivity === DataSensitivity.SENSITIVE;
        if (piiRedacted) {
            this.stats.sensitiveRedacted++;
        }
        else {
            this.stats.publicLogged++;
        }
        // Create log entry
        const entry = {
            id: this.generateId(),
            query: loggedQuery,
            response: loggedResponse,
            model,
            timestamp: Date.now(),
            sensitivity: filterResult.sensitivity,
            piiRedacted,
            backend,
            metadata,
        };
        // Add to logs
        this.logs.push(entry);
        this.stats.totalEntries++;
        this.stats.bufferSize = this.logs.length;
        this.persistCount++;
        // Enforce max size (remove oldest)
        if (this.logs.length > this.config.maxEntries) {
            this.logs.shift();
            this.stats.bufferSize = this.logs.length;
        }
        // Auto-persist if enabled and interval reached
        if (this.persistenceEnabled) {
            this.autoPersist().catch(err => {
                console.error("[ShadowLogger] Auto-persist failed:", err);
            });
        }
    }
    /**
     * Get all log entries
     *
     * @returns Copy of log entries array
     */
    getLogs() {
        return [...this.logs];
    }
    /**
     * Get logs by backend (local/cloud)
     *
     * @param backend - Backend filter
     * @returns Filtered log entries
     */
    getLogsByBackend(backend) {
        return this.logs.filter(entry => entry.backend === backend);
    }
    /**
     * Get logs by model
     *
     * @param model - Model name filter
     * @returns Filtered log entries
     */
    getLogsByModel(model) {
        return this.logs.filter(entry => entry.model === model);
    }
    /**
     * Get logs by sensitivity level
     *
     * @param sensitivity - Sensitivity level filter
     * @returns Filtered log entries
     */
    getLogsBySensitivity(sensitivity) {
        return this.logs.filter(entry => entry.sensitivity === sensitivity);
    }
    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        this.stats.bufferSize = 0;
        this.stats.totalEntries = 0;
        this.stats.privacyCounts = {
            [DataSensitivity.SOVEREIGN]: 0,
            [DataSensitivity.SENSITIVE]: 0,
            [DataSensitivity.PUBLIC]: 0,
        };
        this.stats.sovereignRejected = 0;
        this.stats.sensitiveRedacted = 0;
        this.stats.publicLogged = 0;
    }
    /**
     * Export logs for ORPO training
     *
     * Returns entries that can be used for preference pair generation.
     * Filters out SOVEREIGN data (never logged anyway).
     *
     * @returns Log entries suitable for training
     */
    exportForTraining() {
        return this.logs.filter(entry => entry.sensitivity !== DataSensitivity.SOVEREIGN);
    }
    /**
     * Get statistics
     *
     * @returns Copy of statistics object
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Update configuration
     *
     * @param config - Partial configuration update
     */
    updateConfig(config) {
        if (config.enableLogging !== undefined) {
            this.config.enableLogging = config.enableLogging;
        }
        if (config.storagePath !== undefined) {
            this.config.storagePath = config.storagePath;
        }
        if (config.maxEntries !== undefined) {
            this.config.maxEntries = config.maxEntries;
            // Trim logs if needed
            while (this.logs.length > this.config.maxEntries) {
                this.logs.shift();
            }
        }
        if (config.persistToDisk !== undefined) {
            this.config.persistToDisk = config.persistToDisk;
        }
        if (config.privacyFilter !== undefined) {
            this.config.privacyFilter = {
                ...this.config.privacyFilter,
                ...config.privacyFilter,
            };
            this.privacyFilter.updateConfig(config.privacyFilter);
        }
    }
    /**
     * Get current configuration
     *
     * @returns Copy of configuration
     */
    getConfig() {
        return {
            enableLogging: this.config.enableLogging,
            storagePath: this.config.storagePath,
            maxEntries: this.config.maxEntries,
            persistToDisk: this.config.persistToDisk,
            privacyFilter: this.privacyFilter.getConfig(),
        };
    }
    /**
     * Generate unique entry ID
     *
     * @returns Unique ID string
     */
    generateId() {
        return `shadow_${Date.now()}_${randomBytes(8).toString("hex")}`;
    }
    /**
     * Get log count by sensitivity
     *
     * @returns Object with counts per sensitivity level
     */
    getSensitivityBreakdown() {
        const breakdown = {
            [DataSensitivity.SOVEREIGN]: 0,
            [DataSensitivity.SENSITIVE]: 0,
            [DataSensitivity.PUBLIC]: 0,
        };
        for (const entry of this.logs) {
            breakdown[entry.sensitivity]++;
        }
        return breakdown;
    }
    /**
     * Check if logging is enabled
     *
     * @returns True if logging is enabled
     */
    isEnabled() {
        return this.config.enableLogging;
    }
    /**
     * Enable or disable logging
     *
     * @param enabled - Whether to enable logging
     */
    setEnabled(enabled) {
        this.config.enableLogging = enabled;
    }
    /**
     * Get approximate memory usage
     *
     * @returns Approximate size in bytes
     */
    getMemoryUsage() {
        // Rough estimate: each character is 2 bytes (UTF-16)
        let size = 0;
        for (const entry of this.logs) {
            size += entry.query.length * 2;
            size += entry.response.length * 2;
            size += 100; // Metadata overhead
        }
        return size;
    }
    /**
     * Auto-persist logs to disk every N entries
     *
     * @private
     */
    async autoPersist() {
        if (this.persistCount >= this.autoPersistInterval) {
            await this.persistToDisk();
            this.persistCount = 0;
        }
    }
    /**
     * Persist logs to disk (JSONL format)
     *
     * Creates a daily log file with timestamp in filename.
     * Each log entry is a JSON object on its own line.
     *
     * @returns Promise that resolves when persistence is complete
     */
    async persistToDisk() {
        if (!this.persistenceEnabled) {
            return;
        }
        if (this.logs.length === 0) {
            return; // Nothing to persist
        }
        try {
            const timestamp = new Date().toISOString().split("T")[0];
            const filename = join(this.storagePath, `shadow-${timestamp}.jsonl`);
            const lines = this.logs.map(entry => JSON.stringify(entry));
            await fs.writeFile(filename, lines.join("\n"), "utf8");
            console.debug(`[ShadowLogger] Persisted ${this.logs.length} entries to ${filename}`);
        }
        catch (err) {
            console.error("[ShadowLogger] Failed to persist logs to disk:", err);
            throw err;
        }
    }
    /**
     * Load logs from disk
     *
     * Loads logs from a specific file. If no filename is provided,
     * loads from the latest available log file.
     *
     * @param filename - Optional specific filename to load from
     * @returns Array of loaded log entries
     */
    async loadFromDisk(filename) {
        if (!this.persistenceEnabled) {
            return [];
        }
        const targetFile = filename ?? join(this.storagePath, "shadow-latest.jsonl");
        try {
            const content = await fs.readFile(targetFile, "utf8");
            const lines = content.split("\n").filter(Boolean);
            const entries = [];
            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line));
                }
                catch (parseErr) {
                    console.error("[ShadowLogger] Failed to parse log entry:", parseErr);
                }
            }
            console.debug(`[ShadowLogger] Loaded ${entries.length} entries from ${targetFile}`);
            return entries;
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                console.error("[ShadowLogger] Failed to load logs from disk:", err);
            }
            return [];
        }
    }
    /**
     * Get all available log files in the storage directory
     *
     * @returns Array of filenames
     */
    async getAvailableLogFiles() {
        if (!this.persistenceEnabled) {
            return [];
        }
        try {
            const files = await fs.readdir(this.storagePath);
            return files.filter(file => file.startsWith("shadow-") && file.endsWith(".jsonl"));
        }
        catch (err) {
            console.error("[ShadowLogger] Failed to list log files:", err);
            return [];
        }
    }
    /**
     * Shutdown logger (cleanup)
     *
     * Flushes logs to disk if persistence is enabled.
     */
    async shutdown() {
        if (this.config.persistToDisk) {
            // Flush remaining logs to disk before shutdown
            await this.persistToDisk();
        }
        this.clear();
    }
}
/**
 * Convenience function to create a shadow logger with default config
 *
 * @param config - Optional configuration overrides
 * @returns Configured ShadowLogger instance
 */
export function createShadowLogger(config) {
    return new ShadowLogger(config);
}
//# sourceMappingURL=ShadowLogger.js.map