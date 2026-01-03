/**
 * Core type definitions for UI preference learning system
 */

// ============================================================================
// Interaction Types
// ============================================================================

export type InteractionType =
  | "click"
  | "hover"
  | "scroll"
  | "navigate"
  | "input"
  | "drag"
  | "drop"
  | "resize";

export interface UIElement {
  id: string;
  type: string;
  tag?: string;
  className?: string;
  text?: string;
  attributes?: Record<string, unknown>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UIContext {
  page: string;
  url?: string;
  viewport: {
    width: number;
    height: number;
  };
  timestamp: number;
  device?: string;
  userAgent?: string;
  referrer?: string;
}

export interface Interaction {
  type: InteractionType;
  element: UIElement;
  timestamp: number;
  duration?: number;
  position: {
    x: number;
    y: number;
  };
  context: UIContext;
  metadata?: Record<string, unknown>;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  interactions: Interaction[];
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Pattern Types
// ============================================================================

export type PatternType = "sequential" | "temporal" | "spatial" | "contextual";

export interface Pattern {
  id: string;
  type: PatternType;
  elements: UIElement[];
  sequence?: InteractionType[];
  frequency: number;
  confidence: number;
  timestamp: number;
  timespan?: number;
}

export interface PatternCluster {
  id: string;
  patterns: Pattern[];
  centroid: Pattern;
  similarity: number;
}

export interface Outlier {
  interaction: Interaction;
  score: number;
  reason: string;
}

export interface AnalysisMetadata {
  totalInteractions: number;
  totalPatterns: number;
  analysisDuration: number;
  timestamp: number;
}

export interface PatternAnalysis {
  patterns: Pattern[];
  clusters: PatternCluster[];
  outliers: Outlier[];
  metadata: AnalysisMetadata;
}

// ============================================================================
// Preference Types
// ============================================================================

export type LayoutType = "grid" | "list" | "stacked" | "masonry" | "tree";
export type DensityType = "compact" | "normal" | "spacious";
export type AlignmentType = "left" | "center" | "right" | "justified";
export type ThemeType = "light" | "dark" | "auto";
export type FontSizeType = "small" | "medium" | "large" | "extra_large";

export interface LayoutPreferences {
  preferred: LayoutType;
  density: DensityType;
  alignment: AlignmentType;
  confidence: number;
}

export interface VisualPreferences {
  theme: ThemeType;
  primaryColor: string;
  accentColor: string;
  borderRadius: number;
  shadows: boolean;
  animations: boolean;
  confidence: number;
}

export interface TypographyPreferences {
  fontFamily: string;
  fontSize: FontSizeType;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: number;
  confidence: number;
}

export interface ComponentPreferences {
  preferred: string[];
  avoided: string[];
  customizations: Record<string, unknown>;
  confidence: number;
}

export interface NavigationPreferences {
  style: "sidebar" | "topbar" | "bottom" | "hamburger";
  position: "left" | "right" | "top" | "bottom";
  sticky: boolean;
  collapsed: boolean;
  confidence: number;
}

export interface UserPreferences {
  userId: string;
  layout: LayoutPreferences;
  visual: VisualPreferences;
  typography: TypographyPreferences;
  components: ComponentPreferences;
  navigation: NavigationPreferences;
  overallConfidence: number;
  lastUpdated: number;
  version: number;
}

// ============================================================================
// Recommendation Types
// ============================================================================

export type RecommendationType =
  | "layout"
  | "component"
  | "style"
  | "content"
  | "navigation";

export interface RecommendedItem {
  id: string;
  type: string;
  score: number;
  confidence: number;
  reason: string;
}

export interface UIRecommendation {
  type: RecommendationType;
  recommendation: unknown;
  confidence: number;
  reason: string;
  expectedSatisfaction: number;
  alternatives?: RecommendedItem[];
}

export interface RecommenderConfig {
  strategy: "collaborative" | "content_based" | "hybrid";
  diversity: number;
  novelty: number;
  serendipity: number;
  maxRecommendations: number;
}

// ============================================================================
// Collaborative Filtering Types
// ============================================================================

export type CollaborativeMethod =
  | "user_based"
  | "item_based"
  | "matrix_factorization";

export interface CollaborativeConfig {
  method: CollaborativeMethod;
  neighbors: number;
  minOverlap: number;
  factors?: number;
  iterations?: number;
  regularization?: number;
}

export interface UserRating {
  userId: string;
  itemId: string;
  rating: number;
  timestamp: number;
  context?: UIContext;
}

export interface SimilarityScore {
  userId: string;
  similarity: number;
  commonItems: number;
}

export interface Recommendation {
  userId: string;
  items: RecommendedItem[];
  method: string;
  confidence: number;
  timestamp: number;
}

// ============================================================================
// Personalization Types
// ============================================================================

export interface UIState {
  layout: LayoutType;
  density: DensityType;
  theme: ThemeType;
  components: string[];
  styles: Record<string, unknown>;
}

export interface UIOption {
  type: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface PersonalizationChange {
  property: string;
  oldValue: unknown;
  newValue: unknown;
  confidence: number;
}

export interface PersonalizationRequest {
  userId: string;
  context: UIContext;
  currentState: UIState;
  availableOptions: UIOption[];
}

export interface PersonalizationResponse {
  personalized: UIState;
  changes: PersonalizationChange[];
  confidence: number;
  reason: string;
}

// ============================================================================
// Feedback Types
// ============================================================================

export type FeedbackType = "implicit" | "explicit" | "observed";

export interface ImplicitFeedback {
  type: "dwell_time" | "click" | "scroll" | "completion";
  value: number;
  normalized?: number;
}

export interface ExplicitFeedback {
  type: "rating" | "like" | "dislike" | "skip" | "report";
  value: number | boolean;
  comment?: string;
}

export interface Feedback {
  userId: string;
  itemId: string;
  type: FeedbackType;
  feedback: ImplicitFeedback | ExplicitFeedback;
  timestamp: number;
  context?: UIContext;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface UserProfile {
  userId: string;
  preferences: UserPreferences;
  interactions: Interaction[];
  feedback: Feedback[];
  segments: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PreferenceModel {
  id: string;
  name: string;
  version: string;
  type: string;
  parameters: Record<string, unknown>;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface Segment {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  users: string[];
  preferences: UserPreferences;
  size: number;
}

export interface Trend {
  id: string;
  name: string;
  direction: "increasing" | "decreasing" | "stable";
  magnitude: number;
  confidence: number;
  timeframe: number;
  affectedUsers: number;
}

export interface TrendAnalysis {
  trends: Trend[];
  timestamp: number;
  totalUsers: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CollectorConfig {
  samplingRate: number;
  bufferSize: number;
  flushInterval: number;
  anonymize: boolean;
}

export interface AnalyzerConfig {
  minPatternLength: number;
  maxPatternLength: number;
  minFrequency: number;
  minConfidence: number;
  clusteringThreshold: number;
}

export interface ModelConfig {
  updateFrequency: number;
  minDataPoints: number;
  validationSplit: number;
  retrainThreshold: number;
}

export interface StorageConfig {
  type: "memory" | "file" | "database";
  connectionString?: string;
  cacheSize: number;
  ttl: number;
}

export interface PreferenceLearningConfig {
  collector: CollectorConfig;
  analyzer: AnalyzerConfig;
  model: ModelConfig;
  storage: StorageConfig;
  collaborative: CollaborativeConfig;
  recommender: RecommenderConfig;
}
