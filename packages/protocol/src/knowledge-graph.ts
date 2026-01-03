/**
 * Knowledge Graph Protocol Types
 *
 * Defines the data structures for representing codebase relationships
 * as a directed acyclic graph (DAG) of modules and their imports.
 *
 * Use cases:
 * - "What modules use X?" (reverse dependency lookup)
 * - "What does X depend on?" (forward dependency lookup)
 * - "Find shortest path between X and Y"
 * - "Detect circular dependencies"
 * - "Compute impact analysis for changes"
 */

// ============================================================================
// GRAPH NODE TYPES
// ============================================================================

/**
 * GraphNode - A node in the knowledge graph
 *
 * Represents a module, file, or package in the codebase.
 */
export interface GraphNode {
  /** Unique node identifier (e.g., file path or module name) */
  id: string;

  /** Node type */
  type: NodeType;

  /** Display name */
  name: string;

  /** File path (if applicable) */
  path?: string;

  /** Package name (if applicable) */
  packageName?: string;

  /** Programming language */
  language: string;

  /** Metadata about the node */
  metadata: NodeMetadata;

  /** Timestamp when node was created */
  createdAt: number;

  /** Timestamp when node was last updated */
  updatedAt: number;
}

/**
 * NodeType - The type of graph node
 */
export type NodeType =
  | "file" // Source file
  | "directory" // Directory/folder
  | "package" // Package/module
  | "class" // Class definition
  | "function" // Function/method
  | "interface" // Interface/type definition
  | "enum"; // Enum definition

/**
 * NodeMetadata - Additional metadata about a node
 */
export interface NodeMetadata {
  /** Lines of code */
  loc?: number;

  /** Number of imports */
  importCount?: number;

  /** Number of exports */
  exportCount?: number;

  /** Cyclomatic complexity */
  complexity?: number;

  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

// ============================================================================
// GRAPH EDGE TYPES
// ============================================================================

/**
 * GraphEdge - A directed edge in the knowledge graph
 *
 * Represents a relationship between two nodes (e.g., an import).
 */
export interface GraphEdge {
  /** Unique edge identifier */
  id: string;

  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Edge type */
  type: EdgeType;

  /** Edge weight (for weighted algorithms) */
  weight: number;

  /** Import frequency (how often this import is used) */
  frequency?: number;

  /** Whether this is a dynamic import */
  isDynamic?: boolean;

  /** Whether this is a type-only import */
  isTypeOnly?: boolean;

  /** Additional edge metadata */
  metadata: EdgeMetadata;

  /** Timestamp when edge was created */
  createdAt: number;
}

/**
 * EdgeType - The type of relationship
 */
export type EdgeType =
  | "imports" // Import statement
  | "exports" // Export statement
  | "extends" // Class/interface extension
  | "implements" // Interface implementation
  | "uses" // General usage
  | "depends-on" // Dependency relationship
  | "contains"; // Containment (e.g., directory contains file)

/**
 * EdgeMetadata - Additional metadata about an edge
 */
export interface EdgeMetadata {
  /** Import statement (if applicable) */
  importStatement?: string;

  /** Line number in source file */
  lineNumber?: number;

  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

// ============================================================================
// GRAPH STRUCTURE
// ============================================================================

/**
 * KnowledgeGraph - The complete knowledge graph structure
 */
export interface KnowledgeGraph {
  /** Graph metadata */
  metadata: GraphMetadata;

  /** All nodes in the graph */
  nodes: Map<string, GraphNode>;

  /** All edges in the graph (indexed by edge ID) */
  edges: Map<string, GraphEdge>;

  /** Adjacency list for fast lookups: nodeId -> Set of edge IDs */
  adjacencyOut: Map<string, Set<string>>;

  /** Reverse adjacency list: nodeId -> Set of incoming edge IDs */
  adjacencyIn: Map<string, Set<string>>;
}

/**
 * GraphMetadata - Metadata about the entire graph
 */
export interface GraphMetadata {
  /** Graph version */
  version: number;

  /** Timestamp when graph was created */
  createdAt: number;

  /** Timestamp when graph was last updated */
  updatedAt: number;

  /** Number of nodes */
  nodeCount: number;

  /** Number of edges */
  edgeCount: number;

  /** Graph statistics */
  stats: GraphStatistics;
}

/**
 * GraphStatistics - Statistical information about the graph
 */
export interface GraphStatistics {
  /** Maximum depth (longest path) */
  maxDepth?: number;

  /** Average node degree (average number of connections) */
  avgDegree?: number;

  /** Number of connected components */
  components?: number;

  /** Whether graph contains cycles */
  hasCycles?: boolean;

  /** List of detected cycles (if any) */
  cycles?: string[][];

  /** Most connected nodes (hubs) */
  hubs?: string[];

  /** Node degree distribution */
  degreeDistribution?: Map<number, number>;
}

// ============================================================================
// GRAPH QUERY TYPES
// ============================================================================

/**
 * PathQuery - Query for finding paths between nodes
 */
export interface PathQuery {
  /** Starting node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Maximum path length to search */
  maxLength?: number;

  /** Algorithm to use */
  algorithm?: PathAlgorithm;
}

/**
 * PathAlgorithm - Algorithm for path finding
 */
export type PathAlgorithm =
  | "bfs" // Breadth-first search (shortest path)
  | "dfs" // Depth-first search (any path)
  | "dijkstra"; // Dijkstra's algorithm (weighted shortest path)

/**
 * PathResult - Result of a path query
 */
export interface PathResult {
  /** Whether a path was found */
  found: boolean;

  /** The path (list of node IDs) */
  path: string[];

  /** Total path weight/cost */
  weight?: number;

  /** Path length (number of edges) */
  length: number;
}

/**
 * NeighborsQuery - Query for finding neighboring nodes
 */
export interface NeighborsQuery {
  /** Node ID to query from */
  nodeId: string;

  /** Whether to follow incoming edges (reverse dependencies) */
  inbound?: boolean;

  /** Whether to follow outgoing edges (forward dependencies) */
  outbound?: boolean;

  /** Maximum depth to traverse */
  maxDepth?: number;

  /** Filter by edge type */
  edgeTypes?: EdgeType[];

  /** Filter by node type */
  nodeTypes?: NodeType[];
}

/**
 * NeighborsResult - Result of a neighbors query
 */
export interface NeighborsResult {
  /** Source node ID */
  sourceNodeId: string;

  /** Neighboring nodes */
  neighbors: Set<string>;

  /** Depth level of each neighbor */
  depths: Map<string, number>;

  /** Number of nodes found */
  count: number;
}

/**
 * AncestorsQuery - Query for finding all ancestors (upstream dependencies)
 */
export interface AncestorsQuery {
  /** Node ID to query from */
  nodeId: string;

  /** Maximum depth to traverse (0 = unlimited) */
  maxDepth?: number;

  /** Whether to include indirect ancestors */
  includeIndirect?: boolean;

  /** Filter by edge type */
  edgeTypes?: EdgeType[];
}

/**
 * DescendantsQuery - Query for finding all descendants (downstream dependents)
 */
export interface DescendantsQuery {
  /** Node ID to query from */
  nodeId: string;

  /** Maximum depth to traverse (0 = unlimited) */
  maxDepth?: number;

  /** Whether to include indirect descendants */
  includeIndirect?: boolean;

  /** Filter by edge type */
  edgeTypes?: EdgeType[];
}

/**
 * ImpactAnalysisResult - Result of impact analysis
 */
export interface ImpactAnalysisResult {
  /** Node that was changed */
  changedNodeId: string;

  /** Direct dependents (immediate impact) */
  directDependents: Set<string>;

  /** All transitive dependents (total impact) */
  allDependents: Set<string>;

  /** Impact levels for each node */
  impactLevels: Map<string, number>;

  /** Critical path (most affected nodes) */
  criticalPath: string[];
}

// ============================================================================
// GRAPH SERIALIZATION
// ============================================================================

/**
 * SerializedGraph - Graph representation for storage/transfer
 */
export interface SerializedGraph {
  /** Graph metadata */
  metadata: GraphMetadata;

  /** All nodes */
  nodes: GraphNode[];

  /** All edges */
  edges: GraphEdge[];

  /** Format version */
  format: string;
}

/**
 * GraphSnapshot - A snapshot of graph state at a point in time
 */
export interface GraphSnapshot {
  /** Snapshot ID */
  id: string;

  /** Serialized graph data */
  graph: SerializedGraph;

  /** Timestamp */
  timestamp: number;

  /** Checksum for verification */
  checksum?: string;
}

// ============================================================================
// GRAPH EVENTS
// ============================================================================

/**
 * GraphEventType - Types of graph events
 */
export type GraphEventType =
  | "node-added"
  | "node-removed"
  | "node-updated"
  | "edge-added"
  | "edge-removed"
  | "edge-updated"
  | "graph-imported"
  | "graph-exported";

/**
 * GraphEvent - An event that occurred on the graph
 */
export interface GraphEvent {
  /** Event type */
  type: GraphEventType;

  /** Event ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Affected node ID (if applicable) */
  nodeId?: string;

  /** Affected edge ID (if applicable) */
  edgeId?: string;

  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * GraphEventListener - Callback for graph events
 */
export type GraphEventListener = (event: GraphEvent) => void;

// ============================================================================
// GRAPH BUILDER CONFIGURATION
// ============================================================================

/**
 * GraphBuilderConfig - Configuration for graph building
 */
export interface GraphBuilderConfig {
  /** Root directory to scan */
  rootDir: string;

  /** File patterns to include */
  includePatterns: string[];

  /** File patterns to exclude */
  excludePatterns: string[];

  /** Whether to follow symlinks */
  followSymlinks?: boolean;

  /** Maximum recursion depth */
  maxDepth?: number;

  /** Whether to detect cycles during build */
  detectCycles?: boolean;

  /** Whether to compute statistics */
  computeStats?: boolean;

  /** Custom edge weights */
  edgeWeights?: Map<EdgeType, number>;
}

/**
 * ImportInfo - Information about an import statement
 */
export interface ImportInfo {
  /** Import path (as written in source) */
  importPath: string;

  /** Resolved import path */
  resolvedPath: string;

  /** Whether this is a dynamic import */
  isDynamic: boolean;

  /** Whether this is a type-only import */
  isTypeOnly: boolean;

  /** Line number */
  lineNumber: number;

  /** Import statement */
  statement: string;
}

// ============================================================================
// GRAPH QUERY RESULT WRAPPERS
// ============================================================================

/**
 * GraphQueryResult - Generic result wrapper for graph queries
 */
export interface GraphQueryResult<T> {
  /** Whether query was successful */
  success: boolean;

  /** Query result data */
  data?: T;

  /** Error message (if failed) */
  error?: string;

  /** Query execution time (ms) */
  executionTime: number;
}

/**
 * CycleDetectionResult - Result of cycle detection
 */
export interface CycleDetectionResult {
  /** Whether cycles were detected */
  hasCycles: boolean;

  /** List of cycles found */
  cycles: string[][];

  /** Number of cycles */
  count: number;
}
