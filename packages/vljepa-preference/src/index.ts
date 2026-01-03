/**
 * @vljepa/preference - UI Preference Learning and Adaptive Recommendation System
 *
 * A comprehensive system for learning user UI preferences and providing
 * adaptive, personalized recommendations.
 */

// Core types
export * from "./types.js";

// Collectors
export {
  InteractionCollector,
  type SessionStats,
} from "./collectors/InteractionCollector.js";
export {
  DwellTimeCollector,
  type DwellEvent,
  type DwellStatistics,
} from "./collectors/DwellTimeCollector.js";
export {
  ClickCollector,
  type ClickEvent,
  type ClickHeatmap,
  type ClickStatistics,
} from "./collectors/ClickCollector.js";
export {
  ScrollCollector,
  type ScrollEvent,
  type ScrollStatistics,
} from "./collectors/ScrollCollector.js";

// Analyzers
export { PatternAnalyzer } from "./analyzers/PatternAnalyzer.js";
export { PreferenceExtractor } from "./analyzers/PreferenceExtractor.js";
export {
  SegmentAnalyzer,
  type SegmentCriteria,
  type SegmentCondition,
  type UserCluster,
} from "./analyzers/SegmentAnalyzer.js";
export {
  TrendAnalyzer,
  type PreferenceSnapshot,
  type TimeSeries,
} from "./analyzers/TrendAnalyzer.js";

// Models
export {
  PreferenceModel,
  type ModelStatistics,
  type ValidationMetrics,
} from "./models/PreferenceModel.js";
export { CollaborativeFilter } from "./models/CollaborativeFilter.js";
export {
  ContentBasedFilter,
  type ItemFeatures,
  type UserProfile,
} from "./models/ContentBased.js";
export {
  HybridRecommender,
  type HybridConfig,
} from "./models/HybridRecommender.js";

// Recommenders
export {
  UIRecommender,
  type RecommendationRequest,
  type RecommendationRule,
} from "./recommenders/UIRecommender.js";
export {
  ComponentRecommender,
  type ComponentDefinition,
  type ComponentRecommendation,
  type ComponentPlacement,
} from "./recommenders/ComponentRecommender.js";
export {
  LayoutRecommender,
  type LayoutRecommendation,
  type LayoutAlternative,
} from "./recommenders/LayoutRecommender.js";
export {
  StyleRecommender,
  type StyleRecommendation,
  type ColorScheme,
  type TypographyScheme,
  type BrandGuidelines,
} from "./recommenders/StyleRecommender.js";

// Personalization
export {
  Personalizer,
  type PersonalizationRecord,
} from "./personalization/Personalizer.js";
export {
  AdaptiveUI,
  type AdaptiveRule,
  type AdaptationRecord,
  type AdaptiveConfig,
} from "./personalization/AdaptiveUI.js";
export {
  ContextAwarePersonalization,
  type ContextRecommendation,
  type ContextProfile,
  type ContextRule,
  type ContextVisit,
} from "./personalization/ContextAware.js";
