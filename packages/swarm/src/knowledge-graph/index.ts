/**
 * Knowledge Graph Module
 *
 * Exports for knowledge graph functionality.
 */

export {
  KnowledgeGraphBuilder,
} from "./KnowledgeGraphBuilder.js";

// Re-export types from @lsi/protocol for convenience
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
} from "@lsi/protocol";
