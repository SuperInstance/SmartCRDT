/**
 * Graph Optimizer
 * Optimizes computation graphs through operator fusion, dead code elimination,
 * constant folding, and layout transformations
 */

import type {
  GraphOptimizerConfig,
  GraphOptimizationResult,
  OptimizedGraph,
  GraphNode,
  GraphEdge,
  Optimization,
  FusionGroup,
} from "../types.js";

export class GraphOptimizer {
  private config: GraphOptimizerConfig;
  private optimizations: Optimization[] = [];

  constructor(config: Partial<GraphOptimizerConfig> = {}) {
    this.config = {
      fuseOperators: true,
      eliminateDeadCode: true,
      foldConstants: true,
      optimizeLayout: true,
      targetLatency: 50,
      maxIterations: 100,
      ...config,
    };
  }

  /**
   * Optimize a computation graph
   */
  optimize(graph: ComputationGraph): GraphOptimizationResult {
    const originalLatency = this.estimateLatency(graph);
    let optimizedGraph = { ...graph };

    this.optimizations = [];

    // Step 1: Constant folding
    if (this.config.foldConstants) {
      optimizedGraph = this.foldConstants(optimizedGraph);
    }

    // Step 2: Dead code elimination
    if (this.config.eliminateDeadCode) {
      optimizedGraph = this.eliminateDeadCode(optimizedGraph);
    }

    // Step 3: Operator fusion
    if (this.config.fuseOperators) {
      optimizedGraph = this.fuseOperators(optimizedGraph);
    }

    // Step 4: Layout optimization
    if (this.config.optimizeLayout) {
      optimizedGraph = this.optimizeLayout(optimizedGraph);
    }

    const optimizedLatency = this.estimateLatency(optimizedGraph);
    const speedup = originalLatency / optimizedLatency;
    const fusionGroups = this.extractFusionGroups(optimizedGraph);

    return {
      originalLatency,
      optimizedLatency,
      speedup,
      optimizations: this.optimizations,
      graph: this.convertToOptimizedGraph(optimizedGraph),
      fusionGroups,
    };
  }

  /**
   * Validate optimized graph
   */
  validate(original: ComputationGraph, optimized: ComputationGraph): boolean {
    // Check that outputs are preserved
    const originalOutputs = this.getOutputNodes(original);
    const optimizedOutputs = this.getOutputNodes(optimized);

    if (originalOutputs.length !== optimizedOutputs.length) {
      return false;
    }

    // Check that all required operations are present (possibly fused)
    const originalOps = new Set(original.nodes.map(n => n.operation));
    const optimizedOps = new Set();

    for (const node of optimized.nodes) {
      if (node.fused) {
        for (const fusedId of node.fused) {
          const fusedNode = original.nodes.find(n => n.id === fusedId);
          if (fusedNode) {
            optimizedOps.add(fusedNode.operation);
          }
        }
      }
      optimizedOps.add(node.operation);
    }

    // All critical operations should be present
    const criticalOps = new Set([
      "matmul",
      "conv2d",
      "attention",
      "layer_norm",
    ]);
    for (const op of criticalOps) {
      if (originalOps.has(op) && !optimizedOps.has(op)) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // OPTIMIZATION PASS: CONSTANT FOLDING
  // ============================================================================

  private foldConstants(graph: ComputationGraph): ComputationGraph {
    const constantNodes = new Set<string>();
    const foldedNodes = new Set<string>();

    // Find constant nodes (no inputs or all inputs are constants)
    for (const node of graph.nodes) {
      if (this.isConstant(node, graph)) {
        constantNodes.add(node.id);
      }
    }

    // Fold constant operations
    for (const nodeId of constantNodes) {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node || foldedNodes.has(nodeId)) continue;

      const result = this.evaluateConstant(node, graph);
      if (result !== null) {
        foldedNodes.add(nodeId);
        this.optimizations.push({
          type: "constant_folding",
          description: `Folded constant operation: ${node.name}`,
          impact: 1, // Small savings per operation
          confidence: 0.95,
        });
      }
    }

    return graph;
  }

  private isConstant(node: GraphNodeInput, graph: ComputationGraph): boolean {
    if (node.operation === "constant") return true;

    // Check if all inputs are constants
    for (const inputId of node.inputs) {
      const inputNode = graph.nodes.find(n => n.id === inputId);
      if (!inputNode || inputNode.operation !== "constant") {
        return false;
      }
    }

    return true;
  }

  private evaluateConstant(
    node: GraphNodeInput,
    graph: ComputationGraph
  ): unknown | null {
    // Simplified constant evaluation
    switch (node.operation) {
      case "add":
      case "mul":
      case "sub":
      case "div":
        return true; // Placeholder for actual evaluation
      default:
        return null;
    }
  }

  // ============================================================================
  // OPTIMIZATION PASS: DEAD CODE ELIMINATION
  // ============================================================================

  private eliminateDeadCode(graph: ComputationGraph): ComputationGraph {
    const liveNodes = new Set<string>();

    // Mark output nodes as live
    for (const node of graph.nodes) {
      if (node.outputs.length === 0) {
        liveNodes.add(node.id);
      }
    }

    // Backward propagation: mark nodes that feed live nodes
    const changed = new Set(liveNodes);
    while (changed.size > 0) {
      const nodeId = Array.from(changed)[0];
      changed.delete(nodeId);

      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      for (const inputId of node.inputs) {
        if (!liveNodes.has(inputId)) {
          liveNodes.add(inputId);
          changed.add(inputId);
        }
      }
    }

    // Remove dead nodes
    const deadNodes = graph.nodes.filter(n => !liveNodes.has(n.id));
    if (deadNodes.length > 0) {
      this.optimizations.push({
        type: "dead_code_elimination",
        description: `Removed ${deadNodes.length} dead operations`,
        impact: deadNodes.length * 0.5,
        confidence: 1.0,
      });
    }

    return {
      ...graph,
      nodes: graph.nodes.filter(n => liveNodes.has(n.id)),
    };
  }

  // ============================================================================
  // OPTIMIZATION PASS: OPERATOR FUSION
  // ============================================================================

  private fuseOperators(graph: ComputationGraph): ComputationGraph {
    const fusedNodes = new Set<string>();
    const fusionGroups: FusionGroup[] = [];

    // Find fusible operation sequences
    for (const node of graph.nodes) {
      if (fusedNodes.has(node.id)) continue;

      const group = this.findFusionGroup(node, graph, fusedNodes);
      if (group.length > 1) {
        fusionGroups.push({
          operations: group.map(n => n.name),
          estimatedSpeedup: group.length * 0.8,
          memorySaved: group.length * 0.1,
        });

        // Create fused node
        const fusedNode = this.createFusedNode(group);
        const newNodes = graph.nodes.filter(n => !group.includes(n));
        newNodes.push(fusedNode);

        for (const n of group) {
          fusedNodes.add(n.id);
        }

        this.optimizations.push({
          type: "operator_fusion",
          description: `Fused ${group.length} operations: ${group.map(n => n.name).join(", ")}`,
          impact: group.length * 2,
          confidence: 0.85,
        });

        graph = { ...graph, nodes: newNodes };
      }
    }

    return graph;
  }

  private findFusionGroup(
    start: GraphNodeInput,
    graph: ComputationGraph,
    fusedNodes: Set<string>
  ): GraphNodeInput[] {
    const group: GraphNodeInput[] = [start];
    const visited = new Set<string>([start.id]);

    // Forward traversal: find fusible successors
    let current = start;
    while (true) {
      const successors = graph.nodes.filter(
        n => current.outputs.includes(n.id) || n.inputs.includes(current.id)
      );

      if (successors.length !== 1) break;
      const successor = successors[0];

      if (
        fusedNodes.has(successor.id) ||
        visited.has(successor.id) ||
        !this.canFuse(current, successor)
      ) {
        break;
      }

      group.push(successor);
      visited.add(successor.id);
      current = successor;
    }

    return group.length > 1 ? group : [];
  }

  private canFuse(node1: GraphNodeInput, node2: GraphNodeInput): boolean {
    // Fusion rules
    const fusiblePairs = [
      ["conv2d", "bias_add"],
      ["conv2d", "relu"],
      ["conv2d", "batch_norm"],
      ["matmul", "bias_add"],
      ["matmul", "relu"],
      ["matmul", "gelu"],
      ["layer_norm", "dropout"],
      ["add", "relu"],
      ["mul", "relu"],
    ];

    return fusiblePairs.some(
      ([op1, op2]) =>
        (node1.operation === op1 && node2.operation === op2) ||
        (node1.operation === op2 && node2.operation === op1)
    );
  }

  private createFusedNode(nodes: GraphNodeInput[]): GraphNodeInput {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    return {
      id: `fused_${first.id}`,
      name: `fused_${nodes.map(n => n.operation).join("_")}`,
      operation: `fused_${nodes.length}`,
      inputs: first.inputs,
      outputs: last.outputs,
      attributes: {
        fusedOperations: nodes.map(n => n.operation),
        fusedNodeIds: nodes.map(n => n.id),
      },
      fused: nodes.map(n => n.id),
    };
  }

  // ============================================================================
  // OPTIMIZATION PASS: LAYOUT OPTIMIZATION
  // ============================================================================

  private optimizeLayout(graph: ComputationGraph): ComputationGraph {
    let layoutChanges = 0;

    for (const node of graph.nodes) {
      const optimalLayout = this.selectOptimalLayout(node, graph);
      if (optimalLayout !== node.attributes.layout) {
        layoutChanges++;
        node.attributes.layout = optimalLayout;
      }
    }

    if (layoutChanges > 0) {
      this.optimizations.push({
        type: "layout_transformation",
        description: `Optimized memory layout for ${layoutChanges} operations`,
        impact: layoutChanges * 0.5,
        confidence: 0.7,
      });
    }

    return graph;
  }

  private selectOptimalLayout(
    node: GraphNodeInput,
    graph: ComputationGraph
  ): string {
    // Layout selection based on operation type
    switch (node.operation) {
      case "conv2d":
        return "nhwc"; // Optimal for GPU convolutions
      case "matmul":
        return "col_major"; // Better cache locality
      case "layer_norm":
        return "row_major";
      default:
        return node.attributes.layout || "default";
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private estimateLatency(graph: ComputationGraph): number {
    // Simplified latency estimation
    const operationCosts: Record<string, number> = {
      matmul: 10,
      conv2d: 15,
      attention: 20,
      layer_norm: 2,
      relu: 0.5,
      gelu: 1,
      add: 0.5,
      mul: 0.5,
      softmax: 3,
    };

    let total = 0;
    for (const node of graph.nodes) {
      const baseCost = operationCosts[node.operation] || 1;
      const complexity = this.estimateComplexity(node);
      total += baseCost * complexity;
    }

    return total;
  }

  private estimateComplexity(node: GraphNodeInput): number {
    // Estimate based on output size
    const outputShape = node.attributes.outputShape as number[] | undefined;
    if (!outputShape) return 1;

    const elements = outputShape.reduce((a, b) => a * b, 1);
    return Math.log10(elements + 1);
  }

  private extractFusionGroups(graph: ComputationGraph): FusionGroup[] {
    return graph.nodes
      .filter(n => n.fused && n.fused.length > 0)
      .map(node => ({
        operations: node.fused || [],
        estimatedSpeedup: (node.fused?.length || 0) * 0.8,
        memorySaved: (node.fused?.length || 0) * 0.1,
      }));
  }

  private convertToOptimizedGraph(graph: ComputationGraph): OptimizedGraph {
    const edges: GraphEdge[] = [];

    for (const node of graph.nodes) {
      for (const inputId of node.inputs) {
        const inputNode = graph.nodes.find(n => n.id === inputId);
        if (inputNode) {
          edges.push({
            source: inputId,
            target: node.id,
            tensorShape: (node.attributes.outputShape as number[]) || [],
            dataType: (node.attributes.dataType as string) || "float32",
          });
        }
      }
    }

    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        type: n.operation,
        inputs: n.inputs,
        outputs: n.outputs,
        attributes: n.attributes,
        fused: n.fused,
      })),
      edges,
      metadata: {
        originalNodes: 0, // Would be tracked separately
        optimizedNodes: graph.nodes.length,
        reduction: 0,
      },
    };
  }

  private getOutputNodes(graph: ComputationGraph): GraphNodeInput[] {
    return graph.nodes.filter(n => n.outputs.length === 0);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ComputationGraph {
  nodes: GraphNodeInput[];
  inputs: string[];
  outputs: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphNodeInput {
  id: string;
  name: string;
  operation: string;
  inputs: string[];
  outputs: string[];
  attributes: Record<string, unknown>;
  fused?: string[];
}

// ============================================================================
// FUSION ANALYZER
// ============================================================================

export interface FusionOpportunity {
  operations: string[];
  benefit: number;
  memorySaved: number;
  confidence: number;
}

export class FusionAnalyzer {
  /**
   * Find all fusion opportunities in a graph
   */
  findOpportunities(graph: ComputationGraph): FusionOpportunity[] {
    const opportunities: FusionOpportunity[] = [];
    const visited = new Set<string>();

    for (const node of graph.nodes) {
      if (visited.has(node.id)) continue;

      const opportunity = this.analyzeFusion(node, graph, visited);
      if (opportunity && opportunity.operations.length > 1) {
        opportunities.push(opportunity);
      }
    }

    return opportunities.sort((a, b) => b.benefit - a.benefit);
  }

  private analyzeFusion(
    start: GraphNodeInput,
    graph: ComputationGraph,
    visited: Set<string>
  ): FusionOpportunity | null {
    const operations: string[] = [start.operation];
    const ids = new Set([start.id]);
    let current = start;

    while (true) {
      const successors = graph.nodes.filter(n =>
        current.outputs.includes(n.id)
      );

      if (successors.length !== 1) break;

      const successor = successors[0];
      if (ids.has(successor.id) || !this.isFusible(current, successor)) {
        break;
      }

      operations.push(successor.operation);
      ids.add(successor.id);
      current = successor;
    }

    if (operations.length <= 1) return null;

    for (const id of ids) {
      visited.add(id);
    }

    return {
      operations,
      benefit: operations.length * 1.5,
      memorySaved: operations.length * 0.2,
      confidence: 0.85,
    };
  }

  private isFusible(node1: GraphNodeInput, node2: GraphNodeInput): boolean {
    const fusibleOps = [
      "conv2d",
      "bias_add",
      "relu",
      "gelu",
      "batch_norm",
      "matmul",
    ];

    return (
      fusibleOps.includes(node1.operation) &&
      fusibleOps.includes(node2.operation)
    );
  }
}
