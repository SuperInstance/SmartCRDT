/**
 * @lsi/swarm - Swarm intelligence and distributed knowledge management
 *
 * This package provides:
 * - Cartridge manifest loading and validation
 * - CRDT-based knowledge storage
 * - Distributed state management
 * - Version negotiation protocol
 * - Rollback protocol with consensus
 * - Hypothesis distribution and validation
 */

// ============================================================================
// CARTRIDGE MANIFEST LOADER
// ============================================================================

export {
  ManifestLoader,
  getManifestLoader,
  loadManifest,
  createManifest,
  writeManifest,
  type ManifestLoadOptions,
  type ManifestLoadResult,
  type CreateManifestOptions,
} from "./cartridge/index.js";

// ============================================================================
// VERSION NEGOTIATION
// ============================================================================

export {
  NegotiationClient,
  NegotiationServer,
  VersionSelector,
} from "./version/index.js";

// ============================================================================
// ROLLBACK PROTOCOL
// ============================================================================

export {
  ConsensusManager,
  DEFAULT_CONSENSUS_CONFIG,
  RollbackProtocol,
  DEFAULT_ROLLBACK_CONFIG,
} from "./rollback/index.js";

// ============================================================================
// HYPOTHESIS DISTRIBUTION PROTOCOL
// ============================================================================

export { HypothesisDistributor } from "./hypothesis/index.js";
export type { DistributorConfig } from "./hypothesis/index.js";

// ============================================================================
// KNOWLEDGE GRAPH (Codebase Relationship Graph)
// ============================================================================

export {
  KnowledgeGraphBuilder,
} from "./knowledge-graph/index.js";

export type {
  GraphNode,
  NodeType,
  NodeMetadata,
  GraphEdge,
  EdgeType,
  EdgeMetadata,
  KnowledgeGraph,
  GraphMetadata,
  GraphStatistics,
  PathQuery,
  PathAlgorithm,
  PathResult,
  NeighborsQuery,
  NeighborsResult,
  AncestorsQuery,
  DescendantsQuery,
  ImpactAnalysisResult,
  SerializedGraph,
  GraphSnapshot,
  GraphEvent,
  GraphEventType,
  GraphEventListener,
  GraphBuilderConfig,
  ImportInfo,
  GraphQueryResult,
  CycleDetectionResult,
} from "./knowledge-graph/index.js";

// ============================================================================
// CRDT TYPES (For Type Compatibility Tests)
// ============================================================================

/**
 * CRDTOperation - A CRDT operation type
 *
 * Represents an operation that can be applied to a CRDT.
 */
export interface CRDTOperation {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: "add" | "remove" | "update" | "merge";
  /** Target key/path */
  target: string;
  /** Operation value */
  value: unknown;
  /** Timestamp */
  timestamp: number;
  /** Node ID that created the operation */
  nodeId: string;
}

/**
 * CRDTSnapshot - A snapshot of CRDT state
 *
 * Represents the state of a CRDT at a point in time.
 */
export interface CRDTSnapshot {
  /** Snapshot ID */
  id: string;
  /** State data */
  state: Record<string, unknown>;
  /** Version */
  version: number;
  /** Timestamp */
  timestamp: number;
  /** Checksum for verification */
  checksum?: string;
}

/**
 * CRDTMetadata - Metadata for CRDT entries
 *
 * Metadata associated with CRDT operations and entries.
 */
export interface CRDTMetadata {
  /** Entry ID */
  id: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Node ID that created the entry */
  createdBy: string;
  /** Version */
  version: number;
  /** Additional metadata */
  additional?: Record<string, unknown>;
}

/**
 * CRDTStore - Interface for CRDT-based storage
 *
 * Provides a standard interface for CRDT-based distributed storage.
 * Note: This is a type interface for compatibility tests.
 */
export interface CRDTStore {
  /** Apply an operation */
  apply(operation: CRDTOperation): Promise<void>;
  /** Get current snapshot */
  snapshot(): Promise<CRDTSnapshot>;
  /** Get metadata for a key */
  getMetadata(key: string): Promise<CRDTMetadata | undefined>;
  /** Subscribe to changes */
  subscribe(callback: (op: CRDTOperation) => void): () => void;
}
