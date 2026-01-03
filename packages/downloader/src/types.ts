/**
 * Download options interface
 */
export interface DownloadOptions {
  /** Resume interrupted download */
  resume?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  retries?: number;
  /** Progress callback */
  onProgress?: (progress: DownloadProgress) => void;
  /** Verify checksum after download */
  verifyChecksum?: boolean;
  /** Expected checksum (SHA-256) */
  expectedChecksum?: string;
  /** Extract archive after download */
  extract?: boolean;
  /** Delete archive after extraction */
  deleteAfterExtract?: boolean;
  /** Concurrent download chunks */
  chunks?: number;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Component name */
  component: string;
  /** Component version */
  version: string;
  /** Bytes downloaded */
  downloaded: number;
  /** Total bytes to download */
  total: number;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Download speed in bytes per second */
  speed: number;
  /** Estimated time remaining in seconds */
  eta: number;
  /** Current chunk being downloaded */
  chunk?: number;
  /** Total chunks */
  totalChunks?: number;
}

/**
 * Download result
 */
export interface DownloadResult {
  /** Local file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Checksum (SHA-256) */
  checksum: string;
  /** Whether download was resumed from partial */
  resumed: boolean;
  /** Download duration in milliseconds */
  duration: number;
  /** Average speed in bytes per second */
  averageSpeed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cached components */
  count: number;
  /** Total size in bytes */
  totalSize: number;
  /** Oldest entry timestamp */
  oldestEntry: number;
  /** Newest entry timestamp */
  newestEntry: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Cache misses */
  misses: number;
  /** Cache hits */
  hits: number;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  /** Component name */
  component: string;
  /** Component version */
  version: string;
  /** Local file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Checksum (SHA-256) */
  checksum: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** Timestamp when last accessed */
  accessedAt: number;
  /** Number of accesses */
  accessCount: number;
}

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial backoff delay in milliseconds */
  initialDelay: number;
  /** Maximum backoff delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  multiplier: number;
  /** Jitter factor (0-1) */
  jitter: number;
  /** Whether to retry on specific error codes */
  retryableErrors: number[];
  /** Retry condition callback */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Download error
 */
export class DownloadError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

/**
 * Checksum verification error
 */
export class ChecksumError extends Error {
  constructor(
    message: string,
    public expected: string,
    public actual: string
  ) {
    super(message);
    this.name = 'ChecksumError';
  }
}

/**
 * Extraction error
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public archive: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}
