/**
 * @vljepa/evolution - UI Evolution Tracker
 *
 * Tracks UI evolution with complete version history and diff visualization.
 */

// Types
export type {
  UIState,
  ComponentState,
  StyleState,
  LayoutState,
  BehaviorState,
  StateMetadata,
  Dimensions,
  Position,
  EventBinding,
  ActionDefinition,
  StateMachine,
  StateDefinition,
  TransitionDefinition,
  EvolutionEvent,
  EventMetadata,
  EvolutionHistory,
  HistoryMetadata,
  UIVersion,
  VersionTree,
  Merge,
  Conflict,
  ChangeType,
  Change,
  DetectedChange,
  ChangeDetectionConfig,
  DiffConfig,
  DiffResult,
  Addition,
  Deletion,
  Modification,
  Move,
  DiffSummary,
  CodeDiff,
  DiffHunk,
  DiffLine,
  DiffVizConfig,
  RenderedDiff,
  HighlightedChange,
  EvolutionPattern,
  PatternEvidence,
  EvolutionTrend,
  EvolutionInsight,
  RollbackConfig,
  RollbackResult,
  Backup,
  BackupMetadata,
} from "./types.js";

// Tracker
export { EvolutionTracker } from "./tracker/EvolutionTracker.js";

export type {
  TrackerConfig,
  EventQueryOptions,
  EvolutionStatistics,
} from "./tracker/EvolutionTracker.js";

export { ChangeDetector } from "./tracker/ChangeDetector.js";

export { SnapshotManager } from "./tracker/SnapshotManager.js";

export type {
  Snapshot,
  SnapshotConfig,
  SnapshotStatistics,
} from "./tracker/SnapshotManager.js";

// History
export { VersionHistory } from "./history/VersionHistory.js";

export type { LogOptions } from "./history/VersionHistory.js";

export { Timeline } from "./history/Timeline.js";

export type {
  TimelineEvent,
  TimelineMetadata,
  DensityEntry,
  Gap,
  TimelineStatistics,
} from "./history/Timeline.js";

export { Ancestry } from "./history/Ancestry.js";

export type {
  AncestryNode,
  AncestryMetadata,
  FamilyTree,
  AncestryStatistics,
} from "./history/Ancestry.js";

export { BranchManager } from "./history/BranchManager.js";

export type {
  Branch,
  BranchMetadata,
  ListOptions,
  BranchComparison,
  BranchStatistics,
} from "./history/BranchManager.js";

// Diff
export { DiffEngine } from "./diff/DiffEngine.js";

// Visualization
export { DiffRenderer } from "./visualization/DiffRenderer.js";

export type {
  AnimationFrame,
  AnimatedDiff,
} from "./visualization/DiffRenderer.js";

export { TimelineViz } from "./visualization/TimelineViz.js";

export type {
  TimelineChartData,
  TimelineDataPoint,
  TypeDistribution,
  HeatmapData,
  HeatmapPoint,
  StreamGraphData,
  StreamSeries,
} from "./visualization/TimelineViz.js";

export { TreeViz } from "./visualization/TreeViz.js";

export type {
  D3TreeData,
  D3TreeNode,
  BranchDiagram,
  BranchInfo,
  CommitGraph,
  CommitNode,
  CommitEdge,
} from "./visualization/TreeViz.js";

export { VisualDiff } from "./visualization/VisualDiff.js";

export type {
  VisualDifference,
  VisualRegion,
  HeatMapRegion,
  SideBySideComparison,
  ComponentRegion,
  OverlayDiff,
  OverlayChange,
} from "./visualization/VisualDiff.js";

// Rollback
export { RollbackManager } from "./rollback/RollbackManager.js";

export type {
  RollbackManagerConfig,
  RollbackRecord,
  RollbackStatistics,
  BackupMetadata as RollbackBackupMetadata,
} from "./rollback/RollbackManager.js";

export { RevertManager } from "./rollback/RevertManager.js";

export type {
  RevertPlan,
  RevertChange,
  RevertConflict,
  ConflictResolution,
  RevertImpact,
  RevertPreview,
  ChangeSummary,
  RevertResult,
  RevertRecord,
  RevertStatistics,
  SafeVersion,
} from "./rollback/RevertManager.js";

export { BackupManager } from "./rollback/BackupManager.js";

export type {
  BackupPolicy,
  BackupSchedule,
  BackupStatistics,
} from "./rollback/BackupManager.js";

// Analysis
export {
  EvolutionAnalyzer,
  PatternDetector,
  TrendAnalyzer,
  InsightGenerator,
} from "./analysis/index.js";
