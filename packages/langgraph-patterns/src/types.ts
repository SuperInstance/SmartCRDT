/**
 * @fileoverview Core types for LangGraph Advanced Patterns
 *
 * Defines the foundational types for complex multi-agent workflow patterns
 * including sequential, parallel, conditional, recursive, hierarchical, and dynamic patterns.
 */

// LangGraph types (optional - will work even if not installed)
// Using any for conditional imports
type StateGraph = any;
type CompiledGraph = any;
type Runnable = any;

// ============================================================================
// GRAPH PATTERN TYPES
// ============================================================================

/**
 * Available graph pattern types
 *
 * Each pattern represents a different execution strategy for multi-agent workflows.
 */
export type GraphPattern =
  | "sequential" // Execute agents one after another
  | "parallel" // Execute multiple agents simultaneously
  | "conditional" // Route based on conditions
  | "recursive" // Self-referential agent loops
  | "hierarchical" // Nested sub-graphs
  | "dynamic"; // Runtime graph modification

/**
 * Node types within a graph pattern
 */
export type NodeType =
  | "agent" // Individual agent node
  | "router" // Routing/decision node
  | "merge" // Merge/fan-in node
  | "split" // Fork/fan-out node
  | "subgraph" // Nested graph node
  | "terminal"; // Terminal/end node

/**
 * Agent node configuration
 *
 * Defines a single agent node in the graph with its inputs, outputs, and configuration.
 */
export interface AgentNode {
  /** Unique identifier for the node */
  agent_id: string;
  /** Type of node */
  node_type: NodeType;
  /** Expected input schema */
  inputs: Record<string, unknown>;
  /** Output schema */
  outputs: Record<string, unknown>;
  /** Agent-specific configuration */
  config: AgentConfig;
  /** Optional human-readable name */
  name?: string;
  /** Optional description */
  description?: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Model to use */
  model: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** System prompt */
  systemPrompt?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryPolicy;
  /** Additional agent-specific options */
  options?: Record<string, unknown>;
}

/**
 * Edge connection between nodes
 *
 * Defines connections in the graph with optional conditions and priorities.
 */
export interface EdgeConnection {
  /** Source node identifier */
  from_node: string;
  /** Target node identifier */
  to_node: string;
  /** Optional condition for traversing this edge */
  condition?: EdgeCondition;
  /** Priority for ordering (higher = more priority) */
  priority?: number;
  /** Optional label for the edge */
  label?: string;
}

/**
 * Edge condition for conditional routing
 */
export interface EdgeCondition {
  /** Type of condition */
  type: "boolean" | "pattern" | "expression" | "custom";
  /** Condition expression */
  expression: string;
  /** Expected value or pattern */
  value?: unknown;
  /** Custom validator function */
  validator?: (state: GraphState) => boolean | Promise<boolean>;
}

/**
 * Graph execution configuration
 *
 * Controls how the graph pattern executes.
 */
export interface GraphConfig {
  /** Maximum parallelism for parallel patterns */
  max_parallelism: number;
  /** Timeout for entire graph execution */
  timeout: number;
  /** Retry policy for failed nodes */
  retry_policy: RetryPolicy;
  /** Fallback strategy when nodes fail */
  fallback_strategy: FallbackStrategy;
  /** Whether to enable tracing */
  enable_tracing: boolean;
  /** Whether to enable caching */
  enable_caching: boolean;
  /** Checkpoint configuration */
  checkpoint?: CheckpointConfig;
}

/**
 * Retry policy for failed operations
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  max_attempts: number;
  /** Base delay between retries in milliseconds */
  base_delay: number;
  /** Maximum delay between retries */
  max_delay: number;
  /** Whether to use exponential backoff */
  exponential_backoff: boolean;
  /** Jitter factor for backoff */
  jitter_factor: number;
}

/**
 * Fallback strategy
 */
export type FallbackStrategy =
  | "skip" // Skip failed node and continue
  | "terminate" // Terminate entire graph
  | "fallback" // Use fallback node
  | "retry" // Retry with different config
  | "partial"; // Return partial results

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Whether to enable checkpointing */
  enabled: boolean;
  /** Checkpoint interval (number of nodes) */
  interval: number;
  /** Storage backend for checkpoints */
  storage: "memory" | "redis" | "postgres" | "file";
  /** Connection string for storage */
  connection_string?: string;
  /** Maximum number of checkpoints to keep */
  max_checkpoints: number;
}

/**
 * Graph state
 *
 * Shared state passed between nodes in the graph.
 */
export interface GraphState {
  /** Unique identifier for this execution */
  execution_id: string;
  /** Current node path */
  current_path: string[];
  /** Accumulated outputs from all nodes */
  outputs: Map<string, unknown>;
  /** Error information */
  errors: ExecutionError[];
  /** Execution metadata */
  metadata: ExecutionMetadata;
  /** User-defined state */
  state: Record<string, unknown>;
}

/**
 * Execution error
 */
export interface ExecutionError {
  /** Node where error occurred */
  node_id: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: number;
  /** Whether error is recoverable */
  recoverable: boolean;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  /** When execution started */
  started_at: number;
  /** When execution ended (if complete) */
  ended_at?: number;
  /** Total duration in milliseconds */
  duration?: number;
  /** Number of nodes executed */
  nodes_executed: number;
  /** Number of nodes remaining */
  nodes_remaining: number;
  /** Current status */
  status: ExecutionStatus;
}

/**
 * Execution status
 */
export type ExecutionStatus =
  | "pending" // Not yet started
  | "running" // Currently executing
  | "paused" // Paused (checkpoint or waiting)
  | "completed" // Completed successfully
  | "failed" // Failed with error
  | "cancelled"; // Cancelled by user

/**
 * Execution result from a pattern
 *
 * Contains the outputs, metrics, errors, and trace from pattern execution.
 */
export interface ExecutionResult<T = unknown> {
  /** Execution status */
  status: ExecutionStatus;
  /** Outputs from the pattern */
  outputs: T;
  /** Execution metrics */
  metrics: ExecutionMetrics;
  /** Errors that occurred */
  errors: ExecutionError[];
  /** Execution trace */
  trace: ExecutionTrace;
  /** Partial results if execution was incomplete */
  partial?: PartialResult;
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /** Total execution time in milliseconds */
  total_time: number;
  /** Time per node */
  node_times: Map<string, number>;
  /** Number of nodes executed */
  nodes_executed: number;
  /** Number of nodes failed */
  nodes_failed: number;
  /** Number of nodes retried */
  nodes_retried: number;
  /** Number of tokens used */
  tokens_used: number;
  /** Memory usage in bytes */
  memory_used: number;
  /** Cache hit rate */
  cache_hit_rate: number;
}

/**
 * Execution trace
 *
 * Sequential record of all operations performed during execution.
 */
export interface ExecutionTrace {
  /** Trace entries in order */
  entries: TraceEntry[];
  /** Graph topology at start */
  initial_topology: GraphTopology;
  /** Snapshot of state at each checkpoint */
  checkpoint_snapshots: GraphState[];
}

/**
 * Single trace entry
 */
export interface TraceEntry {
  /** Timestamp */
  timestamp: number;
  /** Node being executed */
  node_id: string;
  /** Type of operation */
  operation: "enter" | "exit" | "error" | "checkpoint" | "fallback";
  /** Input to node */
  input?: unknown;
  /** Output from node */
  output?: unknown;
  /** Error if operation failed */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Graph topology
 *
 * Describes the structure of the graph.
 */
export interface GraphTopology {
  /** All nodes in the graph */
  nodes: Map<string, AgentNode>;
  /** All edges in the graph */
  edges: EdgeConnection[];
  /** Entry points (nodes with no incoming edges) */
  entry_points: string[];
  /** Exit points (nodes with no outgoing edges) */
  exit_points: string[];
}

/**
 * Partial result from incomplete execution
 */
export interface PartialResult {
  /** Nodes that completed successfully */
  completed_nodes: string[];
  /** Nodes that failed */
  failed_nodes: string[];
  /** Nodes that were skipped */
  skipped_nodes: string[];
  /** Nodes still pending */
  pending_nodes: string[];
}

// ============================================================================
// PATTERN-SPECIFIC TYPES
// ============================================================================

/**
 * Sequential pattern configuration
 */
export interface SequentialPatternConfig {
  /** Nodes to execute in sequence */
  nodes: AgentNode[];
  /** Whether to stop on first error */
  stop_on_error: boolean;
  /** Whether to pass outputs as inputs */
  pass_outputs: boolean;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Parallel pattern configuration
 */
export interface ParallelPatternConfig {
  /** Nodes to execute in parallel */
  nodes: AgentNode[];
  /** Result merging strategy */
  merge_strategy: MergeStrategy;
  /** Whether to wait for all nodes */
  wait_for_all: boolean;
  /** Minimum nodes required to continue */
  min_required?: number;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Merge strategy for parallel results
 */
export type MergeStrategy =
  | "concat" // Concatenate all results
  | "merge" // Merge into single object
  | "first" // Use first successful result
  | "majority" // Use majority result
  | "custom"; // Use custom merge function

/**
 * Conditional pattern configuration
 */
export interface ConditionalPatternConfig {
  /** Routing nodes and conditions */
  routes: ConditionalRoute[];
  /** Default route if no conditions match */
  default_route?: string;
  /** Whether to evaluate all conditions or stop at first match */
  evaluate_all: boolean;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Conditional route
 */
export interface ConditionalRoute {
  /** Target node */
  node: AgentNode;
  /** Condition to match */
  condition: EdgeCondition;
  /** Priority (higher = evaluated first) */
  priority: number;
}

/**
 * Recursive pattern configuration
 */
export interface RecursivePatternConfig {
  /** Recursive node */
  node: AgentNode;
  /** Base case detection */
  base_case: EdgeCondition;
  /** Maximum recursion depth */
  max_depth: number;
  /** Whether to accumulate results */
  accumulate_results: boolean;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Hierarchical pattern configuration
 */
export interface HierarchicalPatternConfig {
  /** Nested sub-graphs */
  subgraphs: Map<string, GraphPattern>;
  /** Parent-child relationships */
  hierarchy: HierarchyRelationship[];
  /** Result bubbling strategy */
  bubble_strategy: BubbleStrategy;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Hierarchy relationship
 */
export interface HierarchyRelationship {
  /** Parent graph/node */
  parent: string;
  /** Child graph/node */
  child: string;
  /** Scope of relationship */
  scope: "nested" | "parallel" | "sequential";
}

/**
 * Result bubbling strategy
 */
export type BubbleStrategy =
  | "immediate" // Bubble immediately after each subgraph
  | "deferred" // Bubble all at end
  | "selective" // Bubble only specific results
  | "aggregated"; // Aggregate before bubbling

/**
 * Dynamic pattern configuration
 */
export interface DynamicPatternConfig {
  /** Initial nodes */
  initial_nodes: AgentNode[];
  /** Modification rules */
  modification_rules: ModificationRule[];
  /** Whether to allow runtime node addition */
  allow_addition: boolean;
  /** Whether to allow runtime node removal */
  allow_removal: boolean;
  /** Whether to allow runtime edge reconfiguration */
  allow_reconfiguration: boolean;
  /** Graph configuration */
  graph: GraphConfig;
}

/**
 * Modification rule for dynamic patterns
 */
export interface ModificationRule {
  /** When to apply this rule */
  trigger: ModificationTrigger;
  /** Action to take */
  action: ModificationAction;
  /** Conditions for applying */
  conditions: EdgeCondition[];
}

/**
 * Trigger for modification
 */
export type ModificationTrigger =
  | "on_success" // Trigger after successful node
  | "on_failure" // Trigger after failed node
  | "on_timeout" // Trigger on timeout
  | "on_condition" // Trigger when condition met
  | "manual"; // Manual trigger

/**
 * Modification action
 */
export type ModificationAction =
  | "add_node" // Add new node
  | "remove_node" // Remove existing node
  | "add_edge" // Add new edge
  | "remove_edge" // Remove existing edge
  | "reconfigure" // Reconfigure edges
  | "replace"; // Replace node

// ============================================================================
// PATTERN COMPOSER TYPES
// ============================================================================

/**
 * Pattern composition
 *
 * Combines multiple patterns into a complex workflow.
 */
export interface PatternComposition {
  /** Unique identifier */
  id: string;
  /** Patterns in this composition */
  patterns: ComposedPattern[];
  /** Connections between patterns */
  connections: EdgeConnection[];
  /** Composition configuration */
  config: CompositionConfig;
}

/**
 * Composed pattern
 */
export interface ComposedPattern {
  /** Pattern type */
  type: GraphPattern;
  /** Pattern instance */
  pattern: GraphPatternInstance;
  /** Position in composition */
  position: CompositionPosition;
  /** Whether pattern is entry point */
  is_entry: boolean;
  /** Whether pattern is exit point */
  is_exit: boolean;
}

/**
 * Graph pattern instance
 *
 * Concrete instance of a pattern type with configuration.
 */
export interface GraphPatternInstance {
  /** Pattern type */
  type: GraphPattern;
  /** Pattern configuration */
  config: unknown;
  /** Pattern nodes */
  nodes: AgentNode[];
  /** Pattern edges */
  edges: EdgeConnection[];
}

/**
 * Position in composition
 */
export interface CompositionPosition {
  /** X coordinate for visualization */
  x: number;
  /** Y coordinate for visualization */
  y: number;
  /** Layer depth */
  layer: number;
}

/**
 * Composition configuration
 */
export interface CompositionConfig {
  /** Whether to validate composition */
  validate: boolean;
  /** Whether to enable visualization */
  enable_visualization: boolean;
  /** Maximum nesting depth */
  max_depth: number;
  /** Graph configuration */
  graph: GraphConfig;
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

/**
 * LangGraph integration types
 */
export interface LangGraphIntegration {
  /** Compiled LangGraph */
  graph: any;
  /** State graph before compilation */
  state_graph: any;
  /** Node mappings */
  node_mappings: Map<string, string>;
}

/**
 * CoAgents integration types
 */
export interface CoAgentsIntegration {
  /** CoAgents provider configuration */
  provider_config: Record<string, unknown>;
  /** Shared state mappings */
  state_mappings: Map<string, string>;
  /** Checkpoint configuration */
  checkpoint_config: CheckpointConfig;
}

/**
 * VL-JEPA integration types
 */
export interface VLJEPAIntegration {
  /** VL-JEPA bridge configuration */
  bridge_config: Record<string, unknown>;
  /** Visual node mappings */
  visual_mappings: Map<string, string>;
  /** Embedding cache configuration */
  cache_config: Record<string, unknown>;
}

/**
 * A2UI integration types
 */
export interface A2UIIntegration {
  /** A2UI component catalog */
  component_catalog: Record<string, unknown>;
  /** UI generation mappings */
  ui_mappings: Map<string, string>;
  /** Response handling configuration */
  response_config: Record<string, unknown>;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default graph configuration
 */
export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  max_parallelism: 10,
  timeout: 60000, // 60 seconds
  retry_policy: {
    max_attempts: 3,
    base_delay: 1000,
    max_delay: 10000,
    exponential_backoff: true,
    jitter_factor: 0.1,
  },
  fallback_strategy: "skip",
  enable_tracing: true,
  enable_caching: true,
  checkpoint: {
    enabled: false,
    interval: 5,
    storage: "memory",
    max_checkpoints: 10,
  },
};

/**
 * Production graph configuration
 */
export const PRODUCTION_GRAPH_CONFIG: GraphConfig = {
  max_parallelism: 20,
  timeout: 120000, // 2 minutes
  retry_policy: {
    max_attempts: 5,
    base_delay: 500,
    max_delay: 30000,
    exponential_backoff: true,
    jitter_factor: 0.2,
  },
  fallback_strategy: "fallback",
  enable_tracing: true,
  enable_caching: true,
  checkpoint: {
    enabled: true,
    interval: 3,
    storage: "postgres",
    connection_string: (globalThis as any).process?.env?.DATABASE_URL,
    max_checkpoints: 100,
  },
};

/**
 * Minimal graph configuration for testing
 */
export const MINIMAL_GRAPH_CONFIG: GraphConfig = {
  max_parallelism: 2,
  timeout: 5000,
  retry_policy: {
    max_attempts: 1,
    base_delay: 100,
    max_delay: 1000,
    exponential_backoff: false,
    jitter_factor: 0,
  },
  fallback_strategy: "skip",
  enable_tracing: false,
  enable_caching: false,
};

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 3,
  base_delay: 1000,
  max_delay: 10000,
  exponential_backoff: true,
  jitter_factor: 0.1,
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate agent node configuration
 */
export function validateAgentNode(node: AgentNode): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!node.agent_id || node.agent_id.trim() === "") {
    errors.push("agent_id is required");
  }

  if (!node.config || !node.config.model) {
    errors.push("config.model is required");
  }

  if (node.config.timeout !== undefined && node.config.timeout <= 0) {
    errors.push("config.timeout must be positive");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate edge connection
 */
export function validateEdgeConnection(edge: EdgeConnection): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!edge.from_node || edge.from_node.trim() === "") {
    errors.push("from_node is required");
  }

  if (!edge.to_node || edge.to_node.trim() === "") {
    errors.push("to_node is required");
  }

  if (edge.from_node === edge.to_node) {
    errors.push(
      "from_node and to_node cannot be the same (use recursive pattern instead)"
    );
  }

  if (edge.priority !== undefined && edge.priority < 0) {
    errors.push("priority must be non-negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate graph configuration
 */
export function validateGraphConfig(config: GraphConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.max_parallelism <= 0) {
    errors.push("max_parallelism must be positive");
  }

  if (config.timeout <= 0) {
    errors.push("timeout must be positive");
  }

  if (config.retry_policy.max_attempts < 0) {
    errors.push("retry_policy.max_attempts cannot be negative");
  }

  if (config.retry_policy.base_delay < 0) {
    errors.push("retry_policy.base_delay cannot be negative");
  }

  if (
    config.checkpoint?.enabled &&
    !config.checkpoint.connection_string &&
    config.checkpoint.storage !== "memory"
  ) {
    warnings.push(
      `checkpoint enabled but no connection_string for ${config.checkpoint.storage} storage`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate execution result
 */
export function validateExecutionResult(result: ExecutionResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!result.metrics || result.metrics.total_time < 0) {
    errors.push("metrics.total_time cannot be negative");
  }

  if (result.metrics.nodes_executed < 0) {
    errors.push("metrics.nodes_executed cannot be negative");
  }

  if (result.status === "completed" && result.errors.length > 0) {
    errors.push("completed status cannot have errors");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
