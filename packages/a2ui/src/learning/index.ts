/**
 * @fileoverview UI Preference Learning module exports
 * @author Aequor Project - Round 18 Agent 1
 * @version 1.0.0
 */

// Preference Collector
export {
  PreferenceCollector,
  InMemoryPreferenceStorage,
  createPreferenceCollector,
  DEFAULT_COLLECTOR_CONFIG,
} from "./PreferenceCollector.js";

export type {
  InteractionType,
  LayoutDensity,
  ThemePreference,
  ComponentUsageStats,
  UIInteraction,
  UserPreference,
  InteractionPattern,
  PreferenceStorage,
  PreferenceCollectorConfig,
} from "./PreferenceCollector.js";

// Pattern Analyzer
export {
  PatternAnalyzer,
  createPatternAnalyzer,
  DEFAULT_ANALYZER_CONFIG,
} from "./PatternAnalyzer.js";

export type {
  PatternType,
  PatternAnalysis,
  LayoutPreferenceAnalysis,
  ComponentCategory,
  ComponentEfficiency,
  PreferenceProfile,
  PersonalizationRecommendation,
  PatternAnalyzerConfig,
} from "./PatternAnalyzer.js";

// Personalization Engine
export {
  PersonalizationEngine,
  createPersonalizationEngine,
  createContext,
  DEFAULT_ENGINE_CONFIG,
} from "./PersonalizationEngine.js";

export type {
  PersonalizationStrategy,
  PersonalizationContext,
  UIVariant,
  ABTestResult,
  PersonalizationResult,
  UIChange,
  PersonalizationEngineConfig,
} from "./PersonalizationEngine.js";
