/**
 * CohereAdapter - Real implementation for cloud LLM inference via Cohere API
 *
 * This adapter makes actual HTTP calls to the Cohere API to perform cloud inference.
 * It supports retry logic with jitter, streaming responses, health checks, and
 * environment variable configuration.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  RoutingDecision,
  ProcessResult,
  AdapterHealthCheckResult,
  CohereAdapterConfig,
  CohereChatRequest,
  CohereChatResponse,
  CohereErrorResponse,
} from "@lsi/protocol";

/**
 * Custom error for CohereAdapter failures
 */
export class CohereAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "CohereAdapterError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<CohereAdapterConfig, "apiKey" | "defaultModel"> = {
  baseURL: "https://api.cohere.ai",
  timeout: 60000,
  maxRetries: 3,
  stream: false,
};

/**
 * Supported Cohere models
 */
export const COHERE_MODELS = {
  COMMAND_R_PLUS: "command-r-plus-08-2024",
  COMMAND_R: "command-r-08-2024",
  COMMAND: "command",
  COMMAND_LIGHT: "command-light",
  COMMAND_TEXT: "command-text",
} as const;

/**
 * CohereAdapter - Executes inference requests via Cohere API
 *
 * @example
 * ```typescript
 * const adapter = new CohereAdapter('xxx-...', 'command-r-plus');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export class CohereAdapter {
  private axiosInstance: AxiosInstance;
  private config: CohereAdapterConfig;

  /**
   * Create a new CohereAdapter
   *
   * @param apiKey - Cohere API key (default: from COHERE_API_KEY env)
   * @param defaultModel - Default model to use (default: from COHERE_MODEL env or 'command-r-plus')
   * @param config - Optional configuration overrides
   * @throws Error if API key is not provided
   */
  constructor(
    apiKey?: string,
    defaultModel?: string,
    config?: Partial<CohereAdapterConfig>
  ) {
    const finalApiKey = apiKey || process.env.COHERE_API_KEY;
    if (!finalApiKey) {
      throw new CohereAdapterError(
        "Cohere API key is required. Set COHERE_API_KEY environment variable or pass apiKey parameter.",
        "MISSING_API_KEY"
      );
    }

    const finalModel =
      defaultModel ||
      process.env.COHERE_MODEL ||
      COHERE_MODELS.COMMAND_R_PLUS;
    const finalBaseUrl =
      config?.baseURL || process.env.COHERE_BASE_URL || DEFAULT_CONFIG.baseURL;

    this.config = {
      apiKey: finalApiKey,
      baseURL: finalBaseUrl,
      defaultModel: finalModel,
      timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
      maxRetries: config?.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      stream: config?.stream ?? DEFAULT_CONFIG.stream,
    };

    // Create axios instance with defaults
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.buildHeaders(),
    });
  }

  /**
   * Build headers for API requests
   *
   * @returns Headers object
   */
  private buildHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Execute a routing decision with the given input
   *
   * @param decision - Routing decision containing backend, model, confidence
   * @param input - Input prompt to process
   * @returns Process result with content, metadata, latency
   * @throws CohereAdapterError on failure after retries
   */
  async execute(
    decision: RoutingDecision,
    input: string
  ): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // Use model from decision or fall back to default
      const model = decision.model || this.config.defaultModel;

      // Build request payload
      const request: CohereChatRequest = {
        model,
        message: input,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      };

      // Execute with retry logic
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post<CohereChatResponse>(
          "/v1/chat",
          request
        );
        return result.data;
      });

      const latency = Date.now() - startTime;

      // Extract content from response
      const content = response.text || "";
      const tokensUsed = response.tokenCount?.totalTokens || 0;

      return {
        content,
        backend: decision.backend,
        model,
        tokensUsed,
        latency,
        metadata: {
          model,
          tokensUsed,
          latency,
          backend: decision.backend,
          finishReason: response.finishReason,
          generationId: response.generationId,
        },
      };
    } catch (error) {
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
      backend: "cloud",
      model: model || this.config.defaultModel,
      confidence: 1.0,
      reason: "Direct processing via CohereAdapter",
      appliedPrinciples: [],
      cacheResponse: false,
    };

    return this.execute(decision, prompt);
  }

  /**
   * Process a prompt with streaming response
   *
   * @param prompt - Input prompt to process
   * @param model - Model to use (optional, falls back to default)
   * @param onChunk - Callback for each chunk received
   * @returns Process result with accumulated content
   */
  async processStream(
    prompt: string,
    model?: string,
    onChunk?: (chunk: string, done: boolean) => void
  ): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      const finalModel = model || this.config.defaultModel;

      const request: CohereChatRequest = {
        model: finalModel,
        message: prompt,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      };

      // Execute with retry logic (for initial connection only)
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post("/v1/chat", request, {
          responseType: "stream",
        });
        return result;
      });

      let content = "";
      let tokensUsed = 0;

      // Process stream
      return new Promise((resolve, reject) => {
        const stream = response.data;

        stream.on("data", (chunk: Buffer) => {
          const lines = chunk
            .toString()
            .split("\n")
            .filter((line: string) => line.trim() !== "");

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.is_finished) {
                if (onChunk) {
                  onChunk("", true);
                }
                const latency = Date.now() - startTime;
                resolve({
                  content,
                  backend: "cloud",
                  model: finalModel,
                  tokensUsed,
                  latency,
                  metadata: {
                    model: finalModel,
                    tokensUsed,
                    latency,
                    backend: "cloud",
                    streamed: true,
                  },
                });
                return;
              }

              if (parsed.text) {
                content += parsed.text;
                if (onChunk) {
                  onChunk(parsed.text, false);
                }
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        });

        stream.on("end", () => {
          const latency = Date.now() - startTime;
          resolve({
            content,
            backend: "cloud",
            model: finalModel,
            tokensUsed,
            latency,
            metadata: {
              model: finalModel,
              tokensUsed,
              latency,
              backend: "cloud",
              streamed: true,
            },
          });
        });

        stream.on("error", (error: Error) => {
          reject(this.handleError(error, "processStream"));
        });
      });
    } catch (error) {
      throw this.handleError(error, "processStream");
    }
  }

  /**
   * Check health of Cohere service
   *
   * Note: Cohere doesn't have a dedicated health endpoint, so we do a minimal
   * completion request to check health.
   *
   * @returns Health check result
   */
  async checkHealth(): Promise<AdapterHealthCheckResult> {
    try {
      // Make a minimal request to check connectivity
      const request: CohereChatRequest = {
        model: this.config.defaultModel,
        message: "test",
        max_tokens: 1,
      };

      await this.axiosInstance.post<CohereChatResponse>("/v1/chat", request);

      const chatModels = Object.values(COHERE_MODELS);

      return {
        healthy: true,
        models: chatModels,
        currentModel: this.config.defaultModel,
        status: "ok",
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
   * Execute a function with retry logic using exponential backoff with jitter
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

        // Wait before retrying (exponential backoff with jitter)
        if (attempt < maxRetries) {
          // Add jitter to prevent thundering herd
          const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
          const jitter = Math.random() * 1000; // 0-1s random
          const delay = baseDelay + jitter;
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

      // Don't retry client errors (4xx) except 408, 429
      if (status !== undefined && status >= 400 && status < 500) {
        // Retry on rate limit (429) and timeout (408)
        if (status === 429 || status === 408) {
          return false;
        }
        // Don't retry other 4xx errors
        return true;
      }

      // Check for Cohere-specific error codes
      const data = error.response?.data as CohereErrorResponse;
      if (data?.code) {
        // Don't retry authentication and validation errors
        if (data.code >= 400 && data.code < 500 && data.code !== 429) {
          return true;
        }
      }
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
   * Convert unknown error to CohereAdapterError
   *
   * @param error - Error to convert
   * @param context - Context where error occurred
   * @returns CohereAdapterError
   */
  private handleError(error: unknown, context: string): CohereAdapterError {
    if (error instanceof CohereAdapterError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNREFUSED") {
        return new CohereAdapterError(
          `Cohere service unreachable at ${this.config.baseURL}`,
          "ECONNREFUSED",
          error
        );
      }

      if (
        axiosError.code === "ETIMEDOUT" ||
        axiosError.code === "ECONNABORTED"
      ) {
        return new CohereAdapterError(
          `Request timeout after ${this.config.timeout}ms`,
          "TIMEOUT",
          error
        );
      }

      // Handle Cohere-specific errors
      const data = axiosError.response?.data as CohereErrorResponse;
      if (data?.message) {
        return new CohereAdapterError(
          `Cohere API error: ${data.message}`,
          data.code?.toString() || "API_ERROR",
          error
        );
      }

      // Handle HTTP status codes
      if (status === 401) {
        return new CohereAdapterError(
          "Invalid API key. Please check your COHERE_API_KEY.",
          "INVALID_API_KEY",
          error
        );
      }

      if (status === 429) {
        return new CohereAdapterError(
          "Rate limit exceeded. Please retry later.",
          "RATE_LIMIT_EXCEEDED",
          error
        );
      }

      if (status === 500) {
        return new CohereAdapterError(
          "Cohere internal server error",
          "INTERNAL_ERROR",
          error
        );
      }

      return new CohereAdapterError(
        `HTTP ${status}: ${axiosError.message}`,
        "HTTP_ERROR",
        error
      );
    }

    if (error instanceof Error) {
      return new CohereAdapterError(
        `${context}: ${error.message}`,
        "UNKNOWN_ERROR",
        error
      );
    }

    return new CohereAdapterError(
      `${context}: Unknown error`,
      "UNKNOWN_ERROR",
      error
    );
  }

  /**
   * Get current configuration
   *
   * Note: API key is redacted for security
   *
   * @returns Current adapter configuration
   */
  getConfig(): Omit<CohereAdapterConfig, "apiKey"> & { apiKey: string };
  getConfig(): CohereAdapterConfig;
  getConfig(): any {
    return {
      ...this.config,
      apiKey: this.config.apiKey ? "***REDACTED***" : "",
    };
  }

  /**
   * Get actual API key (use with caution)
   *
   * @returns API key
   */
  getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<CohereAdapterConfig>): void {
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

    // Update headers if API key changed
    if (config.apiKey !== undefined) {
      const headers = this.buildHeaders();
      Object.assign(this.axiosInstance.defaults.headers.common, headers);
    }
  }
}

/**
 * Factory function to create a CohereAdapter
 *
 * @param apiKey - Cohere API key (optional, from env by default)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @returns Configured CohereAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createCohereAdapter();
 *
 * // Specify custom values
 * const adapter = createCohereAdapter('xxx-...', 'command-r-plus', {
 *   timeout: 120000,
 *   maxRetries: 5,
 * });
 * ```
 */
export function createCohereAdapter(
  apiKey?: string,
  defaultModel?: string,
  config?: Partial<CohereAdapterConfig>
): CohereAdapter {
  return new CohereAdapter(apiKey, defaultModel, config);
}

/**
 * Export default class as default
 */
export default CohereAdapter;
