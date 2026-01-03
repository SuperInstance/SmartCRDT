/**
 * @lsi/cascade - Export Utilities for ORPO Training Data
 *
 * Provides utilities for exporting shadow logs to ORPO training format.
 */
import { ShadowLogger } from "./ShadowLogger.js";
import { PrivacyFilter } from "./PrivacyFilter.js";
import { PreferencePairGenerator, PreferencePair, ScoringConfig } from "./PreferencePairGenerator.js";
import { createShadowLogger } from "./ShadowLogger.js";
import { DataSensitivity, PIIType } from "./PrivacyFilter.js";
/**
 * Export options for ORPO training data
 */
export interface ExportOptions {
    /** Minimum quality threshold for both chosen and rejected */
    minQuality?: number;
    /** Minimum score difference between chosen and rejected */
    minScoreDifference?: number;
    /** Balance pairs by backend (local/cloud) */
    balanceByBackend?: boolean;
    /** Include metadata in export (for debugging) */
    includeMetadata?: boolean;
    /** Maximum number of pairs to export */
    maxPairs?: number;
}
/**
 * Export result with statistics
 */
export interface ExportResult {
    /** Number of pairs exported */
    pairCount: number;
    /** Output file path */
    outputPath: string;
    /** Statistics about exported pairs */
    stats: {
        total: number;
        avgChosenQuality: number;
        avgRejectedQuality: number;
        avgScoreDifference: number;
        backendDistribution: {
            local: number;
            cloud: number;
        };
    };
}
/**
 * Export shadow logs to ORPO training format
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @param options - Export options
 * @returns Export result with statistics
 */
export { ShadowLogger, PrivacyFilter, createShadowLogger, DataSensitivity, PIIType, PreferencePairGenerator, PreferencePair, ScoringConfig };
export declare function exportORPOTrainingData(shadowLogger: ShadowLogger, outputPath: string, options?: ExportOptions): Promise<ExportResult>;
/**
 * Export shadow logs to JSON format (full data)
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @returns Number of entries exported
 */
export declare function exportShadowLogs(shadowLogger: ShadowLogger, outputPath: string): Promise<number>;
/**
 * Export preference pairs with custom scoring config
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputPath - Output file path
 * @param scoringConfig - Custom scoring configuration
 * @param options - Export options
 * @returns Export result with statistics
 */
export declare function exportWithCustomScoring(shadowLogger: ShadowLogger, outputPath: string, scoringConfig: Partial<ScoringConfig>, options?: ExportOptions): Promise<ExportResult>;
/**
 * Export preference pairs to multiple formats
 *
 * @param shadowLogger - Shadow logger instance
 * @param outputBasePath - Base output path (without extension)
 * @param options - Export options
 * @returns Array of export results
 */
export declare function exportMultipleFormats(shadowLogger: ShadowLogger, outputBasePath: string, options?: ExportOptions): Promise<ExportResult[]>;
//# sourceMappingURL=export.d.ts.map