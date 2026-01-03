/**
 * Reports - Performance reporting and visualization
 */

export { FlameGraph, FlameGraphBuilder, Profile } from './FlameGraph.js';
export { PerformanceReportGenerator } from './PerformanceReport.js';

// Re-export types
export type {
  Frame,
  CallStackEntry,
  FlameGraphOptions,
  HotPath,
  FlameGraphStatistics,
} from './FlameGraph.js';
export type {
  PerformanceMetrics,
  Bottleneck,
  BottleneckSeverity,
  OptimizationRecommendation,
  PerformanceReport,
} from './PerformanceReport.js';
