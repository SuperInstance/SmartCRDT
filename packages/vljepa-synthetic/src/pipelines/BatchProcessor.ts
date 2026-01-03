/**
 * @lsi/vljepa-synthetic - Batch Processor
 *
 * Processes large batches of synthetic UI data generation with parallel execution.
 *
 * @module pipelines
 */

import type { PipelineConfig } from "../types.js";
import { GenerationPipeline } from "./GenerationPipeline.js";
import { chunk } from "../utils.js";

export interface BatchProcessorConfig {
  pipeline: PipelineConfig;
  targetCount: number;
  parallelism: number;
  checkpointInterval: number;
  outputDir: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  eta: number; // seconds
}

export type ProgressCallback = (progress: BatchProgress) => void;

export class BatchProcessor {
  private config: BatchProcessorConfig;
  private pipelines: GenerationPipeline[];

  constructor(config: BatchProcessorConfig) {
    this.config = config;

    // Create multiple pipeline instances for parallel processing
    this.pipelines = Array.from(
      { length: config.parallelism },
      (_, i) =>
        new GenerationPipeline({
          ...config.pipeline,
          mutation: { ...config.pipeline.mutation, seed: Date.now() + i },
        })
    );
  }

  /**
   * Process the full batch with progress updates
   */
  async process(onProgress?: ProgressCallback): Promise<void> {
    const startTime = Date.now();
    const targetCount = this.config.targetCount;
    const batchSize = this.config.pipeline.batchSize;
    const parallelism = this.config.parallelism;

    let completed = 0;
    let failed = 0;

    // Calculate number of batches per pipeline
    const totalBatches = Math.ceil(targetCount / batchSize);
    const batchesPerPipeline = Math.ceil(totalBatches / parallelism);

    const progress: BatchProgress = {
      total: targetCount,
      completed: 0,
      failed: 0,
      percentage: 0,
      eta: 0,
    };

    // Process batches in parallel
    const pipelinePromises = this.pipelines.map(
      async (pipeline, pipelineIndex) => {
        const batchesToProcess = Math.min(
          batchesPerPipeline,
          Math.ceil((targetCount - completed) / batchSize)
        );

        for (let i = 0; i < batchesToProcess; i++) {
          try {
            const result = await pipeline.run(batchSize);

            completed += result.stats.generated;
            failed += result.stats.failed;

            // Update progress
            progress.completed = completed;
            progress.failed = failed;
            progress.percentage = (completed / targetCount) * 100;

            const elapsed = (Date.now() - startTime) / 1000;
            const rate = completed / elapsed;
            progress.eta = (targetCount - completed) / rate;

            onProgress?.(progress);

            // Checkpoint
            if (completed % this.config.checkpointInterval === 0) {
              await this.saveCheckpoint(progress);
            }

            // Check if we've reached target
            if (completed >= targetCount) {
              break;
            }
          } catch (err) {
            console.error(`Pipeline ${pipelineIndex} batch ${i} failed:`, err);
            failed += batchSize;
          }
        }
      }
    );

    await Promise.all(pipelinePromises);

    // Final checkpoint
    await this.saveCheckpoint(progress);
  }

  /**
   * Save progress checkpoint
   */
  private async saveCheckpoint(progress: BatchProgress): Promise<void> {
    const checkpoint = {
      timestamp: Date.now(),
      progress,
      config: this.config,
    };

    // In a real implementation, this would save to disk
    console.log(
      `Checkpoint: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`
    );
  }

  /**
   * Resume from checkpoint
   */
  async resume(checkpointPath: string): Promise<void> {
    // In a real implementation, this would load checkpoint and resume
    console.log(`Resuming from checkpoint: ${checkpointPath}`);
  }
}
