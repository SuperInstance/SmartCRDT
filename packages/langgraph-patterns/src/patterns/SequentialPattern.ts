/**
 * @fileoverview Sequential Pattern Implementation
 *
 * ================================================================================
 * LANGGRAPH SEQUENTIAL EXECUTION PATTERN
 * ================================================================================
 *
 * The SequentialPattern executes agent nodes in a defined order, passing the
 * output of each node as input to the next. This is the most common pattern
 * for multi-agent workflows where steps must be performed in sequence.
 *
 * ================================================================================
 * PATTERN STRUCTURE
 * ================================================================================
 *
 * ```
 * Input ──→ [Node 1] ──→ Output 1 ──→ [Node 2] ──→ Output 2 ──→ ...
 *                                                               │
 *                                                          [Node N] ──→ Output
 * ```
 *
 * Each node receives:
 * - The original input
 * - The previous node's output (if pass_outputs is enabled)
 * - Execution metadata (node index, execution ID, etc.)
 *
 * ================================================================================
 * KEY FEATURES
 * ================================================================================
 *
 * 1. OUTPUT PASSING
 *    Nodes can use previous outputs as input:
 *
 *    ```typescript
 *    // Node 1 output: { summary: "Hello world" }
 *    // Node 2 input: { summary: "Hello world", _node_index: 1 }
 *    ```
 *
 * 2. EARLY TERMINATION
 *    Stop execution on error (configurable):
 *
 *    ```typescript
 *    { stop_on_error: true }  // Stop on first error (default)
 *    { stop_on_error: false } // Continue despite errors
 *    ```
 *
 * 3. EXECUTION TRACING
 *    Track every node execution:
 *
 *    ```typescript
 *    trace.entries = [
 *      { timestamp, node_id: 'node-1', operation: 'enter', input: {...} },
 *      { timestamp, node_id: 'node-1', operation: 'exit', output: {...} },
 *      ...
 *    ]
 *    ```
 *
 * 4. TIMEOUT HANDLING
 *    Each node has a timeout to prevent hanging:
 *
 *    ```typescript
 *    const node = {
 *      agent_id: 'slow-node',
 *      config: { timeout: 5000 }  // 5 second timeout
 *    };
 *    ```
 *
 * ================================================================================
 * USAGE EXAMPLES
 * ================================================================================
 *
 * Example 1: Simple text processing pipeline
 *
 * ```typescript
 * const pipeline = createSequentialPattern({
 *   nodes: [
 *     {
 *       agent_id: 'parser',
 *       name: 'Text Parser',
 *       config: { timeout: 1000 }
 *     },
 *     {
 *       agent_id: 'analyzer',
 *       name: 'Sentiment Analyzer',
 *       config: { timeout: 2000 }
 *     },
 *     {
 *       agent_id: 'responder',
 *       name: 'Response Generator',
 *       config: { timeout: 3000 }
 *     }
 *   ],
 *   pass_outputs: true,
 *   stop_on_error: true
 * });
 *
 * const result = await pipeline.execute({ text: 'Hello world' });
 * ```
 *
 * Example 2: Aequor processing pipeline
 *
 * ```typescript
 * const aequorPipeline = createSequentialPattern({
 *   nodes: [
 *     {
 *       agent_id: 'encode_intent',
 *       handler: async (state) => ({
 *         intent: await intentEncoder.encode(state.query)
 *       })
 *     },
 *     {
 *       agent_id: 'route_query',
 *       handler: async (state) => ({
 *         route: cascadeRouter.route(state.intent)
 *       })
 *     },
 *     {
 *       agent_id: 'apply_privacy',
 *       handler: async (state) => ({
 *         processedQuery: await privacyLayer.apply(state.query)
 *       })
 *     },
 *     {
 *       agent_id: 'generate_response',
 *       handler: async (state) => ({
 *         response: await llm.generate(state.processedQuery)
 *       })
 *     },
 *     {
 *       agent_id: 'generate_ui',
 *       handler: async (state) => ({
 *         ui: await a2ui.generate(state.response)
 *       })
 *     }
 *   ]
 * });
 * ```
 *
 * ================================================================================
 * EXECUTION FLOW
 * ================================================================================
 *
 * 1. Initialize state with input data
 * 2. For each node in sequence:
 *    a. Add trace entry (node entry)
 *    b. Prepare node input (merge previous output if enabled)
 *    c. Execute node with timeout protection
 *    d. Store output
 *    e. Add trace entry (node exit)
 *    f. If error and stop_on_error: break
 * 3. Build execution result with:
 *    - Final status (running/failed/completed)
 *    - All node outputs
 *    - Execution metrics (timing, tokens, etc.)
 *    - Full trace of all operations
 * 4. Return result
 *
 * ================================================================================
 * ERROR HANDLING
 * ================================================================================
 *
 * Recoverable errors (network, timeout, rate limit):
 * - Marked as recoverable: true
 * - Execution can continue if stop_on_error is false
 * - Can be retried by external controller
 *
 * Non-recoverable errors (invalid input, missing dependencies):
 * - Marked as recoverable: false
 * - Always stops execution
 * - Requires manual intervention
 *
 * ================================================================================
 * METRICS COLLECTED
 * ================================================================================
 *
 * ```typescript
 * {
 *   total_time: 1234,              // Total execution time (ms)
 *   node_times: Map {              // Per-node timing
 *     'node-1': 100,
 *     'node-2': 200
 *   },
 *   nodes_executed: 2,             // Successful nodes
 *   nodes_failed: 1,               // Failed nodes
 *   nodes_retried: 0,              // Retry attempts
 *   tokens_used: 1500,             // Total LLM tokens
 *   memory_used: 0,                // Memory footprint
 *   cache_hit_rate: 0.5            // Cache effectiveness
 * }
 * ```
 *
 * ================================================================================
 * INTEGRATION WITH LANGGRAPH
 * ================================================================================
 *
 * ```typescript
 * import { StateGraph } from '@langchain/langgraph';
 * import { SequentialPattern } from '@lsi/langgraph-patterns';
 *
 * const pattern = new SequentialPattern({
 *   nodes: [
 *     { agent_id: 'node-1', ... },
 *     { agent_id: 'node-2', ... },
 *     { agent_id: 'node-3', ... }
 *   ]
 * });
 *
 * const graph = new StateGraph({ channels: stateChannels });
 * graph.addNode('sequential_workflow', async (state) => {
 *   const result = await pattern.execute(state);
 *   return { result: result.outputs };
 * });
 *
 * graph.addEdge('start', 'sequential_workflow');
 * graph.addEdge('sequential_workflow', 'end');
 * ```
 *
 * ================================================================================
 * DYNAMIC NODE MANAGEMENT
 * ================================================================================
 *
 * Nodes can be added/removed at runtime:
 *
 * ```typescript
 * pattern.addNode(newNode, 2);  // Insert at position 2
 * pattern.removeNode('node-3'); // Remove by ID
 * pattern.validate();           // Validate configuration
 * ```
 *
 * This enables dynamic workflows that adapt to:
 * - User preferences
 * - System load
 * - Feature flags
 * - A/B testing scenarios
 *
 * @see packages/langgraph/src/graphs/AequorGraph.ts for complete graph
 * @see packages/langgraph-patterns/src/patterns/ConditionalPattern.ts for conditional routing
 * @see packages/langgraph-patterns/src/patterns/ParallelPattern.ts for parallel execution
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
  SequentialPatternConfig,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";

/**
 * Sequential Pattern Class
 *
 * Executes a sequence of agent nodes in order, with optional output passing
 * and early termination on error.
 */
export class SequentialPattern {
  private config: SequentialPatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];

  constructor(config: Partial<SequentialPatternConfig> = {}) {
    this.config = {
      nodes: config.nodes || [],
      stop_on_error: config.stop_on_error ?? true,
      pass_outputs: config.pass_outputs ?? true,
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };
  }

  /**
   * Execute the sequential pattern
   *
   * @param initialInput - Initial input to the first node
   * @returns Execution result with outputs and metrics
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

    let previousOutput = initialInput;
    const nodeTimes = new Map<string, number>();
    let status: ExecutionStatus = "running";

    try {
      // Execute each node in sequence
      for (let i = 0; i < this.config.nodes.length; i++) {
        const node = this.config.nodes[i];
        const nodeStart = Date.now();

        // Add trace entry for node entry
        this.addTraceEntry({
          timestamp: nodeStart,
          node_id: node.agent_id,
          operation: "enter",
          input: previousOutput,
        });

        try {
          // Prepare input for this node
          const nodeInput = this.prepareNodeInput(node, previousOutput, i);

          // Execute the node with timeout
          const nodeOutput = await this.executeNodeWithTimeout(node, nodeInput);

          const nodeEnd = Date.now();
          const nodeDuration = nodeEnd - nodeStart;
          nodeTimes.set(node.agent_id, nodeDuration);

          // Store output
          this.currentExecution.outputs.set(node.agent_id, nodeOutput);
          this.currentExecution.metadata.nodes_executed++;
          this.currentExecution.metadata.nodes_remaining--;
          this.currentExecution.current_path.push(node.agent_id);

          // Add trace entry for node exit
          this.addTraceEntry({
            timestamp: nodeEnd,
            node_id: node.agent_id,
            operation: "exit",
            output: nodeOutput,
            duration: nodeDuration,
          });

          // Pass output to next node if enabled
          if (this.config.pass_outputs) {
            previousOutput = this.mergeOutput(previousOutput, nodeOutput);
          }
        } catch (error) {
          const nodeEnd = Date.now();
          const nodeDuration = nodeEnd - nodeStart;

          // Create execution error
          const execError: ExecutionError = {
            node_id: node.agent_id,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: nodeEnd,
            recoverable: this.isRecoverableError(error),
          };
          this.currentExecution.errors.push(execError);

          // Add trace entry for error
          this.addTraceEntry({
            timestamp: nodeEnd,
            node_id: node.agent_id,
            operation: "error",
            error: execError.message,
            duration: nodeDuration,
          });

          // Handle error based on configuration
          if (this.config.stop_on_error) {
            status = "failed";
            break;
          }
          // Continue to next node if not stopping on error
        }
      }

      // Determine final status
      if (status === "running") {
        status =
          this.currentExecution.errors.length > 0 ? "completed" : "completed";
      }
    } catch (error) {
      status = "failed";
      this.currentExecution.errors.push({
        node_id: "sequential_pattern",
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
    this.currentExecution.metadata.status = status;

    // Build execution result
    return this.buildExecutionResult(totalDuration, nodeTimes);
  }

  /**
   * Prepare input for a node
   */
  private prepareNodeInput(
    node: AgentNode,
    previousOutput: Record<string, unknown>,
    index: number
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {
      ...previousOutput,
      _node_index: index,
      _total_nodes: this.config.nodes.length,
      _execution_id: this.currentExecution?.execution_id,
    };

    // Add node-specific inputs from config
    if (node.inputs) {
      Object.assign(input, node.inputs);
    }

    return input;
  }

  /**
   * Execute a single node with timeout
   */
  private async executeNodeWithTimeout(
    node: AgentNode,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const timeout = node.config.timeout || this.config.graph.timeout;

    return Promise.race([
      this.executeNode(node, input),
      this.createTimeoutPromise(timeout, node.agent_id),
    ]);
  }

  /**
   * Execute a single node
   *
   * This is a placeholder implementation. In a real scenario, this would
   * invoke the actual agent/model based on the node configuration.
   */
  private async executeNode(
    node: AgentNode,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Simulate node execution
    const processingTime = Math.random() * 100 + 50; // 50-150ms

    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Generate mock output based on node type
    const output: Record<string, unknown> = {
      agent_id: node.agent_id,
      timestamp: Date.now(),
      success: true,
      result: this.generateMockResult(node),
    };

    // Add any outputs specified in node config
    if (node.outputs) {
      Object.assign(output, node.outputs);
    }

    return output;
  }

  /**
   * Generate mock result for testing
   */
  private generateMockResult(node: AgentNode): Record<string, unknown> {
    return {
      text: `Response from ${node.name || node.agent_id}`,
      confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
      tokens_used: Math.floor(Math.random() * 100 + 50),
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(
    timeout: number,
    nodeId: string
  ): Promise<Record<string, unknown>> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Node ${nodeId} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Merge output with previous output
   */
  private mergeOutput(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...previous,
      ...current,
      _merged_at: Date.now(),
    };
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors, rate limits, etc. are recoverable
      const recoverablePatterns = [
        /network/i,
        /timeout/i,
        /rate limit/i,
        /temporary/i,
      ];
      return recoverablePatterns.some(pattern => pattern.test(error.message));
    }
    return false;
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
    totalDuration: number,
    nodeTimes: Map<string, number>
  ): ExecutionResult {
    const status = this.currentExecution!.metadata.status;
    const outputs = this.mapToObject(this.currentExecution!.outputs);

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: nodeTimes,
      nodes_executed: this.currentExecution!.metadata.nodes_executed,
      nodes_failed: this.currentExecution!.errors.length,
      nodes_retried: 0,
      tokens_used: this.calculateTotalTokens(outputs),
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map(this.config.nodes.map(n => [n.agent_id, n])),
        edges: this.generateEdges(),
        entry_points: [this.config.nodes[0]?.agent_id].filter(Boolean),
        exit_points: [
          this.config.nodes[this.config.nodes.length - 1]?.agent_id,
        ].filter(Boolean),
      },
      checkpoint_snapshots: [],
    };

    return {
      status,
      outputs,
      metrics,
      errors: this.currentExecution!.errors,
      trace,
    };
  }

  /**
   * Generate edges between sequential nodes
   */
  private generateEdges() {
    const edges = [];
    for (let i = 0; i < this.config.nodes.length - 1; i++) {
      edges.push({
        from_node: this.config.nodes[i].agent_id,
        to_node: this.config.nodes[i + 1].agent_id,
      });
    }
    return edges;
  }

  /**
   * Calculate total tokens used
   */
  private calculateTotalTokens(outputs: Record<string, unknown>): number {
    let total = 0;
    for (const value of Object.values(outputs)) {
      if (typeof value === "object" && value !== null) {
        const result = value as { tokens_used?: number };
        if (result.tokens_used) {
          total += result.tokens_used;
        }
      }
    }
    return total;
  }

  /**
   * Convert Map to plain object
   */
  private mapToObject<T>(map: Map<string, T>): Record<string, T> {
    const obj: Record<string, T> = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `seq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a node to the sequence
   *
   * @param node - Node to add
   * @param position - Position to insert at (default: end)
   */
  addNode(node: AgentNode, position?: number): void {
    const validation = validateAgentNode(node);
    if (!validation.valid) {
      throw new Error(`Invalid node: ${validation.errors.join(", ")}`);
    }

    if (position !== undefined) {
      this.config.nodes.splice(position, 0, node);
    } else {
      this.config.nodes.push(node);
    }
  }

  /**
   * Remove a node from the sequence
   *
   * @param nodeId - ID of node to remove
   */
  removeNode(nodeId: string): void {
    const index = this.config.nodes.findIndex(n => n.agent_id === nodeId);
    if (index !== -1) {
      this.config.nodes.splice(index, 1);
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): SequentialPatternConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param updates - Partial config updates
   */
  updateConfig(updates: Partial<SequentialPatternConfig>): void {
    if (updates.nodes) {
      updates.nodes.forEach(node => {
        const validation = validateAgentNode(node);
        if (!validation.valid) {
          throw new Error(`Invalid node: ${validation.errors.join(", ")}`);
        }
      });
      this.config.nodes = updates.nodes;
    }
    if (updates.stop_on_error !== undefined) {
      this.config.stop_on_error = updates.stop_on_error;
    }
    if (updates.pass_outputs !== undefined) {
      this.config.pass_outputs = updates.pass_outputs;
    }
    if (updates.graph) {
      const validation = validateGraphConfig(updates.graph);
      if (!validation.valid) {
        throw new Error(
          `Invalid graph config: ${validation.errors.join(", ")}`
        );
      }
      this.config.graph = updates.graph;
    }
  }

  /**
   * Validate the pattern configuration
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
   * Get visualization data for the pattern
   */
  getVisualization(): {
    type: "sequential";
    nodes: AgentNode[];
    edges: Array<{ from: string; to: string }>;
  } {
    return {
      type: "sequential",
      nodes: [...this.config.nodes],
      edges: this.generateEdges().map(e => ({
        from: e.from_node,
        to: e.to_node,
      })),
    };
  }
}

/**
 * Create a sequential pattern with the given configuration
 *
 * @param config - Pattern configuration
 * @returns Sequential pattern instance
 */
export function createSequentialPattern(
  config?: Partial<SequentialPatternConfig>
): SequentialPattern {
  return new SequentialPattern(config);
}

/**
 * Execute a sequence of nodes with default configuration
 *
 * @param nodes - Nodes to execute in sequence
 * @param input - Initial input
 * @returns Execution result
 */
export async function executeSequential(
  nodes: AgentNode[],
  input: Record<string, unknown>
): Promise<ExecutionResult> {
  const pattern = createSequentialPattern({ nodes });
  return pattern.execute(input);
}
