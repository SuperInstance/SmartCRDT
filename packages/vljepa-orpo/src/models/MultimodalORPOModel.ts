/**
 * @lsi/vljepa-orpo - Multimodal ORPO Model
 *
 * Combines VL-JEPA with ORPO for multimodal preference learning.
 * Uses VL-JEPA's visual embeddings as input to an ORPO preference head.
 *
 * Architecture:
 * - VL-JEPA Base: Pre-trained vision encoder (X-Encoder)
 * - Preference Head: MLP/Attention head for preference scoring
 * - Reference Model: Frozen copy for reference logits
 *
 * @module models
 */

import type {
  MultimodalORPOConfig,
  PreferenceHeadConfig,
  ORPOForwardResult,
  UIState,
} from "../types.js";

/**
 * Activation function types
 */
type ActivationFunction = "relu" | "gelu" | "swish";

/**
 * Preference head types
 */
type PreferenceHeadType = "mlp" | "attention" | "transformer";

/**
 * Neural network layer
 */
interface Layer {
  /** Layer weights */
  weights: Float32Array;
  /** Layer biases */
  biases: Float32Array;
  /** Output dimension */
  outDim: number;
}

/**
 * Multi-layer perceptron (MLP) layer
 */
class MLPLayer {
  private weights: Float32Array;
  private biases: Float32Array;
  private activation: ActivationFunction;
  private useLayerNorm: boolean;
  private gamma?: Float32Array;
  private beta?: Float32Array;

  constructor(
    inDim: number,
    outDim: number,
    activation: ActivationFunction,
    useLayerNorm: boolean = true
  ) {
    // Initialize weights using Xavier/Glorot initialization
    const scale = Math.sqrt(2.0 / (inDim + outDim));
    this.weights = new Float32Array(inDim * outDim);
    this.biases = new Float32Array(outDim);

    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = (Math.random() * 2 - 1) * scale;
    }

    for (let i = 0; i < this.biases.length; i++) {
      this.biases[i] = 0;
    }

    this.activation = activation;
    this.useLayerNorm = useLayerNorm;

    if (useLayerNorm) {
      this.gamma = new Float32Array(outDim).fill(1);
      this.beta = new Float32Array(outDim).fill(0);
    }
  }

  /**
   * Forward pass through MLP layer
   */
  forward(input: Float32Array): Float32Array {
    const outDim = this.biases.length;
    const output = new Float32Array(outDim);

    // Linear transformation: output = input * weights + biases
    for (let i = 0; i < outDim; i++) {
      let sum = this.biases[i];
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * this.weights[j * outDim + i];
      }
      output[i] = sum;
    }

    // Layer normalization
    if (this.useLayerNorm && this.gamma && this.beta) {
      const mean = output.reduce((a, b) => a + b, 0) / outDim;
      const variance = output.reduce((a, b) => a + (b - mean) ** 2, 0) / outDim;
      const std = Math.sqrt(variance + 1e-5);

      for (let i = 0; i < outDim; i++) {
        output[i] = this.gamma[i] * ((output[i] - mean) / std) + this.beta[i];
      }
    }

    // Activation function
    for (let i = 0; i < outDim; i++) {
      output[i] = this.applyActivation(output[i]);
    }

    return output;
  }

  /**
   * Apply activation function
   */
  private applyActivation(x: number): number {
    switch (this.activation) {
      case "relu":
        return Math.max(0, x);
      case "gelu":
        return (
          0.5 *
          x *
          (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)))
        );
      case "swish":
        return x / (1 + Math.exp(-x));
      default:
        return x;
    }
  }

  /**
   * Get layer parameters
   */
  getParameters(): { weights: Float32Array; biases: Float32Array } {
    return {
      weights: this.weights,
      biases: this.biases,
    };
  }

  /**
   * Set layer parameters
   */
  setParameters(params: { weights: Float32Array; biases: Float32Array }): void {
    if (params.weights.length !== this.weights.length) {
      throw new Error("Weight dimension mismatch");
    }
    if (params.biases.length !== this.biases.length) {
      throw new Error("Bias dimension mismatch");
    }

    this.weights.set(params.weights);
    this.biases.set(params.biases);
  }
}

/**
 * Preference Head
 *
 * Neural network head that takes VL-JEPA embeddings as input
 * and outputs a preference score.
 */
export class PreferenceHead {
  private layers: MLPLayer[];
  private config: PreferenceHeadConfig;
  private inputDim: number;
  private dropout: number;

  constructor(inputDim: number, config: PreferenceHeadConfig) {
    this.inputDim = inputDim;
    this.config = config;
    this.dropout = config.dropout;
    this.layers = [];

    // Build layers based on configuration
    const hiddenDims = config.hiddenDims;
    let prevDim = inputDim;

    for (const dim of hiddenDims) {
      this.layers.push(
        new MLPLayer(prevDim, dim, config.activation, config.useLayerNorm)
      );
      prevDim = dim;
    }
  }

  /**
   * Forward pass through preference head
   * Returns a scalar preference score
   */
  forward(input: Float32Array, applyDropout: boolean = false): number {
    let current = input;

    for (let i = 0; i < this.layers.length; i++) {
      current = this.layers[i].forward(current);

      // Apply dropout (except for last layer)
      if (applyDropout && i < this.layers.length - 1) {
        for (let j = 0; j < current.length; j++) {
          if (Math.random() < this.dropout) {
            current[j] = 0;
          } else {
            current[j] /= 1 - this.dropout;
          }
        }
      }
    }

    // Output is a single scalar (preference score)
    return current[0];
  }

  /**
   * Get all layer parameters
   */
  getParameters(): { weights: Float32Array; biases: Float32Array }[] {
    return this.layers.map(layer => layer.getParameters());
  }

  /**
   * Set all layer parameters
   */
  setParameters(
    params: { weights: Float32Array; biases: Float32Array }[]
  ): void {
    if (params.length !== this.layers.length) {
      throw new Error("Parameter count mismatch");
    }

    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].setParameters(params[i]);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): PreferenceHeadConfig {
    return { ...this.config };
  }
}

/**
 * Reference Model
 *
 * Frozen copy of the base model for computing reference logits in ORPO.
 * Uses EMA (Exponential Moving Average) updates for stability.
 */
export class ReferenceModel {
  private preferenceHead: PreferenceHead;
  private frozen: boolean;
  private emaDecay: number;

  constructor(preferenceHead: PreferenceHead, frozen: boolean = true) {
    this.preferenceHead = preferenceHead;
    this.frozen = frozen;
    this.emaDecay = 0.999;
  }

  /**
   * Forward pass through reference model
   */
  forward(input: Float32Array): number {
    return this.preferenceHead.forward(input, false);
  }

  /**
   * Update reference model with current model parameters (EMA)
   * Only called if model is not frozen
   */
  update(
    currentParams: { weights: Float32Array; biases: Float32Array }[]
  ): void {
    if (this.frozen) {
      return;
    }

    const refParams = this.preferenceHead.getParameters();

    for (let i = 0; i < currentParams.length; i++) {
      const currentWeights = currentParams[i].weights;
      const currentBiases = currentParams[i].biases;
      const refWeights = refParams[i].weights;
      const refBiases = refParams[i].biases;

      // EMA update: ref = decay * ref + (1 - decay) * current
      for (let j = 0; j < currentWeights.length; j++) {
        refWeights[j] =
          this.emaDecay * refWeights[j] +
          (1 - this.emaDecay) * currentWeights[j];
      }

      for (let j = 0; j < currentBiases.length; j++) {
        refBiases[j] =
          this.emaDecay * refBiases[j] + (1 - this.emaDecay) * currentBiases[j];
      }

      refParams[i].weights.set(refWeights);
      refParams[i].biases.set(refBiases);
    }

    this.preferenceHead.setParameters(refParams);
  }

  /**
   * Set frozen state
   */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  /**
   * Check if model is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }
}

/**
 * Multimodal ORPO Model
 *
 * Combines VL-JEPA embeddings with ORPO preference optimization.
 *
 * Key Features:
 * - Uses 768-dim VL-JEPA embeddings as input
 * - Preference head outputs scalar scores
 * - Reference model for ORPO loss computation
 * - Supports multiple fusion strategies
 *
 * @example
 * ```typescript
 * const model = new MultimodalORPOModel(config);
 * const result = await model.forward(chosenEmbedding, rejectedEmbedding);
 * console.log(result.logOddsRatio, result.preferenceScore);
 * ```
 */
export class MultimodalORPOModel {
  private preferenceHead: PreferenceHead;
  private referenceModel: ReferenceModel;
  private config: MultimodalORPOConfig;
  private embeddingDim: number;
  private initialized: boolean;

  constructor(config: MultimodalORPOConfig) {
    this.config = config;
    this.embeddingDim = config.baseModel.embeddingDim;
    this.initialized = false;

    // Create preference head
    this.preferenceHead = new PreferenceHead(
      this.embeddingDim * 2, // Chosen + rejected embeddings
      config.preferenceHead
    );

    // Create reference model
    const refPreferenceHead = new PreferenceHead(
      this.embeddingDim * 2,
      config.preferenceHead
    );
    this.referenceModel = new ReferenceModel(
      refPreferenceHead,
      config.referenceModel.frozen
    );
  }

  /**
   * Initialize model
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load pretrained weights if specified
    if (
      this.config.baseModel.usePretrained &&
      this.config.baseModel.weightsPath
    ) {
      await this.loadWeights(this.config.baseModel.weightsPath);
    }

    this.initialized = true;
  }

  /**
   * Forward pass for a single preference pair
   *
   * Computes:
   * - Chosen and rejected logits
   * - Reference logits for ORPO loss
   * - Log odds ratio
   * - Preference score
   */
  async forward(
    chosenEmbedding: Float32Array,
    rejectedEmbedding: Float32Array
  ): Promise<ORPOForwardResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate embedding dimensions
    if (chosenEmbedding.length !== this.embeddingDim) {
      throw new Error(
        `Invalid chosen embedding dimension: ${chosenEmbedding.length}, expected ${this.embeddingDim}`
      );
    }
    if (rejectedEmbedding.length !== this.embeddingDim) {
      throw new Error(
        `Invalid rejected embedding dimension: ${rejectedEmbedding.length}, expected ${this.embeddingDim}`
      );
    }

    // Fuse embeddings based on strategy
    const chosenInput = this.fuseEmbeddings(
      chosenEmbedding,
      rejectedEmbedding,
      "chosen"
    );
    const rejectedInput = this.fuseEmbeddings(
      chosenEmbedding,
      rejectedEmbedding,
      "rejected"
    );

    // Compute logits from current model
    const chosenLogit = this.preferenceHead.forward(chosenInput, true);
    const rejectedLogit = this.preferenceHead.forward(rejectedInput, true);

    // Compute reference logits
    const refChosenLogit = this.referenceModel.forward(chosenInput);
    const refRejectedLogit = this.referenceModel.forward(rejectedInput);

    // Compute log odds ratio
    const logOddsRatio = this.computeLogOddsRatio(chosenLogit, rejectedLogit);
    const refLogOddsRatio = this.computeLogOddsRatio(
      refChosenLogit,
      refRejectedLogit
    );

    // Compute preference score (sigmoid of log odds ratio)
    const preferenceScore = this.sigmoid(logOddsRatio);

    // Compute losses
    const sftLoss = -chosenLogit; // SFT loss: maximize chosen logit
    const orpoLoss = this.computeORPOLoss(logOddsRatio, refLogOddsRatio);
    const totalLoss =
      this.config.orpo.sftLossWeight * sftLoss +
      this.config.orpo.lambda * orpoLoss;

    return {
      chosenLogits: new Float32Array([chosenLogit]),
      rejectedLogits: new Float32Array([rejectedLogit]),
      referenceChosenLogits: new Float32Array([refChosenLogit]),
      referenceRejectedLogits: new Float32Array([refRejectedLogit]),
      logOddsRatio,
      preferenceScore,
      sftLoss,
      orpoLoss,
      totalLoss,
    };
  }

  /**
   * Batch forward pass
   */
  async forwardBatch(
    chosenEmbeddings: Float32Array[],
    rejectedEmbeddings: Float32Array[]
  ): Promise<ORPOForwardResult[]> {
    const results: ORPOForwardResult[] = [];

    for (let i = 0; i < chosenEmbeddings.length; i++) {
      results.push(
        await this.forward(chosenEmbeddings[i], rejectedEmbeddings[i])
      );
    }

    return results;
  }

  /**
   * Fuse embeddings based on strategy
   */
  private fuseEmbeddings(
    chosen: Float32Array,
    rejected: Float32Array,
    type: "chosen" | "rejected"
  ): Float32Array {
    const fusion = this.config.multimodal.fusion;
    const target = type === "chosen" ? chosen : rejected;
    const other = type === "chosen" ? rejected : chosen;

    switch (fusion) {
      case "concat":
        // Concatenate chosen and rejected
        const result = new Float32Array(chosen.length + rejected.length);
        result.set(target);
        result.set(other, chosen.length);
        return result;

      case "add":
        // Weighted sum
        const v = this.config.multimodal.visualWeight;
        const t = this.config.multimodal.textWeight;
        const weighted = new Float32Array(target.length);
        for (let i = 0; i < target.length; i++) {
          weighted[i] = v * target[i] + t * other[i];
        }
        return weighted;

      case "attention":
        // Attention-based fusion (simplified)
        return this.attentionFusion(target, other);

      default:
        throw new Error(`Unknown fusion strategy: ${fusion}`);
    }
  }

  /**
   * Attention-based fusion
   */
  private attentionFusion(a: Float32Array, b: Float32Array): Float32Array {
    // Simplified attention: weighted by similarity
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    const similarity = dotProduct / (normA * normB + 1e-8);

    const alpha = this.sigmoid(similarity);
    const result = new Float32Array(a.length);

    for (let i = 0; i < a.length; i++) {
      result[i] = alpha * a[i] + (1 - alpha) * b[i];
    }

    return result;
  }

  /**
   * Compute log odds ratio
   */
  private computeLogOddsRatio(
    chosenLogit: number,
    rejectedLogit: number
  ): number {
    return chosenLogit - rejectedLogit;
  }

  /**
   * Compute ORPO loss
   *
   * L_ORPO = -log(σ(β * (log_odds_chosen - log_odds_rejected)))
   */
  private computeORPOLoss(
    logOddsRatio: number,
    refLogOddsRatio: number
  ): number {
    const beta = this.config.orpo.beta;
    const diff = logOddsRatio - refLogOddsRatio;
    const sigmoidValue = this.sigmoid(beta * diff);
    const clippedSigmoid = Math.max(sigmoidValue, 1e-10);
    return -Math.log(clippedSigmoid);
  }

  /**
   * Sigmoid function
   */
  private sigmoid(x: number): number {
    const clippedX = Math.max(-50, Math.min(50, x));
    return 1 / (1 + Math.exp(-clippedX));
  }

  /**
   * Update reference model
   */
  updateReferenceModel(): void {
    this.referenceModel.update(this.preferenceHead.getParameters());
  }

  /**
   * Get model parameters
   */
  getParameters(): { weights: Float32Array; biases: Float32Array }[] {
    return this.preferenceHead.getParameters();
  }

  /**
   * Set model parameters
   */
  setParameters(
    params: { weights: Float32Array; biases: Float32Array }[]
  ): void {
    this.preferenceHead.setParameters(params);
  }

  /**
   * Load weights from file
   */
  private async loadWeights(path: string): Promise<void> {
    // TODO: Implement actual weight loading
    console.log(`Loading weights from ${path}`);
  }

  /**
   * Save weights to file
   */
  async saveWeights(path: string): Promise<void> {
    // TODO: Implement actual weight saving
    console.log(`Saving weights to ${path}`);
  }

  /**
   * Get configuration
   */
  getConfig(): MultimodalORPOConfig {
    return { ...this.config };
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDim(): number {
    return this.embeddingDim;
  }
}

/**
 * Create a multimodal ORPO model
 */
export async function createMultimodalORPOModel(
  config: Partial<MultimodalORPOConfig> = {}
): Promise<MultimodalORPOModel> {
  const defaultConfig = {
    baseModel: {
      embeddingDim: 768,
      usePretrained: true,
    },
    referenceModel: {
      enabled: true,
      frozen: true,
    },
    preferenceHead: {
      type: "mlp",
      hiddenDims: [1536, 768, 384, 1],
      activation: "gelu",
      dropout: 0.1,
      useLayerNorm: true,
      useResiduals: true,
    },
    orpo: {
      beta: 0.1,
      lambda: 1.0,
      sftLossWeight: 1.0,
    },
    training: {
      learningRate: 2e-4,
      batchSize: 8,
      epochs: 3,
      warmupRatio: 0.1,
      gradientClipping: 1.0,
      weightDecay: 0.01,
    },
    multimodal: {
      visualWeight: 0.5,
      textWeight: 0.5,
      fusion: "concat",
    },
  };

  const mergedConfig = { ...defaultConfig, ...config } as MultimodalORPOConfig;

  const model = new MultimodalORPOModel(mergedConfig);
  await model.initialize();

  return model;
}
