/**
 * @lsi/cascade - Export Utilities for ORPO Training Data
 *
 * Provides utilities for exporting shadow logs to ORPO training format.
 */

import { ShadowLogger } from "./ShadowLogger.js";
import { PrivacyFilter } from "./PrivacyFilter.js";
import {
  PreferencePairGenerator,
  PreferencePair,
  ScoringConfig,
} from "./PreferencePairGenerator.js";
import { createShadowLogger } from "./ShadowLogger.js";
import { DataSensitivity, PIIType } from "./PrivacyFilter.js";
import { promises as fs } from "fs";

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
    backendDistribution: { local: number; cloud: number };
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

export async function exportORPOTrainingData(
  shadowLogger: ShadowLogger,
  outputPath: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const generator = new PreferencePairGenerator();

  // Get logs
  const logs = shadowLogger.exportForTraining();

  if (logs.length === 0) {
    throw new Error(
      "No logs available for export. Ensure shadow logging is enabled and has collected data."
    );
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
export async function exportShadowLogs(
  shadowLogger: ShadowLogger,
  outputPath: string
): Promise<number> {
  const logs = shadowLogger.exportForTraining();

  if (logs.length === 0) {
    throw new Error(
      "No logs available for export. Ensure shadow logging is enabled and has collected data."
    );
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
export async function exportWithCustomScoring(
  shadowLogger: ShadowLogger,
  outputPath: string,
  scoringConfig: Partial<ScoringConfig>,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const generator = new PreferencePairGenerator(scoringConfig);

  // Get logs
  const logs = shadowLogger.exportForTraining();

  if (logs.length === 0) {
    throw new Error(
      "No logs available for export. Ensure shadow logging is enabled and has collected data."
    );
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
export async function exportMultipleFormats(
  shadowLogger: ShadowLogger,
  outputBasePath: string,
  options: ExportOptions = {}
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  // Export to ORPO format (JSONL)
  const orpoResult = await exportORPOTrainingData(
    shadowLogger,
    `${outputBasePath}.jsonl`,
    {
      ...options,
      includeMetadata: false,
    }
  );
  results.push(orpoResult);

  // Export with metadata (for debugging)
  const metaResult = await exportORPOTrainingData(
    shadowLogger,
    `${outputBasePath}-with-metadata.jsonl`,
    {
      ...options,
      includeMetadata: true,
    }
  );
  results.push(metaResult);

  return results;
}
