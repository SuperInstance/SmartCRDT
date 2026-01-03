/**
 * @lsi/vljepa-orpo - Loss Functions
 *
 * ORPO (Odds Ratio Policy Optimization) loss functions for multimodal preference learning.
 * Extends standard ORPO with visual embedding distance loss.
 *
 * @module trainers
 */

/**
 * ORPO loss configuration
 */
export interface ORPOLossConfig {
  /** Beta parameter for odds ratio */
  beta: number;
  /** Lambda for ORPO loss weight */
  lambda: number;
  /** Weight for SFT loss */
  sftLossWeight: number;
  /** Weight for visual embedding distance */
  visualDistanceWeight: number;
  /** Temperature for embedding similarity */
  temperature: number;
}

/**
 * ORPO loss result
 */
export interface ORPOLossResult {
  /** Total loss */
  totalLoss: number;
  /** SFT loss component */
  sftLoss: number;
  /** ORPO loss component */
  orpoLoss: number;
  /** Visual distance loss component */
  visualDistanceLoss: number;
  /** Log odds ratio */
  logOddsRatio: number;
  /** Reference log odds ratio */
  refLogOddsRatio: number;
  /** Odds ratio */
  oddsRatio: number;
  /** Sigmoid probability */
  sigmoidProb: number;
}

/**
 * Multimodal ORPO loss function
 *
 * Computes ORPO loss with optional visual embedding distance.
 *
 * Loss = sftWeight * SFT_Loss + lambda * ORPO_Loss + visualWeight * Visual_Distance_Loss
 *
 * where:
 * - SFT_Loss = -log(P(chosen))
 * - ORPO_Loss = -log(σ(β * (log_odds_chosen - log_odds_rejected)))
 * - Visual_Distance_Loss = 1 - cosine_similarity(chosen_embedding, target_embedding)
 */
export class ORPOLossFunction {
  private config: ORPOLossConfig;

  constructor(config: Partial<ORPOLossConfig> = {}) {
    this.config = {
      beta: 0.1,
      lambda: 1.0,
      sftLossWeight: 1.0,
      visualDistanceWeight: 0.5,
      temperature: 0.07,
      ...config,
    };
  }

  /**
   * Compute ORPO loss for a single preference pair
   *
   * @param chosenLogProb - Log probability of chosen response
   * @param rejectedLogProb - Log probability of rejected response
   * @param refChosenLogProb - Reference log probability of chosen response
   * @param refRejectedLogProb - Reference log probability of rejected response
   * @param chosenEmbedding - Chosen visual embedding (optional)
   * @param rejectedEmbedding - Rejected visual embedding (optional)
   * @returns ORPO loss result
   */
  compute(
    chosenLogProb: number,
    rejectedLogProb: number,
    refChosenLogProb: number,
    refRejectedLogProb: number,
    chosenEmbedding?: Float32Array,
    rejectedEmbedding?: Float32Array
  ): ORPOLossResult {
    // Compute SFT loss (supervised fine-tuning)
    const sftLoss = this.computeSFTLoss(chosenLogProb);

    // Compute log odds ratios
    const logOddsRatio = chosenLogProb - rejectedLogProb;
    const refLogOddsRatio = refChosenLogProb - refRejectedLogProb;

    // Compute ORPO loss
    const orpoLoss = this.computeORPOLossInternal(
      logOddsRatio,
      refLogOddsRatio
    );

    // Compute visual distance loss (if embeddings provided)
    let visualDistanceLoss = 0;
    if (chosenEmbedding && rejectedEmbedding) {
      visualDistanceLoss = this.computeVisualDistanceLoss(
        chosenEmbedding,
        rejectedEmbedding
      );
    }

    // Combine losses
    const totalLoss =
      this.config.sftLossWeight * sftLoss +
      this.config.lambda * orpoLoss +
      this.config.visualDistanceWeight * visualDistanceLoss;

    // Compute odds ratio for logging
    const oddsRatio = Math.exp(logOddsRatio);
    const sigmoidProb = this.sigmoid(
      this.config.beta * (logOddsRatio - refLogOddsRatio)
    );

    return {
      totalLoss,
      sftLoss,
      orpoLoss,
      visualDistanceLoss,
      logOddsRatio,
      refLogOddsRatio,
      oddsRatio,
      sigmoidProb,
    };
  }

  /**
   * Compute SFT (Supervised Fine-Tuning) loss
   * SFT loss = -log(P(target))
   */
  computeSFTLoss(targetLogProb: number): number {
    return -targetLogProb;
  }

  /**
   * Compute ORPO loss component
   * L_ORPO = -log(σ(β * (log_odds_ratio - ref_log_odds_ratio)))
   */
  computeORPOLossInternal(
    logOddsRatio: number,
    refLogOddsRatio: number
  ): number {
    const diff = logOddsRatio - refLogOddsRatio;
    const sigmoidInput = this.config.beta * diff;
    const sigmoidValue = this.sigmoid(sigmoidInput);
    const clippedSigmoid = Math.max(sigmoidValue, 1e-10);
    return -Math.log(clippedSigmoid);
  }

  /**
   * Compute visual embedding distance loss
   * Uses cosine similarity: L_visual = 1 - cosine_similarity(a, b)
   */
  computeVisualDistanceLoss(
    embedding1: Float32Array,
    embedding2: Float32Array
  ): number {
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    return 1 - similarity;
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(
        `Embedding dimension mismatch: ${a.length} vs ${b.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB) + 1e-8;
    return dotProduct / denominator;
  }

  /**
   * Sigmoid function
   */
  sigmoid(x: number): number {
    const clippedX = Math.max(-50, Math.min(50, x));
    return 1 / (1 + Math.exp(-clippedX));
  }

  /**
   * Compute batch losses
   */
  computeBatch(
    chosenLogProbs: number[],
    rejectedLogProbs: number[],
    refChosenLogProbs: number[],
    refRejectedLogProbs: number[],
    chosenEmbeddings?: Float32Array[],
    rejectedEmbeddings?: Float32Array[]
  ): ORPOLossResult[] {
    const results: ORPOLossResult[] = [];

    for (let i = 0; i < chosenLogProbs.length; i++) {
      results.push(
        this.compute(
          chosenLogProbs[i],
          rejectedLogProbs[i],
          refChosenLogProbs[i],
          refRejectedLogProbs[i],
          chosenEmbeddings?.[i],
          rejectedEmbeddings?.[i]
        )
      );
    }

    return results;
  }

  /**
   * Compute average loss over a batch
   */
  computeAverageLoss(losses: ORPOLossResult[]): {
    avgTotalLoss: number;
    avgSFTLoss: number;
    avgORPOLoss: number;
    avgVisualDistanceLoss: number;
    avgOddsRatio: number;
  } {
    const sum = losses.reduce(
      (acc, loss) => ({
        totalLoss: acc.totalLoss + loss.totalLoss,
        sftLoss: acc.sftLoss + loss.sftLoss,
        orpoLoss: acc.orpoLoss + loss.orpoLoss,
        visualDistanceLoss: acc.visualDistanceLoss + loss.visualDistanceLoss,
        oddsRatio: acc.oddsRatio + loss.oddsRatio,
      }),
      {
        totalLoss: 0,
        sftLoss: 0,
        orpoLoss: 0,
        visualDistanceLoss: 0,
        oddsRatio: 0,
      }
    );

    const n = losses.length;
    return {
      avgTotalLoss: sum.totalLoss / n,
      avgSFTLoss: sum.sftLoss / n,
      avgORPOLoss: sum.orpoLoss / n,
      avgVisualDistanceLoss: sum.visualDistanceLoss / n,
      avgOddsRatio: sum.oddsRatio / n,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ORPOLossConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ORPOLossConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Compute log probability from logits
 */
export function computeLogProb(logits: number[], targetToken: number): number {
  if (targetToken < 0 || targetToken >= logits.length) {
    throw new Error(
      `Target token ${targetToken} out of bounds for logits of length ${logits.length}`
    );
  }

  // Log-sum-exp trick for numerical stability
  const maxLogit = Math.max(...logits);
  const logSumExp =
    maxLogit +
    Math.log(logits.reduce((sum, l) => sum + Math.exp(l - maxLogit), 0));

  return logits[targetToken] - logSumExp;
}

/**
 * Compute log probabilities for a sequence
 */
export function computeSequenceLogProb(
  logits: number[][],
  targetTokens: number[]
): number {
  if (logits.length !== targetTokens.length) {
    throw new Error(
      `Logits length ${logits.length} does not match target tokens length ${targetTokens.length}`
    );
  }

  let totalLogProb = 0;
  for (let i = 0; i < logits.length; i++) {
    totalLogProb += computeLogProb(logits[i], targetTokens[i]);
  }
  return totalLogProb;
}

/**
 * Batch compute ORPO losses (convenience function)
 */
export function batchComputeORPOLoss(
  chosenLogProbs: number[],
  rejectedLogProbs: number[],
  refChosenLogProbs: number[],
  refRejectedLogProbs: number[],
  config?: Partial<ORPOLossConfig>
): ORPOLossResult[] {
  const lossFunction = new ORPOLossFunction(config);
  return lossFunction.computeBatch(
    chosenLogProbs,
    rejectedLogProbs,
    refChosenLogProbs,
    refRejectedLogProbs
  );
}

/**
 * Compute average ORPO loss (convenience function)
 */
export function computeAverageORPOLoss(
  chosenLogProbs: number[],
  rejectedLogProbs: number[],
  refChosenLogProbs: number[],
  refRejectedLogProbs: number[],
  config?: Partial<ORPOLossConfig>
): number {
  const losses = batchComputeORPOLoss(
    chosenLogProbs,
    rejectedLogProbs,
    refChosenLogProbs,
    refRejectedLogProbs,
    config
  );

  return losses.reduce((sum, loss) => sum + loss.totalLoss, 0) / losses.length;
}

/**
 * Create ORPO loss function with default configuration
 */
export function createORPOLossFunction(
  config?: Partial<ORPOLossConfig>
): ORPOLossFunction {
  return new ORPOLossFunction(config);
}
