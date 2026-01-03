/**
 * GeminiAdapter - Real implementation for cloud LLM inference via Google Gemini API
 *
 * This adapter makes actual HTTP calls to the Google AI API to perform cloud inference.
 * It supports retry logic with jitter, streaming responses, health checks, and
 * environment variable configuration.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  RoutingDecision,
  ProcessResult,
  AdapterHealthCheckResult,
  GeminiAdapterConfig,
  GeminiChatRequest,
  GeminiChatResponse,
  GeminiErrorResponse,
} from "@lsi/protocol";

/**
 * Custom error for GeminiAdapter failures
 */
export class GeminiAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "GeminiAdapterError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<GeminiAdapterConfig, "apiKey" | "defaultModel"> = {
  baseURL: "https://generativelanguage.googleapis.com",
  timeout: 60000,
  maxRetries: 3,
  stream: false,
};

/**
 * Supported Gemini models
 */
export const GEMINI_MODELS = {
  GEMINI_2_0_FLASH_EXPERT: "gemini-2.0-flash-expert",
  GEMINI_1_5_PRO: "gemini-1.5-pro",
  GEMINI_1_5_FLASH: "gemini-1.5-flash",
  GEMINI_1_0_PRO: "gemini-1.0-pro",
  GEMINI_PRO: "gemini-pro",
  GEMINI_FLASH: "gemini-flash",
} as const;

/**
 * GeminiAdapter - Executes inference requests via Google Gemini API
 *
 * @example
 * ```typescript
 * const adapter = new GeminiAdapter('AIza...', 'gemini-1.5-pro');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export class GeminiAdapter {
  private axiosInstance: AxiosInstance;
  private config: GeminiAdapterConfig;

  /**
   * Create a new GeminiAdapter
   *
   * @param apiKey - Google AI API key (default: from GOOGLE_API_KEY env)
   * @param defaultModel - Default model to use (default: from GOOGLE_MODEL env or 'gemini-1.5-pro')
   * @param config - Optional configuration overrides
   * @throws Error if API key is not provided
   */
  constructor(
    apiKey?: string,
    defaultModel?: string,
    config?: Partial<GeminiAdapterConfig>
  ) {
    const finalApiKey = apiKey || process.env.GOOGLE_API_KEY;
    if (!finalApiKey) {
      throw new GeminiAdapterError(
        "Google AI API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey parameter.",
        "MISSING_API_KEY"
      );
    }

    const finalModel =
      defaultModel || process.env.GOOGLE_MODEL || GEMINI_MODELS.GEMINI_1_5_PRO;
    const finalBaseUrl =
      config?.baseURL || process.env.GOOGLE_BASE_URL || DEFAULT_CONFIG.baseURL;

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
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Build endpoint URL for model
   *
   * @param model - Model name
   * @returns Endpoint URL
   */
  private buildEndpoint(model: string): string {
    return `/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
  }

  /**
   * Execute a routing decision with the given input
   *
   * @param decision - Routing decision containing backend, model, confidence
   * @param input - Input prompt to process
   * @returns Process result with content, metadata, latency
   * @throws GeminiAdapterError on failure after retries
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
      const request: GeminiChatRequest = {
        model,
        contents: [
          {
            parts: [{ text: input }],
            role: "user",
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      };

      // Execute with retry logic
      const response = await this.withRetry(async () => {
        const endpoint = this.buildEndpoint(model);
        const result = await this.axiosInstance.post<GeminiChatResponse>(
          endpoint,
          request
        );
        return result.data;
      });

      const latency = Date.now() - startTime;

      // Extract content from response
      const candidate = response.candidates[0];
      const content =
        candidate?.content?.parts?.map(p => p.text || "").join("") || "";
      const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

      return {
        content,
        backend: decision.backend,
        model: response.modelVersion || model,
        tokensUsed,
        latency,
        metadata: {
          model: response.modelVersion || model,
          tokensUsed,
          latency,
          backend: decision.backend,
          finishReason: candidate?.finishReason,
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
      reason: "Direct processing via GeminiAdapter",
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

      const request: GeminiChatRequest = {
        model: finalModel,
        contents: [
          {
            parts: [{ text: prompt }],
            role: "user",
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      };

      // Execute with retry logic (for initial connection only)
      const endpoint = this.buildEndpoint(finalModel);
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post(endpoint, request, {
          responseType: "stream",
          params: {
            key: this.config.apiKey,
            alt: "sse", // Server-sent events for streaming
          },
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
              const candidate = parsed.candidates?.[0];
              const delta = candidate?.content?.parts?.[0]?.text || "";
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
   * Check health of Gemini service
   *
   * Note: Gemini doesn't have a dedicated health endpoint, so we do a minimal
   * completion request to check health.
   *
   * @returns Health check result
   */
  async checkHealth(): Promise<AdapterHealthCheckResult> {
    try {
      // Make a minimal request to check connectivity
      const model = this.config.defaultModel;
      const request: GeminiChatRequest = {
        model,
        contents: [
          {
            parts: [{ text: "test" }],
            role: "user",
          },
        ],
        generationConfig: {
          maxOutputTokens: 1,
        },
      };

      const endpoint = this.buildEndpoint(model);
      await this.axiosInstance.post<GeminiChatResponse>(endpoint, request);

      const chatModels = Object.values(GEMINI_MODELS);

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

      // Check for Google-specific error codes
      const data = error.response?.data as GeminiErrorResponse;
      if (data?.error) {
        // Don't retry authentication and permission errors
        if (data.error.status === "UNAUTHENTICATED" ||
            data.error.status === "PERMISSION_DENIED") {
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
   * Convert unknown error to GeminiAdapterError
   *
   * @param error - Error to convert
   * @param context - Context where error occurred
   * @returns GeminiAdapterError
   */
  private handleError(error: unknown, context: string): GeminiAdapterError {
    if (error instanceof GeminiAdapterError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNREFUSED") {
        return new GeminiAdapterError(
          `Gemini service unreachable at ${this.config.baseURL}`,
          "ECONNREFUSED",
          error
        );
      }

      if (
        axiosError.code === "ETIMEDOUT" ||
        axiosError.code === "ECONNABORTED"
      ) {
        return new GeminiAdapterError(
          `Request timeout after ${this.config.timeout}ms`,
          "TIMEOUT",
          error
        );
      }

      // Handle Google-specific errors
      const data = axiosError.response?.data as GeminiErrorResponse;
      if (data?.error) {
        return new GeminiAdapterError(
          `Google AI API error: ${data.error.message} (status: ${data.error.status})`,
          data.error.status,
          error
        );
      }

      // Handle HTTP status codes
      if (status === 401) {
        return new GeminiAdapterError(
          "Invalid API key. Please check your GOOGLE_API_KEY.",
          "INVALID_API_KEY",
          error
        );
      }

      if (status === 429) {
        return new GeminiAdapterError(
          "Rate limit exceeded. Please retry later.",
          "RATE_LIMIT_EXCEEDED",
          error
        );
      }

      if (status === 500) {
        return new GeminiAdapterError(
          "Google AI internal server error",
          "INTERNAL_ERROR",
          error
        );
      }

      return new GeminiAdapterError(
        `HTTP ${status}: ${axiosError.message}`,
        "HTTP_ERROR",
        error
      );
    }

    if (error instanceof Error) {
      return new GeminiAdapterError(
        `${context}: ${error.message}`,
        "UNKNOWN_ERROR",
        error
      );
    }

    return new GeminiAdapterError(
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
  getConfig(): Omit<GeminiAdapterConfig, "apiKey"> & { apiKey: string };
  getConfig(): GeminiAdapterConfig;
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
  updateConfig(config: Partial<GeminiAdapterConfig>): void {
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
}

/**
 * Factory function to create a GeminiAdapter
 *
 * @param apiKey - Google AI API key (optional, from env by default)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @returns Configured GeminiAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createGeminiAdapter();
 *
 * // Specify custom values
 * const adapter = createGeminiAdapter('AIza...', 'gemini-1.5-pro', {
 *   timeout: 120000,
 *   maxRetries: 5,
 * });
 * ```
 */
export function createGeminiAdapter(
  apiKey?: string,
  defaultModel?: string,
  config?: Partial<GeminiAdapterConfig>
): GeminiAdapter {
  return new GeminiAdapter(apiKey, defaultModel, config);
}

/**
 * Export default class as default
 */
export default GeminiAdapter;
