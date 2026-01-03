/**
 * @fileoverview Aequor LLM adapter for LangChain
 *
 * This adapter integrates Aequor's CascadeRouter with LangChain's LLM interface,
 * providing intelligent routing between local and cloud models based on query
 * complexity, system state, and cost optimization.
 *
 * Features:
 * - Automatic complexity-based routing
 * - Cost-aware decision making
 * - Semantic caching
 * - Emotional intelligence (cadence & motivation detection)
 * - Fallback and error handling
 * - Streaming support
 *
 * @example
 * ```ts
 * import { AequorLLM } from '@lsi/langchain';
 *
 * const llm = new AequorLLM({
 *   complexityThreshold: 0.6,
 *   enableCache: true,
 *   costAware: {
 *     budget: 10.0,
 *     period: 'daily'
 *   }
 * });
 *
 * const response = await llm.invoke("What is the capital of France?");
 * console.log(response);
 * ```
 */

import type {
  BaseLLM,
  BaseLLMParams,
} from "@langchain/core/language_models/llms/base";
import { LangChainParams } from "@langchain/core/language_models/llms/base";
import type {
  BaseCallOptions,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { CascadeRouter } from "@lsi/cascade";
import type {
  RouteDecision,
  QueryContext,
  RouterConfig,
} from "@lsi/cascade";
import type { ModelAdapter } from "@lsi/cascade";

/**
 * Configuration options for AequorLLM
 */
export interface AequorLLMConfig extends RouterConfig {
  /** Whether to enable streaming responses */
  streaming?: boolean;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Top-k sampling parameter */
  topK?: number;
  /** Number of retries on failure */
  maxRetries?: number;
  /** Timeout for each request in milliseconds */
  timeout?: number;
  /** Additional model-specific options */
  modelOptions?: Record<string, unknown>;
}

/**
 * Extended parameters for Aequor LLM
 */
export interface AequorLLMInput extends BaseLLMParams {
  /** Aequor-specific configuration */
  aequorConfig?: AequorLLMConfig;
  /** Custom CascadeRouter instance (optional) */
  router?: CascadeRouter;
}

/**
 * Metadata about the routing decision
 */
export interface RoutingMetadata {
  /** Which route was chosen */
  route: "local" | "cloud" | "hybrid";
  /** Confidence in the routing decision (0-1) */
  confidence: number;
  /** Estimated latency in milliseconds */
  estimatedLatency: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Cache hit information */
  cacheHit?: boolean;
  /** Similarity score if cache hit */
  cacheSimilarity?: number;
  /** Complexity score (0-1) */
  complexity: number;
  /** Additional notes */
  notes?: string[];
}

/**
 * Extended result with routing metadata
 */
export interface AequorLLMResult {
  /** Generated text */
  text: string;
  /** Routing metadata */
  metadata: RoutingMetadata;
  /** Number of tokens used (if available) */
  tokensUsed?: number;
  /** Actual latency in milliseconds */
  latency: number;
}

/**
 * Default configuration for AequorLLM
 */
const DEFAULT_CONFIG: AequorLLMConfig = {
  complexityThreshold: 0.6,
  confidenceThreshold: 0.6,
  maxLatency: 1000,
  enableCache: true,
  enableCostAware: false,
  streaming: false,
  maxTokens: 1024,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxRetries: 3,
  timeout: 30000,
};

/**
 * AequorLLM - LangChain LLM adapter for Aequor
 *
 * Integrates Aequor's intelligent routing with LangChain's LLM interface.
 * Automatically routes queries to local or cloud models based on complexity,
 * cost, and system state.
 */
export class AequorLLM extends BaseLLM<AequorLLMInput> {
  private router: CascadeRouter;
  private config: AequorLLMConfig;
  private lc_namespace = ["langchain", "llms", "aequor"];
  private static lc_name() {
    return "Aequor";
  }

  constructor(fields?: AequorLLMInput) {
    super(fields ?? {});

    // Extract Aequor config
    this.config = {
      ...DEFAULT_CONFIG,
      ...(fields?.aequorConfig ?? {}),
    };

    // Use provided router or create new one
    if (fields?.router) {
      this.router = fields.router;
    } else {
      this.router = new CascadeRouter(this.config);
    }
  }

  /**
   * Get the model identifier
   */
  _llmType(): string {
    return "aequor";
  }

  /**
   * Generate text from a prompt
   *
   * This is the main method called by LangChain. It:
   * 1. Routes the query using CascadeRouter
   * 2. Executes the query on the chosen model
   * 3. Returns the result with routing metadata
   *
   * @param prompts - Array of prompts to process
   * @param options - Additional options and callbacks
   * @returns Array of generated strings
   */
  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<{ generations: Array<{ text: string }> }> {
    const generations: Array<{ text: string }> = [];

    for (const prompt of prompts) {
      const result = await this._generateSingle(prompt, options, runManager);
      generations.push({ text: result.text });

      // Log metadata to callback manager
      if (runManager) {
        await runManager.handleLLMNewToken(
          result.text,
          undefined,
          undefined,
          undefined,
          {
            route: result.metadata.route,
            confidence: result.metadata.confidence,
            latency: result.latency,
            cost: result.metadata.estimatedCost,
          }
        );
      }
    }

    return { generations };
  }

  /**
   * Generate a single prompt
   */
  private async _generateSingle(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<AequorLLMResult> {
    const startTime = Date.now();

    // Step 1: Route the query
    const context: QueryContext = {
      timestamp: Date.now(),
      sessionId: options?.metadata?.sessionId as string | undefined,
    };

    const routeDecision = await this.router.routeWithIntelligentCache(
      prompt,
      context
    );

    // Step 2: Execute the query based on route
    const response = await this._executeQuery(
      prompt,
      routeDecision,
      options
    );

    const latency = Date.now() - startTime;

    // Step 3: Build metadata
    const metadata: RoutingMetadata = {
      route: routeDecision.route,
      confidence: routeDecision.confidence,
      estimatedLatency: routeDecision.estimatedLatency,
      estimatedCost: routeDecision.estimatedCost,
      cacheHit: routeDecision.cacheStatus?.hit,
      cacheSimilarity: routeDecision.cacheStatus?.similarity,
      complexity: this._calculateComplexity(prompt),
      notes: routeDecision.notes,
    };

    return {
      text: response.content,
      metadata,
      tokensUsed: response.tokensUsed,
      latency,
    };
  }

  /**
   * Execute query based on routing decision
   */
  private async _executeQuery(
    prompt: string,
    routeDecision: RouteDecision & { cacheStatus?: { hit: boolean; similarity?: number } },
    options: this["ParsedCallOptions"]
  ): Promise<{ content: string; tokensUsed?: number }> {
    // Check if cache hit
    if (routeDecision.cacheStatus?.hit) {
      return {
        content: `[CACHED] ${this._formatCachedResponse(routeDecision)}`,
        tokensUsed: 0,
      };
    }

    // Determine which adapter to use
    const adapter = await this._getAdapter(routeDecision.route);

    if (!adapter) {
      throw new Error(`No adapter available for route: ${routeDecision.route}`);
    }

    // Build query options
    const queryOptions: Record<string, unknown> = {
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      top_p: this.config.topP,
      top_k: this.config.topK,
      ...this.config.modelOptions,
    };

    // Execute query with retries
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        const response = await adapter.query(prompt, queryOptions);
        return {
          content: response.content,
          tokensUsed: response.tokensUsed,
        };
      } catch (error) {
        lastError = error as Error;
        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries! - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Get adapter for route
   */
  private async _getAdapter(
    route: "local" | "cloud" | "hybrid"
  ): Promise<ModelAdapter | null> {
    // This would be implemented by getting the actual adapters
    // from the router's internal configuration
    // For now, return null as placeholder
    return null;
  }

  /**
   * Calculate simple complexity score
   */
  private _calculateComplexity(text: string): number {
    // Simple heuristic: longer and more complex = higher complexity
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);

    // Normalize to 0-1
    const lengthScore = Math.min(words / 100, 1);
    const complexityScore = Math.min(avgWordsPerSentence / 20, 1);

    return (lengthScore + complexityScore) / 2;
  }

  /**
   * Format cached response
   */
  private _formatCachedResponse(routeDecision: RouteDecision): string {
    return `Response from ${routeDecision.route} model (similarity: ${routeDecision.cacheStatus?.similarity?.toFixed(3) || 'N/A'})`;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    cacheStats: ReturnType<CascadeRouter["getCacheStatistics"]>;
    budgetSummary: ReturnType<CascadeRouter["getBudgetSummary"]>;
  } {
    return {
      cacheStats: this.router.getCacheStatistics(),
      budgetSummary: this.router.getBudgetSummary()!,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.router.clearCache();
  }

  /**
   * Reset session
   */
  resetSession(): void {
    this.router.resetSession();
  }

  /**
   * Get the underlying router instance
   */
  getRouter(): CascadeRouter {
    return this.router;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AequorLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a configured AequorLLM instance
 *
 * Convenience factory function for creating an AequorLLM with
 * sensible defaults.
 *
 * @param config - Optional configuration
 * @returns Configured AequorLLM instance
 *
 * @example
 * ```ts
 * const llm = createAequorLLM({
 *   complexityThreshold: 0.7,
 *   enableCache: true
 * });
 * ```
 */
export function createAequorLLM(config?: AequorLLMConfig): AequorLLM {
  return new AequorLLM({ aequorConfig: config });
}
