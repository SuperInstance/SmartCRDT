/**
 * Async Profiler - Comprehensive async operation profiling
 *
 * Tracks and analyzes:
 * - Promise creation, resolution, and rejection
 * - Async function execution timing
 * - Event loop metrics and lag
 * - Concurrent operation tracking
 * - Async operation bottlenecks
 */

import { performance } from 'perf_hooks';

/**
 * Async operation metrics
 */
export interface AsyncOperationMetrics {
  id: string;
  name: string;
  type: 'promise' | 'async-function' | 'timeout' | 'immediate' | 'microtask';
  startTime: number;
  endTime?: number;
  duration?: number;
  resolved: boolean;
  rejected: boolean;
  pending: boolean;
  stackTrace?: string;
  parentOperationId?: string;
  childOperations: string[];
}

/**
 * Event loop metrics
 */
export interface EventLoopMetrics {
  timestamp: number;
  lag: number; // Event loop lag in milliseconds
  utilization: number; // 0-1
  activeHandles: number;
  activeRequests: number;
}

/**
 * Concurrency metrics
 */
export interface ConcurrencyMetrics {
  timestamp: number;
  concurrentOperations: number;
  pendingOperations: number;
  maxConcurrency: number;
  averageConcurrency: number;
}

/**
 * Async statistics summary
 */
export interface AsyncStatistics {
  operations: {
    total: number;
    resolved: number;
    rejected: number;
    pending: number;
    resolutionRate: number;
    rejectionRate: number;
  };
  timing: {
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p50: number;
    p95: number;
    p99: number;
    totalDuration: number;
  };
  byType: {
    [key: string]: {
      count: number;
      averageDuration: number;
      rejectionRate: number;
    };
  };
  eventLoop: {
    averageLag: number;
    maxLag: number;
    p95Lag: number;
    averageUtilization: number;
    maxUtilization: number;
  };
  concurrency: {
    maxObserved: number;
    averageObserved: number;
    peakTimestamps: number[];
  };
  slowestOperations: AsyncOperationMetrics[];
  longestPending: AsyncOperationMetrics[];
}

/**
 * Async profiler configuration
 */
export interface AsyncProfilerConfig {
  maxSamples?: number;
  maxStackTraceDepth?: number;
  enableStackTrace?: boolean;
  enableEventLoopMonitoring?: boolean;
  eventLoopMonitorInterval?: number; // milliseconds
  enableConcurrencyTracking?: string;
  slowOperationThreshold?: number; // milliseconds
  autoDetectBottlenecks?: boolean;
}

/**
 * Async bottleneck report
 */
export interface AsyncBottleneck {
  type: 'slow-operation' | 'high-rejection-rate' | 'event-loop-lag' | 'high-concurrency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  impact: number;
  recommendation: string;
  metrics: any;
}

/**
 * Async Profiler class
 */
export class AsyncProfiler {
  private operations: Map<string, AsyncOperationMetrics> = new Map();
  private eventLoopSamples: EventLoopMetrics[] = [];
  private concurrencySamples: ConcurrencyMetrics[] = [];
  private operationIdCounter = 0;
  private config: Required<AsyncProfilerConfig>;
  private eventLoopMonitorTimer?: NodeJS.Timeout;
  private concurrencyMonitorTimer?: NodeJS.Timeout;

  constructor(config: AsyncProfilerConfig = {}) {
    this.config = {
      maxSamples: config.maxSamples ?? 10000,
      maxStackTraceDepth: config.maxStackTraceDepth ?? 10,
      enableStackTrace: config.enableStackTrace ?? true,
      enableEventLoopMonitoring: config.enableEventLoopMonitoring ?? true,
      eventLoopMonitorInterval: config.eventLoopMonitorInterval ?? 100,
      enableConcurrencyTracking: config.enableConcurrencyTracking ?? true,
      slowOperationThreshold: config.slowOperationThreshold ?? 1000,
      autoDetectBottlenecks: config.autoDetectBottlenecks ?? true,
    };

    if (this.config.enableEventLoopMonitoring) {
      this.startEventLoopMonitoring();
    }

    if (this.config.enableConcurrencyTracking) {
      this.startConcurrencyMonitoring();
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `async-${++this.operationIdCounter}`;
  }

  /**
   * Capture stack trace
   */
  private captureStackTrace(): string | undefined {
    if (!this.config.enableStackTrace) {
      return undefined;
    }

    const stack = new Error().stack;
    if (!stack) {
      return undefined;
    }

    // Remove first few lines (captureStackTrace and this function)
    const lines = stack.split('\n').slice(3, 3 + this.config.maxStackTraceDepth);
    return lines.join('\n');
  }

  /**
   * Start profiling an async operation
   */
  startAsyncOperation(
    name: string,
    type: AsyncOperationMetrics['type'] = 'promise',
    parentOperationId?: string
  ): string {
    const id = this.generateOperationId();
    const startTime = performance.now();

    const operation: AsyncOperationMetrics = {
      id,
      name,
      type,
      startTime,
      resolved: false,
      rejected: false,
      pending: true,
      stackTrace: this.captureStackTrace(),
      parentOperationId,
      childOperations: [],
    };

    this.operations.set(id, operation);

    // Add as child of parent if specified
    if (parentOperationId) {
      const parent = this.operations.get(parentOperationId);
      if (parent) {
        parent.childOperations.push(id);
      }
    }

    // Enforce sample limit
    if (this.operations.size > this.config.maxSamples) {
      // Remove oldest completed operation
      const oldest = Array.from(this.operations.values())
        .filter((op) => !op.pending)
        .sort((a, b) => a.startTime - b.startTime)[0];

      if (oldest) {
        this.operations.delete(oldest.id);
      }
    }

    return id;
  }

  /**
   * Mark an async operation as resolved
   */
  resolveAsyncOperation(id: string): void {
    const operation = this.operations.get(id);
    if (!operation || !operation.pending) {
      return;
    }

    const endTime = performance.now();
    operation.endTime = endTime;
    operation.duration = endTime - operation.startTime;
    operation.resolved = true;
    operation.pending = false;
  }

  /**
   * Mark an async operation as rejected
   */
  rejectAsyncOperation(id: string, error?: Error): void {
    const operation = this.operations.get(id);
    if (!operation || !operation.pending) {
      return;
    }

    const endTime = performance.now();
    operation.endTime = endTime;
    operation.duration = endTime - operation.startTime;
    operation.rejected = true;
    operation.pending = false;
  }

  /**
   * Profile a promise
   */
  profilePromise<T>(name: string, promise: Promise<T>, parentOperationId?: string): Promise<T> {
    const id = this.startAsyncOperation(name, 'promise', parentOperationId);

    return promise
      .then((value) => {
        this.resolveAsyncOperation(id);
        return value;
      })
      .catch((error) => {
        this.rejectAsyncOperation(id, error);
        throw error;
      });
  }

  /**
   * Profile an async function
   */
  profileAsyncFunction<T>(
    name: string,
    fn: () => Promise<T>,
    parentOperationId?: string
  ): Promise<T> {
    const id = this.startAsyncOperation(name, 'async-function', parentOperationId);

    return fn()
      .then((value) => {
        this.resolveAsyncOperation(id);
        return value;
      })
      .catch((error) => {
        this.rejectAsyncOperation(id, error);
        throw error;
      });
  }

  /**
   * Decorator for profiling async methods
   */
  decorateAsyncMethod<T extends (...args: any[]) => Promise<any>>(
    name?: string
  ): MethodDecorator {
    return (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value;
      const methodName = name || (propertyKey as string);

      descriptor.value = async function (this: any, ...args: any[]) {
        // Try to get parent operation ID from context
        let parentOperationId: string | undefined;
        if ((this as any).__asyncOperationId) {
          parentOperationId = (this as any).__asyncOperationId;
        }

        const id = AsyncProfiler.instance?.startAsyncOperation(
          `${target.constructor.name}.${methodName}`,
          'async-function',
          parentOperationId
        );

        try {
          const result = await originalMethod.apply(this, args);
          AsyncProfiler.instance?.resolveAsyncOperation(id!);
          return result;
        } catch (error) {
          AsyncProfiler.instance?.rejectAsyncOperation(id!, error as Error);
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Start event loop monitoring
   */
  private startEventLoopMonitoring(): void {
    const measureEventLoop = () => {
      const start = performance.now();

      // Use setImmediate to measure event loop lag
      setImmediate(() => {
        const end = performance.now();
        const lag = end - start;

        this.eventLoopSamples.push({
          timestamp: start,
          lag,
          utilization: Math.min(1, lag / this.config.eventLoopMonitorInterval),
          activeHandles: (process as any)._getActiveHandles()?.length || 0,
          activeRequests: (process as any)._getActiveRequests()?.length || 0,
        });

        // Keep only recent samples
        if (this.eventLoopSamples.length > 1000) {
          this.eventLoopSamples.shift();
        }
      });
    };

    this.eventLoopMonitorTimer = setInterval(
      measureEventLoop,
      this.config.eventLoopMonitorInterval
    );

    // Unref to allow process to exit
    this.eventLoopMonitorTimer.unref();
  }

  /**
   * Start concurrency monitoring
   */
  private startConcurrencyMonitoring(): void {
    const measureConcurrency = () => {
      const pendingOps = Array.from(this.operations.values()).filter((op) => op.pending);
      const concurrent = pendingOps.length;

      let maxConcurrent = concurrent;
      let avgConcurrent = concurrent;
      if (this.concurrencySamples.length > 0) {
        const lastMax = this.concurrencySamples[this.concurrencySamples.length - 1].maxConcurrency;
        maxConcurrent = Math.max(lastMax, concurrent);
        const totalAvg = this.concurrencySamples.reduce(
          (sum, s) => sum + s.averageConcurrency,
          0
        );
        avgConcurrent = (totalAvg + concurrent) / (this.concurrencySamples.length + 1);
      }

      this.concurrencySamples.push({
        timestamp: performance.now(),
        concurrentOperations: concurrent,
        pendingOperations: pendingOps.length,
        maxConcurrency: maxConcurrent,
        averageConcurrency: avgConcurrent,
      });

      // Keep only recent samples
      if (this.concurrencySamples.length > 1000) {
        this.concurrencySamples.shift();
      }
    };

    this.concurrencyMonitorTimer = setInterval(measureConcurrency, this.config.eventLoopMonitorInterval);
    this.concurrencyMonitorTimer.unref();
  }

  /**
   * Calculate statistics
   */
  getStatistics(): AsyncStatistics {
    const operations = Array.from(this.operations.values());
    const resolvedOps = operations.filter((op) => op.resolved);
    const rejectedOps = operations.filter((op) => op.rejected);
    const pendingOps = operations.filter((op) => op.pending);
    const completedOps = [...resolvedOps, ...rejectedOps];

    const durations = completedOps
      .map((op) => op.duration!)
      .filter((d): d is number => d !== undefined)
      .sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    // Group by type
    const byType: Record<string, { count: number; totalDuration: number; rejections: number }> = {};
    for (const op of completedOps) {
      if (!byType[op.type]) {
        byType[op.type] = { count: 0, totalDuration: 0, rejections: 0 };
      }
      byType[op.type].count++;
      byType[op.type].totalDuration += op.duration || 0;
      if (op.rejected) {
        byType[op.type].rejections++;
      }
    }

    const byTypeStats: AsyncStatistics['byType'] = {};
    for (const [type, stats] of Object.entries(byType)) {
      byTypeStats[type] = {
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        rejectionRate: stats.rejections / stats.count,
      };
    }

    // Event loop statistics
    const eventLoopLags = this.eventLoopSamples.map((s) => s.lag).sort((a, b) => a - b);
    const averageLag =
      eventLoopLags.length > 0
        ? eventLoopLags.reduce((sum, lag) => sum + lag, 0) / eventLoopLags.length
        : 0;
    const maxLag = eventLoopLags.length > 0 ? eventLoopLags[eventLoopLags.length - 1] : 0;
    const p95Lag = this.percentile(eventLoopLags, 95);

    const utilizations = this.eventLoopSamples.map((s) => s.utilization);
    const averageUtilization =
      utilizations.length > 0
        ? utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length
        : 0;
    const maxUtilization = utilizations.length > 0 ? Math.max(...utilizations) : 0;

    // Concurrency statistics
    const maxObserved =
      this.concurrencySamples.length > 0
        ? Math.max(...this.concurrencySamples.map((s) => s.concurrentOperations))
        : 0;
    const averageObserved =
      this.concurrencySamples.length > 0
        ? this.concurrencySamples.reduce((sum, s) => sum + s.concurrentOperations, 0) /
          this.concurrencySamples.length
        : 0;

    // Find peak timestamps
    const sortedByConcurrency = [...this.concurrencySamples]
      .sort((a, b) => b.concurrentOperations - a.concurrentOperations)
      .slice(0, 5);
    const peakTimestamps = sortedByConcurrency.map((s) => s.timestamp);

    return {
      operations: {
        total: operations.length,
        resolved: resolvedOps.length,
        rejected: rejectedOps.length,
        pending: pendingOps.length,
        resolutionRate: operations.length > 0 ? resolvedOps.length / operations.length : 0,
        rejectionRate: operations.length > 0 ? rejectedOps.length / operations.length : 0,
      },
      timing: {
        averageDuration:
          durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
        minDuration: durations.length > 0 ? durations[0] : 0,
        maxDuration: durations.length > 0 ? durations[durations.length - 1] : 0,
        p50,
        p95,
        p99,
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
      },
      byType: byTypeStats,
      eventLoop: {
        averageLag,
        maxLag,
        p95Lag,
        averageUtilization,
        maxUtilization,
      },
      concurrency: {
        maxObserved,
        averageObserved,
        peakTimestamps,
      },
      slowestOperations: resolvedOps
        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .slice(0, 10),
      longestPending: pendingOps
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, 10),
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
   * Detect async bottlenecks
   */
  detectBottlenecks(): AsyncBottleneck[] {
    const bottlenecks: AsyncBottleneck[] = [];
    const stats = this.getStatistics();

    // Check for slow operations
    if (stats.slowestOperations.length > 0) {
      const slowOps = stats.slowestOperations.filter(
        (op) => (op.duration || 0) > this.config.slowOperationThreshold
      );

      if (slowOps.length > 0) {
        const avgSlowDuration =
          slowOps.reduce((sum, op) => sum + (op.duration || 0), 0) / slowOps.length;

        bottlenecks.push({
          type: 'slow-operation',
          severity: avgSlowDuration > 5000 ? 'critical' : avgSlowDuration > 2000 ? 'high' : 'medium',
          description: `${slowOps.length} slow async operations detected (avg ${avgSlowDuration.toFixed(0)}ms)`,
          location: 'async-operations',
          impact: Math.min(1, avgSlowDuration / 5000),
          recommendation: 'Review and optimize slow async operations, consider batching or parallelization',
          metrics: { count: slowOps.length, averageDuration: avgSlowDuration },
        });
      }
    }

    // Check for high rejection rate
    if (stats.operations.rejectionRate > 0.1) {
      bottlenecks.push({
        type: 'high-rejection-rate',
        severity: stats.operations.rejectionRate > 0.3 ? 'critical' : 'high',
        description: `High async operation rejection rate: ${(stats.operations.rejectionRate * 100).toFixed(1)}%`,
        location: 'async-operations',
        impact: stats.operations.rejectionRate,
        recommendation: 'Review error handling and retry logic for failed operations',
        metrics: { rejectionRate: stats.operations.rejectionRate },
      });
    }

    // Check for event loop lag
    if (stats.eventLoop.maxLag > 100) {
      bottlenecks.push({
        type: 'event-loop-lag',
        severity: stats.eventLoop.maxLag > 500 ? 'critical' : stats.eventLoop.maxLag > 200 ? 'high' : 'medium',
        description: `High event loop lag detected: max=${stats.eventLoop.maxLag.toFixed(0)}ms, p95=${stats.eventLoop.p95Lag.toFixed(0)}ms`,
        location: 'event-loop',
        impact: Math.min(1, stats.eventLoop.maxLag / 500),
        recommendation: 'Identify and optimize blocking synchronous operations, break up heavy computation',
        metrics: {
          maxLag: stats.eventLoop.maxLag,
          p95Lag: stats.eventLoop.p95Lag,
          averageLag: stats.eventLoop.averageLag,
        },
      });
    }

    // Check for high concurrency
    if (stats.concurrency.maxObserved > 100) {
      bottlenecks.push({
        type: 'high-concurrency',
        severity: stats.concurrency.maxObserved > 500 ? 'critical' : stats.concurrency.maxObserved > 200 ? 'high' : 'medium',
        description: `High async concurrency detected: max=${stats.concurrency.maxObserved} concurrent operations`,
        location: 'async-operations',
        impact: Math.min(1, stats.concurrency.maxObserved / 500),
        recommendation: 'Implement request throttling, queues, or connection pooling',
        metrics: {
          maxConcurrency: stats.concurrency.maxObserved,
          averageConcurrency: stats.concurrency.averageObserved,
        },
      });
    }

    return bottlenecks;
  }

  /**
   * Get operation tree for visualization
   */
  getOperationTree(): any {
    const roots = Array.from(this.operations.values()).filter((op) => !op.parentOperationId);

    const buildTree = (operation: AsyncOperationMetrics): any => {
      const children = operation.childOperations
        .map((id) => this.operations.get(id))
        .filter((op): op is AsyncOperationMetrics => op !== undefined);

      return {
        ...operation,
        children: children.map(buildTree),
      };
    };

    return roots.map(buildTree);
  }

  /**
   * Get operation by ID
   */
  getOperation(id: string): AsyncOperationMetrics | undefined {
    return this.operations.get(id);
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.operations.clear();
    this.eventLoopSamples = [];
    this.concurrencySamples = [];
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.eventLoopMonitorTimer) {
      clearInterval(this.eventLoopMonitorTimer);
      this.eventLoopMonitorTimer = undefined;
    }

    if (this.concurrencyMonitorTimer) {
      clearInterval(this.concurrencyMonitorTimer);
      this.concurrencyMonitorTimer = undefined;
    }
  }

  /**
   * Get raw operation samples
   */
  getOperations(): AsyncOperationMetrics[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get event loop samples
   */
  getEventLoopSamples(): EventLoopMetrics[] {
    return [...this.eventLoopSamples];
  }

  /**
   * Get concurrency samples
   */
  getConcurrencySamples(): ConcurrencyMetrics[] {
    return [...this.concurrencySamples];
  }

  // Static instance for decorator support
  private static instance?: AsyncProfiler;

  /**
   * Set global instance for decorator support
   */
  static setInstance(instance: AsyncProfiler): void {
    AsyncProfiler.instance = instance;
  }
}
