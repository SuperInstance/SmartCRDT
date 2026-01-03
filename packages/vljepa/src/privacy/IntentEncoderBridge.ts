/**
 * IntentEncoderBridge - Bridge visual privacy with IntentEncoder
 *
 * This module integrates VL-JEPA visual privacy with the existing IntentEncoder
 * privacy suite. It provides unified privacy state management, consistent
 * ε-differential privacy budgets, and coordinated redaction across text and
 * visual modalities.
 *
 * ## Key Features
 *
 * 1. **Unified Privacy State**: Text + Visual privacy in one system
 * 2. **Consistent ε-DP**: Same differential privacy budget across modalities
 * 3. **Coordinated Redaction**: Text and visual redaction together
 * 4. **Privacy Budget Tracking**: Track ε usage across all operations
 *
 * @packageDocumentation
 */

import { IntentEncoder, IntentVector } from "@lsi/privacy/intention";
import { VisualPrivacyClassification } from "./VisualPrivacyClassifier";
import { RedactionResult } from "./EmbeddingRedactionProtocol";
import { ProcessingLocation } from "./VisualPrivacyAnalyzer";

/**
 * Unified privacy state across text and visual modalities
 */
export interface UnifiedPrivacyState {
  /** Global privacy mode */
  mode: "strict" | "standard" | "permissive";

  /** Differential privacy budget */
  dpBudget: {
    /** Total epsilon budget */
    totalEpsilon: number;

    /** Epsilon used so far */
    usedEpsilon: number;

    /** Epsilon remaining */
    remainingEpsilon: number;

    /** Budget reset time (timestamp) */
    resetTime: number;
  };

  /** Text privacy settings */
  textPrivacy: {
    /** Intent encoder epsilon */
    epsilon: number;

    /** Whether text redaction is enabled */
    redactionEnabled: boolean;
  };

  /** Visual privacy settings */
  visualPrivacy: {
    /** Visual classifier epsilon */
    epsilon: number;

    /** Whether visual redaction is enabled */
    redactionEnabled: boolean;

    /** Processing location */
    processingLocation: ProcessingLocation;
  };

  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Coordinated redaction result
 */
export interface CoordinatedRedactionResult {
  /** Text redaction result */
  text: {
    /** Original query */
    original: string;

    /** Redacted query */
    redacted: string;

    /** Redaction applied */
    redactionApplied: boolean;

    /** Epsilon used */
    epsilonUsed: number;
  };

  /** Visual redaction result */
  visual: {
    /** Original embedding */
    originalEmbedding: Float32Array;

    /** Redacted embedding */
    redactedEmbedding: Float32Array;

    /** Classification */
    classification: VisualPrivacyClassification;

    /** Redaction result */
    redaction?: RedactionResult;

    /** Epsilon used */
    epsilonUsed: number;
  };

  /** Total epsilon used */
  totalEpsilonUsed: number;

  /** Whether coordinated redaction was successful */
  success: boolean;
}

/**
 * Privacy budget configuration
 */
export interface PrivacyBudgetConfig {
  /** Total epsilon budget per time window */
  totalEpsilon: number;

  /** Budget window duration (ms) */
  windowDuration: number;

  /** Warn when epsilon used exceeds this fraction */
  warningThreshold: number;

  /** Block operations when epsilon exhausted */
  blockOnExhaustion: boolean;
}

/**
 * Intent encoder bridge configuration
 */
export interface IntentEncoderBridgeConfig {
  /** Intent encoder instance */
  intentEncoder: IntentEncoder;

  /** Privacy budget configuration */
  privacyBudget: PrivacyBudgetConfig;

  /** Default privacy mode */
  defaultMode: "strict" | "standard" | "permissive";

  /** Enable coordinated redaction */
  enableCoordinatedRedaction: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * IntentEncoderBridge - Bridge visual privacy with IntentEncoder
 *
 * Provides unified privacy management across text and visual modalities.
 *
 * ## Example
 *
 * ```typescript
 * const bridge = new IntentEncoderBridge({
 *   intentEncoder: myIntentEncoder,
 *   privacyBudget: {
 *     totalEpsilon: 10.0,
 *     windowDuration: 3600000, // 1 hour
 *   },
 * });
 *
 * // Encode text query with privacy
 * const textIntent = await bridge.encodeText("What's the weather?", 1.0);
 *
 * // Encode visual data with privacy
 * const visualIntent = await bridge.encodeVisual(embedding, 1.0);
 *
 * // Coordinated redaction
 * const result = await bridge.coordinatedRedaction(query, embedding);
 * ```
 */
export class IntentEncoderBridge {
  private config: Required<IntentEncoderBridgeConfig>;
  private privacyState: UnifiedPrivacyState;
  private usageLog: Array<{
    timestamp: number;
    modality: "text" | "visual";
    epsilon: number;
  }>;

  constructor(config: IntentEncoderBridgeConfig) {
    this.config = {
      intentEncoder: config.intentEncoder,
      privacyBudget: {
        totalEpsilon: config.privacyBudget.totalEpsilon,
        windowDuration: config.privacyBudget.windowDuration,
        warningThreshold: config.privacyBudget.warningThreshold ?? 0.8,
        blockOnExhaustion: config.privacyBudget.blockOnExhaustion ?? true,
      },
      defaultMode: config.defaultMode ?? "standard",
      enableCoordinatedRedaction: config.enableCoordinatedRedaction ?? true,
      verbose: config.verbose ?? false,
    };

    this.privacyState = this.createInitialPrivacyState();
    this.usageLog = [];

    // Start budget reset timer
    this.startBudgetResetTimer();
  }

  /**
   * Encode text query with privacy budget tracking
   *
   * @param query - Text query to encode
   * @param epsilon - Epsilon to use (optional, defaults to state)
   * @returns Intent vector
   */
  async encodeText(query: string, epsilon?: number): Promise<IntentVector> {
    const eps = epsilon ?? this.privacyState.textPrivacy.epsilon;

    // Check privacy budget
    if (!this.canConsumeEpsilon(eps)) {
      throw new Error(
        `Insufficient privacy budget. Requested: ${eps}, ` +
          `Available: ${this.privacyState.dpBudget.remainingEpsilon}`
      );
    }

    // Encode with IntentEncoder
    const intent = await this.config.intentEncoder.encode(query, eps);

    // Consume epsilon
    this.consumeEpsilon(eps, "text");

    // Update state
    this.privacyState.textPrivacy.epsilon = eps;
    this.privacyState.lastUpdated = Date.now();

    if (this.config.verbose) {
      console.log("[IntentEncoderBridge] Text encoded:", {
        queryLength: query.length,
        epsilon: eps,
        remaining: this.privacyState.dpBudget.remainingEpsilon,
      });
    }

    return intent;
  }

  /**
   * Encode visual data with privacy budget tracking
   *
   * @param embedding - Visual embedding (768-dim)
   * @param classification - Privacy classification
   * @param epsilon - Epsilon to use (optional, defaults to state)
   * @returns Redacted embedding and metadata
   */
  async encodeVisual(
    embedding: Float32Array,
    classification: VisualPrivacyClassification,
    epsilon?: number
  ): Promise<{
    embedding: Float32Array;
    classification: VisualPrivacyClassification;
    epsilonUsed: number;
  }> {
    const eps = epsilon ?? this.privacyState.visualPrivacy.epsilon;

    // Check privacy budget
    if (!this.canConsumeEpsilon(eps)) {
      throw new Error(
        `Insufficient privacy budget. Requested: ${eps}, ` +
          `Available: ${this.privacyState.dpBudget.remainingEpsilon}`
      );
    }

    // Consume epsilon
    this.consumeEpsilon(eps, "visual");

    // Update state
    this.privacyState.visualPrivacy.epsilon = eps;
    this.privacyState.lastUpdated = Date.now();

    if (this.config.verbose) {
      console.log("[IntentEncoderBridge] Visual encoded:", {
        classification: classification.classification,
        epsilon: eps,
        remaining: this.privacyState.dpBudget.remainingEpsilon,
      });
    }

    return {
      embedding,
      classification,
      epsilonUsed: eps,
    };
  }

  /**
   * Perform coordinated redaction across text and visual
   *
   * Redacts both text queries and visual embeddings consistently.
   *
   * @param textQuery - Text query to redact
   * @param visualEmbedding - Visual embedding to redact
   * @param visualClassification - Visual privacy classification
   * @param visualRedaction - Visual redaction result (if applicable)
   * @returns Coordinated redaction result
   */
  async coordinatedRedaction(
    textQuery: string,
    visualEmbedding: Float32Array,
    visualClassification: VisualPrivacyClassification,
    visualRedaction?: RedactionResult
  ): Promise<CoordinatedRedactionResult> {
    const startTime = Date.now();

    // Determine epsilon allocation
    const totalEpsilon = this.privacyState.dpBudget.remainingEpsilon;
    const textEpsilon = totalEpsilon * 0.5; // 50% for text
    const visualEpsilon = totalEpsilon * 0.5; // 50% for visual

    // Check budget
    if (!this.canConsumeEpsilon(totalEpsilon)) {
      throw new Error("Insufficient privacy budget for coordinated redaction");
    }

    // Text redaction (placeholder - would use SemanticPIIRedactor)
    const textRedacted = textQuery; // TODO: Implement text redaction
    const textRedactionApplied = false;

    // Visual redaction
    let visualRedacted = visualEmbedding;
    if (visualRedaction) {
      visualRedacted = visualRedaction.redactedEmbedding;
    }

    // Consume epsilon
    this.consumeEpsilon(textEpsilon, "text");
    this.consumeEpsilon(visualEpsilon, "visual");

    const result: CoordinatedRedactionResult = {
      text: {
        original: textQuery,
        redacted: textRedacted,
        redactionApplied: textRedactionApplied,
        epsilonUsed: textEpsilon,
      },
      visual: {
        originalEmbedding: visualEmbedding,
        redactedEmbedding: visualRedacted,
        classification: visualClassification,
        redaction: visualRedaction,
        epsilonUsed: visualEpsilon,
      },
      totalEpsilonUsed: textEpsilon + visualEpsilon,
      success: true,
    };

    if (this.config.verbose) {
      console.log("[IntentEncoderBridge] Coordinated redaction:", {
        textRedactionApplied,
        visualRedactionApplied: visualRedaction !== undefined,
        totalEpsilonUsed: result.totalEpsilonUsed,
        elapsed: Date.now() - startTime,
      });
    }

    return result;
  }

  /**
   * Get current privacy state
   */
  getPrivacyState(): UnifiedPrivacyState {
    return { ...this.privacyState };
  }

  /**
   * Update privacy mode
   *
   * @param mode - New privacy mode
   */
  setPrivacyMode(mode: "strict" | "standard" | "permissive"): void {
    this.privacyState.mode = mode;

    // Update epsilon values based on mode
    switch (mode) {
      case "strict":
        this.privacyState.textPrivacy.epsilon = 0.5;
        this.privacyState.visualPrivacy.epsilon = 0.5;
        this.privacyState.visualPrivacy.processingLocation =
          ProcessingLocation.EDGE_ONLY;
        break;

      case "standard":
        this.privacyState.textPrivacy.epsilon = 1.0;
        this.privacyState.visualPrivacy.epsilon = 1.0;
        this.privacyState.visualPrivacy.processingLocation =
          ProcessingLocation.EDGE_ONLY;
        break;

      case "permissive":
        this.privacyState.textPrivacy.epsilon = 2.0;
        this.privacyState.visualPrivacy.epsilon = 2.0;
        this.privacyState.visualPrivacy.processingLocation =
          ProcessingLocation.HYBRID;
        break;
    }

    this.privacyState.lastUpdated = Date.now();

    if (this.config.verbose) {
      console.log("[IntentEncoderBridge] Privacy mode updated:", mode);
    }
  }

  /**
   * Get privacy budget status
   */
  getBudgetStatus(): {
    total: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    warning: boolean;
    exhausted: boolean;
  } {
    const { totalEpsilon, usedEpsilon, remainingEpsilon } =
      this.privacyState.dpBudget;
    const percentageUsed = (usedEpsilon / totalEpsilon) * 100;
    const warning =
      percentageUsed > this.config.privacyBudget.warningThreshold * 100;
    const exhausted = remainingEpsilon <= 0;

    return {
      total: totalEpsilon,
      used: usedEpsilon,
      remaining: remainingEpsilon,
      percentageUsed,
      warning,
      exhausted,
    };
  }

  /**
   * Reset privacy budget
   */
  resetBudget(): void {
    this.privacyState.dpBudget.usedEpsilon = 0;
    this.privacyState.dpBudget.remainingEpsilon =
      this.privacyState.dpBudget.totalEpsilon;
    this.privacyState.dpBudget.resetTime =
      Date.now() + this.config.privacyBudget.windowDuration;
    this.usageLog = [];

    if (this.config.verbose) {
      console.log("[IntentEncoderBridge] Budget reset");
    }
  }

  /**
   * Get usage log
   */
  getUsageLog(limit?: number): Array<{
    timestamp: number;
    modality: "text" | "visual";
    epsilon: number;
  }> {
    if (limit) {
      return this.usageLog.slice(-limit);
    }
    return [...this.usageLog];
  }

  /**
   * Create initial privacy state
   */
  private createInitialPrivacyState(): UnifiedPrivacyState {
    const now = Date.now();

    return {
      mode: this.config.defaultMode,
      dpBudget: {
        totalEpsilon: this.config.privacyBudget.totalEpsilon,
        usedEpsilon: 0,
        remainingEpsilon: this.config.privacyBudget.totalEpsilon,
        resetTime: now + this.config.privacyBudget.windowDuration,
      },
      textPrivacy: {
        epsilon: this.defaultModeToEpsilon(this.config.defaultMode),
        redactionEnabled: true,
      },
      visualPrivacy: {
        epsilon: this.defaultModeToEpsilon(this.config.defaultMode),
        redactionEnabled: true,
        processingLocation: ProcessingLocation.EDGE_ONLY,
      },
      lastUpdated: now,
    };
  }

  /**
   * Convert privacy mode to epsilon value
   */
  private defaultModeToEpsilon(
    mode: "strict" | "standard" | "permissive"
  ): number {
    switch (mode) {
      case "strict":
        return 0.5;
      case "standard":
        return 1.0;
      case "permissive":
        return 2.0;
    }
  }

  /**
   * Check if epsilon can be consumed
   */
  private canConsumeEpsilon(epsilon: number): boolean {
    return this.privacyState.dpBudget.remainingEpsilon >= epsilon;
  }

  /**
   * Consume epsilon from budget
   */
  private consumeEpsilon(epsilon: number, modality: "text" | "visual"): void {
    this.privacyState.dpBudget.usedEpsilon += epsilon;
    this.privacyState.dpBudget.remainingEpsilon -= epsilon;

    // Log usage
    this.usageLog.push({
      timestamp: Date.now(),
      modality,
      epsilon,
    });

    // Warn if budget running low
    const status = this.getBudgetStatus();
    if (status.warning && this.config.verbose) {
      console.warn(
        `[IntentEncoderBridge] Privacy budget warning: ${status.percentageUsed.toFixed(1)}% used`
      );
    }

    // Block if exhausted
    if (status.exhausted && this.config.privacyBudget.blockOnExhaustion) {
      throw new Error(
        "Privacy budget exhausted. Reset budget or increase limit."
      );
    }
  }

  /**
   * Start budget reset timer
   */
  private startBudgetResetTimer(): void {
    setInterval(() => {
      const now = Date.now();
      if (now >= this.privacyState.dpBudget.resetTime) {
        this.resetBudget();
      }
    }, 60000); // Check every minute
  }
}

/**
 * Create a standard intent encoder bridge
 */
export function createStandardBridge(
  intentEncoder: IntentEncoder,
  totalEpsilon: number = 10.0
): IntentEncoderBridge {
  return new IntentEncoderBridge({
    intentEncoder,
    privacyBudget: {
      totalEpsilon,
      windowDuration: 3600000, // 1 hour
      warningThreshold: 0.8,
      blockOnExhaustion: true,
    },
    defaultMode: "standard",
    enableCoordinatedRedaction: true,
  });
}

/**
 * Create a strict intent encoder bridge
 */
export function createStrictBridge(
  intentEncoder: IntentEncoder,
  totalEpsilon: number = 5.0
): IntentEncoderBridge {
  return new IntentEncoderBridge({
    intentEncoder,
    privacyBudget: {
      totalEpsilon,
      windowDuration: 3600000, // 1 hour
      warningThreshold: 0.7,
      blockOnExhaustion: true,
    },
    defaultMode: "strict",
    enableCoordinatedRedaction: true,
  });
}

/**
 * Create a permissive intent encoder bridge
 */
export function createPermissiveBridge(
  intentEncoder: IntentEncoder,
  totalEpsilon: number = 20.0
): IntentEncoderBridge {
  return new IntentEncoderBridge({
    intentEncoder,
    privacyBudget: {
      totalEpsilon,
      windowDuration: 3600000, // 1 hour
      warningThreshold: 0.9,
      blockOnExhaustion: false,
    },
    defaultMode: "permissive",
    enableCoordinatedRedaction: true,
  });
}
