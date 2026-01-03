/**
 * @lsi/vljepa-orpo - Preference Collector
 *
 * Collects UI preference pairs from multiple sources:
 * - A/B tests
 * - Shadow logging
 * - Explicit user feedback
 * - Implicit signals
 *
 * @module models
 */

import type {
  UIPreferencePair,
  UIState,
  PreferenceContext,
  PreferenceMetadata,
  PreferenceSource,
  CollectorConfig,
} from "../types.js";

/**
 * A/B test result
 */
interface ABTestResult {
  /** Test ID */
  testId: string;
  /** Variant A UI state */
  variantA: UIState;
  /** Variant B UI state */
  variantB: UIState;
  /** Win rate for variant A */
  winRateA: number;
  /** Win rate for variant B */
  winRateB: number;
  /** Sample size */
  sampleSize: number;
  /** Statistical significance */
  significance: number;
  /** Context */
  context: PreferenceContext;
  /** Timestamp */
  timestamp: number;
}

/**
 * Shadow log entry
 */
interface ShadowLogEntry {
  /** Session ID */
  sessionId: string;
  /** UI state before action */
  beforeState: UIState;
  /** UI state after action */
  afterState: UIState;
  /** User action */
  action: {
    type: "click" | "type" | "scroll" | "drag";
    target: string;
    position: { x: number; y: number };
  };
  /** Dwell time (milliseconds) */
  dwellTime: number;
  /** User satisfaction (implicit signal) */
  satisfaction?: number;
  /** Context */
  context: PreferenceContext;
  /** Timestamp */
  timestamp: number;
}

/**
 * Explicit feedback entry
 */
interface ExplicitFeedback {
  /** User ID (anonymized) */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** UI state shown */
  uiState: UIState;
  /** Alternative UI state (if comparison) */
  alternativeState?: UIState;
  /** User rating (1-5) */
  rating: number;
  /** User comment */
  comment?: string;
  /** Context */
  context: PreferenceContext;
  /** Timestamp */
  timestamp: number;
}

/**
 * Implicit signal entry
 */
interface ImplicitSignal {
  /** Session ID */
  sessionId: string;
  /** UI state */
  uiState: UIState;
  /** Interaction metrics */
  metrics: {
    /** Dwell time */
    dwellTime: number;
    /** Click count */
    clickCount: number;
    /** Scroll depth */
    scrollDepth: number;
    /** Conversion (if applicable) */
    converted: boolean;
    /** Bounce (left quickly) */
    bounced: boolean;
  };
  /** Context */
  context: PreferenceContext;
  /** Timestamp */
  timestamp: number;
}

/**
 * Preference Collector
 *
 * Collects UI preference pairs from multiple sources.
 * Aggregates, filters, and stores preferences for training.
 *
 * @example
 * ```typescript
 * const collector = new PreferenceCollector(config);
 * await collector.initialize();
 * await collector.collectFromABTests();
 * const pairs = collector.getCollectedPairs();
 * ```
 */
export class PreferenceCollector {
  private config: CollectorConfig;
  private collectedPairs: UIPreferencePair[];
  private sources: Map<string, PreferenceSource>;
  private initialized: boolean;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = {
      sources: [],
      samplingRate: 1.0,
      minConfidence: 0.5,
      anonymize: true,
      storagePath: "./data/preferences",
      ...config,
    };
    this.collectedPairs = [];
    this.sources = new Map();
    this.initialized = false;
  }

  /**
   * Initialize collector
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create storage directory
    const { promises: fs } = await import("fs");
    await fs.mkdir(this.config.storagePath, { recursive: true });

    // Initialize sources
    for (const source of this.config.sources) {
      const sourceId = `${source.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.sources.set(sourceId, source);
    }

    // Load existing pairs from storage
    await this.loadFromStorage();

    this.initialized = true;
  }

  /**
   * Collect preferences from A/B tests
   */
  async collectFromABTests(tests: ABTestResult[]): Promise<number> {
    const collected: UIPreferencePair[] = [];

    for (const test of tests) {
      // Skip if not statistically significant
      if (test.significance > 0.05) {
        continue;
      }

      // Determine chosen and rejected based on win rates
      const chosen =
        test.winRateA > test.winRateB ? test.variantA : test.variantB;
      const rejected =
        test.winRateA > test.winRateB ? test.variantB : test.variantA;

      // Calculate confidence based on sample size and win rate difference
      const winRateDiff = Math.abs(test.winRateA - test.winRateB);
      const confidence = Math.min(
        1.0,
        winRateDiff * 2 + Math.log10(test.sampleSize) * 0.1
      );

      // Skip if below confidence threshold
      if (confidence < this.config.minConfidence) {
        continue;
      }

      // Apply sampling
      if (Math.random() > this.config.samplingRate) {
        continue;
      }

      const pair = this.createPreferencePair({
        chosen,
        rejected,
        context: test.context,
        metadata: {
          source: "ab_test",
          confidence,
          timestamp: test.timestamp,
          sessionId: test.testId,
        },
      });

      collected.push(pair);
    }

    this.collectedPairs.push(...collected);
    await this.saveToStorage();

    return collected.length;
  }

  /**
   * Collect preferences from shadow logs
   */
  async collectFromShadowLogs(logs: ShadowLogEntry[]): Promise<number> {
    const collected: UIPreferencePair[] = [];

    for (const log of logs) {
      // After state is "chosen" if dwell time is good
      // Before state is "rejected" if user moved away quickly
      const dwellThreshold = 2000; // 2 seconds
      const satisfaction =
        log.satisfaction ?? (log.dwellTime > dwellThreshold ? 0.7 : 0.3);

      // Only collect if there's a clear preference
      if (Math.abs(satisfaction - 0.5) < 0.2) {
        continue;
      }

      const chosen = satisfaction > 0.5 ? log.afterState : log.beforeState;
      const rejected = satisfaction > 0.5 ? log.beforeState : log.afterState;

      // Confidence based on dwell time and action
      let confidence = 0.5;
      if (log.dwellTime > dwellThreshold * 5) confidence += 0.2;
      if (log.action.type === "click") confidence += 0.1;
      if (satisfaction > 0.8 || satisfaction < 0.2) confidence += 0.2;

      confidence = Math.min(1.0, confidence);

      if (confidence < this.config.minConfidence) {
        continue;
      }

      // Apply sampling
      if (Math.random() > this.config.samplingRate) {
        continue;
      }

      const pair = this.createPreferencePair({
        chosen,
        rejected,
        context: log.context,
        metadata: {
          source: "shadow_log",
          confidence,
          timestamp: log.timestamp,
          sessionId: log.sessionId,
        },
      });

      collected.push(pair);
    }

    this.collectedPairs.push(...collected);
    await this.saveToStorage();

    return collected.length;
  }

  /**
   * Collect preferences from explicit feedback
   */
  async collectFromExplicitFeedback(
    feedback: ExplicitFeedback[]
  ): Promise<number> {
    const collected: UIPreferencePair[] = [];

    for (const item of feedback) {
      // High rating = chosen, compare with alternative if available
      const highRatingThreshold = 4;
      const isPositive = item.rating >= highRatingThreshold;

      if (!item.alternativeState) {
        // No alternative, skip for now (could compare with average later)
        continue;
      }

      const chosen = isPositive ? item.uiState : item.alternativeState;
      const rejected = isPositive ? item.alternativeState : item.uiState;

      // Confidence based on rating
      const confidence = Math.abs(item.rating - 3) / 2; // 1-5 scale, 3 is neutral

      if (confidence < this.config.minConfidence) {
        continue;
      }

      // Apply sampling
      if (Math.random() > this.config.samplingRate) {
        continue;
      }

      // Anonymize user ID if enabled
      const userId = this.config.anonymize
        ? this.anonymizeUserId(item.userId)
        : item.userId;

      const pair = this.createPreferencePair({
        chosen,
        rejected,
        context: item.context,
        metadata: {
          source: "user_rating",
          confidence,
          timestamp: item.timestamp,
          sessionId: item.sessionId,
          userDemographics: {
            experienceLevel: "intermediate", // TODO: Infer from data
          },
        },
      });

      collected.push(pair);
    }

    this.collectedPairs.push(...collected);
    await this.saveToStorage();

    return collected.length;
  }

  /**
   * Collect preferences from implicit signals
   */
  async collectFromImplicitSignals(signals: ImplicitSignal[]): Promise<number> {
    const collected: UIPreferencePair[] = [];

    // Group signals by context to find patterns
    const contextGroups = new Map<string, ImplicitSignal[]>();

    for (const signal of signals) {
      const contextKey = `${signal.context.task}_${signal.context.uiContext}`;
      if (!contextGroups.has(contextKey)) {
        contextGroups.set(contextKey, []);
      }
      contextGroups.get(contextKey)!.push(signal);
    }

    // Compare signals within each context
    for (const [contextKey, groupSignals] of contextGroups) {
      if (groupSignals.length < 2) {
        continue;
      }

      // Sort by engagement (dwell time + interactions)
      groupSignals.sort((a, b) => {
        const engagementA = a.metrics.dwellTime + a.metrics.clickCount * 1000;
        const engagementB = b.metrics.dwellTime + b.metrics.clickCount * 1000;
        return engagementB - engagementA;
      });

      // Create pairs: top vs bottom
      const topSignal = groupSignals[0];
      const bottomSignal = groupSignals[groupSignals.length - 1];

      // Calculate confidence
      const engagementDiff =
        topSignal.metrics.dwellTime - bottomSignal.metrics.dwellTime;
      const confidence = Math.min(1.0, engagementDiff / 10000);

      if (confidence < this.config.minConfidence) {
        continue;
      }

      // Apply sampling
      if (Math.random() > this.config.samplingRate) {
        continue;
      }

      const pair = this.createPreferencePair({
        chosen: topSignal.uiState,
        rejected: bottomSignal.uiState,
        context: topSignal.context,
        metadata: {
          source: "shadow_log",
          confidence,
          timestamp: topSignal.timestamp,
          sessionId: topSignal.sessionId,
        },
      });

      collected.push(pair);
    }

    this.collectedPairs.push(...collected);
    await this.saveToStorage();

    return collected.length;
  }

  /**
   * Poll from external sources (if configured)
   */
  async pollFromSources(): Promise<number> {
    let totalCollected = 0;

    for (const [sourceId, source] of this.sources) {
      try {
        let collected = 0;

        switch (source.type) {
          case "ab_test":
            collected = await this.pollABTestSource(source);
            break;
          case "shadow_log":
            collected = await this.pollShadowLogSource(source);
            break;
          case "explicit":
            collected = await this.pollExplicitSource(source);
            break;
          case "implicit":
            collected = await this.pollImplicitSource(source);
            break;
        }

        totalCollected += collected;
      } catch (error) {
        console.error(`Error polling source ${sourceId}:`, error);
      }
    }

    return totalCollected;
  }

  /**
   * Get collected pairs
   */
  getCollectedPairs(filter?: {
    minConfidence?: number;
    sources?: string[];
    limit?: number;
  }): UIPreferencePair[] {
    let pairs = [...this.collectedPairs];

    // Apply filters
    if (filter?.minConfidence) {
      pairs = pairs.filter(p => p.metadata.confidence >= filter.minConfidence!);
    }

    if (filter?.sources && filter.sources.length > 0) {
      pairs = pairs.filter(p => filter.sources!.includes(p.metadata.source));
    }

    if (filter?.limit) {
      pairs = pairs.slice(0, filter.limit);
    }

    return pairs;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    bySource: Record<string, number>;
    avgConfidence: number;
    byUIContext: Record<string, number>;
  } {
    const bySource: Record<string, number> = {};
    const byUIContext: Record<string, number> = {};
    let totalConfidence = 0;

    for (const pair of this.collectedPairs) {
      bySource[pair.metadata.source] =
        (bySource[pair.metadata.source] || 0) + 1;
      byUIContext[pair.context.uiContext] =
        (byUIContext[pair.context.uiContext] || 0) + 1;
      totalConfidence += pair.metadata.confidence;
    }

    return {
      total: this.collectedPairs.length,
      bySource,
      avgConfidence:
        this.collectedPairs.length > 0
          ? totalConfidence / this.collectedPairs.length
          : 0,
      byUIContext,
    };
  }

  /**
   * Clear collected pairs
   */
  async clearCollected(): Promise<void> {
    this.collectedPairs = [];
    await this.saveToStorage();
  }

  /**
   * Create a preference pair
   */
  private createPreferencePair(options: {
    chosen: UIState;
    rejected: UIState;
    context: PreferenceContext;
    metadata: PreferenceMetadata;
  }): UIPreferencePair {
    const id = this.generatePairId(options.chosen, options.rejected);

    return {
      id,
      chosen: options.chosen,
      rejected: options.rejected,
      context: options.context,
      metadata: options.metadata,
    };
  }

  /**
   * Generate unique pair ID
   */
  private generatePairId(chosen: UIState, rejected: UIState): string {
    // Simple hash based on image data
    const chosenData = chosen.image.data.slice(0, 100);
    const rejectedData = rejected.image.data.slice(0, 100);

    let hash = 0;
    for (const byte of [...chosenData, ...rejectedData]) {
      hash = (hash << 5) - hash + byte;
      hash = hash & hash;
    }

    return `pair_${Date.now()}_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Anonymize user ID
   */
  private anonymizeUserId(userId: string): string {
    // Simple hash for anonymization
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Load pairs from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const { promises: fs } = await import("fs");
      const path = await import("path");

      const filePath = path.join(
        this.config.storagePath,
        "collected_pairs.jsonl"
      );

      const content = await fs.readFile(filePath, "utf8");
      const lines = content.trim().split("\n");

      for (const line of lines) {
        if (line) {
          const pair = JSON.parse(line) as UIPreferencePair;
          // Convert embedding back to Float32Array
          if (pair.chosen.embedding) {
            pair.chosen.embedding = new Float32Array(
              pair.chosen.embedding as unknown as number[]
            );
          }
          if (pair.rejected.embedding) {
            pair.rejected.embedding = new Float32Array(
              pair.rejected.embedding as unknown as number[]
            );
          }
          this.collectedPairs.push(pair);
        }
      }
    } catch (error) {
      // File doesn't exist yet, that's fine
      console.log("No existing collected pairs found");
    }
  }

  /**
   * Save pairs to storage
   */
  private async saveToStorage(): Promise<void> {
    const { promises: fs } = await import("fs");
    const path = await import("path");

    const filePath = path.join(
      this.config.storagePath,
      "collected_pairs.jsonl"
    );
    const lines = this.collectedPairs.map(pair => JSON.stringify(pair));

    await fs.writeFile(filePath, lines.join("\n"), "utf8");
  }

  /**
   * Poll A/B test source
   */
  private async pollABTestSource(source: PreferenceSource): Promise<number> {
    // TODO: Implement actual polling from A/B test endpoint
    return 0;
  }

  /**
   * Poll shadow log source
   */
  private async pollShadowLogSource(source: PreferenceSource): Promise<number> {
    // TODO: Implement actual polling from shadow log endpoint
    return 0;
  }

  /**
   * Poll explicit feedback source
   */
  private async pollExplicitSource(source: PreferenceSource): Promise<number> {
    // TODO: Implement actual polling from feedback endpoint
    return 0;
  }

  /**
   * Poll implicit signal source
   */
  private async pollImplicitSource(source: PreferenceSource): Promise<number> {
    // TODO: Implement actual polling from analytics endpoint
    return 0;
  }

  /**
   * Check if collector is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration
   */
  getConfig(): CollectorConfig {
    return { ...this.config };
  }
}

/**
 * Create a preference collector
 */
export async function createPreferenceCollector(
  config?: Partial<CollectorConfig>
): Promise<PreferenceCollector> {
  const collector = new PreferenceCollector(config);
  await collector.initialize();
  return collector;
}
