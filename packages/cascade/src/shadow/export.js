/**
 * @lsi/cascade - Export Utilities for ORPO Training Data
 *
 * Provides utilities for exporting shadow logs to ORPO training format.
 */
import { ShadowLogger } from "./ShadowLogger.js";
import { PrivacyFilter } from "./PrivacyFilter.js";
import { PreferencePairGenerator, } from "./PreferencePairGenerator.js";
import { createShadowLogger } from "./ShadowLogger.js";
import { DataSensitivity, PIIType } from "./PrivacyFilter.js";
import { promises as fs } from "fs";
/**
 * Export shadow logs to ORPO training format
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @param options - Export options
 * @returns Export result with statistics
 */
export { ShadowLogger, PrivacyFilter, createShadowLogger, DataSensitivity, PIIType, PreferencePairGenerator };
export async function exportORPOTrainingData(shadowLogger, outputPath, options = {}) {
    const generator = new PreferencePairGenerator();
    // Get logs
    const logs = shadowLogger.exportForTraining();
    if (logs.length === 0) {
        throw new Error("No logs available for export. Ensure shadow logging is enabled and has collected data.");
    }
    // Generate pairs
    let pairs = generator.generateFromLogs(logs);
    // Apply filters
    if (options.minQuality !== undefined) {
        pairs = generator.filterByQuality(pairs, options.minQuality);
    }
    if (options.minScoreDifference !== undefined) {
        pairs = generator.filterByCostDifference(pairs, options.minScoreDifference);
    }
    if (options.balanceByBackend) {
        pairs = generator.balanceByBackend(pairs);
    }
    // Limit pairs if maxPairs specified
    if (options.maxPairs !== undefined && pairs.length > options.maxPairs) {
        pairs = pairs.slice(0, options.maxPairs);
    }
    // Calculate stats
    const stats = generator.calculateStats(pairs);
    // Export
    const orpoData = options.includeMetadata
        ? generator.exportWithMetadata(pairs)
        : generator.exportForORPO(pairs);
    // Ensure directory exists
    const dir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    if (dir) {
        await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(outputPath, orpoData, "utf8");
    return {
        pairCount: pairs.length,
        outputPath,
        stats,
    };
}
/**
 * Export shadow logs to JSON format (full data)
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @returns Number of entries exported
 */
export async function exportShadowLogs(shadowLogger, outputPath) {
    const logs = shadowLogger.exportForTraining();
    if (logs.length === 0) {
        throw new Error("No logs available for export. Ensure shadow logging is enabled and has collected data.");
    }
    // Ensure directory exists
    const dir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    if (dir) {
        await fs.mkdir(dir, { recursive: true });
    }
    const data = JSON.stringify(logs, null, 2);
    await fs.writeFile(outputPath, data, "utf8");
    return logs.length;
}
/**
 * Export preference pairs with custom scoring config
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @param scoringConfig - Custom scoring configuration
 * @param options - Export options
 * @returns Export result with statistics
 */
export async function exportWithCustomScoring(shadowLogger, outputPath, scoringConfig, options = {}) {
    const generator = new PreferencePairGenerator(scoringConfig);
    // Get logs
    const logs = shadowLogger.exportForTraining();
    if (logs.length === 0) {
        throw new Error("No logs available for export. Ensure shadow logging is enabled and has collected data.");
    }
    // Generate pairs
    let pairs = generator.generateFromLogs(logs);
    // Apply filters
    if (options.minQuality !== undefined) {
        pairs = generator.filterByQuality(pairs, options.minQuality);
    }
    if (options.minScoreDifference !== undefined) {
        pairs = generator.filterByCostDifference(pairs, options.minScoreDifference);
    }
    if (options.balanceByBackend) {
        pairs = generator.balanceByBackend(pairs);
    }
    // Limit pairs if maxPairs specified
    if (options.maxPairs !== undefined && pairs.length > options.maxPairs) {
        pairs = pairs.slice(0, options.maxPairs);
    }
    // Calculate stats
    const stats = generator.calculateStats(pairs);
    // Export
    const orpoData = options.includeMetadata
        ? generator.exportWithMetadata(pairs)
        : generator.exportForORPO(pairs);
    // Ensure directory exists
    const dir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    if (dir) {
        await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(outputPath, orpoData, "utf8");
    return {
        pairCount: pairs.length,
        outputPath,
        stats,
    };
}
/**
 * Export preference pairs to multiple formats
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputBasePath - Base output path (without extension)
 * @param options - Export options
 * @returns Array of export results
 */
export async function exportMultipleFormats(shadowLogger, outputBasePath, options = {}) {
    const results = [];
    // Export to ORPO format (JSONL)
    const orpoResult = await exportORPOTrainingData(shadowLogger, `${outputBasePath}.jsonl`, {
        ...options,
        includeMetadata: false,
    });
    results.push(orpoResult);
    // Export with metadata (for debugging)
    const metaResult = await exportORPOTrainingData(shadowLogger, `${outputBasePath}-with-metadata.jsonl`, {
        ...options,
        includeMetadata: true,
    });
    results.push(metaResult);
    return results;
}
//# sourceMappingURL=export.js.map