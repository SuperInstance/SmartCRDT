/**
 * @lsi/vljepa-orpo - Data Collator
 *
 * Batches and collates preference pairs for training.
 * Handles padding, shuffling, and batching.
 *
 * @module trainers
 */

import type {
  UIPreferencePair,
  TrainingBatch,
  DataCollatorOptions,
} from "../types.js";

/**
 * Batched data with metadata
 */
export interface BatchedData {
  /** Batches */
  batches: TrainingBatch[];
  /** Number of batches */
  numBatches: number;
  /** Batch size */
  batchSize: number;
  /** Total samples */
  totalSamples: number;
  /** Whether last batch is partial */
  hasPartialBatch: boolean;
}

/**
 * Data Collator
 *
 * Collates preference pairs into training batches.
 *
 * @example
 * ```typescript
 * const collator = new DataCollator({ batchSize: 8, shuffle: true });
 * const batches = collator.collate(preferencePairs);
 */
export class DataCollator {
  private options: DataCollatorOptions;
  private rng: () => number;

  constructor(options: Partial<DataCollatorOptions> = {}) {
    this.options = {
      padEmbeddings: true,
      shuffle: true,
      dropLast: true,
      prefetch: 0,
      ...options,
    };

    // Seeded random for reproducibility
    this.rng = this.seededRandom(Math.random());
  }

  /**
   * Collate preference pairs into batches
   */
  collate(pairs: UIPreferencePair[]): BatchedData {
    let workingPairs = [...pairs];

    // Shuffle if enabled
    if (this.options.shuffle) {
      workingPairs = this.shuffle(workingPairs);
    }

    // Drop last incomplete batch if enabled
    const batchSize = this.options.batchSize || 8;
    const totalBatches = Math.floor(workingPairs.length / batchSize);
    const effectiveLength = this.options.dropLast
      ? totalBatches * batchSize
      : workingPairs.length;

    workingPairs = workingPairs.slice(0, effectiveLength);

    // Create batches
    const batches: TrainingBatch[] = [];
    for (let i = 0; i < workingPairs.length; i += batchSize) {
      const batchPairs = workingPairs.slice(i, i + batchSize);
      const batch = this.createBatch(batchPairs, i);
      batches.push(batch);
    }

    return {
      batches,
      numBatches: batches.length,
      batchSize,
      totalSamples: workingPairs.length,
      hasPartialBatch:
        !this.options.dropLast && workingPairs.length % batchSize !== 0,
    };
  }

  /**
   * Create a single training batch
   */
  private createBatch(
    pairs: UIPreferencePair[],
    startIndex: number
  ): TrainingBatch {
    const batchSize = pairs.length;
    const embeddingDim = 768;

    // Pre-allocate arrays
    const chosenEmbeddings = new Array(batchSize);
    const rejectedEmbeddings = new Array(batchSize);
    const contextEmbeddings = new Array(batchSize);
    const indices = new Array(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const pair = pairs[i];

      // Extract embeddings (use existing if available)
      chosenEmbeddings[i] =
        pair.chosen.embedding || this.createRandomEmbedding();
      rejectedEmbeddings[i] =
        pair.rejected.embedding || this.createRandomEmbedding();
      contextEmbeddings[i] = this.createContextEmbedding(pair);
      indices[i] = startIndex + i;
    }

    return {
      chosenEmbeddings,
      rejectedEmbeddings,
      contextEmbeddings,
      indices,
    };
  }

  /**
   * Create context embedding from preference pair
   */
  private createContextEmbedding(pair: UIPreferencePair): Float32Array {
    const contextText = `${pair.context.task} ${pair.context.userIntent} ${pair.context.uiContext}`;
    const hash = this.hashString(contextText);
    const embedding = new Float32Array(768);

    for (let i = 0; i < 768; i++) {
      const seed = hash + i * 31;
      embedding[i] =
        (((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    }

    return this.normalizeEmbedding(embedding);
  }

  /**
   * Create random embedding for missing data
   */
  private createRandomEmbedding(): Float32Array {
    const embedding = new Float32Array(768);
    for (let i = 0; i < 768; i++) {
      embedding[i] = this.rng() * 2 - 1;
    }
    return this.normalizeEmbedding(embedding);
  }

  /**
   * Normalize embedding
   */
  private normalizeEmbedding(embedding: Float32Array): Float32Array {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = new Float32Array(embedding.length);

    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / (norm + 1e-8);
    }

    return normalized;
  }

  /**
   * Shuffle array using Fisher-Yates
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
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
   * Get options
   */
  getOptions(): DataCollatorOptions {
    return { ...this.options };
  }

  /**
   * Set batch size
   */
  setBatchSize(batchSize: number): void {
    this.options.batchSize = batchSize;
  }

  /**
   * Enable/disable shuffling
   */
  setShuffle(shuffle: boolean): void {
    this.options.shuffle = shuffle;
  }

  /**
   * Enable/disable dropping last batch
   */
  setDropLast(dropLast: boolean): void {
    this.options.dropLast = dropLast;
  }
}

/**
 * Create a data collator
 */
export function createDataCollator(
  options?: Partial<DataCollatorOptions>
): DataCollator {
  return new DataCollator(options);
}
