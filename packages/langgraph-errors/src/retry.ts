/**
 * @file retry.ts - Retry strategies and management
 * @package @lsi/langgraph-errors
 */

import type {
  AgentError,
  RetryConfig,
  RecoveryResult,
  ErrorPolicy,
} from "./types.js";

/**
 * Calculate delay for retry
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const {
    initial_delay,
    max_delay = Infinity,
    backoff_multiplier = 2,
    strategy,
  } = config;

  let delay: number;

  switch (strategy) {
    case "fixed":
      delay = initial_delay;
      break;

    case "exponential":
      delay = initial_delay * Math.pow(backoff_multiplier, attempt);
      break;

    case "linear":
      delay = initial_delay * (attempt + 1);
      break;

    case "jitter":
      const baseDelay = initial_delay * Math.pow(backoff_multiplier, attempt);
      const jitter = baseDelay * (config.jitter_factor || 0.5);
      delay = baseDelay + (Math.random() * jitter - jitter / 2);
      break;

    default:
      delay = initial_delay;
  }

  return Math.min(delay, max_delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry manager
 */
export class RetryManager {
  private defaultConfig: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.defaultConfig = {
      max_attempts: config?.max_attempts ?? 3,
      initial_delay: config?.initial_delay ?? 1000,
      max_delay: config?.max_delay ?? 30000,
      backoff_multiplier: config?.backoff_multiplier ?? 2,
      jitter_factor: config?.jitter_factor ?? 0.1,
      strategy: config?.strategy ?? "exponential",
      retry_condition: config?.retry_condition,
    };
  }

  /**
   * Retry an operation with configured strategy
   */
  async retry<T>(
    error: AgentError,
    policy: ErrorPolicy,
    operation: () => Promise<T>
  ): Promise<RecoveryResult> {
    const config = this.buildConfig(policy);
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < config.max_attempts) {
      try {
        // Check retry condition
        if (attempt > 0 && config.retry_condition) {
          const shouldRetry = config.retry_condition(error);
          if (!shouldRetry) {
            break;
          }
        }

        // Attempt operation
        const result = await operation();

        return {
          success: true,
          strategy: "retry",
          result,
          recovery_time: 0,
          attempts: attempt + 1,
        };
      } catch (e) {
        lastError = e as Error;
        attempt++;

        // Update error retry count
        error.retry_count = attempt;

        // Check if we should stop retrying
        if (attempt >= config.max_attempts) {
          break;
        }

        // Check retry condition
        if (config.retry_condition && !config.retry_condition(error)) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt, config);
        await sleep(delay);
      }
    }

    return {
      success: false,
      strategy: "retry",
      error,
      recovery_time: 0,
      attempts: attempt,
    };
  }

  /**
   * Fixed delay retry
   */
  async retryWithFixedDelay<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    delay: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxAttempts - 1) {
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Exponential backoff retry
   */
  async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    initialDelay: number,
    maxDelay?: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxAttempts - 1) {
          const delay = Math.min(
            initialDelay * Math.pow(2, attempt),
            maxDelay || Infinity
          );
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Linear backoff retry
   */
  async retryWithLinearBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    initialDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxAttempts - 1) {
          const delay = initialDelay * (attempt + 1);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Jitter-based retry
   */
  async retryWithJitter<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    initialDelay: number,
    jitterFactor: number = 0.5
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxAttempts - 1) {
          const baseDelay = initialDelay * Math.pow(2, attempt);
          const jitter = baseDelay * jitterFactor;
          const delay = baseDelay + (Math.random() * jitter - jitter / 2);
          await sleep(Math.max(0, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Conditional retry
   */
  async retryIf<T>(
    operation: () => Promise<T>,
    condition: (error: Error) => boolean,
    maxAttempts: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e as Error;
        if (!condition(lastError) || attempt >= maxAttempts - 1) {
          break;
        }
        await sleep(1000 * (attempt + 1));
      }
    }

    throw lastError;
  }

  /**
   * Build retry config from policy
   */
  private buildConfig(policy: ErrorPolicy): RetryConfig {
    return {
      max_attempts: policy.max_retries,
      initial_delay: 1000,
      max_delay: 30000,
      backoff_multiplier: 2,
      jitter_factor: 0.1,
      strategy: "exponential",
    };
  }

  /**
   * Get default config
   */
  getDefaultConfig(): RetryConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Create custom retry config
   */
  createConfig(overrides: Partial<RetryConfig>): RetryConfig {
    return {
      ...this.defaultConfig,
      ...overrides,
    };
  }
}

/**
 * Singleton instance
 */
export const retryManager = new RetryManager();

/**
 * Convenience functions
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  return retryManager.retryWithFixedDelay(operation, maxAttempts, delay);
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000,
  maxDelay?: number
): Promise<T> {
  return retryManager.retryWithExponentialBackoff(
    operation,
    maxAttempts,
    initialDelay,
    maxDelay
  );
}

export async function retryWithLinearBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  return retryManager.retryWithLinearBackoff(
    operation,
    maxAttempts,
    initialDelay
  );
}

export async function retryWithJitter<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000,
  jitterFactor: number = 0.5
): Promise<T> {
  return retryManager.retryWithJitter(
    operation,
    maxAttempts,
    initialDelay,
    jitterFactor
  );
}
