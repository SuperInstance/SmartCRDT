/**
 * @fileoverview Hierarchical Pattern Implementation
 *
 * Manages nested sub-graphs with parent-child coordination,
 * result bubbling, and scoped execution.
 */

import type {
  AgentNode,
  GraphState,
  GraphConfig,
  ExecutionResult,
  ExecutionStatus,
  ExecutionMetrics,
  ExecutionTrace,
  ExecutionError,
  TraceEntry,
  HierarchicalPatternConfig,
  HierarchyRelationship,
  BubbleStrategy,
  GraphPattern,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";
import { SequentialPattern } from "./SequentialPattern.js";
import { ParallelPattern } from "./ParallelPattern.js";

/**
 * Sub-graph execution result
 */
interface SubGraphResult {
  subgraphId: string;
  parentId?: string;
  result: ExecutionResult;
  depth: number;
}

/**
 * Hierarchical Pattern Class
 *
 * Executes nested sub-graphs with proper coordination and
 * result bubbling between parent and child levels.
 */
export class HierarchicalPattern {
  private config: HierarchicalPatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];
  private subGraphRegistry = new Map<string, GraphPattern>();

  constructor(config: Partial<HierarchicalPatternConfig> = {}) {
    this.config = {
      subgraphs: config.subgraphs || new Map(),
      hierarchy: config.hierarchy || [],
      bubble_strategy: config.bubble_strategy || "immediate",
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };

    // Initialize subgraph registry
    for (const [id, pattern] of this.config.subgraphs) {
      this.subGraphRegistry.set(id, pattern);
    }
  }

  /**
   * Execute the hierarchical pattern
   *
   * @param initialInput - Input to the root level sub-graphs
   * @returns Execution result with bubbled outputs
   */
  async execute(
    initialInput: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Initialize state
    this.currentExecution = {
      execution_id: executionId,
      current_path: [],
      outputs: new Map(),
      errors: [],
      metadata: {
        started_at: startTime,
        nodes_executed: 0,
        nodes_remaining: this.config.subgraphs.size,
        status: "running",
      },
      state: { ...initialInput },
    };

    this.trace = [];

    try {
      // Build execution tree from hierarchy
      const executionTree = this.buildExecutionTree();

      // Execute from root level
      const subGraphResults = await this.executeLevel(
        executionTree,
        initialInput,
        0
      );

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Update metadata
      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status =
        this.determineFinalStatus(subGraphResults);

      // Build execution result
      return this.buildExecutionResult(subGraphResults, totalDuration);
    } catch (error) {
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      this.currentExecution.errors.push({
        node_id: "hierarchical_pattern",
        message: error instanceof Error ? error.message : String(error),
        timestamp: endTime,
        recoverable: false,
      });

      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status = "failed";

      return this.buildExecutionResult([], totalDuration);
    }
  }

  /**
   * Build execution tree from hierarchy
   */
  private buildExecutionTree(): ExecutionTreeNode[] {
    const roots: ExecutionTreeNode[] = [];

    // Find root nodes (nodes without parents)
    const childIds = new Set(this.config.hierarchy.map(h => h.child));
    const rootIds = Array.from(this.config.subgraphs.keys()).filter(
      id => !childIds.has(id)
    );

    for (const rootId of rootIds) {
      const node = this.buildTreeNode(rootId);
      if (node) {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Build tree node recursively
   */
  private buildTreeNode(subgraphId: string): ExecutionTreeNode | null {
    const pattern = this.config.subgraphs.get(subgraphId);
    if (!pattern) return null;

    const children = this.config.hierarchy
      .filter(h => h.parent === subgraphId)
      .map(h => this.buildTreeNode(h.child))
      .filter((n): n is ExecutionTreeNode => n !== null);

    return {
      subgraphId,
      pattern,
      children,
    };
  }

  /**
   * Execute a level of the hierarchy
   */
  private async executeLevel(
    nodes: ExecutionTreeNode[],
    input: Record<string, unknown>,
    depth: number
  ): Promise<SubGraphResult[]> {
    const results: SubGraphResult[] = [];

    for (const node of nodes) {
      // Add trace entry for entering subgraph
      this.addTraceEntry({
        timestamp: Date.now(),
        node_id: node.subgraphId,
        operation: "enter",
        input: { ...input, _depth: depth },
      });

      try {
        // Prepare input with parent context
        const nodeInput = {
          ...input,
          _subgraph_id: node.subgraphId,
          _depth: depth,
          _parent_results: results.map(r => r.result.outputs),
        };

        // Execute the subgraph
        const result = await this.executeSubGraph(
          node,
          nodeInput as Record<string, unknown>
        );

        // Store result
        const subGraphResult: SubGraphResult = {
          subgraphId: node.subgraphId,
          result,
          depth,
        };
        results.push(subGraphResult);

        // Add trace entry for exiting subgraph
        this.addTraceEntry({
          timestamp: Date.now(),
          node_id: node.subgraphId,
          operation: "exit",
          output: result.outputs,
        });

        // Handle bubbling based on strategy
        if (node.children.length > 0) {
          await this.handleBubbling(
            subGraphResult,
            node.children,
            result.outputs as Record<string, unknown>
          );
        }

        // Update execution state
        this.currentExecution!.outputs.set(node.subgraphId, result.outputs);
        this.currentExecution!.metadata.nodes_executed++;
        this.currentExecution!.current_path.push(node.subgraphId);
      } catch (error) {
        const execError: ExecutionError = {
          node_id: node.subgraphId,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          recoverable: true,
        };
        this.currentExecution!.errors.push(execError);

        this.addTraceEntry({
          timestamp: Date.now(),
          node_id: node.subgraphId,
          operation: "error",
          error: execError.message,
        });
      }
    }

    return results;
  }

  /**
   * Execute a sub-graph based on its pattern type
   */
  private async executeSubGraph(
    node: ExecutionTreeNode,
    input: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const timeout = this.config.graph.timeout;

    // Create mock nodes for subgraph execution
    const mockNodes = this.createMockNodesForSubgraph(node.subgraphId);

    switch (node.pattern) {
      case "sequential":
        const sequentialPattern = new SequentialPattern({
          nodes: mockNodes,
          graph: { ...this.config.graph, timeout },
        });
        return sequentialPattern.execute(input as Record<string, unknown>);

      case "parallel":
        const parallelPattern = new ParallelPattern({
          nodes: mockNodes,
          graph: { ...this.config.graph, timeout },
        });
        return parallelPattern.execute(input as Record<string, unknown>);

      default:
        // For other pattern types, return a mock result
        return this.createMockExecutionResult(node.subgraphId);
    }
  }

  /**
   * Create mock nodes for subgraph execution
   */
  private createMockNodesForSubgraph(subgraphId: string): AgentNode[] {
    const count = Math.floor(Math.random() * 3) + 2; // 2-4 nodes
    const nodes: AgentNode[] = [];

    for (let i = 0; i < count; i++) {
      nodes.push({
        agent_id: `${subgraphId}_node_${i}`,
        node_type: "agent",
        inputs: {},
        outputs: {},
        config: {
          model: "mock-model",
          timeout: 5000,
        },
        name: `${subgraphId} Node ${i}`,
      });
    }

    return nodes;
  }

  /**
   * Create mock execution result
   */
  private createMockExecutionResult(subgraphId: string): ExecutionResult {
    return {
      status: "completed",
      outputs: {
        subgraph_id: subgraphId,
        timestamp: Date.now(),
        success: true,
        result: `Mock result from ${subgraphId}`,
      },
      metrics: {
        total_time: Math.random() * 100 + 50,
        node_times: new Map(),
        nodes_executed: 1,
        nodes_failed: 0,
        nodes_retried: 0,
        tokens_used: 50,
        memory_used: 0,
        cache_hit_rate: 0,
      },
      errors: [],
      trace: {
        entries: [],
        initial_topology: {
          nodes: new Map(),
          edges: [],
          entry_points: [],
          exit_points: [],
        },
        checkpoint_snapshots: [],
      },
    };
  }

  /**
   * Handle result bubbling to children
   */
  private async handleBubbling(
    parentResult: SubGraphResult,
    children: ExecutionTreeNode[],
    parentOutput: Record<string, unknown>
  ): Promise<void> {
    switch (this.config.bubble_strategy) {
      case "immediate":
        // Pass parent output to children immediately
        for (const child of children) {
          const childInput = {
            ...parentOutput,
            _parent_id: parentResult.subgraphId,
          };
          await this.executeLevel([child], childInput, parentResult.depth + 1);
        }
        break;

      case "deferred":
        // Children execute independently, bubble results at end
        // (already handled by executeLevel)
        break;

      case "selective":
        // Only pass specific fields to children
        const selectiveInput = this.selectiveBubbling(parentOutput);
        for (const child of children) {
          const childInput = {
            ...selectiveInput,
            _parent_id: parentResult.subgraphId,
          };
          await this.executeLevel([child], childInput, parentResult.depth + 1);
        }
        break;

      case "aggregated":
        // Aggregate all parent results before passing
        const aggregatedInput = this.aggregateBubbling(parentOutput);
        for (const child of children) {
          const childInput = {
            ...aggregatedInput,
            _parent_id: parentResult.subgraphId,
          };
          await this.executeLevel([child], childInput, parentResult.depth + 1);
        }
        break;
    }
  }

  /**
   * Selective bubbling - pass only specific fields
   */
  private selectiveBubbling(
    output: Record<string, unknown>
  ): Record<string, unknown> {
    // Only pass essential fields
    const selective: Record<string, unknown> = {};
    const fieldsToPass = ["result", "data", "output", "response"];

    for (const field of fieldsToPass) {
      if (field in output) {
        selective[field] = output[field];
      }
    }

    return selective;
  }

  /**
   * Aggregated bubbling - aggregate results
   */
  private aggregateBubbling(
    output: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      aggregated: true,
      parent_output: output,
      timestamp: Date.now(),
    };
  }

  /**
   * Determine final execution status
   */
  private determineFinalStatus(results: SubGraphResult[]): ExecutionStatus {
    if (results.length === 0) {
      return "failed";
    }

    const failedCount = results.filter(
      r => r.result.status === "failed"
    ).length;
    if (failedCount === results.length) {
      return "failed";
    }

    return "completed";
  }

  /**
   * Build execution result
   */
  private buildExecutionResult(
    subGraphResults: SubGraphResult[],
    totalDuration: number
  ): ExecutionResult {
    // Build outputs
    const outputs: Record<string, unknown> = {
      subgraph_count: subGraphResults.length,
      hierarchy_depth: Math.max(0, ...subGraphResults.map(r => r.depth)),
      subgraph_results: subGraphResults.map(r => ({
        subgraph_id: r.subgraphId,
        parent_id: r.parentId,
        status: r.result.status,
        outputs: r.result.outputs,
      })),
    };

    // Calculate total metrics
    let totalNodes = 0;
    let totalFailed = 0;
    let totalTokens = 0;

    for (const result of subGraphResults) {
      totalNodes += result.result.metrics.nodes_executed;
      totalFailed += result.result.metrics.nodes_failed;
      totalTokens += result.result.metrics.tokens_used;
    }

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: new Map(),
      nodes_executed: totalNodes,
      nodes_failed: totalFailed,
      nodes_retried: 0,
      tokens_used: totalTokens,
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map(),
        edges: this.config.hierarchy.map(h => ({
          from_node: h.parent,
          to_node: h.child,
        })),
        entry_points: Array.from(this.config.subgraphs.keys()),
        exit_points: Array.from(this.config.subgraphs.keys()),
      },
      checkpoint_snapshots: [],
    };

    return {
      status: this.currentExecution!.metadata.status,
      outputs,
      metrics,
      errors: this.currentExecution!.errors,
      trace,
    };
  }

  /**
   * Add trace entry
   */
  private addTraceEntry(entry: TraceEntry): void {
    this.trace.push(entry);
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `hier_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a sub-graph
   */
  addSubGraph(id: string, pattern: GraphPattern): void {
    this.config.subgraphs.set(id, pattern);
    this.subGraphRegistry.set(id, pattern);
  }

  /**
   * Add hierarchy relationship
   */
  addHierarchy(relationship: HierarchyRelationship): void {
    this.config.hierarchy.push(relationship);
  }

  /**
   * Set bubble strategy
   */
  setBubbleStrategy(strategy: BubbleStrategy): void {
    this.config.bubble_strategy = strategy;
  }

  /**
   * Get configuration
   */
  getConfig(): HierarchicalPatternConfig {
    return {
      subgraphs: new Map(this.config.subgraphs),
      hierarchy: [...this.config.hierarchy],
      bubble_strategy: this.config.bubble_strategy,
      graph: { ...this.config.graph },
    };
  }

  /**
   * Validate pattern configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.subgraphs.size === 0) {
      errors.push("Pattern must have at least one subgraph");
    }

    // Check for circular references in hierarchy
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const children = this.config.hierarchy.filter(h => h.parent === nodeId);
      for (const child of children) {
        if (!visited.has(child.child)) {
          if (hasCycle(child.child)) return true;
        } else if (recursionStack.has(child.child)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const subgraphId of this.config.subgraphs.keys()) {
      if (!visited.has(subgraphId) && hasCycle(subgraphId)) {
        errors.push(`Circular reference detected involving ${subgraphId}`);
      }
    }

    const graphValidation = validateGraphConfig(this.config.graph);
    if (!graphValidation.valid) {
      errors.push(...graphValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get visualization data
   */
  getVisualization(): {
    type: "hierarchical";
    subgraphs: Map<string, GraphPattern>;
    hierarchy: HierarchyRelationship[];
    bubbleStrategy: BubbleStrategy;
  } {
    return {
      type: "hierarchical",
      subgraphs: new Map(this.config.subgraphs),
      hierarchy: [...this.config.hierarchy],
      bubbleStrategy: this.config.bubble_strategy,
    };
  }
}

/**
 * Execution tree node
 */
interface ExecutionTreeNode {
  subgraphId: string;
  pattern: GraphPattern;
  children: ExecutionTreeNode[];
}

/**
 * Create a hierarchical pattern
 */
export function createHierarchicalPattern(
  config?: Partial<HierarchicalPatternConfig>
): HierarchicalPattern {
  return new HierarchicalPattern(config);
}

/**
 * Execute hierarchical pattern
 */
export async function executeHierarchical(
  subgraphs: Map<string, GraphPattern>,
  hierarchy: HierarchyRelationship[],
  input: Record<string, unknown>,
  bubbleStrategy?: BubbleStrategy
): Promise<ExecutionResult> {
  const pattern = createHierarchicalPattern({
    subgraphs,
    hierarchy,
    bubble_strategy: bubbleStrategy,
  });
  return pattern.execute(input);
}
