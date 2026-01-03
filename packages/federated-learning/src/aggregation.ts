/**
 * @fileoverview Federated Learning Aggregation Algorithms
 *
 * Implements state-of-the-art federated aggregation methods:
 * - FedAvg: Weighted averaging by dataset size
 * - FedProx: Proximal term for bounded client drift
 * - Byzantine-resilient: Krum and MultiKrum for adversarial robustness
 *
 * References:
 * - McMahan et al. (2017) "Communication-Efficient Learning of Deep Networks from Decentralized Data"
 * - Li et al. (2020) "Federated Optimization in Heterogeneous Networks"
 * - Blanchard et al. (2017) "Machine Learning with Adversaries: Byzantine Tolerant Gradient Descent"
 *
 * @module @lsi/federated-learning/aggregation
 */

/**
 * Model update from a federated client
 */
export interface ModelUpdate {
  /** Client identifier */
  clientId: string;

  /** Model parameters (flattened vector) */
  parameters: number[];

  /** Number of training samples */
  numSamples: number;

  /** Quality score (0-1) for weighted averaging */
  quality?: number;

  /** Local training epochs */
  epochs: number;

  /** Local loss value */
  loss: number;

  /** Gradient norm (for FedProx proximal term) */
  gradientNorm?: number;

  /** Timestamp of update */
  timestamp: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregation result with metrics
 */
export interface AggregationResult {
  /** Aggregated model parameters */
  parameters: number[];

  /** Number of clients participating */
  numClients: number;

  /** Total samples used for weighting */
  totalSamples: number;

  /** Weighting strategy used */
  weightingStrategy: "uniform" | "data_size" | "quality";

  /** Aggregation metrics */
  metrics: AggregationMetrics;

  /** Clients excluded (e.g., Byzantine detection) */
  excludedClients: string[];

  /** Aggregation timestamp */
  timestamp: number;
}

/**
 * Metrics from aggregation
 */
export interface AggregationMetrics {
  /** Average client distance from aggregated model */
  avgDistance: number;

  /** Maximum client distance */
  maxDistance: number;

  /** Standard deviation of distances */
  stdDistance: number;

  /** Average weight assigned to clients */
  avgWeight: number;

  /** Minimum weight assigned */
  minWeight: number;

  /** Maximum weight assigned */
  maxWeight: number;

  /** Convergence metric (L2 norm of change) */
  convergenceMetric: number;
}

/**
 * FedAvg configuration
 */
export interface FedAvgConfig {
  /** Weighting strategy */
  weightingStrategy: "uniform" | "data_size" | "quality";

  /** Minimum weight for a client (prevents extreme outliers) */
  minWeight?: number;

  /** Maximum weight for a client (prevents dominance) */
  maxWeight?: number;

  /** Normalize weights to sum to 1 */
  normalizeWeights?: boolean;

  /** Enable outlier detection */
  outlierDetection?: boolean;

  /** Outlier threshold (standard deviations) */
  outlierThreshold?: number;
}

/**
 * FedProx configuration
 */
export interface FedProxConfig extends FedAvgConfig {
  /** Proximal term coefficient (mu) */
  mu: number;

  /** Maximum allowed client drift */
  maxDrift: number;

  /** Enable adaptive mu */
  adaptiveMu?: boolean;

  /** Target drift for adaptive mu */
  targetDrift?: number;

  /** Learning rate for proximal term */
  learningRate?: number;
}

/**
 * Byzantine-resilient aggregation config
 */
export interface ByzantineConfig {
  /** Maximum number of Byzantine clients (f) */
  maxByzantine: number;

  /** Aggregation method */
  method: "krum" | "multi_krum" | "trimmed_mean" | "median";

  /** Distance metric for Krum */
  distanceMetric?: "euclidean" | "cosine" | "manhattan";

  /** For multi_krum: number of updates to select */
  numUpdates?: number;

  /** For trimmed_mean: fraction to trim (each side) */
  trimFraction?: number;
}

/**
 * Default configurations
 */
export const DEFAULT_FEDAVG_CONFIG: Required<FedAvgConfig> = {
  weightingStrategy: "data_size",
  minWeight: 0.01,
  maxWeight: 0.5,
  normalizeWeights: true,
  outlierDetection: true,
  outlierThreshold: 2.5,
};

export const DEFAULT_FEDPROX_CONFIG: Required<FedProxConfig> = {
  ...DEFAULT_FEDAVG_CONFIG,
  mu: 0.1,
  maxDrift: 1.0,
  adaptiveMu: false,
  targetDrift: 0.5,
  learningRate: 0.01,
};

export const DEFAULT_BYZANTINE_CONFIG: Required<ByzantineConfig> = {
  maxByzantine: 1,
  method: "krum",
  distanceMetric: "euclidean",
  numUpdates: 3,
  trimFraction: 0.1,
};

// ============================================================================
// FEDERATED AVERAGING (FedAvg)
// ============================================================================

/**
 * Federated Averaging (FedAvg) Aggregator
 *
 * Implements the classic FedAvg algorithm from McMahan et al. (2017).
 * Weighted averaging of model updates based on dataset sizes.
 *
 * Theory:
 * - Each client i has n_i samples
 * - Weight w_i = n_i / sum(n_j)
 * - Aggregated model = sum(w_i * theta_i)
 *
 * Benefits:
 * - Simple and efficient
 * - Proven convergence in IID and non-IID settings
 * - Natural weighting by data contribution
 *
 * @export
 */
export class FedAvgAggregator {
  protected readonly config: Required<FedAvgConfig>;

  constructor(config: FedAvgConfig = DEFAULT_FEDAVG_CONFIG) {
    this.config = { ...DEFAULT_FEDAVG_CONFIG, ...config };
  }

  /**
   * Aggregate model updates using FedAvg
   *
   * @param updates - List of client model updates
   * @param globalModel - Current global model (for convergence metrics)
   * @returns Aggregation result
   */
  aggregate(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    if (updates.length === 0) {
      throw new Error("Cannot aggregate empty update list");
    }

    // Step 1: Detect and filter outliers if enabled
    const filteredUpdates = this.config.outlierDetection
      ? this.filterOutliers(updates)
      : updates;

    // Step 2: Compute weights based on strategy
    const weights = this.computeWeights(filteredUpdates);

    // Step 3: Normalize weights if configured
    const normalizedWeights = this.config.normalizeWeights
      ? this.normalizeWeights(weights)
      : weights;

    // Step 4: Aggregate parameters
    const aggregated = this.weightedAverage(
      filteredUpdates,
      normalizedWeights
    );

    // Step 5: Compute metrics
    const metrics = this.computeMetrics(
      filteredUpdates,
      normalizedWeights,
      aggregated,
      globalModel
    );

    // Find excluded clients
    const excludedClients = updates
      .filter(u => !filteredUpdates.includes(u))
      .map(u => u.clientId);

    return {
      parameters: aggregated,
      numClients: filteredUpdates.length,
      totalSamples: filteredUpdates.reduce((sum, u) => sum + u.numSamples, 0),
      weightingStrategy: this.config.weightingStrategy,
      metrics,
      excludedClients,
      timestamp: Date.now(),
    };
  }

  /**
   * Compute weights for each update based on strategy
   */
  private computeWeights(updates: ModelUpdate[]): number[] {
    return updates.map(update => {
      let weight: number;

      switch (this.config.weightingStrategy) {
        case "uniform":
          weight = 1.0;
          break;

        case "data_size":
          weight = update.numSamples;
          break;

        case "quality":
          weight = update.quality ?? 1.0;
          break;
      }

      // Apply bounds
      weight = Math.max(this.config.minWeight, weight);
      weight = Math.min(this.config.maxWeight, weight);

      return weight;
    });
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return weights.map(() => 1 / weights.length);
    }
    return weights.map(w => w / sum);
  }

  /**
   * Compute weighted average of parameters
   */
  private weightedAverage(
    updates: ModelUpdate[],
    weights: number[]
  ): number[] {
    if (updates.length === 0) {
      return [];
    }

    const dim = updates[0].parameters.length;
    const aggregated = new Array(dim).fill(0);

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const weight = weights[i];

      if (update.parameters.length !== dim) {
        throw new Error(
          `Update from ${update.clientId} has dimension mismatch`
        );
      }

      for (let j = 0; j < dim; j++) {
        aggregated[j] += update.parameters[j] * weight;
      }
    }

    return aggregated;
  }

  /**
   * Filter outliers based on distance metrics
   */
  private filterOutliers(updates: ModelUpdate[]): ModelUpdate[] {
    if (updates.length <= 2) {
      return updates; // Need at least 3 for outlier detection
    }

    // Compute pairwise distances
    const distances = this.computePairwiseDistances(updates);

    // Compute mean distance for each update
    const meanDistances = distances.map(ds => {
      const sum = ds.reduce((a, b) => a + b, 0);
      return sum / ds.length;
    });

    // Compute mean and std of mean distances
    const mean = meanDistances.reduce((a, b) => a + b, 0) / meanDistances.length;
    const variance =
      meanDistances.reduce((sum, d) => sum + (d - mean) ** 2, 0) /
      meanDistances.length;
    const std = Math.sqrt(variance);

    // Filter outliers
    const threshold = mean + this.config.outlierThreshold * std;
    return updates.filter((_, i) => meanDistances[i] <= threshold);
  }

  /**
   * Compute pairwise distances between updates
   */
  private computePairwiseDistances(updates: ModelUpdate[]): number[][] {
    const n = updates.length;
    const distances: number[][] = [];

    for (let i = 0; i < n; i++) {
      distances[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else if (j < i) {
          distances[i][j] = distances[j][i];
        } else {
          distances[i][j] = this.euclideanDistance(
            updates[i].parameters,
            updates[j].parameters
          );
        }
      }
    }

    return distances;
  }

  /**
   * Compute Euclidean distance between vectors
   */
  protected euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute aggregation metrics
   */
  private computeMetrics(
    updates: ModelUpdate[],
    weights: number[],
    aggregated: number[],
    globalModel?: number[]
  ): AggregationMetrics {
    // Compute distances from aggregated model
    const distances = updates.map(u =>
      this.euclideanDistance(u.parameters, aggregated)
    );

    const avgDistance =
      distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDistance = Math.max(...distances);
    const variance =
      distances.reduce((sum, d) => sum + (d - avgDistance) ** 2, 0) /
      distances.length;
    const stdDistance = Math.sqrt(variance);

    // Weight statistics
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    // Convergence metric
    let convergenceMetric = 0;
    if (globalModel) {
      convergenceMetric = this.euclideanDistance(aggregated, globalModel);
    }

    return {
      avgDistance,
      maxDistance,
      stdDistance,
      avgWeight,
      minWeight,
      maxWeight,
      convergenceMetric,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<FedAvgConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FEDPROX (Proximal Term)
// ============================================================================

/**
 * FedProx Aggregator
 *
 * Extends FedAvg with a proximal term to bound client drift.
 * Addresses heterogeneity in client data and systems.
 *
 * Theory:
 * - Client objective: min L_k(w) + (mu/2) * ||w - w_global||^2
 * - Proximal term prevents clients from drifting too far
 * - Bounded drift improves convergence in heterogeneous settings
 *
 * Benefits:
 * - Handles non-IID data better than FedAvg
 * - Robust to varying client capabilities
 * - Theoretical convergence guarantees
 *
 * Reference: Li et al. (2020) "Federated Optimization in Heterogeneous Networks"
 *
 * @export
 */
export class FedProxAggregator extends FedAvgAggregator {
  protected readonly fedProxConfig: Required<FedProxConfig>;
  private currentMu: number;
  private previousGlobalModel?: number[];

  constructor(config: FedProxConfig = DEFAULT_FEDPROX_CONFIG) {
    super(config);
    this.fedProxConfig = { ...DEFAULT_FEDPROX_CONFIG, ...config };
    this.currentMu = this.fedProxConfig.mu;
  }

  /**
   * Aggregate with proximal regularization
   *
   * @param updates - Client updates
   * @param globalModel - Current global model (required for proximal term)
   * @returns Aggregation result
   */
  aggregate(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    if (!globalModel) {
      throw new Error("FedProx requires global model for proximal term");
    }

    // Store for next round
    this.previousGlobalModel = globalModel;

    // Adjust mu if adaptive
    if (this.fedProxConfig.adaptiveMu) {
      this.adjustMu(updates, globalModel);
    }

    // Apply proximal correction to updates
    const correctedUpdates = this.applyProximalCorrection(updates, globalModel);

    // Aggregate using parent FedAvg
    const result = super.aggregate(correctedUpdates, globalModel);

    return result;
  }

  /**
   * Apply proximal correction to client updates
   *
   * Brings updates closer to global model based on proximal term.
   */
  private applyProximalCorrection(
    updates: ModelUpdate[],
    globalModel: number[]
  ): ModelUpdate[] {
    return updates.map(update => {
      const corrected = { ...update };
      corrected.parameters = this.correctWithProximal(
        update.parameters,
        globalModel,
        update.gradientNorm ?? 1.0
      );
      return corrected;
    });
  }

  /**
   * Correct a single update with proximal term
   *
   * Formula: w_corrected = w_client - (lr * mu * (w_client - w_global))
   */
  private correctWithProximal(
    clientParams: number[],
    globalParams: number[],
    gradientNorm: number
  ): number[] {
    const lr = this.fedProxConfig.learningRate;
    const mu = this.currentMu;

    return clientParams.map((clientParam, i) => {
      const drift = clientParam - globalParams[i];
      const proximalTerm = mu * drift;

      // Apply correction bounded by maxDrift
      const corrected = clientParam - lr * proximalTerm;

      // Ensure drift is bounded
      const newDrift = corrected - globalParams[i];
      if (Math.abs(newDrift) > this.fedProxConfig.maxDrift) {
        return globalParams[i] + Math.sign(newDrift) * this.fedProxConfig.maxDrift;
      }

      return corrected;
    });
  }

  /**
   * Adaptively adjust mu based on client drift
   */
  private adjustMu(updates: ModelUpdate[], globalModel: number[]): void {
    // Compute average client drift
    const drifts = updates.map(u => {
      const distance = this.computeDistance(u.parameters, globalModel);
      return distance;
    });

    const avgDrift =
      drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const targetDrift = this.fedProxConfig.targetDrift;

    // Adjust mu to move towards target drift
    if (avgDrift > targetDrift) {
      // Too much drift, increase mu
      this.currentMu *= 1.1;
    } else if (avgDrift < targetDrift * 0.5) {
      // Too little drift, decrease mu
      this.currentMu *= 0.9;
    }

    // Bound mu
    this.currentMu = Math.max(0.001, Math.min(1.0, this.currentMu));
  }

  /**
   * Compute Euclidean distance (helper for FedProx)
   */
  private computeDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Get current mu value
   */
  getCurrentMu(): number {
    return this.currentMu;
  }

  /**
   * Reset mu to initial value
   */
  resetMu(): void {
    this.currentMu = this.fedProxConfig.mu;
  }
}

// ============================================================================
// BYZANTINE-RESILIENT AGGREGATION
// ============================================================================

/**
 * Krum Aggregator (Byzantine-resilient)
 *
 * Selects the update that is closest to other updates.
 * Robust to up to f Byzantine clients where n >= 2f + 3.
 *
 * Theory:
 * - Each update has a score based on distances to other updates
 * - Select update with minimum score
 * - Resistant to arbitrary malicious updates
 *
 * Reference: Blanchard et al. (2017)
 *
 * @export
 */
export class KrumAggregator {
  private readonly config: Required<ByzantineConfig>;
  private readonly fedAvg: FedAvgAggregator;

  constructor(config: ByzantineConfig = DEFAULT_BYZANTINE_CONFIG) {
    this.config = { ...DEFAULT_BYZANTINE_CONFIG, ...config };
    this.fedAvg = new FedAvgAggregator();
  }

  /**
   * Aggregate using Krum algorithm
   *
   * @param updates - Client updates
   * @param globalModel - Current global model
   * @returns Aggregation result
   */
  aggregate(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    if (updates.length < 2 * this.config.maxByzantine + 3) {
      throw new Error(
        `Krum requires at least ${2 * this.config.maxByzantine + 3} updates`
      );
    }

    switch (this.config.method) {
      case "krum":
        return this.aggregateKrum(updates, globalModel);
      case "multi_krum":
        return this.aggregateMultiKrum(updates, globalModel);
      case "trimmed_mean":
        return this.aggregateTrimmedMean(updates, globalModel);
      case "median":
        return this.aggregateMedian(updates, globalModel);
      default:
        throw new Error(`Unknown aggregation method: ${this.config.method}`);
    }
  }

  /**
   * Standard Krum: select single best update
   */
  private aggregateKrum(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    // Compute scores
    const scores = this.computeKrumScores(updates);

    // Find best (minimum score)
    let bestIdx = 0;
    let bestScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] < bestScore) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }

    // Use only the best update
    const selectedUpdate = updates[bestIdx];
    const excludedClients = updates
      .filter((_, i) => i !== bestIdx)
      .map(u => u.clientId);

    const aggregated = this.fedAvg.aggregate([selectedUpdate], globalModel);

    return {
      ...aggregated,
      excludedClients,
    };
  }

  /**
   * Multi-Krum: select top-k updates and average them
   */
  private aggregateMultiKrum(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    const numUpdates = Math.min(
      this.config.numUpdates,
      updates.length - this.config.maxByzantine
    );

    // Compute scores
    const scores = this.computeKrumScores(updates);

    // Sort by score and select top-k
    const indexed = scores.map((score, idx) => ({ score, idx }));
    indexed.sort((a, b) => a.score - b.score);

    const selectedIndices = indexed.slice(0, numUpdates).map(x => x.idx);
    const selectedUpdates = selectedIndices.map(i => updates[i]);

    const excludedClients = updates
      .filter((_, i) => !selectedIndices.includes(i))
      .map(u => u.clientId);

    const aggregated = this.fedAvg.aggregate(selectedUpdates, globalModel);

    return {
      ...aggregated,
      excludedClients,
    };
  }

  /**
   * Trimmed mean: remove extreme values and average
   */
  private aggregateTrimmedMean(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    const dim = updates[0].parameters.length;
    const aggregated = new Array(dim).fill(0);

    const numTrim = Math.floor(updates.length * this.config.trimFraction);

    for (let j = 0; j < dim; j++) {
      // Extract values for this dimension
      const values = updates.map(u => u.parameters[j]);

      // Sort and trim
      values.sort((a, b) => a - b);
      const trimmed = values.slice(numTrim, values.length - numTrim);

      // Average trimmed values
      aggregated[j] = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }

    const numClients = updates.length - 2 * numTrim;
    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

    // Compute metrics
    const distances = updates.map(u =>
      this.euclideanDistance(u.parameters, aggregated)
    );
    const avgDistance =
      distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDistance = Math.max(...distances);

    return {
      parameters: aggregated,
      numClients,
      totalSamples,
      weightingStrategy: "uniform",
      metrics: {
        avgDistance,
        maxDistance,
        stdDistance: 0,
        avgWeight: 1 / numClients,
        minWeight: 1 / numClients,
        maxWeight: 1 / numClients,
        convergenceMetric: globalModel
          ? this.euclideanDistance(aggregated, globalModel)
          : 0,
      },
      excludedClients: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Coordinate-wise median aggregation
   */
  private aggregateMedian(
    updates: ModelUpdate[],
    globalModel?: number[]
  ): AggregationResult {
    const dim = updates[0].parameters.length;
    const aggregated = new Array(dim).fill(0);

    for (let j = 0; j < dim; j++) {
      const values = updates.map(u => u.parameters[j]);
      values.sort((a, b) => a - b);

      // Median (for even n, use lower median)
      const mid = Math.floor(values.length / 2);
      aggregated[j] = values[mid];
    }

    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

    const distances = updates.map(u =>
      this.euclideanDistance(u.parameters, aggregated)
    );
    const avgDistance =
      distances.reduce((a, b) => a + b, 0) / distances.length;

    return {
      parameters: aggregated,
      numClients: updates.length,
      totalSamples,
      weightingStrategy: "uniform",
      metrics: {
        avgDistance,
        maxDistance: Math.max(...distances),
        stdDistance: 0,
        avgWeight: 1 / updates.length,
        minWeight: 1 / updates.length,
        maxWeight: 1 / updates.length,
        convergenceMetric: globalModel
          ? this.euclideanDistance(aggregated, globalModel)
          : 0,
      },
      excludedClients: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Compute Krum scores for each update
   *
   * Score = sum of distances to (n - f - 2) nearest neighbors
   */
  private computeKrumScores(updates: ModelUpdate[]): number[] {
    const n = updates.length;
    const f = this.config.maxByzantine;
    const numNeighbors = n - f - 2;

    // Compute pairwise distances
    const distances = this.computePairwiseDistances(updates);

    // Compute score for each update
    const scores: number[] = [];
    for (let i = 0; i < n; i++) {
      // Sort distances and take sum of numNeighbors smallest
      const sorted = distances[i].slice().sort((a, b) => a - b);
      const score = sorted.slice(0, numNeighbors).reduce((a, b) => a + b, 0);
      scores.push(score);
    }

    return scores;
  }

  /**
   * Compute pairwise distances
   */
  private computePairwiseDistances(updates: ModelUpdate[]): number[][] {
    const n = updates.length;
    const distances: number[][] = [];

    for (let i = 0; i < n; i++) {
      distances[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else if (j < i) {
          distances[i][j] = distances[j][i];
        } else {
          distances[i][j] = this.euclideanDistance(
            updates[i].parameters,
            updates[j].parameters
          );
        }
      }
    }

    return distances;
  }

  /**
   * Euclidean distance
   */
  protected euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Get configuration
   */
  getConfig(): Required<ByzantineConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// AGGREGATION FACTORY
// ============================================================================

/**
 * Aggregation method types
 */
export type AggregationMethod = "fedavg" | "fedprox" | "krum" | "multi_krum";

/**
 * Create an aggregator based on method
 *
 * @param method - Aggregation method
 * @param config - Configuration (method-specific)
 * @returns Aggregator instance
 */
export function createAggregator(
  method: AggregationMethod,
  config?: FedAvgConfig | FedProxConfig | ByzantineConfig
): FedAvgAggregator | FedProxAggregator | KrumAggregator {
  switch (method) {
    case "fedavg":
      return new FedAvgAggregator(config as FedAvgConfig);
    case "fedprox":
      return new FedProxAggregator(config as FedProxConfig);
    case "krum":
    case "multi_krum":
      return new KrumAggregator(config as ByzantineConfig);
    default:
      throw new Error(`Unknown aggregation method: ${method}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compute L2 norm of a vector
 */
export function l2Norm(vec: number[]): number {
  let sum = 0;
  for (const v of vec) {
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/**
 * Compute cosine similarity between vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute Manhattan distance between vectors
 */
export function manhattanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

/**
 * Validate model updates before aggregation
 */
export function validateUpdates(
  updates: ModelUpdate[],
  expectedDim?: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (updates.length === 0) {
    errors.push("No updates provided");
  }

  const dim = updates[0]?.parameters.length;

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];

    if (!update.clientId) {
      errors.push(`Update ${i} missing clientId`);
    }

    if (!update.parameters || update.parameters.length === 0) {
      errors.push(`Update ${i} has empty parameters`);
    }

    if (expectedDim && update.parameters.length !== expectedDim) {
      errors.push(
        `Update ${i} has dimension ${update.parameters.length}, expected ${expectedDim}`
      );
    }

    if (update.parameters.length !== dim) {
      errors.push(`Update ${i} has dimension mismatch`);
    }

    if (update.numSamples <= 0) {
      errors.push(`Update ${i} has invalid numSamples`);
    }

    if (update.quality !== undefined && (update.quality < 0 || update.quality > 1)) {
      errors.push(`Update ${i} has invalid quality score`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize model parameters (for stability)
 */
export function normalizeParameters(params: number[]): number[] {
  const norm = l2Norm(params);
  if (norm === 0) {
    return params;
  }
  return params.map(p => p / norm);
}

/**
 * Clip parameters to prevent explosion
 */
export function clipParameters(
  params: number[],
  maxNorm: number
): number[] {
  const norm = l2Norm(params);
  if (norm <= maxNorm) {
    return params;
  }
  const scale = maxNorm / norm;
  return params.map(p => p * scale);
}
