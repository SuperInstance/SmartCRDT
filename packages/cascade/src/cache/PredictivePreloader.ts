/**
 * PredictivePreloader - ML-based query prediction for proactive cache warming
 *
 * Uses machine learning to predict upcoming queries and preload them
 * into the cache before they are requested. Implements multiple prediction models:
 *
 * 1. Frequency Model - Predict based on historical query frequency
 * 2. Markov Chain Model - Predict based on query sequences
 * 3. Temporal Model - Predict based on time patterns
 * 4. Ensemble Model - Combine multiple models
 *
 * Features:
 * - Online learning (adapts to new queries in real-time)
 * - Confidence scoring for predictions
 * - Automatic model selection
 * - Performance tracking
 *
 * Example:
 * ```ts
 * const preloader = new PredictivePreloader({
 *   modelType: 'ensemble',
 *   confidenceThreshold: 0.7,
 *   maxPredictions: 20,
 * });
 * await preloader.train(queryLogs);
 * const predictions = await preloader.predict(recentQueries);
 * await preloader.preload(predictions, cache);
 * ```
 */

import type {
  QueryPrediction,
  QueryLogEntry,
  MarkovState,
  NeuralPredictionConfig,
  PredictiveWarmingConfig,
  QueryPattern,
} from "@lsi/protocol";
import type { SemanticCache } from "../refiner/SemanticCache.js";
import type { CascadeRouter } from "../router/CascadeRouter.js";

/**
 * Model type enumeration
 */
type ModelType = "frequency" | "markov" | "temporal" | "ensemble";

/**
 * Frequency model state
 */
interface FrequencyModelState {
  frequencies: Map<string, number>;
  totalQueries: number;
  lastUpdated: number;
}

/**
 * Markov chain model state
 */
interface MarkovModelState {
  chains: Map<string, Map<string, number>>; // prev -> next -> count
  order: number; // Order of Markov chain (1 = previous, 2 = previous 2, etc.)
}

/**
 * Temporal model state
 */
interface TemporalModelState {
  timeBuckets: Map<number, string[]>; // timestamp -> queries
  patterns: Map<string, number[]>; // pattern -> timestamps
}

/**
 * Ensemble model weights
 */
interface EnsembleWeights {
  frequency: number;
  markov: number;
  temporal: number;
}

/**
 * Training metrics
 */
interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingTime: number;
  sampleCount: number;
}

/**
 * PredictivePreloader - ML-based query prediction
 */
export class PredictivePreloader {
  private config: Required<PredictiveWarmingConfig>;
  private frequencyModel: FrequencyModelState;
  private markovModel: MarkovModelState;
  private temporalModel: TemporalModelState;
  private ensembleWeights: EnsembleWeights;
  private trainingMetrics: TrainingMetrics | null = null;

  constructor(config: Partial<PredictiveWarmingConfig> = {}) {
    this.config = {
      modelType: config.modelType ?? "frequency",
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      maxPredictions: config.maxPredictions ?? 20,
      trainingSize: config.trainingSize ?? 1000,
    };

    // Initialize models
    this.frequencyModel = {
      frequencies: new Map(),
      totalQueries: 0,
      lastUpdated: Date.now(),
    };

    this.markovModel = {
      chains: new Map(),
      order: 1, // First-order Markov chain
    };

    this.temporalModel = {
      timeBuckets: new Map(),
      patterns: new Map(),
    };

    // Initialize ensemble weights (equal initially)
    this.ensembleWeights = {
      frequency: 0.33,
      markov: 0.33,
      temporal: 0.34,
    };
  }

  /**
   * Train prediction model on historical query logs
   *
   * @param queryLogs - Historical query logs
   * @returns Training metrics
   */
  async train(queryLogs: QueryLogEntry[]): Promise<TrainingMetrics> {
    const startTime = Date.now();

    // Limit training size
    const trainingData = queryLogs.slice(-this.config.trainingSize);

    // Train all models
    await this.trainFrequencyModel(trainingData);
    await this.trainMarkovModel(trainingData);
    await this.trainTemporalModel(trainingData);

    // Calculate ensemble weights if using ensemble
    if (this.config.modelType === "ensemble") {
      await this.calculateEnsembleWeights(trainingData);
    }

    const trainingTime = Date.now() - startTime;

    // Calculate training metrics
    this.trainingMetrics = {
      accuracy: await this.evaluateAccuracy(trainingData),
      precision: await this.evaluatePrecision(trainingData),
      recall: await this.evaluateRecall(trainingData),
      f1Score: 0, // Calculated below
      trainingTime,
      sampleCount: trainingData.length,
    };

    // Calculate F1 score
    const { precision, recall } = this.trainingMetrics;
    this.trainingMetrics.f1Score =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return this.trainingMetrics;
  }

  /**
   * Predict next queries based on recent history
   *
   * @param recentQueries - Recent query history
   * @returns Array of predictions
   */
  async predict(recentQueries: string[]): Promise<QueryPrediction[]> {
    switch (this.config.modelType) {
      case "frequency":
        return this.predictFrequency(recentQueries);

      case "markov":
        return this.predictMarkov(recentQueries);

      case "temporal":
        return this.predictTemporal(recentQueries);

      case "ensemble":
        return this.predictEnsemble(recentQueries);

      default:
        return [];
    }
  }

  /**
   * Preload predicted queries into cache
   *
   * @param predictions - Predictions to preload
   * @param cache - Cache to preload into
   * @param router - Router to use for generating results
   * @returns Number of successfully preloaded queries
   */
  async preload(
    predictions: QueryPrediction[],
    cache: SemanticCache,
    router: CascadeRouter
  ): Promise<number> {
    let successCount = 0;

    // Filter by confidence threshold
    const validPredictions = predictions.filter(
      p => p.confidence >= this.config.confidenceThreshold
    );

    // Sort by confidence (highest first)
    validPredictions.sort((a, b) => b.confidence - a.confidence);

    // Preload top predictions
    const toPreload = validPredictions.slice(0, this.config.maxPredictions);

    for (const prediction of toPreload) {
      try {
        // Route query to generate result
        const result = await router.route(prediction.query, {
          timestamp: Date.now(),
          sessionId: "preload",
          query: prediction.query,
        });

        // Cache will automatically store the result
        successCount++;
      } catch (error) {
        console.warn(
          `[PredictivePreloader] Failed to preload query: ${prediction.query}`,
          error
        );
      }
    }

    console.log(
      `[PredictivePreloader] Preloaded ${successCount}/${toPreload.length} queries`
    );

    return successCount;
  }

  /**
   * Train frequency model
   *
   * @param queryLogs - Query logs for training
   */
  private async trainFrequencyModel(queryLogs: QueryLogEntry[]): Promise<void> {
    this.frequencyModel.frequencies.clear();
    this.frequencyModel.totalQueries = queryLogs.length;

    for (const log of queryLogs) {
      const normalized = this.normalizeQuery(log.query);
      const count = this.frequencyModel.frequencies.get(normalized) ?? 0;
      this.frequencyModel.frequencies.set(normalized, count + 1);
    }

    this.frequencyModel.lastUpdated = Date.now();
  }

  /**
   * Train Markov chain model
   *
   * @param queryLogs - Query logs for training
   */
  private async trainMarkovModel(queryLogs: QueryLogEntry[]): Promise<void> {
    this.markovModel.chains.clear();

    // Group by session
    const sessionQueries = new Map<string, string[]>();
    for (const log of queryLogs) {
      if (!sessionQueries.has(log.sessionId)) {
        sessionQueries.set(log.sessionId, []);
      }
      sessionQueries.get(log.sessionId)!.push(log.query);
    }

    // Build Markov chains
    for (const queries of sessionQueries.values()) {
      for (let i = 0; i < queries.length - 1; i++) {
        const current = this.normalizeQuery(queries[i]);
        const next = this.normalizeQuery(queries[i + 1]);

        if (!this.markovModel.chains.has(current)) {
          this.markovModel.chains.set(current, new Map());
        }

        const nextMap = this.markovModel.chains.get(current)!;
        const count = nextMap.get(next) ?? 0;
        nextMap.set(next, count + 1);
      }
    }
  }

  /**
   * Train temporal model
   *
   * @param queryLogs - Query logs for training
   */
  private async trainTemporalModel(queryLogs: QueryLogEntry[]): Promise<void> {
    this.temporalModel.timeBuckets.clear();
    this.temporalModel.patterns.clear();

    // Group queries by time buckets (hour of day)
    for (const log of queryLogs) {
      const hour = new Date(log.timestamp).getHours();
      const normalized = this.normalizeQuery(log.query);

      if (!this.temporalModel.timeBuckets.has(hour)) {
        this.temporalModel.timeBuckets.set(hour, []);
      }
      this.temporalModel.timeBuckets.get(hour)!.push(normalized);
    }

    // Build temporal patterns
    for (const [hour, queries] of this.temporalModel.timeBuckets.entries()) {
      const frequencies = new Map<string, number>();
      for (const query of queries) {
        const count = frequencies.get(query) ?? 0;
        frequencies.set(query, count + 1);
      }

      for (const [query, count] of frequencies.entries()) {
        if (!this.temporalModel.patterns.has(query)) {
          this.temporalModel.patterns.set(query, []);
        }
        this.temporalModel.patterns.get(query)!.push(hour);
      }
    }
  }

  /**
   * Calculate ensemble weights based on model performance
   *
   * @param queryLogs - Query logs for evaluation
   */
  private async calculateEnsembleWeights(
    queryLogs: QueryLogEntry[]
  ): Promise<void> {
    // Evaluate each model
    const frequencyAccuracy = await this.evaluateModel("frequency", queryLogs);
    const markovAccuracy = await this.evaluateModel("markov", queryLogs);
    const temporalAccuracy = await this.evaluateModel("temporal", queryLogs);

    // Normalize weights
    const total = frequencyAccuracy + markovAccuracy + temporalAccuracy;

    this.ensembleWeights = {
      frequency: frequencyAccuracy / total,
      markov: markovAccuracy / total,
      temporal: temporalAccuracy / total,
    };

    console.log(
      `[PredictivePreloader] Ensemble weights:`,
      this.ensembleWeights
    );
  }

  /**
   * Predict using frequency model
   *
   * @param recentQueries - Recent query history (ignored for frequency model)
   * @returns Frequency-based predictions
   */
  private predictFrequency(recentQueries: string[]): QueryPrediction[] {
    const predictions: QueryPrediction[] = [];

    // Get top frequent queries
    const sorted = Array.from(this.frequencyModel.frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxPredictions);

    for (const [query, count] of sorted) {
      const confidence = count / this.frequencyModel.totalQueries;
      predictions.push({
        query,
        confidence,
        predictedTime: Date.now() + 60000, // 1 minute from now
        reasoning: `High frequency query (${count}/${this.frequencyModel.totalQueries})`,
      });
    }

    return predictions;
  }

  /**
   * Predict using Markov chain model
   *
   * @param recentQueries - Recent query history
   * @returns Markov-based predictions
   */
  private predictMarkov(recentQueries: string[]): QueryPrediction[] {
    if (recentQueries.length === 0) {
      return [];
    }

    const predictions: QueryPrediction[] = [];
    const lastQuery = this.normalizeQuery(recentQueries[recentQueries.length - 1]);

    // Get next queries from Markov chain
    const nextMap = this.markovModel.chains.get(lastQuery);
    if (!nextMap) {
      return [];
    }

    // Calculate total count for normalization
    const totalCount = Array.from(nextMap.values()).reduce((a, b) => a + b, 0);

    // Get top predictions
    const sorted = Array.from(nextMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxPredictions);

    for (const [query, count] of sorted) {
      const confidence = count / totalCount;
      predictions.push({
        query,
        confidence,
        predictedTime: Date.now() + 60000,
        reasoning: `Markov chain prediction (${count}/${totalCount} transitions)`,
      });
    }

    return predictions;
  }

  /**
   * Predict using temporal model
   *
   * @param recentQueries - Recent query history (ignored for temporal model)
   * @returns Temporal-based predictions
   */
  private predictTemporal(recentQueries: string[]): QueryPrediction[] {
    const predictions: QueryPrediction[] = [];
    const currentHour = new Date().getHours();

    // Get queries for current time bucket
    const bucketQueries = this.temporalModel.timeBuckets.get(currentHour) || [];

    // Calculate frequencies
    const frequencies = new Map<string, number>();
    for (const query of bucketQueries) {
      const count = frequencies.get(query) ?? 0;
      frequencies.set(query, count + 1);
    }

    // Get top predictions
    const sorted = Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxPredictions);

    for (const [query, count] of sorted) {
      const confidence = count / bucketQueries.length;
      predictions.push({
        query,
        confidence,
        predictedTime: Date.now() + 60000,
        reasoning: `Temporal pattern for hour ${currentHour} (${count}/${bucketQueries.length})`,
      });
    }

    return predictions;
  }

  /**
   * Predict using ensemble model
   *
   * @param recentQueries - Recent query history
   * @returns Ensemble-based predictions
   */
  private async predictEnsemble(recentQueries: string[]): Promise<QueryPrediction[]> {
    // Get predictions from each model
    const frequencyPredictions = this.predictFrequency(recentQueries);
    const markovPredictions = this.predictMarkov(recentQueries);
    const temporalPredictions = this.predictTemporal(recentQueries);

    // Combine predictions
    const combined = new Map<string, QueryPrediction>();

    // Add frequency predictions
    for (const pred of frequencyPredictions) {
      combined.set(pred.query, {
        ...pred,
        confidence: pred.confidence * this.ensembleWeights.frequency,
      });
    }

    // Add Markov predictions
    for (const pred of markovPredictions) {
      const existing = combined.get(pred.query);
      if (existing) {
        existing.confidence += pred.confidence * this.ensembleWeights.markov;
      } else {
        combined.set(pred.query, {
          ...pred,
          confidence: pred.confidence * this.ensembleWeights.markov,
        });
      }
    }

    // Add temporal predictions
    for (const pred of temporalPredictions) {
      const existing = combined.get(pred.query);
      if (existing) {
        existing.confidence += pred.confidence * this.ensembleWeights.temporal;
      } else {
        combined.set(pred.query, {
          ...pred,
          confidence: pred.confidence * this.ensembleWeights.temporal,
        });
      }
    }

    // Convert to array and sort by confidence
    const predictions = Array.from(combined.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPredictions);

    return predictions;
  }

  /**
   * Evaluate model accuracy
   *
   * @param modelType - Model to evaluate
   * @param queryLogs - Query logs for evaluation
   * @returns Accuracy score
   */
  private async evaluateModel(
    modelType: ModelType,
    queryLogs: QueryLogEntry[]
  ): Promise<number> {
    // Simple evaluation: check if next query is in top N predictions
    let correct = 0;
    let total = 0;

    for (let i = 0; i < queryLogs.length - 1; i++) {
      const recentQueries = queryLogs.slice(Math.max(0, i - 5), i).map(l => l.query);
      const actualNext = queryLogs[i + 1].query;

      let predictions: QueryPrediction[] = [];
      switch (modelType) {
        case "frequency":
          predictions = this.predictFrequency(recentQueries);
          break;
        case "markov":
          predictions = this.predictMarkov(recentQueries);
          break;
        case "temporal":
          predictions = this.predictTemporal(recentQueries);
          break;
      }

      const topPredictions = predictions.slice(0, 5).map(p => this.normalizeQuery(p.query));
      if (topPredictions.includes(this.normalizeQuery(actualNext))) {
        correct++;
      }
      total++;
    }

    return total > 0 ? correct / total : 0;
  }

  /**
   * Evaluate overall accuracy
   *
   * @param queryLogs - Query logs for evaluation
   * @returns Accuracy score
   */
  private async evaluateAccuracy(queryLogs: QueryLogEntry[]): Promise<number> {
    return this.evaluateModel(this.config.modelType as ModelType, queryLogs);
  }

  /**
   * Evaluate precision
   *
   * @param queryLogs - Query logs for evaluation
   * @returns Precision score
   */
  private async evaluatePrecision(queryLogs: QueryLogEntry[]): Promise<number> {
    // Precision: TP / (TP + FP)
    // Simplified: percentage of predictions that were correct
    let correct = 0;
    let totalPredictions = 0;

    for (let i = 0; i < queryLogs.length - 1; i++) {
      const recentQueries = queryLogs.slice(Math.max(0, i - 5), i).map(l => l.query);
      const actualNext = this.normalizeQuery(queryLogs[i + 1].query);

      const predictions = await this.predict(recentQueries);
      const topPredictions = predictions.slice(0, 5);

      for (const pred of topPredictions) {
        totalPredictions++;
        if (this.normalizeQuery(pred.query) === actualNext) {
          correct++;
        }
      }
    }

    return totalPredictions > 0 ? correct / totalPredictions : 0;
  }

  /**
   * Evaluate recall
   *
   * @param queryLogs - Query logs for evaluation
   * @returns Recall score
   */
  private async evaluateRecall(queryLogs: QueryLogEntry[]): Promise<number> {
    // Recall: TP / (TP + FN)
    // Simplified: percentage of actual queries that were predicted
    let predicted = 0;
    let total = 0;

    for (let i = 0; i < queryLogs.length - 1; i++) {
      const recentQueries = queryLogs.slice(Math.max(0, i - 5), i).map(l => l.query);
      const actualNext = this.normalizeQuery(queryLogs[i + 1].query);

      const predictions = await this.predict(recentQueries);
      const topPredictions = predictions
        .slice(0, 5)
        .map(p => this.normalizeQuery(p.query));

      if (topPredictions.includes(actualNext)) {
        predicted++;
      }
      total++;
    }

    return total > 0 ? predicted / total : 0;
  }

  /**
   * Normalize query for comparison
   *
   * @param query - Query to normalize
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
  }

  /**
   * Get training metrics
   *
   * @returns Training metrics or null if not trained
   */
  getTrainingMetrics(): TrainingMetrics | null {
    return this.trainingMetrics;
  }

  /**
   * Get model statistics
   */
  getStats() {
    return {
      modelType: this.config.modelType,
      confidenceThreshold: this.config.confidenceThreshold,
      maxPredictions: this.config.maxPredictions,
      frequencyModelSize: this.frequencyModel.frequencies.size,
      markovModelSize: this.markovModel.chains.size,
      temporalModelSize: this.temporalModel.timeBuckets.size,
      ensembleWeights: this.ensembleWeights,
      trained: this.trainingMetrics !== null,
    };
  }

  /**
   * Clear all models
   */
  clear(): void {
    this.frequencyModel = {
      frequencies: new Map(),
      totalQueries: 0,
      lastUpdated: Date.now(),
    };

    this.markovModel = {
      chains: new Map(),
      order: 1,
    };

    this.temporalModel = {
      timeBuckets: new Map(),
      patterns: new Map(),
    };

    this.trainingMetrics = null;
  }
}

/**
 * Default predictive preloader configuration
 */
export const DEFAULT_PREDICTIVE_PRELOADER_CONFIG: Partial<PredictiveWarmingConfig> =
  {
    modelType: "ensemble",
    confidenceThreshold: 0.7,
    maxPredictions: 20,
    trainingSize: 1000,
  };
