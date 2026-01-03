/**
 * @fileoverview JEPA Formatter - Format data for JEPA training
 * @description Converts collected data into JEPA-compatible format
 */

import type {
  JEPASample,
  JEPAMetadata,
  JEPAFormatterConfig,
  UIStatePair,
  CollectedScreenshot,
  DOMStructure,
  DatasetError,
} from "../types.js";

// Re-export types
export type { JEPAFormatterConfig } from "../types.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * JEPA Formatter class
 */
export class JEPAFormatter {
  private config: JEPAFormatterConfig;

  constructor(config?: Partial<JEPAFormatterConfig>) {
    this.config = {
      embeddingSize: config?.embeddingSize ?? 768,
      imageSize: config?.imageSize ?? { width: 224, height: 224 },
      includeDOM: config?.includeDOM ?? true,
      includeActions: config?.includeActions ?? true,
      normalizeImages: config?.normalizeImages ?? true,
      augmentData: config?.augmentData ?? false,
    };
  }

  /**
   * Format UI state pair as JEPA sample
   */
  async formatPair(pair: UIStatePair): Promise<JEPASample> {
    // Generate embeddings (placeholder - would use real encoder)
    const xEmbedding = await this.generateXEmbedding(pair.before);
    const yEmbedding = await this.generateYEmbedding(pair);
    const goalEmbedding = await this.generateGoalEmbedding(pair);

    return {
      id: `jepa_${pair.id}`,
      xEmbedding,
      yEmbedding,
      goalEmbedding,
      image: pair.before.screenshot.image,
      dom: this.config.includeDOM ? pair.before.dom : undefined,
      actions: this.config.includeActions ? [] : undefined,
      metadata: {
        pairId: pair.id,
        category: pair.metadata.category,
        changeType: pair.changeType,
        difficulty: pair.metadata.difficulty,
        timestamp: Date.now(),
        source: pair.metadata.source,
      },
    };
  }

  /**
   * Format multiple pairs as JEPA samples
   */
  async formatBatch(pairs: UIStatePair[]): Promise<JEPASample[]> {
    const samples: JEPASample[] = [];

    for (const pair of pairs) {
      try {
        const sample = await this.formatPair(pair);
        samples.push(sample);
      } catch (error) {
        console.error(`Failed to format pair ${pair.id}:`, error);
      }
    }

    return samples;
  }

  /**
   * Generate X embedding (vision)
   */
  private async generateXEmbedding(state: {
    screenshot: CollectedScreenshot;
  }): Promise<Float32Array> {
    // Placeholder: In production, this would use X-Encoder
    // For now, generate pseudo-embedding from image
    const image = state.screenshot.image;
    const hash = this.simpleHash(image);
    const embedding = new Float32Array(this.config.embeddingSize);

    for (let i = 0; i < this.config.embeddingSize; i++) {
      embedding[i] = ((hash * (i + 1)) % 1000) / 1000;
    }

    return embedding;
  }

  /**
   * Generate Y embedding (language/intent)
   */
  private async generateYEmbedding(pair: UIStatePair): Promise<Float32Array> {
    // Placeholder: In production, this would use Y-Encoder
    const text = pair.changeDescription;
    const hash = this.stringHash(text);
    const embedding = new Float32Array(this.config.embeddingSize);

    for (let i = 0; i < this.config.embeddingSize; i++) {
      embedding[i] = ((hash * (i + 1) * 7) % 1000) / 1000;
    }

    return embedding;
  }

  /**
   * Generate goal embedding
   */
  private async generateGoalEmbedding(
    pair: UIStatePair
  ): Promise<Float32Array> {
    // Goal is weighted combination of X and Y
    const xEmbedding = await this.generateXEmbedding(pair.after);
    const yEmbedding = await this.generateYEmbedding(pair);

    const goalEmbedding = new Float32Array(this.config.embeddingSize);

    for (let i = 0; i < this.config.embeddingSize; i++) {
      goalEmbedding[i] = xEmbedding[i] * 0.6 + yEmbedding[i] * 0.4;
    }

    return goalEmbedding;
  }

  /**
   * Simple hash function for placeholder embeddings
   */
  private simpleHash(data: Buffer): number {
    let hash = 0;
    const len = Math.min(data.length, 1024); // Sample first 1KB
    for (let i = 0; i < len; i++) {
      hash = (hash << 5) - hash + data[i];
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * String hash function
   */
  private stringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Save samples to disk
   */
  async saveSamples(samples: JEPASample[], outputDir: string): Promise<void> {
    try {
      mkdirSync(outputDir, { recursive: true });

      for (const sample of samples) {
        const filePath = join(outputDir, `${sample.id}.bin`);
        const data = {
          xEmbedding: Array.from(sample.xEmbedding),
          yEmbedding: Array.from(sample.yEmbedding),
          goalEmbedding: Array.from(sample.goalEmbedding),
          metadata: sample.metadata,
        };
        writeFileSync(filePath, JSON.stringify(data));
      }
    } catch (error) {
      throw this.createError("storage-failed", "Failed to save samples", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}
