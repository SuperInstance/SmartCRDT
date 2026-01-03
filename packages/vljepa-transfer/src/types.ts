/**
 * VL-JEPA Transfer Learning Types
 * Types for framework adapters and transfer learning
 */

// ============================================================================
// Framework Types
// ============================================================================

export type UIFramework =
  | "react"
  | "vue"
  | "angular"
  | "svelte"
  | "flutter"
  | "swiftui";

export type ScriptType = "options" | "composition";
export type StyleType = "scoped" | "css_modules" | "tailwind" | "css";

// ============================================================================
// Parsed UI Types
// ============================================================================

export interface ParsedUI {
  framework: UIFramework;
  components: ParsedComponent[];
  styles: ParsedStyle[];
  imports: ParsedImport[];
  exports: ParsedExport[];
  metadata: UIMetadata;
}

export interface ParsedComponent {
  name: string;
  type: string;
  props: PropDefinition[];
  state: StateDefinition[];
  events: EventDefinition[];
  children: ParsedComponent[];
  template?: string;
  script?: string;
  styles?: string[];
}

export interface ParsedStyle {
  selector: string;
  properties: Record<string, string>;
  media?: string[];
  pseudo?: string[];
}

export interface ParsedImport {
  module: string;
  imports: string[];
  isDefault: boolean;
  line: number;
}

export interface ParsedExport {
  name: string;
  type: "default" | "named";
  line: number;
}

export interface UIMetadata {
  version?: string;
  language: "typescript" | "javascript" | "dart" | "swift";
  features: string[];
  dependencies: string[];
}

// ============================================================================
// Code Generation Types
// ============================================================================

export interface ReactCode {
  component: string;
  hooks?: string;
  types?: string;
  imports: string[];
}

export interface VueCode {
  template: string;
  script: string;
  style: string;
}

export interface AngularCode {
  component: string;
  template: string;
  service?: string;
  module?: string;
}

export interface SvelteCode {
  script: string;
  template: string;
  style: string;
}

export interface FlutterCode {
  widget: string;
  state: string;
  build: string;
  imports: string[];
}

export interface SwiftUICode {
  view: string;
  viewmodel?: string;
  imports: string[];
}

export type GeneratedCode =
  | ReactCode
  | VueCode
  | AngularCode
  | SvelteCode
  | FlutterCode
  | SwiftUICode;

// ============================================================================
// Component & Style Specs
// ============================================================================

export interface ComponentSpec {
  type: string;
  name: string;
  props: Record<string, any>;
  children?: ComponentSpec[];
  events?: EventDefinition[];
  framework: UIFramework;
}

export interface StyleSpec {
  selector: string;
  properties: Record<string, string>;
  framework: UIFramework;
  responsive?: boolean;
  animated?: boolean;
}

export interface GeneratedStyle {
  css?: string;
  scss?: string;
  tailwind?: string;
  framework: UIFramework;
}

// ============================================================================
// Prop, State, Event Definitions
// ============================================================================

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: any;
  validation?: string;
}

export interface StateDefinition {
  name: string;
  type: string;
  initial?: any;
  computed?: boolean;
  reactive?: boolean;
}

export interface EventDefinition {
  name: string;
  type: string;
  payload?: any;
  bubbles?: boolean;
}

// ============================================================================
// Mapping Types
// ============================================================================

export interface ComponentMapping {
  fromFramework: UIFramework;
  toFramework: UIFramework;
  mappings: Map<string, string>;
  props: PropMapping[];
  events: EventMapping[];
  styles: StyleMapping[];
}

export interface PropMapping {
  fromProp: string;
  toProp: string;
  transform?: (value: any) => any;
}

export interface EventMapping {
  fromEvent: string;
  toEvent: string;
  transform?: (payload: any) => any;
}

export interface StyleMapping {
  fromStyle: string;
  toStyle: string;
  transform?: (value: string) => string;
}

// ============================================================================
// Transfer Learning Types
// ============================================================================

export interface TransferConfig {
  baseModel: VLJEPAModel;
  targetFramework: UIFramework;
  freezeLayers: string[];
  learningRate: number;
  epochs: number;
  batchSize: number;
  dataset: FrameworkDataset;
  validationSplit: number;
}

export interface VLJEPAModel {
  encoder: ModelLayer[];
  decoder: ModelLayer[];
  latentDim: number;
  inputShape: [number, number, number];
  version: string;
}

export interface ModelLayer {
  name: string;
  type: string;
  frozen: boolean;
  params?: number;
}

export interface TransferResult {
  model: VLJEPAModel;
  metrics: TransferMetrics;
  accuracy: number;
  samples: number;
  framework: UIFramework;
}

export interface TransferMetrics {
  loss: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  validationLoss: number;
  validationAccuracy: number;
  trainingTime: number;
}

// ============================================================================
// Dataset Types
// ============================================================================

export interface FrameworkDataset {
  framework: UIFramework;
  components: ComponentSample[];
  styles: StyleSample[];
  patterns: PatternSample[];
  size: number;
}

export interface ComponentSample {
  id: string;
  type: string;
  code: string;
  parsed: ParsedComponent;
  metadata: Record<string, any>;
}

export interface StyleSample {
  id: string;
  selector: string;
  code: string;
  parsed: ParsedStyle;
  metadata: Record<string, any>;
}

export interface PatternSample {
  id: string;
  pattern: string;
  code: string;
  category: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface TransferEvaluation {
  framework: UIFramework;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  perClassMetrics: Record<string, ClassMetrics>;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface CompatibilityReport {
  compatible: boolean;
  framework: UIFramework;
  issues: CompatibilityIssue[];
  suggestions: string[];
  score: number;
}

export interface CompatibilityIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  fix?: string;
}

// ============================================================================
// Adapter Configuration Types
// ============================================================================

export interface VueAdapterConfig {
  version: "vue2" | "vue3";
  script: ScriptType;
  style: StyleType;
  typescript: boolean;
}

export interface AngularAdapterConfig {
  version: "15" | "16" | "17" | "18";
  standalone: boolean;
  signals: boolean;
  typescript: boolean;
}

export interface FlutterAdapterConfig {
  version: "2.x" | "3.x";
  nullSafety: boolean;
  material: boolean;
}

export interface SvelteAdapterConfig {
  version: "3" | "4" | "5";
  typescript: boolean;
}

export interface SwiftUIAdapterConfig {
  version: string;
  iosTarget: string;
  macosTarget: string;
  swiftui: boolean;
}

// ============================================================================
// Conversion Result Types
// ============================================================================

export interface ConversionResult<T = GeneratedCode> {
  success: boolean;
  code: T;
  warnings: string[];
  errors: string[];
  metadata: ConversionMetadata;
}

export interface ConversionMetadata {
  fromFramework: UIFramework;
  toFramework: UIFramework;
  componentsConverted: number;
  linesOfCode: number;
  conversionTime: number;
}

// ============================================================================
// Training Types
// ============================================================================

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  learningRate: number;
  timestamp: number;
}

export interface TrainingCallback {
  onEpochEnd?: (progress: TrainingProgress) => void;
  onBatchEnd?: (batch: number, loss: number) => void;
  onTrainingEnd?: (result: TransferResult) => void;
}
