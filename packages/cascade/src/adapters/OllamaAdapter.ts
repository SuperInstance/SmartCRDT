/**
 * OllamaAdapter - Real implementation for local LLM inference via Ollama
 *
 * This adapter makes actual HTTP calls to the Ollama API to perform local inference.
 * It supports retry logic, health checks, and environment variable configuration.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  RoutingDecision,
  ProcessResult,
  AdapterHealthCheckResult,
  OllamaAdapterConfig,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaTagsResponse,
} from "@lsi/protocol";
import type {
  RateLimiter,
  RateLimiterConfig,
} from "../ratelimit/RateLimiter.js";
import { RateLimitError } from "../ratelimit/RateLimiter.js";

/**
 * Custom error for OllamaAdapter failures
 */
export class OllamaAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "OllamaAdapterError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<OllamaAdapterConfig, "defaultModel"> = {
  baseURL: "http://localhost:11434",
  timeout: 30000,
  maxRetries: 3,
  stream: false,
};

/**
 * Default rate limit configuration for Ollama
 *
 * Ollama is local, so we can be more permissive with rate limits.
 */
const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxRequests: 60, // 60 requests per minute
  windowMs: 60000, // 1 minute
  algorithm: "token-bucket",
  refillRate: 1, // 1 token per second (sustained rate)
  burstCapacity: 10, // Allow burst of up to 10 requests
};

/**
 * OllamaAdapter - Executes inference requests via Ollama API
 *
 * @example
 * ```typescript
 * const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5:3b');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export class OllamaAdapter {
  private axiosInstance: AxiosInstance;
  private config: OllamaAdapterConfig;
  private rateLimiter: RateLimiter | null;

  /**
   * Create a new OllamaAdapter
   *
   * @param baseURL - Base URL for Ollama API (default: from OLLAMA_BASE_URL env or 'http://localhost:11434')
   * @param defaultModel - Default model to use (default: from OLLAMA_MODEL env or 'llama2')
   * @param config - Optional configuration overrides
   * @param rateLimiter - Optional rate limiter (defaults to token bucket with 60 req/min)
   */
  constructor(
    baseURL?: string,
    defaultModel?: string,
    config?: Partial<OllamaAdapterConfig>,
    rateLimiter?: RateLimiter
  ) {
    const finalBaseUrl =
      baseURL || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const finalModel = defaultModel || process.env.OLLAMA_MODEL || "llama2";

    this.config = {
      baseURL: finalBaseUrl,
      defaultModel: finalModel,
      timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
      maxRetries: config?.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      stream: config?.stream ?? DEFAULT_CONFIG.stream,
    };

    // Initialize rate limiter
    this.rateLimiter = rateLimiter ?? null;

    // Create axios instance with defaults
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Execute a routing decision with the given input
   *
   * @param decision - Routing decision containing backend, model, confidence
   * @param input - Input prompt to process
   * @returns Process result with content, metadata, latency
   * @throws OllamaAdapterError on failure after retries
   * @throws RateLimitError if rate limit is exceeded
   */
  async execute(
    decision: RoutingDecision,
    input: string
  ): Promise<ProcessResult> {
    // Check rate limit before making request
    if (this.rateLimiter) {
      const canProceed = await this.rateLimiter.canMakeRequest();
      if (!canProceed) {
        const waitTime = this.rateLimiter.getWaitTime();
        const stats = this.rateLimiter.getStats();
        throw new RateLimitError(
          `Rate limit exceeded: maximum ${stats.maxRequests} requests per ${stats.windowMs}ms`,
          waitTime,
          stats
        );
      }
    }

    // Input validation for security
    if (input === null || input === undefined) {
      throw new Error("Input cannot be null or undefined");
    }
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    const startTime = Date.now();

    try {
      // Use model from decision or fall back to default
      const model = decision.model || this.config.defaultModel;

      // Build request payload
      const request: OllamaGenerateRequest = {
        model,
        prompt: input,
        stream: this.config.stream,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      };

      // Execute with retry logic
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post<OllamaGenerateResponse>(
          "/api/generate",
          request
        );
        return result.data;
      });

      const latency = Date.now() - startTime;
      const tokensUsed = response.eval_count || response.prompt_eval_count || 0;

      // Record the successful request
      if (this.rateLimiter) {
        this.rateLimiter.recordRequest();
      }

      return {
        content: response.response,
        backend: decision.backend,
        model: response.model || model,
        tokensUsed,
        latency,
        metadata: {
          model: response.model || model,
          tokensUsed,
          latency,
          backend: decision.backend,
        },
      };
    } catch (error) {
      // Don't record request if it failed
      throw this.handleError(error, "execute");
    }
  }

  /**
   * Process a prompt with the given model
   *
   * Alias for execute() for compatibility
   *
   * @param prompt - Input prompt to process
   * @param model - Model to use (optional, falls back to default)
   * @returns Process result
   */
  async process(prompt: string, model?: string): Promise<ProcessResult> {
    const decision: RoutingDecision = {
      backend: "local",
      model: model || this.config.defaultModel,
      confidence: 1.0,
      reason: "Direct processing via OllamaAdapter",
      appliedPrinciples: [],
      cacheResponse: false,
    };

    return this.execute(decision, prompt);
  }

  /**
   * Check health of Ollama service and list available models
   *
   * Note: This does NOT retry aggressively like execute() does.
   * Health checks should fail fast to indicate service issues.
   *
   * @returns Health check result with available models
   */
  async checkHealth(): Promise<AdapterHealthCheckResult> {
    try {
      const result =
        await this.axiosInstance.get<OllamaTagsResponse>("/api/tags");
      const response = result.data;

      const models = response.models.map((m: { name: string }) => m.name);
      const isHealthy = models.length > 0;

      return {
        healthy: isHealthy,
        models,
        currentModel: this.config.defaultModel,
        status: isHealthy ? "ok" : "no-models",
      };
    } catch (error) {
      return {
        healthy: false,
        models: [],
        currentModel: this.config.defaultModel,
        error: error instanceof Error ? error.message : "Unknown error",
        status: "unreachable",
      };
    }
  }

  /**
   * Execute a function with retry logic using exponential backoff
   *
   * @param fn - Function to execute
   * @returns Result of function
   * @throws Last error if all retries fail
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry if it's a client error (4xx) or specific errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is non-retryable
   *
   * @param error - Error to check
   * @returns True if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Don't retry client errors (4xx) except 408 and 429
      // These are user errors (bad model, bad request) that won't be fixed by retrying
      return (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 408 && // Request timeout - might be transient, retry
        status !== 429 // Too many requests - retry after delay
      );
    }
    return false;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert unknown error to OllamaAdapterError
   *
   * @param error - Error to convert
   * @param context - Context where error occurred
   * @returns OllamaAdapterError
   */
  private handleError(error: unknown, context: string): OllamaAdapterError {
    if (error instanceof OllamaAdapterError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === "ECONNREFUSED") {
        return new OllamaAdapterError(
          `Ollama service unreachable at ${this.config.baseURL}. Is Ollama running?`,
          "ECONNREFUSED",
          error
        );
      }

      if (
        axiosError.code === "ETIMEDOUT" ||
        axiosError.code === "ECONNABORTED"
      ) {
        return new OllamaAdapterError(
          `Request timeout after ${this.config.timeout}ms`,
          "TIMEOUT",
          error
        );
      }

      if (axiosError.response?.status === 404) {
        return new OllamaAdapterError(
          `Model not found: ${this.config.defaultModel}`,
          "MODEL_NOT_FOUND",
          error
        );
      }

      if (axiosError.response?.status === 500) {
        return new OllamaAdapterError(
          "Ollama internal server error",
          "INTERNAL_ERROR",
          error
        );
      }

      return new OllamaAdapterError(
        `HTTP ${axiosError.response?.status}: ${axiosError.message}`,
        "HTTP_ERROR",
        error
      );
    }

    if (error instanceof Error) {
      return new OllamaAdapterError(
        `${context}: ${error.message}`,
        "UNKNOWN_ERROR",
        error
      );
    }

    return new OllamaAdapterError(
      `${context}: Unknown error`,
      "UNKNOWN_ERROR",
      error
    );
  }

  /**
   * Get current configuration
   *
   * @returns Current adapter configuration
   */
  getConfig(): Omit<
    OllamaAdapterConfig,
    "timeout" | "maxRetries" | "stream"
  > & {
    timeout?: number;
    maxRetries?: number;
    stream?: boolean;
  } {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<OllamaAdapterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Update axios instance if timeout changed
    if (config.timeout !== undefined) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }

    // Update axios instance if baseURL changed
    if (config.baseURL !== undefined) {
      this.axiosInstance.defaults.baseURL = config.baseURL;
    }
  }

  /**
   * Set or replace the rate limiter
   *
   * @param rateLimiter - Rate limiter to use, or null to disable rate limiting
   */
  setRateLimiter(rateLimiter: RateLimiter | null): void {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Get the current rate limiter
   *
   * @returns Current rate limiter, or null if not set
   */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  /**
   * Get rate limit statistics
   *
   * @returns Rate limit statistics, or null if no rate limiter is set
   */
  getRateLimitStats() {
    return this.rateLimiter ? this.rateLimiter.getStats() : null;
  }
}

/**
 * Factory function to create an OllamaAdapter
 *
 * @param baseURL - Base URL for Ollama API (optional)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @param rateLimiter - Optional rate limiter
 * @returns Configured OllamaAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createOllamaAdapter();
 *
 * // Specify custom values
 * const adapter = createOllamaAdapter('http://localhost:11434', 'qwen2.5:3b', {
 *   timeout: 60000,
 *   maxRetries: 5,
 * });
 *
 * // With rate limiting
 * const limiter = createTokenBucketLimiter({
 *   maxRequests: 60,
 *   windowMs: 60000,
 *   refillRate: 1,
 *   burstCapacity: 10,
 * });
 * const adapter = createOllamaAdapter(undefined, undefined, undefined, limiter);
 * ```
 */
export function createOllamaAdapter(
  baseURL?: string,
  defaultModel?: string,
  config?: Partial<OllamaAdapterConfig>,
  rateLimiter?: RateLimiter
): OllamaAdapter {
  return new OllamaAdapter(baseURL, defaultModel, config, rateLimiter);
}

/**
 * Export default class as default
 */
export default OllamaAdapter;
