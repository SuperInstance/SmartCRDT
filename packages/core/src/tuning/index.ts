/**
 * @lsi/core/tuning - Auto-Tuning Module for Aequor Cognitive Orchestration Platform
 *
 * This module provides automatic performance tuning capabilities:
 *
 * - AutoTuner: Core type definitions and interfaces
 * - AutoTunerImpl: Full auto-tuner implementation
 * - WorkloadAnalyzer: Analyzes workload patterns
 * - ParameterOptimizer: Optimizes parameter values
 * - ParameterController: Controls tunable parameters
 * - TuningHistory: Tracks tuning history
 * - FeedbackLoop: Collects and analyzes feedback from system metrics
 * - MultiObjectiveOptimizer: Optimizes multiple conflicting objectives
 * - AnomalyDetector: Detects performance anomalies
 */

export {
  // Type definitions
  type ParameterCategory,
  type TunableParameter,
  type OptimizationObjective,
  type TuningConstraints,
  type AutoTunerConfig,
  type TuningRecommendation,
  type PerformanceMetrics,
  type TuningHistoryEntry,
  type QueryHistory,
  DEFAULT_AUTOTUNER_CONFIG,
  DEFAULT_TUNABLE_PARAMETERS,
} from "./AutoTuner.js";

export {
  // Core auto-tuner class
  AutoTuner,
  createAutoTuner,
} from "./AutoTuner.js";

export {
  // Workload analyzer
  WorkloadAnalyzer,
  createWorkloadAnalyzer,
  type WorkloadType,
  type WorkloadPattern,
  type BurstInfo,
  type WorkloadPrediction,
  type WorkloadState,
  type WorkloadAnalyzerConfig,
} from "./WorkloadAnalyzer.js";

export {
  // Parameter optimizer
  ParameterOptimizer,
  createParameterOptimizer,
  type OptimizationResult,
  type OptimizationRecommendation,
  type OptimizationAlgorithm,
} from "./ParameterOptimizer.js";

export {
  // Full auto-tuner implementation
  AutoTunerImpl,
  createAutoTunerImpl,
} from "./AutoTunerImpl.js";

export {
  // Parameter controller
  ParameterController,
  createParameterController,
} from "./ParameterController.js";

export {
  // Tuning history
  TuningHistory,
  createTuningHistory,
} from "./TuningHistory.js";

export {
  // Feedback loop
  FeedbackLoop,
  createFeedbackLoop,
  type FeedbackConfig,
  type SystemMetrics,
  type PerformanceData,
  type TrendAnalysis,
  type DegradationReport,
  type Feedback,
  type TuningResult,
  type AdjustmentRecommendation,
  DEFAULT_FEEDBACK_CONFIG,
} from "./FeedbackLoop.js";

export {
  // Multi-objective optimizer
  MultiObjectiveOptimizer,
  createMultiObjectiveOptimizer,
  type Constraint,
  type OptimizableParameter,
  type Solution,
  type ParetoFrontier,
  type ParetoSolution,
  type TradeoffAnalysis,
  type Preference,
  type WeightedSolution,
  type OptimizationOptions,
  DEFAULT_OPTIMIZATION_OPTIONS,
} from "./MultiObjectiveOptimizer.js";

export {
  // Anomaly detector
  AnomalyDetector,
  createAnomalyDetector,
  type AnomalyDetectorConfig,
  type AnomalyResult,
  type ChangeDetection,
  type AnomalyReport,
  type Alert,
  type StatisticalSummary,
  DEFAULT_ANOMALY_DETECTOR_CONFIG,
} from "./AnomalyDetector.js";
