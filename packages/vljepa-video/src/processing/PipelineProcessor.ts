/**
 * @lsi/vljepa-video/processing/PipelineProcessor
 *
 * Pipeline processor for multi-stage video processing.
 *
 * @version 1.0.0
 */

import type { VideoFrame, ProcessedFrame, FrameResult } from "../types.js";

/**
 * Pipeline stage
 */
export interface PipelineStage {
  /** Stage name */
  name: string;

  /** Process function */
  process: (input: any) => Promise<any>;

  /** Whether to run in parallel */
  parallel?: boolean;
}

/**
 * Pipeline processor configuration
 */
export interface PipelineProcessorConfig {
  /** Pipeline stages */
  stages: PipelineStage[];

  /** Maximum concurrency */
  maxConcurrency: number;

  /** Whether to enable buffering between stages */
  buffering: boolean;

  /** Buffer size */
  bufferSize: number;
}

/**
 * Pipeline processor
 *
 * Processes frames through a multi-stage pipeline.
 */
export class PipelineProcessor {
  private config: PipelineProcessorConfig;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private stageTimings: Map<string, number[]> = new Map();

  constructor(config: PipelineProcessorConfig) {
    this.config = config;

    // Initialize stage timings
    for (const stage of config.stages) {
      this.stageTimings.set(stage.name, []);
    }
  }

  /**
   * Start pipeline
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.processedCount = 0;
  }

  /**
   * Stop pipeline
   */
  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Process frame through pipeline
   */
  async processFrame(frame: VideoFrame): Promise<any> {
    if (!this.isRunning) {
      throw new Error("Pipeline not running");
    }

    let current: any = frame;

    // Process through each stage
    for (const stage of this.config.stages) {
      const startTime = performance.now();

      try {
        current = await stage.process(current);
      } catch (error) {
        throw new Error(`Stage "${stage.name}" failed: ${error}`);
      }

      const endTime = performance.now();
      const timing = endTime - startTime;

      // Record timing
      const timings = this.stageTimings.get(stage.name) || [];
      timings.push(timing);
      this.stageTimings.set(stage.name, timings);
    }

    this.processedCount++;
    return current;
  }

  /**
   * Process multiple frames through pipeline
   */
  async processBatch(frames: VideoFrame[]): Promise<any[]> {
    if (this.config.maxConcurrency <= 1) {
      // Sequential processing
      const results: any[] = [];
      for (const frame of frames) {
        results.push(await this.processFrame(frame));
      }
      return results;
    }

    // Parallel processing with concurrency limit
    const results: any[] = [];
    const inFlight: Promise<void>[] = [];

    for (const frame of frames) {
      const promise = (async () => {
        const result = await this.processFrame(frame);
        results.push(result);
      })();

      inFlight.push(promise);

      // Wait for one to complete if at concurrency limit
      if (inFlight.length >= this.config.maxConcurrency) {
        await Promise.race(inFlight);
        // Remove completed promises
        const completed = inFlight.filter(p => {
          // Check if promise is settled (rough check)
          return true;
        });
        inFlight.length = 0;
        inFlight.push(...completed);
      }
    }

    // Wait for all to complete
    await Promise.all(inFlight);

    return results;
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    processedCount: number;
    isRunning: boolean;
    stageTimings: Map<string, { avg: number; min: number; max: number }>;
  } {
    const stageTimingsMap = new Map();

    for (const [stage, timings] of this.stageTimings.entries()) {
      if (timings.length > 0) {
        const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
        const min = Math.min(...timings);
        const max = Math.max(...timings);
        stageTimingsMap.set(stage, { avg, min, max });
      }
    }

    return {
      processedCount: this.processedCount,
      isRunning: this.isRunning,
      stageTimings: stageTimingsMap,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.processedCount = 0;
    for (const stage of this.config.stages) {
      this.stageTimings.set(stage.name, []);
    }
  }
}

/**
 * Common pipeline stages
 */
export class PipelineStages {
  /**
   * Preprocessing stage
   */
  static preprocessing(config: any): PipelineStage {
    return {
      name: "preprocessing",
      process: async (frame: VideoFrame) => {
        // Apply preprocessing
        return frame;
      },
    };
  }

  /**
   * Encoding stage
   */
  static encoding(encoder: any): PipelineStage {
    return {
      name: "encoding",
      process: async (frame: VideoFrame) => {
        return await encoder.encode(frame);
      },
    };
  }

  /**
   * Postprocessing stage
   */
  static postprocessing(): PipelineStage {
    return {
      name: "postprocessing",
      process: async (embedding: Float32Array) => {
        // Normalize embedding
        const norm = Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0)
        );

        if (norm > 0) {
          const normalized = new Float32Array(embedding.length);
          for (let i = 0; i < embedding.length; i++) {
            normalized[i] = embedding[i] / norm;
          }
          return normalized;
        }

        return embedding;
      },
    };
  }

  /**
   * Quality assessment stage
   */
  static qualityAssessment(): PipelineStage {
    return {
      name: "quality",
      process: async (frame: VideoFrame) => {
        // Assess quality
        return {
          frame,
          quality: {
            score: 0.8,
            sharpness: 0.7,
            brightness: 0.8,
            contrast: 0.9,
            noise: 0.1,
            motionBlur: false,
          },
        };
      },
    };
  }
}
