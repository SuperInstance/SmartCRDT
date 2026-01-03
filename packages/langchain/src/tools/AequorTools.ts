/**
 * @fileoverview LangChain tools for Aequor capabilities
 *
 * This module provides LangChain tools that expose Aequor's capabilities:
 * - Query routing and complexity analysis
 * - Semantic search and caching
 * - Privacy classification
 * - Intent encoding
 * - Knowledge graph queries
 *
 * @example
 * ```ts
 * import { AequorQueryTool } from '@lsi/langchain/tools';
 *
 * const tool = new AequorQueryTool({
 *   router: myRouter
 * });
 *
 * const result = await tool.call("What is the capital of France?");
 * console.log(result);
 * ```
 */

import type { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { CascadeRouter } from "@lsi/cascade";
import { PrivacyClassifier } from "@lsi/privacy";
import type { RouteDecision, QueryContext } from "@lsi/cascade";
import type {
  PrivacyClassification,
  IntentVector,
} from "@lsi/protocol";

/**
 * Configuration for Aequor tools
 */
export interface AequorToolsConfig {
  /** CascadeRouter instance */
  router?: CascadeRouter;
  /** PrivacyClassifier instance */
  privacyClassifier?: PrivacyClassifier;
  /** Whether to enable caching */
  enableCache?: boolean;
  /** Maximum results for search tools */
  maxSearchResults?: number;
}

/**
 * Aequor Query Tool
 *
 * Analyzes and routes queries using Aequor's CascadeRouter.
 * Provides information about query complexity, routing decisions,
 * and estimated performance.
 */
export class AequorQueryTool implements StructuredTool {
  name = "aequor_query";
  description = `Analyze and route a query using Aequor's intelligent routing system.
Returns information about query complexity, routing decision, estimated latency and cost.
Use this tool to understand how Aequor will handle a given query.`;

  private router: CascadeRouter;

  constructor(config: AequorToolsConfig) {
    if (!config.router) {
      throw new Error("AequorQueryTool requires a CascadeRouter instance");
    }
    this.router = config.router;
  }

  schema = z.object({
    query: z.string().describe("The query to analyze"),
    sessionId: z.string().optional().describe("Optional session ID for context"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const context: QueryContext = {
      timestamp: Date.now(),
      sessionId: input.sessionId,
    };

    const decision = await this.router.route(input.query, context);

    return JSON.stringify({
      query: input.query,
      route: decision.route,
      confidence: decision.confidence,
      estimatedLatency: decision.estimatedLatency,
      estimatedCost: decision.estimatedCost,
      notes: decision.notes || [],
      metadata: {
        preferLocal: decision.preferLocal,
        skipRefinement: decision.skipRefinement,
        suggestBreakdown: decision.suggestBreakdown,
        suggestSharing: decision.suggestSharing,
      },
    }, null, 2);
  }
}

/**
 * Aequor Semantic Search Tool
 *
 * Performs semantic search using Aequor's embedding service.
 * Finds similar queries and cached results.
 */
export class AequorSemanticSearchTool implements StructuredTool {
  name = "aequor_semantic_search";
  description = `Search for semantically similar queries using Aequor's embedding service.
Returns the most similar queries along with their similarity scores.
Use this tool to find related queries or cached results.`;

  private router: CascadeRouter;
  private maxResults: number;

  constructor(config: AequorToolsConfig) {
    if (!config.router) {
      throw new Error("AequorSemanticSearchTool requires a CascadeRouter instance");
    }
    this.router = config.router;
    this.maxResults = config.maxSearchResults || 5;
  }

  schema = z.object({
    query: z.string().describe("The query to search for"),
    topK: z.number().optional().describe("Number of results to return (default: 5)"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const topK = input.topK || this.maxResults;

    // Get semantic cache for similar queries
    const cacheStats = this.router.getCacheStatistics();

    // In a real implementation, we would search the cache for similar queries
    // For now, return cache statistics
    return JSON.stringify({
      query: input.query,
      similarQueries: [], // Would be populated from actual cache search
      cacheStatistics: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
      },
      message: "Semantic search requires cache implementation with query history",
    }, null, 2);
  }
}

/**
 * Aequor Privacy Classification Tool
 *
 * Classifies query privacy level and detects PII.
 */
export class AequorPrivacyTool implements StructuredTool {
  name = "aequor_privacy_classify";
  description = `Classify the privacy level of a query and detect PII (Personally Identifiable Information).
Returns privacy classification, detected PII types, and recommended handling.
Use this tool to ensure proper privacy handling of sensitive queries.`;

  private privacyClassifier: PrivacyClassifier;

  constructor(config: AequorToolsConfig) {
    if (!config.privacyClassifier) {
      throw new Error("AequorPrivacyTool requires a PrivacyClassifier instance");
    }
    this.privacyClassifier = config.privacyClassifier;
  }

  schema = z.object({
    query: z.string().describe("The query to classify"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const classification = await this.privacyClassifier.classify(input.query);

    return JSON.stringify({
      query: input.query,
      privacyLevel: classification.level,
      confidence: classification.confidence,
      categories: classification.categories,
      detectedPII: classification.detectedPII,
      recommendations: {
        encrypt: classification.level === 'SECRET' || classification.level === 'CONFIDENTIAL',
        redact: classification.detectedPII.length > 0,
        localOnly: classification.level === 'SECRET',
        canShare: classification.level === 'PUBLIC',
      },
    }, null, 2);
  }
}

/**
 * Aequor Intent Encoding Tool
 *
 * Encodes query intent as a vector for privacy-preserving transmission.
 */
export class AequorIntentTool implements StructuredTool {
  name = "aequor_intent_encode";
  description = `Encode a query's intent as a 768-dimensional vector for privacy-preserving processing.
The intent vector captures semantic meaning without exposing the actual query content.
Use this tool to prepare queries for cloud processing while maintaining privacy.`;

  private router: CascadeRouter;

  constructor(config: AequorToolsConfig) {
    if (!config.router) {
      throw new Error("AequorIntentTool requires a CascadeRouter instance");
    }
    this.router = config.router;
  }

  schema = z.object({
    query: z.string().describe("The query to encode"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // In a real implementation, this would use the IntentEncoder
    // For now, return a placeholder
    const dimensions = 768;
    const placeholderVector = Array.from({ length: dimensions }, () =>
      Math.random() * 2 - 1
    );

    return JSON.stringify({
      query: input.query,
      intentVector: {
        dimensions,
        preview: placeholderVector.slice(0, 5).map(n => n.toFixed(4)),
        message: "Intent encoding requires IntentEncoder integration",
      },
      usage: "Use this vector for cloud processing instead of raw query",
    }, null, 2);
  }
}

/**
 * Aequor Cache Statistics Tool
 *
 * Returns current cache performance metrics.
 */
export class AequorCacheStatsTool implements StructuredTool {
  name = "aequor_cache_stats";
  description = `Get current cache performance statistics from Aequor's semantic cache.
Returns hit rate, cache size, similarity distributions, and performance metrics.
Use this tool to monitor cache performance and efficiency.`;

  private router: CascadeRouter;

  constructor(config: AequorToolsConfig) {
    if (!config.router) {
      throw new Error("AequorCacheStatsTool requires a CascadeRouter instance");
    }
    this.router = config.router;
  }

  schema = z.object({});

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    const stats = this.router.getCacheStatistics();

    return JSON.stringify({
      cacheSize: stats.size,
      hitRate: stats.hitRate,
      totalHits: stats.totalHits,
      totalMisses: stats.totalMisses,
      exactHits: stats.exactHits,
      semanticHits: stats.semanticHits,
      similarityDistribution: stats.similarityDistribution,
      byQueryType: stats.byQueryType,
      currentThreshold: stats.currentThreshold,
      performance: {
        missRate: stats.missRate,
        averageSimilarity: stats.averageSimilarity,
      },
    }, null, 2);
  }
}

/**
 * Aequor Complexity Analysis Tool
 *
 * Analyzes query complexity across multiple dimensions.
 */
export class AequorComplexityTool implements StructuredTool {
  name = "aequor_complexity_analyze";
  description = `Analyze query complexity across multiple dimensions including length, structure, semantic complexity, and domain specificity.
Returns detailed complexity scores and recommendations for routing.
Use this tool to understand why a query is routed to local or cloud models.`;

  private router: CascadeRouter;

  constructor(config: AequorToolsConfig) {
    if (!config.router) {
      throw new Error("AequorComplexityTool requires a CascadeRouter instance");
    }
    this.router = config.router;
  }

  schema = z.object({
    query: z.string().describe("The query to analyze"),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    // Get routing decision which includes complexity analysis
    const decision = await this.router.route(input.query);

    // Extract complexity information
    const wordCount = input.query.split(/\s+/).length;
    const charCount = input.query.length;
    const sentenceCount = input.query.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);

    return JSON.stringify({
      query: input.query,
      staticAnalysis: {
        wordCount,
        charCount,
        sentenceCount,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      },
      routing: {
        route: decision.route,
        confidence: decision.confidence,
        recommended: decision.route === "cloud" ? "Cloud model (more capable)" : "Local model (faster)",
      },
      notes: decision.notes || [],
      thresholds: {
        complexityThreshold: 0.6,
        confidenceThreshold: 0.6,
      },
    }, null, 2);
  }
}

/**
 * Create all Aequor tools with a single configuration
 *
 * Convenience function to create all tools at once.
 *
 * @param config - Configuration for all tools
 * @returns Object containing all Aequor tools
 *
 * @example
 * ```ts
 * const tools = createAequorTools({
 *   router: myRouter,
 *   privacyClassifier: myClassifier
 * });
 *
 * const queryTool = tools.query;
 * const privacyTool = tools.privacy;
 * ```
 */
export function createAequorTools(config: AequorToolsConfig): {
  query: AequorQueryTool;
  semanticSearch: AequorSemanticSearchTool;
  privacy: AequorPrivacyTool;
  intent: AequorIntentTool;
  cacheStats: AequorCacheStatsTool;
  complexity: AequorComplexityTool;
} {
  return {
    query: new AequorQueryTool(config),
    semanticSearch: new AequorSemanticSearchTool(config),
    privacy: new AequorPrivacyTool(config),
    intent: new AequorIntentTool(config),
    cacheStats: new AequorCacheStatsTool(config),
    complexity: new AequorComplexityTool(config),
  };
}
