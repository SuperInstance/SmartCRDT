/**
 * Stage Sampler
 *
 * Stage-specific sampling with:
 * - Per-stage example management
 * - Progress-aware sampling
 * - Epoch-based sampling strategies
 */

import type {
  CurriculumStage,
  StageSampler as IStageSampler,
  TrainingExample,
  SamplerProgress,
} from "../types.js";

export class StageSampler implements IStageSampler {
  private stage: CurriculumStage | null = null;
  private examples: TrainingExample[] = [];
  private sampledIndices: Set<number> = new Set();
  private currentEpoch: number = 0;
  private shuffle: boolean = true;

  /**
   * Initialize sampler for a specific stage
   */
  initialize(stage: CurriculumStage): void {
    this.stage = stage;
    this.examples = [];
    this.sampledIndices.clear();
    this.currentEpoch = 0;
  }

  /**
   * Load examples for sampling
   */
  loadExamples(examples: TrainingExample[]): void {
    this.examples = [...examples];
    this.sampledIndices.clear();
  }

  /**
   * Sample a batch of examples
   */
  sample(batchSize: number): TrainingExample[] {
    if (this.examples.length === 0) {
      return [];
    }

    const batch: TrainingExample[] = [];
    const indices = this.getSampleIndices(batchSize);

    for (const index of indices) {
      batch.push(this.examples[index]);
      this.sampledIndices.add(index);
    }

    return batch;
  }

  /**
   * Get indices to sample
   */
  private getSampleIndices(batchSize: number): number[] {
    const available = this.examples.length;
    const sampled = this.sampledIndices.size;
    const indices: number[] = [];

    // If we've sampled all examples, reset for new epoch
    if (sampled >= available) {
      this.sampledIndices.clear();
      this.currentEpoch++;
    }

    // Determine how many new vs replay examples
    const remaining = available - this.sampledIndices.size;
    const newSamples = Math.min(batchSize, remaining);
    const replaySamples = batchSize - newSamples;

    // Sample new examples
    for (let i = 0; i < newSamples; i++) {
      let index: number;
      do {
        index = Math.floor(Math.random() * available);
      } while (this.sampledIndices.has(index));
      indices.push(index);
    }

    // Sample replay examples (previously seen)
    for (let i = 0; i < replaySamples; i++) {
      const index = Math.floor(Math.random() * available);
      indices.push(index);
    }

    // Shuffle indices
    if (this.shuffle) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }

    return indices;
  }

  /**
   * Get sampler progress
   */
  getProgress(): SamplerProgress {
    return {
      totalExamples: this.examples.length,
      sampledExamples: this.sampledIndices.size,
      remainingExamples: this.examples.length - this.sampledIndices.size,
      epochsCompleted: this.currentEpoch,
    };
  }

  /**
   * Reset sampler state
   */
  reset(): void {
    this.sampledIndices.clear();
    this.currentEpoch = 0;
  }

  /**
   * Get total number of examples
   */
  getTotalExamples(): number {
    return this.examples.length;
  }

  /**
   * Get number of unique examples sampled
   */
  getUniqueSampled(): number {
    return this.sampledIndices.size;
  }

  /**
   * Set shuffle mode
   */
  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
  }
}
