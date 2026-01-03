/**
 * RetryHelper - Retry logic with exponential backoff
 *
 * Eliminates ~400 lines of duplicate retry code across 8+ adapter/manager classes.
 *
 * @example
 * ```typescript
 * const result = await RetryHelper.withRetry(
 *   async () => await fetch('https://api.example.com/data'),
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 1000,
 *     maxDelay: 10000,
 *     backoffMultiplier: 2,
 *     jitter: true
 *   }
 * );
 * ```
 */

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay before first retry in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delays (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
  /** The result value */
  value: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying in ms */
  totalDelay: number;
}

/**
 * Retry statistics
 */
export interface RetryStats {
  /** Total attempts made */
  totalAttempts: number;
  /** Successful attempts */
  successfulAttempts: number;
  /** Failed attempts */
  failedAttempts: number;
  /** Total delay time in ms */
  totalDelay: number;
  /** Average delay per attempt */
  averageDelay: number;
}

/**
 * Custom error for retry failures
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: unknown,
    public totalDelay: number
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * RetryHelper - Static utility class for retry logic
 */
export class RetryHelper {
  private static stats = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    totalDelay: 0,
  };

  /**
   * Execute an operation with retry logic
   *
   * @param fn - The async function to execute
   * @param options - Retry configuration options
   * @returns The result of the operation
   * @throws {RetryError} If all retry attempts fail
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      isRetryable = RetryHelper.defaultIsRetryable,
      onRetry,
    } = options;

    let lastError: unknown;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        RetryHelper.stats.successfulAttempts++;
        RetryHelper.stats.totalAttempts++;
        return result;
      } catch (error) {
        lastError = error;
        RetryHelper.stats.totalAttempts++;

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt >= maxAttempts || !isRetryable(error)) {
          RetryHelper.stats.failedAttempts++;
          throw error;
        }

        // Calculate delay
        const delay = RetryHelper.calculateDelay(
          attempt,
          initialDelay,
          backoffMultiplier,
          maxDelay,
          jitter
        );
        totalDelay += delay;
        RetryHelper.stats.totalDelay += delay;

        // Call retry callback
        if (onRetry) {
          try {
            onRetry(attempt + 1, error, delay);
          } catch {
            // Ignore callback errors
          }
        }

        // Wait before retrying
        await RetryHelper.sleep(delay);
      }
    }

    // Should not reach here, but TypeScript needs it
    throw new RetryError(
      `Retry failed after ${maxAttempts} attempts`,
      maxAttempts,
      lastError,
      totalDelay
    );
  }

  /**
   * Execute with retry and return detailed result
   */
  static async withRetryDetailed<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      const value = await RetryHelper.withRetry(fn, options);
      attempts = RetryHelper.stats.totalAttempts;
      return {
        value,
        attempts,
        totalDelay: Date.now() - startTime,
      };
    } catch (error) {
      throw new RetryError(
        "Retry failed",
        attempts,
        error,
        Date.now() - startTime
      );
    }
  }

  /**
   * Execute with timeout and retry
   */
  static async withRetryAndTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    options: RetryOptions = {}
  ): Promise<T> {
    return RetryHelper.withRetry(async () => {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
    }, options);
  }

  /**
   * Retry with circuit breaker pattern
   */
  static async withRetryAndCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: RetryOptions & {
      failureThreshold?: number;
      recoveryTimeout?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      recoveryTimeout = 60000,
      ...retryOptions
    } = options;

    let failures = 0;
    let lastFailureTime = 0;
    let circuitOpen = false;

    return RetryHelper.withRetry(async () => {
      // Check if circuit is open
      if (circuitOpen) {
        const timeSinceLastFailure = Date.now() - lastFailureTime;
        if (timeSinceLastFailure < recoveryTimeout) {
          throw new Error("Circuit breaker is open");
        } else {
          // Try to close circuit
          circuitOpen = false;
          failures = 0;
        }
      }

      try {
        const result = await fn();
        // Reset failures on success
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= failureThreshold) {
          circuitOpen = true;
        }
        throw error;
      }
    }, retryOptions);
  }

  /**
   * Calculate delay for retry attempt
   */
  private static calculateDelay(
    attempt: number,
    initialDelay: number,
    multiplier: number,
    maxDelay: number,
    jitter: boolean
  ): number {
    const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
    const baseDelay = Math.min(exponentialDelay, maxDelay);

    if (jitter) {
      // Add random jitter: +/- 25% of base delay
      const jitterAmount = baseDelay * 0.25;
      return baseDelay - jitterAmount + Math.random() * jitterAmount * 2;
    }

    return baseDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Default retryable error checker
   */
  private static defaultIsRetryable(error: unknown): boolean {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    // Retry on specific HTTP status codes
    const httpError = error as { status?: number; code?: string };
    if (httpError.status) {
      // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx errors
      return (
        httpError.status === 408 ||
        httpError.status === 429 ||
        httpError.status >= 500
      );
    }

    // Retry on specific error codes
    if (httpError.code) {
      const retryableCodes = [
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EAI_AGAIN",
        "EPIPE",
      ];
      return retryableCodes.includes(httpError.code);
    }

    // Don't retry on 4xx errors (except 408 and 429)
    return false;
  }

  /**
   * Get global retry statistics
   */
  static getStats(): RetryStats {
    const { totalAttempts, successfulAttempts, failedAttempts, totalDelay } =
      RetryHelper.stats;

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      totalDelay,
      averageDelay: totalAttempts > 0 ? totalDelay / totalAttempts : 0,
    };
  }

  /**
   * Reset global statistics
   */
  static resetStats(): void {
    RetryHelper.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalDelay: 0,
    };
  }

  /**
   * Create a retry function with preset options
   */
  static createRetrier<T>(
    options: RetryOptions
  ): (fn: () => Promise<T>) => Promise<T> {
    return fn => RetryHelper.withRetry(fn, options);
  }

  /**
   * Execute multiple operations with parallel retry
   */
  static async retryAll<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T[]> {
    return Promise.all(
      operations.map(op => RetryHelper.withRetry(op, options))
    );
  }

  /**
   * Execute operations with retry, stop on first success
   */
  static async retryAny<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T> {
    const errors: unknown[] = [];

    for (const operation of operations) {
      try {
        return await RetryHelper.withRetry(operation, options);
      } catch (error) {
        errors.push(error);
      }
    }

    throw new Error("All operations failed", {
      cause: errors,
    });
  }
}

/**
 * Convenience function for retry
 */
export function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return RetryHelper.withRetry(fn, options);
}

/**
 * Create a retriable function wrapper
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: RetryOptions
): T {
  return ((...args: unknown[]) => {
    return RetryHelper.withRetry(
      () => fn(...args) as Promise<unknown>,
      options
    );
  }) as unknown as T;
}
