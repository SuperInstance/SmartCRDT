/**
 * @fileoverview A/B Testing Framework module exports
 * @author Aequor Project - Round 18 Agent 2
 * @version 1.0.0
 */

// AB Test Manager
export {
  ABTestManager,
  InMemoryABTestStorage,
  createABTestManager,
  DEFAULT_MANAGER_CONFIG,
} from "./ABTestManager.js";

export type {
  TestStatus,
  TrafficStrategy,
  TestMetric,
  UIVariant,
  MetricData,
  TestResult,
  AggregatedResults,
  ABTest,
  ExperimentConfig as ABTestConfig,
  ABTestStorage,
  ABTestManagerConfig,
} from "./ABTestManager.js";

// Variant Generator
export {
  VariantGenerator,
  createVariantGenerator,
  generateQuickVariants,
  BUILT_IN_TEMPLATES,
} from "./VariantGenerator.js";

export type {
  VariantStrategy,
  LayoutVariation,
  StyleVariation,
  ContentVariation,
  VariantTemplate,
  VariantDefinition,
  GeneratedVariant,
  VariantChange,
  VariantGeneratorOptions,
  VariantGeneratorConfig,
} from "./VariantGenerator.js";

// Statistical Analyzer
export {
  StatisticalAnalyzer,
  createStatisticalAnalyzer,
  isSignificant,
  conversionRateWithCI,
  DEFAULT_ANALYZER_CONFIG,
} from "./StatisticalAnalyzer.js";

export type {
  StatisticalTest,
  SignificanceReport,
  ComparisonResult,
  WinnerRecommendation,
  PowerAnalysis,
  TestStatusSummary,
  StatisticalAnalyzerConfig,
} from "./StatisticalAnalyzer.js";
