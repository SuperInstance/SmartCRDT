/**
 * @lsi/cascade - Preference Pair Generator for ORPO Training
 *
 * Generates preference pairs from shadow logs for ORPO (Odds Ratio Preference Optimization) training.
 *
 * Format: (query, chosen, rejected)
 * - chosen: Better response (higher quality, lower cost, lower latency)
 * - rejected: Worse response (lower quality, higher cost, higher latency)
 *
 * The generator analyzes shadow logs to find queries with multiple responses,
 * scores each response based on quality, cost, and latency, and generates
 * preference pairs where the "chosen" response is superior to the "rejected".
 *
 * Usage:
 * ```typescript
 * const generator = new PreferencePairGenerator({
 *   qualityWeight: 1.0,
 *   costWeight: 0.1,
 *   latencyWeight: 0.01,
 *   cacheBonusWeight: 0.05,
 *   minScoreDifference: 0.1,
 * });
 * const pairs = generator.generateFromLogs(shadowLogs);
 * const orpoData = generator.exportForORPO(pairs);
 * ```
 */

import { ShadowLogEntry } from "./ShadowLogger.js";

/**
 * Preference pair for ORPO training
 *
 * Represents a comparison between two responses to the same query,
 * where one is preferred over the other.
 */
export interface PreferencePair {
  /** Original query (may be redacted) */
  query: string;
  /** Better response (chosen) */
  chosen: string;
  /** Worse response (rejected) */
  rejected: string;
  /** Metadata for chosen response */
  chosenMetadata: {
    model: string;
    cost: number;
    latency: number;
    quality: number;
    backend: "local" | "cloud";
    score: number;
  };
  /** Metadata for rejected response */
  rejectedMetadata: {
    model: string;
    cost: number;
    latency: number;
    quality: number;
    backend: "local" | "cloud";
    score: number;
  };
  /** Why this pair was chosen */
  reason: string;
}

/**
 * Scoring configuration for preference pair generation
 */
export interface ScoringConfig {
  /** Weight for quality score (higher is better) */
  qualityWeight: number;
  /** Weight for cost penalty (lower is better) */
  costWeight: number;
  /** Weight for latency penalty (lower is better) */
  latencyWeight: number;
  /** Bonus for cached responses */
  cacheBonusWeight: number;
  /** Minimum score difference to create a pair */
  minScoreDifference: number;
}

/**
 * Score breakdown for a response
 */
interface ScoreBreakdown {
  total: number;
  quality: number;
  cost: number;
  latency: number;
  cacheBonus: number;
}

/**
 * PreferencePairGenerator - Generate ORPO training data from shadow logs
 *
 * Analyzes shadow logs to create preference pairs for training.
 * The scoring balances:
 * - Quality (higher is better)
 * - Cost (lower is better)
 * - Latency (lower is better)
 * - Cache bonus (cached responses are faster)
 */
export class PreferencePairGenerator {
  private config: ScoringConfig;

  /**
   * Create a new PreferencePairGenerator
   *
   * @param config - Optional scoring configuration
   */
  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = {
      qualityWeight: config.qualityWeight ?? 1.0,
      costWeight: config.costWeight ?? 0.1,
      latencyWeight: config.latencyWeight ?? 0.01,
      cacheBonusWeight: config.cacheBonusWeight ?? 0.05,
      minScoreDifference: config.minScoreDifference ?? 0.1,
    };
  }

  /**
   * Generate preference pairs from shadow logs
   *
   * Groups logs by query, scores each response, and creates
   * preference pairs by comparing the best and worst responses.
   *
   * @param logs - Shadow log entries
   * @returns Array of preference pairs
   */
  generateFromLogs(logs: ShadowLogEntry[]): PreferencePair[] {
    const pairs: PreferencePair[] = [];

    // Group logs by normalized query
    const queryGroups = this.groupByQuery(logs);

    // For each query with multiple responses, generate pairs
    const queryEntries = Array.from(queryGroups.entries());
    for (const [normalizedQuery, entries] of queryEntries) {
      if (entries.length < 2) {
        continue; // Need at least 2 responses to compare
      }

      // Score all responses
      const scoredEntries = entries.map(entry => ({
        entry,
        score: this.calculateScore(entry),
      }));

      // Sort by score (descending)
      scoredEntries.sort((a, b) => b.score.total - a.score.total);

      // Generate pairs (best vs worst, best vs second best, etc.)
      const numPairs = Math.min(scoredEntries.length - 1, 3); // Max 3 pairs per query

      for (let i = 1; i <= numPairs; i++) {
        const chosen = scoredEntries[0];
        const rejected = scoredEntries[i];

        // Only create pair if there's a meaningful difference
        if (
          chosen.score.total - rejected.score.total <
          this.config.minScoreDifference
        ) {
          continue;
        }

        pairs.push({
          query: chosen.entry.query,
          chosen: chosen.entry.response,
          rejected: rejected.entry.response,
          chosenMetadata: {
            model: chosen.entry.model,
            cost: (chosen.entry.metadata?.cost as number) ?? 0,
            latency: (chosen.entry.metadata?.latency as number) ?? 0,
            quality: chosen.score.quality,
            backend: chosen.entry.backend,
            score: chosen.score.total,
          },
          rejectedMetadata: {
            model: rejected.entry.model,
            cost: (rejected.entry.metadata?.cost as number) ?? 0,
            latency: (rejected.entry.metadata?.latency as number) ?? 0,
            quality: rejected.score.quality,
            backend: rejected.entry.backend,
            score: rejected.score.total,
          },
          reason: this.generateReason(chosen.score, rejected.score),
        });
      }
    }

    return pairs;
  }

  /**
   * Group shadow logs by normalized query
   *
   * Normalizes queries to group semantically similar queries together.
   * Removes punctuation, converts to lowercase, and normalizes whitespace.
   *
   * @param logs - Shadow log entries
   * @returns Map of normalized query to log entries
   */
  private groupByQuery(logs: ShadowLogEntry[]): Map<string, ShadowLogEntry[]> {
    const groups = new Map<string, ShadowLogEntry[]>();

    for (const log of logs) {
      // Normalize query for grouping
      const normalized = this.normalizeQuery(log.query);

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }

      groups.get(normalized)!.push(log);
    }

    return groups;
  }

  /**
   * Normalize query text for grouping
   *
   * - Convert to lowercase
   * - Remove punctuation
   * - Normalize whitespace
   * - Remove common stopwords
   *
   * @param query - Original query
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "shall",
      "can",
      "need",
      "dare",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "what",
      "which",
      "who",
      "whom",
      "this",
      "that",
      "these",
      "those",
      "am",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "having",
      "do",
      "does",
      "did",
      "doing",
      "a",
      "an",
      "the",
      "and",
      "but",
      "if",
      "or",
      "because",
      "as",
      "until",
      "while",
      "of",
      "at",
      "by",
      "for",
      "with",
      "about",
      "against",
      "between",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "to",
      "from",
      "up",
      "down",
      "in",
      "out",
      "on",
      "off",
      "over",
      "under",
      "again",
      "further",
      "then",
      "once",
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(word => word.length > 0 && !stopwords.has(word))
      .join(" ")
      .trim();
  }

  /**
   * Calculate score for a shadow log entry
   *
   * Score = quality - (cost * costWeight) - (latency * latencyWeight) + cacheBonus
   *
   * Higher scores indicate better responses.
   * Quality is estimated from metadata or defaults to 0.5.
   *
   * @param entry - Shadow log entry
   * @returns Score breakdown
   */
  private calculateScore(entry: ShadowLogEntry): ScoreBreakdown {
    // Estimate quality from metadata
    // If no quality score provided, estimate from:
    // - Latency (faster is usually better, but not always)
    // - Backend (local vs cloud preference)
    // - Redaction (redacted may indicate sensitive content)

    let quality = 0.5;
    // Note: quality property may not exist in metadata yet
    // if (entry.metadata && 'quality' in entry.metadata) {
    //   quality = entry.metadata.quality as number;
    // }

    // Adjust quality based on latency (very rough heuristic)
    const latency = (entry.metadata?.latency as number) ?? 0;
    if (latency > 0 && latency < 100) {
      quality = Math.min(1.0, quality + 0.1); // Fast responses are good
    } else if (latency > 1000) {
      quality = Math.max(0.0, quality - 0.1); // Slow responses are bad
    }

    // Adjust quality based on backend (prefer local for cost, cloud for quality)
    if (entry.backend === "cloud" && quality < 0.7) {
      quality += 0.1; // Cloud should be higher quality
    }

    // Calculate cost penalty
    const cost = (entry.metadata?.cost as number) ?? 0;
    const costPenalty = cost * this.config.costWeight;

    // Calculate latency penalty (convert ms to seconds for reasonable scale)
    const latencyPenalty = (latency / 1000) * this.config.latencyWeight;

    // Calculate cache bonus
    const cacheBonus = entry.metadata?.fromCache
      ? this.config.cacheBonusWeight
      : 0;

    // Total score
    const total =
      quality * this.config.qualityWeight -
      costPenalty -
      latencyPenalty +
      cacheBonus;

    return {
      total: Math.max(0, Math.min(1, total)), // Clamp to [0, 1]
      quality,
      cost: costPenalty,
      latency: latencyPenalty,
      cacheBonus,
    };
  }

  /**
   * Generate human-readable reason for preference
   *
   * @param chosenScore - Score of chosen response
   * @param rejectedScore - Score of rejected response
   * @returns Explanation of why chosen was preferred
   */
  private generateReason(
    chosenScore: ScoreBreakdown,
    rejectedScore: ScoreBreakdown
  ): string {
    const reasons: string[] = [];

    // Quality difference
    const qualityDiff = chosenScore.quality - rejectedScore.quality;
    if (Math.abs(qualityDiff) > 0.1) {
      reasons.push(qualityDiff > 0 ? "higher quality" : "lower quality");
    }

    // Cost difference
    const costDiff = chosenScore.cost - rejectedScore.cost;
    if (Math.abs(costDiff) > 0.01) {
      reasons.push(costDiff < 0 ? "lower cost" : "higher cost");
    }

    // Latency difference
    const latencyDiff = chosenScore.latency - rejectedScore.latency;
    if (Math.abs(latencyDiff) > 0.01) {
      reasons.push(latencyDiff < 0 ? "faster" : "slower");
    }

    if (reasons.length === 0) {
      return "Overall better score";
    }

    return reasons.join(", ");
  }

  /**
   * Export preference pairs in ORPO format
   *
   * Converts preference pairs to JSONL format for ORPO training.
   * Each line is a JSON object with: prompt, chosen, rejected
   *
   * @param pairs - Preference pairs
   * @returns JSONL-formatted string
   */
  exportForORPO(pairs: PreferencePair[]): string {
    const lines = pairs.map(pair =>
      JSON.stringify({
        prompt: pair.query,
        chosen: pair.chosen,
        rejected: pair.rejected,
      })
    );
    return lines.join("\n");
  }

  /**
   * Export preference pairs with metadata
   *
   * Includes full metadata for analysis and debugging.
   *
   * @param pairs - Preference pairs
   * @returns JSONL-formatted string with metadata
   */
  exportWithMetadata(pairs: PreferencePair[]): string {
    const lines = pairs.map(pair => JSON.stringify(pair));
    return lines.join("\n");
  }

  /**
   * Calculate statistics about preference pairs
   *
   * @param pairs - Preference pairs
   * @returns Statistics object
   */
  calculateStats(pairs: PreferencePair[]): {
    total: number;
    avgChosenQuality: number;
    avgRejectedQuality: number;
    avgScoreDifference: number;
    backendDistribution: { local: number; cloud: number };
  } {
    if (pairs.length === 0) {
      return {
        total: 0,
        avgChosenQuality: 0,
        avgRejectedQuality: 0,
        avgScoreDifference: 0,
        backendDistribution: { local: 0, cloud: 0 },
      };
    }

    const totalChosenQuality = pairs.reduce(
      (sum, p) => sum + p.chosenMetadata.quality,
      0
    );
    const totalRejectedQuality = pairs.reduce(
      (sum, p) => sum + p.rejectedMetadata.quality,
      0
    );
    const totalScoreDiff = pairs.reduce(
      (sum, p) => sum + (p.chosenMetadata.score - p.rejectedMetadata.score),
      0
    );

    const localChosen = pairs.filter(
      p => p.chosenMetadata.backend === "local"
    ).length;
    const cloudChosen = pairs.filter(
      p => p.chosenMetadata.backend === "cloud"
    ).length;

    return {
      total: pairs.length,
      avgChosenQuality: totalChosenQuality / pairs.length,
      avgRejectedQuality: totalRejectedQuality / pairs.length,
      avgScoreDifference: totalScoreDiff / pairs.length,
      backendDistribution: {
        local: localChosen,
        cloud: cloudChosen,
      },
    };
  }

  /**
   * Filter preference pairs by quality threshold
   *
   * Only includes pairs where the chosen response has a minimum quality score.
   *
   * @param pairs - Preference pairs
   * @param minQuality - Minimum quality threshold (0-1)
   * @returns Filtered preference pairs
   */
  filterByQuality(
    pairs: PreferencePair[],
    minQuality: number
  ): PreferencePair[] {
    return pairs.filter(pair => pair.chosenMetadata.quality >= minQuality);
  }

  /**
   * Filter preference pairs by cost difference
   *
   * Only includes pairs where there's a significant cost difference.
   *
   * @param pairs - Preference pairs
   * @param minDiff - Minimum cost difference
   * @returns Filtered preference pairs
   */
  filterByCostDifference(
    pairs: PreferencePair[],
    minDiff: number
  ): PreferencePair[] {
    return pairs.filter(
      pair =>
        Math.abs(pair.chosenMetadata.cost - pair.rejectedMetadata.cost) >=
        minDiff
    );
  }

  /**
   * Balance preference pairs by backend
   *
   * Ensures roughly equal representation of local and cloud chosen responses.
   * If only one backend is present, returns all pairs.
   *
   * @param pairs - Preference pairs
   * @returns Balanced preference pairs
   */
  balanceByBackend(pairs: PreferencePair[]): PreferencePair[] {
    const localPairs = pairs.filter(p => p.chosenMetadata.backend === "local");
    const cloudPairs = pairs.filter(p => p.chosenMetadata.backend === "cloud");

    // If one backend is missing, return all pairs
    if (localPairs.length === 0 || cloudPairs.length === 0) {
      return [...pairs];
    }

    const minCount = Math.min(localPairs.length, cloudPairs.length);

    // Sample equal amounts from each
    const balancedLocalPairs = localPairs.slice(0, minCount);
    const balancedCloudPairs = cloudPairs.slice(0, minCount);

    // Shuffle and combine
    return [...balancedLocalPairs, ...balancedCloudPairs].sort(
      () => Math.random() - 0.5
    );
  }
}

/**
 * Convenience function to create preference pairs from logs
 *
 * @param logs - Shadow log entries
 * @returns Array of preference pairs
 */
export function generatePreferencePairs(
  logs: ShadowLogEntry[]
): PreferencePair[] {
  const generator = new PreferencePairGenerator();
  return generator.generateFromLogs(logs);
}

/**
 * Convenience function to export pairs in ORPO format
 *
 * @param pairs - Preference pairs
 * @returns JSONL-formatted string
 */
export function exportForORPO(pairs: PreferencePair[]): string {
  const generator = new PreferencePairGenerator();
  return generator.exportForORPO(pairs);
}
