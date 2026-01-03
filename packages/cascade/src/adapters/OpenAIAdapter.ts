/**
 * OpenAIAdapter - Real implementation for cloud LLM inference via OpenAI API
 *
 * This adapter makes actual HTTP calls to the OpenAI API to perform cloud inference.
 * It supports retry logic with jitter, streaming responses, health checks, and
 * environment variable configuration.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  RoutingDecision,
  ProcessResult,
  AdapterHealthCheckResult,
  OpenAIAdapterConfig,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIModelsResponse,
  OpenAIErrorResponse,
} from "@lsi/protocol";

/**
 * Custom error for OpenAIAdapter failures
 */
export class OpenAIAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "OpenAIAdapterError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<OpenAIAdapterConfig, "apiKey" | "defaultModel"> = {
  baseURL: "https://api.openai.com/v1",
  timeout: 60000,
  maxRetries: 3,
  stream: false,
};

/**
 * OpenAIAdapter - Executes inference requests via OpenAI API
 *
 * @example
 * ```typescript
 * const adapter = new OpenAIAdapter('sk-...', 'gpt-4');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export class OpenAIAdapter {
  private axiosInstance: AxiosInstance;
  private config: OpenAIAdapterConfig;

  /**
   * Create a new OpenAIAdapter
   *
   * @param apiKey - OpenAI API key (default: from OPENAI_API_KEY env)
   * @param defaultModel - Default model to use (default: from OPENAI_MODEL env or 'gpt-3.5-turbo')
   * @param config - Optional configuration overrides
   * @throws Error if API key is not provided
   */
  constructor(
    apiKey?: string,
    defaultModel?: string,
    config?: Partial<OpenAIAdapterConfig>
  ) {
    const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
    if (!finalApiKey) {
      throw new OpenAIAdapterError(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey parameter.",
        "MISSING_API_KEY"
      );
    }

    const finalModel =
      defaultModel || process.env.OPENAI_MODEL || "gpt-3.5-turbo";
    const finalBaseUrl =
      config?.baseURL || process.env.OPENAI_BASE_URL || DEFAULT_CONFIG.baseURL;

    this.config = {
      apiKey: finalApiKey,
      baseURL: finalBaseUrl,
      organization: config?.organization || process.env.OPENAI_ORGANIZATION,
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    if (this.config.organization) {
      headers["OpenAI-Organization"] = this.config.organization;
    }

    return headers;
  }

  /**
   * Execute a routing decision with the given input
   *
   * @param decision - Routing decision containing backend, model, confidence
   * @param input - Input prompt to process
   * @returns Process result with content, metadata, latency
   * @throws OpenAIAdapterError on failure after retries
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
      const request: OpenAIChatRequest = {
        model,
        messages: [{ role: "user", content: input }],
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      };

      // Execute with retry logic
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post<OpenAIChatResponse>(
          "/chat/completions",
          request
        );
        return result.data;
      });

      const latency = Date.now() - startTime;

      // Extract content from response
      const content = response.choices[0]?.message?.content || "";
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        content,
        backend: decision.backend,
        model: response.model || model,
        tokensUsed,
        latency,
        metadata: {
          model: response.model || model,
          tokensUsed,
          latency,
          backend: decision.backend,
          finishReason: response.choices[0]?.finish_reason,
        },
      };
    } catch (error) {
      throw this.handleError(error, "execute");
    }
  }

  /**
   * Process a prompt with the given model
   *
   * Alias for execute() for compatibility. Routes to cloud backend with
   * the specified model or default.
   *
   * @param prompt - Input prompt to process
   * @param model - Model to use (optional, falls back to defaultModel from config)
   * @returns Process result with content, tokens used, and latency
   * @throws {OpenAIAdapterError} When processing fails after retries or API key is invalid
   *
   * @example
   * ```ts
   * const result = await adapter.process("Explain machine learning");
   * console.log(result.content);
   * ```
   */
  async process(prompt: string, model?: string): Promise<ProcessResult> {
    const decision: RoutingDecision = {
      backend: "cloud",
      model: model || this.config.defaultModel,
      confidence: 1.0,
      reason: "Direct processing via OpenAIAdapter",
      appliedPrinciples: [],
      cacheResponse: false,
    };

    return this.execute(decision, prompt);
  }

  /**
   * Process a prompt with streaming response
   *
   * Streams the response chunk by chunk, calling the onChunk callback for each
   * chunk. Accumulates the full response and returns it when complete.
   *
   * @param prompt - Input prompt to process
   * @param model - Model to use (optional, falls back to defaultModel from config)
   * @param onChunk - Callback for each chunk received (chunk, done)
   * @returns Process result with accumulated content, tokens used, and latency
   * @throws {OpenAIAdapterError} When streaming fails or connection is interrupted
   *
   * @example
   * ```ts
   * const result = await adapter.processStream(
   *   "Count to 100",
   *   "gpt-4",
   *   (chunk, done) => {
   *     if (!done) process.stdout.write(chunk);
   *     else console.log("\nDone!");
   *   }
   * );
   * ```
   */
  async processStream(
    prompt: string,
    model?: string,
    onChunk?: (chunk: string, done: boolean) => void
  ): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      const finalModel = model || this.config.defaultModel;

      const request: OpenAIChatRequest = {
        model: finalModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      };

      // Execute with retry logic (for initial connection only)
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post(
          "/chat/completions",
          request,
          {
            responseType: "stream",
          }
        );
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
            const message = line.replace(/^data: /, "");
            if (message === "[DONE]") {
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

            try {
              const parsed = JSON.parse(message);
              const delta = parsed.choices[0]?.delta?.content || "";
              if (delta) {
                content += delta;
                if (onChunk) {
                  onChunk(delta, false);
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
   * Check health of OpenAI service and list available models
   *
   * Note: This does NOT retry aggressively like execute() does.
   * Health checks should fail fast to indicate service issues.
   *
   * @returns Health check result with available chat models list and status
   * @throws {OpenAIAdapterError} When health check fails to connect or API key is invalid
   *
   * @example
   * ```ts
   * const health = await adapter.checkHealth();
   * if (health.healthy) {
   *   console.log("Available models:", health.models);
   * } else {
   *   console.error("Service unhealthy:", health.error);
   * }
   * ```
   */
  async checkHealth(): Promise<AdapterHealthCheckResult> {
    try {
      const result =
        await this.axiosInstance.get<OpenAIModelsResponse>("/models");
      const response = result.data;

      // Filter for chat models
      const chatModels = response.data
        .filter(m => m.id.includes("gpt"))
        .map(m => m.id);

      const isHealthy = chatModels.length > 0;

      return {
        healthy: isHealthy,
        models: chatModels,
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

      // Check for OpenAI-specific error codes
      const data = error.response?.data as OpenAIErrorResponse;
      if (data?.error?.code) {
        const errorCode = data.error.code;
        // Don't retry these specific errors
        const nonRetryableCodes = [
          "invalid_api_key",
          "insufficient_quota",
          "invalid_request",
          "model_not_found",
        ];
        return nonRetryableCodes.includes(errorCode);
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
   * Convert unknown error to OpenAIAdapterError
   *
   * @param error - Error to convert
   * @param context - Context where error occurred
   * @returns OpenAIAdapterError
   */
  private handleError(error: unknown, context: string): OpenAIAdapterError {
    if (error instanceof OpenAIAdapterError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNREFUSED") {
        return new OpenAIAdapterError(
          `OpenAI service unreachable at ${this.config.baseURL}`,
          "ECONNREFUSED",
          error
        );
      }

      if (
        axiosError.code === "ETIMEDOUT" ||
        axiosError.code === "ECONNABORTED"
      ) {
        return new OpenAIAdapterError(
          `Request timeout after ${this.config.timeout}ms`,
          "TIMEOUT",
          error
        );
      }

      // Handle OpenAI-specific errors
      const data = axiosError.response?.data as OpenAIErrorResponse;
      if (data?.error) {
        const openAIError = data.error;
        return new OpenAIAdapterError(
          `OpenAI API error: ${openAIError.message} (type: ${openAIError.type}, code: ${openAIError.code || "N/A"})`,
          openAIError.code || openAIError.type,
          error
        );
      }

      // Handle HTTP status codes
      if (status === 401) {
        return new OpenAIAdapterError(
          "Invalid API key. Please check your OPENAI_API_KEY.",
          "INVALID_API_KEY",
          error
        );
      }

      if (status === 429) {
        return new OpenAIAdapterError(
          "Rate limit exceeded. Please retry later.",
          "RATE_LIMIT_EXCEEDED",
          error
        );
      }

      if (status === 500) {
        return new OpenAIAdapterError(
          "OpenAI internal server error",
          "INTERNAL_ERROR",
          error
        );
      }

      return new OpenAIAdapterError(
        `HTTP ${status}: ${axiosError.message}`,
        "HTTP_ERROR",
        error
      );
    }

    if (error instanceof Error) {
      return new OpenAIAdapterError(
        `${context}: ${error.message}`,
        "UNKNOWN_ERROR",
        error
      );
    }

    return new OpenAIAdapterError(
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
  getConfig(): Omit<OpenAIAdapterConfig, "apiKey"> & { apiKey: string };
  getConfig(): OpenAIAdapterConfig;
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
  updateConfig(config: Partial<OpenAIAdapterConfig>): void {
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

    // Update headers if API key or organization changed
    if (config.apiKey !== undefined || config.organization !== undefined) {
      const headers = this.buildHeaders();
      Object.assign(this.axiosInstance.defaults.headers.common, headers);
    }
  }
}

/**
 * Factory function to create an OpenAIAdapter
 *
 * @param apiKey - OpenAI API key (optional, from env by default)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @returns Configured OpenAIAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createOpenAIAdapter();
 *
 * // Specify custom values
 * const adapter = createOpenAIAdapter('sk-...', 'gpt-4', {
 *   timeout: 120000,
 *   maxRetries: 5,
 * });
 * ```
 */
export function createOpenAIAdapter(
  apiKey?: string,
  defaultModel?: string,
  config?: Partial<OpenAIAdapterConfig>
): OpenAIAdapter {
  return new OpenAIAdapter(apiKey, defaultModel, config);
}

/**
 * Export default class as default
 */
export default OpenAIAdapter;
