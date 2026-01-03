import { RetryOptions, DownloadError } from './types.js';

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: 0.1,
  retryableErrors: [408, 429, 500, 502, 503, 504],
  shouldRetry: undefined,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  // Exponential backoff
  const exponentialDelay = Math.min(
    options.initialDelay * Math.pow(options.multiplier, attempt),
    options.maxDelay
  );

  // Add jitter to prevent thundering herd
  const jitterRange = exponentialDelay * options.jitter;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.max(0, exponentialDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, options: RetryOptions): boolean {
  // Check if it's a DownloadError with retryable code
  if (error instanceof DownloadError) {
    const code = error.code;
    if (typeof code === 'number' && options.retryableErrors.includes(code)) {
      return true;
    }
  }

  // Network errors are generally retryable
  if (error.name === 'NetworkError' || error.name === 'TypeError') {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetryCallback = opts.shouldRetry || (() => isRetryableError(lastError!, opts));
      if (attempt < opts.maxRetries && shouldRetryCallback(lastError, attempt)) {
        const delay = calculateDelay(attempt, opts);
        console.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms: ${lastError.message}`);
        await sleep(delay);
        continue;
      }

      // Don't retry, throw the error
      throw lastError;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create a retryable function wrapper
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(async () => fn(...args), options);
  }) as T;
}

/**
 * Execute multiple operations with retry and concurrency limit
 */
export async function batchRetry<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: Partial<RetryOptions & { concurrency: number }> = {}
): Promise<R[]> {
  const concurrency = options.concurrency || 5;
  const results: R[] = new Array(items.length);
  const errors: Error[] = new Array(items.length);

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const index = i + batchIndex;
      try {
        results[index] = await withRetry(() => fn(item, index), options);
      } catch (error) {
        errors[index] = error as Error;
        throw error;
      }
    });

    await Promise.all(batchPromises);
  }

  return results;
}

/**
 * Calculate retry statistics
 */
export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  retryCount: number;
  averageRetriesPerSuccess: number;
}

export class RetryTracker {
  private stats: Map<string, RetryStats> = new Map();

  recordSuccess(operation: string, attempts: number): void {
    const current = this.stats.get(operation) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      retryCount: 0,
      averageRetriesPerSuccess: 0,
    };

    current.totalAttempts += attempts;
    current.successfulAttempts++;
    current.retryCount += attempts - 1;
    current.averageRetriesPerSuccess = current.retryCount / current.successfulAttempts;

    this.stats.set(operation, current);
  }

  recordFailure(operation: string, attempts: number): void {
    const current = this.stats.get(operation) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      retryCount: 0,
      averageRetriesPerSuccess: 0,
    };

    current.totalAttempts += attempts;
    current.failedAttempts++;

    this.stats.set(operation, current);
  }

  getStats(operation?: string): RetryStats | Map<string, RetryStats> {
    if (operation) {
      return this.stats.get(operation) || {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        retryCount: 0,
        averageRetriesPerSuccess: 0,
      };
    }
    return this.stats;
  }

  reset(): void {
    this.stats.clear();
  }
}

/**
 * Decorator for retrying async class methods
 */
export function retryable(options: Partial<RetryOptions> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
