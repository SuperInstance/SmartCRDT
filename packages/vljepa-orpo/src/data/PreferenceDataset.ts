/**
 * @lsi/vljepa-orpo - Preference Dataset
 *
 * Dataset class for UI preference pairs.
 * Handles loading, caching, and iteration.
 *
 * @module data
 */

import type {
  UIPreferencePair,
  UIState,
  PreferenceContext,
  PreferenceMetadata,
} from "../types.js";

/**
 * Dataset options
 */
export interface PreferenceDatasetOptions {
  /** Cache embeddings in memory */
  cacheEmbeddings: boolean;
  /** Prefetch batches */
  prefetchSize: number;
  /** Shuffle on each epoch */
  shuffleEachEpoch: boolean;
  /** Drop last incomplete batch */
  dropLast: boolean;
}

/**
 * Dataset split
 */
export interface DatasetSplit {
  train: PreferenceDataset;
  validation: PreferenceDataset;
  test: PreferenceDataset;
}

/**
 * Dataset statistics
 */
export interface DatasetStatistics {
  totalPairs: number;
  avgConfidence: number;
  bySource: Record<string, number>;
  byContext: Record<string, number>;
  byTask: Record<string, number>;
  avgEmbeddingDimension: number;
}

/**
 * Preference Dataset
 *
 * Main dataset class for UI preference pairs.
 *
 * @example
 * ```typescript
 * const dataset = new PreferenceDataset(pairs);
 * for (const batch of dataset.iterateBatches(8)) {
 *   // Process batch
 * }
 */
export class PreferenceDataset {
  private pairs: UIPreferencePair[];
  private options: PreferenceDatasetOptions;
  private indices: number[];
  private cache: Map<number, UIPreferencePair>;
  private currentEpoch: number;

  constructor(
    pairs: UIPreferencePair[],
    options: Partial<PreferenceDatasetOptions> = {}
  ) {
    this.pairs = [...pairs];
    this.options = {
      cacheEmbeddings: true,
      prefetchSize: 2,
      shuffleEachEpoch: true,
      dropLast: true,
      ...options,
    };
    this.indices = Array.from({ length: pairs.length }, (_, i) => i);
    this.cache = new Map();
    this.currentEpoch = 0;

    if (this.options.cacheEmbeddings) {
      for (const pair of this.pairs) {
        this.cache.set(parseInt(pair.id.split("_")[1] || "0"), pair);
      }
    }
  }

  /**
   * Get dataset length
   */
  get length(): number {
    return this.pairs.length;
  }

  /**
   * Get a specific pair by index
   */
  get(index: number): UIPreferencePair {
    if (index < 0 || index >= this.pairs.length) {
      throw new Error(
        `Index ${index} out of bounds for dataset of length ${this.pairs.length}`
      );
    }

    const actualIndex = this.indices[index];
    return this.pairs[actualIndex];
  }

  /**
   * Get multiple pairs by indices
   */
  getBatch(indices: number[]): UIPreferencePair[] {
    return indices.map(i => this.get(i));
  }

  /**
   * Iterate over all pairs
   */
  *iterate(): Generator<UIPreferencePair> {
    for (let i = 0; i < this.pairs.length; i++) {
      yield this.get(i);
    }
  }

  /**
   * Iterate over batches
   */
  *iterateBatches(batchSize: number): Generator<UIPreferencePair[]> {
    const effectiveLength = this.options.dropLast
      ? Math.floor(this.pairs.length / batchSize) * batchSize
      : this.pairs.length;

    for (let i = 0; i < effectiveLength; i += batchSize) {
      const batchIndices = Array.from(
        { length: Math.min(batchSize, effectiveLength - i) },
        (_, j) => i + j
      );
      yield this.getBatch(batchIndices);
    }
  }

  /**
   * Shuffle dataset for new epoch
   */
  shuffle(): void {
    for (let i = this.indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.indices[i], this.indices[j]] = [this.indices[j], this.indices[i]];
    }
    this.currentEpoch++;
  }

  /**
   * Start new epoch (shuffles if enabled)
   */
  startNewEpoch(): void {
    if (this.options.shuffleEachEpoch) {
      this.shuffle();
    }
    this.currentEpoch++;
  }

  /**
   * Get current epoch number
   */
  getEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Split dataset into train/validation/test
   */
  split(trainRatio: number = 0.8, valRatio: number = 0.1): DatasetSplit {
    const total = this.pairs.length;
    const trainSize = Math.floor(total * trainRatio);
    const valSize = Math.floor(total * valRatio);

    const trainPairs = this.pairs.slice(0, trainSize);
    const valPairs = this.pairs.slice(trainSize, trainSize + valSize);
    const testPairs = this.pairs.slice(trainSize + valSize);

    return {
      train: new PreferenceDataset(trainPairs, this.options),
      validation: new PreferenceDataset(valPairs, this.options),
      test: new PreferenceDataset(testPairs, this.options),
    };
  }

  /**
   * Filter dataset by predicate
   */
  filter(predicate: (pair: UIPreferencePair) => boolean): PreferenceDataset {
    const filtered = this.pairs.filter(predicate);
    return new PreferenceDataset(filtered, this.options);
  }

  /**
   * Sample random pairs from dataset
   */
  sample(count: number): UIPreferencePair[] {
    const shuffled = [...this.indices].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(i => this.pairs[i]);
  }

  /**
   * Get dataset statistics
   */
  getStatistics(): DatasetStatistics {
    let totalConfidence = 0;
    const bySource: Record<string, number> = {};
    const byContext: Record<string, number> = {};
    const byTask: Record<string, number> = {};

    for (const pair of this.pairs) {
      totalConfidence += pair.metadata.confidence;
      bySource[pair.metadata.source] =
        (bySource[pair.metadata.source] || 0) + 1;
      byContext[pair.context.uiContext] =
        (byContext[pair.context.uiContext] || 0) + 1;
      byTask[pair.context.task] = (byTask[pair.context.task] || 0) + 1;
    }

    return {
      totalPairs: this.pairs.length,
      avgConfidence:
        this.pairs.length > 0 ? totalConfidence / this.pairs.length : 0,
      bySource,
      byContext,
      byTask,
      avgEmbeddingDimension: 768, // VL-JEPA standard
    };
  }

  /**
   * Create a subset of the dataset
   */
  slice(start: number, end: number): PreferenceDataset {
    return new PreferenceDataset(this.pairs.slice(start, end), this.options);
  }

  /**
   * Concatenate with another dataset
   */
  concat(other: PreferenceDataset): PreferenceDataset {
    return new PreferenceDataset([...this.pairs, ...other.pairs], this.options);
  }

  /**
   * Get all pairs
   */
  getPairs(): UIPreferencePair[] {
    return [...this.pairs];
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
  getOptions(): PreferenceDatasetOptions {
    return { ...this.options };
  }

  /**
   * Create dataset from arrays
   */
  static fromArrays(
    chosenStates: UIState[],
    rejectedStates: UIState[],
    contexts: PreferenceContext[],
    metadata: PreferenceMetadata[]
  ): PreferenceDataset {
    if (
      chosenStates.length !== rejectedStates.length ||
      chosenStates.length !== contexts.length ||
      chosenStates.length !== metadata.length
    ) {
      throw new Error("All input arrays must have the same length");
    }

    const pairs: UIPreferencePair[] = [];

    for (let i = 0; i < chosenStates.length; i++) {
      pairs.push({
        id: `pair_${Date.now()}_${i}`,
        chosen: chosenStates[i],
        rejected: rejectedStates[i],
        context: contexts[i],
        metadata: metadata[i],
      });
    }

    return new PreferenceDataset(pairs);
  }

  /**
   * Load dataset from JSONL file
   */
  static async fromJSONL(filePath: string): Promise<PreferenceDataset> {
    const { promises: fs } = await import("fs");
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.trim().split("\n");

    const pairs: UIPreferencePair[] = [];

    for (const line of lines) {
      if (line) {
        const pair = JSON.parse(line) as UIPreferencePair;
        // Convert embeddings
        if (pair.chosen.embedding) {
          pair.chosen.embedding = new Float32Array(
            pair.chosen.embedding as unknown as number[]
          );
        }
        if (pair.rejected.embedding) {
          pair.rejected.embedding = new Float32Array(
            pair.rejected.embedding as unknown as number[]
          );
        }
        pairs.push(pair);
      }
    }

    return new PreferenceDataset(pairs);
  }

  /**
   * Save dataset to JSONL file
   */
  async saveToJSONL(filePath: string): Promise<void> {
    const { promises: fs } = await import("fs");
    const lines = this.pairs.map(pair => JSON.stringify(pair));
    await fs.writeFile(filePath, lines.join("\n"), "utf8");
  }
}

/**
 * Create a preference dataset
 */
export function createPreferenceDataset(
  pairs: UIPreferencePair[],
  options?: Partial<PreferenceDatasetOptions>
): PreferenceDataset {
  return new PreferenceDataset(pairs, options);
}

/**
 * Load a preference dataset from file
 */
export async function loadPreferenceDataset(
  filePath: string,
  options?: Partial<PreferenceDatasetOptions>
): Promise<PreferenceDataset> {
  return await PreferenceDataset.fromJSONL(filePath);
}
