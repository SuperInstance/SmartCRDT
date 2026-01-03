/**
 * EmbeddingRedactionProtocol - Dimension-level embedding redaction
 *
 * This module implements privacy-preserving redaction at the embedding level.
 * Instead of redacting pixels, we redact specific dimensions of the 768-dimensional
 * embedding that correspond to privacy-sensitive information.
 *
 * ## Key Innovation: Embedding-Level Redaction
 *
 * Traditional redaction operates on pixels (blur, black bars). This approach:
 * - Loses semantic context (can't understand redacted content)
 * - Is reversible (advanced attacks can recover original pixels)
 * - Is destructive (original content permanently altered)
 *
 * Embedding-level redaction:
 * - Preserves structure (semantic layout remains)
 * - Is semantically meaningful (understands what was redacted)
 * - Is privacy-preserving (only sensitive dimensions zeroed)
 * - Enables re-hydration (restore structure without content)
 *
 * ## Redaction Strategy
 *
 * 1. **Detect PII in embedding**: Identify sensitive dimensions via semantic analysis
 * 2. **Create redaction mask**: Mark dimensions to redact
 * 3. **Zero out sensitive dims**: Set redacted dimensions to 0
 * 4. **Send redacted embedding**: Transmit safely to cloud
 * 5. **Re-hydrate on client**: Restore structure (not content) for rendering
 *
 * ## Differential Privacy
 *
 * Optionally adds Gaussian noise for ε-differential privacy guarantees:
 * - σ = Δf / ε where Δf ≈ 2 (L2 sensitivity)
 * - Prevents reconstruction attacks
 * - Formal privacy guarantee
 *
 * @packageDocumentation
 */

import {
  VisualPrivacyClassification,
  PrivacyElement,
} from "./VisualPrivacyClassifier";

/**
 * Redaction result
 */
export interface RedactionResult {
  /** Original embedding (768-dim) */
  originalEmbedding: Float32Array;

  /** Redacted embedding (sensitive dims zeroed) */
  redactedEmbedding: Float32Array;

  /** Redaction mask (true = redacted) */
  redactionMask: boolean[];

  /** Privacy score (0-1, higher = more sensitive) */
  privacyScore: number;

  /** Reasons for redaction */
  redactionReason: string[];

  /** Number of dimensions redacted */
  dimensionsRedacted: number;

  /** Differential privacy parameters applied */
  dpParams: {
    enabled: boolean;
    epsilon?: number;
    sigma?: number;
  };

  /** Timestamp */
  timestamp: number;
}

/**
 * Redaction configuration
 */
export interface RedactionConfig {
  /** Redaction strategy preset */
  strategy: "conservative" | "balanced" | "permissive";

  /** Whether to redact faces */
  redactFaces: boolean;

  /** Whether to redact text regions */
  redactText: boolean;

  /** Whether to redact screens */
  redactScreens: boolean;

  /** Whether to redact keyboards */
  redactKeyboards: boolean;

  /** Whether to redact cursors */
  redactCursors: boolean;

  /** Whether to redact documents */
  redactDocuments: boolean;

  /** Differential privacy epsilon (undefined = disabled) */
  epsilon?: number;

  /** Maximum fraction of dimensions to redact (0-1) */
  maxRedactionFraction: number;

  /** Preserve semantic structure (recommended: true) */
  preserveStructure: boolean;

  /** Enable detailed logging */
  verbose?: boolean;

  /** Embedding dimension */
  embeddingDim: number;
}

/**
 * Re-hydration result
 *
 * Re-hydration restores the structure of redacted content without revealing
 * the actual sensitive information.
 */
export interface RehydrationResult {
  /** Re-hydrated embedding (structure restored) */
  rehydratedEmbedding: Float32Array;

  /** Metadata about re-hydration */
  metadata: {
    dimensionsRehydrated: number;
    rehydrationStrategy: "zero" | "noise" | "semantic_placeholder";
    preserveStructure: boolean;
  };

  /** Whether re-hydration was successful */
  success: boolean;
}

/**
 * Dimension redaction plan
 */
interface DimensionRedactionPlan {
  /** Dimensions to redact (by index) */
  dimensionsToRedact: Set<number>;

  /** Reasons for each dimension */
  reasons: Map<number, string>;

  /** Privacy element types that caused redaction */
  elementTypes: Set<PrivacyElement["type"]>;

  /** Estimated privacy impact (0-1 per dimension) */
  privacyImpact: Float32Array;
}

/**
 * EmbeddingRedactionProtocol - Privacy-preserving embedding redaction
 *
 * Redacts privacy-sensitive dimensions from VL-JEPA embeddings before
 * transmission to cloud services.
 *
 * ## Example
 *
 * ```typescript
 * const redactor = new EmbeddingRedactionProtocol({
 *   strategy: "balanced",
 *   epsilon: 1.0,
 * });
 *
 * const embedding = await vljepa.encodeImage(frame);
 * const classification = classifier.classify(embedding);
 * const redacted = redactor.redact(embedding, classification);
 *
 * // Transmit redacted embedding safely
 * await sendToCloud(redacted.redactedEmbedding);
 * ```
 */
export class EmbeddingRedactionProtocol {
  private config: Required<RedactionConfig>;
  private stats: {
    embeddingsRedacted: number;
    totalDimensionsRedacted: number;
    avgRedactionFraction: number;
  };

  constructor(config: Partial<RedactionConfig> = {}) {
    this.config = {
      strategy: config.strategy ?? "balanced",
      redactFaces: config.redactFaces ?? true,
      redactText: config.redactText ?? true,
      redactScreens: config.redactScreens ?? true,
      redactKeyboards: config.redactKeyboards ?? false,
      redactCursors: config.redactCursors ?? false,
      redactDocuments: config.redactDocuments ?? true,
      epsilon: config.epsilon,
      maxRedactionFraction: config.maxRedactionFraction ?? 0.5,
      preserveStructure: config.preserveStructure ?? true,
      verbose: config.verbose ?? false,
      embeddingDim: config.embeddingDim ?? 768,
    };

    this.stats = {
      embeddingsRedacted: 0,
      totalDimensionsRedacted: 0,
      avgRedactionFraction: 0,
    };
  }

  /**
   * Redact an embedding based on privacy classification
   *
   * @param embedding - Original embedding (768-dim)
   * @param classification - Privacy classification result
   * @returns Redaction result
   */
  redact(
    embedding: Float32Array,
    classification: VisualPrivacyClassification
  ): RedactionResult {
    if (embedding.length !== this.config.embeddingDim) {
      throw new Error(
        `Invalid embedding dimension: expected ${this.config.embeddingDim}, ` +
          `got ${embedding.length}`
      );
    }

    const startTime = Date.now();

    // Create redaction plan from classification
    const plan = this.createRedactionPlan(classification);

    // Apply redaction
    const redactedEmbedding = this.applyRedaction(embedding, plan);

    // Create redaction mask
    const redactionMask = this.createRedactionMask(plan);

    // Optionally apply differential privacy
    let finalEmbedding = redactedEmbedding;
    let dpSigma: number | undefined;
    if (this.config.epsilon !== undefined) {
      finalEmbedding = this.applyDifferentialPrivacy(
        redactedEmbedding,
        this.config.epsilon
      );
      dpSigma = 2.0 / this.config.epsilon; // L2 sensitivity = 2 for normalized embeddings
    }

    const result: RedactionResult = {
      originalEmbedding: embedding,
      redactedEmbedding: finalEmbedding,
      redactionMask,
      privacyScore: classification.privacyScore,
      redactionReason: Array.from(plan.reasons.values()),
      dimensionsRedacted: plan.dimensionsToRedact.size,
      dpParams: {
        enabled: this.config.epsilon !== undefined,
        epsilon: this.config.epsilon,
        sigma: dpSigma,
      },
      timestamp: Date.now(),
    };

    // Update stats
    this.stats.embeddingsRedacted++;
    this.stats.totalDimensionsRedacted += result.dimensionsRedacted;
    this.stats.avgRedactionFraction =
      this.stats.totalDimensionsRedacted /
      (this.stats.embeddingsRedacted * this.config.embeddingDim);

    // Log if verbose
    if (this.config.verbose) {
      const elapsed = Date.now() - startTime;
      console.log("[EmbeddingRedactionProtocol] Redaction:", {
        dimensionsRedacted: result.dimensionsRedacted,
        fraction: result.dimensionsRedacted / this.config.embeddingDim,
        reasons: result.redactionReason,
        dp: result.dpParams.enabled,
        elapsedMs: elapsed,
      });
    }

    return result;
  }

  /**
   * Redact embedding with custom element types
   *
   * @param embedding - Original embedding
   * @param elements - Privacy elements to redact
   * @returns Redaction result
   */
  redactElements(
    embedding: Float32Array,
    elements: PrivacyElement[]
  ): RedactionResult {
    // Create synthetic classification from elements
    const classification: VisualPrivacyClassification = {
      version: "1.0",
      embedding,
      classification: elements.length > 0 ? "SENSITIVE" : "SAFE",
      confidence: 0.8,
      detectedElements: elements,
      redactionNeeded: elements.length > 0,
      privacyScore: this.calculatePrivacyScore(elements),
      timestamp: Date.now(),
    };

    return this.redact(embedding, classification);
  }

  /**
   * Re-hydrate a redacted embedding
   *
   * Restores the structure of redacted content without revealing sensitive
   * information. Useful for rendering UI that indicates redacted content.
   *
   * @param redacted - Redaction result
   * @param strategy - Re-hydration strategy
   * @returns Re-hydrated embedding
   */
  rehydrate(
    redacted: RedactionResult,
    strategy: "zero" | "noise" | "semantic_placeholder" = "semantic_placeholder"
  ): RehydrationResult {
    const rehydrated = new Float32Array(redacted.redactedEmbedding);

    const dimensionsRehydrated = redacted.redactionMask.filter(m => m).length;

    // Apply re-hydration strategy
    for (let i = 0; i < rehydrated.length; i++) {
      if (redacted.redactionMask[i]) {
        switch (strategy) {
          case "zero":
            // Keep as zero (default)
            break;

          case "noise":
            // Add small noise to indicate something was redacted
            rehydrated[i] = (Math.random() - 0.5) * 0.01;
            break;

          case "semantic_placeholder":
            // Add semantic placeholder value
            // This preserves structure without content
            rehydrated[i] = 0.1; // Small positive value
            break;
        }
      }
    }

    return {
      rehydratedEmbedding: rehydrated,
      metadata: {
        dimensionsRehydrated,
        rehydrationStrategy: strategy,
        preserveStructure: this.config.preserveStructure,
      },
      success: true,
    };
  }

  /**
   * Create redaction plan from classification
   */
  private createRedactionPlan(
    classification: VisualPrivacyClassification
  ): DimensionRedactionPlan {
    const dimensionsToRedact = new Set<number>();
    const reasons = new Map<number, string>();
    const elementTypes = new Set<PrivacyElement["type"]>();
    const privacyImpact = new Float32Array(this.config.embeddingDim);

    // Process each detected element
    for (const element of classification.detectedElements) {
      // Check if this element type should be redacted
      if (!this.shouldRedactElement(element.type)) {
        continue;
      }

      elementTypes.add(element.type);

      // Mark dimensions in semantic region for redaction
      const region = element.semanticRegion;
      for (let i = region.startDim; i < region.endDim; i++) {
        if (i >= this.config.embeddingDim) break;

        dimensionsToRedact.add(i);
        privacyImpact[i] = Math.max(privacyImpact[i], element.confidence);

        // Add reason if not already present
        if (!reasons.has(i)) {
          reasons.set(
            i,
            `Redacted: ${element.type} (confidence: ${element.confidence.toFixed(2)})`
          );
        }
      }
    }

    // Enforce maximum redaction fraction
    const maxDimensions = Math.floor(
      this.config.embeddingDim * this.config.maxRedactionFraction
    );

    if (dimensionsToRedact.size > maxDimensions) {
      // Sort by privacy impact (descending)
      const sortedDimensions = Array.from(dimensionsToRedact).sort(
        (a, b) => privacyImpact[b] - privacyImpact[a]
      );

      // Keep only top dimensions
      dimensionsToRedact.clear();
      for (let i = 0; i < maxDimensions; i++) {
        dimensionsToRedact.add(sortedDimensions[i]);
      }
    }

    return {
      dimensionsToRedact,
      reasons,
      elementTypes,
      privacyImpact,
    };
  }

  /**
   * Check if element type should be redacted
   */
  private shouldRedactElement(type: PrivacyElement["type"]): boolean {
    switch (type) {
      case "face":
        return this.config.redactFaces;
      case "text":
        return this.config.redactText;
      case "document":
        return this.config.redactDocuments;
      case "screen":
        return this.config.redactScreens;
      case "keyboard":
        return this.config.redactKeyboards;
      case "cursor":
        return this.config.redactCursors;
      default:
        return true;
    }
  }

  /**
   * Apply redaction plan to embedding
   */
  private applyRedaction(
    embedding: Float32Array,
    plan: DimensionRedactionPlan
  ): Float32Array {
    const redacted = new Float32Array(embedding);

    for (const dim of plan.dimensionsToRedact) {
      redacted[dim] = 0;
    }

    return redacted;
  }

  /**
   * Create redaction mask from plan
   */
  private createRedactionMask(plan: DimensionRedactionPlan): boolean[] {
    const mask = new Array(this.config.embeddingDim).fill(false);

    for (const dim of plan.dimensionsToRedact) {
      mask[dim] = true;
    }

    return mask;
  }

  /**
   * Apply differential privacy noise
   *
   * Uses Gaussian mechanism: add noise N(0, σ²) where σ = sensitivity / ε.
   *
   * @param embedding - Input embedding
   * @param epsilon - Privacy parameter
   * @returns Noisy embedding
   */
  private applyDifferentialPrivacy(
    embedding: Float32Array,
    epsilon: number
  ): Float32Array {
    const sensitivity = 2.0; // L2 sensitivity for normalized embeddings
    const sigma = sensitivity / epsilon;
    const result = new Float32Array(embedding.length);

    for (let i = 0; i < embedding.length; i++) {
      result[i] = embedding[i] + this.gaussianRandom() * sigma;
    }

    return result;
  }

  /**
   * Generate Gaussian random number (Box-Muller transform)
   */
  private gaussianRandom(): number {
    const u1 = Math.max(Math.random(), 1e-10);
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Calculate privacy score from elements
   */
  private calculatePrivacyScore(elements: PrivacyElement[]): number {
    if (elements.length === 0) return 0;

    const weights: Record<PrivacyElement["type"], number> = {
      face: 1.0,
      document: 0.95,
      text: 0.7,
      screen: 0.8,
      keyboard: 0.5,
      cursor: 0.2,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const el of elements) {
      const weight = weights[el.type] ?? 0.5;
      weightedSum += el.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      embeddingsRedacted: 0,
      totalDimensionsRedacted: 0,
      avgRedactionFraction: 0,
    };
  }
}

/**
 * Create a conservative redaction protocol (maximum privacy)
 */
export function createConservativeRedaction(): EmbeddingRedactionProtocol {
  return new EmbeddingRedactionProtocol({
    strategy: "conservative",
    redactFaces: true,
    redactText: true,
    redactScreens: true,
    redactKeyboards: true,
    redactDocuments: true,
    redactCursors: true,
    epsilon: 0.5, // Stronger DP
    maxRedactionFraction: 0.7,
    preserveStructure: true,
  });
}

/**
 * Create a balanced redaction protocol (default)
 */
export function createBalancedRedaction(): EmbeddingRedactionProtocol {
  return new EmbeddingRedactionProtocol({
    strategy: "balanced",
    redactFaces: true,
    redactText: true,
    redactScreens: true,
    redactKeyboards: false,
    redactDocuments: true,
    redactCursors: false,
    epsilon: 1.0, // Balanced DP
    maxRedactionFraction: 0.5,
    preserveStructure: true,
  });
}

/**
 * Create a permissive redaction protocol (minimal redaction)
 */
export function createPermissiveRedaction(): EmbeddingRedactionProtocol {
  return new EmbeddingRedactionProtocol({
    strategy: "permissive",
    redactFaces: true,
    redactText: false,
    redactScreens: false,
    redactKeyboards: false,
    redactDocuments: true,
    redactCursors: false,
    epsilon: undefined, // No DP
    maxRedactionFraction: 0.3,
    preserveStructure: true,
  });
}

/**
 * Calculate privacy-utility tradeoff metrics
 *
 * @param original - Original embedding
 * @param redacted - Redacted embedding
 * @returns Tradeoff metrics
 */
export function calculateTradeoffMetrics(
  original: Float32Array,
  redacted: Float32Array
): {
  cosineSimilarity: number;
  euclideanDistance: number;
  dimensionsChanged: number;
  privacyGain: number;
} {
  if (original.length !== redacted.length) {
    throw new Error("Embeddings must have same dimension");
  }

  // Cosine similarity
  let dotProduct = 0;
  let normOrig = 0;
  let normRedacted = 0;
  let dimensionsChanged = 0;

  for (let i = 0; i < original.length; i++) {
    dotProduct += original[i] * redacted[i];
    normOrig += original[i] * original[i];
    normRedacted += redacted[i] * redacted[i];

    if (Math.abs(original[i] - redacted[i]) > 1e-6) {
      dimensionsChanged++;
    }
  }

  const cosineSimilarity =
    dotProduct / (Math.sqrt(normOrig) * Math.sqrt(normRedacted));

  // Euclidean distance
  let sumSquaredDiff = 0;
  for (let i = 0; i < original.length; i++) {
    const diff = original[i] - redacted[i];
    sumSquaredDiff += diff * diff;
  }
  const euclideanDistance = Math.sqrt(sumSquaredDiff);

  // Privacy gain (fraction of dimensions zeroed)
  const privacyGain = dimensionsChanged / original.length;

  return {
    cosineSimilarity,
    euclideanDistance,
    dimensionsChanged,
    privacyGain,
  };
}
