/**
 * @fileoverview Parallel Pattern Implementation
 *
 * Executes multiple agents simultaneously with fan-out/fan-in coordination.
 * Supports various result merging strategies and error aggregation.
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
  ParallelPatternConfig,
  MergeStrategy,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";

/**
 * Result from parallel node execution
 */
interface ParallelNodeResult {
  nodeId: string;
  output: Record<string, unknown>;
  error?: ExecutionError;
  duration: number;
  success: boolean;
}

/**
 * Parallel Pattern Class
 *
 * Executes multiple agent nodes concurrently with configurable
 * parallelism limits and result merging strategies.
 */
export class ParallelPattern {
  private config: ParallelPatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];

  constructor(config: Partial<ParallelPatternConfig> = {}) {
    this.config = {
      nodes: config.nodes || [],
      merge_strategy: config.merge_strategy || "merge",
      wait_for_all: config.wait_for_all ?? true,
      min_required: config.min_required,
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };

    // Set default min_required if wait_for_all is true
    if (this.config.wait_for_all && this.config.min_required === undefined) {
      this.config.min_required = this.config.nodes.length;
    }
  }

  /**
   * Execute the parallel pattern
   *
   * @param initialInput - Input to all nodes
   * @returns Execution result with merged outputs
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
        nodes_remaining: this.config.nodes.length,
        status: "running",
      },
      state: { ...initialInput },
    };

    this.trace = [];

    // Execute nodes in parallel with limited concurrency
    const results = await this.executeNodesParallel(initialInput);

    // Merge results based on strategy
    const mergedOutput = this.mergeResults(results);

    // Update errors from failed nodes
    for (const result of results) {
      if (result.error) {
        this.currentExecution.errors.push(result.error);
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Update metadata
    this.currentExecution.metadata.ended_at = endTime;
    this.currentExecution.metadata.duration = totalDuration;
    this.currentExecution.metadata.status = this.determineFinalStatus(results);

    // Build execution result
    return this.buildExecutionResult(results, totalDuration, mergedOutput);
  }

  /**
   * Execute nodes in parallel with limited concurrency
   */
  private async executeNodesParallel(
    input: Record<string, unknown>
  ): Promise<ParallelNodeResult[]> {
    const results: ParallelNodeResult[] = [];
    const maxParallelism = Math.min(
      this.config.graph.max_parallelism,
      this.config.nodes.length
    );

    // Process nodes in batches
    for (let i = 0; i < this.config.nodes.length; i += maxParallelism) {
      const batch = this.config.nodes.slice(i, i + maxParallelism);
      const batchResults = await Promise.allSettled(
        batch.map(node => this.executeNode(node, input))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const node = batch[j];
        const result = batchResults[j];

        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            nodeId: node.agent_id,
            output: {},
            error: {
              node_id: node.agent_id,
              message: result.reason?.message || String(result.reason),
              timestamp: Date.now(),
              recoverable: true,
            },
            duration: 0,
            success: false,
          });
        }

        // Check if we have enough successful results
        if (this.config.min_required !== undefined) {
          const successfulCount = results.filter(r => r.success).length;
          if (
            successfulCount >= this.config.min_required &&
            !this.config.wait_for_all
          ) {
            // Cancel remaining executions if we don't need to wait
            break;
          }
        }
      }

      // Check if we have minimum required results
      if (this.config.min_required !== undefined) {
        const successfulCount = results.filter(r => r.success).length;
        if (successfulCount < this.config.min_required) {
          // Not enough successful results, stop processing
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: AgentNode,
    input: Record<string, unknown>
  ): Promise<ParallelNodeResult> {
    const nodeStart = Date.now();

    // Add trace entry for node entry
    this.addTraceEntry({
      timestamp: nodeStart,
      node_id: node.agent_id,
      operation: "enter",
      input,
    });

    try {
      // Execute with timeout
      const timeout = node.config.timeout || this.config.graph.timeout;
      const output = await Promise.race([
        this.executeNodeLogic(node, input),
        this.createTimeoutPromise(timeout, node.agent_id),
      ]);

      const nodeEnd = Date.now();
      const duration = nodeEnd - nodeStart;

      // Add trace entry for node exit
      this.addTraceEntry({
        timestamp: nodeEnd,
        node_id: node.agent_id,
        operation: "exit",
        output,
        duration,
      });

      // Update execution state
      this.currentExecution!.outputs.set(node.agent_id, output);
      this.currentExecution!.metadata.nodes_executed++;
      this.currentExecution!.current_path.push(node.agent_id);

      return {
        nodeId: node.agent_id,
        output,
        duration,
        success: true,
      };
    } catch (error) {
      const nodeEnd = Date.now();
      const duration = nodeEnd - nodeStart;

      const execError: ExecutionError = {
        node_id: node.agent_id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: nodeEnd,
        recoverable: this.isRecoverableError(error),
      };

      // Add trace entry for error
      this.addTraceEntry({
        timestamp: nodeEnd,
        node_id: node.agent_id,
        operation: "error",
        error: execError.message,
        duration,
      });

      return {
        nodeId: node.agent_id,
        output: {},
        error: execError,
        duration,
        success: false,
      };
    }
  }

  /**
   * Execute node logic (placeholder)
   */
  private async executeNodeLogic(
    node: AgentNode,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Simulate node execution
    const processingTime = Math.random() * 100 + 50;
    await new Promise(resolve => setTimeout(resolve, processingTime));

    return {
      agent_id: node.agent_id,
      timestamp: Date.now(),
      success: true,
      result: {
        text: `Response from ${node.name || node.agent_id}`,
        confidence: Math.random() * 0.3 + 0.7,
        tokens_used: Math.floor(Math.random() * 100 + 50),
      },
    };
  }

  /**
   * Merge results based on strategy
   */
  private mergeResults(results: ParallelNodeResult[]): Record<string, unknown> {
    const successfulResults = results.filter(r => r.success);

    switch (this.config.merge_strategy) {
      case "concat":
        return this.mergeConcat(successfulResults);
      case "merge":
        return this.mergeDeep(successfulResults);
      case "first":
        return successfulResults[0]?.output || {};
      case "majority":
        return this.mergeMajority(successfulResults);
      case "custom":
        return this.mergeCustom(successfulResults);
      default:
        return this.mergeDeep(successfulResults);
    }
  }

  /**
   * Concatenate all results
   */
  private mergeConcat(results: ParallelNodeResult[]): Record<string, unknown> {
    const outputs = results.map(r => r.output);
    return {
      results: outputs,
      count: outputs.length,
      merged_at: Date.now(),
    };
  }

  /**
   * Deep merge all results
   */
  private mergeDeep(results: ParallelNodeResult[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const result of results) {
      Object.assign(merged, result.output);
    }
    merged.merged_at = Date.now();
    merged.node_count = results.length;
    return merged;
  }

  /**
   * Use first successful result
   */
  private mergeFirst(results: ParallelNodeResult[]): Record<string, unknown> {
    return results[0]?.output || {};
  }

  /**
   * Use majority result (mock implementation)
   */
  private mergeMajority(
    results: ParallelNodeResult[]
  ): Record<string, unknown> {
    // For simplicity, return the result from the node that finished first
    const sorted = [...results].sort((a, b) => a.duration - b.duration);
    return sorted[0]?.output || {};
  }

  /**
   * Custom merge (can be overridden)
   */
  private mergeCustom(results: ParallelNodeResult[]): Record<string, unknown> {
    // Default custom merge: average confidence values
    const outputs = results.map(r => r.output);
    const merged: Record<string, unknown> = {
      custom_merge: true,
      source_count: outputs.length,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const output of outputs) {
      if (typeof output === "object" && output !== null) {
        const result = output as { confidence?: number };
        if (result.confidence !== undefined) {
          totalConfidence += result.confidence;
          confidenceCount++;
        }
      }
    }

    if (confidenceCount > 0) {
      merged.average_confidence = totalConfidence / confidenceCount;
    }

    return merged;
  }

  /**
   * Determine final execution status
   */
  private determineFinalStatus(results: ParallelNodeResult[]): ExecutionStatus {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (successCount === 0) {
      return "failed";
    }

    if (this.config.min_required !== undefined) {
      if (successCount >= this.config.min_required) {
        return failureCount > 0 ? "completed" : "completed";
      }
      return "failed";
    }

    if (this.config.wait_for_all && failureCount > 0) {
      return failureCount === results.length ? "failed" : "completed";
    }

    return "completed";
  }

  /**
   * Build execution result
   */
  private buildExecutionResult(
    results: ParallelNodeResult[],
    totalDuration: number,
    mergedOutput: Record<string, unknown>
  ): ExecutionResult {
    const nodeTimes = new Map<string, number>();
    for (const result of results) {
      nodeTimes.set(result.nodeId, result.duration);
    }

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: nodeTimes,
      nodes_executed: this.currentExecution!.metadata.nodes_executed,
      nodes_failed: results.filter(r => !r.success).length,
      nodes_retried: 0,
      tokens_used: this.calculateTotalTokens(mergedOutput),
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map(this.config.nodes.map(n => [n.agent_id, n])),
        edges: [],
        entry_points: this.config.nodes.map(n => n.agent_id),
        exit_points: this.config.nodes.map(n => n.agent_id),
      },
      checkpoint_snapshots: [],
    };

    return {
      status: this.currentExecution!.metadata.status,
      outputs: mergedOutput,
      metrics,
      errors: this.currentExecution!.errors,
      trace,
    };
  }

  /**
   * Calculate total tokens used
   */
  private calculateTotalTokens(output: Record<string, unknown>): number {
    if (typeof output === "object" && output !== null) {
      const result = output as { tokens_used?: number };
      return result.tokens_used || 0;
    }
    return 0;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      const recoverablePatterns = /network|timeout|rate limit|temporary/i;
      return recoverablePatterns.test(error.message);
    }
    return false;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(
    timeout: number,
    nodeId: string
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Node ${nodeId} timed out after ${timeout}ms`));
      }, timeout);
    });
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
    return `par_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a node to the pattern
   */
  addNode(node: AgentNode): void {
    const validation = validateAgentNode(node);
    if (!validation.valid) {
      throw new Error(`Invalid node: ${validation.errors.join(", ")}`);
    }
    this.config.nodes.push(node);
  }

  /**
   * Remove a node from the pattern
   */
  removeNode(nodeId: string): void {
    this.config.nodes = this.config.nodes.filter(n => n.agent_id !== nodeId);
  }

  /**
   * Set merge strategy
   */
  setMergeStrategy(strategy: MergeStrategy): void {
    this.config.merge_strategy = strategy;
  }

  /**
   * Get configuration
   */
  getConfig(): ParallelPatternConfig {
    return { ...this.config };
  }

  /**
   * Validate pattern configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.nodes.length === 0) {
      errors.push("Pattern must have at least one node");
    }

    for (const node of this.config.nodes) {
      const validation = validateAgentNode(node);
      if (!validation.valid) {
        errors.push(`Node ${node.agent_id}: ${validation.errors.join(", ")}`);
      }
    }

    if (this.config.min_required !== undefined) {
      if (this.config.min_required <= 0) {
        errors.push("min_required must be positive");
      }
      if (this.config.min_required > this.config.nodes.length) {
        errors.push("min_required cannot exceed node count");
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
    type: "parallel";
    nodes: AgentNode[];
    mergeStrategy: MergeStrategy;
  } {
    return {
      type: "parallel",
      nodes: [...this.config.nodes],
      mergeStrategy: this.config.merge_strategy,
    };
  }
}

/**
 * Create a parallel pattern
 */
export function createParallelPattern(
  config?: Partial<ParallelPatternConfig>
): ParallelPattern {
  return new ParallelPattern(config);
}

/**
 * Execute nodes in parallel
 */
export async function executeParallel(
  nodes: AgentNode[],
  input: Record<string, unknown>,
  mergeStrategy?: MergeStrategy
): Promise<ExecutionResult> {
  const pattern = createParallelPattern({
    nodes,
    merge_strategy: mergeStrategy,
  });
  return pattern.execute(input);
}
