/**
 * @lsi/vljepa-orpo - Preference Loader
 *
 * Loads and preprocesses UI preference pairs from various sources.
 * Handles train/validation/test splits and filtering.
 *
 * @module data
 */

import type {
  UIPreferencePair,
  PreferenceLoaderOptions,
  DatasetSplit,
} from "../types.js";
import { PreferenceDataset } from "./PreferenceDataset.js";

/**
 * Loaded dataset with splits
 */
export interface LoadedData {
  train: PreferenceDataset;
  validation: PreferenceDataset;
  test: PreferenceDataset;
  metadata: {
    total: number;
    sourceDistribution: Record<string, number>;
    contextDistribution: Record<string, number>;
    avgConfidence: number;
  };
}

/**
 * Filter options
 */
export interface FilterOptions {
  minConfidence?: number;
  sources?: string[];
  uiContexts?: string[];
  tasks?: string[];
  dateRange?: { start: number; end: number };
}

/**
 * Preference Loader
 *
 * Loads and preprocesses UI preference pairs from files.
 *
 * @example
 * ```typescript
 * const loader = new PreferenceLoader();
 * const data = await loader.loadFromJSONL('./data/pairs.jsonl');
 * const split = data.split(0.8, 0.1, 0.1);
 */
export class PreferenceLoader {
  private options: PreferenceLoaderOptions;
  private cache: Map<string, UIPreferencePair[]>;

  constructor(options: Partial<PreferenceLoaderOptions> = {}) {
    this.options = {
      validationSplit: 0.1,
      testSplit: 0.1,
      shuffle: true,
      seed: 42,
      minConfidence: 0.0,
      ...options,
    };
    this.cache = new Map();
  }

  /**
   * Load preference pairs from JSONL file
   */
  async loadFromJSONL(filePath: string): Promise<UIPreferencePair[]> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return [...this.cache.get(filePath)!];
    }

    const { promises: fs } = await import("fs");
    const content = await fs.readFile(filePath, "utf8");
    const pairs = this.parseJSONL(content);

    // Cache the result
    this.cache.set(filePath, [...pairs]);

    return pairs;
  }

  /**
   * Load preference pairs from JSON array file
   */
  async loadFromJSON(filePath: string): Promise<UIPreferencePair[]> {
    if (this.cache.has(filePath)) {
      return [...this.cache.get(filePath)!];
    }

    const { promises: fs } = await import("fs");
    const content = await fs.readFile(filePath, "utf8");
    const pairs = JSON.parse(content) as UIPreferencePair[];

    // Process embeddings
    for (const pair of pairs) {
      if (pair.chosen.embedding && Array.isArray(pair.chosen.embedding)) {
        pair.chosen.embedding = new Float32Array(
          pair.chosen.embedding as unknown as number[]
        );
      }
      if (pair.rejected.embedding && Array.isArray(pair.rejected.embedding)) {
        pair.rejected.embedding = new Float32Array(
          pair.rejected.embedding as unknown as number[]
        );
      }
    }

    this.cache.set(filePath, [...pairs]);

    return pairs;
  }

  /**
   * Load from multiple files and merge
   */
  async loadFromFiles(filePaths: string[]): Promise<UIPreferencePair[]> {
    const allPairs: UIPreferencePair[] = [];

    for (const filePath of filePaths) {
      const pairs = filePath.endsWith(".jsonl")
        ? await this.loadFromJSONL(filePath)
        : await this.loadFromJSON(filePath);
      allPairs.push(...pairs);
    }

    return allPairs;
  }

  /**
   * Load from directory (all JSONL files)
   */
  async loadFromDirectory(dirPath: string): Promise<UIPreferencePair[]> {
    const { promises: fs } = await import("fs");
    const path = await import("path");

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const jsonlFiles = entries
      .filter(e => e.isFile() && e.name.endsWith(".jsonl"))
      .map(e => path.join(dirPath, e.name));

    return await this.loadFromFiles(jsonlFiles);
  }

  /**
   * Load and split into train/validation/test
   */
  async loadAndSplit(filePath: string): Promise<LoadedData> {
    const pairs = await this.loadFromJSONL(filePath);

    // Apply filters
    const filtered = this.applyFilters(pairs);

    // Shuffle if enabled
    const shuffled = this.options.shuffle
      ? this.shuffleArray(filtered)
      : filtered;

    // Calculate split indices
    const total = shuffled.length;
    const testSize = Math.floor(total * this.options.testSplit);
    const valSize = Math.floor(total * this.options.validationSplit);
    const trainSize = total - testSize - valSize;

    // Split data
    const trainPairs = shuffled.slice(0, trainSize);
    const valPairs = shuffled.slice(trainSize, trainSize + valSize);
    const testPairs = shuffled.slice(trainSize + valSize);

    // Compute metadata
    const metadata = this.computeMetadata(shuffled);

    return {
      train: new PreferenceDataset(trainPairs),
      validation: new PreferenceDataset(valPairs),
      test: new PreferenceDataset(testPairs),
      metadata,
    };
  }

  /**
   * Load with custom split ratios
   */
  async loadWithCustomSplit(
    filePath: string,
    trainRatio: number,
    valRatio: number,
    testRatio: number
  ): Promise<LoadedData> {
    if (Math.abs(trainRatio + valRatio + testRatio - 1.0) > 0.001) {
      throw new Error("Split ratios must sum to 1.0");
    }

    const pairs = await this.loadFromJSONL(filePath);
    const filtered = this.applyFilters(pairs);
    const shuffled = this.options.shuffle
      ? this.shuffleArray(filtered)
      : filtered;

    const total = shuffled.length;
    const trainSize = Math.floor(total * trainRatio);
    const valSize = Math.floor(total * valRatio);

    const trainPairs = shuffled.slice(0, trainSize);
    const valPairs = shuffled.slice(trainSize, trainSize + valSize);
    const testPairs = shuffled.slice(trainSize + valSize);

    const metadata = this.computeMetadata(shuffled);

    return {
      train: new PreferenceDataset(trainPairs),
      validation: new PreferenceDataset(valPairs),
      test: new PreferenceDataset(testPairs),
      metadata,
    };
  }

  /**
   * Filter pairs by criteria
   */
  filter(
    pairs: UIPreferencePair[],
    filters: FilterOptions
  ): UIPreferencePair[] {
    let result = [...pairs];

    if (filters.minConfidence !== undefined) {
      result = result.filter(
        p => p.metadata.confidence >= filters.minConfidence!
      );
    }

    if (filters.sources && filters.sources.length > 0) {
      result = result.filter(p => filters.sources!.includes(p.metadata.source));
    }

    if (filters.uiContexts && filters.uiContexts.length > 0) {
      result = result.filter(p =>
        filters.uiContexts!.includes(p.context.uiContext)
      );
    }

    if (filters.tasks && filters.tasks.length > 0) {
      result = result.filter(p => filters.tasks!.includes(p.context.task));
    }

    if (filters.dateRange) {
      result = result.filter(p => {
        const ts = p.metadata.timestamp;
        return ts >= filters.dateRange!.start && ts <= filters.dateRange!.end;
      });
    }

    return result;
  }

  /**
   * Balance dataset by source
   */
  balanceBySource(pairs: UIPreferencePair[]): UIPreferencePair[] {
    const bySource = new Map<string, UIPreferencePair[]>();

    for (const pair of pairs) {
      const source = pair.metadata.source;
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(pair);
    }

    const minSize = Math.min(
      ...Array.from(bySource.values()).map(arr => arr.length)
    );
    const balanced: UIPreferencePair[] = [];

    for (const sourcePairs of bySource.values()) {
      balanced.push(...sourcePairs.slice(0, minSize));
    }

    return balanced;
  }

  /**
   * Balance dataset by UI context
   */
  balanceByContext(pairs: UIPreferencePair[]): UIPreferencePair[] {
    const byContext = new Map<string, UIPreferencePair[]>();

    for (const pair of pairs) {
      const context = pair.context.uiContext;
      if (!byContext.has(context)) {
        byContext.set(context, []);
      }
      byContext.get(context)!.push(pair);
    }

    const minSize = Math.min(
      ...Array.from(byContext.values()).map(arr => arr.length)
    );
    const balanced: UIPreferencePair[] = [];

    for (const contextPairs of byContext.values()) {
      balanced.push(...contextPairs.slice(0, minSize));
    }

    return balanced;
  }

  /**
   * Undersample majority class
   */
  undersample(
    pairs: UIPreferencePair[],
    targetSize: number
  ): UIPreferencePair[] {
    if (pairs.length <= targetSize) {
      return [...pairs];
    }

    const shuffled = this.shuffleArray([...pairs]);
    return shuffled.slice(0, targetSize);
  }

  /**
   * Oversample minority class (with augmentation)
   */
  oversample(
    pairs: UIPreferencePair[],
    targetSize: number
  ): UIPreferencePair[] {
    if (pairs.length >= targetSize) {
      return [...pairs];
    }

    const result = [...pairs];
    const needed = targetSize - pairs.length;

    for (let i = 0; i < needed; i++) {
      const original = pairs[i % pairs.length];
      const augmented = this.augmentPair(original, i);
      result.push(augmented);
    }

    return result;
  }

  /**
   * Augment a single pair (simple transformations)
   */
  private augmentPair(pair: UIPreferencePair, seed: number): UIPreferencePair {
    const rng = this.seededRandom(seed);

    return {
      ...pair,
      id: `${pair.id}_aug_${seed}`,
      metadata: {
        ...pair.metadata,
        confidence: pair.metadata.confidence * (0.9 + rng() * 0.1), // Slightly reduce confidence
        timestamp: pair.metadata.timestamp + rng() * 1000, // Small time offset
      },
    };
  }

  /**
   * Parse JSONL content
   */
  private parseJSONL(content: string): UIPreferencePair[] {
    const lines = content.trim().split("\n");
    const pairs: UIPreferencePair[] = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          const pair = JSON.parse(line) as UIPreferencePair;

          // Convert embeddings to Float32Array
          if (pair.chosen.embedding && Array.isArray(pair.chosen.embedding)) {
            pair.chosen.embedding = new Float32Array(
              pair.chosen.embedding as unknown as number[]
            );
          }
          if (
            pair.rejected.embedding &&
            Array.isArray(pair.rejected.embedding)
          ) {
            pair.rejected.embedding = new Float32Array(
              pair.rejected.embedding as unknown as number[]
            );
          }

          pairs.push(pair);
        } catch (error) {
          console.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
        }
      }
    }

    return pairs;
  }

  /**
   * Apply configured filters
   */
  private applyFilters(pairs: UIPreferencePair[]): UIPreferencePair[] {
    let result = [...pairs];

    if (this.options.minConfidence > 0) {
      result = result.filter(
        p => p.metadata.confidence >= this.options.minConfidence
      );
    }

    if (this.options.sources && this.options.sources.length > 0) {
      result = result.filter(p =>
        this.options.sources!.includes(p.metadata.source)
      );
    }

    if (this.options.uiContexts && this.options.uiContexts.length > 0) {
      result = result.filter(p =>
        this.options.uiContexts!.includes(p.context.uiContext)
      );
    }

    return result;
  }

  /**
   * Compute metadata statistics
   */
  private computeMetadata(pairs: UIPreferencePair[]): LoadedData["metadata"] {
    const sourceDistribution: Record<string, number> = {};
    const contextDistribution: Record<string, number> = {};
    let totalConfidence = 0;

    for (const pair of pairs) {
      sourceDistribution[pair.metadata.source] =
        (sourceDistribution[pair.metadata.source] || 0) + 1;
      contextDistribution[pair.context.uiContext] =
        (contextDistribution[pair.context.uiContext] || 0) + 1;
      totalConfidence += pair.metadata.confidence;
    }

    return {
      total: pairs.length,
      sourceDistribution,
      contextDistribution,
      avgConfidence: pairs.length > 0 ? totalConfidence / pairs.length : 0,
    };
  }

  /**
   * Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    const rng = this.seededRandom(this.options.seed);

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get options
   */
  getOptions(): PreferenceLoaderOptions {
    return { ...this.options };
  }

  /**
   * Set options
   */
  setOptions(options: Partial<PreferenceLoaderOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Create a preference loader
 */
export function createPreferenceLoader(
  options?: Partial<PreferenceLoaderOptions>
): PreferenceLoader {
  return new PreferenceLoader(options);
}

/**
 * Load preference dataset (convenience function)
 */
export async function loadPreferenceDataset(
  filePath: string,
  options?: Partial<PreferenceLoaderOptions>
): Promise<LoadedData> {
  const loader = new PreferenceLoader(options);
  return await loader.loadAndSplit(filePath);
}
