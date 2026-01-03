/**
 * StateFusion - Main fusion orchestrator
 *
 * Orchestrates different fusion strategies for combining
 * text and visual modalities into unified embeddings.
 */

import type {
  FusionConfig,
  FusionResult,
  FusionMetadata,
  FusionStrategy,
} from "../types.js";
import { ConcatFusion } from "./ConcatFusion.js";
import { AttentionFusion } from "./AttentionFusion.js";
import { TransformerFusion } from "./TransformerFusion.js";
import { GatingFusion } from "./GatingFusion.js";

/**
 * State fusion manager
 */
export class StateFusion {
  private strategies: Map<
    FusionStrategy,
    ConcatFusion | AttentionFusion | TransformerFusion | GatingFusion
  >;
  private defaultConfig: FusionConfig;

  constructor(defaultConfig?: Partial<FusionConfig>) {
    this.defaultConfig = {
      strategy: "attention",
      outputDim: 768,
      numHeads: 8,
      numLayers: 2,
      dropout: 0.1,
      normalize: true,
      ...defaultConfig,
    };

    this.strategies = new Map();
    this.initializeStrategies();
  }

  /**
   * Initialize all fusion strategies
   */
  private initializeStrategies(): void {
    this.strategies.set("concat", new ConcatFusion(this.defaultConfig));
    this.strategies.set("attention", new AttentionFusion(this.defaultConfig));
    this.strategies.set(
      "transformer",
      new TransformerFusion(this.defaultConfig)
    );
    this.strategies.set("gating", new GatingFusion(this.defaultConfig));
  }

  /**
   * Fuse text and visual embeddings
   */
  fuse(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array,
    config?: Partial<FusionConfig>
  ): FusionResult {
    const fusionConfig = { ...this.defaultConfig, ...config };
    const strategy = this.strategies.get(fusionConfig.strategy);

    if (!strategy) {
      throw new Error(`Unknown fusion strategy: ${fusionConfig.strategy}`);
    }

    const startTime = performance.now();
    const result = strategy.fuse(textEmbedding, visualEmbedding);
    const duration = performance.now() - startTime;

    return {
      embedding: result.embedding,
      attentionWeights: result.attentionWeights,
      confidence: result.confidence,
      metadata: {
        strategy: fusionConfig.strategy,
        duration,
        inputDims: {
          text: textEmbedding.length,
          visual: visualEmbedding.length,
        },
        model: result.metadata?.model,
      },
    };
  }

  /**
   * Batch fuse multiple embeddings
   */
  batchFuse(
    embeddings: Array<{ text: Float32Array; visual: Float32Array }>,
    config?: Partial<FusionConfig>
  ): FusionResult[] {
    const fusionConfig = { ...this.defaultConfig, ...config };
    const results: FusionResult[] = [];

    for (const { text, visual } of embeddings) {
      const result = this.fuse(text, visual, fusionConfig);
      results.push(result);
    }

    return results;
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies(): FusionStrategy[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Set default config
   */
  setDefaultConfig(config: Partial<FusionConfig>): void {
    Object.assign(this.defaultConfig, config);
    this.initializeStrategies();
  }

  /**
   * Compare fusion strategies
   */
  compareStrategies(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): Map<FusionStrategy, FusionResult> {
    const results = new Map<FusionStrategy, FusionResult>();

    for (const strategy of this.strategies.keys()) {
      const result = this.fuse(textEmbedding, visualEmbedding, { strategy });
      results.set(strategy, result);
    }

    return results;
  }

  /**
   * Get best strategy for inputs
   */
  getBestStrategy(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): { strategy: FusionStrategy; result: FusionResult } {
    const comparisons = this.compareStrategies(textEmbedding, visualEmbedding);

    let bestStrategy: FusionStrategy = "attention";
    let bestResult: FusionResult = comparisons.get("attention")!;

    for (const [strategy, result] of comparisons) {
      if (result.confidence > bestResult.confidence) {
        bestStrategy = strategy;
        bestResult = result;
      }
    }

    return { strategy: bestStrategy, result: bestResult };
  }
}

// Re-export fusion strategies
export { ConcatFusion } from "./ConcatFusion.js";
export { AttentionFusion } from "./AttentionFusion.js";
export { TransformerFusion } from "./TransformerFusion.js";
export { GatingFusion } from "./GatingFusion.js";
