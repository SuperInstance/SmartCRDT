/**
 * @lsi/performance-optimizer - Performance profiling and optimization tools
 *
 * Provides comprehensive performance analysis and optimization capabilities:
 * - CPU profiling with stack traces
 * - Memory usage tracking with heap snapshots
 * - Latency measurement and distribution analysis
 * - Bottleneck detection algorithms
 * - Automated optimization suggestions
 * - Benchmarking framework
 * - Performance regression testing
 */

// Core performance types and interfaces
export * from "./types/index.js";

// Performance profiling tools
export * from "./profiler/index.js";

// Optimization engine
export * from "./optimizer/index.js";

// Benchmarking framework
export * from "./benchmarks/index.js";

// Main performance optimizer class
export { PerformanceOptimizer } from "./PerformanceOptimizer.js";

// Utility functions
export * from "./utils/index.js";

// Performance configuration
export { PerformanceConfig, createDefaultConfig } from "./config/index.js";

// Performance metrics collectors
export * from "./metrics/index.js";

// Health check and monitoring
export * from "./monitoring/index.js";

// NUMA-aware scheduling
export * from "./numa/index.js";

// Thermal and power management
export * from "./thermal/index.js";

// Optimization passes
export * from "./optimization/index.js";

// Reports and visualization
export * from "./reports/index.js";