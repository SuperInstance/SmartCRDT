/**
 * Data Exporter
 *
 * Exports generated queries to various formats (JSONL, CSV)
 * and creates train/val/test splits.
 *
 * @package vljepa/data
 */
import { GeneratedQuery } from "./generator";
/**
 * Training example format
 */
export interface TrainingExample {
    /** Query text */
    query: string;
    /** Intent category */
    intent: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Dataset split configuration
 */
export interface DatasetSplit {
    /** Training set */
    train: GeneratedQuery[];
    /** Validation set */
    validation: GeneratedQuery[];
    /** Test set */
    test: GeneratedQuery[];
}
/**
 * Statistics about the dataset
 */
export interface DatasetStatistics {
    /** Total number of queries */
    total: number;
    /** Count by intent category */
    intents: Record<string, number>;
    /** Count by domain */
    domains: Record<string, number>;
    /** Count by difficulty */
    difficulties: Record<string, number>;
    /** Count by variation */
    variations: Record<string, number>;
    /** Balance assessment */
    balance: "balanced" | "imbalanced";
    /** Average query length */
    avgQueryLength: number;
    /** Min query length */
    minQueryLength: number;
    /** Max query length */
    maxQueryLength: number;
}
/**
 * Data Exporter Class
 *
 * Handles exporting generated queries to various formats
 * and creating train/validation/test splits.
 */
export declare class DataExporter {
    /**
     * Export queries to JSONL format (for training)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    exportToJSONL(queries: GeneratedQuery[], outputPath: string): Promise<void>;
    /**
     * Export queries to CSV format (for analysis)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    exportToCSV(queries: GeneratedQuery[], outputPath: string): Promise<void>;
    /**
     * Export queries to JSON format (for programmatic access)
     *
     * @param queries - Array of generated queries
     * @param outputPath - Output file path
     */
    exportToJSON(queries: GeneratedQuery[], outputPath: string): Promise<void>;
    /**
     * Split dataset into train/validation/test sets
     *
     * @param queries - Array of generated queries
     * @param trainRatio - Ratio for training set (default: 0.8)
     * @param valRatio - Ratio for validation set (default: 0.1)
     * @param testRatio - Ratio for test set (default: 0.1)
     * @param stratify - Whether to stratify by intent (default: true)
     * @returns Dataset split
     */
    splitTrainValTest(queries: GeneratedQuery[], trainRatio?: number, valRatio?: number, testRatio?: number, stratify?: boolean): DatasetSplit;
    /**
     * Stratified split maintaining intent distribution
     */
    private stratifiedSplit;
    /**
     * Random split without stratification
     */
    private randomSplit;
    /**
     * Generate comprehensive statistics about the dataset
     *
     * @param queries - Array of generated queries
     * @returns Dataset statistics
     */
    generateStats(queries: GeneratedQuery[]): DatasetStatistics;
    /**
     * Check if intent distribution is balanced
     */
    private checkBalance;
    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    private shuffle;
    /**
     * Write content to file (works in both Node.js and Deno)
     */
    private writeFile;
    /**
     * Export split datasets to files
     *
     * @param splits - Dataset split
     * @param outputDir - Output directory
     * @param format - Output format ('jsonl' or 'json')
     */
    exportSplits(splits: DatasetSplit, outputDir: string, format?: "jsonl" | "json"): Promise<void>;
    /**
     * Generate statistics report as markdown
     *
     * @param stats - Dataset statistics
     * @returns Markdown report
     */
    generateStatsReport(stats: DatasetStatistics): string;
}
//# sourceMappingURL=exporter.d.ts.map