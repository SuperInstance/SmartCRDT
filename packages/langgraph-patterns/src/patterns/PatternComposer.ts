/**
 * @fileoverview Pattern Composer Implementation
 *
 * Combines multiple graph patterns into complex workflows with
 * pattern nesting, composition validation, and visualization support.
 */

import type {
  AgentNode,
  GraphPattern,
  GraphPatternInstance,
  GraphConfig,
  ExecutionResult,
  PatternComposition,
  ComposedPattern,
  EdgeConnection,
  CompositionConfig,
  CompositionPosition,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";
import { SequentialPattern } from "./SequentialPattern.js";
import { ParallelPattern } from "./ParallelPattern.js";
import { ConditionalPattern } from "./ConditionalPattern.js";
import { RecursivePattern } from "./RecursivePattern.js";
import { HierarchicalPattern } from "./HierarchicalPattern.js";
import { DynamicPattern } from "./DynamicPattern.js";

/**
 * Pattern Composer Class
 *
 * Composes multiple patterns into a unified workflow with
 * validation, visualization, and execution capabilities.
 */
export class PatternComposer {
  private composition: PatternComposition;
  private patternInstances = new Map<
    string,
    | SequentialPattern
    | ParallelPattern
    | ConditionalPattern
    | RecursivePattern
    | HierarchicalPattern
    | DynamicPattern
  >();

  constructor(config?: Partial<CompositionConfig>) {
    this.composition = {
      id: this.generateCompositionId(),
      patterns: [],
      connections: [],
      config: {
        validate: config?.validate ?? true,
        enable_visualization: config?.enable_visualization ?? true,
        max_depth: config?.max_depth ?? 5,
        graph: config?.graph || DEFAULT_GRAPH_CONFIG,
      },
    };
  }

  /**
   * Add a pattern to the composition
   *
   * @param pattern - Pattern instance to add
   * @param position - Position in composition
   * @param isEntry - Whether this is an entry point
   * @param isExit - Whether this is an exit point
   */
  addPattern(
    pattern: GraphPatternInstance,
    position?: Partial<CompositionPosition>,
    isEntry = false,
    isExit = false
  ): void {
    const composedPattern: ComposedPattern = {
      type: pattern.type,
      pattern,
      position: {
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        layer: position?.layer ?? 0,
      },
      is_entry: isEntry,
      is_exit: isExit,
    };

    this.composition.patterns.push(composedPattern);

    // Create pattern instance for execution
    this.createPatternInstance(pattern);
  }

  /**
   * Connect two patterns
   *
   * @param fromPatternId - Source pattern ID
   * @param toPatternId - Target pattern ID
   * @param condition - Optional condition for connection
   */
  connect(
    fromPatternId: string,
    toPatternId: string,
    condition?: EdgeConnection["condition"]
  ): void {
    const connection: EdgeConnection = {
      from_node: fromPatternId,
      to_node: toPatternId,
      condition,
    };

    this.composition.connections.push(connection);
  }

  /**
   * Execute the composed pattern
   *
   * @param initialInput - Initial input to the composition
   * @returns Execution result from all patterns
   */
  async execute(
    initialInput: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Validate if enabled
    if (this.composition.config.validate) {
      const validation = this.validate();
      if (!validation.valid) {
        throw new Error(`Invalid composition: ${validation.errors.join(", ")}`);
      }
    }

    // Find entry points
    const entryPatterns = this.composition.patterns.filter(p => p.is_entry);

    // Execute patterns in order
    const results: ExecutionResult[] = [];
    let currentInput = { ...initialInput };

    // Build execution order from connections
    const executionOrder = this.buildExecutionOrder();

    for (const patternRef of executionOrder) {
      const composedPattern = this.composition.patterns.find(
        p => p.pattern.type === patternRef.type
      );

      if (!composedPattern) continue;

      // Get pattern instance
      const instance = this.patternInstances.get(
        this.getPatternKey(composedPattern.pattern)
      );

      if (!instance) {
        throw new Error(
          `Pattern instance not found: ${composedPattern.pattern.type}`
        );
      }

      // Execute the pattern
      try {
        const result = await this.executePattern(instance, currentInput);
        results.push(result);

        // Merge output for next pattern
        currentInput = this.mergeOutput(
          currentInput,
          result.outputs as Record<string, unknown>
        );
      } catch (error) {
        // Continue execution on error
        console.error(`Pattern execution error: ${error}`);
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Build aggregated result
    return this.buildAggregatedResult(results, totalDuration);
  }

  /**
   * Build execution order from connections
   */
  private buildExecutionOrder(): ComposedPattern[] {
    const order: ComposedPattern[] = [];
    const visited = new Set<string>();

    // Start with entry points
    const entryPoints = this.composition.patterns.filter(p => p.is_entry);

    for (const entry of entryPoints) {
      this.visitPattern(entry, visited, order);
    }

    // Add any unvisited patterns
    for (const pattern of this.composition.patterns) {
      const key = this.getPatternKey(pattern.pattern);
      if (!visited.has(key)) {
        order.push(pattern);
      }
    }

    return order;
  }

  /**
   * Visit pattern recursively (topological sort)
   */
  private visitPattern(
    pattern: ComposedPattern,
    visited: Set<string>,
    order: ComposedPattern[]
  ): void {
    const key = this.getPatternKey(pattern.pattern);

    if (visited.has(key)) return;
    visited.add(key);

    // Find connected patterns (children)
    const children = this.composition.connections
      .filter(c => c.from_node === key)
      .map(c =>
        this.composition.patterns.find(
          p => this.getPatternKey(p.pattern) === c.to_node
        )
      )
      .filter((p): p is ComposedPattern => p !== undefined);

    // Visit children first
    for (const child of children) {
      this.visitPattern(child, visited, order);
    }

    // Add this pattern to order
    order.push(pattern);
  }

  /**
   * Execute a pattern instance
   */
  private async executePattern(
    instance:
      | SequentialPattern
      | ParallelPattern
      | ConditionalPattern
      | RecursivePattern
      | HierarchicalPattern
      | DynamicPattern,
    input: Record<string, unknown>
  ): Promise<ExecutionResult> {
    if ("execute" in instance) {
      return instance.execute(input as Record<string, unknown>);
    }
    throw new Error("Pattern instance does not have execute method");
  }

  /**
   * Merge output with input
   */
  private mergeOutput(
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...input,
      ...output,
      _merged_at: Date.now(),
    };
  }

  /**
   * Build aggregated result from all pattern results
   */
  private buildAggregatedResult(
    results: ExecutionResult[],
    totalDuration: number
  ): ExecutionResult {
    // Aggregate outputs
    const outputs: Record<string, unknown> = {
      pattern_count: results.length,
      patterns: results.map((r, i) => ({
        index: i,
        status: r.status,
        outputs: r.outputs,
      })),
    };

    // Aggregate metrics
    const failedCount = results.filter(r => r.status === "failed").length;
    const totalNodes = results.reduce(
      (sum, r) => sum + r.metrics.nodes_executed,
      0
    );
    const totalErrors = results.reduce(
      (sum, r) => sum + r.metrics.nodes_failed,
      0
    );

    const metrics = {
      total_time: totalDuration,
      node_times: new Map(),
      nodes_executed: totalNodes,
      nodes_failed: totalErrors,
      nodes_retried: 0,
      tokens_used: results.reduce((sum, r) => sum + r.metrics.tokens_used, 0),
      memory_used: 0,
      cache_hit_rate: 0,
    };

    // Aggregate errors
    const errors = results.flatMap(r => r.errors);

    // Determine status
    const status =
      failedCount === results.length
        ? "failed"
        : failedCount > 0
          ? "completed"
          : "completed";

    return {
      status,
      outputs,
      metrics,
      errors,
      trace: {
        entries: [],
        initial_topology: {
          nodes: new Map(),
          edges: this.composition.connections,
          entry_points: this.composition.patterns
            .filter(p => p.is_entry)
            .map(p => this.getPatternKey(p.pattern)),
          exit_points: this.composition.patterns
            .filter(p => p.is_exit)
            .map(p => this.getPatternKey(p.pattern)),
        },
        checkpoint_snapshots: [],
      },
    };
  }

  /**
   * Create pattern instance for execution
   */
  private createPatternInstance(pattern: GraphPatternInstance): void {
    const key = this.getPatternKey(pattern);

    switch (pattern.type) {
      case "sequential":
        this.patternInstances.set(key, new SequentialPattern());
        break;
      case "parallel":
        this.patternInstances.set(key, new ParallelPattern());
        break;
      case "conditional":
        this.patternInstances.set(key, new ConditionalPattern());
        break;
      case "recursive":
        this.patternInstances.set(
          key,
          new RecursivePattern(pattern.config as any)
        );
        break;
      case "hierarchical":
        this.patternInstances.set(
          key,
          new HierarchicalPattern(pattern.config as any)
        );
        break;
      case "dynamic":
        this.patternInstances.set(
          key,
          new DynamicPattern(pattern.config as any)
        );
        break;
    }
  }

  /**
   * Get pattern key for mapping
   */
  private getPatternKey(pattern: GraphPatternInstance): string {
    return `${pattern.type}_${pattern.nodes.length}_${pattern.edges.length}`;
  }

  /**
   * Validate the composition
   */
  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for at least one pattern
    if (this.composition.patterns.length === 0) {
      errors.push("Composition must have at least one pattern");
    }

    // Check for entry points
    const hasEntry = this.composition.patterns.some(p => p.is_entry);
    if (!hasEntry) {
      warnings.push("No entry points defined");
    }

    // Check for exit points
    const hasExit = this.composition.patterns.some(p => p.is_exit);
    if (!hasExit) {
      warnings.push("No exit points defined");
    }

    // Check for circular connections
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const children = this.composition.connections
        .filter(c => c.from_node === nodeId)
        .map(c => c.to_node);

      for (const child of children) {
        if (!visited.has(child)) {
          if (hasCycle(child)) return true;
        } else if (recursionStack.has(child)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const pattern of this.composition.patterns) {
      const key = this.getPatternKey(pattern.pattern);
      if (!visited.has(key) && hasCycle(key)) {
        errors.push(`Circular reference detected involving ${key}`);
      }
    }

    // Check depth
    const maxDepth = this.calculateMaxDepth();
    if (maxDepth > this.composition.config.max_depth) {
      warnings.push(
        `Composition depth (${maxDepth}) exceeds configured max (${this.composition.config.max_depth})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate maximum depth of composition
   */
  private calculateMaxDepth(): number {
    let maxDepth = 0;

    for (const pattern of this.composition.patterns) {
      const depth = this.calculatePatternDepth(pattern, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Calculate pattern depth recursively
   */
  private calculatePatternDepth(
    pattern: ComposedPattern,
    visited: Set<string>
  ): number {
    const key = this.getPatternKey(pattern.pattern);
    if (visited.has(key)) return 0;
    visited.add(key);

    const children = this.composition.connections
      .filter(c => c.from_node === key)
      .map(c =>
        this.composition.patterns.find(
          p => this.getPatternKey(p.pattern) === c.to_node
        )
      )
      .filter((p): p is ComposedPattern => p !== undefined);

    if (children.length === 0) return 1;

    const childDepths = children.map(c =>
      this.calculatePatternDepth(c, visited)
    );
    return 1 + Math.max(0, ...childDepths);
  }

  /**
   * Generate visualization data
   */
  getVisualization(): {
    composition: PatternComposition;
    graph: {
      nodes: Array<{
        id: string;
        type: GraphPattern;
        position: CompositionPosition;
        isEntry: boolean;
        isExit: boolean;
      }>;
      edges: Array<{ from: string; to: string; condition?: string }>;
    };
  } {
    const nodes = this.composition.patterns.map(p => ({
      id: this.getPatternKey(p.pattern),
      type: p.pattern.type,
      position: p.position,
      isEntry: p.is_entry,
      isExit: p.is_exit,
    }));

    const edges = this.composition.connections.map(c => ({
      from: c.from_node,
      to: c.to_node,
      condition: c.condition?.expression,
    }));

    return {
      composition: this.composition,
      graph: { nodes, edges },
    };
  }

  /**
   * Generate composition ID
   */
  private generateCompositionId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get composition
   */
  getComposition(): PatternComposition {
    return { ...this.composition };
  }

  /**
   * Clear composition
   */
  clear(): void {
    this.composition.patterns = [];
    this.composition.connections = [];
    this.patternInstances.clear();
  }

  /**
   * Remove pattern from composition
   */
  removePattern(patternKey: string): void {
    this.composition.patterns = this.composition.patterns.filter(
      p => this.getPatternKey(p.pattern) !== patternKey
    );
    this.composition.connections = this.composition.connections.filter(
      c => c.from_node !== patternKey && c.to_node !== patternKey
    );
    this.patternInstances.delete(patternKey);
  }

  /**
   * Update pattern configuration
   */
  updatePatternConfig(patternKey: string, config: unknown): void {
    const pattern = this.composition.patterns.find(
      p => this.getPatternKey(p.pattern) === patternKey
    );

    if (pattern) {
      pattern.pattern.config = config;
      // Recreate instance with new config
      this.createPatternInstance(pattern.pattern);
    }
  }

  /**
   * Export composition as JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        composition: this.composition,
        visualization: this.getVisualization(),
      },
      null,
      2
    );
  }

  /**
   * Import composition from JSON
   */
  importJSON(json: string): void {
    const data = JSON.parse(json);
    this.composition = data.composition;

    // Recreate pattern instances
    for (const pattern of this.composition.patterns) {
      this.createPatternInstance(pattern.pattern);
    }
  }
}

/**
 * Create a pattern composer
 */
export function createPatternComposer(
  config?: Partial<CompositionConfig>
): PatternComposer {
  return new PatternComposer(config);
}

/**
 * Compose and execute patterns
 */
export async function composeAndExecute(
  patterns: GraphPatternInstance[],
  connections: EdgeConnection[],
  input: Record<string, unknown>
): Promise<ExecutionResult> {
  const composer = createPatternComposer();

  for (const pattern of patterns) {
    composer.addPattern(
      pattern,
      undefined,
      pattern === patterns[0],
      pattern === patterns[patterns.length - 1]
    );
  }

  for (const conn of connections) {
    composer.connect(conn.from_node, conn.to_node, conn.condition);
  }

  return composer.execute(input);
}
