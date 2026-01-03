/**
 * Debugging and Visualization Types for LangGraph
 *
 * Provides comprehensive type definitions for debugging LangGraph agent workflows,
 * including trace events, execution profiles, visualization formats, and debug sessions.
 */

/**
 * Log levels for debug output
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/**
 * Priority levels for trace events
 */
export type EventPriority = "low" | "medium" | "high" | "critical";

/**
 * Types of trace events in agent execution
 */
export type TraceEventType =
  | "graph_start"
  | "graph_end"
  | "node_start"
  | "node_end"
  | "edge_traversal"
  | "state_change"
  | "error"
  | "warning"
  | "custom";

/**
 * A single trace event during execution
 */
export interface TraceEvent {
  /** Unique event identifier */
  event_id: string;
  /** Type of event */
  event_type: TraceEventType;
  /** Timestamp when event occurred (milliseconds since epoch) */
  timestamp: number;
  /** Agent or node identifier */
  agent_id?: string;
  /** Node name if applicable */
  node_name?: string;
  /** Graph identifier */
  graph_id: string;
  /** Execution trace identifier */
  trace_id: string;
  /** Parent event ID for nested events */
  parent_event_id?: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Event priority */
  priority: EventPriority;
  /** Log level */
  level: LogLevel;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Execution metrics for profiling
 */
export interface ExecutionMetrics {
  /** Total execution time in milliseconds */
  total_time_ms: number;
  /** Time spent in each node */
  node_times: Map<string, number>;
  /** Number of nodes executed */
  nodes_executed: number;
  /** Number of edges traversed */
  edges_traversed: number;
  /** Number of errors encountered */
  error_count: number;
  /** Number of warnings */
  warning_count: number;
  /** Peak memory usage in bytes */
  peak_memory_bytes?: number;
  /** Average node execution time */
  avg_node_time_ms: number;
  /** Slowest node */
  slowest_node?: { name: string; time_ms: number };
  /** Fastest node */
  fastest_node?: { name: string; time_ms: number };
}

/**
 * Timeline entry for visualization
 */
export interface TimelineEntry {
  /** Timeline entry identifier */
  id: string;
  /** Start timestamp */
  start_time: number;
  /** End timestamp */
  end_time: number;
  /** Duration in milliseconds */
  duration_ms: number;
  /** Agent or node identifier */
  agent_id: string;
  /** Node name */
  node_name?: string;
  /** Entry type */
  type: "execution" | "waiting" | "error" | "parallel";
  /** Entry status */
  status: "running" | "completed" | "failed" | "cancelled";
  /** Related timeline entries for parallel execution */
  related_entries?: string[];
  /** Entry metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State snapshot at a point in time
 */
export interface StateSnapshot {
  /** Snapshot identifier */
  snapshot_id: string;
  /** Timestamp */
  timestamp: number;
  /** Graph identifier */
  graph_id: string;
  /** State values */
  state: Record<string, unknown>;
  /** State version for CRDT tracking */
  version: number;
  /** Changed keys since last snapshot */
  changed_keys: string[];
  /** Parent snapshot ID */
  parent_snapshot_id?: string;
}

/**
 * Complete execution trace
 */
export interface ExecutionTrace {
  /** Unique trace identifier */
  trace_id: string;
  /** Graph identifier */
  graph_id: string;
  /** Trace start timestamp */
  start_time: number;
  /** Trace end timestamp */
  end_time: number;
  /** Duration in milliseconds */
  duration_ms: number;
  /** All trace events */
  events: TraceEvent[];
  /** Execution metrics */
  metrics: ExecutionMetrics;
  /** Timeline entries */
  timeline: TimelineEntry[];
  /** State snapshots */
  state_snapshots: StateSnapshot[];
  /** Final state */
  final_state: Record<string, unknown>;
  /** Initial state */
  initial_state: Record<string, unknown>;
  /** Trace status */
  status: "running" | "completed" | "failed" | "cancelled";
  /** Error if failed */
  error?: Error;
  /** Trace metadata */
  metadata: Record<string, unknown>;
}

/**
 * Debug session configuration
 */
export interface DebugSessionConfig {
  /** Enable/disable tracing */
  enable_tracing: boolean;
  /** Log level filter */
  log_level: LogLevel;
  /** Sampling rate (0-1, 1 = all events) */
  sampling_rate: number;
  /** Enable performance profiling */
  enable_profiling: boolean;
  /** Enable state snapshots */
  enable_snapshots: boolean;
  /** Snapshot interval (milliseconds) */
  snapshot_interval_ms?: number;
  /** Maximum events to collect */
  max_events?: number;
  /** Filter events by agent/node */
  event_filters?: EventFilter[];
  /** Enable automatic breakpoint on errors */
  break_on_error: boolean;
  /** Enable detailed logging */
  verbose: boolean;
}

/**
 * Event filter for selective tracing
 */
export interface EventFilter {
  /** Filter by event type */
  event_types?: TraceEventType[];
  /** Filter by agent ID */
  agent_ids?: string[];
  /** Filter by node name */
  node_names?: string[];
  /** Filter by log level */
  min_level?: LogLevel;
  /** Custom filter function */
  custom_filter?: (event: TraceEvent) => boolean;
}

/**
 * Active debug session
 */
export interface DebugSession {
  /** Unique session identifier */
  session_id: string;
  /** Graph configuration being debugged */
  graph_config: Record<string, unknown>;
  /** Session configuration */
  config: DebugSessionConfig;
  /** All traces collected in this session */
  traces: ExecutionTrace[];
  /** Active trace */
  active_trace?: ExecutionTrace;
  /** Session start time */
  start_time: number;
  /** Session end time */
  end_time?: number;
  /** Session status */
  status: "active" | "paused" | "completed" | "error";
  /** Breakpoints set */
  breakpoints: Breakpoint[];
  /** Variable watches */
  watches: VariableWatch[];
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Visualization format options
 */
export type VisualizationFormat =
  | "mermaid"
  | "graphviz"
  | "json"
  | "html"
  | "svg";

/**
 * Graph visualization options
 */
export interface GraphVisualizationOptions {
  /** Output format */
  format: VisualizationFormat;
  /** Highlight specific execution path */
  highlight_path?: string[];
  /** Show node labels */
  show_labels: boolean;
  /** Show edge labels */
  show_edge_labels: boolean;
  /** Include timing information */
  show_timing: boolean;
  /** Include state information */
  show_state: boolean;
  /** Layout algorithm */
  layout?: "top-down" | "left-right" | "circular" | "force-directed";
  /** Color scheme */
  color_scheme?: "default" | "pastel" | "vibrant" | "monochrome";
  /** Node size */
  node_size?: "small" | "medium" | "large";
  /** Font size */
  font_size?: number;
  /** Include timestamps */
  include_timestamps: boolean;
}

/**
 * Graph node for visualization
 */
export interface GraphNode {
  /** Node identifier */
  id: string;
  /** Node name */
  name: string;
  /** Node type */
  type: "agent" | "router" | "conditional" | "action" | "start" | "end";
  /** Node position for visualization */
  position?: { x: number; y: number };
  /** Node metadata */
  metadata?: Record<string, unknown>;
  /** Execution count */
  execution_count?: number;
  /** Total execution time */
  total_time_ms?: number;
  /** Average execution time */
  avg_time_ms?: number;
}

/**
 * Graph edge for visualization
 */
export interface GraphEdge {
  /** Edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge condition (if conditional) */
  condition?: string;
  /** Traversal count */
  traversal_count?: number;
  /** Edge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete graph structure
 */
export interface GraphStructure {
  /** Graph identifier */
  graph_id: string;
  /** All nodes */
  nodes: GraphNode[];
  /** All edges */
  edges: GraphEdge[];
  /** Entry points */
  entry_points: string[];
  /** Exit points */
  exit_points: string[];
}

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  /** Unique breakpoint identifier */
  breakpoint_id: string;
  /** Node name to break on */
  node_name?: string;
  /** Agent ID to break on */
  agent_id?: string;
  /** Conditional expression */
  condition?: string;
  /** Breakpoint enabled status */
  enabled: boolean;
  /** Hit count */
  hit_count: number;
  /** Maximum hits before auto-disable */
  max_hits?: number;
  /** Breakpoint created timestamp */
  created_at: number;
}

/**
 * Variable watch definition
 */
export interface VariableWatch {
  /** Unique watch identifier */
  watch_id: string;
  /** Variable path to watch (e.g., 'state.user.input') */
  variable_path: string;
  /** Watch condition */
  condition?: string;
  /** Watch enabled status */
  enabled: boolean;
  /** Change notifications enabled */
  notify_on_change: boolean;
  /** Value history */
  value_history: Array<{ timestamp: number; value: unknown }>;
  /** Watch created timestamp */
  created_at: number;
}

/**
 * Profile data for a single node or agent
 */
export interface NodeProfile {
  /** Node/agent identifier */
  id: string;
  /** Node/agent name */
  name: string;
  /** Execution count */
  execution_count: number;
  /** Total execution time */
  total_time_ms: number;
  /** Average execution time */
  avg_time_ms: number;
  /** Minimum execution time */
  min_time_ms: number;
  /** Maximum execution time */
  max_time_ms: number;
  /** Standard deviation of execution times */
  std_dev_ms: number;
  /** Memory usage statistics */
  memory_usage?: {
    min_bytes: number;
    max_bytes: number;
    avg_bytes: number;
  };
  /** Error count */
  error_count: number;
  /** Success rate (0-1) */
  success_rate: number;
}

/**
 * Performance bottleneck
 */
export interface Bottleneck {
  /** Bottleneck identifier */
  id: string;
  /** Bottleneck type */
  type: "slow_node" | "memory_leak" | "frequent_error" | "hot_path";
  /** Affected node/agent */
  node_id: string;
  /** Severity (0-1) */
  severity: number;
  /** Description */
  description: string;
  /** Recommendation */
  recommendation: string;
  /** Supporting metrics */
  metrics: Record<string, number>;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  /** Report identifier */
  report_id: string;
  /** Graph identifier */
  graph_id: string;
  /** Report generation timestamp */
  generated_at: number;
  /** Time period covered */
  time_period: { start: number; end: number };
  /** Node profiles */
  node_profiles: NodeProfile[];
  /** Detected bottlenecks */
  bottlenecks: Bottleneck[];
  /** Overall metrics */
  overall_metrics: {
    total_executions: number;
    total_time_ms: number;
    avg_time_ms: number;
    throughput_per_second: number;
    error_rate: number;
  };
  /** Recommendations */
  recommendations: string[];
}

/**
 * State comparison result
 */
export interface StateComparison {
  /** Comparison identifier */
  comparison_id: string;
  /** First state snapshot */
  state1: StateSnapshot;
  /** Second state snapshot */
  state2: StateSnapshot;
  /** Added keys */
  added_keys: string[];
  /** Removed keys */
  removed_keys: string[];
  /** Changed keys with diff */
  changed_keys: Record<string, { old: unknown; new: unknown }>;
  /** Unchanged keys */
  unchanged_keys: string[];
}

/**
 * Console command
 */
export interface ConsoleCommand {
  /** Command identifier */
  command_id: string;
  /** Command string */
  command: string;
  /** Command arguments */
  args: string[];
  /** Execution timestamp */
  timestamp: number;
  /** Command result */
  result?: unknown;
  /** Command error */
  error?: Error;
  /** Execution duration */
  duration_ms: number;
}

/**
 * Debug console context
 */
export interface DebugConsoleContext {
  /** Current state */
  current_state: Record<string, unknown>;
  /** Active trace */
  active_trace?: ExecutionTrace;
  /** Current node */
  current_node?: string;
  /** Available commands */
  available_commands: string[];
  /** Console variables */
  variables: Record<string, unknown>;
}

/**
 * Trace export options
 */
export interface TraceExportOptions {
  /** Export format */
  format: "json" | "csv" | "html";
  /** Include metrics */
  include_metrics: boolean;
  /** Include timeline */
  include_timeline: boolean;
  /** Include state snapshots */
  include_snapshots: boolean;
  /** Compress output */
  compress: boolean;
  /** Filter by time range */
  time_range?: { start: number; end: number };
  /** Filter by event type */
  event_types?: TraceEventType[];
}

/**
 * Trace export result
 */
export interface TraceExportResult {
  /** Export identifier */
  export_id: string;
  /** Export format */
  format: string;
  /** Export timestamp */
  exported_at: number;
  /** Output data or file path */
  output: string | Uint8Array;
  /** Size in bytes */
  size_bytes: number;
  /** Number of traces exported */
  trace_count: number;
  /** Number of events exported */
  event_count: number;
}
