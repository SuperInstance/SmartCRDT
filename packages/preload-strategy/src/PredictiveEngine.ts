/**
 * Predictive Engine - Markov chain based next-module prediction
 *
 * Uses Markov chains, frequency analysis, and sequence pattern detection
 * to predict which modules will be accessed next.
 */

import type {
  MarkovChain,
  MarkovTransition,
  PredictionResult,
  SequencePattern,
  PredictiveEngineConfig,
  PreloadCallback,
} from "./types.js";
import { UsageTracker } from "./UsageTracker.js";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: PredictiveEngineConfig = {
  enabled: true,
  minConfidence: 0.3,
  maxSequenceLength: 5,
  minPatternCount: 3,
  learningRate: 0.1,
  modelUpdateInterval: 30000, // 30 seconds
};

// ============================================================================
// Predictive Engine Class
// ============================================================================

export class PredictiveEngine {
  private config: PredictiveEngineConfig;
  private usageTracker: UsageTracker;
  private markovChains: Map<string, MarkovChain>;
  private sequencePatterns: SequencePattern[];
  private frequencyMap: Map<string, number>;
  private callbacks: Set<PreloadCallback>;
  private lastModelUpdate: number;

  constructor(
    usageTracker: UsageTracker,
    config: Partial<PredictiveEngineConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.usageTracker = usageTracker;
    this.markovChains = new Map();
    this.sequencePatterns = [];
    this.frequencyMap = new Map();
    this.callbacks = new Set();
    this.lastModelUpdate = 0;
  }

  // ========================================================================
  // Prediction API
  // ========================================================================

  /**
   * Predict next modules based on current module
   */
  predictNext(currentModule: string, limit = 5): PredictionResult[] {
    if (!this.config.enabled) {
      return [];
    }

    // Update model if needed
    this.updateModelIfNeeded();

    // Get predictions from Markov chain
    const markovPredictions = this.predictFromMarkov(currentModule, limit * 2);

    // Get predictions from sequence patterns
    const sequencePredictions = this.predictFromSequences(
      currentModule,
      limit * 2
    );

    // Get predictions from frequency
    const frequencyPredictions = this.predictFromFrequency(limit);

    // Combine and rank predictions
    const combined = this.combinePredictions([
      ...markovPredictions,
      ...sequencePredictions,
      ...frequencyPredictions,
    ]);

    // Filter by minimum confidence
    const filtered = combined
      .filter(p => p.confidence >= this.config.minConfidence)
      .slice(0, limit);

    // Notify callbacks
    for (const prediction of filtered) {
      this.notifyCallbacks(prediction);
    }

    return filtered;
  }

  /**
   * Predict modules likely to be accessed at current time
   */
  predictForCurrentTime(limit = 5): PredictionResult[] {
    if (!this.config.enabled) {
      return [];
    }

    const modules = this.usageTracker.getModulesForCurrentTime();
    const predictions: PredictionResult[] = modules.map(moduleName => ({
      moduleName,
      confidence: 0.6,
      reason: "Time-based pattern: frequently accessed at this time",
      relatedModules: [],
      timestamp: Date.now(),
    }));

    return predictions.slice(0, limit);
  }

  /**
   * Predict based on user's historical patterns
   */
  predictForUser(userId: string, limit = 5): PredictionResult[] {
    if (!this.config.enabled) {
      return [];
    }

    const userPattern = this.usageTracker.getUserPattern(userId);
    if (!userPattern) {
      return [];
    }

    // Get user's top modules by frequency
    const moduleEntries = Array.from(userPattern.patterns.entries())
      .sort((a, b) => b[1].accessFrequency - a[1].accessFrequency)
      .slice(0, limit);

    return moduleEntries.map(([moduleName, pattern]) => ({
      moduleName,
      confidence: Math.min(0.9, pattern.accessFrequency / 10),
      reason: "User-specific pattern: frequently accessed by this user",
      relatedModules: pattern.coAccess.map(c => c.moduleName),
      timestamp: Date.now(),
    }));
  }

  /**
   * Predict based on recent session context
   */
  predictFromSession(recentModules: string[], limit = 5): PredictionResult[] {
    if (!this.config.enabled || recentModules.length === 0) {
      return [];
    }

    const predictions = new Map<
      string,
      { confidence: number; reasons: string[] }
    >();

    // For each recent module, get co-access patterns
    for (const module of recentModules) {
      const coAccess = this.usageTracker.getCoAccessPatterns(module, limit * 2);

      for (const pattern of coAccess) {
        const existing = predictions.get(pattern.moduleName);
        const confidence = pattern.probability;
        const reason = `Co-access with ${module}`;

        if (existing) {
          existing.confidence = Math.max(existing.confidence, confidence);
          existing.reasons.push(reason);
        } else {
          predictions.set(pattern.moduleName, {
            confidence,
            reasons: [reason],
          });
        }
      }
    }

    // Convert to PredictionResult array
    return Array.from(predictions.entries())
      .map(([moduleName, data]) => ({
        moduleName,
        confidence: data.confidence,
        reason: data.reasons.join("; "),
        relatedModules: recentModules,
        timestamp: Date.now(),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  // ========================================================================
  // Model Training
  // ========================================================================

  /**
   * Train the predictive model with new access data
   */
  train(
    accessData: Array<{ moduleName: string; userId: string; timestamp: number }>
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // Record access data
    this.usageTracker.recordAccessBatch(accessData);

    // Update Markov chains
    for (let i = 0; i < accessData.length - 1; i++) {
      const current = accessData[i].moduleName;
      const next = accessData[i + 1].moduleName;
      this.updateMarkovChain(current, next);
    }

    // Update frequency map
    for (const access of accessData) {
      const count = this.frequencyMap.get(access.moduleName) || 0;
      this.frequencyMap.set(access.moduleName, count + 1);
    }

    // Detect new sequence patterns
    this.detectSequencePatterns(accessData);

    this.lastModelUpdate = Date.now();
  }

  /**
   * Incremental model update with single access
   */
  updateModel(moduleName: string, previousModule?: string): void {
    if (!this.config.enabled) {
      return;
    }

    // Update frequency
    const count = this.frequencyMap.get(moduleName) || 0;
    this.frequencyMap.set(moduleName, count + 1);

    // Update Markov chain if we have previous module
    if (previousModule) {
      this.updateMarkovChain(previousModule, moduleName);
    }

    this.lastModelUpdate = Date.now();
  }

  // ========================================================================
  // Callback Management
  // ========================================================================

  /**
   * Register callback for prediction events
   */
  onPrediction(callback: PreloadCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Unregister all callbacks
   */
  clearCallbacks(): void {
    this.callbacks.clear();
  }

  // ========================================================================
  // Model Inspection
  // ========================================================================

  /**
   * Get Markov chain for a module
   */
  getMarkovChain(moduleName: string): MarkovChain | undefined {
    return this.markovChains.get(moduleName);
  }

  /**
   * Get all Markov chains
   */
  getAllMarkovChains(): Map<string, MarkovChain> {
    return new Map(this.markovChains);
  }

  /**
   * Get sequence patterns
   */
  getSequencePatterns(): SequencePattern[] {
    return [...this.sequencePatterns];
  }

  /**
   * Get frequency map
   */
  getFrequencyMap(): Map<string, number> {
    return new Map(this.frequencyMap);
  }

  /**
   * Get model statistics
   */
  getStats(): {
    markovChains: number;
    sequencePatterns: number;
    totalTransitions: number;
    lastUpdate: number;
  } {
    let totalTransitions = 0;
    for (const chain of this.markovChains.values()) {
      totalTransitions += chain.totalCount;
    }

    return {
      markovChains: this.markovChains.size,
      sequencePatterns: this.sequencePatterns.length,
      totalTransitions,
      lastUpdate: this.lastModelUpdate,
    };
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  /**
   * Reset the predictive model
   */
  reset(): void {
    this.markovChains.clear();
    this.sequencePatterns = [];
    this.frequencyMap.clear();
    this.lastModelUpdate = 0;
  }

  /**
   * Export model data
   */
  export(): {
    markovChains: Record<string, MarkovChain>;
    sequencePatterns: SequencePattern[];
    frequencyMap: Record<string, number>;
    lastUpdate: number;
  } {
    return {
      markovChains: Object.fromEntries(this.markovChains),
      sequencePatterns: this.sequencePatterns,
      frequencyMap: Object.fromEntries(this.frequencyMap),
      lastUpdate: this.lastModelUpdate,
    };
  }

  /**
   * Import model data
   */
  import(data: {
    markovChains?: Record<string, MarkovChain>;
    sequencePatterns?: SequencePattern[];
    frequencyMap?: Record<string, number>;
    lastUpdate?: number;
  }): void {
    if (data.markovChains) {
      this.markovChains = new Map(
        Object.entries(data.markovChains).map(([k, v]) => [
          k,
          {
            ...v,
            transitions: new Map(Object.entries(v.transitions)),
          },
        ])
      );
    }
    if (data.sequencePatterns) {
      this.sequencePatterns = data.sequencePatterns;
    }
    if (data.frequencyMap) {
      this.frequencyMap = new Map(Object.entries(data.frequencyMap));
    }
    if (data.lastUpdate) {
      this.lastModelUpdate = data.lastUpdate;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private updateMarkovChain(from: string, to: string): void {
    let chain = this.markovChains.get(from);
    if (!chain) {
      chain = {
        state: from,
        transitions: new Map(),
        totalCount: 0,
      };
      this.markovChains.set(from, chain);
    }

    const count = chain.transitions.get(to) || 0;
    chain.transitions.set(to, count + 1);
    chain.totalCount++;
  }

  private predictFromMarkov(
    currentModule: string,
    limit: number
  ): PredictionResult[] {
    const chain = this.markovChains.get(currentModule);
    if (!chain || chain.totalCount === 0) {
      return [];
    }

    const transitions: MarkovTransition[] = Array.from(
      chain.transitions.entries()
    )
      .map(([to, count]) => ({
        from: currentModule,
        to,
        count,
        probability: count / chain.totalCount,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);

    return transitions.map(t => ({
      moduleName: t.to,
      confidence: t.probability,
      reason: `Markov prediction: ${t.from} -> ${t.to} (${(t.probability * 100).toFixed(1)}%)`,
      relatedModules: [t.from],
      timestamp: Date.now(),
    }));
  }

  private predictFromSequences(
    currentModule: string,
    limit: number
  ): PredictionResult[] {
    // Find sequences that end with or contain current module
    const relevantPatterns = this.sequencePatterns.filter(
      p =>
        p.sequence.includes(currentModule) ||
        p.sequence[p.sequence.length - 1] === currentModule
    );

    if (relevantPatterns.length === 0) {
      return [];
    }

    // Find what usually comes after current module
    const nextModuleCounts = new Map<string, number>();
    let totalCount = 0;

    for (const pattern of relevantPatterns) {
      const idx = pattern.sequence.indexOf(currentModule);
      if (idx >= 0 && idx < pattern.sequence.length - 1) {
        const nextModule = pattern.sequence[idx + 1];
        const count = (nextModuleCounts.get(nextModule) || 0) + pattern.count;
        nextModuleCounts.set(nextModule, count);
        totalCount += pattern.count;
      }
    }

    if (totalCount === 0) {
      return [];
    }

    return Array.from(nextModuleCounts.entries())
      .map(([moduleName, count]) => ({
        moduleName,
        confidence: (count / totalCount) * 0.8, // Slightly lower confidence than Markov
        reason: `Sequence pattern: follows ${currentModule} in ${count} sequences`,
        relatedModules: [currentModule],
        timestamp: Date.now(),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  private predictFromFrequency(limit: number): PredictionResult[] {
    const maxFreq = Math.max(...this.frequencyMap.values(), 1);

    return Array.from(this.frequencyMap.entries())
      .map(([moduleName, count]) => ({
        moduleName,
        confidence: (count / maxFreq) * 0.5, // Lower confidence for frequency-only
        reason: `High frequency: accessed ${count} times`,
        relatedModules: [],
        timestamp: Date.now(),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  private combinePredictions(
    predictions: PredictionResult[]
  ): PredictionResult[] {
    const combined = new Map<string, PredictionResult>();

    for (const pred of predictions) {
      const existing = combined.get(pred.moduleName);
      if (existing) {
        // Combine confidences using max
        existing.confidence = Math.max(existing.confidence, pred.confidence);
        existing.reason += ` | ${pred.reason}`;
        existing.relatedModules = [
          ...new Set([...existing.relatedModules, ...pred.relatedModules]),
        ];
      } else {
        combined.set(pred.moduleName, { ...pred });
      }
    }

    return Array.from(combined.values()).sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  private detectSequencePatterns(
    accessData: Array<{ moduleName: string; userId: string; timestamp: number }>
  ): void {
    if (accessData.length < 2) return;

    // Group by user
    const userAccesses = new Map<string, string[]>();
    for (const access of accessData) {
      const modules = userAccesses.get(access.userId) || [];
      modules.push(access.moduleName);
      userAccesses.set(access.userId, modules);
    }

    // Extract sequences from each user's access pattern
    for (const [userId, modules] of userAccesses.entries()) {
      for (
        let len = 2;
        len <= Math.min(this.config.maxSequenceLength, modules.length);
        len++
      ) {
        for (let i = 0; i <= modules.length - len; i++) {
          const sequence = modules.slice(i, i + len);
          this.addSequencePattern(sequence);
        }
      }
    }

    // Prune low-confidence patterns
    this.pruneSequencePatterns();
  }

  private addSequencePattern(sequence: string[]): void {
    const sequenceKey = sequence.join("->");

    // Check if pattern already exists
    const existing = this.sequencePatterns.find(
      p => p.sequence.join("->") === sequenceKey
    );
    if (existing) {
      existing.count++;
      existing.confidence = Math.min(1.0, existing.confidence * 0.9 + 0.1);
      return;
    }

    // Only add if we have enough data
    this.sequencePatterns.push({
      sequence,
      count: 1,
      confidence: 1 / sequence.length,
      avgTimeBetween: [],
    });
  }

  private pruneSequencePatterns(): void {
    this.sequencePatterns = this.sequencePatterns.filter(
      p =>
        p.count >= this.config.minPatternCount &&
        p.confidence >= this.config.minConfidence
    );

    // Sort by confidence and count
    this.sequencePatterns.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return b.confidence - a.confidence;
    });

    // Keep only top patterns
    this.sequencePatterns = this.sequencePatterns.slice(0, 1000);
  }

  private updateModelIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastModelUpdate > this.config.modelUpdateInterval) {
      this.lastModelUpdate = now;
      // Model will be updated on next access
    }
  }

  private notifyCallbacks(prediction: PredictionResult): void {
    for (const callback of this.callbacks) {
      try {
        callback(prediction);
      } catch (error) {
        console.error("Error in prediction callback:", error);
      }
    }
  }
}
