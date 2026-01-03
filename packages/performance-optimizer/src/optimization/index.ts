/**
 * Optimization Passes - Performance optimization tools
 */

export {
  MemoizationPass,
  memoize,
  memoizeAsync,
  Memoize,
  MemoizeAsync,
  MemoizationCache,
  SizeLimitedCache,
  TTLCache,
} from './MemoizationPass.js';
export {
  LazyLoadingPass,
  LazyModule,
  createLazyModule,
  Lazy,
  CodeSplitter,
  dynamicImport,
  batchDynamicImport,
} from './LazyLoadingPass.js';
export {
  BatchOptimizationPass,
  BatchQueue,
  BatchSizeOptimizer,
} from './BatchOptimizationPass.js';
export {
  ConnectionPoolingPass,
  ConnectionPool,
  HTTPConnectionPool,
  DatabaseConnectionPool,
} from './ConnectionPooling.js';

// Re-export types
export type {
  MemoizationOptions,
  CacheStatistics,
} from './MemoizationPass.js';
export type {
  LazyModuleOptions,
  LazyModuleState,
  LoadingState,
  LazyLoadResult,
} from './LazyLoadingPass.js';
export type {
  BatchingOptions,
  BatchingStrategy,
  BatchOperation,
  BatchResult,
} from './BatchOptimizationPass.js';
export type {
  ConnectionPoolConfig,
  PoolStatistics,
  PooledConnection,
  ConnectionState,
} from './ConnectionPooling.js';
