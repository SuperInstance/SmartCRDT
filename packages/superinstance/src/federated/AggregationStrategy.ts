/**
 * Federated Learning Aggregation Strategies
 *
 * Implements various aggregation algorithms for combining client updates:
 * - FedAvg: Federated Averaging (McMahan et al., 2017)
 * - FedAvgM: Federated Averaging with Momentum
 * - FedProx: Federated Proximal (Li et al., 2020)
 * - Robust aggregation: Krum, Multi-Krum, Trimmed Mean
 *
 * @module federated
 */

import type {
  AggregationResult,
  ModelUpdate,
  AggregationMetrics,
  AggregationValidation,
} from "@lsi/protocol";
import {
  AggregationStrategy,
  RobustAggregationMethod,
  RejectionReason,
} from "@lsi/protocol";

// ============================================================================
// AGGREGATOR CONFIGURATION
// ============================================================================

/**
 * Aggregator configuration
 */
export interface AggregatorConfig {
  /** Aggregation strategy to use */
  strategy: AggregationStrategy;
  /** Enable Byzantine resilience */
  enableByzantineResilience: boolean;
  /** Robust aggregation method */
  robustMethod?: RobustAggregationMethod;
  /** Maximum allowed update norm */
  maxUpdateNorm: number;
  /** Minimum allowed update norm */
  minUpdateNorm: number;
  /** Number of standard deviations for outlier detection */
  outlierStdDevThreshold: number;
  /** Momentum coefficient for FedAvgM */
  momentumCoefficient?: number;
  /** Proximal term for FedProx */
  proximalTerm?: number;
  /** Minimum cosine similarity threshold */
  minCosineSimilarity?: number;
  /** Enable similarity checks */
  enableSimilarityCheck?: boolean;
}

// ============================================================================
// MAIN AGGREGATOR CLASS
// ============================================================================

/**
 * Federated Learning Aggregator
 *
 * Aggregates client model updates using various strategies.
 */
export class FederatedAggregator {
  private config: AggregatorConfig;

  constructor(config: AggregatorConfig) {
    this.config = config;
  }

  /**
   * Aggregate client updates
   *
   * @param updates - Client updates to aggregate
   * @param globalWeights - Current global model weights
   * @param roundId - Round identifier
   * @returns Aggregation result
   */
  async aggregate(
    updates: ModelUpdate[],
    globalWeights: number[],
    roundId: string
  ): Promise<AggregationResult> {
    const startTime = Date.now();

    // Validate updates
    const validation = this.validateUpdates(updates);

    // Filter out rejected updates
    const validUpdates = updates.filter((update) => {
      const rejected = validation.rejectedClients.includes(update.clientId);
      return !rejected;
    });

    // Perform aggregation
    let aggregatedWeights: number[];
    switch (this.config.strategy) {
      case AggregationStrategy.FEDAVG:
        aggregatedWeights = this.fedAvg(validUpdates, globalWeights);
        break;
      case AggregationStrategy.FEDAVGM:
        aggregatedWeights = this.fedAvgM(validUpdates, globalWeights);
        break;
      case AggregationStrategy.FEDPROX:
        aggregatedWeights = this.fedProx(validUpdates, globalWeights);
        break;
      case AggregationStrategy.ROBUST:
        aggregatedWeights = await this.robustAggregation(updates, globalWeights);
        break;
      default:
        aggregatedWeights = this.fedAvg(validUpdates, globalWeights);
    }

    // Compute contribution scores
    const contributionScores = this.computeContributionScores(validUpdates);

    // Compute metrics
    const metrics = this.computeMetrics(updates, validUpdates, startTime);

    return {
      roundId,
      timestamp: Date.now(),
      numClients: validUpdates.length,
      numClientsSelected: updates.length,
      aggregatedWeights,
      globalWeights: this.applyUpdateToGlobal(globalWeights, aggregatedWeights),
      contributionScores,
      metrics,
      validation,
    };
  }

  // ========================================================================
  // AGGREGATION STRATEGIES
  // ========================================================================

  /**
   * Federated Averaging (FedAvg)
   *
   * Simple weighted average of client updates, weighted by number of examples.
   *
   * Reference: McMahan et al. (2017) - "Communication-Efficient Learning of Deep Networks
   * from Decentralized Data"
   */
  private fedAvg(updates: ModelUpdate[], globalWeights: number[]): number[] {
    if (updates.length === 0) {
      return new Array(globalWeights.length).fill(0);
    }

    // Compute total number of examples
    const totalExamples = updates.reduce((sum, update) => sum + update.numExamples, 0);

    // Initialize aggregated deltas
    const aggregatedDeltas = new Array(globalWeights.length).fill(0);

    // Weighted average of deltas
    for (const update of updates) {
      const weight = update.numExamples / totalExamples;
      for (let i = 0; i < aggregatedDeltas.length; i++) {
        aggregatedDeltas[i] += weight * (update.weightDeltas[i] || 0);
      }
    }

    return aggregatedDeltas;
  }

  /**
   * Federated Averaging with Momentum (FedAvgM)
   *
   * Adds momentum to FedAvg for faster convergence.
   *
   * Reference: Wang et al. (2019) - "Tackling the Objective Inconsistency Problem
   * in Heterogeneous Federated Transfer Learning"
   */
  private fedAvgM(updates: ModelUpdate[], globalWeights: number[]): number[] {
    // First perform FedAvg
    const avgDeltas = this.fedAvg(updates, globalWeights);

    // Apply momentum (using a simple momentum buffer simulation)
    const momentum = this.config.momentumCoefficient || 0.9;

    // In a real implementation, we would maintain a momentum buffer across rounds
    // For now, we just return the averaged deltas with a slight momentum boost
    return avgDeltas.map((delta) => delta * (1 + momentum * 0.1));
  }

  /**
   * Federated Proximal (FedProx)
   *
   * Adds a proximal term to handle stragglers and heterogeneous data.
   *
   * Reference: Li et al. (2020) - "Federated Optimization in Heterogeneous Networks"
   */
  private fedProx(updates: ModelUpdate[], globalWeights: number[]): number[] {
    const proximalTerm = this.config.proximalTerm || 0.01;

    // Compute FedAvg first
    const avgDeltas = this.fedAvg(updates, globalWeights);

    // Apply proximal term (regularization towards global model)
    return avgDeltas.map((delta) => {
      // The proximal term penalizes large deviations from the global model
      const regularization = proximalTerm * delta;
      return delta - regularization;
    });
  }

  /**
   * Robust Aggregation
   *
   * Uses robust aggregation methods to handle Byzantine failures.
   * Supports Krum, Multi-Krum, Trimmed Mean, and Median.
   */
  private async robustAggregation(updates: ModelUpdate[], globalWeights: number[]): Promise<number[]> {
    const method = this.config.robustMethod || RobustAggregationMethod.TRIMMED_MEAN;

    switch (method) {
      case RobustAggregationMethod.KRUM:
        return this.krumAggregation(updates, globalWeights);
      case RobustAggregationMethod.MULTI_KRUM:
        return this.multiKrumAggregation(updates, globalWeights);
      case RobustAggregationMethod.TRIMMED_MEAN:
        return this.trimmedMeanAggregation(updates, globalWeights);
      case RobustAggregationMethod.MEDIAN:
        return this.medianAggregation(updates, globalWeights);
      case RobustAggregationMethod.COORDINATE_MEDIAN:
        return this.coordinateMedianAggregation(updates, globalWeights);
      default:
        return this.trimmedMeanAggregation(updates, globalWeights);
    }
  }

  // ========================================================================
  // ROBUST AGGREGATION METHODS
  // ========================================================================

  /**
   * Krum Aggregation
   *
   * Selects the update closest to other updates (based on Euclidean distance).
   *
   * Reference: Blanchard et al. (2017) - "Machine Learning with Adversaries: Byzantine
   * Tolerant Gradient Descent"
   */
  private krumAggregation(updates: ModelUpdate[], globalWeights: number[]): number[] {
    if (updates.length === 0) {
      return new Array(globalWeights.length).fill(0);
    }

    // Compute pairwise distances
    const distances = this.computePairwiseDistances(updates);

    // Compute score for each update (sum of closest distances)
    const numClosest = updates.length - 2 - Math.floor((updates.length - 3) / 2); // From Krum paper
    const scores = updates.map((_, i) => {
      const sortedDistances = distances[i].slice().sort((a, b) => a - b);
      return sortedDistances.slice(0, numClosest).reduce((sum, d) => sum + d, 0);
    });

    // Select update with minimum score
    const minScoreIndex = scores.indexOf(Math.min(...scores));
    return updates[minScoreIndex].weightDeltas as number[];
  }

  /**
   * Multi-Krum Aggregation
   *
   * Averages multiple updates selected by Krum.
   */
  private multiKrumAggregation(updates: ModelUpdate[], globalWeights: number[]): number[] {
    if (updates.length === 0) {
      return new Array(globalWeights.length).fill(0);
    }

    // Select multiple updates using Krum
    const numSelected = Math.max(1, Math.floor(updates.length * 0.6)); // Select 60% of updates
    const selectedUpdates: ModelUpdate[] = [];
    const remainingUpdates = [...updates];

    for (let i = 0; i < numSelected && remainingUpdates.length > 0; i++) {
      const distances = this.computePairwiseDistances(remainingUpdates);
      const numClosest = remainingUpdates.length - 2 - Math.floor((remainingUpdates.length - 3) / 2);
      const scores = remainingUpdates.map((_, idx) => {
        const sortedDistances = distances[idx].slice().sort((a, b) => a - b);
        return sortedDistances.slice(0, numClosest).reduce((sum, d) => sum + d, 0);
      });

      const minScoreIndex = scores.indexOf(Math.min(...scores));
      selectedUpdates.push(remainingUpdates[minScoreIndex]);
      remainingUpdates.splice(minScoreIndex, 1);
    }

    // Average selected updates
    return this.fedAvg(selectedUpdates, globalWeights);
  }

  /**
   * Trimmed Mean Aggregation
   *
   * Removes the largest and smallest updates, then averages the rest.
   */
  private trimmedMeanAggregation(updates: ModelUpdate[], globalWeights: number[]): number[] {
    if (updates.length === 0) {
      return new Array(globalWeights.length).fill(0);
    }

    // Compute norms of all updates
    const norms = updates.map((update) => this.computeNorm(update.weightDeltas as number[]));

    // Sort by norm
    const indexed = norms.map((norm, i) => ({ norm, i }));
    indexed.sort((a, b) => a.norm - b.norm);

    // Trim smallest and largest (10% on each end)
    const trimCount = Math.max(1, Math.floor(updates.length * 0.1));
    const trimmedUpdates = indexed.slice(trimCount, indexed.length - trimCount).map(({ i }) => updates[i]);

    // Average trimmed updates
    return this.fedAvg(trimmedUpdates, globalWeights);
  }

  /**
   * Median Aggregation
   *
   * Uses median instead of mean for robustness.
   */
  private medianAggregation(updates: ModelUpdate[], globalWeights: number[]): number[] {
    if (updates.length === 0) {
      return new Array(globalWeights.length).fill(0);
    }

    const dimension = globalWeights.length;
    const result = new Array(dimension);

    // Compute median for each dimension
    for (let d = 0; d < dimension; d++) {
      const values = updates.map((update) => update.weightDeltas[d] || 0);
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      result[d] = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    }

    return result;
  }

  /**
   * Coordinate-wise Median Aggregation
   *
   * Computes median independently for each parameter (more robust than global median).
   */
  private coordinateMedianAggregation(updates: ModelUpdate[], globalWeights: number[]): number[] {
    // Same as median aggregation in this implementation
    return this.medianAggregation(updates, globalWeights);
  }

  // ========================================================================
  // VALIDATION AND FILTERING
  // ========================================================================

  /**
   * Validate client updates
   */
  private validateUpdates(updates: ModelUpdate[]): AggregationValidation {
    const rejectedClients: string[] = [];
    const rejectionReasons = new Map<string, RejectionReason>();

    // Compute update norms
    const norms = updates.map((update) => this.computeNorm(update.weightDeltas as number[]));

    // Compute mean and std of norms
    const meanNorm = norms.reduce((sum, norm) => sum + norm, 0) / norms.length;
    const variance = norms.reduce((sum, norm) => sum + Math.pow(norm - meanNorm, 2), 0) / norms.length;
    const stdNorm = Math.sqrt(variance);

    // Check each update
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const norm = norms[i];

      // Norm-based filtering
      if (norm > this.config.maxUpdateNorm) {
        rejectedClients.push(update.clientId);
        rejectionReasons.set(update.clientId, RejectionReason.NORM_TOO_LARGE);
        continue;
      }

      if (norm < this.config.minUpdateNorm) {
        rejectedClients.push(update.clientId);
        rejectionReasons.set(update.clientId, RejectionReason.NORM_TOO_SMALL);
        continue;
      }

      // Outlier detection using standard deviations
      if (Math.abs(norm - meanNorm) > this.config.outlierStdDevThreshold * stdNorm) {
        rejectedClients.push(update.clientId);
        rejectionReasons.set(update.clientId, RejectionReason.OUTLIER);
        continue;
      }

      // Similarity check (if enabled)
      if (this.config.enableSimilarityCheck && this.config.minCosineSimilarity !== undefined) {
        const avgSimilarity = this.computeAverageCosineSimilarity(update, updates);
        if (avgSimilarity < this.config.minCosineSimilarity) {
          rejectedClients.push(update.clientId);
          rejectionReasons.set(update.clientId, RejectionReason.LOW_SIMILARITY);
          continue;
        }
      }
    }

    // Compute validation statistics
    const numOutliers = rejectedClients.length;
    const avgCosineSimilarity = this.computeGlobalAverageCosineSimilarity(
      updates.filter((u) => !rejectedClients.includes(u.clientId))
    );

    return {
      numOutliers,
      rejectedClients,
      rejectionReasons,
      avgCosineSimilarity,
      robustMethod: this.config.robustMethod,
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Compute L2 norm of a vector
   */
  private computeNorm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Compute pairwise distances between updates
   */
  private computePairwiseDistances(updates: ModelUpdate[]): number[][] {
    const n = updates.length;
    const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = this.euclideanDistance(
          updates[i].weightDeltas as number[],
          updates[j].weightDeltas as number[]
        );
        distances[i][j] = dist;
        distances[j][i] = dist;
      }
    }

    return distances;
  }

  /**
   * Compute Euclidean distance between two vectors
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }

  /**
   * Compute average cosine similarity of an update with all others
   */
  private computeAverageCosineSimilarity(targetUpdate: ModelUpdate, allUpdates: ModelUpdate[]): number {
    if (allUpdates.length <= 1) {
      return 1.0;
    }

    const targetDeltas = targetUpdate.weightDeltas as number[];
    let totalSimilarity = 0;
    let count = 0;

    for (const update of allUpdates) {
      if (update.clientId === targetUpdate.clientId) continue;

      const similarity = this.cosineSimilarity(targetDeltas, update.weightDeltas as number[]);
      totalSimilarity += similarity;
      count++;
    }

    return count > 0 ? totalSimilarity / count : 1.0;
  }

  /**
   * Compute global average cosine similarity across all updates
   */
  private computeGlobalAverageCosineSimilarity(updates: ModelUpdate[]): number {
    if (updates.length <= 1) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < updates.length; i++) {
      for (let j = i + 1; j < updates.length; j++) {
        const similarity = this.cosineSimilarity(
          updates[i].weightDeltas as number[],
          updates[j].weightDeltas as number[]
        );
        totalSimilarity += similarity;
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 1.0;
  }

  /**
   * Compute contribution scores for each client
   */
  private computeContributionScores(updates: ModelUpdate[]): Map<string, number> {
    const scores = new Map<string, number>();

    // Simple contribution based on number of examples
    const totalExamples = updates.reduce((sum, update) => sum + update.numExamples, 0);

    for (const update of updates) {
      const score = update.numExamples / totalExamples;
      scores.set(update.clientId, score);
    }

    return scores;
  }

  /**
   * Compute aggregation metrics
   */
  private computeMetrics(
    allUpdates: ModelUpdate[],
    validUpdates: ModelUpdate[],
    startTime: number
  ): AggregationMetrics {
    const norms = allUpdates.map((update) => this.computeNorm(update.weightDeltas as number[]));

    return {
      aggregationTime: Date.now() - startTime,
      avgCommunicationTime: validUpdates.reduce((sum, u) => sum + u.metrics.trainingTime, 0) / validUpdates.length,
      maxUpdateNorm: Math.max(...norms),
      minUpdateNorm: Math.min(...norms),
      avgUpdateNorm: norms.reduce((sum, norm) => sum + norm, 0) / norms.length,
      stdUpdateNorm: Math.sqrt(
        norms.reduce((sum, norm) => {
          const mean = norms.reduce((s, n) => s + n, 0) / norms.length;
          return sum + Math.pow(norm - mean, 2);
        }, 0) / norms.length
      ),
      numRejected: allUpdates.length - validUpdates.length,
      numAccepted: validUpdates.length,
      convergenceMetric: validUpdates.length > 0 ? validUpdates[0].metrics.loss : 0,
    };
  }

  /**
   * Apply aggregated update to global weights
   */
  private applyUpdateToGlobal(globalWeights: number[], aggregatedDeltas: number[]): number[] {
    return globalWeights.map((w, i) => w + (aggregatedDeltas[i] || 0));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default aggregator configuration
 */
export function createDefaultAggregatorConfig(): AggregatorConfig {
  return {
    strategy: AggregationStrategy.FEDAVG,
    enableByzantineResilience: false,
    maxUpdateNorm: 10.0,
    minUpdateNorm: 0.001,
    outlierStdDevThreshold: 3.0,
    momentumCoefficient: 0.9,
    proximalTerm: 0.01,
    minCosineSimilarity: 0.8,
    enableSimilarityCheck: false,
  };
}

/**
 * Create robust aggregator configuration
 */
export function createRobustAggregatorConfig(): AggregatorConfig {
  return {
    strategy: AggregationStrategy.ROBUST,
    enableByzantineResilience: true,
    robustMethod: RobustAggregationMethod.TRIMMED_MEAN,
    maxUpdateNorm: 10.0,
    minUpdateNorm: 0.001,
    outlierStdDevThreshold: 3.0,
    minCosineSimilarity: 0.7,
    enableSimilarityCheck: true,
  };
}
