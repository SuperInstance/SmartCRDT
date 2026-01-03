/**
 * @lsi/vljepa/predictor/PredictionHead - Neural Network for Prediction
 *
 * Implements the prediction network that transforms combined embeddings
 * into goal state embeddings.
 *
 * Architecture:
 * - Input projection (1536/768 → 2048)
 * - Activation (GELU/ReLU)
 * - Hidden layer (2048)
 * - Layer normalization
 * - Output projection (2048 → 768)
 *
 * @version 1.0.0
 */

import type { PredictorConfig } from "../protocol.js";
import {
  validateEmbeddingDimension,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_HIDDEN_DIM,
} from "../index.js";

/**
 * Activation function type
 */
export type ActivationFunction = "relu" | "gelu" | "swish" | "tanh";

/**
 * Layer configuration
 */
export interface LayerConfig {
  /** Input dimension */
  inputDim: number;

  /** Output dimension */
  outputDim: number;

  /** Whether to use bias */
  useBias: boolean;

  /** Dropout rate */
  dropout: number;
}

/**
 * PredictionHead configuration
 */
export interface PredictionHeadConfig {
  /** Input dimension */
  inputDim: number;

  /** Hidden dimension */
  hiddenDim: number;

  /** Output dimension */
  outputDim: number;

  /** Number of hidden layers */
  numHiddenLayers: number;

  /** Activation function */
  activation: ActivationFunction;

  /** Dropout rate */
  dropout: number;

  /** Whether to use layer normalization */
  useLayerNorm: boolean;

  /** Whether to use residual connections */
  useResiduals: boolean;

  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Dense Layer (fully connected)
 *
 * Simple neural network layer for the predictor.
 * In production, this would use WebGPU-accelerated matrix operations.
 */
class DenseLayer {
  private weights: Float32Array;
  private bias: Float32Array | null;
  private inputDim: number;
  private outputDim: number;

  constructor(
    inputDim: number,
    outputDim: number,
    useBias: boolean = true,
    seed?: number
  ) {
    this.inputDim = inputDim;
    this.outputDim = outputDim;

    // Initialize weights with Xavier/Glorot initialization
    const rng = seed ? this.seededRandom(seed) : Math.random;
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));

    this.weights = new Float32Array(inputDim * outputDim);
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = rng() * scale * 2 - scale;
    }

    this.bias = useBias ? new Float32Array(outputDim) : null;
  }

  /**
   * Forward pass
   *
   * @param input - Input tensor
   * @returns Output tensor
   */
  forward(input: Float32Array): Float32Array {
    if (input.length !== this.inputDim) {
      throw new Error(
        `Input dimension mismatch: expected ${this.inputDim}, got ${input.length}`
      );
    }

    const output = new Float32Array(this.outputDim);

    // Matrix multiplication: output = input * weights + bias
    for (let outIdx = 0; outIdx < this.outputDim; outIdx++) {
      let sum = this.bias ? this.bias[outIdx] : 0;
      for (let inIdx = 0; inIdx < this.inputDim; inIdx++) {
        sum += input[inIdx] * this.weights[inIdx * this.outputDim + outIdx];
      }
      output[outIdx] = sum;
    }

    return output;
  }

  /**
   * Get weights
   *
   * @returns Copy of weights
   */
  getWeights(): Float32Array {
    return new Float32Array(this.weights);
  }

  /**
   * Set weights
   *
   * @param weights - New weights
   */
  setWeights(weights: Float32Array): void {
    if (weights.length !== this.weights.length) {
      throw new Error(`Weights dimension mismatch`);
    }
    this.weights.set(weights);
  }

  /**
   * Get bias
   *
   * @returns Copy of bias or null
   */
  getBias(): Float32Array | null {
    return this.bias ? new Float32Array(this.bias) : null;
  }

  /**
   * Set bias
   *
   * @param bias - New bias
   */
  setBias(bias: Float32Array): void {
    if (!this.bias) {
      throw new Error("This layer does not use bias");
    }
    if (bias.length !== this.bias.length) {
      throw new Error(`Bias dimension mismatch`);
    }
    this.bias.set(bias);
  }

  /**
   * Seeded random number generator
   *
   * @param seed - Random seed
   * @returns Random function
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }
}

/**
 * Layer Normalization
 *
 * Normalizes across features for stable training.
 */
class LayerNorm {
  private gamma: Float32Array; // Scale
  private beta: Float32Array; // Shift
  private dim: number;
  private epsilon: number = 1e-5;

  constructor(dim: number, seed?: number) {
    this.dim = dim;

    // Initialize gamma to 1, beta to 0
    this.gamma = new Float32Array(dim).fill(1.0);
    this.beta = new Float32Array(dim).fill(0.0);
  }

  /**
   * Forward pass
   *
   * @param input - Input tensor
   * @returns Normalized tensor
   */
  forward(input: Float32Array): Float32Array {
    if (input.length !== this.dim) {
      throw new Error(
        `Input dimension mismatch: expected ${this.dim}, got ${input.length}`
      );
    }

    // Compute mean
    let mean = 0;
    for (let i = 0; i < this.dim; i++) {
      mean += input[i];
    }
    mean /= this.dim;

    // Compute variance
    let variance = 0;
    for (let i = 0; i < this.dim; i++) {
      const diff = input[i] - mean;
      variance += diff * diff;
    }
    variance /= this.dim;

    // Normalize and scale
    const stdDev = Math.sqrt(variance + this.epsilon);
    const output = new Float32Array(this.dim);

    for (let i = 0; i < this.dim; i++) {
      output[i] = this.gamma[i] * ((input[i] - mean) / stdDev) + this.beta[i];
    }

    return output;
  }

  /**
   * Get gamma (scale)
   */
  getGamma(): Float32Array {
    return new Float32Array(this.gamma);
  }

  /**
   * Get beta (shift)
   */
  getBeta(): Float32Array {
    return new Float32Array(this.beta);
  }
}

/**
 * Prediction Head
 *
 * Neural network that transforms combined embeddings into goal state embeddings.
 * Provides embedding-to-embedding prediction (core JEPA innovation).
 *
 * @example
 * ```typescript
 * const head = new PredictionHead({
 *   inputDim: 1536,
 *   hiddenDim: 2048,
 *   outputDim: 768,
 *   activation: "gelu",
 *   numHiddenLayers: 2,
 *   dropout: 0.1,
 *   useLayerNorm: true,
 *   useResiduals: false,
 * });
 *
 * const goalEmbedding = await head.forward(combinedEmbedding);
 * ```
 */
export class PredictionHead {
  private config: PredictionHeadConfig;
  private layers: DenseLayer[];
  private layerNorms: LayerNorm[];
  private dropoutMask: Float32Array | null = null;

  // Random number generator
  private rng: () => number;

  constructor(config: PredictionHeadConfig) {
    this.config = config;
    this.rng =
      config.seed !== undefined ? this.seededRandom(config.seed) : Math.random;

    this.layers = [];
    this.layerNorms = [];

    // Build network layers
    this.buildNetwork();
  }

  /**
   * Build network layers
   */
  private buildNetwork(): void {
    const { inputDim, hiddenDim, outputDim, numHiddenLayers, useLayerNorm } =
      this.config;

    // Input projection
    let seed = this.config.seed;
    this.layers.push(new DenseLayer(inputDim, hiddenDim, true, seed));
    if (useLayerNorm) {
      this.layerNorms.push(new LayerNorm(hiddenDim, seed));
      seed = seed !== undefined ? seed + 1 : undefined;
    }

    // Hidden layers
    let currentDim = hiddenDim;
    for (let i = 0; i < numHiddenLayers - 1; i++) {
      this.layers.push(new DenseLayer(currentDim, hiddenDim, true, seed));
      if (useLayerNorm) {
        this.layerNorms.push(new LayerNorm(hiddenDim, seed));
        seed = seed !== undefined ? seed + 1 : undefined;
      }
    }

    // Output projection
    this.layers.push(new DenseLayer(currentDim, outputDim, true, seed));
  }

  /**
   * Forward pass through prediction network
   *
   * @param combinedEmbedding - Combined context + intent embedding
   * @returns Goal embedding (768-dim)
   */
  async forward(combinedEmbedding: Float32Array): Promise<Float32Array> {
    validateEmbeddingDimension(combinedEmbedding, this.config.inputDim);

    let x = combinedEmbedding;

    // Forward through hidden layers
    for (let i = 0; i < this.layers.length - 1; i++) {
      // Linear transformation
      x = this.layers[i].forward(x);

      // Layer normalization
      if (this.config.useLayerNorm && i < this.layerNorms.length) {
        x = this.layerNorms[i].forward(x);
      }

      // Activation
      x = this.applyActivation(x, this.config.activation);

      // Dropout (during training)
      if (this.config.dropout > 0 && this.isTraining()) {
        x = this.applyDropout(x);
      }
    }

    // Output layer (no activation)
    x = this.layers[this.layers.length - 1].forward(x);

    return x;
  }

  /**
   * Batch forward pass
   *
   * @param embeddings - Array of combined embeddings
   * @returns Array of goal embeddings
   */
  async forwardBatch(embeddings: Float32Array[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const embedding of embeddings) {
      const result = await this.forward(embedding);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply activation function
   *
   * @param input - Input tensor
   * @param activation - Activation function
   * @returns Activated tensor
   */
  private applyActivation(
    input: Float32Array,
    activation: ActivationFunction
  ): Float32Array {
    const output = new Float32Array(input.length);

    switch (activation) {
      case "relu":
        for (let i = 0; i < input.length; i++) {
          output[i] = Math.max(0, input[i]);
        }
        break;

      case "gelu":
        // GELU: x * Phi(x) where Phi is the CDF of standard normal
        // Approximation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
        for (let i = 0; i < input.length; i++) {
          const x = input[i];
          const tanhArg = Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x);
          output[i] = 0.5 * x * (1 + Math.tanh(tanhArg));
        }
        break;

      case "swish":
        // Swish: x * sigmoid(x)
        for (let i = 0; i < input.length; i++) {
          const x = input[i];
          const sigmoid = 1 / (1 + Math.exp(-x));
          output[i] = x * sigmoid;
        }
        break;

      case "tanh":
        for (let i = 0; i < input.length; i++) {
          output[i] = Math.tanh(input[i]);
        }
        break;

      default:
        throw new Error(`Unknown activation: ${activation}`);
    }

    return output;
  }

  /**
   * Apply dropout
   *
   * @param input - Input tensor
   * @returns Tensor with dropout applied
   */
  private applyDropout(input: Float32Array): Float32Array {
    const keepProb = 1 - this.config.dropout;
    const output = new Float32Array(input.length);

    for (let i = 0; i < input.length; i++) {
      if (this.rng() < keepProb) {
        output[i] = input[i] / keepProb; // Scale to maintain expected value
      } else {
        output[i] = 0;
      }
    }

    return output;
  }

  /**
   * Check if in training mode
   *
   * @returns Whether in training mode
   */
  private isTraining(): boolean {
    // For now, always inference mode
    // In production, this would be a configurable property
    return false;
  }

  /**
   * Seeded random number generator
   *
   * @param seed - Random seed
   * @returns Random function
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Get number of parameters
   *
   * @returns Total number of trainable parameters
   */
  getParameterCount(): number {
    let count = 0;

    for (const layer of this.layers) {
      const weights = layer.getWeights();
      const bias = layer.getBias();
      count += weights.length;
      count += bias ? bias.length : 0;
    }

    for (const norm of this.layerNorms) {
      count += norm.getGamma().length;
      count += norm.getBeta().length;
    }

    return count;
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): PredictionHeadConfig {
    return { ...this.config };
  }

  /**
   * Create from PredictorConfig
   *
   * @param predictorConfig - Predictor configuration
   * @returns PredictionHead instance
   */
  static fromPredictorConfig(predictorConfig: PredictorConfig): PredictionHead {
    return new PredictionHead({
      inputDim: predictorConfig.inputDim,
      hiddenDim: predictorConfig.hiddenDim,
      outputDim: predictorConfig.outputDim,
      numHiddenLayers: predictorConfig.numLayers,
      activation: (predictorConfig.activation || "gelu") as ActivationFunction,
      dropout: predictorConfig.dropout || 0.1,
      useLayerNorm: true,
      useResiduals: predictorConfig.useResiduals || false,
    });
  }
}
