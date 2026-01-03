/**
 * I/O Profiler - Comprehensive input/output operation profiling
 *
 * Tracks and analyzes:
 * - Network request timing and throughput
 * - File I/O operations (read/write/stat)
 * - Database query performance
 * - Cache hit/miss rates and latency
 * - I/O bottlenecks and hot paths
 */

import { performance } from 'perf_hooks';

/**
 * Network request metrics
 */
export interface NetworkRequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  requestSize: number;
  responseSize: number;
  statusCode?: number;
  success: boolean;
  error?: Error;
}

/**
 * File I/O operation metrics
 */
export interface FileIOMetrics {
  path: string;
  operation: 'read' | 'write' | 'stat' | 'exists' | 'delete';
  startTime: number;
  endTime: number;
  duration: number;
  bytesProcessed: number;
  success: boolean;
  error?: Error;
}

/**
 * Database query metrics
 */
export interface DatabaseQueryMetrics {
  query: string;
  params?: any[];
  startTime: number;
  endTime: number;
  duration: number;
  rowsAffected?: number;
  rowsReturned?: number;
  success: boolean;
  error?: Error;
}

/**
 * Cache operation metrics
 */
export interface CacheMetrics {
  key: string;
  operation: 'get' | 'set' | 'delete' | 'clear';
  startTime: number;
  endTime: number;
  duration: number;
  hit?: boolean;
  size?: number;
  success: boolean;
  error?: Error;
}

/**
 * I/O statistics summary
 */
export interface IOStatistics {
  network: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p50: number;
    p95: number;
    p99: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    throughput: number; // bytes per second
    errorsByType: Record<string, number>;
  };
  file: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalDuration: number;
    averageDuration: number;
    totalBytesProcessed: number;
    throughput: number;
    operationsByType: Record<string, number>;
  };
  database: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalDuration: number;
    averageDuration: number;
    slowQueries: number; // queries > 1s
    rowsReturnedTotal: number;
    averageRowsReturned: number;
  };
  cache: {
    totalOperations: number;
    hits: number;
    misses: number;
    hitRate: number;
    totalDuration: number;
    averageGetDuration: number;
    averageSetDuration: number;
    size: number;
  };
}

/**
 * I/O Profiler configuration
 */
export interface IOProfilerConfig {
  maxNetworkSamples?: number;
  maxFileSamples?: number;
  maxDatabaseSamples?: number;
  maxCacheSamples?: number;
  slowQueryThreshold?: number; // milliseconds
  enableNetworkProfiling?: boolean;
  enableFileProfiling?: boolean;
  enableDatabaseProfiling?: boolean;
  enableCacheProfiling?: boolean;
  autoDetectBottlenecks?: boolean;
}

/**
 * I/O bottleneck report
 */
export interface IOBottleneck {
  type: 'network' | 'file' | 'database' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  impact: number; // 0-1 score
  recommendation: string;
  metrics: any;
}

/**
 * I/O Profiler class
 */
export class IOProfiler {
  private networkRequests: NetworkRequestMetrics[] = [];
  private fileOperations: FileIOMetrics[] = [];
  private databaseQueries: DatabaseQueryMetrics[] = [];
  private cacheOperations: CacheMetrics[] = [];
  private config: Required<IOProfilerConfig>;

  constructor(config: IOProfilerConfig = {}) {
    this.config = {
      maxNetworkSamples: config.maxNetworkSamples ?? 10000,
      maxFileSamples: config.maxFileSamples ?? 10000,
      maxDatabaseSamples: config.maxDatabaseSamples ?? 10000,
      maxCacheSamples: config.maxCacheSamples ?? 10000,
      slowQueryThreshold: config.slowQueryThreshold ?? 1000,
      enableNetworkProfiling: config.enableNetworkProfiling ?? true,
      enableFileProfiling: config.enableFileProfiling ?? true,
      enableDatabaseProfiling: config.enableDatabaseProfiling ?? true,
      enableCacheProfiling: config.enableCacheProfiling ?? true,
      autoDetectBottlenecks: config.autoDetectBottlenecks ?? true,
    };
  }

  /**
   * Profile a network request
   */
  profileNetworkRequest<T>(
    url: string,
    method: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableNetworkProfiling) {
      return requestFn();
    }

    const startTime = performance.now();
    let requestSize = 0;
    let responseSize = 0;
    let statusCode: number | undefined;
    let success = true;
    let error: Error | undefined;

    // Measure request size
    try {
      const requestStr = JSON.stringify({ url, method });
      requestSize = Buffer.byteLength(requestStr, 'utf8');
    } catch {
      requestSize = 0;
    }

    return requestFn()
      .then((response) => {
        const endTime = performance.now();

        // Try to extract status code and size from response
        if (response && typeof response === 'object') {
          statusCode = (response as any).status;
          try {
            responseSize = Buffer.byteLength(JSON.stringify(response), 'utf8');
          } catch {
            responseSize = 0;
          }
        }

        const metrics: NetworkRequestMetrics = {
          url,
          method,
          startTime,
          endTime,
          duration: endTime - startTime,
          requestSize,
          responseSize,
          statusCode,
          success: true,
        };

        this.addNetworkSample(metrics);
        return response;
      })
      .catch((err) => {
        const endTime = performance.now();
        success = false;
        error = err;

        const metrics: NetworkRequestMetrics = {
          url,
          method,
          startTime,
          endTime,
          duration: endTime - startTime,
          requestSize,
          responseSize,
          success: false,
          error: err,
        };

        this.addNetworkSample(metrics);
        throw err;
      });
  }

  /**
   * Profile a file I/O operation
   */
  profileFileOperation<T>(
    path: string,
    operation: FileIOMetrics['operation'],
    operationFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableFileProfiling) {
      return operationFn();
    }

    const startTime = performance.now();
    let bytesProcessed = 0;
    let success = true;
    let error: Error | undefined;

    return operationFn()
      .then((result) => {
        const endTime = performance.now();

        // Try to extract bytes processed
        if (result && typeof result === 'object') {
          if (Buffer.isBuffer(result)) {
            bytesProcessed = result.length;
          } else if (result instanceof Uint8Array) {
            bytesProcessed = result.byteLength;
          } else if (typeof (result as any).length === 'number') {
            bytesProcessed = (result as any).length;
          }
        } else if (typeof result === 'string') {
          bytesProcessed = Buffer.byteLength(result, 'utf8');
        }

        const metrics: FileIOMetrics = {
          path,
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          bytesProcessed,
          success: true,
        };

        this.addFileSample(metrics);
        return result;
      })
      .catch((err) => {
        const endTime = performance.now();
        success = false;
        error = err;

        const metrics: FileIOMetrics = {
          path,
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          bytesProcessed,
          success: false,
          error: err,
        };

        this.addFileSample(metrics);
        throw err;
      });
  }

  /**
   * Profile a database query
   */
  profileDatabaseQuery<T>(
    query: string,
    params: any[] | undefined,
    queryFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableDatabaseProfiling) {
      return queryFn();
    }

    const startTime = performance.now();
    let rowsAffected: number | undefined;
    let rowsReturned: number | undefined;
    let success = true;
    let error: Error | undefined;

    return queryFn()
      .then((result) => {
        const endTime = performance.now();

        // Try to extract rows information
        if (result && typeof result === 'object') {
          if (Array.isArray(result)) {
            rowsReturned = result.length;
          } else if ((result as any).rows) {
            rowsReturned = (result as any).rows.length;
          }
          if (typeof (result as any).rowCount === 'number') {
            rowsAffected = (result as any).rowCount;
          } else if (typeof (result as any).affectedRows === 'number') {
            rowsAffected = (result as any).affectedRows;
          }
        }

        const metrics: DatabaseQueryMetrics = {
          query,
          params,
          startTime,
          endTime,
          duration: endTime - startTime,
          rowsAffected,
          rowsReturned,
          success: true,
        };

        this.addDatabaseSample(metrics);
        return result;
      })
      .catch((err) => {
        const endTime = performance.now();
        success = false;
        error = err;

        const metrics: DatabaseQueryMetrics = {
          query,
          params,
          startTime,
          endTime,
          duration: endTime - startTime,
          success: false,
          error: err,
        };

        this.addDatabaseSample(metrics);
        throw err;
      });
  }

  /**
   * Profile a cache operation
   */
  profileCacheOperation<T>(
    key: string,
    operation: CacheMetrics['operation'],
    operationFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableCacheProfiling) {
      return operationFn();
    }

    const startTime = performance.now();
    let hit: boolean | undefined;
    let size: number | undefined;
    let success = true;
    let error: Error | undefined;

    return operationFn()
      .then((result) => {
        const endTime = performance.now();

        // Determine cache hit/miss
        if (operation === 'get') {
          hit = result !== null && result !== undefined;
          if (hit && result) {
            try {
              size = Buffer.byteLength(JSON.stringify(result), 'utf8');
            } catch {
              size = 0;
            }
          }
        } else if (operation === 'set') {
          hit = true;
          try {
            size = Buffer.byteLength(JSON.stringify(result), 'utf8');
          } catch {
            size = 0;
          }
        }

        const metrics: CacheMetrics = {
          key,
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          hit,
          size,
          success: true,
        };

        this.addCacheSample(metrics);
        return result;
      })
      .catch((err) => {
        const endTime = performance.now();
        success = false;
        error = err;

        const metrics: CacheMetrics = {
          key,
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          success: false,
          error: err,
        };

        this.addCacheSample(metrics);
        throw err;
      });
  }

  /**
   * Add network sample with size limit
   */
  private addNetworkSample(metrics: NetworkRequestMetrics): void {
    this.networkRequests.push(metrics);
    if (this.networkRequests.length > this.config.maxNetworkSamples) {
      this.networkRequests.shift();
    }
  }

  /**
   * Add file sample with size limit
   */
  private addFileSample(metrics: FileIOMetrics): void {
    this.fileOperations.push(metrics);
    if (this.fileOperations.length > this.config.maxFileSamples) {
      this.fileOperations.shift();
    }
  }

  /**
   * Add database sample with size limit
   */
  private addDatabaseSample(metrics: DatabaseQueryMetrics): void {
    this.databaseQueries.push(metrics);
    if (this.databaseQueries.length > this.config.maxDatabaseSamples) {
      this.databaseQueries.shift();
    }
  }

  /**
   * Add cache sample with size limit
   */
  private addCacheSample(metrics: CacheMetrics): void {
    this.cacheOperations.push(metrics);
    if (this.cacheOperations.length > this.config.maxCacheSamples) {
      this.cacheOperations.shift();
    }
  }

  /**
   * Calculate statistics for all I/O operations
   */
  getStatistics(): IOStatistics {
    return {
      network: this.getNetworkStatistics(),
      file: this.getFileStatistics(),
      database: this.getDatabaseStatistics(),
      cache: this.getCacheStatistics(),
    };
  }

  /**
   * Get network statistics
   */
  private getNetworkStatistics() {
    const successfulRequests = this.networkRequests.filter((r) => r.success);
    const failedRequests = this.networkRequests.filter((r) => !r.success);
    const durations = successfulRequests.map((r) => r.duration).sort((a, b) => a - b);
    const totalDuration = successfulRequests.reduce((sum, r) => sum + r.duration, 0);
    const totalBytesSent = this.networkRequests.reduce((sum, r) => sum + r.requestSize, 0);
    const totalBytesReceived = successfulRequests.reduce((sum, r) => sum + r.responseSize, 0);

    // Calculate percentiles
    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    // Count errors by type
    const errorsByType: Record<string, number> = {};
    for (const req of failedRequests) {
      const errorType = req.error?.name || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }

    // Calculate throughput (bytes per second)
    const totalTimeSeconds = totalDuration / 1000;
    const throughput = totalTimeSeconds > 0 ? (totalBytesReceived / totalTimeSeconds) : 0;

    return {
      totalRequests: this.networkRequests.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      totalDuration,
      averageDuration: successfulRequests.length > 0 ? totalDuration / successfulRequests.length : 0,
      minDuration: durations.length > 0 ? durations[0] : 0,
      maxDuration: durations.length > 0 ? durations[durations.length - 1] : 0,
      p50,
      p95,
      p99,
      totalBytesSent,
      totalBytesReceived,
      throughput,
      errorsByType,
    };
  }

  /**
   * Get file I/O statistics
   */
  private getFileStatistics() {
    const successfulOps = this.fileOperations.filter((o) => o.success);
    const failedOps = this.fileOperations.filter((o) => !o.success);
    const totalDuration = successfulOps.reduce((sum, o) => sum + o.duration, 0);
    const totalBytes = successfulOps.reduce((sum, o) => sum + o.bytesProcessed, 0);

    // Count operations by type
    const operationsByType: Record<string, number> = {};
    for (const op of this.fileOperations) {
      operationsByType[op.operation] = (operationsByType[op.operation] || 0) + 1;
    }

    // Calculate throughput
    const totalTimeSeconds = totalDuration / 1000;
    const throughput = totalTimeSeconds > 0 ? (totalBytes / totalTimeSeconds) : 0;

    return {
      totalOperations: this.fileOperations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      totalDuration,
      averageDuration: successfulOps.length > 0 ? totalDuration / successfulOps.length : 0,
      totalBytesProcessed: totalBytes,
      throughput,
      operationsByType,
    };
  }

  /**
   * Get database statistics
   */
  private getDatabaseStatistics() {
    const successfulQueries = this.databaseQueries.filter((q) => q.success);
    const failedQueries = this.databaseQueries.filter((q) => !q.success);
    const durations = successfulQueries.map((q) => q.duration);
    const totalDuration = successfulQueries.reduce((sum, q) => sum + q.duration, 0);

    // Count slow queries
    const slowQueries = successfulQueries.filter((q) => q.duration > this.config.slowQueryThreshold).length;

    // Calculate rows statistics
    const rowsReturnedTotal = successfulQueries.reduce((sum, q) => sum + (q.rowsReturned || 0), 0);
    const averageRowsReturned =
      successfulQueries.length > 0 ? rowsReturnedTotal / successfulQueries.length : 0;

    return {
      totalQueries: this.databaseQueries.length,
      successfulQueries: successfulQueries.length,
      failedQueries: failedQueries.length,
      totalDuration,
      averageDuration: successfulQueries.length > 0 ? totalDuration / successfulQueries.length : 0,
      slowQueries,
      rowsReturnedTotal,
      averageRowsReturned,
    };
  }

  /**
   * Get cache statistics
   */
  private getCacheStatistics() {
    const getOps = this.cacheOperations.filter((o) => o.operation === 'get');
    const hits = getOps.filter((o) => o.hit).length;
    const misses = getOps.filter((o) => !o.hit).length;
    const hitRate = getOps.length > 0 ? hits / getOps.length : 0;

    const getDurations = getOps.map((o) => o.duration);
    const averageGetDuration = getDurations.length > 0
      ? getDurations.reduce((sum, d) => sum + d, 0) / getDurations.length
      : 0;

    const setOps = this.cacheOperations.filter((o) => o.operation === 'set');
    const setDurations = setOps.map((o) => o.duration);
    const averageSetDuration = setDurations.length > 0
      ? setDurations.reduce((sum, d) => sum + d, 0) / setDurations.length
      : 0;

    // Estimate cache size
    const size = setOps.reduce((sum, o) => sum + (o.size || 0), 0);

    return {
      totalOperations: this.cacheOperations.length,
      hits,
      misses,
      hitRate,
      totalDuration: this.cacheOperations.reduce((sum, o) => sum + o.duration, 0),
      averageGetDuration,
      averageSetDuration,
      size,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Detect I/O bottlenecks
   */
  detectBottlenecks(): IOBottleneck[] {
    const bottlenecks: IOBottleneck[] = [];
    const stats = this.getStatistics();

    // Check network bottlenecks
    if (stats.network.totalRequests > 0) {
      const failureRate = stats.network.failedRequests / stats.network.totalRequests;
      if (failureRate > 0.1) {
        bottlenecks.push({
          type: 'network',
          severity: failureRate > 0.3 ? 'critical' : 'high',
          description: `High network failure rate: ${(failureRate * 100).toFixed(1)}%`,
          location: 'network-layer',
          impact: failureRate,
          recommendation: 'Implement retry logic with exponential backoff and circuit breaker pattern',
          metrics: { failureRate, errorsByType: stats.network.errorsByType },
        });
      }

      if (stats.network.p99 > 5000) {
        bottlenecks.push({
          type: 'network',
          severity: stats.network.p99 > 10000 ? 'high' : 'medium',
          description: `Slow network responses: p99=${stats.network.p99.toFixed(0)}ms`,
          location: 'network-layer',
          impact: Math.min(1, stats.network.p99 / 10000),
          recommendation: 'Consider implementing request caching, CDN, or optimizing API calls',
          metrics: { p99: stats.network.p99 },
        });
      }
    }

    // Check file I/O bottlenecks
    if (stats.file.totalOperations > 0) {
      const failureRate = stats.file.failedOperations / stats.file.totalOperations;
      if (failureRate > 0.05) {
        bottlenecks.push({
          type: 'file',
          severity: failureRate > 0.2 ? 'critical' : 'medium',
          description: `File I/O failure rate: ${(failureRate * 100).toFixed(1)}%`,
          location: 'filesystem',
          impact: failureRate,
          recommendation: 'Implement proper error handling and file existence checks',
          metrics: { failureRate },
        });
      }

      if (stats.file.averageDuration > 100) {
        bottlenecks.push({
          type: 'file',
          severity: stats.file.averageDuration > 500 ? 'high' : 'medium',
          description: `Slow file operations: avg=${stats.file.averageDuration.toFixed(0)}ms`,
          location: 'filesystem',
          impact: Math.min(1, stats.file.averageDuration / 500),
          recommendation: 'Consider using streaming I/O, buffering, or async operations',
          metrics: { averageDuration: stats.file.averageDuration },
        });
      }
    }

    // Check database bottlenecks
    if (stats.database.totalQueries > 0) {
      const failureRate = stats.database.failedQueries / stats.database.totalQueries;
      if (failureRate > 0.05) {
        bottlenecks.push({
          type: 'database',
          severity: failureRate > 0.2 ? 'critical' : 'high',
          description: `Database query failure rate: ${(failureRate * 100).toFixed(1)}%`,
          location: 'database-layer',
          impact: failureRate,
          recommendation: 'Review database connection pool and query error handling',
          metrics: { failureRate },
        });
      }

      if (stats.database.slowQueries > 0) {
        const slowQueryRate = stats.database.slowQueries / stats.database.totalQueries;
        bottlenecks.push({
          type: 'database',
          severity: slowQueryRate > 0.1 ? 'critical' : 'high',
          description: `${stats.database.slowQueries} slow queries detected (>${this.config.slowQueryThreshold}ms)`,
          location: 'database-layer',
          impact: Math.min(1, slowQueryRate * 2),
          recommendation: 'Add indexes, optimize queries, or implement query result caching',
          metrics: { slowQueries: stats.database.slowQueries, slowQueryRate },
        });
      }

      if (stats.database.averageDuration > 200) {
        bottlenecks.push({
          type: 'database',
          severity: stats.database.averageDuration > 1000 ? 'high' : 'medium',
          description: `Slow database queries: avg=${stats.database.averageDuration.toFixed(0)}ms`,
          location: 'database-layer',
          impact: Math.min(1, stats.database.averageDuration / 1000),
          recommendation: 'Review query execution plans and add appropriate indexes',
          metrics: { averageDuration: stats.database.averageDuration },
        });
      }
    }

    // Check cache bottlenecks
    if (stats.cache.totalOperations > 0) {
      if (stats.cache.hitRate < 0.5) {
        bottlenecks.push({
          type: 'cache',
          severity: stats.cache.hitRate < 0.3 ? 'high' : 'medium',
          description: `Low cache hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`,
          location: 'cache-layer',
          impact: 1 - stats.cache.hitRate,
          recommendation: 'Review cache key strategy and TTL settings',
          metrics: { hitRate: stats.cache.hitRate },
        });
      }

      if (stats.cache.averageGetDuration > 10) {
        bottlenecks.push({
          type: 'cache',
          severity: stats.cache.averageGetDuration > 50 ? 'high' : 'low',
          description: `Slow cache reads: avg=${stats.cache.averageGetDuration.toFixed(2)}ms`,
          location: 'cache-layer',
          impact: Math.min(1, stats.cache.averageGetDuration / 50),
          recommendation: 'Consider using a faster cache backend or optimizing cache serialization',
          metrics: { averageGetDuration: stats.cache.averageGetDuration },
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Get slowest network requests
   */
  getSlowestNetworkRequests(limit: number = 10): NetworkRequestMetrics[] {
    return [...this.networkRequests]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get slowest database queries
   */
  getSlowestQueries(limit: number = 10): DatabaseQueryMetrics[] {
    return [...this.databaseQueries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get cache hit/miss patterns
   */
  getCachePatterns(): { key: string; hits: number; misses: number; hitRate: number }[] {
    const patterns = new Map<string, { hits: number; misses: number }>();

    for (const op of this.cacheOperations) {
      if (op.operation === 'get') {
        let pattern = patterns.get(op.key);
        if (!pattern) {
          pattern = { hits: 0, misses: 0 };
          patterns.set(op.key, pattern);
        }

        if (op.hit) {
          pattern.hits++;
        } else {
          pattern.misses++;
        }
      }
    }

    return Array.from(patterns.entries())
      .map(([key, { hits, misses }]) => ({
        key,
        hits,
        misses,
        hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
      }))
      .sort((a, b) => b.hits + b.misses - (a.hits + a.misses))
      .slice(0, 20);
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.networkRequests = [];
    this.fileOperations = [];
    this.databaseQueries = [];
    this.cacheOperations = [];
  }

  /**
   * Get raw network request samples
   */
  getNetworkSamples(): NetworkRequestMetrics[] {
    return [...this.networkRequests];
  }

  /**
   * Get raw file operation samples
   */
  getFileSamples(): FileIOMetrics[] {
    return [...this.fileOperations];
  }

  /**
   * Get raw database query samples
   */
  getDatabaseSamples(): DatabaseQueryMetrics[] {
    return [...this.databaseQueries];
  }

  /**
   * Get raw cache operation samples
   */
  getCacheSamples(): CacheMetrics[] {
    return [...this.cacheOperations];
  }
}
