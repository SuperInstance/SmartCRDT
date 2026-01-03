/**
 * @lsi/vljepa-orpo - ORPO Legacy Bridge
 *
 * Connects multimodal ORPO with existing @lsi/superinstance ORPO implementation.
 * Enables sharing preference data and training results.
 *
 * @module integrations
 */

import type { UIPreferencePair } from "../types.js";

/**
 * Legacy preference pair format (from superinstance)
 */
interface LegacyPreferencePair {
  id: string;
  query: string;
  chosen: {
    content: string;
    backend: "local" | "cloud";
    model: string;
    reason: string;
  };
  rejected: {
    content: string;
    backend: "local" | "cloud";
    model: string;
    reason: string;
  };
  metadata: {
    timestamp: number;
    ratingDifference?: number;
    latencyDifference?: number;
    costDifference?: number;
    privacyLevel: "public" | "private" | "sensitive";
    qualityScore: number;
  };
}

/**
 * Shadow log entry from superinstance
 */
interface ShadowLogEntry {
  query: { query: string; cost?: number };
  response: {
    content: string;
    model: string;
    backend: "local" | "cloud";
    latency: number;
    fromCache?: boolean;
  };
  sessionId: string;
  timestamp: number;
  userRating?: number;
}

/**
 * ORPO config from superinstance
 */
interface LegacyORPOConfig {
  baseModel: string;
  lora: {
    r: number;
    alpha: number;
    dropout: number;
    targetModules: string[];
  };
  beta: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
}

/**
 * ORPOLegacyBridge
 *
 * Bridges between multimodal ORPO and legacy superinstance ORPO.
 *
 * @example
 * ```typescript
 * const bridge = new ORPOLegacyBridge();
 * const pairs = await bridge.convertShadowLogs(shadowLogs);
 */
export class ORPOLegacyBridge {
  /**
   * Convert shadow log entries to UI preference pairs
   */
  convertShadowLogs(shadowLogs: ShadowLogEntry[]): UIPreferencePair[] {
    // Group by query
    const byQuery = new Map<string, ShadowLogEntry[]>();

    for (const log of shadowLogs) {
      const query = log.query.query;
      if (!byQuery.has(query)) {
        byQuery.set(query, []);
      }
      byQuery.get(query)!.push(log);
    }

    const pairs: UIPreferencePair[] = [];

    // Create preference pairs from grouped logs
    for (const [query, entries] of byQuery) {
      if (entries.length < 2) {
        continue;
      }

      // Sort by quality (latency, user rating, cost)
      const sorted = this.sortByQuality(entries);

      // Create pairs: best vs rest
      for (let i = 1; i < sorted.length; i++) {
        const chosen = sorted[0];
        const rejected = sorted[i];

        // Create UI states (placeholders)
        const chosenUI = this.createPlaceholderUIState(chosen);
        const rejectedUI = this.createPlaceholderUIState(rejected);

        pairs.push({
          id: `legacy_${Date.now()}_${pairs.length}`,
          chosen: chosenUI,
          rejected: rejectedUI,
          context: {
            task: query,
            userIntent: query,
            uiContext: "text_generation",
            constraints: {},
          },
          metadata: {
            source: "shadow_log",
            confidence: this.calculateConfidence(chosen, rejected),
            timestamp: Date.now(),
            sessionId: chosen.sessionId,
          },
        });
      }
    }

    return pairs;
  }

  /**
   * Convert UI preference pairs to legacy preference pairs
   */
  toLegacyPairs(uiPairs: UIPreferencePair[]): LegacyPreferencePair[] {
    return uiPairs.map(pair => ({
      id: pair.id,
      query: pair.context.task,
      chosen: {
        content: this.uiStateToText(pair.chosen),
        backend: "local",
        model: "vljepa-orpo",
        reason: "Visually preferred UI state",
      },
      rejected: {
        content: this.uiStateToText(pair.rejected),
        backend: "local",
        model: "vljepa-orpo",
        reason: "Less preferred UI state",
      },
      metadata: {
        timestamp: pair.metadata.timestamp,
        ratingDifference: undefined,
        latencyDifference: undefined,
        costDifference: undefined,
        privacyLevel: "public" as const,
        qualityScore: pair.metadata.confidence,
      },
    }));
  }

  /**
   * Convert legacy config to multimodal config
   */
  convertConfig(
    legacyConfig: LegacyORPOConfig
  ): Partial<import("../types.js").MultimodalORPOConfig> {
    return {
      baseModel: {
        embeddingDim: 768,
        usePretrained: true,
      },
      referenceModel: {
        enabled: true,
        frozen: true,
      },
      preferenceHead: {
        type: "mlp",
        hiddenDims: [1536, 768, 384, 1],
        activation: "gelu",
        dropout: legacyConfig.lora.dropout,
        useLayerNorm: true,
        useResiduals: true,
      },
      orpo: {
        beta: legacyConfig.beta,
        lambda: 1.0,
        sftLossWeight: 1.0,
      },
      training: {
        learningRate: legacyConfig.learningRate,
        batchSize: legacyConfig.batchSize,
        epochs: legacyConfig.epochs,
        warmupRatio: 0.1,
        gradientClipping: 1.0,
        weightDecay: 0.01,
      },
      multimodal: {
        visualWeight: 0.5,
        textWeight: 0.5,
        fusion: "concat",
      },
    };
  }

  /**
   * Sort entries by quality
   */
  private sortByQuality(entries: ShadowLogEntry[]): ShadowLogEntry[] {
    return [...entries].sort((a, b) => {
      const scoreA = this.computeQualityScore(a);
      const scoreB = this.computeQualityScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Compute quality score for shadow log entry
   */
  private computeQualityScore(entry: ShadowLogEntry): number {
    let score = 0.5;

    // User rating (highest weight)
    if (entry.userRating) {
      score += (entry.userRating - 3) * 0.2;
    }

    // Latency (lower is better, up to 5 seconds)
    const latencyScore = Math.max(0, 1 - entry.response.latency / 5000);
    score += latencyScore * 0.2;

    // Cache hit bonus
    if (entry.response.fromCache) {
      score += 0.1;
    }

    // Local processing bonus
    if (entry.response.backend === "local") {
      score += 0.1;
    }

    // Cost (lower is better)
    if (entry.query.cost) {
      const costScore = Math.max(0, 1 - entry.query.cost / 0.01);
      score += costScore * 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Create placeholder UI state from shadow log
   */
  private createPlaceholderUIState(
    entry: ShadowLogEntry
  ): import("../types.js").UIState {
    // Generate deterministic embedding from content
    const hash = this.hashString(entry.response.content);
    const embedding = this.hashToEmbedding(hash);

    return {
      image: this.createPlaceholderImage(),
      embedding,
      dom: {
        tagName: "div",
        id: `ui_${entry.timestamp}`,
        classes: ["generated"],
        children: [],
        attributes: {},
        text: entry.response.content.substring(0, 100),
      },
      styles: {
        display: "block",
        padding: "16px",
      },
    };
  }

  /**
   * Create placeholder image
   */
  private createPlaceholderImage(): ImageData {
    const size = 224; // Standard ViT input size
    const data = new Uint8ClampedArray(size * size * 4);

    // Fill with neutral color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 240; // R
      data[i + 1] = 240; // G
      data[i + 2] = 240; // B
      data[i + 3] = 255; // A
    }

    return { data, width: size, height: size, colorSpace: "srgb" };
  }

  /**
   * Calculate confidence between two entries
   */
  private calculateConfidence(
    chosen: ShadowLogEntry,
    rejected: ShadowLogEntry
  ): number {
    const scoreChosen = this.computeQualityScore(chosen);
    const scoreRejected = this.computeQualityScore(rejected);

    // Confidence based on quality difference
    return Math.min(1.0, Math.abs(scoreChosen - scoreRejected) * 2);
  }

  /**
   * Convert UI state to text (for legacy compatibility)
   */
  private uiStateToText(uiState: import("../types.js").UIState): string {
    // Extract meaningful text from UI state
    const parts: string[] = [];

    if (uiState.dom.text) {
      parts.push(uiState.dom.text);
    }

    if (uiState.dom.attributes) {
      parts.push(JSON.stringify(uiState.dom.attributes));
    }

    if (uiState.styles) {
      parts.push(JSON.stringify(uiState.styles));
    }

    return parts.join(" | ");
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Convert hash to 768-dim embedding
   */
  private hashToEmbedding(hash: number): Float32Array {
    const embedding = new Float32Array(768);

    for (let i = 0; i < 768; i++) {
      const seed = hash + i * 31;
      const value = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      embedding[i] = value * 2 - 1;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < 768; i++) {
      embedding[i] = embedding[i] / (norm + 1e-8);
    }

    return embedding;
  }
}

/**
 * Create an ORPO legacy bridge
 */
export function createORPOLegacyBridge(): ORPOLegacyBridge {
  return new ORPOLegacyBridge();
}
