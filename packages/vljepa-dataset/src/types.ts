/**
 * @fileoverview Core type definitions for VL-JEPA Dataset Collection System
 * @description Defines all interfaces for collecting, curating, and formatting UI datasets
 */

/**
 * Viewport size configurations for responsive screenshot capture
 */
export interface ViewportSize {
  width: number;
  height: number;
  name: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  isTablet?: boolean;
  isDesktop?: boolean;
}

/**
 * Standard viewport presets
 */
export const VIEWPORT_PRESETS: Record<string, ViewportSize> = {
  mobile: {
    width: 375,
    height: 667,
    name: "iPhone SE",
    deviceScaleFactor: 2,
    isMobile: true,
  },
  "mobile-large": {
    width: 414,
    height: 896,
    name: "iPhone 11 Pro",
    deviceScaleFactor: 3,
    isMobile: true,
  },
  tablet: {
    width: 768,
    height: 1024,
    name: "iPad",
    deviceScaleFactor: 2,
    isTablet: true,
  },
  "tablet-landscape": {
    width: 1024,
    height: 768,
    name: "iPad Landscape",
    deviceScaleFactor: 2,
    isTablet: true,
  },
  desktop: {
    width: 1920,
    height: 1080,
    name: "Desktop 1080p",
    isDesktop: true,
  },
  "desktop-large": {
    width: 2560,
    height: 1440,
    name: "Desktop 1440p",
    isDesktop: true,
  },
};

/**
 * Data source types for dataset collection
 */
export type DatasetSourceType = "url" | "file" | "gallery" | "crawl" | "api";

/**
 * Dataset source configuration
 */
export interface DatasetSource {
  type: DatasetSourceType;
  location: string;
  weight: number;
  categories: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Screenshot capture configuration
 */
export interface ScreenshotConfig {
  sources: DatasetSource[];
  resolutions: ViewportSize[];
  formats: Array<"png" | "jpg" | "webp">;
  quality: number;
  delay: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  fullPage?: boolean;
  captureBeyondViewport?: boolean;
}

/**
 * Metadata for collected screenshots
 */
export interface ScreenshotMetadata {
  url: string;
  title: string;
  viewport: ViewportSize;
  timestamp: number;
  format: string;
  width: number;
  height: number;
  fileSize: number;
  category?: string;
  tags?: string[];
  devicePixelRatio?: number;
  userAgent?: string;
}

/**
 * A single collected screenshot
 */
export interface CollectedScreenshot {
  id: string;
  url: string;
  image: Buffer;
  metadata: ScreenshotMetadata;
  timestamp: number;
}

/**
 * Image frame from video
 */
export interface ImageFrame {
  id: string;
  image: Buffer;
  timestamp: number;
  index: number;
  metadata?: FrameMetadata;
}

/**
 * Frame-level metadata
 */
export interface FrameMetadata {
  viewport: ViewportSize;
  url?: string;
  elements?: number;
  hasForms?: boolean;
  hasMedia?: boolean;
}

/**
 * DOM element description (simplified for VideoCollector)
 */
export interface DOMElement {
  selector: string;
  tagName: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
}

/**
 * Recorded action types
 */
export type ActionType =
  | "click"
  | "type"
  | "scroll"
  | "drag"
  | "hover"
  | "submit"
  | "navigate";

/**
 * A recorded user action
 */
export interface RecordedAction {
  type: ActionType;
  timestamp: number;
  element: DOMElement;
  before: ImageFrame;
  after: ImageFrame;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Video segment containing frames and actions
 */
export interface VideoSegment {
  id: string;
  url: string;
  frames: ImageFrame[];
  actions: RecordedAction[];
  duration: number;
  fps: number;
  metadata: VideoMetadata;
}

/**
 * Video metadata
 */
export interface VideoMetadata {
  title: string;
  viewport: ViewportSize;
  startTime: number;
  endTime: number;
  totalFrames: number;
  category?: string;
  tags?: string[];
}

/**
 * DOM node structure
 */
export interface DOMNode {
  id: string;
  tagName: string;
  textContent?: string;
  attributes: Record<string, string>;
  children: DOMNode[];
  styles: CSSProperties;
  boundingBox: BoundingBox;
  xpath: string;
  depth: number;
  isInteractive: boolean;
  isVisible: boolean;
  a11y?: A11yInfo;
}

/**
 * CSS properties
 */
export interface CSSProperties {
  display?: string;
  position?: string;
  width?: string;
  height?: string;
  margin?: string;
  padding?: string;
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  border?: string;
  borderRadius?: string;
  boxShadow?: string;
  opacity?: number;
  zIndex?: number;
  cursor?: string;
  [key: string]: string | number | undefined;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

/**
 * Accessibility information
 */
export interface A11yInfo {
  role?: string;
  label?: string;
  description?: string;
  ariaAttributes?: Record<string, string>;
  focusable?: boolean;
  keyboardAccessible?: boolean;
  semanticHtml?: boolean;
}

/**
 * Component type enum
 */
export type ComponentType =
  | "button"
  | "input"
  | "card"
  | "navbar"
  | "sidebar"
  | "modal"
  | "dropdown"
  | "form"
  | "table"
  | "list"
  | "carousel"
  | "alert"
  | "tooltip"
  | "tab"
  | "accordion"
  | "breadcrumb"
  | "pagination"
  | "progress"
  | "skeleton"
  | "chart"
  | "unknown";

/**
 * Detected component
 */
export interface DetectedComponent {
  type: ComponentType;
  selector: string;
  boundingBox: BoundingBox;
  styles: CSSProperties;
  text?: string;
  attributes: Record<string, string>;
  children: DetectedComponent[];
  confidence: number;
  xpath?: string;
}

/**
 * Complete DOM structure
 */
export interface DOMStructure {
  tree: DOMNode;
  components: DetectedComponent[];
  styles: ExtractedStyles;
  accessibility: A11yInfo;
  metadata: StructureMetadata;
}

/**
 * Extracted style information
 */
export interface ExtractedStyles {
  colors: string[];
  fonts: string[];
  spacing: number[];
  borderRadius: number[];
  layout: string[];
  animations: string[];
}

/**
 * Structure metadata
 */
export interface StructureMetadata {
  url: string;
  title: string;
  timestamp: number;
  totalElements: number;
  interactiveElements: number;
  depth: number;
  hasForms: boolean;
  hasMedia: boolean;
  framework?: string;
  library?: string[];
}

/**
 * Quality filter configuration
 */
export interface QualityFilterConfig {
  minResolution: { width: number; height: number };
  maxBlurScore: number;
  minContrast: number;
  minContentCoverage: number;
  deduplicationThreshold: number;
  allowedFormats?: string[];
  maxFileSize?: number;
}

/**
 * Quality issue type
 */
export type QualityIssueType =
  | "low-resolution"
  | "blurry"
  | "low-contrast"
  | "truncated"
  | "duplicate"
  | "corrupted"
  | "too-small"
  | "empty-content"
  | "poor-composition";

/**
 * Quality issue
 */
export interface QualityIssue {
  type: QualityIssueType;
  severity: "low" | "medium" | "high";
  message: string;
  location?: BoundingBox;
}

/**
 * Quality report
 */
export interface QualityReport {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  suggestions: string[];
  metrics: QualityMetrics;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  resolution: { width: number; height: number };
  blurScore: number;
  contrast: number;
  contentCoverage: number;
  sharpness: number;
  brightness: number;
  colorfulness: number;
}

/**
 * Change type for before/after pairs
 */
export type ChangeType =
  | "style"
  | "layout"
  | "content"
  | "interaction"
  | "state"
  | "multi";

/**
 * UI state
 */
export interface UIState {
  id: string;
  screenshot: CollectedScreenshot;
  dom?: DOMStructure;
  components: DetectedComponent[];
  timestamp: number;
}

/**
 * Visual diff between states
 */
export interface VisualDiff {
  boundingBoxes: BoundingBoxDiff[];
  elementChanges: ElementChange[];
  styleChanges: StyleChange[];
  contentChanges: ContentChange[];
  similarity: number;
}

/**
 * Bounding box diff
 */
export interface BoundingBoxDiff {
  before: BoundingBox;
  after: BoundingBox;
  changeType: "added" | "removed" | "moved" | "resized";
  confidence: number;
}

/**
 * Element change
 */
export interface ElementChange {
  type: ComponentType;
  selector?: string;
  change: "added" | "removed" | "modified";
  before?: DetectedComponent;
  after?: DetectedComponent;
  confidence: number;
}

/**
 * Style change
 */
export interface StyleChange {
  selector: string;
  property: string;
  before: string | number;
  after: string | number;
  impact: "low" | "medium" | "high";
}

/**
 * Content change
 */
export interface ContentChange {
  selector: string;
  changeType: "text" | "image" | "icon" | "media";
  before?: string;
  after?: string;
  confidence: number;
}

/**
 * UI state pair
 */
export interface UIStatePair {
  id: string;
  before: UIState;
  after: UIState;
  changeType: ChangeType;
  changeDescription: string;
  diff: VisualDiff;
  metadata: PairMetadata;
}

/**
 * Pair metadata
 */
export interface PairMetadata {
  timestamp: number;
  source: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  intendedUse?: string[];
}

/**
 * JEPA training format
 */
export interface JEPAFormatterConfig {
  embeddingSize: number;
  imageSize: { width: number; height: number };
  includeDOM: boolean;
  includeActions: boolean;
  normalizeImages: boolean;
  augmentData: boolean;
}

/**
 * Formatted JEPA sample
 */
export interface JEPASample {
  id: string;
  xEmbedding: Float32Array;
  yEmbedding: Float32Array;
  goalEmbedding: Float32Array;
  image: Buffer;
  dom?: DOMStructure;
  actions?: RecordedAction[];
  metadata: JEPAMetadata;
}

/**
 * JEPA sample metadata
 */
export interface JEPAMetadata {
  pairId?: string;
  category: string;
  changeType: ChangeType;
  difficulty: "easy" | "medium" | "hard";
  timestamp: number;
  source: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: "local" | "s3" | "gcs" | "azure";
  basePath: string;
  maxCacheSize: number;
  compressionLevel: number;
  metadataFormat: "json" | "parquet" | "csv";
}

/**
 * Cache manager configuration
 */
export interface CacheConfig {
  maxSize: number;
  ttl: number;
  strategy: "lru" | "fifo" | "lfu";
  persistToDisk: boolean;
  diskPath?: string;
}

/**
 * Annotation for training data
 */
export interface Annotation {
  id: string;
  sampleId: string;
  annotator: string;
  timestamp: number;
  labels: Record<string, unknown>;
  boundingBoxes?: BoundingBox[];
  relationships?: AnnotationRelationship[];
  confidence?: number;
}

/**
 * Annotation relationships
 */
export interface AnnotationRelationship {
  from: string;
  to: string;
  type: string;
  direction: "bidirectional" | "unidirectional";
}

/**
 * Dataset statistics
 */
export interface DatasetStatistics {
  totalScreenshots: number;
  totalVideos: number;
  totalFrames: number;
  totalPairs: number;
  categoryDistribution: Record<string, number>;
  resolutionDistribution: Record<string, number>;
  componentDistribution: Record<string, number>;
  qualityScore: number;
  duplicateCount: number;
}

/**
 * Collection progress
 */
export interface CollectionProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentBatch: number;
  estimatedTimeRemaining: number;
}

/**
 * Error types
 */
export type DatasetErrorType =
  | "capture-failed"
  | "parsing-failed"
  | "quality-failed"
  | "storage-failed"
  | "network-error"
  | "timeout"
  | "invalid-source"
  | "insufficient-permissions";

/**
 * Dataset error
 */
export interface DatasetError extends Error {
  type: DatasetErrorType;
  source?: string;
  timestamp: number;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Data augmentation configuration
 */
export interface AugmentationConfig {
  enabled: boolean;
  rotate: boolean;
  flip: boolean;
  crop: boolean;
  colorJitter: boolean;
  blur: boolean;
  noise: boolean;
  brightness: boolean;
  contrast: boolean;
}

/**
 * Diversity sampler configuration
 */
export interface DiversityConfig {
  targetSamplesPerCategory: number;
  minCategoryCoverage: number;
  maxSimilarityThreshold: number;
  stratification: boolean;
  rareCategoryBoost: number;
}
