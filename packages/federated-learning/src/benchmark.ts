/**
 * @fileoverview Federated Aggregation Benchmark
 *
 * Compares FedAvg vs FedProx convergence under various conditions:
 * - IID vs Non-IID data distributions
 * - Homogeneous vs Heterogeneous client capabilities
 * - Byzantine attacks
 * - Communication efficiency
 *
 * Metrics tracked:
 * - Convergence rate (loss vs rounds)
 * - Final model accuracy
 * - Communication rounds to target accuracy
 * - Robustness to outliers/attacks
 *
 * @module @lsi/federated-learning/benchmark
 */

import {
  FedAvgAggregator,
  FedProxAggregator,
  KrumAggregator,
  ModelUpdate,
  AggregationResult,
  l2Norm,
} from "./aggregation.js";

import {
  SecureAggregator,
  VerifiableAggregator,
  compareAggregationMethods,
  computePrivacyGuarantee,
  type SecureAggregationConfig,
  type SecureAggregationResult,
  type SecretShare,
} from "./secure-aggregation.js";

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Number of federated rounds */
  numRounds: number;

  /** Number of clients */
  numClients: number;

  /** Model dimension */
  modelDim: number;

  /** Number of Byzantine clients (for robustness tests) */
  numByzantine?: number;

  /** Data distribution type */
  dataDistribution: "iid" | "non_iid" | "pathological";

  /** Client heterogeneity (0=homogeneous, 1=heterogeneous) */
  heterogeneity: number;

  /** Random seed */
  seed: number;
}

/**
 * Benchmark results
 */
export interface BenchmarkResults {
  /** Benchmark configuration */
  config: BenchmarkConfig;

  /** FedAvg results */
  fedAvg: AlgorithmResult;

  /** FedProx results */
  fedProx: AlgorithmResult;

  /** Comparison metrics */
  comparison: ComparisonMetrics;

  /** Timestamp */
  timestamp: number;
}

/**
 * Results for a single algorithm
 */
export interface AlgorithmResult {
  /** Algorithm name */
  name: string;

  /** Loss trajectory (per round) */
  lossTrajectory: number[];

  /** Accuracy trajectory (per round) */
  accuracyTrajectory: number[];

  /** Communication cost (number of parameters transmitted) */
  communicationCost: number;

  /** Final model */
  finalModel: number[];

  /** Convergence round (reached 95% of final accuracy) */
  convergenceRound?: number;

  /** Final loss */
  finalLoss: number;

  /** Final accuracy */
  finalAccuracy: number;

  /** Robustness metrics (if Byzantine test) */
  robustness?: RobustnessMetrics;
}

/**
 * Comparison between algorithms
 */
export interface ComparisonMetrics {
  /** FedProx improvement over FedAvg (accuracy) */
  accuracyImprovement: number;

  /** FedProx improvement over FedAvg (loss reduction) */
  lossReduction: number;

  /** Faster convergence (rounds) */
  convergenceSpeedup: number;

  /** Communication efficiency */
  communicationEfficiency: number;
}

/**
 * Robustness metrics
 */
export interface RobustnessMetrics {
  /** Accuracy under attack */
  accuracyUnderAttack: number;

  /** Accuracy degradation */
  accuracyDegradation: number;

  /** False positive rate (legitimate clients rejected) */
  falsePositiveRate: number;

  /** False negative rate (Byzantine clients accepted) */
  falseNegativeRate: number;
}

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  numRounds: 50,
  numClients: 10,
  modelDim: 100,
  numByzantine: 2,
  dataDistribution: "non_iid",
  heterogeneity: 0.7,
  seed: 42,
};

/**
 * Federated Aggregation Benchmark
 *
 * Runs comprehensive benchmarks comparing aggregation algorithms.
 */
export class AggregationBenchmark {
  private readonly config: BenchmarkConfig;
  private random: SeededRandom;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
    this.random = new SeededRandom(this.config.seed);
  }

  /**
   * Run full benchmark comparing FedAvg and FedProx
   */
  async runBenchmark(): Promise<BenchmarkResults> {
    console.log("=== Federated Aggregation Benchmark ===");
    console.log(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

    // Generate ground truth model
    const groundTruth = this.generateGroundTruth();

    // Run FedAvg
    console.log("\n--- Running FedAvg ---");
    const fedAvg = await this.runAlgorithm("fedavg", groundTruth);

    // Run FedProx
    console.log("\n--- Running FedProx ---");
    const fedProx = await this.runAlgorithm("fedprox", groundTruth);

    // Compare
    const comparison = this.compareResults(fedAvg, fedProx);

    return {
      config: this.config,
      fedAvg,
      fedProx,
      comparison,
      timestamp: Date.now(),
    };
  }

  /**
   * Run a single algorithm
   */
  private async runAlgorithm(
    algorithm: "fedavg" | "fedprox" | "krum",
    groundTruth: number[]
  ): Promise<AlgorithmResult> {
    const aggregator =
      algorithm === "fedavg"
        ? new FedAvgAggregator({ weightingStrategy: "data_size" })
        : algorithm === "fedprox"
          ? new FedProxAggregator({
              weightingStrategy: "data_size",
              mu: 0.1,
              maxDrift: 1.0,
              adaptiveMu: false,
              targetDrift: 0.5,
              learningRate: 0.01,
              minWeight: 0.01,
              maxWeight: 0.5,
              normalizeWeights: true,
              outlierDetection: true,
              outlierThreshold: 2.5,
            })
          : new KrumAggregator({
              maxByzantine: this.config.numByzantine ?? 2,
              method: "krum",
              distanceMetric: "euclidean",
              numUpdates: 3,
              trimFraction: 0.1,
            });

    const lossTrajectory: number[] = [];
    const accuracyTrajectory: number[] = [];

    // Initialize model
    let currentModel = this.initializeModel();
    let globalModel = currentModel;

    // Training rounds
    for (let round = 0; round < this.config.numRounds; round++) {
      // Generate client updates
      const updates = this.generateUpdates(
        currentModel,
        groundTruth,
        round
      );

      // Aggregate
      const result: AggregationResult = aggregator.aggregate(updates, globalModel);
      currentModel = result.parameters;
      globalModel = result.parameters;

      // Evaluate
      const loss = this.computeLoss(currentModel, groundTruth);
      const accuracy = this.computeAccuracy(currentModel, groundTruth);

      lossTrajectory.push(loss);
      accuracyTrajectory.push(accuracy);

      if (round % 10 === 0) {
        console.log(
          `  Round ${round}: loss=${loss.toFixed(4)}, accuracy=${accuracy.toFixed(4)}`
        );
      }
    }

    // Find convergence round
    const finalAccuracy = accuracyTrajectory[accuracyTrajectory.length - 1];
    const targetAccuracy = 0.95 * finalAccuracy;
    let convergenceRound: number | undefined;
    for (let i = 0; i < accuracyTrajectory.length; i++) {
      if (accuracyTrajectory[i] >= targetAccuracy) {
        convergenceRound = i;
        break;
      }
    }

    const communicationCost =
      this.config.numRounds * this.config.numClients * this.config.modelDim;

    return {
      name: algorithm,
      lossTrajectory,
      accuracyTrajectory,
      communicationCost,
      finalModel: currentModel,
      convergenceRound,
      finalLoss: lossTrajectory[lossTrajectory.length - 1],
      finalAccuracy,
    };
  }

  /**
   * Generate ground truth model
   */
  private generateGroundTruth(): number[] {
    const model: number[] = [];
    for (let i = 0; i < this.config.modelDim; i++) {
      model.push(this.random.nextGaussian() * 0.5);
    }
    return model;
  }

  /**
   * Initialize random model
   */
  private initializeModel(): number[] {
    const model: number[] = [];
    for (let i = 0; i < this.config.modelDim; i++) {
      model.push(this.random.nextGaussian() * 0.1);
    }
    return model;
  }

  /**
   * Generate client updates for a round
   */
  private generateUpdates(
    currentModel: number[],
    groundTruth: number[],
    round: number
  ): ModelUpdate[] {
    const updates: ModelUpdate[] = [];

    for (let i = 0; i < this.config.numClients; i++) {
      const update = this.generateClientUpdate(
        i,
        currentModel,
        groundTruth,
        round
      );
      updates.push(update);
    }

    // Add Byzantine updates if configured
    if (this.config.numByzantine && this.config.numByzantine > 0) {
      for (let i = 0; i < this.config.numByzantine; i++) {
        const idx = this.config.numClients - 1 - i;
        updates[idx] = this.generateByzantineUpdate(updates[idx], groundTruth);
      }
    }

    return updates;
  }

  /**
   * Generate update from a single client
   */
  private generateClientUpdate(
    clientId: number,
    currentModel: number[],
    groundTruth: number[],
    round: number
  ): ModelUpdate {
    // Client-specific data distribution
    const bias = this.getClientBias(clientId);
    const learningRate = 0.01 + this.random.nextGaussian() * 0.005;
    const numSamples = this.getClientNumSamples(clientId);
    const quality = 0.8 + this.random.nextGaussian() * 0.2;

    // Compute gradient based on local data
    const gradient = this.computeLocalGradient(
      currentModel,
      groundTruth,
      bias
    );

    // Apply local updates (simulate local epochs)
    const parameters = currentModel.map((p, i) => {
      const drift = (this.random.nextGaussian() * this.config.heterogeneity) / 10;
      return p - learningRate * gradient[i] + drift;
    });

    return {
      clientId: `client_${clientId}`,
      parameters,
      numSamples,
      quality: Math.max(0, Math.min(1, quality)),
      epochs: 1,
      loss: this.computeLoss(parameters, groundTruth),
      gradientNorm: l2Norm(gradient),
      timestamp: Date.now(),
    };
  }

  /**
   * Generate Byzantine (malicious) update
   */
  private generateByzantineUpdate(
    legitimate: ModelUpdate,
    groundTruth: number[]
  ): ModelUpdate {
    const byzantine = { ...legitimate };
    byzantine.clientId = `byzantine_${legitimate.clientId}`;

    // Attack strategies
    const attackType = this.random.nextInt(3);

    switch (attackType) {
      case 0:
        // Sign flip: invert the direction
        byzantine.parameters = legitimate.parameters.map((p, i) => {
          const center = groundTruth[i] ?? 0;
          return center - (p - center) * 2;
        });
        break;

      case 1:
        // Random noise: add large random values
        byzantine.parameters = legitimate.parameters.map(p => {
          return p + this.random.nextGaussian() * 2;
        });
        break;

      case 2:
        // Same value: all clients send identical update
        byzantine.parameters = legitimate.parameters.map(() => 5.0);
        break;
    }

    return byzantine;
  }

  /**
   * Get client-specific bias (non-IID data)
   */
  private getClientBias(clientId: number): number[] {
    const bias: number[] = [];

    for (let i = 0; i < this.config.modelDim; i++) {
      let biasValue = 0;

      switch (this.config.dataDistribution) {
        case "iid":
          // No bias
          biasValue = 0;
          break;

        case "non_iid":
          // Each client has bias toward certain parameters
          biasValue =
            (clientId % 3 === i % 3 ? 0.2 : -0.1) *
            this.config.heterogeneity;
          break;

        case "pathological":
          // Strong bias in opposite directions
          biasValue =
            (clientId < this.config.numClients / 2 ? 0.5 : -0.5) *
            this.config.heterogeneity;
          break;
      }

      bias.push(biasValue);
    }

    return bias;
  }

  /**
   * Get client's dataset size
   */
  private getClientNumSamples(clientId: number): number {
    const baseSize = 100;
    const variation = Math.floor(this.random.nextGaussian() * 20);
    return Math.max(10, baseSize + variation);
  }

  /**
   * Compute local gradient with bias
   */
  private computeLocalGradient(
    model: number[],
    groundTruth: number[],
    bias: number[]
  ): number[] {
    return model.map((p, i) => {
      const error = p - (groundTruth[i] ?? 0) - bias[i];
      return error + this.random.nextGaussian() * 0.01;
    });
  }

  /**
   * Compute loss (MSE)
   */
  private computeLoss(model: number[], groundTruth: number[]): number {
    let sum = 0;
    for (let i = 0; i < model.length; i++) {
      const error = model[i] - (groundTruth[i] ?? 0);
      sum += error * error;
    }
    return sum / model.length;
  }

  /**
   * Compute accuracy (inverse of normalized MSE)
   */
  private computeAccuracy(model: number[], groundTruth: number[]): number {
    const loss = this.computeLoss(model, groundTruth);
    const maxLoss = 1.0; // Normalized
    return Math.max(0, 1 - loss / maxLoss);
  }

  /**
   * Compare results between algorithms
   */
  private compareResults(
    fedAvg: AlgorithmResult,
    fedProx: AlgorithmResult
  ): ComparisonMetrics {
    const accuracyImprovement =
      ((fedProx.finalAccuracy - fedAvg.finalAccuracy) /
        fedAvg.finalAccuracy) *
      100;

    const lossReduction =
      ((fedAvg.finalLoss - fedProx.finalLoss) / fedAvg.finalLoss) * 100;

    const convergenceSpeedup = fedAvg.convergenceRound && fedProx.convergenceRound
      ? fedAvg.convergenceRound - fedProx.convergenceRound
      : 0;

    const communicationEfficiency =
      fedAvg.communicationCost / fedProx.communicationCost;

    return {
      accuracyImprovement,
      lossReduction,
      convergenceSpeedup,
      communicationEfficiency,
    };
  }

  /**
   * Format results as markdown report
   */
  formatResults(results: BenchmarkResults): string {
    const lines: string[] = [];

    lines.push("# Federated Aggregation Benchmark Results");
    lines.push("");
    lines.push("## Configuration");
    lines.push("```json");
    lines.push(JSON.stringify(results.config, null, 2));
    lines.push("```");
    lines.push("");

    lines.push("## FedAvg Results");
    lines.push("");
    lines.push(`- **Final Loss:** ${results.fedAvg.finalLoss.toFixed(6)}`);
    lines.push(`- **Final Accuracy:** ${(results.fedAvg.finalAccuracy * 100).toFixed(2)}%`);
    lines.push(
      `- **Convergence Round:** ${results.fedAvg.convergenceRound ?? "N/A"}`
    );
    lines.push(
      `- **Communication Cost:** ${results.fedAvg.communicationCost.toLocaleString()} parameters`
    );
    lines.push("");

    lines.push("## FedProx Results");
    lines.push("");
    lines.push(`- **Final Loss:** ${results.fedProx.finalLoss.toFixed(6)}`);
    lines.push(`- **Final Accuracy:** ${(results.fedProx.finalAccuracy * 100).toFixed(2)}%`);
    lines.push(
      `- **Convergence Round:** ${results.fedProx.convergenceRound ?? "N/A"}`
    );
    lines.push(
      `- **Communication Cost:** ${results.fedProx.communicationCost.toLocaleString()} parameters`
    );
    lines.push("");

    lines.push("## Comparison");
    lines.push("");
    lines.push(
      `- **Accuracy Improvement:** ${results.comparison.accuracyImprovement.toFixed(2)}%`
    );
    lines.push(
      `- **Loss Reduction:** ${results.comparison.lossReduction.toFixed(2)}%`
    );
    lines.push(
      `- **Convergence Speedup:** ${results.comparison.convergenceSpeedup} rounds`
    );
    lines.push(
      `- **Communication Efficiency:** ${results.comparison.communicationEfficiency.toFixed(2)}x`
    );
    lines.push("");

    lines.push("## Convergence Trajectories");
    lines.push("");
    lines.push("### Loss Over Rounds");
    lines.push("");
    lines.push("| Round | FedAvg Loss | FedProx Loss |");
    lines.push("|-------|-------------|--------------|");
    for (let i = 0; i < results.fedAvg.lossTrajectory.length; i += 5) {
      lines.push(
        `| ${i} | ${results.fedAvg.lossTrajectory[i].toFixed(6)} | ${results.fedProx.lossTrajectory[i].toFixed(6)} |`
      );
    }
    lines.push("");
    lines.push("### Accuracy Over Rounds");
    lines.push("");
    lines.push("| Round | FedAvg Acc | FedProx Acc |");
    lines.push("|-------|------------|-------------|");
    for (let i = 0; i < results.fedAvg.accuracyTrajectory.length; i += 5) {
      lines.push(
        `| ${i} | ${(results.fedAvg.accuracyTrajectory[i] * 100).toFixed(2)}% | ${(results.fedProx.accuracyTrajectory[i] * 100).toFixed(2)}% |`
      );
    }

    return lines.join("\n");
  }
}

/**
 * Seeded random number generator for reproducibility
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Mulberry32
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextGaussian(): number {
    // Box-Muller transform
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/**
 * Run quick benchmark for testing
 */
export async function runQuickBenchmark(): Promise<string> {
  const benchmark = new AggregationBenchmark({
    numRounds: 20,
    numClients: 8,
    modelDim: 50,
    dataDistribution: "non_iid",
    heterogeneity: 0.5,
    seed: 42,
  });

  const results = await benchmark.runBenchmark();
  return benchmark.formatResults(results);
}

// ============================================================================
// SECURE AGGREGATION BENCHMARKS
// ============================================================================

/**
 * Secure aggregation benchmark results
 */
export interface SecureBenchmarkResults {
  /** Plain aggregation results */
  plain: {
    time: number;
    accuracy: number;
    result: number[];
  };

  /** Secure aggregation results */
  secure: {
    time: number;
    accuracy: number;
    result: number[];
    verified: boolean;
  };

  /** Performance overhead */
  overhead: {
    timeRatio: number;
    timeAdded: number;
  };

  /** Privacy guarantees */
  privacy: {
    guarantee: string;
    confidentiality: string;
    robustness: string;
    differentialPrivacy: string;
  };

  /** Verification results */
  verification: {
    enabled: boolean;
    verified: boolean;
    proofTime: number;
  };
}

/**
 * Configuration for secure aggregation benchmark
 */
export interface SecureBenchmarkConfig {
  /** Number of clients */
  numClients: number;

  /** Model dimension */
  modelDim: number;

  /** Number of rounds */
  numRounds: number;

  /** Secure aggregation configuration */
  secureConfig: SecureAggregationConfig;

  /** Enable verifiable aggregation */
  enableVerification: boolean;

  /** Random seed */
  seed: number;
}

/**
 * Default secure benchmark configuration
 */
export const DEFAULT_SECURE_BENCHMARK_CONFIG: SecureBenchmarkConfig = {
  numClients: 10,
  modelDim: 100,
  numRounds: 20,
  secureConfig: {
    numServers: 4,
    threshold: 3,
    enableVerification: true,
    enablePairwiseMasking: true,
    epsilon: 1.0,
    delta: 1e-5,
  },
  enableVerification: true,
  seed: 42,
};

/**
 * Secure Aggregation Benchmark
 *
 * Benchmarks secure aggregation vs plain aggregation.
 * Measures performance overhead and privacy guarantees.
 */
export class SecureAggregationBenchmark {
  private readonly config: SecureBenchmarkConfig;
  private random: SeededRandom;

  constructor(config: Partial<SecureBenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_SECURE_BENCHMARK_CONFIG, ...config };
    this.random = new SeededRandom(this.config.seed);
  }

  /**
   * Run full secure aggregation benchmark
   */
  async runBenchmark(): Promise<SecureBenchmarkResults> {
    console.log("=== Secure Aggregation Benchmark ===");
    console.log(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

    // Generate test data
    const updates = this.generateUpdates(this.config.numClients, this.config.modelDim);

    // Run plain aggregation
    console.log("\n--- Running Plain Aggregation ---");
    const plainResult = this.runPlainAggregation(updates);

    // Run secure aggregation
    console.log("\n--- Running Secure Aggregation ---");
    const secureResult = await this.runSecureAggregation(updates);

    // Compute overhead
    const overhead = {
      timeRatio: secureResult.time / plainResult.time,
      timeAdded: secureResult.time - plainResult.time,
    };

    // Compute privacy guarantees
    const privacy = computePrivacyGuarantee(
      this.config.numClients,
      this.config.secureConfig.threshold ?? 3,
      this.config.secureConfig.epsilon ?? 1.0,
      this.config.secureConfig.delta ?? 1e-5
    );

    // Verification results
    const verification = {
      enabled: this.config.enableVerification,
      verified: secureResult.verification.verified,
      proofTime: secureResult.performance.decryptionTime,
    };

    return {
      plain: plainResult,
      secure: {
        time: secureResult.time,
        accuracy: secureResult.accuracy,
        result: secureResult.parameters,
        verified: secureResult.verification.verified,
      },
      overhead,
      privacy,
      verification,
    };
  }

  /**
   * Run plain federated averaging
   */
  private runPlainAggregation(
    updates: Array<{ parameters: number[]; numSamples: number }>
  ): { time: number; accuracy: number; result: number[] } {
    const start = Date.now();

    // Weighted average
    const dim = updates[0].parameters.length;
    const result = new Array(dim).fill(0);
    const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

    for (const update of updates) {
      const weight = update.numSamples / totalSamples;
      for (let i = 0; i < dim; i++) {
        result[i] += update.parameters[i] * weight;
      }
    }

    const time = Date.now() - start;

    // Compute accuracy (distance from origin as proxy)
    const accuracy = 1 / (1 + Math.sqrt(result.reduce((sum, v) => sum + v * v, 0) / dim));

    return { time, accuracy, result };
  }

  /**
   * Run secure aggregation
   */
  private async runSecureAggregation(
    updates: Array<{ parameters: number[]; numSamples: number }>
  ): Promise<SecureAggregationResult & { time: number; accuracy: number }> {
    const start = Date.now();

    // Create aggregator
    const aggregator = this.config.enableVerification
      ? new VerifiableAggregator(this.config.secureConfig)
      : new SecureAggregator(this.config.secureConfig);

    // Encrypt all updates
    const clientIds = updates.map((_, i) => `client_${i}`);
    const encryptedUpdates = updates.map((update, i) =>
      aggregator.encryptUpdate(
        clientIds[i],
        update.parameters,
        update.numSamples,
        clientIds.filter((_, j) => j !== i)
      )
    );

    // Aggregate shares at each server
    const config = aggregator.getConfig();
    const aggregatedShares: SecretShare[] = [];
    for (let i = 0; i < config.numServers; i++) {
      const serverId = `server_${i + 1}`;
      const share = aggregator.aggregateShares(serverId, encryptedUpdates);
      aggregatedShares.push(share);
    }

    // Decrypt aggregate
    const thresholdShares = aggregatedShares.slice(0, config.threshold);
    const doubleMaskCorrections = encryptedUpdates
      .map(u => u.doubleMaskCorrection)
      .filter((c): c is number[] => c !== undefined);
    const result = aggregator.decryptAggregate(thresholdShares, doubleMaskCorrections);

    const time = Date.now() - start;

    // Compute accuracy
    const accuracy = 1 / (1 + Math.sqrt(result.parameters.reduce((sum, v) => sum + v * v, 0) / result.parameters.length));

    return {
      ...result,
      time,
      accuracy,
    };
  }

  /**
   * Generate synthetic updates
   */
  private generateUpdates(
    numClients: number,
    modelDim: number
  ): Array<{ parameters: number[]; numSamples: number }> {
    const updates = [];

    for (let i = 0; i < numClients; i++) {
      const parameters: number[] = [];
      for (let j = 0; j < modelDim; j++) {
        parameters.push(this.random.nextGaussian() * 0.1);
      }

      const numSamples = 50 + Math.floor(this.random.nextGaussian() * 20);

      updates.push({ parameters, numSamples: Math.max(10, numSamples) });
    }

    return updates;
  }

  /**
   * Format results as markdown report
   */
  formatResults(results: SecureBenchmarkResults): string {
    const lines: string[] = [];

    lines.push("# Secure Aggregation Benchmark Results");
    lines.push("");
    lines.push("## Configuration");
    lines.push("```json");
    lines.push(JSON.stringify(this.config, null, 2));
    lines.push("```");
    lines.push("");

    lines.push("## Performance Comparison");
    lines.push("");
    lines.push("| Metric | Plain | Secure | Overhead |");
    lines.push("|--------|-------|--------|----------|");
    lines.push(`| Time (ms) | ${results.plain.time.toFixed(2)} | ${results.secure.time.toFixed(2)} | ${results.overhead.timeRatio.toFixed(2)}x |`);
    lines.push(`| Accuracy | ${results.plain.accuracy.toFixed(4)} | ${results.secure.accuracy.toFixed(4)} | - |`);
    lines.push("");

    lines.push("## Performance Overhead");
    lines.push("");
    lines.push(`- **Time Ratio:** ${results.overhead.timeRatio.toFixed(2)}x`);
    lines.push(`- **Additional Time:** ${results.overhead.timeAdded.toFixed(2)} ms`);
    lines.push("");

    lines.push("## Privacy Guarantees");
    lines.push("");
    lines.push(`- **Guarantee:** ${results.privacy.guarantee}`);
    lines.push(`- **Confidentiality:** ${results.privacy.confidentiality}`);
    lines.push(`- **Robustness:** ${results.privacy.robustness}`);
    lines.push(`- **Differential Privacy:** ${results.privacy.differentialPrivacy}`);
    lines.push("");

    lines.push("## Verification");
    lines.push("");
    lines.push(`- **Enabled:** ${results.verification.enabled ? "Yes" : "No"}`);
    lines.push(`- **Verified:** ${results.verification.verified ? "Yes" : "No"}`);
    lines.push(`- **Proof Time:** ${results.verification.proofTime.toFixed(2)} ms`);
    lines.push("");

    lines.push("## Detailed Results");
    lines.push("");
    lines.push("### Plain Aggregation");
    lines.push("");
    lines.push(`- Result (first 10): [${results.plain.result.slice(0, 10).map(v => v.toFixed(4)).join(", ")}...]`);
    lines.push("");

    lines.push("### Secure Aggregation");
    lines.push("");
    lines.push(`- Result (first 10): [${results.secure.result.slice(0, 10).map(v => v.toFixed(4)).join(", ")}...]`);
    lines.push(`- Difference (max): ${Math.max(...results.plain.result.map((p, i) => Math.abs(p - results.secure.result[i]))).toFixed(6)}`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Get configuration
   */
  getConfig(): SecureBenchmarkConfig {
    return { ...this.config };
  }
}

/**
 * Run quick secure aggregation benchmark
 */
export async function runQuickSecureBenchmark(): Promise<string> {
  const benchmark = new SecureAggregationBenchmark({
    numClients: 8,
    modelDim: 50,
    numRounds: 10,
    secureConfig: {
      numServers: 4,
      threshold: 3,
      enableVerification: true,
      enablePairwiseMasking: true,
    },
    enableVerification: true,
    seed: 42,
  });

  const results = await benchmark.runBenchmark();
  return benchmark.formatResults(results);
}
