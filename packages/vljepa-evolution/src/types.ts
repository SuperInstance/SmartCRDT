/**
 * @vljepa/evolution - UI Evolution Tracker
 *
 * Tracks UI evolution with complete version history and diff visualization.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface UIState {
  components: ComponentState[];
  styles: StyleState;
  layout: LayoutState;
  behavior: BehaviorState;
  metadata: StateMetadata;
}

export interface ComponentState {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: ComponentState[];
  styles: Record<string, string>;
}

export interface StyleState {
  css: Record<string, string>;
  theme: string;
  variables: Record<string, string>;
}

export interface LayoutState {
  type: "flex" | "grid" | "absolute" | "relative";
  dimensions: Dimensions;
  position: Position;
  children: LayoutState[];
}

export interface BehaviorState {
  events: EventBinding[];
  actions: ActionDefinition[];
  stateMachine?: StateMachine;
}

export interface StateMetadata {
  version: string;
  timestamp: number;
  hash: string;
  author: string;
}

export interface Dimensions {
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
}

export interface Position {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  zIndex?: number;
}

export interface EventBinding {
  event: string;
  handler: string;
  debounce?: number;
  throttle?: number;
}

export interface ActionDefinition {
  type: string;
  payload: Record<string, unknown>;
  conditions?: string[];
}

export interface StateMachine {
  initialState: string;
  states: Record<string, StateDefinition>;
  transitions: Record<string, TransitionDefinition>;
}

export interface StateDefinition {
  onEntry?: string[];
  onExit?: string[];
  actions?: string[];
}

export interface TransitionDefinition {
  target: string;
  actions?: string[];
  guard?: string;
}

// ============================================================================
// Evolution Types
// ============================================================================

export interface EvolutionEvent {
  id: string;
  type: "create" | "modify" | "delete" | "rename";
  timestamp: number;
  author: string;
  uiBefore: UIState;
  uiAfter: UIState;
  codeDiff: CodeDiff;
  metadata: EventMetadata;
}

export interface EventMetadata {
  commit: string;
  branch: string;
  message: string;
  tags: string[];
  automated: boolean;
}

export interface EvolutionHistory {
  uiId: string;
  events: EvolutionEvent[];
  versions: UIVersion[];
  currentVersion: string;
  branches: string[];
  metadata: HistoryMetadata;
}

export interface HistoryMetadata {
  createdAt: number;
  updatedAt: number;
  totalEvents: number;
  totalVersions: number;
}

// ============================================================================
// Version Types
// ============================================================================

export interface UIVersion {
  id: string;
  version: string;
  hash: string;
  parent: string | null;
  branch: string;
  timestamp: number;
  author: string;
  message: string;
  changes: Change[];
  state: UIState;
}

export interface VersionTree {
  root: string;
  nodes: Map<string, UIVersion>;
  branches: Map<string, string>;
  merges: Merge[];
}

export interface Merge {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  sourceVersion: string;
  targetVersion: string;
  resultVersion: string;
  timestamp: number;
  conflicts: Conflict[];
  resolved: boolean;
}

export interface Conflict {
  path: string;
  type: "content" | "structural" | "semantic";
  ours: unknown;
  theirs: unknown;
  base: unknown;
  resolution?: unknown;
}

// ============================================================================
// Change Types
// ============================================================================

export type ChangeType = "visual" | "structural" | "behavioral" | "semantic";

export interface Change {
  type: ChangeType;
  path: string;
  severity: "minor" | "major" | "breaking";
  description: string;
  before: unknown;
  after: unknown;
}

export interface DetectedChange {
  type: ChangeType;
  severity: "minor" | "major" | "breaking";
  description: string;
  confidence: number;
  before: unknown;
  after: unknown;
}

export interface ChangeDetectionConfig {
  visual: boolean;
  structural: boolean;
  behavioral: boolean;
  semantic: boolean;
  threshold: number;
}

// ============================================================================
// Diff Types
// ============================================================================

export interface DiffConfig {
  type: "visual" | "code" | "semantic" | "structural";
  algorithm: "myers" | "patience" | "histogram";
  granularity: "coarse" | "medium" | "fine";
}

export interface DiffResult {
  additions: Addition[];
  deletions: Deletion[];
  modifications: Modification[];
  moves: Move[];
  summary: DiffSummary;
}

export interface Addition {
  path: string;
  content: unknown;
  line?: number;
}

export interface Deletion {
  path: string;
  content: unknown;
  line?: number;
}

export interface Modification {
  path: string;
  before: unknown;
  after: unknown;
  line?: number;
}

export interface Move {
  from: string;
  to: string;
  content: unknown;
}

export interface DiffSummary {
  totalAdditions: number;
  totalDeletions: number;
  totalModifications: number;
  totalMoves: number;
  severity: "minor" | "major" | "breaking";
}

export interface CodeDiff {
  unified: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  lineNumber?: number;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface DiffVizConfig {
  format: "side_by_side" | "overlay" | "unified" | "animated";
  highlightColor: string;
  showContext: boolean;
  animation: boolean;
}

export interface RenderedDiff {
  format: string;
  before: unknown;
  after: unknown;
  changes: HighlightedChange[];
  summary: DiffSummary;
}

export interface HighlightedChange {
  type: "addition" | "deletion" | "modification" | "move";
  path: string;
  before: unknown;
  after: unknown;
  className: string;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface EvolutionPattern {
  type:
    | "refactor"
    | "expansion"
    | "consolidation"
    | "iterative"
    | "experimental";
  confidence: number;
  description: string;
  evidence: PatternEvidence[];
}

export interface PatternEvidence {
  timestamp: number;
  version: string;
  description: string;
}

export interface EvolutionTrend {
  metric: string;
  direction: "increasing" | "decreasing" | "stable";
  magnitude: number;
  confidence: number;
}

export interface EvolutionInsight {
  type: "pattern" | "trend" | "anomaly" | "recommendation";
  severity: "info" | "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Rollback Types
// ============================================================================

export interface RollbackConfig {
  preserveState: boolean;
  backupBefore: boolean;
  confirm: boolean;
}

export interface RollbackResult {
  success: boolean;
  previousVersion: string;
  newVersion: string;
  changes: Change[];
  statePreserved: boolean;
}

export interface Backup {
  id: string;
  version: string;
  timestamp: number;
  state: UIState;
  metadata: BackupMetadata;
}

export interface BackupMetadata {
  size: number;
  compressed: boolean;
  checksum: string;
}
