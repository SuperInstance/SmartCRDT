/**
 * @fileoverview Main entry point for @lsi/vljepa-abtesting
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 *
 * A/B Testing Framework with Analytics Dashboard for VL-JEPA and A2UI
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export * from "./types.js";

// ============================================================================
// EXPERIMENTS
// ============================================================================

export {
  ExperimentManager,
  InMemoryExperimentStorage,
  createExperimentManager,
} from "./experiments/ExperimentManager.js";

// ============================================================================
// ALLOCATION
// ============================================================================

export {
  UserAllocator,
  TrafficSplitter,
  createUserAllocator,
} from "./allocation/UserAllocator.js";

// ============================================================================
// METRICS
// ============================================================================

export {
  MetricCollector,
  ConversionTracker,
  EngagementTracker,
  InMemoryResultStorage,
  createMetricCollector,
  createConversionTracker,
  createEngagementTracker,
} from "./metrics/MetricCollector.js";

// ============================================================================
// STATISTICS
// ============================================================================

export {
  SignificanceTester,
  createSignificanceTester,
  isSignificant,
  conversionRateWithCI,
} from "./statistics/SignificanceTest.js";

// ============================================================================
// REPORTING
// ============================================================================

export {
  Dashboard,
  ExperimentReportGenerator,
  WinnerDetermination,
  createDashboard,
  createReportGenerator,
  createWinnerDetermination,
} from "./reporting/Dashboard.js";

// ============================================================================
// INTEGRATION
// ============================================================================

export {
  A2UIIntegration,
  VariantComparator,
  UIVariantGenerator,
  InMemoryEventStorage,
  createA2UIIntegration,
  createVariantComparator,
  createUIVariantGenerator,
} from "./integration/A2UIIntegration.js";

// ============================================================================
// STORAGE
// ============================================================================

export {
  CombinedStorage,
  LocalStorageStorage,
  createInMemoryStorage,
  createLocalStorageStorage,
} from "./storage/ExperimentStore.js";

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0";
