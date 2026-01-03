/**
 * @lsi/vljepa-synthetic - Synthetic UI Data Generation Types
 *
 * Core types for generating synthetic UI data for VL-JEPA training.
 * Supports component generation, layout generation, style mutations, and screenshot rendering.
 *
 * @module types
 */

// ============================================================================
// COMPONENT TYPES
// ============================================================================

/**
 * UI Component types that can be generated
 */
export type ComponentType =
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "switch"
  | "slider"
  | "card"
  | "modal"
  | "drawer"
  | "popover"
  | "tooltip"
  | "alert"
  | "toast"
  | "spinner"
  | "progress"
  | "breadcrumb"
  | "tabs"
  | "accordion"
  | "carousel"
  | "table"
  | "list"
  | "grid"
  | "navbar"
  | "sidebar"
  | "footer"
  | "header"
  | "form"
  | "search"
  | "dropdown"
  | "menu"
  | "pagination"
  | "badge"
  | "tag"
  | "avatar"
  | "divider"
  | "container";

/**
 * Button variant types
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "success"
  | "warning"
  | "info";

/**
 * Button size types
 */
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Input types
 */
export type InputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "date"
  | "time"
  | "datetime-local";

/**
 * Component state types
 */
export type ComponentState =
  | "default"
  | "hover"
  | "active"
  | "focus"
  | "disabled"
  | "loading"
  | "error";

/**
 * Style system types
 */
export type StyleSystem =
  | "tailwind"
  | "material"
  | "ant"
  | "bootstrap"
  | "chakra"
  | "mantine";

// ============================================================================
// GENERATED COMPONENT TYPES
// ============================================================================

/**
 * Component metadata
 */
export interface ComponentMetadata {
  /** Component type */
  type: ComponentType;

  /** Unique identifier */
  id: string;

  /** Style system used */
  styleSystem: StyleSystem;

  /** Generation timestamp */
  timestamp: number;

  /** Seed used for generation */
  seed: number;

  /** Component variant */
  variant?: string;

  /** Component size */
  size?: string;

  /** Component state */
  state: ComponentState;

  /** Accessibility score (0-1) */
  accessibilityScore?: number;

  /** Design score (0-1) */
  designScore?: number;

  /** Tags for categorization */
  tags: string[];
}

/**
 * CSS properties (simplified)
 */
export interface CSSProperties {
  [property: string]: string | number | CSSProperties | undefined;
}

/**
 * Generated component
 */
export interface GeneratedComponent {
  /** Component type */
  type: ComponentType;

  /** HTML/React code */
  code: string;

  /** CSS styles */
  styles: CSSProperties;

  /** Component props */
  props: Record<string, unknown>;

  /** Component metadata */
  metadata: ComponentMetadata;

  /** Screenshot buffer (if rendered) */
  screenshot?: Buffer;

  /** DOM structure (if analyzed) */
  dom?: DOMStructure;
}

/**
 * DOM structure
 */
export interface DOMStructure {
  /** Tag name */
  tag: string;

  /** Attributes */
  attributes: Record<string, string>;

  /** Children */
  children: DOMStructure[];

  /** Text content */
  text?: string;

  /** Bounding box (if rendered) */
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

/**
 * Layout patterns
 */
export type LayoutPattern =
  | "grid"
  | "flex-row"
  | "flex-column"
  | "absolute"
  | "sidebar-main"
  | "header-content"
  | "header-sidebar-content"
  | "card-grid"
  | "masonry"
  | "bento"
  | "holy-grail"
  | "fluid"
  | "responsive-grid";

/**
 * Viewport size breakpoints
 */
export type ViewportSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Component placement in layout
 */
export interface ComponentPlacement {
  /** Component ID */
  componentId: string;

  /** Grid or flex position */
  position: {
    row?: number;
    column?: number;
    rowSpan?: number;
    columnSpan?: number;
    order?: number;
  };

  /** Size */
  size: {
    width?: string | number;
    height?: string | number;
    minWidth?: string | number;
    maxWidth?: string | number;
    minHeight?: string | number;
    maxHeight?: string | number;
  };

  /** Spacing */
  spacing: {
    margin?: string | number;
    padding?: string | number;
    gap?: string | number;
  };

  /** Alignment */
  alignment: {
    justify?: "start" | "end" | "center" | "space-between" | "space-around";
    align?: "start" | "end" | "center" | "stretch" | "baseline";
  };
}

/**
 * Generated layout
 */
export interface GeneratedLayout {
  /** Layout pattern */
  pattern: LayoutPattern;

  /** CSS + HTML structure code */
  code: string;

  /** Breakpoint-specific styles */
  responsive: Record<ViewportSize, string>;

  /** Component placements */
  components: ComponentPlacement[];

  /** Layout metadata */
  metadata: {
    /** Unique identifier */
    id: string;

    /** Style system */
    styleSystem: StyleSystem;

    /** Generation timestamp */
    timestamp: number;

    /** Seed used */
    seed: number;

    /** Number of components */
    componentCount: number;

    /** Breakpoints included */
    breakpoints: ViewportSize[];
  };
}

// ============================================================================
// MUTATION TYPES
// ============================================================================

/**
 * Mutation configuration
 */
export interface MutationConfig {
  /** Mutation rate (0-1) */
  rate: number;

  /** Mutation intensity */
  intensity: "low" | "medium" | "high";

  /** Seed for reproducibility */
  seed: number;

  /** Types of mutations to apply */
  mutationTypes: MutationType[];
}

/**
 * Mutation types
 */
export type MutationType =
  | "color"
  | "typography"
  | "spacing"
  | "border"
  | "shadow"
  | "layout"
  | "content"
  | "state"
  | "style";

/**
 * Applied mutation
 */
export interface AppliedMutation {
  /** Mutation type */
  type: MutationType;

  /** Target property path */
  target: string;

  /** Original value */
  original: unknown;

  /** Mutated value */
  mutated: unknown;

  /** Mutation description */
  description: string;
}

/**
 * Visual diff between original and mutated UI
 */
export interface VisualDiff {
  /** CSS properties that changed */
  changedProps: string[];

  /** Color differences */
  colorDiffs: ColorDiff[];

  /** Layout differences */
  layoutDiffs: LayoutDiff[];

  /** Overall similarity score (0-1) */
  similarityScore: number;
}

/**
 * Color difference
 */
export interface ColorDiff {
  /** Property path */
  property: string;

  /** Original color */
  original: string;

  /** Mutated color */
  mutated: string;

  /** Color distance (Delta E) */
  distance: number;
}

/**
 * Layout difference
 */
export interface LayoutDiff {
  /** Property path */
  property: string;

  /** Original value */
  original: string | number;

  /** Mutated value */
  mutated: string | number;

  /** Impact on layout */
  impact: "none" | "minor" | "moderate" | "major";
}

/**
 * UI state (for mutation)
 */
export interface UIState {
  /** Components in the UI */
  components: GeneratedComponent[];

  /** Layout */
  layout?: GeneratedLayout;

  /** Global styles */
  globalStyles: CSSProperties;

  /** Theme colors */
  theme: ThemeColors;
}

/**
 * Theme colors
 */
export interface ThemeColors {
  /** Primary color */
  primary: string;

  /** Secondary color */
  secondary: string;

  /** Accent color */
  accent: string;

  /** Background color */
  background: string;

  /** Text color */
  text: string;

  /** Error color */
  error: string;

  /** Warning color */
  warning: string;

  /** Success color */
  success: string;
}

/**
 * Mutated UI
 */
export interface MutatedUI {
  /** Original UI state */
  original: UIState;

  /** Mutated UI state */
  mutated: UIState;

  /** Applied mutations */
  mutations: AppliedMutation[];

  /** Visual diff */
  diff: VisualDiff;
}

// ============================================================================
// RENDERER TYPES
// ============================================================================

/**
 * Renderer configuration
 */
export interface RendererConfig {
  /** Resolution multiplier (1x, 2x, 3x) */
  resolution: number;

  /** Output formats */
  formats: ("png" | "jpg" | "webp")[];

  /** Background colors to render */
  backgrounds: string[];

  /** UI states to capture */
  states: ComponentState[];

  /** Rendering timeout (ms) */
  timeout: number;

  /** Viewport size */
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };

  /** Whether to capture accessibility tree */
  captureAccessibilityTree?: boolean;
}

/**
 * Render result
 */
export interface RenderResult {
  /** Image buffer */
  image: Buffer;

  /** Render metadata */
  metadata: RenderMetadata;

  /** DOM structure */
  dom: DOMStructure;

  /** Screenshot data */
  screenshot: CollectedScreenshot;
}

/**
 * Render metadata
 */
export interface RenderMetadata {
  /** Render timestamp */
  timestamp: number;

  /** Render duration (ms) */
  duration: number;

  /** Viewport size */
  viewport: {
    width: number;
    height: number;
  };

  /** Component state */
  state: ComponentState;

  /** Background color */
  background: string;

  /** Image format */
  format: string;

  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Collected screenshot
 */
export interface CollectedScreenshot {
  /** Image data */
  imageData: Buffer;

  /** Component bounding boxes */
  components: Array<{
    id: string;
    bbox: { x: number; y: number; width: number; height: number };
  }>;

  /** Text detections */
  textDetections: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;

  /** Accessibility tree */
  accessibilityTree?: AccessibilityNode;
}

/**
 * Accessibility node
 */
export interface AccessibilityNode {
  /** Role */
  role: string;

  /** Label */
  label?: string;

  /** Description */
  description?: string;

  /** Children */
  children: AccessibilityNode[];

  /** State */
  state?: Record<string, boolean | string>;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;

  /** Validation score (0-1) */
  score: number;

  /** Errors found */
  errors: ValidationError[];

  /** Warnings found */
  warnings: ValidationWarning[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error category */
  category: string;

  /** Error message */
  message: string;

  /** Severity */
  severity: "critical" | "high" | "medium" | "low";

  /** Location of error */
  location?: string;

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning category */
  category: string;

  /** Warning message */
  message: string;

  /** Location */
  location?: string;
}

/**
 * Accessibility validation result
 */
export interface AccessibilityValidationResult extends ValidationResult {
  /** WCAG level compliance */
  wcagLevel: "A" | "AA" | "AAA" | "none";

  /** Contrast ratio scores */
  contrastRatios: Record<string, number>;

  /** ARIA attributes check */
  ariaCompliant: boolean;

  /** Keyboard navigation check */
  keyboardAccessible: boolean;
}

/**
 * Design validation result
 */
export interface DesignValidationResult extends ValidationResult {
  /** Design principles score */
  principles: {
    /** Visual hierarchy */
    hierarchy: number;
    /** Spacing consistency */
    spacing: number;
    /** Color harmony */
    color: number;
    /** Typography */
    typography: number;
    /** Balance */
    balance: number;
  };
}

/**
 * Diversity report
 */
export interface DiversityReport {
  /** Overall diversity score (0-1) */
  overallScore: number;

  /** Color coverage score */
  colorCoverage: number;

  /** Layout variety score */
  layoutVariety: number;

  /** Component mix score */
  componentMix: number;

  /** Style diversity score */
  styleDiversity: number;

  /** Gaps in diversity */
  gaps: DiversityGap[];

  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Diversity gap
 */
export interface DiversityGap {
  /** Gap category */
  category: string;

  /** Missing items */
  missing: string[];

  /** Underrepresented items */
  underrepresented: Array<{
    item: string;
    currentCount: number;
    targetCount: number;
  }>;

  /** Priority to address */
  priority: "high" | "medium" | "low";
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

/**
 * Pipeline stage
 */
export type PipelineStage =
  | "generate"
  | "mutate"
  | "validate"
  | "render"
  | "package";

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline stages */
  stages: PipelineStage[];

  /** Parallelism level (concurrent renders) */
  parallelism: number;

  /** Batch size */
  batchSize: number;

  /** Output configuration */
  output: OutputConfig;

  /** Component generation config */
  componentGen: ComponentGeneratorConfig;

  /** Layout generation config */
  layoutGen: LayoutGeneratorConfig;

  /** Mutation config */
  mutation: MutationConfig;

  /** Renderer config */
  renderer: RendererConfig;

  /** Validation config */
  validation: {
    /** Whether to validate accessibility */
    accessibility: boolean;
    /** Whether to validate design */
    design: boolean;
    /** Whether to validate diversity */
    diversity: boolean;
    /** Minimum validation score (0-1) */
    minScore: number;
  };
}

/**
 * Component generator config
 */
export interface ComponentGeneratorConfig {
  /** Component types to generate */
  componentTypes: ComponentType[];

  /** Style systems to use */
  styleSystems: StyleSystem[];

  /** Variations per component */
  variations: {
    /** Color variations */
    colors: number;
    /** Size variations */
    sizes: number;
    /** State variations */
    states: number;
  };

  /** Random seed */
  seed?: number;
}

/**
 * Layout generator config
 */
export interface LayoutGeneratorConfig {
  /** Layout patterns */
  patterns: LayoutPattern[];

  /** Min columns */
  minColumns: number;

  /** Max columns */
  maxColumns: number;

  /** Breakpoints */
  breakpoints: ViewportSize[];

  /** Spacing range */
  spacing: {
    min: number;
    max: number;
    step: number;
  };

  /** Random seed */
  seed?: number;
}

/**
 * Output configuration
 */
export interface OutputConfig {
  /** Output directory */
  directory: string;

  /** File naming pattern */
  namingPattern: string;

  /** Whether to save images */
  saveImages: boolean;

  /** Whether to save metadata */
  saveMetadata: boolean;

  /** Whether to save embeddings */
  saveEmbeddings: boolean;

  /** Dataset format */
  format: "jsonl" | "parquet" | "tfrecord";

  /** Split ratios */
  split: {
    train: number;
    validation: number;
    test: number;
  };
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  /** Number generated */
  generated: number;

  /** Number passed validation */
  passedValidation: number;

  /** Number failed */
  failed: number;

  /** Diversity score */
  diversity: number;

  /** Average validation score */
  avgValidationScore: number;

  /** Total duration (ms) */
  totalDuration: number;

  /** Average duration per sample (ms) */
  avgDuration: number;

  /** Stage breakdown */
  stageBreakdown: Record<
    PipelineStage,
    {
      duration: number;
      success: number;
      failed: number;
    }
  >;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Pipeline ID */
  id: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime: number;

  /** Statistics */
  stats: PipelineStats;

  /** Generated samples */
  samples: GeneratedSample[];

  /** Output directory */
  outputDir: string;

  /** Success status */
  success: boolean;

  /** Error (if failed) */
  error?: string;
}

/**
 * Batch processor configuration
 */
export interface BatchProcessorConfig {
  pipeline: PipelineConfig;
  targetCount: number;
  parallelism: number;
  checkpointInterval: number;
  outputDir: string;
}

/**
 * Batch progress
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  eta: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: BatchProgress) => void;

/**
 * Generated page
 */
export interface GeneratedPage {
  id: string;
  components: GeneratedComponent[];
  layout: GeneratedLayout;
  code: string;
  metadata: {
    timestamp: number;
    seed: number;
    componentCount: number;
    styleSystem: StyleSystem;
  };
}

/**
 * Style generator config
 */
export interface StyleGeneratorConfig {
  styleSystem: StyleSystem;
  seed?: number;
}

/**
 * Page generator config
 */
export interface PageGeneratorConfig {
  componentTypes: string[];
  styleSystem: StyleSystem;
  minComponents: number;
  maxComponents: number;
  seed?: number;
}

/**
 * React component options
 */
export interface ReactComponentOptions {
  typescript?: boolean;
  styledComponents?: boolean;
  inlineStyles?: boolean;
}

/**
 * Generated sample (output from pipeline)
 */
export interface GeneratedSample {
  /** Sample ID */
  id: string;

  /** Component */
  component: GeneratedComponent;

  /** Layout */
  layout?: GeneratedLayout;

  /** Mutations applied */
  mutations?: AppliedMutation[];

  /** Render result */
  render?: RenderResult;

  /** Validation results */
  validation?: {
    accessibility?: AccessibilityValidationResult;
    design?: DesignValidationResult;
    overall: number;
  };

  /** VL-JEPA embedding (if pre-computed) */
  embedding?: Float32Array;

  /** Metadata */
  metadata: {
    /** Generation timestamp */
    timestamp: number;
    /** Seed used */
    seed: number;
    /** Tags */
    tags: string[];
    /** Dataset split */
    split: "train" | "validation" | "test";
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Seeded random number generator
 */
export interface SeededRandom {
  /** Get next random number (0-1) */
  (): number;

  /** Get random integer in range [min, max] */
  int(min: number, max: number): number;

  /** Get random float in range [min, max] */
  float(min: number, max: number): number;

  /** Pick random item from array */
  pick<T>(array: T[]): T;

  /** Pick N random items from array */
  pickN<T>(array: T[], n: number): T[];

  /** Shuffle array */
  shuffle<T>(array: T[]): T[];

  /** Get current seed */
  getSeed(): number;
}

/**
 * Color utilities
 */
export interface ColorUtils {
  /** Generate random color */
  random(): string;

  /** Generate random color in hue range */
  randomHue(minHue: number, maxHue: number): string;

  /** Generate complementary color */
  complementary(color: string): string;

  /** Generate analogous color */
  analogous(color: string, steps?: number): string[];

  /** Generate triadic colors */
  triadic(color: string): string[];

  /** Generate monochromatic palette */
  monochromatic(color: string, steps: number): string[];

  /** Calculate color distance (Delta E) */
  distance(color1: string, color2: string): number;

  /** Get color luminance */
  luminance(color: string): number;

  /** Check if color is dark */
  isDark(color: string): boolean;

  /** Get contrast ratio between two colors */
  contrastRatio(color1: string, color2: string): number;
}
