/**
 * IntentRouter - Intent-based routing for cascade system
 *
 * Routes queries based on detected intent category and complexity.
 * Works in conjunction with CascadeRouter for intelligent request routing.
 */

import type { IntentCategory } from "@lsi/protocol";

/**
 * Intent routing configuration
 */
export interface IntentRouterConfig {
  /** Default intent category fallback */
  defaultIntent?: IntentCategory;
  /** Enable complexity-based routing */
  enableComplexityRouting?: boolean;
  /** Minimum confidence threshold for intent classification */
  minConfidence?: number;
}

/**
 * Intent routing result
 */
export interface IntentRoutingResult {
  /** Detected intent category */
  intent: IntentCategory;
  /** Confidence in intent detection (0-1) */
  confidence: number;
  /** Recommended backend */
  backend: "local" | "cloud";
  /** Reason for routing decision */
  reason: string;
}

/**
 * Default configuration
 */
export const DEFAULT_INTENT_ROUTER_CONFIG: IntentRouterConfig = {
  defaultIntent: "query" as IntentCategory,
  enableComplexityRouting: true,
  minConfidence: 0.5,
};

/**
 * IntentRouter - Routes queries based on intent
 *
 * Analyzes query intent to determine the best routing strategy.
 * Simple intents go to local models, complex intents to cloud.
 */
export class IntentRouter {
  private config: IntentRouterConfig;

  constructor(config?: Partial<IntentRouterConfig>) {
    this.config = {
      ...DEFAULT_INTENT_ROUTER_CONFIG,
      ...config,
    };
  }

  /**
   * Route a query based on intent
   *
   * @param query - Query text to route
   * @param complexity - Optional complexity score (0-1)
   * @returns Routing result with intent and backend recommendation
   */
  async route(
    query: string,
    complexity?: number
  ): Promise<IntentRoutingResult> {
    // Detect intent from query
    const intent = this.detectIntent(query);
    const confidence = this.calculateConfidence(query, intent);

    // Determine backend based on intent and complexity
    const backend = this.selectBackend(intent, confidence, complexity);

    return {
      intent,
      confidence,
      backend,
      reason: this.generateReason(intent, confidence, backend, complexity),
    };
  }

  /**
   * Detect intent category from query text
   */
  private detectIntent(query: string): IntentCategory {
    const lowerQuery = query.toLowerCase();

    // Simple heuristics for intent detection
    if (this.hasCodeKeywords(lowerQuery)) {
      return "code_generation" as IntentCategory;
    }
    if (this.hasQuestionWords(lowerQuery)) {
      return "query" as IntentCategory;
    }
    if (this.hasCommandWords(lowerQuery)) {
      return "command" as IntentCategory;
    }
    if (this.hasDebugKeywords(lowerQuery)) {
      return "debugging" as IntentCategory;
    }
    if (this.hasCreativeKeywords(lowerQuery)) {
      return "creative" as IntentCategory;
    }
    if (this.hasAnalysisKeywords(lowerQuery)) {
      return "analysis" as IntentCategory;
    }

    // Default to query
    return this.config.defaultIntent || ("query" as IntentCategory);
  }

  /**
   * Calculate confidence in intent detection
   */
  private calculateConfidence(query: string, intent: IntentCategory): number {
    const length = query.trim().length;
    const wordCount = query.split(/\s+/).length;

    // Very short queries have lower confidence
    if (length < 10) return 0.4;
    if (wordCount < 3) return 0.5;

    // Longer queries with clear intent keywords have higher confidence
    let confidence = 0.6;

    // Boost confidence for clear intent signals
    const lowerQuery = query.toLowerCase();
    if (this.hasCodeKeywords(lowerQuery)) confidence += 0.2;
    if (this.hasQuestionWords(lowerQuery)) confidence += 0.15;
    if (this.hasCommandWords(lowerQuery)) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  /**
   * Select backend based on intent, confidence, and complexity
   */
  private selectBackend(
    intent: IntentCategory,
    confidence: number,
    complexity?: number
  ): "local" | "cloud" {
    // Low confidence queries go to cloud (better models)
    if (confidence < this.config.minConfidence!) {
      return "cloud";
    }

    // High complexity queries go to cloud
    if (complexity && complexity > 0.7) {
      return "cloud";
    }

    // Simple intents can be handled locally
    const simpleIntents: Set<IntentCategory> = new Set([
      "query" as IntentCategory,
      "conversation" as IntentCategory,
    ]);

    if (simpleIntents.has(intent)) {
      return "local";
    }

    // Complex intents go to cloud
    return "cloud";
  }

  /**
   * Generate human-readable reason for routing decision
   */
  private generateReason(
    intent: IntentCategory,
    confidence: number,
    backend: "local" | "cloud",
    complexity?: number
  ): string {
    const parts = [`Intent: ${intent}`, `Confidence: ${(confidence * 100).toFixed(0)}%`];

    if (complexity !== undefined) {
      parts.push(`Complexity: ${(complexity * 100).toFixed(0)}%`);
    }

    parts.push(`Routed to ${backend} backend`);

    return parts.join(", ");
  }

  // Keyword detection helpers

  private hasCodeKeywords(query: string): boolean {
    const codeKeywords = [
      "function",
      "class",
      "import",
      "export",
      "code",
      "typescript",
      "javascript",
      "python",
      "programming",
    ];
    return codeKeywords.some((kw) => query.includes(kw));
  }

  private hasQuestionWords(query: string): boolean {
    const questionWords = ["what", "how", "why", "when", "where", "who", "which"];
    return questionWords.some((qw) => query.startsWith(qw));
  }

  private hasCommandWords(query: string): boolean {
    const commandWords = ["create", "delete", "update", "modify", "run", "execute"];
    return commandWords.some((cw) => query.includes(cw));
  }

  private hasDebugKeywords(query: string): boolean {
    const debugKeywords = ["error", "bug", "fix", "debug", "issue", "problem"];
    return debugKeywords.some((dk) => query.includes(dk));
  }

  private hasCreativeKeywords(query: string): boolean {
    const creativeKeywords = ["write", "create", "generate", "story", "poem"];
    return creativeKeywords.some((ck) => query.includes(ck));
  }

  private hasAnalysisKeywords(query: string): boolean {
    const analysisKeywords = ["analyze", "compare", "evaluate", "assess"];
    return analysisKeywords.some((ak) => query.includes(ak));
  }
}
