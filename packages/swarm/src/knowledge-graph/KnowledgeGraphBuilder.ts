/**
 * KnowledgeGraphBuilder - Build and query knowledge graphs from codebases
 *
 * This class provides:
 * - Graph construction from file system scanning
 * - Import parsing and edge creation
 * - Graph traversal algorithms (BFS, DFS, shortest path)
 * - Cycle detection
 * - Impact analysis
 * - Serialization/deserialization
 * - CRDT integration for distributed storage
 */

import {
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  GraphMetadata,
  GraphStatistics,
  PathQuery,
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
  EdgeType,
  NodeType,
  CycleDetectionResult,
  GraphQueryResult,
} from "@lsi/protocol";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, extname, basename } from "path";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Partial<GraphBuilderConfig> = {
  followSymlinks: false,
  maxDepth: 100,
  detectCycles: true,
  computeStats: true,
  includePatterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  excludePatterns: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  edgeWeights: new Map([
    ["imports", 1],
    ["exports", 1],
    ["extends", 2],
    ["implements", 2],
    ["uses", 1],
    ["depends-on", 3],
    ["contains", 0.5],
  ]),
};

// ============================================================================
// KNOWLEDGE GRAPH BUILDER
// ============================================================================

export class KnowledgeGraphBuilder {
  private graph: KnowledgeGraph;
  private config: GraphBuilderConfig;
  private eventListeners: Set<GraphEventListener>;
  private eventQueue: GraphEvent[];

  constructor(config: GraphBuilderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as GraphBuilderConfig;
    this.eventListeners = new Set();
    this.eventQueue = [];

    // Initialize empty graph
    this.graph = this.createEmptyGraph();
  }

  // ============================================================================
  // GRAPH CONSTRUCTION
  // ============================================================================

  /**
   * Build the knowledge graph from a root directory
   */
  async build(): Promise<KnowledgeGraph> {
    const startTime = Date.now();

    try {
      // Scan directory structure
      await this.scanDirectory(this.config.rootDir, 0);

      // Parse imports and create edges
      await this.buildEdges();

      // Detect cycles if enabled
      if (this.config.detectCycles) {
        const cycleResult = this.detectCycles();
        this.graph.metadata.stats.hasCycles = cycleResult.hasCycles;
        this.graph.metadata.stats.cycles = cycleResult.cycles;
      }

      // Compute statistics if enabled
      if (this.config.computeStats) {
        this.computeStatistics();
      }

      // Update metadata
      this.graph.metadata.updatedAt = Date.now();
      this.graph.metadata.nodeCount = this.graph.nodes.size;
      this.graph.metadata.edgeCount = this.graph.edges.size;

      this.emitEvent({
        type: "graph-imported",
        id: this.generateId(),
        timestamp: Date.now(),
        data: {
          nodeCount: this.graph.metadata.nodeCount,
          edgeCount: this.graph.metadata.edgeCount,
          buildTime: Date.now() - startTime,
        },
      });

      return this.graph;
    } catch (error) {
      throw new Error(`Failed to build knowledge graph: ${error}`);
    }
  }

  /**
   * Scan directory and create nodes for files
   */
  private async scanDirectory(dir: string, depth: number): Promise<void> {
    if (depth > (this.config.maxDepth || 100)) {
      return;
    }

    if (!existsSync(dir)) {
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip excluded patterns
      if (this.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Create directory node
        this.addNode({
          id: fullPath,
          type: "directory",
          name: entry.name,
          path: fullPath,
          language: "directory",
          metadata: {},
          createdAt: statSync(fullPath).birthtimeMs,
          updatedAt: statSync(fullPath).mtimeMs,
        });

        // Recursively scan
        await this.scanDirectory(fullPath, depth + 1);
      } else if (entry.isFile()) {
        // Create file node
        const ext = extname(entry.name);
        const language = this.detectLanguage(ext);

        if (this.shouldInclude(fullPath, ext)) {
          const content = readFileSync(fullPath, "utf-8");
          const stats = statSync(fullPath);

          this.addNode({
            id: fullPath,
            type: "file",
            name: entry.name,
            path: fullPath,
            language,
            metadata: {
              loc: content.split("\n").length,
              custom: { size: stats.size },
            },
            createdAt: stats.birthtimeMs,
            updatedAt: stats.mtimeMs,
          });
        }
      }
    }
  }

  /**
   * Build edges by parsing imports from files
   */
  private async buildEdges(): Promise<void> {
    for (const [nodeId, node] of this.graph.nodes.entries()) {
      if (node.type === "file" && node.path) {
        try {
          const imports = this.parseImports(node.path);
          for (const imp of imports) {
            const targetNodeId = this.resolveImportPath(node.path, imp.resolvedPath);
            if (targetNodeId && this.graph.nodes.has(targetNodeId)) {
              this.addEdge({
                id: this.generateId(),
                from: nodeId,
                to: targetNodeId,
                type: "imports",
                weight: this.config.edgeWeights?.get("imports") || 1,
                frequency: 1,
                isDynamic: imp.isDynamic,
                isTypeOnly: imp.isTypeOnly,
                metadata: {
                  importStatement: imp.statement,
                  lineNumber: imp.lineNumber,
                },
                createdAt: Date.now(),
              });
            }
          }
        } catch (error) {
          // Skip files that can't be parsed
          continue;
        }
      }
    }
  }

  /**
   * Parse imports from a file
   */
  private parseImports(filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const importPatterns = [
      // ES6 imports
      /^import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/,
      // CommonJS require
      /(?:const|let|var)\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/,
      // Dynamic imports
      /import\(['"]([^'"]+)['"]\)/,
    ];

    lines.forEach((line, index) => {
      for (const pattern of importPatterns) {
        const match = line.match(pattern);
        if (match) {
          imports.push({
            importPath: match[1],
            resolvedPath: match[1],
            isDynamic: pattern.toString().includes("import("),
            isTypeOnly: line.includes("import type"),
            lineNumber: index + 1,
            statement: line.trim(),
          });
          break;
        }
      }
    });

    return imports;
  }

  // ============================================================================
  // GRAPH TRAVERSAL ALGORITHMS
  // ============================================================================

  /**
   * Find path between two nodes
   */
  findPath(query: PathQuery): PathResult {
    const startTime = Date.now();
    const algorithm = query.algorithm || "bfs";

    try {
      switch (algorithm) {
        case "bfs":
          return this.bfs(query);
        case "dfs":
          return this.dfs(query);
        case "dijkstra":
          return this.dijkstra(query);
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }
    } catch (error) {
      return {
        found: false,
        path: [],
        length: 0,
      };
    }
  }

  /**
   * Breadth-first search (shortest path in unweighted graph)
   */
  private bfs(query: PathQuery): PathResult {
    const { from, to, maxLength = 100 } = query;
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[]; weight: number }> = [
      { node: from, path: [from], weight: 0 },
    ];
    const maxLen = maxLength;

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current.node);

      if (current.node === to) {
        return {
          found: true,
          path: current.path,
          weight: current.weight,
          length: current.path.length - 1,
        };
      }

      if (current.path.length > maxLen) {
        continue;
      }

      const outEdges = this.graph.adjacencyOut.get(current.node) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && !visited.has(edge.to)) {
          queue.push({
            node: edge.to,
            path: [...current.path, edge.to],
            weight: current.weight + edge.weight,
          });
        }
      }
    }

    return {
      found: false,
      path: [],
      length: 0,
    };
  }

  /**
   * Depth-first search (find any path)
   */
  private dfs(query: PathQuery): PathResult {
    const { from, to, maxLength = 100 } = query;
    const visited = new Set<string>();

    const dfsHelper = (
      current: string,
      path: string[],
      weight: number
    ): PathResult | null => {
      if (current === to) {
        return {
          found: true,
          path,
          weight,
          length: path.length - 1,
        };
      }

      if (path.length > maxLength || visited.has(current)) {
        return null;
      }

      visited.add(current);

      const outEdges = this.graph.adjacencyOut.get(current) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge) {
          const result = dfsHelper(
            edge.to,
            [...path, edge.to],
            weight + edge.weight
          );
          if (result?.found) {
            return result;
          }
        }
      }

      return null;
    };

    const result = dfsHelper(from, [from], 0);
    return result || {
      found: false,
      path: [],
      length: 0,
    };
  }

  /**
   * Dijkstra's algorithm (weighted shortest path)
   */
  private dijkstra(query: PathQuery): PathResult {
    const { from, to } = query;
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>(this.graph.nodes.keys());

    // Initialize distances
    for (const nodeId of this.graph.nodes.keys()) {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    }
    distances.set(from, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let current: string | null = null;
      let minDist = Infinity;

      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          current = nodeId;
        }
      }

      if (current === null || current === to) {
        break;
      }

      unvisited.delete(current);

      // Update distances to neighbors
      const outEdges = this.graph.adjacencyOut.get(current) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && unvisited.has(edge.to)) {
          const alt = (distances.get(current) ?? 0) + edge.weight;
          const currentDist = distances.get(edge.to) ?? Infinity;
          if (alt < currentDist) {
            distances.set(edge.to, alt);
            previous.set(edge.to, current);
          }
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = to;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
    }

    if (path[0] === from) {
      return {
        found: true,
        path,
        weight: distances.get(to) ?? 0,
        length: path.length - 1,
      };
    }

    return {
      found: false,
      path: [],
      length: 0,
    };
  }

  // ============================================================================
  // GRAPH QUERIES
  // ============================================================================

  /**
   * Find neighboring nodes
   */
  findNeighbors(query: NeighborsQuery): NeighborsResult {
    const {
      nodeId,
      inbound = true,
      outbound = true,
      maxDepth = 1,
      edgeTypes,
      nodeTypes,
    } = query;

    const neighbors = new Set<string>();
    const depths = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [
      { node: nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.node) || current.depth > maxDepth) {
        continue;
      }

      visited.add(current.node);

      // Check outbound edges
      if (outbound) {
        const outEdges = this.graph.adjacencyOut.get(current.node) || new Set();
        for (const edgeId of outEdges) {
          const edge = this.graph.edges.get(edgeId);
          if (
            edge &&
            (!edgeTypes || edgeTypes.includes(edge.type)) &&
            (!nodeTypes || this.nodeMatchesType(edge.to, nodeTypes))
          ) {
            neighbors.add(edge.to);
            depths.set(edge.to, Math.min(depths.get(edge.to) ?? Infinity, current.depth + 1));
            if (!visited.has(edge.to)) {
              queue.push({ node: edge.to, depth: current.depth + 1 });
            }
          }
        }
      }

      // Check inbound edges
      if (inbound) {
        const inEdges = this.graph.adjacencyIn.get(current.node) || new Set();
        for (const edgeId of inEdges) {
          const edge = this.graph.edges.get(edgeId);
          if (
            edge &&
            (!edgeTypes || edgeTypes.includes(edge.type)) &&
            (!nodeTypes || this.nodeMatchesType(edge.from, nodeTypes))
          ) {
            neighbors.add(edge.from);
            depths.set(edge.from, Math.min(depths.get(edge.from) ?? Infinity, current.depth + 1));
            if (!visited.has(edge.from)) {
              queue.push({ node: edge.from, depth: current.depth + 1 });
            }
          }
        }
      }
    }

    // Remove the source node from neighbors
    neighbors.delete(nodeId);

    return {
      sourceNodeId: nodeId,
      neighbors,
      depths,
      count: neighbors.size,
    };
  }

  /**
   * Find all ancestors (upstream dependencies)
   */
  findAncestors(query: AncestorsQuery): Set<string> {
    const { nodeId, maxDepth = 0, includeIndirect = true, edgeTypes } = query;

    const ancestors = new Set<string>();
    const visited = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [
      { node: nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.node)) {
        continue;
      }

      visited.add(current.node);

      // Check inbound edges (dependencies)
      const inEdges = this.graph.adjacencyIn.get(current.node) || new Set();
      for (const edgeId of inEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && (!edgeTypes || edgeTypes.includes(edge.type))) {
          ancestors.add(edge.from);

          if (includeIndirect && (maxDepth === 0 || current.depth < maxDepth)) {
            if (!visited.has(edge.from)) {
              queue.push({ node: edge.from, depth: current.depth + 1 });
            }
          }
        }
      }
    }

    return ancestors;
  }

  /**
   * Find all descendants (downstream dependents)
   */
  findDescendants(query: DescendantsQuery): Set<string> {
    const { nodeId, maxDepth = 0, includeIndirect = true, edgeTypes } = query;

    const descendants = new Set<string>();
    const visited = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [
      { node: nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.node)) {
        continue;
      }

      visited.add(current.node);

      // Check outbound edges (dependents)
      const outEdges = this.graph.adjacencyOut.get(current.node) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && (!edgeTypes || edgeTypes.includes(edge.type))) {
          descendants.add(edge.to);

          if (includeIndirect && (maxDepth === 0 || current.depth < maxDepth)) {
            if (!visited.has(edge.to)) {
              queue.push({ node: edge.to, depth: current.depth + 1 });
            }
          }
        }
      }
    }

    return descendants;
  }

  /**
   * Analyze impact of changing a node
   */
  analyzeImpact(nodeId: string): ImpactAnalysisResult {
    const directDependents = new Set<string>();
    const allDependents = new Set<string>();
    const impactLevels = new Map<string, number>();

    // Find direct dependents
    const outEdges = this.graph.adjacencyOut.get(nodeId) || new Set();
    for (const edgeId of outEdges) {
      const edge = this.graph.edges.get(edgeId);
      if (edge) {
        directDependents.add(edge.to);
        impactLevels.set(edge.to, 1);
      }
    }

    // Find all transitive dependents using BFS
    const queue = Array.from(directDependents).map((id) => ({ node: id, level: 1 }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      allDependents.add(current.node);

      const dependentsOutEdges = this.graph.adjacencyOut.get(current.node) || new Set();
      for (const edgeId of dependentsOutEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && !allDependents.has(edge.to) && edge.to !== nodeId) {
          allDependents.add(edge.to);
          const newLevel = current.level + 1;
          impactLevels.set(edge.to, Math.min(impactLevels.get(edge.to) ?? Infinity, newLevel));
          queue.push({ node: edge.to, level: newLevel });
        }
      }
    }

    // Calculate critical path (most affected nodes)
    const criticalPath = Array.from(impactLevels.entries())
      .sort(([, a], [, b]) => a - b)
      .slice(0, 10)
      .map(([nodeId]) => nodeId);

    return {
      changedNodeId: nodeId,
      directDependents,
      allDependents,
      impactLevels,
      criticalPath,
    };
  }

  // ============================================================================
  // CYCLE DETECTION
  // ============================================================================

  /**
   * Detect cycles in the graph using DFS
   */
  detectCycles(): CycleDetectionResult {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outEdges = this.graph.adjacencyOut.get(nodeId) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge) {
          if (!visited.has(edge.to)) {
            if (dfs(edge.to)) {
              return true;
            }
          } else if (recursionStack.has(edge.to)) {
            // Found a cycle
            const cycleStart = path.indexOf(edge.to);
            const cycle = path.slice(cycleStart).concat([edge.to]);
            cycles.push(cycle);
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      count: cycles.length,
    };
  }

  // ============================================================================
  // GRAPH STATISTICS
  // ============================================================================

  /**
   * Compute graph statistics
   */
  private computeStatistics(): void {
    const stats: GraphStatistics = {};

    // Calculate max depth (longest path)
    let maxDepth = 0;
    for (const nodeId of this.graph.nodes.keys()) {
      const result = this.dfs({ from: nodeId, to: nodeId });
      // Note: This is a simplification; real max depth requires more complex algorithm
    }
    stats.maxDepth = maxDepth;

    // Calculate average degree
    let totalDegree = 0;
    for (const nodeId of this.graph.nodes.keys()) {
      const outDegree = (this.graph.adjacencyOut.get(nodeId) || new Set()).size;
      const inDegree = (this.graph.adjacencyIn.get(nodeId) || new Set()).size;
      totalDegree += outDegree + inDegree;
    }
    stats.avgDegree = this.graph.nodes.size > 0 ? totalDegree / this.graph.nodes.size : 0;

    // Find hubs (most connected nodes)
    const nodeDegrees = new Map<string, number>();
    for (const nodeId of this.graph.nodes.keys()) {
      const outDegree = (this.graph.adjacencyOut.get(nodeId) || new Set()).size;
      const inDegree = (this.graph.adjacencyIn.get(nodeId) || new Set()).size;
      nodeDegrees.set(nodeId, outDegree + inDegree);
    }
    stats.hubs = Array.from(nodeDegrees.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([nodeId]) => nodeId);

    this.graph.metadata.stats = stats;
  }

  // ============================================================================
  // GRAPH SERIALIZATION
  // ============================================================================

  /**
   * Serialize graph to JSON-compatible format
   */
  serialize(): SerializedGraph {
    return {
      metadata: this.graph.metadata,
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      format: "knowledge-graph@1.0.0",
    };
  }

  /**
   * Deserialize graph from JSON format
   */
  static deserialize(data: SerializedGraph): KnowledgeGraph {
    const graph: KnowledgeGraph = {
      metadata: data.metadata,
      nodes: new Map(data.nodes.map((node) => [node.id, node])),
      edges: new Map(data.edges.map((edge) => [edge.id, edge])),
      adjacencyOut: new Map(),
      adjacencyIn: new Map(),
    };

    // Rebuild adjacency lists
    for (const edge of data.edges) {
      if (!graph.adjacencyOut.has(edge.from)) {
        graph.adjacencyOut.set(edge.from, new Set());
      }
      graph.adjacencyOut.get(edge.from)!.add(edge.id);

      if (!graph.adjacencyIn.has(edge.to)) {
        graph.adjacencyIn.set(edge.to, new Set());
      }
      graph.adjacencyIn.get(edge.to)!.add(edge.id);
    }

    return graph;
  }

  /**
   * Create snapshot of current graph state
   */
  createSnapshot(): GraphSnapshot {
    const serialized = this.serialize();
    return {
      id: this.generateId(),
      graph: serialized,
      timestamp: Date.now(),
      checksum: this.computeChecksum(serialized),
    };
  }

  // ============================================================================
  // GRAPH MODIFICATION
  // ============================================================================

  /**
   * Add a node to the graph
   */
  addNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node);

    this.emitEvent({
      type: "node-added",
      id: this.generateId(),
      timestamp: Date.now(),
      nodeId: node.id,
    });
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: GraphEdge): void {
    this.graph.edges.set(edge.id, edge);

    // Update adjacency lists
    if (!this.graph.adjacencyOut.has(edge.from)) {
      this.graph.adjacencyOut.set(edge.from, new Set());
    }
    this.graph.adjacencyOut.get(edge.from)!.add(edge.id);

    if (!this.graph.adjacencyIn.has(edge.to)) {
      this.graph.adjacencyIn.set(edge.to, new Set());
    }
    this.graph.adjacencyIn.get(edge.to)!.add(edge.id);

    this.emitEvent({
      type: "edge-added",
      id: this.generateId(),
      timestamp: Date.now(),
      edgeId: edge.id,
      data: { from: edge.from, to: edge.to },
    });
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to graph events
   */
  on(event: GraphEventType, listener: GraphEventListener): () => void {
    const wrappedListener = (e: GraphEvent) => {
      if (e.type === event) {
        listener(e);
      }
    };

    this.eventListeners.add(wrappedListener);
    return () => {
      this.eventListeners.delete(wrappedListener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: GraphEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in graph event listener:", error);
      }
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get the current graph
   */
  getGraph(): KnowledgeGraph {
    return this.graph;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if a file should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");

    for (const pattern of this.config.excludePatterns) {
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
      if (regex.test(normalizedPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a file should be included
   */
  private shouldInclude(filePath: string, ext: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");

    for (const pattern of this.config.includePatterns) {
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
      if (regex.test(normalizedPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".cpp": "cpp",
      ".c": "c",
      ".cs": "csharp",
    };

    return languageMap[ext] || "unknown";
  }

  /**
   * Resolve import path to node ID
   */
  private resolveImportPath(sourceFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith(".")) {
      const sourceDir = sourceFile.split("/").slice(0, -1).join("/");
      const resolved = join(sourceDir, importPath);

      // Try common extensions
      const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (this.graph.nodes.has(withExt)) {
          return withExt;
        }
      }

      // Try without extension (directory import)
      if (this.graph.nodes.has(resolved)) {
        return resolved;
      }
    }

    // Handle node_modules imports
    if (!importPath.startsWith(".")) {
      // For now, just return the import path as-is
      // In a real implementation, you'd resolve node_modules paths
      return importPath;
    }

    return null;
  }

  /**
   * Check if a node matches any of the given types
   */
  private nodeMatchesType(nodeId: string, types: NodeType[]): boolean {
    const node = this.graph.nodes.get(nodeId);
    return node ? types.includes(node.type) : false;
  }

  /**
   * Create empty graph
   */
  private createEmptyGraph(): KnowledgeGraph {
    return {
      metadata: {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeCount: 0,
        edgeCount: 0,
        stats: {},
      },
      nodes: new Map(),
      edges: new Map(),
      adjacencyOut: new Map(),
      adjacencyIn: new Map(),
    };
  }

  /**
   * Compute checksum for serialized graph
   */
  private computeChecksum(data: SerializedGraph): string {
    // Simple checksum - in production use crypto
    const json = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
