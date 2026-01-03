/**
 * Core types for curriculum learning system
 */

// ============================================================================
// Stage Types
// ============================================================================

export enum StageDifficulty {
  VERY_EASY = "very_easy",
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export enum StageType {
  BASIC = "basic",
  COMPONENTS = "components",
  LAYOUTS = "layouts",
  APPLICATIONS = "applications",
}

export interface CurriculumStage {
  id: string;
  name: string;
  type: StageType;
  difficulty: StageDifficulty;
  config: StageConfig;
  dataGenerator: DataGenerator;
  evaluator: StageEvaluator;
}

export interface StageConfig {
  examples: number;
  epochs: number;
  batchSize: number;
  masteryThreshold: number;
  patience: number;
  prerequisites: string[];
}

// ============================================================================
// Example Types
// ============================================================================

export interface TrainingExample {
  id: string;
  stageId: string;
  imageData: ImageData;
  embedding: Float32Array;
  metadata: ExampleMetadata;
  difficulty: number;
  timestamp: number;
}

export interface ExampleMetadata {
  labels: string[];
  attributes: Record<string, unknown>;
  context?: Record<string, unknown>;
  relationships?: Relationship[];
}

export interface Relationship {
  type: string;
  target: string;
  confidence: number;
}

export interface ImageData {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

// ============================================================================
// Stage 1: Basic Concepts
// ============================================================================

export interface BasicConcept {
  type: "shape" | "color" | "typography" | "pattern";
  name: string;
  variations: ConceptVariation[];
  labels: string[];
}

export interface ConceptVariation {
  parameters: Record<string, unknown>;
  weight: number;
}

export interface Stage1Config extends StageConfig {
  concepts: BasicConcept[];
  difficulty: StageDifficulty.VERY_EASY;
  colorSpaces: ("rgb" | "hsl" | "lab")[];
  shapeComplexity: ("simple" | "compound")[];
}

export interface Stage1Example extends TrainingExample {
  concept: BasicConcept;
  variation: ConceptVariation;
  difficulty: number; // 0-0.25
}

// ============================================================================
// Stage 2: Components
// ============================================================================

export type ComponentType =
  | "button"
  | "input"
  | "select"
  | "checkbox"
  | "radio"
  | "card"
  | "modal"
  | "dropdown"
  | "slider"
  | "toggle";

export type UIState =
  | "default"
  | "hover"
  | "active"
  | "disabled"
  | "focus"
  | "error";

export interface ComponentAttributes {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface Stage2Config extends StageConfig {
  components: ComponentType[];
  states: UIState[];
  difficulty: StageDifficulty.EASY;
  styleVariations: number;
}

export interface Stage2Example extends TrainingExample {
  component: ComponentType;
  state: UIState;
  attributes: ComponentAttributes;
  difficulty: number; // 0.25-0.5
}

// ============================================================================
// Stage 3: Layouts
// ============================================================================

export type LayoutPattern =
  | "flex_row"
  | "flex_column"
  | "grid"
  | "absolute"
  | "stack"
  | "sidebar"
  | "navbar"
  | "hero";

export type SpatialRelation =
  | "above"
  | "below"
  | "left_of"
  | "right_of"
  | "contains"
  | "overlaps"
  | "aligned";

export interface ComponentPlacement {
  component: ComponentType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zOrder: number;
}

export interface SpatialRelations {
  relations: SpatialRelationEntry[];
  hierarchy: HierarchyNode[];
}

export interface SpatialRelationEntry {
  from: string;
  to: string;
  relation: SpatialRelation;
  distance: number;
}

export interface HierarchyNode {
  id: string;
  type: "container" | "component";
  children: HierarchyNode[];
}

export interface ResponsiveVariants {
  mobile: ComponentPlacement[];
  tablet: ComponentPlacement[];
  desktop: ComponentPlacement[];
}

export interface Stage3Config extends StageConfig {
  layouts: LayoutPattern[];
  complexity: ("simple" | "moderate" | "complex")[];
  responsive: boolean;
  difficulty: StageDifficulty.MEDIUM;
}

export interface Stage3Example extends TrainingExample {
  layout: LayoutPattern;
  components: ComponentPlacement[];
  spatial: SpatialRelations;
  responsive?: ResponsiveVariants;
  difficulty: number; // 0.5-0.75
}

// ============================================================================
// Stage 4: Applications
// ============================================================================

export type AppType =
  | "ecommerce"
  | "saas"
  | "dashboard"
  | "social"
  | "content"
  | "admin"
  | "education"
  | "finance";

export type PageType =
  | "login"
  | "signup"
  | "dashboard"
  | "settings"
  | "profile"
  | "listing"
  | "detail"
  | "checkout"
  | "onboarding"
  | "analytics";

export interface InteractionPattern {
  trigger: string;
  action: string;
  target: string;
  expected: string;
}

export interface AppContext {
  purpose: string;
  userGoal: string;
  domain: string;
  constraints: string[];
}

export interface Stage4Config extends StageConfig {
  applications: AppType[];
  pages: PageType[];
  difficulty: StageDifficulty.HARD;
  includeInteractions: boolean;
  realWorldExamples: boolean;
}

export interface Stage4Example extends TrainingExample {
  application: AppType;
  pageType: PageType;
  context: AppContext;
  interactions: InteractionPattern[];
  difficulty: number; // 0.75-1.0
}

// ============================================================================
// Scheduler Types
// ============================================================================

export type SchedulingStrategy = "sequential" | "adaptive" | "teacher";
export type PacingStrategy = "fixed" | "dynamic" | "student_paced";

export interface SchedulerConfig {
  stages: CurriculumStage[];
  strategy: SchedulingStrategy;
  pacing: PacingStrategy;
  replay: ReplayConfig;
  adaptive: AdaptiveConfig;
}

export interface ReplayConfig {
  enabled: boolean;
  bufferSize: number;
  strategy: ("uniform" | "prioritize_hard" | "prioritize_recent")[];
  frequency: number;
}

export interface AdaptiveConfig {
  enabled: boolean;
  metrics: string[];
  thresholds: number[];
  actions: AdaptiveAction[];
}

export type AdaptiveAction =
  | "increase_epochs"
  | "decrease_epochs"
  | "replay_stage"
  | "adjust_difficulty"
  | "skip_stage";

export interface CurriculumProgress {
  currentStage: number;
  stageProgress: StageProgress[];
  overallMastery: number;
  timeSpent: number;
  predictions: CompletionPrediction[];
  history: ProgressEvent[];
}

export interface StageProgress {
  stage: number;
  stageId: string;
  epochs: number;
  examples: number;
  loss: number;
  accuracy: number;
  mastery: number;
  status: StageStatus;
  startedAt?: number;
  completedAt?: number;
}

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "mastered"
  | "skipped"
  | "failed";

export interface CompletionPrediction {
  stage: number;
  estimatedEpochs: number;
  estimatedTime: number;
  confidence: number;
}

export interface ProgressEvent {
  type: string;
  stage: number;
  timestamp: number;
  data: Record<string, unknown>;
}

// ============================================================================
// Training Types
// ============================================================================

export interface JEPATrainerConfig {
  model: VLJEPAModel;
  optimizer: OptimizerConfig;
  loss: JEPALossConfig;
  masking: MaskingConfig;
  epochs: number;
  batchSize: number;
  learningRate: number;
  scheduler: LRSchedulerConfig;
}

export interface VLJEPAModel {
  encoder: EncoderConfig;
  predictor: PredictorConfig;
  embeddingDim: number;
}

export interface EncoderConfig {
  type: "vision" | "language" | "multimodal";
  architecture: string;
  pretrained: boolean;
  frozen: boolean;
}

export interface PredictorConfig {
  depth: number;
  width: number;
  heads: number;
}

export interface OptimizerConfig {
  type: "adam" | "adamw" | "sgd" | "rmsprop";
  learningRate: number;
  weightDecay: number;
  beta1?: number;
  beta2?: number;
  momentum?: number;
}

export interface MaskingConfig {
  strategy: "block" | "random" | "contextual";
  ratio: number;
  patchSize: number;
  minBlocks: number;
  maxBlocks: number;
}

export interface JEPALossConfig {
  embeddingLoss: "cosine" | "mse" | "huber" | "smooth_l1";
  consistencyWeight: number;
  predictionWeight: number;
  auxiliaryWeight: number;
  temperature: number;
}

export interface LRSchedulerConfig {
  type: "constant" | "cosine" | "exponential" | "step" | "warmup_cosine";
  warmupEpochs: number;
  minLR: number;
  maxLR: number;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface StageEvaluator {
  evaluate(
    example: TrainingExample,
    prediction: Float32Array
  ): EvaluationResult;
  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult;
  isMastered(progress: StageProgress): boolean;
}

export interface EvaluationResult {
  loss: number;
  accuracy: number;
  confidence: number;
  metrics: Record<string, number>;
}

export interface BatchEvaluationResult {
  totalLoss: number;
  averageLoss: number;
  averageAccuracy: number;
  averageConfidence: number;
  metrics: Record<string, number>;
  perExample: EvaluationResult[];
}

// ============================================================================
// Sampling Types
// ============================================================================

export interface DifficultySampler {
  sample(batchSize: number, currentDifficulty: number): TrainingExample[];
  updateDifficulty(success: boolean, confidence: number): void;
}

export interface StageSampler {
  initialize(stage: CurriculumStage): void;
  sample(batchSize: number): TrainingExample[];
  reset(): void;
  getProgress(): SamplerProgress;
}

export interface SamplerProgress {
  totalExamples: number;
  sampledExamples: number;
  remainingExamples: number;
  epochsCompleted: number;
}

export interface ReplayBuffer {
  add(example: TrainingExample, priority: number): void;
  sample(batchSize: number): TrainingExample[];
  updatePriority(id: string, priority: number): void;
  clear(): void;
  size(): number;
}

// ============================================================================
// Generator Types
// ============================================================================

export interface DataGenerator {
  initialize(config: StageConfig): Promise<void>;
  generate(count: number): Promise<TrainingExample[]>;
  getProgress(): GeneratorProgress;
  reset(): void;
}

export interface GeneratorProgress {
  generated: number;
  target: number;
  complete: boolean;
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface MetricsTracker {
  track(event: MetricsEvent): void;
  getMetrics(stageId: string): StageMetrics;
  getAllMetrics(): Map<string, StageMetrics>;
  reset(stageId?: string): void;
}

export interface MetricsEvent {
  type: "loss" | "accuracy" | "mastery" | "timing" | "custom";
  stageId: string;
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface StageMetrics {
  stageId: string;
  loss: MetricSeries;
  accuracy: MetricSeries;
  mastery: MetricSeries;
  timing: MetricSeries;
  custom: Map<string, MetricSeries>;
}

export interface MetricSeries {
  values: number[];
  timestamps: number[];
  min: number;
  max: number;
  mean: number;
  std: number;
}

// ============================================================================
// Transition Types
// ============================================================================

export interface TransitionDecider {
  shouldTransition(
    progress: StageProgress,
    metrics: StageMetrics
  ): TransitionDecision;
  estimateReadiness(progress: StageProgress, metrics: StageMetrics): number;
}

export interface TransitionDecision {
  shouldTransition: boolean;
  reason: string;
  confidence: number;
  recommendations?: string[];
}
