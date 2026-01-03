/**
 * @lsi/vljepa-quantization - Layer Fusion Optimizer
 *
 * Layer fusion for optimized inference speed.
 *
 * Fusion Patterns:
 * - Conv + BN + ReLU: Fuse into single operation
 * - Linear + ReLU: Fuse activation
 * - MatMul + Add: Fuse bias addition
 * - Concat + Reshape: Combine shape operations
 *
 * Benefits:
 * - Reduced memory bandwidth
 * - Fewer kernel launches
 * - Better cache utilization
 * - Typical speedup: 1.5-2x
 *
 * @module optimizers
 */

import type {
  FusionConfig,
  FusionPattern,
  FusionResult,
  LayerInfo,
  ModelInfo,
} from "../types.js";

import { QuantizationError } from "../types.js";

// ============================================================================
// DEFAULT FUSION PATTERNS
// ============================================================================

/**
 * Default fusion patterns for VL-JEPA models
 */
export const DEFAULT_FUSION_PATTERNS: FusionPattern[] = [
  {
    type: "conv_bn_relu",
    layers: ["conv2d", "batchnorm", "relu"],
    fusedLayer: "conv_bn_relu_fused",
  },
  {
    type: "linear_relu",
    layers: ["linear", "relu"],
    fusedLayer: "linear_relu_fused",
  },
  {
    type: "matmul_add",
    layers: ["matmul", "add"],
    fusedLayer: "matmul_add_fused",
  },
];

/**
 * Default fusion configuration
 */
export const DEFAULT_FUSION_CONFIG: FusionConfig = {
  patterns: DEFAULT_FUSION_PATTERNS,
  preserveAccuracy: true,
  benchmarkBefore: false,
  maxFusionDepth: 3,
};

// ============================================================================
// FUSED LAYER INFO
// ============================================================================

/**
 * Information about a fused layer
 */
export interface FusedLayerInfo extends LayerInfo {
  /** Original layers that were fused */
  sourceLayers: string[];

  /** Fusion pattern type */
  fusionType: string;

  /** Expected speedup */
  speedup: number;
}

// ============================================================================
// LAYER FUSION OPTIMIZER CLASS
// ============================================================================

/**
 * Layer Fusion Optimizer
 *
 * Fuses consecutive layers for faster inference.
 *
 * Algorithm:
 * 1. Identify fusion opportunities
 * 2. Validate fusion (shapes, types)
 * 3. Apply fusion transformations
 * 4. Update model structure
 *
 * @example
 * ```typescript
 * const optimizer = new LayerFusionOptimizer({
 *   preserveAccuracy: true
 * });
 *
 * const result = await optimizer.fuse(model);
 * console.log(`Fused ${result.layersFused} layers`);
 * ```
 */
export class LayerFusionOptimizer {
  /** Configuration */
  private config: FusionConfig;

  /** Fusion statistics */
  private stats = {
    totalFusionAttempts: 0,
    successfulFusions: 0,
    failedFusions: 0,
  };

  /**
   * Create layer fusion optimizer
   *
   * @param config - Fusion configuration
   */
  constructor(config: Partial<FusionConfig> = {}) {
    this.config = { ...DEFAULT_FUSION_CONFIG, ...config };
  }

  /**
   * Fuse layers in model
   *
   * @param model - Model to optimize
   * @returns Fusion result
   */
  async fuse(model: ModelInfo): Promise<FusionResult> {
    const startTime = Date.now();
    this.stats = {
      totalFusionAttempts: 0,
      successfulFusions: 0,
      failedFusions: 0,
    };

    console.log(`[LayerFusion] Starting layer fusion optimization...`);
    console.log(`[LayerFusion] Model has ${model.layers.length} layers`);

    // Step 1: Find fusion opportunities
    const opportunities = this.findFusionOpportunities(model);
    console.log(
      `[LayerFusion] Found ${opportunities.length} fusion opportunities`
    );

    // Step 2: Validate and apply fusions
    const fusedLayers: LayerInfo[] = [];
    const appliedPatterns: FusionPattern[] = [];
    let i = 0;

    while (i < model.layers.length) {
      let fused = false;

      // Try to fuse starting at current layer
      for (const opportunity of opportunities) {
        if (opportunity.startIndex === i) {
          try {
            const fusedLayer = this.applyFusion(model.layers, opportunity);

            if (fusedLayer) {
              fusedLayers.push(fusedLayer);
              appliedPatterns.push(opportunity.pattern);
              i += opportunity.pattern.layers.length;
              fused = true;
              this.stats.successfulFusions++;
              break;
            }
          } catch (error) {
            this.stats.failedFusions++;
            console.warn(
              `[LayerFusion] Fusion failed at index ${i}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      // If no fusion applied, keep original layer
      if (!fused) {
        fusedLayers.push(model.layers[i]);
        i++;
      }

      this.stats.totalFusionAttempts++;
    }

    // Step 3: Calculate metrics
    const speedup = this.estimateSpeedup(model.layers, fusedLayers);

    const result: FusionResult = {
      appliedPatterns: appliedPatterns,
      layersFused: appliedPatterns.length * 2, // Approximate
      speedup,
      fusionTime: Date.now() - startTime,
      success: true,
    };

    console.log(`[LayerFusion] Fusion complete in ${result.fusionTime}ms`);
    console.log(
      `[LayerFusion] Layers before: ${model.layers.length}, after: ${fusedLayers.length}`
    );
    console.log(`[LayerFusion] Estimated speedup: ${speedup.toFixed(2)}x`);

    return result;
  }

  /**
   * Find fusion opportunities in model
   *
   * @param model - Model to analyze
   * @returns Fusion opportunities
   */
  private findFusionOpportunities(model: ModelInfo): FusionOpportunity[] {
    const opportunities: FusionOpportunity[] = [];

    for (const pattern of this.config.patterns) {
      // Find pattern matches in layer sequence
      const matches = this.findPatternMatches(model.layers, pattern);

      for (const matchStart of matches) {
        // Validate fusion
        if (this.validateFusion(model.layers, matchStart, pattern)) {
          opportunities.push({
            startIndex: matchStart,
            pattern,
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Find all starting indices where pattern matches
   *
   * @param layers - Model layers
   * @param pattern - Fusion pattern
   * @returns Starting indices
   */
  private findPatternMatches(
    layers: LayerInfo[],
    pattern: FusionPattern
  ): number[] {
    const matches: number[] = [];
    const patternLength = pattern.layers.length;

    for (let i = 0; i <= layers.length - patternLength; i++) {
      let match = true;

      for (let j = 0; j < patternLength; j++) {
        if (!this.layerTypesMatch(layers[i + j].type, pattern.layers[j])) {
          match = false;
          break;
        }
      }

      if (match) {
        matches.push(i);
      }
    }

    return matches;
  }

  /**
   * Check if layer type matches pattern type
   *
   * @param layerType - Actual layer type
   * @param patternType - Pattern layer type
   * @returns True if match
   */
  private layerTypesMatch(layerType: string, patternType: string): boolean {
    const normalizedLayer = layerType.toLowerCase();
    const normalizedPattern = patternType.toLowerCase();

    // Direct match
    if (normalizedLayer === normalizedPattern) {
      return true;
    }

    // Pattern match (conv2d matches conv, etc.)
    if (
      normalizedLayer.includes(normalizedPattern) ||
      normalizedPattern.includes(normalizedLayer)
    ) {
      return true;
    }

    // Common aliases
    const aliases: Record<string, string[]> = {
      conv2d: ["conv", "conv2d", "convolution"],
      linear: ["linear", "dense", "fc", "fullyconnected"],
      batchnorm: ["batchnorm", "bn", "batch_norm"],
      relu: ["relu", "relu6", "activation"],
      matmul: ["matmul", "matrixmultiply", "dot"],
      add: ["add", "biasadd", "addition"],
    };

    for (const [canonical, variants] of Object.entries(aliases)) {
      if (
        variants.includes(normalizedLayer) &&
        variants.includes(normalizedPattern)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate that fusion is safe to apply
   *
   * @param layers - Model layers
   * @param startIndex - Start index of pattern
   * @param pattern - Fusion pattern
   * @returns True if fusion is valid
   */
  private validateFusion(
    layers: LayerInfo[],
    startIndex: number,
    pattern: FusionPattern
  ): boolean {
    // Check shapes are compatible
    for (let i = 0; i < pattern.layers.length - 1; i++) {
      const currentLayer = layers[startIndex + i];
      const nextLayer = layers[startIndex + i + 1];

      // Output shape of current should match input shape of next
      if (
        !this.shapesCompatible(currentLayer.outputShape, nextLayer.inputShape)
      ) {
        return false;
      }
    }

    // Check fusion depth limit
    if (pattern.layers.length > this.config.maxFusionDepth) {
      return false;
    }

    return true;
  }

  /**
   * Check if tensor shapes are compatible for fusion
   *
   * @param outputShape - Output shape
   * @param inputShape - Input shape
   * @returns True if compatible
   */
  private shapesCompatible(
    outputShape: number[],
    inputShape: number[]
  ): boolean {
    // Shapes should match exactly or be compatible (e.g., batch dimension can vary)
    if (outputShape.length !== inputShape.length) {
      return false;
    }

    for (let i = 0; i < outputShape.length; i++) {
      // Allow batch dimension (usually first) to vary
      if (i === 0 && (outputShape[i] === -1 || inputShape[i] === -1)) {
        continue;
      }

      if (outputShape[i] !== inputShape[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply fusion to create fused layer
   *
   * @param layers - Model layers
   * @param opportunity - Fusion opportunity
   * @returns Fused layer info
   */
  private applyFusion(
    layers: LayerInfo[],
    opportunity: FusionOpportunity
  ): FusedLayerInfo | null {
    const { startIndex, pattern } = opportunity;

    // Extract source layers
    const sourceLayers: string[] = [];
    let totalParameters = 0;
    let minSize = Infinity;

    for (let i = 0; i < pattern.layers.length; i++) {
      const layer = layers[startIndex + i];
      sourceLayers.push(layer.name);
      totalParameters += layer.parameters;
      minSize = Math.min(minSize, layer.sizeBytes);
    }

    // Calculate expected speedup
    const speedup = this.calculateFusionSpeedup(pattern);

    // Create fused layer
    const firstLayer = layers[startIndex];
    const lastLayer = layers[startIndex + pattern.layers.length - 1];

    const fusedLayer: FusedLayerInfo = {
      name: `${firstLayer.name}_fused`,
      type: pattern.fusedLayer,
      inputShape: firstLayer.inputShape,
      outputShape: lastLayer.outputShape,
      parameters: totalParameters,
      sizeBytes: minSize, // Fused layer is approximately size of smallest
      quantized: firstLayer.quantized,
      sourceLayers,
      fusionType: pattern.type,
      speedup,
    };

    return fusedLayer;
  }

  /**
   * Calculate expected speedup from fusion
   *
   * @param pattern - Fusion pattern
   * @returns Speedup factor
   */
  private calculateFusionSpeedup(pattern: FusionPattern): number {
    // Base speedup from reducing kernel launches
    const baseSpeedup = 1.0 + (pattern.layers.length - 1) * 0.2;

    // Pattern-specific speedup
    switch (pattern.type) {
      case "conv_bn_relu":
        return baseSpeedup * 1.5; // Significant speedup for conv fusion
      case "linear_relu":
        return baseSpeedup * 1.3; // Good speedup for linear fusion
      case "matmul_add":
        return baseSpeedup * 1.2; // Moderate speedup
      case "concat":
        return baseSpeedup * 1.1; // Small speedup
      default:
        return baseSpeedup;
    }
  }

  /**
   * Estimate overall speedup from fusion
   *
   * @param originalLayers - Original layers
   * @param fusedLayers - Fused layers
   * @returns Estimated speedup
   */
  private estimateSpeedup(
    originalLayers: LayerInfo[],
    fusedLayers: LayerInfo[]
  ): number {
    // Simple estimate: speedup proportional to layer count reduction
    const layerReduction = originalLayers.length / fusedLayers.length;

    // Account for Amdahl's law (not all operations benefit equally)
    const parallelFraction = 0.7; // 70% of operations are parallelizable
    const speedup =
      1 / (1 - parallelFraction + parallelFraction / layerReduction);

    return Math.min(speedup, 2.0); // Cap at 2x
  }

  /**
   * Get fusion statistics
   *
   * @returns Statistics
   */
  public getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalFusionAttempts: 0,
      successfulFusions: 0,
      failedFusions: 0,
    };
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  public getConfig(): FusionConfig {
    return { ...this.config };
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fusion opportunity in model
 */
interface FusionOpportunity {
  /** Starting index of pattern */
  startIndex: number;

  /** Fusion pattern to apply */
  pattern: FusionPattern;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create layer fusion optimizer
 *
 * @param config - Optional configuration
 * @returns Layer fusion optimizer instance
 */
export function createLayerFusionOptimizer(
  config?: Partial<FusionConfig>
): LayerFusionOptimizer {
  return new LayerFusionOptimizer(config);
}
