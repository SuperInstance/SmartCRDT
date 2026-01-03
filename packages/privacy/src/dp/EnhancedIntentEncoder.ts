/**
 * Enhanced IntentEncoder with Full ε-Differential Privacy Support
 *
 * Extends the base IntentEncoder with comprehensive differential privacy
 * features including:
 * - Multiple noise mechanisms (Laplace, Gaussian)
 * - Privacy budget tracking with composition
 * - Utility analysis and recommendations
 * - Privacy auditing and verification
 *
 * @module dp/encoder
 */

import type {
  IntentEncoderDP,
  IntentVectorDP,
  IntentEncoderConfigDP,
  PrivacyBudget,
  PrivacyAccounting,
  INoiseMechanism,
  UtilityLoss,
  PrivacyGuarantee,
  CompositionType,
  PrivacyCost,
} from "@lsi/protocol";
import {
  NoiseMechanismType as NoiseType,
  CompositionType as CompType,
} from "@lsi/protocol";
import { OpenAIEmbeddingService } from "@lsi/embeddings";
import { NoiseMechanismFactory } from "./NoiseMechanisms.js";
import { PrivacyBudgetTracker } from "./PrivacyBudgetTracker.js";
import { UtilityAnalyzer } from "./UtilityAnalyzer.js";
import { PrivacyAuditor } from "./PrivacyAuditor.js";

/**
 * Enhanced IntentEncoder implementation
 *
 * Provides formal ε-differential privacy guarantees with comprehensive
 * privacy accounting and utility analysis.
 */
export class EnhancedIntentEncoder implements IntentEncoderDP {
  private openai: OpenAIEmbeddingService;
  private config: Required<IntentEncoderConfigDP>;
  private initialized: boolean = false;

  // Privacy components
  private budgetTracker: PrivacyBudgetTracker;
  private utilityAnalyzer: UtilityAnalyzer;
  private privacyAuditor: PrivacyAuditor;
  private currentMechanism?: INoiseMechanism;

  // PCA transformer (simplified - use proper PCA in production)
  private pcaMatrix: number[][];

  /**
   * Create an enhanced IntentEncoder
   *
   * @param config - Configuration options
   */
  constructor(config: IntentEncoderConfigDP) {
    // Validate configuration
    if (config.epsilon <= 0) {
      throw new Error(`Epsilon must be positive, got ${config.epsilon}`);
    }
    if (config.delta !== undefined && (config.delta < 0 || config.delta >= 1)) {
      throw new Error(`Delta must be in [0, 1), got ${config.delta}`);
    }

    // Set defaults
    this.config = {
      openaiKey: config.openaiKey || process.env.OPENAI_API_KEY || "",
      baseURL: config.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      epsilon: config.epsilon,
      delta: config.delta ?? 0,
      outputDimensions: config.outputDimensions ?? 768,
      pcaMatrix: config.pcaMatrix ?? [],
      timeout: config.timeout ?? 30000,
      noiseMechanism: config.noiseMechanism ?? NoiseType.LAPLACE,
      compositionType: config.compositionType ?? CompType.SEQUENTIAL,
      sensitivity: config.sensitivity ?? 2.0,
      maxPrivacyBudget: config.maxPrivacyBudget ?? Infinity,
      trackPrivacy: config.trackPrivacy ?? true,
      warnOnBudgetExhausted: config.warnOnBudgetExhausted ?? true,
      throwOnBudgetExhausted: config.throwOnBudgetExhausted ?? false,
      seed: config.seed ?? Math.random(),
    };

    // Initialize OpenAI embedding service
    this.openai = new OpenAIEmbeddingService({
      apiKey: this.config.openaiKey,
      baseURL: this.config.baseURL,
      model: "text-embedding-3-small",
      dimensions: 1536,
      timeout: this.config.timeout,
      enableFallback: true,
    });

    // Initialize PCA matrix (simple projection - use proper PCA in production)
    this.pcaMatrix = this.config.pcaMatrix.length > 0
      ? this.config.pcaMatrix
      : this.createSimpleProjection();

    // Initialize privacy components
    this.budgetTracker = new PrivacyBudgetTracker(
      this.config.maxPrivacyBudget,
      this.config.delta,
      this.config.compositionType,
      this.config.trackPrivacy
    );

    this.utilityAnalyzer = new UtilityAnalyzer(
      this.config.sensitivity,
      1.0 // Signal magnitude
    );

    this.privacyAuditor = new PrivacyAuditor();

    // Create initial noise mechanism
    this.updateNoiseMechanism();
  }

  /**
   * Initialize the encoder
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.openai.initialize();
    this.initialized = true;
  }

  /**
   * Encode a single query as an intent vector
   *
   * @param query - Text query to encode
   * @param options - Encoding options
   */
  async encode(
    query: string,
    options?: { epsilon?: number; delta?: number }
  ): Promise<IntentVectorDP> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate input
    if (!query || typeof query !== "string") {
      throw new Error("Query must be a non-empty string");
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new Error("Query must not be empty");
    }

    const startTime = Date.now();

    // Use provided epsilon or default
    const epsilon = options?.epsilon ?? this.config.epsilon;
    const delta = options?.delta ?? this.config.delta;

    // Update mechanism if parameters changed
    if (epsilon !== this.config.epsilon || delta !== this.config.delta) {
      this.updateNoiseMechanism(epsilon, delta);
    }

    // Step 1: Generate OpenAI embedding (1536-dim)
    const embeddingResult = await this.openai.embed(trimmed);
    const embedding = embeddingResult.embedding;

    // Step 2: Apply PCA dimensionality reduction (1536 → 768)
    const reduced = this.applyPCA(embedding);

    // Step 3: Add noise for ε-differential privacy
    const noisy = this.currentMechanism!.addNoiseVector(reduced);

    // Step 4: L2-normalize to unit sphere
    const normalized = this.normalize(noisy);

    // Step 5: Track privacy cost
    const cost: PrivacyCost = {
      epsilon,
      delta,
      mechanism: this.config.noiseMechanism,
      sensitivity: this.config.sensitivity,
      timestamp: Date.now(),
    };

    if (this.config.trackPrivacy) {
      this.budgetTracker.spend(cost);
    }

    // Step 6: Compute utility loss and guarantee
    const utilityLoss = this.currentMechanism!.estimateUtilityLoss(1.0);
    const guarantee = this.currentMechanism!.verifyGuarantee();

    // Step 7: Audit the operation
    this.privacyAuditor.auditOperation(
      `encode_${Date.now()}`,
      cost,
      this.config.noiseMechanism,
      this.config.sensitivity
    );

    const latency = Date.now() - startTime;

    return {
      vector: normalized,
      epsilon,
      delta,
      mechanism: this.config.noiseMechanism,
      sensitivity: this.config.sensitivity,
      noiseMultiplier: this.currentMechanism!.getNoiseMultiplier(),
      model: embeddingResult.model,
      latency,
      satisfiesDP: guarantee.satisfiesDP,
      utilityLoss,
      guarantee,
      accounting: this.config.trackPrivacy ? this.budgetTracker.getAccounting() : undefined,
    };
  }

  /**
   * Encode multiple queries with composition tracking
   *
   * @param queries - Array of queries to encode
   * @param options - Encoding options
   */
  async encodeBatch(
    queries: string[],
    options?: {
      epsilon?: number;
      delta?: number;
      compositionType?: CompositionType;
    }
  ): Promise<IntentVectorDP[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!Array.isArray(queries) || queries.length === 0) {
      return [];
    }

    // Update composition type if specified
    if (options?.compositionType) {
      this.budgetTracker = new PrivacyBudgetTracker(
        this.config.maxPrivacyBudget,
        this.config.delta,
        options.compositionType,
        this.config.trackPrivacy
      );
    }

    // Encode each query
    const results: IntentVectorDP[] = [];
    for (const query of queries) {
      const intent = await this.encode(query, {
        epsilon: options?.epsilon,
        delta: options?.delta,
      });
      results.push(intent);
    }

    return results;
  }

  /**
   * Shutdown and release resources
   */
  async shutdown(): Promise<void> {
    await this.openai.shutdown();
    this.initialized = false;
  }

  /**
   * Get current privacy budget state
   */
  getPrivacyBudget(): PrivacyBudget {
    return this.budgetTracker.budget;
  }

  /**
   * Get complete privacy accounting
   */
  getPrivacyAccounting(): PrivacyAccounting {
    return this.budgetTracker.getAccounting();
  }

  /**
   * Reset privacy budget
   */
  resetPrivacyBudget(): void {
    this.budgetTracker.reset();
  }

  /**
   * Set privacy budget
   */
  setPrivacyBudget(epsilon: number, delta?: number): void {
    this.budgetTracker = new PrivacyBudgetTracker(
      epsilon,
      delta ?? this.config.delta,
      this.config.compositionType,
      this.config.trackPrivacy
    );
  }

  /**
   * Get noise mechanism
   */
  getNoiseMechanism(): INoiseMechanism {
    if (!this.currentMechanism) {
      this.updateNoiseMechanism();
    }
    return this.currentMechanism!;
  }

  /**
   * Estimate utility loss for given epsilon
   */
  estimateUtilityLoss(epsilon: number, signalMagnitude: number): UtilityLoss {
    const mechanism = NoiseMechanismFactory.create(
      this.config.noiseMechanism,
      epsilon,
      this.config.sensitivity,
      this.config.delta,
      this.config.seed
    );
    return mechanism.estimateUtilityLoss(signalMagnitude);
  }

  /**
   * Verify privacy guarantees
   */
  verifyPrivacyGuarantee(epsilon: number, delta?: number): PrivacyGuarantee {
    const mechanism = NoiseMechanismFactory.create(
      this.config.noiseMechanism,
      epsilon,
      this.config.sensitivity,
      delta ?? this.config.delta,
      this.config.seed
    );
    return mechanism.verifyGuarantee();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Update noise mechanism with current parameters
   */
  private updateNoiseMechanism(epsilon?: number, delta?: number): void {
    const eps = epsilon ?? this.config.epsilon;
    const del = delta ?? this.config.delta;

    this.currentMechanism = NoiseMechanismFactory.create(
      this.config.noiseMechanism,
      eps,
      this.config.sensitivity,
      del,
      this.config.seed
    );
  }

  /**
   * Apply PCA dimensionality reduction
   *
   * Simple projection from 1536 to 768 dimensions.
   * In production, use a proper pre-trained PCA matrix.
   */
  private applyPCA(embedding: Float32Array): Float32Array {
    const outputDim = this.config.outputDimensions;
    const result = new Float32Array(outputDim);

    for (let i = 0; i < outputDim; i++) {
      let sum = 0;
      const row = this.pcaMatrix[i];
      if (row) {
        for (let j = 0; j < embedding.length; j++) {
          sum += row[j] * embedding[j];
        }
      }
      result[i] = sum;
    }

    return result;
  }

  /**
   * L2-normalize a vector to unit sphere
   */
  private normalize(vector: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm < 1e-10) {
      // Return uniform vector if norm is too small
      const result = new Float32Array(vector.length);
      const value = 1 / Math.sqrt(vector.length);
      for (let i = 0; i < vector.length; i++) {
        result[i] = value;
      }
      return result;
    }

    const result = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i] / norm;
    }

    return result;
  }

  /**
   * Create a simple PCA projection matrix
   *
   * Placeholder for proper pre-trained PCA.
   * In production, this should be replaced with a matrix learned from
   * a corpus of OpenAI embeddings.
   */
  private createSimpleProjection(): number[][] {
    const inputDim = 1536;
    const outputDim = this.config.outputDimensions;
    const matrix: number[][] = [];

    for (let i = 0; i < outputDim; i++) {
      const row: number[] = new Array(inputDim).fill(0);

      // Select every other dimension with stride 2
      const sourceIdx = i * 2;
      if (sourceIdx < inputDim) {
        row[sourceIdx] = 1.0;
        if (sourceIdx + 1 < inputDim) {
          row[sourceIdx + 1] = 0.1;
        }
        if (sourceIdx - 1 >= 0) {
          row[sourceIdx - 1] = 0.1;
        }
      }

      // Normalize row
      const norm = Math.sqrt(row.reduce((sum, v) => sum + v * v, 0));
      if (norm > 0) {
        for (let j = 0; j < inputDim; j++) {
          row[j] /= norm;
        }
      }

      matrix.push(row);
    }

    return matrix;
  }
}
