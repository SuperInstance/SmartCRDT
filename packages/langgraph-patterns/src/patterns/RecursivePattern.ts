/**
 * @fileoverview Recursive Pattern Implementation
 *
 * Executes self-referential agent loops with base case detection,
 * depth limiting, and result accumulation.
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
  RecursivePatternConfig,
  EdgeCondition,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";

/**
 * Recursive iteration result
 */
interface RecursiveIteration {
  iteration: number;
  output: Record<string, unknown>;
  baseCaseReached: boolean;
  duration: number;
}

/**
 * Recursive Pattern Class
 *
 * Executes a node repeatedly until a base case is reached or
 * maximum depth is exceeded. Supports result accumulation.
 */
export class RecursivePattern {
  private config: RecursivePatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];

  constructor(config: Partial<RecursivePatternConfig> = {}) {
    this.config = {
      node: config.node!,
      base_case: config.base_case!,
      max_depth: config.max_depth ?? 10,
      accumulate_results: config.accumulate_results ?? true,
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };
  }

  /**
   * Execute the recursive pattern
   *
   * @param initialInput - Initial input to the recursive node
   * @returns Execution result with accumulated outputs
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
        nodes_remaining: 0, // Unknown until we hit base case
        status: "running",
      },
      state: { ...initialInput },
    };

    this.trace = [];

    const iterations: RecursiveIteration[] = [];
    let currentInput = { ...initialInput };
    let baseCaseReached = false;
    let finalStatus: ExecutionStatus = "running";

    try {
      // Execute recursively until base case or max depth
      for (let depth = 0; depth < this.config.max_depth; depth++) {
        const iterationStart = Date.now();

        // Add trace entry for iteration start
        this.addTraceEntry({
          timestamp: iterationStart,
          node_id: this.config.node.agent_id,
          operation: "enter",
          input: currentInput,
        });

        try {
          // Execute the node
          const timeout =
            this.config.node.config.timeout || this.config.graph.timeout;
          const output = await Promise.race([
            this.executeNodeLogic(this.config.node, currentInput, depth),
            this.createTimeoutPromise(timeout, this.config.node.agent_id),
          ]);

          const iterationEnd = Date.now();
          const duration = iterationEnd - iterationStart;

          // Check if base case is reached
          baseCaseReached = await this.evaluateBaseCase(output, depth);

          // Store iteration result
          const iteration: RecursiveIteration = {
            iteration: depth,
            output,
            baseCaseReached,
            duration,
          };
          iterations.push(iteration);

          // Add trace entry for iteration completion
          this.addTraceEntry({
            timestamp: iterationEnd,
            node_id: this.config.node.agent_id,
            operation: "exit",
            output,
            duration,
          });

          // Update execution state
          this.currentExecution.outputs.set(`iteration_${depth}`, output);
          this.currentExecution.metadata.nodes_executed++;
          this.currentExecution.current_path.push(
            `${this.config.node.agent_id}_iter_${depth}`
          );

          // Stop if base case reached
          if (baseCaseReached) {
            finalStatus = "completed";
            break;
          }

          // Prepare input for next iteration
          currentInput = this.prepareNextIterationInput(
            currentInput,
            output,
            depth
          );
        } catch (error) {
          const iterationEnd = Date.now();
          const duration = iterationEnd - iterationStart;

          const execError: ExecutionError = {
            node_id: `${this.config.node.agent_id}_iter_${depth}`,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: iterationEnd,
            recoverable: depth < this.config.max_depth - 1,
          };
          this.currentExecution.errors.push(execError);

          // Add trace entry for error
          this.addTraceEntry({
            timestamp: iterationEnd,
            node_id: this.config.node.agent_id,
            operation: "error",
            error: execError.message,
            duration,
          });

          // Decide whether to continue or stop
          if (execError.recoverable) {
            // Try to continue with modified input
            currentInput = this.prepareNextIterationInput(
              currentInput,
              {},
              depth
            );
          } else {
            finalStatus = "failed";
            break;
          }
        }
      }

      // Check if we hit max depth without reaching base case
      if (!baseCaseReached && finalStatus === "running") {
        finalStatus = "completed";
        this.currentExecution.errors.push({
          node_id: "recursive_pattern",
          message: `Maximum depth ${this.config.max_depth} reached without base case`,
          timestamp: Date.now(),
          recoverable: true,
        });
      }
    } catch (error) {
      finalStatus = "failed";
      this.currentExecution.errors.push({
        node_id: "recursive_pattern",
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        recoverable: false,
      });
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Update metadata
    this.currentExecution.metadata.ended_at = endTime;
    this.currentExecution.metadata.duration = totalDuration;
    this.currentExecution.metadata.status = finalStatus;

    // Build execution result
    return this.buildExecutionResult(iterations, totalDuration);
  }

  /**
   * Evaluate if base case is reached
   */
  private async evaluateBaseCase(
    output: Record<string, unknown>,
    depth: number
  ): Promise<boolean> {
    const condition = this.config.base_case;

    switch (condition.type) {
      case "boolean":
        return this.checkBooleanCondition(condition, output);
      case "pattern":
        return this.checkPatternCondition(condition, output);
      case "expression":
        return this.checkExpressionCondition(condition, output, depth);
      case "custom":
        return condition.validator
          ? condition.validator(this.currentExecution!)
          : false;
      default:
        return false;
    }
  }

  /**
   * Check boolean condition for base case
   */
  private checkBooleanCondition(
    condition: EdgeCondition,
    output: Record<string, unknown>
  ): boolean {
    const value = this.getNestedValue(output, condition.expression);
    return value === condition.value;
  }

  /**
   * Check pattern condition for base case
   */
  private checkPatternCondition(
    condition: EdgeCondition,
    output: Record<string, unknown>
  ): boolean {
    const value = this.getNestedValue(output, condition.expression);
    if (typeof value === "string" && typeof condition.value === "string") {
      const pattern = new RegExp(condition.value);
      return pattern.test(value);
    }
    return false;
  }

  /**
   * Check expression condition for base case
   */
  private checkExpressionCondition(
    condition: EdgeCondition,
    output: Record<string, unknown>,
    depth: number
  ): boolean {
    // Special handling for depth-based conditions
    if (
      condition.expression === "depth" &&
      typeof condition.value === "number"
    ) {
      return depth >= condition.value;
    }

    // Check for done/complete flags
    const doneValue = this.getNestedValue(output, "done");
    if (doneValue === true) return true;

    const completeValue = this.getNestedValue(output, "complete");
    if (completeValue === true) return true;

    const finishedValue = this.getNestedValue(output, "finished");
    if (finishedValue === true) return true;

    return false;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let value: unknown = obj;
    for (const key of keys) {
      if (typeof value === "object" && value !== null && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Prepare input for next iteration
   */
  private prepareNextIterationInput(
    previousInput: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    depth: number
  ): Record<string, unknown> {
    return {
      ...previousInput,
      ...previousOutput,
      _iteration: depth + 1,
      _previous_output: previousOutput,
      _execution_id: this.currentExecution?.execution_id,
    };
  }

  /**
   * Execute node logic (placeholder with recursive behavior simulation)
   */
  private async executeNodeLogic(
    node: AgentNode,
    input: Record<string, unknown>,
    depth: number
  ): Promise<Record<string, unknown>> {
    const processingTime = Math.random() * 50 + 30; // 30-80ms
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate progression toward base case
    const iteration = (input._iteration as number) || 0;

    return {
      agent_id: node.agent_id,
      iteration: depth,
      timestamp: Date.now(),
      success: true,
      result: {
        text: `Iteration ${depth} response`,
        confidence: Math.max(0.5, 1 - depth * 0.1), // Decreasing confidence
        progress: (depth + 1) / this.config.max_depth,
        // Simulate base case at certain depth
        done: depth >= Math.min(this.config.max_depth * 0.7, 5),
        complete: depth >= Math.min(this.config.max_depth * 0.7, 5),
      },
    };
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
   * Build execution result
   */
  private buildExecutionResult(
    iterations: RecursiveIteration[],
    totalDuration: number
  ): ExecutionResult {
    // Build outputs
    const outputs: Record<string, unknown> = {
      iterations: iterations.length,
      base_case_reached:
        iterations.length > 0 &&
        iterations[iterations.length - 1].baseCaseReached,
      final_iteration: iterations.length - 1,
    };

    if (this.config.accumulate_results) {
      outputs.iteration_results = iterations.map(i => i.output);
      outputs.all_outputs = iterations.map(i => i.output);
    }

    // Include last output directly
    if (iterations.length > 0) {
      outputs.last_output = iterations[iterations.length - 1].output;
      outputs.final_result = iterations[iterations.length - 1].output;
    }

    // Calculate metrics
    const nodeTimes = new Map<string, number>();
    for (let i = 0; i < iterations.length; i++) {
      nodeTimes.set(
        `${this.config.node.agent_id}_iter_${i}`,
        iterations[i].duration
      );
    }

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: nodeTimes,
      nodes_executed: iterations.length,
      nodes_failed: this.currentExecution!.errors.length,
      nodes_retried: 0,
      tokens_used: iterations.length * 50, // Estimate
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map([[this.config.node.agent_id, this.config.node]]),
        edges: [
          {
            from_node: this.config.node.agent_id,
            to_node: this.config.node.agent_id,
            condition: this.config.base_case,
          },
        ],
        entry_points: [this.config.node.agent_id],
        exit_points: [this.config.node.agent_id],
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
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Set maximum recursion depth
   */
  setMaxDepth(depth: number): void {
    if (depth <= 0) {
      throw new Error("Max depth must be positive");
    }
    this.config.max_depth = depth;
  }

  /**
   * Set base case condition
   */
  setBaseCase(condition: EdgeCondition): void {
    this.config.base_case = condition;
  }

  /**
   * Get configuration
   */
  getConfig(): RecursivePatternConfig {
    return { ...this.config };
  }

  /**
   * Validate pattern configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const nodeValidation = validateAgentNode(this.config.node);
    if (!nodeValidation.valid) {
      errors.push(`Node: ${nodeValidation.errors.join(", ")}`);
    }

    if (this.config.max_depth <= 0) {
      errors.push("max_depth must be positive");
    }

    if (this.config.max_depth > 100) {
      errors.push("max_depth cannot exceed 100 (safety limit)");
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
    type: "recursive";
    node: AgentNode;
    maxDepth: number;
    accumulateResults: boolean;
  } {
    return {
      type: "recursive",
      node: { ...this.config.node },
      maxDepth: this.config.max_depth,
      accumulateResults: this.config.accumulate_results,
    };
  }
}

/**
 * Create a recursive pattern
 */
export function createRecursivePattern(
  config: Partial<RecursivePatternConfig>
): RecursivePattern {
  return new RecursivePattern(config);
}

/**
 * Execute recursive pattern
 */
export async function executeRecursive(
  node: AgentNode,
  baseCase: EdgeCondition,
  input: Record<string, unknown>,
  maxDepth?: number
): Promise<ExecutionResult> {
  const pattern = createRecursivePattern({
    node,
    base_case: baseCase,
    max_depth: maxDepth,
  });
  return pattern.execute(input);
}
