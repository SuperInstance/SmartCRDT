/**
 * ClaudeAdapter - Real implementation for cloud LLM inference via Anthropic Claude API
 *
 * This adapter makes actual HTTP calls to the Anthropic API to perform cloud inference.
 * It supports retry logic with jitter, streaming responses, health checks, and
 * environment variable configuration.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type {
  RoutingDecision,
  ProcessResult,
  AdapterHealthCheckResult,
  ClaudeAdapterConfig,
  ClaudeChatRequest,
  ClaudeChatResponse,
  ClaudeErrorResponse,
} from "@lsi/protocol";

/**
 * Custom error for ClaudeAdapter failures
 */
export class ClaudeAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "ClaudeAdapterError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<ClaudeAdapterConfig, "apiKey" | "defaultModel"> = {
  baseURL: "https://api.anthropic.com",
  version: "2023-06-01",
  timeout: 60000,
  maxRetries: 3,
  stream: false,
};

/**
 * Supported Claude models
 */
export const CLAUDE_MODELS = {
  CLAUDE_3_5_SONNET: "claude-3-5-sonnet-20241022",
  CLAUDE_3_5_SONNET_LATEST: "claude-3-5-sonnet-latest",
  CLAUDE_3_5_HAIKU: "claude-3-5-haiku-20241022",
  CLAUDE_3_OPUS: "claude-3-opus-20240229",
  CLAUDE_3_SONNET: "claude-3-sonnet-20240229",
  CLAUDE_3_HAIKU: "claude-3-haiku-20240307",
} as const;

/**
 * ClaudeAdapter - Executes inference requests via Anthropic Claude API
 *
 * @example
 * ```typescript
 * const adapter = new ClaudeAdapter('sk-ant-...', 'claude-3-5-sonnet-20241022');
 * const result = await adapter.execute(decision, 'What is 2+2?');
 * console.log(result.content);
 * ```
 */
export class ClaudeAdapter {
  private axiosInstance: AxiosInstance;
  private config: ClaudeAdapterConfig;

  /**
   * Create a new ClaudeAdapter
   *
   * @param apiKey - Anthropic API key (default: from ANTHROPIC_API_KEY env)
   * @param defaultModel - Default model to use (default: from ANTHROPIC_MODEL env or 'claude-3-5-sonnet-20241022')
   * @param config - Optional configuration overrides
   * @throws Error if API key is not provided
   */
  constructor(
    apiKey?: string,
    defaultModel?: string,
    config?: Partial<ClaudeAdapterConfig>
  ) {
    const finalApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!finalApiKey) {
      throw new ClaudeAdapterError(
        "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey parameter.",
        "MISSING_API_KEY"
      );
    }

    const finalModel =
      defaultModel ||
      process.env.ANTHROPIC_MODEL ||
      CLAUDE_MODELS.CLAUDE_3_5_SONNET;
    const finalBaseUrl =
      config?.baseURL || process.env.ANTHROPIC_BASE_URL || DEFAULT_CONFIG.baseURL;

    this.config = {
      apiKey: finalApiKey,
      baseURL: finalBaseUrl,
      defaultModel: finalModel,
      version: config?.version || DEFAULT_CONFIG.version,
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
      "x-api-key": this.config.apiKey,
      "anthropic-version": this.config.version || DEFAULT_CONFIG.version,
    };
  }

  /**
   * Execute a routing decision with the given input
   *
   * @param decision - Routing decision containing backend, model, confidence
   * @param input - Input prompt to process
   * @returns Process result with content, metadata, latency
   * @throws ClaudeAdapterError on failure after retries
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
      const request: ClaudeChatRequest = {
        model,
        messages: [{ role: "user", content: input }],
        max_tokens: 4096,
        temperature: 0.7,
        stream: false,
      };

      // Execute with retry logic
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post<ClaudeChatResponse>(
          "/v1/messages",
          request
        );
        return result.data;
      });

      const latency = Date.now() - startTime;

      // Extract content from response
      const content =
        response.content
          .filter(block => block.type === "text")
          .map(block => block.text)
          .join("") || "";
      const tokensUsed =
        response.usage.input_tokens + response.usage.output_tokens;

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
          stopReason: response.stop_reason,
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
      reason: "Direct processing via ClaudeAdapter",
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

      const request: ClaudeChatRequest = {
        model: finalModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.7,
        stream: true,
      };

      // Execute with retry logic (for initial connection only)
      const response = await this.withRetry(async () => {
        const result = await this.axiosInstance.post("/v1/messages", request, {
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
              if (parsed.type === "content_block_delta") {
                const delta = parsed.delta?.text || "";
                if (delta) {
                  content += delta;
                  if (onChunk) {
                    onChunk(delta, false);
                  }
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
   * Check health of Claude service
   *
   * Note: Anthropic doesn't have a models endpoint, so we do a minimal
   * completion request to check health.
   *
   * @returns Health check result
   */
  async checkHealth(): Promise<AdapterHealthCheckResult> {
    try {
      // Make a minimal request to check connectivity
      const request: ClaudeChatRequest = {
        model: this.config.defaultModel,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      };

      await this.axiosInstance.post<ClaudeChatResponse>(
        "/v1/messages",
        request
      );

      const chatModels = Object.values(CLAUDE_MODELS);

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

      // Check for Anthropic-specific error types
      const data = error.response?.data as ClaudeErrorResponse;
      if (data?.error?.type) {
        const errorType = data.error.type;
        // Don't retry these specific errors
        const nonRetryableTypes = [
          "invalid_request_error",
          "authentication_error",
          "permission_error",
          "not_found_error",
        ];
        return nonRetryableTypes.includes(errorType);
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
   * Convert unknown error to ClaudeAdapterError
   *
   * @param error - Error to convert
   * @param context - Context where error occurred
   * @returns ClaudeAdapterError
   */
  private handleError(error: unknown, context: string): ClaudeAdapterError {
    if (error instanceof ClaudeAdapterError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNREFUSED") {
        return new ClaudeAdapterError(
          `Claude service unreachable at ${this.config.baseURL}`,
          "ECONNREFUSED",
          error
        );
      }

      if (
        axiosError.code === "ETIMEDOUT" ||
        axiosError.code === "ECONNABORTED"
      ) {
        return new ClaudeAdapterError(
          `Request timeout after ${this.config.timeout}ms`,
          "TIMEOUT",
          error
        );
      }

      // Handle Anthropic-specific errors
      const data = axiosError.response?.data as ClaudeErrorResponse;
      if (data?.error) {
        const claudeError = data.error;
        return new ClaudeAdapterError(
          `Anthropic API error: ${claudeError.message} (type: ${claudeError.type})`,
          claudeError.type,
          error
        );
      }

      // Handle HTTP status codes
      if (status === 401) {
        return new ClaudeAdapterError(
          "Invalid API key. Please check your ANTHROPIC_API_KEY.",
          "INVALID_API_KEY",
          error
        );
      }

      if (status === 429) {
        return new ClaudeAdapterError(
          "Rate limit exceeded. Please retry later.",
          "RATE_LIMIT_EXCEEDED",
          error
        );
      }

      if (status === 500) {
        return new ClaudeAdapterError(
          "Anthropic internal server error",
          "INTERNAL_ERROR",
          error
        );
      }

      return new ClaudeAdapterError(
        `HTTP ${status}: ${axiosError.message}`,
        "HTTP_ERROR",
        error
      );
    }

    if (error instanceof Error) {
      return new ClaudeAdapterError(
        `${context}: ${error.message}`,
        "UNKNOWN_ERROR",
        error
      );
    }

    return new ClaudeAdapterError(
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
  getConfig(): Omit<ClaudeAdapterConfig, "apiKey"> & { apiKey: string };
  getConfig(): ClaudeAdapterConfig;
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
  updateConfig(config: Partial<ClaudeAdapterConfig>): void {
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
 * Factory function to create a ClaudeAdapter
 *
 * @param apiKey - Anthropic API key (optional, from env by default)
 * @param defaultModel - Default model to use (optional)
 * @param config - Optional configuration overrides
 * @returns Configured ClaudeAdapter instance
 *
 * @example
 * ```typescript
 * // Use defaults from environment
 * const adapter = createClaudeAdapter();
 *
 * // Specify custom values
 * const adapter = createClaudeAdapter('sk-ant-...', 'claude-3-opus', {
 *   timeout: 120000,
 *   maxRetries: 5,
 * });
 * ```
 */
export function createClaudeAdapter(
  apiKey?: string,
  defaultModel?: string,
  config?: Partial<ClaudeAdapterConfig>
): ClaudeAdapter {
  return new ClaudeAdapter(apiKey, defaultModel, config);
}

/**
 * Export default class as default
 */
export default ClaudeAdapter;
