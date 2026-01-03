/**
 * FaultDetector - Byzantine Fault Detection for Ensemble Models
 *
 * Detects faulty or malicious model responses using multiple methods:
 * - Response time analysis
 * - Confidence analysis
 * - Semantic similarity checking
 * - Statistical outlier detection
 *
 * @package @lsi/privacy
 */

import type { IndividualResponse } from "./VotingMechanism.js";

/**
 * Detection method types
 */
export type OutlierMethod = "zscore" | "iqr" | "isolation";

/**
 * Fault reason types
 */
export type FaultReason =
  | "timeout" // Response too slow
  | "low_confidence" // Confidence below threshold
  | "semantic_outlier" // Response semantically very different
  | "statistical_outlier" // Statistical outlier
  | "error" // Returned error
  | "inconsistent"; // Inconsistent with previous behavior

/**
 * Fault detection configuration
 */
export interface FaultDetectionConfig {
  /** Enable response time detection */
  enableResponseTime: boolean;
  /** Enable confidence detection */
  enableConfidence: boolean;
  /** Enable semantic similarity detection */
  enableSemantic: boolean;
  /** Enable statistical outlier detection */
  enableStatistical: boolean;

  /** Response time threshold in milliseconds */
  responseTimeThreshold: number;
  /** Minimum confidence threshold (0-1) */
  confidenceThreshold: number;
  /** Semantic similarity threshold (0-1) */
  semanticSimilarityThreshold: number;

  /** Statistical outlier detection method */
  outlierMethod: OutlierMethod;
  /** Statistical outlier threshold (standard deviations or IQR multiplier) */
  outlierThreshold: number;
}

/**
 * Fault report for a single model
 */
export interface FaultReport {
  /** Model identifier */
  modelId: string;
  /** Whether model is faulty */
  isFaulty: boolean;
  /** Confidence in fault detection (0-1) */
  confidence: number;
  /** Reasons for fault detection */
  reasons: FaultReason[];
}

/**
 * Fault history for tracking model behavior over time
 */
interface FaultHistory {
  modelId: string;
  totalQueries: number;
  faultCount: number;
  recentFaults: number; // Last 10 queries
  averageConfidence: number;
  averageLatency: number;
}

/**
 * FaultDetector - Detect faulty or malicious models
 *
 * Uses multiple detection methods to identify models that may be
 * faulty, malicious, or behaving inconsistently.
 */
export class FaultDetector {
  private config: FaultDetectionConfig;
  private faultHistory: Map<string, FaultHistory> = new Map();

  constructor(config?: Partial<FaultDetectionConfig>) {
    this.config = {
      enableResponseTime: true,
      enableConfidence: true,
      enableSemantic: true,
      enableStatistical: true,
      responseTimeThreshold: 10000, // 10 seconds
      confidenceThreshold: 0.3,
      semanticSimilarityThreshold: 0.5,
      outlierMethod: "zscore",
      outlierThreshold: 2.0,
      ...config,
    };
  }

  /**
   * Detect faulty models from ensemble responses
   *
   * @param responses - Individual model responses
   * @returns Array of fault reports for each model
   */
  detectFaults(responses: IndividualResponse[]): FaultReport[] {
    const reports: FaultReport[] = [];

    for (const response of responses) {
      const reasons: FaultReason[] = [];
      let isFaulty = false;

      // Check for errors
      if (response.error) {
        reasons.push("error");
        isFaulty = true;
      }

      // Check response time
      if (this.config.enableResponseTime && this.checkResponseTime(response)) {
        reasons.push("timeout");
        isFaulty = true;
      }

      // Check confidence
      if (this.config.enableConfidence && this.checkConfidence(response)) {
        reasons.push("low_confidence");
        isFaulty = true;
      }

      reports.push({
        modelId: response.modelId,
        isFaulty,
        confidence: reasons.length > 0 ? 0.8 : 0.2,
        reasons,
      });
    }

    // Check statistical outliers
    if (this.config.enableStatistical) {
      const statisticalFaults = this.checkStatisticalOutliers(responses);
      for (const [modelId, isOutlier] of statisticalFaults) {
        const report = reports.find(r => r.modelId === modelId);
        if (report && isOutlier) {
          report.isFaulty = true;
          if (!report.reasons.includes("statistical_outlier")) {
            report.reasons.push("statistical_outlier");
          }
        }
      }
    }

    // Check semantic outliers (async, handled separately)
    // Semantic checking requires embeddings, done in ByzantineEnsemble

    // Update fault history
    for (const report of reports) {
      this.updateHistory(
        report.modelId,
        report.isFaulty,
        responses.find(r => r.modelId === report.modelId)
      );
    }

    return reports;
  }

  /**
   * Detect semantic outliers in responses
   *
   * This requires semantic similarity computation using embeddings.
   * Placeholder for now - full implementation requires embedding service.
   *
   * @param responses - Individual model responses
   * @returns Map of model IDs to outlier status
   */
  async detectSemanticOutliers(
    responses: IndividualResponse[]
  ): Promise<Map<string, boolean>> {
    const outliers = new Map<string, boolean>();

    if (!this.config.enableSemantic || responses.length < 2) {
      return outliers;
    }

    // Compute pairwise similarities
    const similarities: Map<string, number[]> = new Map();

    for (const response of responses) {
      const sims: number[] = [];

      for (const other of responses) {
        if (response.modelId === other.modelId) continue;

        // Compute similarity using simple metrics
        // In production, use embeddings for semantic similarity
        const similarity = this.computeTextSimilarity(
          response.response,
          other.response
        );
        sims.push(similarity);
      }

      similarities.set(response.modelId, sims);
    }

    // Mark outliers: models with average similarity below threshold
    for (const [modelId, sims] of similarities) {
      const avgSimilarity = sims.reduce((a, b) => a + b, 0) / sims.length;
      outliers.set(
        modelId,
        avgSimilarity < this.config.semanticSimilarityThreshold
      );
    }

    return outliers;
  }

  /**
   * Check response time against threshold
   *
   * @param response - Individual response to check
   * @returns True if response time exceeds threshold
   */
  private checkResponseTime(response: IndividualResponse): boolean {
    return response.latency > this.config.responseTimeThreshold;
  }

  /**
   * Check confidence against threshold
   *
   * @param response - Individual response to check
   * @returns True if confidence is below threshold
   */
  private checkConfidence(response: IndividualResponse): boolean {
    return response.confidence < this.config.confidenceThreshold;
  }

  /**
   * Check statistical outliers using multiple methods
   *
   * @param responses - Individual model responses
   * @returns Map of model IDs to outlier status
   */
  private checkStatisticalOutliers(
    responses: IndividualResponse[]
  ): Map<string, boolean> {
    const outliers = new Map<string, boolean>();
    const validResponses = responses.filter(r => !r.error);

    if (validResponses.length < 3) {
      return outliers;
    }

    switch (this.config.outlierMethod) {
      case "zscore":
        return this.zscoreOutlier(
          validResponses.map(r => r.confidence),
          this.config.outlierThreshold
        ).reduce((map, isOutlier, i) => {
          map.set(validResponses[i].modelId, isOutlier);
          return map;
        }, new Map<string, boolean>());

      case "iqr":
        return this.iqrOutlier(
          validResponses.map(r => r.confidence),
          this.config.outlierThreshold
        ).reduce((map, isOutlier, i) => {
          map.set(validResponses[i].modelId, isOutlier);
          return map;
        }, new Map<string, boolean>());

      case "isolation":
        // Simplified isolation forest approximation
        // In production, use proper isolation forest algorithm
        return this.zscoreOutlier(
          validResponses.map(r => r.confidence),
          this.config.outlierThreshold
        ).reduce((map, isOutlier, i) => {
          map.set(validResponses[i].modelId, isOutlier);
          return map;
        }, new Map<string, boolean>());
    }
  }

  /**
   * Z-score outlier detection
   *
   * Marks values that are more than threshold standard deviations from mean.
   *
   * @param values - Array of numeric values
   * @param threshold - Z-score threshold (default 2.0)
   * @returns Array of outlier flags
   */
  zscoreOutlier(values: number[], threshold = 2.0): boolean[] {
    if (values.length < 2) {
      return new Array(values.length).fill(false);
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return new Array(values.length).fill(false);
    }

    return values.map(val => Math.abs((val - mean) / stdDev) > threshold);
  }

  /**
   * Interquartile range (IQR) outlier detection
   *
   * Marks values outside Q1 - threshold*IQR or Q3 + threshold*IQR.
   *
   * @param values - Array of numeric values
   * @param threshold - IQR multiplier (default 1.5)
   * @returns Array of outlier flags
   */
  iqrOutlier(values: number[], threshold = 1.5): boolean[] {
    if (values.length < 4) {
      return new Array(values.length).fill(false);
    }

    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    if (iqr === 0) {
      return new Array(values.length).fill(false);
    }

    const lowerBound = q1 - threshold * iqr;
    const upperBound = q3 + threshold * iqr;

    return values.map(val => val < lowerBound || val > upperBound);
  }

  /**
   * Compute text similarity (simple implementation)
   *
   * In production, use embeddings for proper semantic similarity.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Similarity score (0-1)
   */
  private computeTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity on word sets
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 1;
    return intersection.size / union.size;
  }

  /**
   * Update fault history for a model
   *
   * @param modelId - Model identifier
   * @param isFaulty - Whether this query was faulty
   * @param response - Response data for statistics
   */
  private updateHistory(
    modelId: string,
    isFaulty: boolean,
    response?: IndividualResponse
  ): void {
    const existing = this.faultHistory.get(modelId);

    if (existing) {
      existing.totalQueries++;
      if (isFaulty) {
        existing.faultCount++;
        existing.recentFaults++;
      }

      // Update recent faults (sliding window of 10)
      if (existing.totalQueries % 10 === 0) {
        existing.recentFaults = 0;
      }

      if (response) {
        // Update running averages
        const alpha = 0.1; // Smoothing factor
        existing.averageConfidence =
          alpha * response.confidence +
          (1 - alpha) * existing.averageConfidence;
        existing.averageLatency =
          alpha * response.latency + (1 - alpha) * existing.averageLatency;
      }
    } else {
      this.faultHistory.set(modelId, {
        modelId,
        totalQueries: 1,
        faultCount: isFaulty ? 1 : 0,
        recentFaults: isFaulty ? 1 : 0,
        averageConfidence: response?.confidence ?? 0.5,
        averageLatency: response?.latency ?? 0,
      });
    }
  }

  /**
   * Get fault history for a model
   *
   * @param modelId - Model identifier
   * @returns Fault history or undefined
   */
  getFaultHistory(modelId: string): FaultHistory | undefined {
    return this.faultHistory.get(modelId);
  }

  /**
   * Get all fault history
   *
   * @returns Map of model IDs to fault history
   */
  getAllFaultHistory(): Map<string, FaultHistory> {
    return new Map(this.faultHistory);
  }

  /**
   * Clear all fault history
   */
  clearFaultHistory(): void {
    this.faultHistory.clear();
  }

  /**
   * Update detection configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<FaultDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): FaultDetectionConfig {
    return { ...this.config };
  }
}
