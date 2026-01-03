/**
 * AequorLLM - LlamaIndex LLM adapter for Aequor CascadeRouter
 *
 * This adapter integrates Aequor's intelligent routing with LlamaIndex's LLM interface,
 * enabling automatic complexity-based routing, semantic caching, and cost optimization
 * for LlamaIndex applications.
 *
 * Features:
 * - Automatic local/cloud routing based on query complexity
 * - Semantic caching with 80%+ hit rate
 * - Cost-aware routing with budget control
 * - Health checks and fallback support
 * - Shadow logging for ORPO training
 *
 * Example:
 * ```ts
 * import { AequorLLM } from '@lsi/llamaindex/llm';
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
 * const response = await llm.complete({
 *   prompt: "Explain quantum computing"
 * });
 * ```
 */

import type {
  MessageContent,
  ChatMessage,
  LLMMetadata,
  CompletionRequest,
} from "llamaindex";
import { CustomLLM } from "llamaindex";
import { CascadeRouter } from "@lsi/cascade";
import type { RouterConfig, RouteDecision } from "@lsi/cascade";

/**
 * Configuration for AequorLLM
 */
export interface AequorLLMConfig {
  /** Cascade router configuration */
  router?: RouterConfig;

  /** Local model configuration (Ollama) */
  local?: {
    baseURL?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };

  /** Cloud model configuration (OpenAI) */
  cloud?: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };

  /** Enable query refinement */
  enableRefinement?: boolean;

  /** Enable semantic caching */
  enableCache?: boolean;

  /** Enable shadow logging for ORPO training */
  enableShadowLogging?: boolean;
}

/**
 * LLM completion result with routing metadata
 */
export interface AequorCompletionResult {
  /** Generated text */
  text: string;

  /** Routing decision made */
  routing: RouteDecision;

  /** Cache hit (if caching enabled) */
  cacheHit?: boolean;

  /** Similarity score (for cache hits) */
  cacheSimilarity?: number;

  /** Actual latency in milliseconds */
  latency: number;

  /** Actual cost in USD */
  cost: number;
}

/**
 * AequorLLM - LlamaIndex LLM adapter
 */
export class AequorLLM extends CustomLLM<Record<string, unknown>> {
  private router: CascadeRouter;
  private config: AequorLLMConfig;
  private localModel: any;
  private cloudModel: any;

  constructor(config: AequorLLMConfig = {}) {
    super();

    this.config = {
      enableRefinement: true,
      enableCache: true,
      enableShadowLogging: false,
      ...config,
    };

    // Initialize cascade router
    this.router = new CascadeRouter(
      {
        ...this.config.router,
        enableCache: this.config.enableCache,
      },
      this.config.enableRefinement
    );

    // Initialize models (lazy initialization)
    this.localModel = null;
    this.cloudModel = null;
  }

  /**
   * Get LLM metadata for LlamaIndex
   */
  get metadata(): LLMMetadata {
    return {
      model: "aequor-cascade",
      temperature: this.config.local?.temperature ?? 0.7,
      maxTokens: this.config.local?.maxTokens ?? 2048,
      contextWindow: 128000,
      tokenizer: "cl100k_base",
    };
  }

  /**
   * Complete a text prompt
   */
  async complete(
    prompt: string,
    parentEvent?: Record<string, unknown>
  ): Promise<string> {
    const result = await this.completeWithMetadata(prompt, parentEvent);
    return result.text;
  }

  /**
   * Complete with full routing metadata
   */
  async completeWithMetadata(
    prompt: string,
    parentEvent?: Record<string, unknown>
  ): Promise<AequorCompletionResult> {
    const startTime = Date.now();

    // Route the query
    const routing = await this.router.routeWithIntelligentCache(prompt, {
      timestamp: startTime,
      sessionId: this.extractSessionId(parentEvent),
    });

    // Execute based on routing decision
    let text: string;
    let actualRoute: "local" | "cloud" = routing.route;

    try {
      if (routing.route === "local") {
        text = await this.executeLocal(prompt);
      } else if (routing.route === "cloud") {
        text = await this.executeCloud(prompt);
      } else {
        // Hybrid: try local, escalate if needed
        try {
          text = await this.executeLocal(prompt);
        } catch (localError) {
          console.debug("[AequorLLM] Local failed, escalating to cloud:", localError);
          text = await this.executeCloud(prompt);
          actualRoute = "cloud";
        }
      }

      const endTime = Date.now();
      const latency = endTime - startTime;
      const cost = this.calculateCost(actualRoute, text.length, latency);

      // Log for shadow learning (if enabled)
      if (this.config.enableShadowLogging) {
        await this.router.routeWithLogging(prompt, text, {
          timestamp: startTime,
          sessionId: this.extractSessionId(parentEvent),
        });
      }

      return {
        text,
        routing,
        cacheHit: routing.cacheStatus?.hit ?? false,
        cacheSimilarity: routing.cacheStatus?.similarity,
        latency,
        cost,
      };
    } catch (error) {
      // Fallback handling
      const fallbackDecision = await this.router.shouldFallback(
        actualRoute,
        error as Error
      );

      if (fallbackDecision.shouldFallback) {
        console.debug(
          `[AequorLLM] Fallback triggered: ${actualRoute} → ${fallbackDecision.targetRoute}`
        );

        if (fallbackDecision.targetRoute === "local" && actualRoute !== "local") {
          text = await this.executeLocal(prompt);
          actualRoute = "local";
        } else if (
          fallbackDecision.targetRoute === "cloud" &&
          actualRoute !== "cloud"
        ) {
          text = await this.executeCloud(prompt);
          actualRoute = "cloud";
        } else {
          throw error; // Re-throw if no fallback available
        }

        const endTime = Date.now();
        const latency = endTime - startTime;
        const cost = this.calculateCost(actualRoute, text.length, latency);

        return {
          text,
          routing,
          cacheHit: false,
          latency,
          cost,
        };
      }

      throw error;
    }
  }

  /**
   * Chat completion (multi-turn conversation)
   */
  async chat(
    messages: ChatMessage[],
    parentEvent?: Record<string, unknown>
  ): Promise<MessageContent> {
    // Convert chat to single prompt for routing
    const lastMessage = messages[messages.length - 1];
    const prompt =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const result = await this.completeWithMetadata(prompt, parentEvent);
    return result.text;
  }

  /**
   * Execute on local model (Ollama)
   */
  private async executeLocal(prompt: string): Promise<string> {
    // Lazy initialization of local model
    if (!this.localModel) {
      // Import Ollama adapter
      const { OllamaAdapter } = await import("@lsi/cascade/adapters");

      this.localModel = new OllamaAdapter({
        baseURL: this.config.local?.baseURL ?? "http://localhost:11434",
        model: this.config.local?.model ?? "llama2",
        temperature: this.config.local?.temperature ?? 0.7,
        maxTokens: this.config.local?.maxTokens ?? 2048,
      });
    }

    const response = await this.localModel.generate(prompt);
    return response.text;
  }

  /**
   * Execute on cloud model (OpenAI)
   */
  private async executeCloud(prompt: string): Promise<string> {
    // Lazy initialization of cloud model
    if (!this.cloudModel) {
      // Import OpenAI adapter
      const { OpenAIAdapter } = await import("@lsi/cascade/adapters");

      this.cloudModel = new OpenAIAdapter({
        apiKey:
          this.config.cloud?.apiKey ??
          process.env.OPENAI_API_KEY ??
          "",
        model: this.config.cloud?.model ?? "gpt-4-turbo-preview",
        temperature: this.config.cloud?.temperature ?? 0.7,
        maxTokens: this.config.cloud?.maxTokens ?? 4096,
      });
    }

    const response = await this.cloudModel.generate(prompt);
    return response.text;
  }

  /**
   * Calculate cost based on route and usage
   */
  private calculateCost(route: "local" | "cloud", tokens: number, latency: number): number {
    if (route === "local") {
      // Local is essentially free (just energy)
      return 0.0;
    }

    // Cloud: OpenAI pricing (GPT-4 Turbo)
    // Input: $0.01 / 1K tokens, Output: $0.03 / 1K tokens
    const inputCost = (tokens / 1000) * 0.01;
    const outputCost = (tokens / 1000) * 0.03;
    return inputCost + outputCost;
  }

  /**
   * Extract session ID from parent event
   */
  private extractSessionId(parentEvent?: Record<string, unknown>): string {
    if (!parentEvent) return "default";

    return (
      (parentEvent.sessionId as string) ||
      (parentEvent.session_id as string) ||
      "default"
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.router.getCacheStatistics();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.router.clearCache();
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    const cacheStats = this.getCacheStats();
    const budget = this.router.getBudgetSummary();

    return {
      cache: cacheStats,
      budget,
      health: this.router.getCachedHealthStatus(),
    };
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.router.setCacheEnabled(enabled);
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(commonQueries: string[]) {
    return this.router.warmCache(commonQueries);
  }

  /**
   * Get shadow logs for ORPO training
   */
  getShadowLogs() {
    return this.router.getShadowLogs();
  }

  /**
   * Export logs for training
   */
  exportForTraining() {
    return this.router.exportForTraining();
  }
}

/**
 * Create an AequorLLM instance with default configuration
 */
export function createAequorLLM(config?: AequorLLMConfig): AequorLLM {
  return new AequorLLM(config);
}
