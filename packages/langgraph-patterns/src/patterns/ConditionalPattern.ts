/**
 * @fileoverview Conditional Pattern Implementation
 *
 * ================================================================================
 * LANGGRAPH CONDITIONAL ROUTING PATTERN
 * ================================================================================
 *
 * The ConditionalPattern enables dynamic routing in agent workflows based on
 * runtime conditions. It's a key pattern for implementing intelligent agent
 * orchestration where the execution path depends on:
 *
 * - Query properties (complexity, domain, sensitivity)
 * - Model outputs (confidence, classification)
 * - External state (user preferences, system status)
 * - Business rules (cost limits, time constraints)
 *
 * ================================================================================
 * PATTERN STRUCTURE
 * ================================================================================
 *
 * ```
 * Input
 *   │
 *   ├──[Condition 1]──→ Route A ──→ Output A
 *   │    (priority: 100)
 *   │
 *   ├──[Condition 2]──→ Route B ──→ Output B
 *   │    (priority: 50)
 *   │
 *   ├──[Condition 3]──→ Route C ──→ Output C
 *   │    (priority: 10)
 *   │
 *   └──[Default]──────→ Route D ──→ Output D
 * ```
 *
 * Conditions are evaluated in priority order (highest first). The first
 * matching condition determines the route. If no conditions match,
 * the default route is used.
 *
 * ================================================================================
 * CONDITION TYPES
 * ================================================================================
 *
 * 1. BOOLEAN CONDITION
 *    Simple equality check on a state value
 *
 *    ```typescript
 *    {
 *      type: 'boolean',
 *      expression: 'route',
 *      value: 'cloud'
 *    }
 *    ```
 *
 * 2. PATTERN CONDITION
 *    Regex match on string values
 *
 *    ```typescript
 *    {
 *      type: 'pattern',
 *      expression: 'query',
 *      value: '^help.*'
 *    }
 *    ```
 *
 * 3. EXPRESSION CONDITION
 *    Comparison operators (>, <, >=, <=, ==, ===, !=, !==)
 *
 *    ```typescript
 *    {
 *      type: 'expression',
 *      expression: 'complexity > 0.7'
 *    }
 *    ```
 *
 * 4. CUSTOM CONDITION
 *    User-defined validator function
 *
 *    ```typescript
 *    {
 *      type: 'custom',
 *      validator: (state) => state.confidence < 0.5
 *    }
 *    ```
 *
 * ================================================================================
 * USAGE EXAMPLES
 * ================================================================================
 *
 * Example 1: Routing based on query complexity
 *
 * ```typescript
 * const pattern = createConditionalPattern({
 *   routes: [
 *     {
 *       node: { agent_id: 'cloud-model', name: 'GPT-4' },
 *       condition: {
 *         type: 'expression',
 *         expression: 'complexity >= 0.7'
 *       },
 *       priority: 100
 *     },
 *     {
 *       node: { agent_id: 'local-model', name: 'Llama2' },
 *       condition: {
 *         type: 'expression',
 *         expression: 'complexity < 0.7'
 *       },
 *       priority: 50
 *     }
 *   ]
 * });
 * ```
 *
 * Example 2: Privacy-based routing
 *
 * ```typescript
 * const routes: ConditionalRoute[] = [
 *   {
 *     node: localModelNode,
 *     condition: {
 *       type: 'boolean',
 *       expression: 'privacy',
 *       value: 'sovereign'
 *     },
 *     priority: 100
 *   },
 *   {
 *     node: privacyProtectedNode,
 *     condition: {
 *       type: 'boolean',
 *       expression: 'privacy',
 *       value: 'sensitive'
 *     },
 *     priority: 90
 *   },
 *   {
 *     node: cloudModelNode,
 *     condition: {
 *       type: 'boolean',
 *       expression: 'privacy',
 *       value: 'public'
 *     },
 *     priority: 80
 *   }
 * ];
 * ```
 *
 * ================================================================================
 * EVALUATION STRATEGY
 * ================================================================================
 *
 * By default, only the first matching route is executed (evaluate_all: false).
 * This is efficient and prevents redundant work.
 *
 * Set evaluate_all: true to execute ALL matching routes. This is useful for:
 * - Getting multiple perspectives on the same query
 * - Parallel processing of similar tasks
 * - Ensemble approaches (combine multiple outputs)
 *
 * ================================================================================
 * PRIORITY-BASED ROUTING
 * ================================================================================
 *
 * Routes are evaluated in priority order (highest to lowest):
 *
 * ```typescript
 * const routes = [
 *   { priority: 100, ... },  // Evaluated first
 *   { priority: 50,  ... },  // Evaluated second
 *   { priority: 10,  ... }   // Evaluated last
 * ];
 * ```
 *
 * Higher priority routes should be more specific conditions. Lower priority
 * routes act as fallbacks for general cases.
 *
 * ================================================================================
 * ERROR HANDLING
 * ================================================================================
 *
 * - If a route execution fails, the error is recorded
 * - Other routes continue to execute (if evaluate_all is true)
 * - Final status is 'completed' if at least one route succeeded
 * - Final status is 'failed' if all routes failed
 * - Errors include recoverable flag for retry logic
 *
 * ================================================================================
 * INTEGRATION WITH LANGGRAPH
 * ================================================================================
 *
 * ```typescript
 * import { StateGraph } from '@langchain/langgraph';
 * import { ConditionalPattern } from '@lsi/langgraph-patterns';
 *
 * const conditionalRoute = new ConditionalPattern({
 *   routes: [...]
 * });
 *
 * const graph = new StateGraph({ channels: stateChannels });
 * graph.addNode('route_query', async (state) => {
 *   const result = await conditionalRoute.execute(state);
 *   return { route: result.outputs.matched_route };
 * });
 *
 * // Add conditional edges
 * graph.addConditionalEdges(
 *   'route_query',
 *   (state) => state.route,
 *   {
 *     'cloud': 'apply_privacy',
 *     'local': 'generate_response'
 *   }
 * );
 * ```
 *
 * @see packages/langgraph/src/graphs/AequorGraph.ts for graph construction
 * @see packages/langgraph-patterns/src/patterns/SequentialPattern.ts for sequential execution
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
  ConditionalPatternConfig,
  ConditionalRoute,
  EdgeCondition,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";

/**
 * Conditional Pattern Class
 *
 * Routes execution to different nodes based on conditions.
 * Supports priority-based evaluation and default fallback routes.
 */
export class ConditionalPattern {
  private config: ConditionalPatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];

  constructor(config: Partial<ConditionalPatternConfig> = {}) {
    this.config = {
      routes: config.routes || [],
      default_route: config.default_route,
      evaluate_all: config.evaluate_all ?? false,
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };

    // Sort routes by priority (higher priority first)
    this.sortRoutesByPriority();
  }

  /**
   * Execute the conditional pattern
   *
   * @param initialInput - Input to evaluate conditions against
   * @returns Execution result from matched route
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
        nodes_remaining: this.config.routes.length,
        status: "running",
      },
      state: { ...initialInput },
    };

    this.trace = [];

    try {
      // Evaluate conditions and execute matching routes
      const executedRoutes = await this.evaluateAndExecuteRoutes(initialInput);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Update metadata
      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status =
        executedRoutes.length > 0 ? "completed" : "failed";

      // Build execution result
      return this.buildExecutionResult(totalDuration, executedRoutes);
    } catch (error) {
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      this.currentExecution.errors.push({
        node_id: "conditional_pattern",
        message: error instanceof Error ? error.message : String(error),
        timestamp: endTime,
        recoverable: false,
      });

      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status = "failed";

      return this.buildExecutionResult(totalDuration, []);
    }
  }

  /**
   * Evaluate conditions and execute matching routes
   */
  private async evaluateAndExecuteRoutes(
    input: Record<string, unknown>
  ): Promise<
    Array<{ route: ConditionalRoute; output: Record<string, unknown> }>
  > {
    const executedRoutes: Array<{
      route: ConditionalRoute;
      output: Record<string, unknown>;
    }> = [];

    // Sort routes by priority
    const sortedRoutes = [...this.config.routes].sort(
      (a, b) => b.priority - a.priority
    );

    // Find matching routes
    const matchingRoutes: ConditionalRoute[] = [];

    for (const route of sortedRoutes) {
      const matches = await this.evaluateCondition(route.condition, input);
      if (matches) {
        matchingRoutes.push(route);

        // Add trace entry for condition match
        this.addTraceEntry({
          timestamp: Date.now(),
          node_id: route.node.agent_id,
          operation: "enter",
          input: { condition_matched: true, priority: route.priority },
        });

        // Stop at first match if not evaluating all
        if (!this.config.evaluate_all) {
          break;
        }
      }
    }

    // If no matches, use default route
    if (matchingRoutes.length === 0 && this.config.default_route) {
      const defaultRoute = this.config.routes.find(
        r => r.node.agent_id === this.config.default_route
      );
      if (defaultRoute) {
        matchingRoutes.push(defaultRoute);
      }
    }

    // Execute matched routes
    for (const route of matchingRoutes) {
      try {
        const output = await this.executeRoute(route, input);
        executedRoutes.push({ route, output });
      } catch (error) {
        this.currentExecution!.errors.push({
          node_id: route.node.agent_id,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          recoverable: true,
        });
      }
    }

    return executedRoutes;
  }

  /**
   * Evaluate a condition
   */
  private async evaluateCondition(
    condition: EdgeCondition,
    input: Record<string, unknown>
  ): Promise<boolean> {
    switch (condition.type) {
      case "boolean":
        return this.evaluateBooleanCondition(condition, input);
      case "pattern":
        return this.evaluatePatternCondition(condition, input);
      case "expression":
        return this.evaluateExpressionCondition(condition, input);
      case "custom":
        return condition.validator
          ? condition.validator(this.currentExecution!)
          : false;
      default:
        return false;
    }
  }

  /**
   * Evaluate boolean condition
   */
  private evaluateBooleanCondition(
    condition: EdgeCondition,
    input: Record<string, unknown>
  ): boolean {
    // Check if the expression exists in input and matches expected value
    const inputValue = this.getNestedValue(input, condition.expression);
    return inputValue === condition.value;
  }

  /**
   * Evaluate pattern condition
   */
  private evaluatePatternCondition(
    condition: EdgeCondition,
    input: Record<string, unknown>
  ): boolean {
    const inputValue = this.getNestedValue(input, condition.expression);
    if (typeof inputValue === "string" && typeof condition.value === "string") {
      const pattern = new RegExp(condition.value);
      return pattern.test(inputValue);
    }
    return false;
  }

  /**
   * Evaluate expression condition
   */
  private evaluateExpressionCondition(
    condition: EdgeCondition,
    input: Record<string, unknown>
  ): boolean {
    // Simple expression evaluation (can be extended)
    try {
      // Support simple comparisons like "value > 10", "status === 'active'"
      const context = { ...input, _input: input };
      const expr = condition.expression;

      // Check for comparison operators
      const match = expr.match(/^(\w+)\s*(===|==|!==|!=|>|>=|<|<=)\s*(.+)$/);
      if (match) {
        const [, key, op, valueStr] = match;
        const actualValue = this.getNestedValue(input, key);
        let expectedValue: unknown = valueStr;

        // Parse expected value
        if (valueStr === "true") expectedValue = true;
        else if (valueStr === "false") expectedValue = false;
        else if (valueStr === "null") expectedValue = null;
        else if (valueStr.startsWith("'") || valueStr.startsWith('"')) {
          expectedValue = valueStr.slice(1, -1);
        } else if (!isNaN(Number(valueStr))) {
          expectedValue = Number(valueStr);
        }

        // Perform comparison
        switch (op) {
          case "===":
            return actualValue === expectedValue;
          case "==":
            return actualValue == expectedValue;
          case "!==":
            return actualValue !== expectedValue;
          case "!=":
            return actualValue != expectedValue;
          case ">":
            return (
              typeof actualValue === "number" &&
              typeof expectedValue === "number" &&
              actualValue > expectedValue
            );
          case ">=":
            return (
              typeof actualValue === "number" &&
              typeof expectedValue === "number" &&
              actualValue >= expectedValue
            );
          case "<":
            return (
              typeof actualValue === "number" &&
              typeof expectedValue === "number" &&
              actualValue < expectedValue
            );
          case "<=":
            return (
              typeof actualValue === "number" &&
              typeof expectedValue === "number" &&
              actualValue <= expectedValue
            );
        }
      }

      return false;
    } catch {
      return false;
    }
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
   * Execute a route
   */
  private async executeRoute(
    route: ConditionalRoute,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const nodeStart = Date.now();

    const node = route.node;
    const timeout = node.config.timeout || this.config.graph.timeout;

    const output = await Promise.race([
      this.executeNodeLogic(node, input),
      this.createTimeoutPromise(timeout, node.agent_id),
    ]);

    const nodeEnd = Date.now();
    const duration = nodeEnd - nodeStart;

    // Add trace entry
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

    return output;
  }

  /**
   * Execute node logic (placeholder)
   */
  private async executeNodeLogic(
    node: AgentNode,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
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
   * Sort routes by priority
   */
  private sortRoutesByPriority(): void {
    this.config.routes.sort((a, b) => b.priority - a.priority);
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
    executedRoutes: Array<{
      route: ConditionalRoute;
      output: Record<string, unknown>;
    }>
  ): ExecutionResult {
    // Combine outputs from all executed routes
    const outputs: Record<string, unknown> = {
      executed_routes: executedRoutes.map(e => ({
        node_id: e.route.node.agent_id,
        priority: e.route.priority,
        output: e.output,
      })),
      route_count: executedRoutes.length,
      executed_at: Date.now(),
    };

    // If only one route was executed, include its output directly
    if (executedRoutes.length === 1) {
      outputs.result = executedRoutes[0].output;
      outputs.matched_route = executedRoutes[0].route.node.agent_id;
    }

    const nodeTimes = new Map<string, number>();
    for (const { route } of executedRoutes) {
      nodeTimes.set(route.node.agent_id, 0); // Duration tracked in trace
    }

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: nodeTimes,
      nodes_executed: this.currentExecution!.metadata.nodes_executed,
      nodes_failed: 0,
      nodes_retried: 0,
      tokens_used: 0,
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map(this.config.routes.map(r => [r.node.agent_id, r.node])),
        edges: [],
        entry_points: this.config.routes.map(r => r.node.agent_id),
        exit_points: this.config.routes.map(r => r.node.agent_id),
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
    return `cond_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a route to the pattern
   */
  addRoute(route: ConditionalRoute): void {
    const validation = validateAgentNode(route.node);
    if (!validation.valid) {
      throw new Error(`Invalid node: ${validation.errors.join(", ")}`);
    }
    this.config.routes.push(route);
    this.sortRoutesByPriority();
  }

  /**
   * Remove a route from the pattern
   */
  removeRoute(nodeId: string): void {
    this.config.routes = this.config.routes.filter(
      r => r.node.agent_id !== nodeId
    );
  }

  /**
   * Set default route
   */
  setDefaultRoute(nodeId: string): void {
    this.config.default_route = nodeId;
  }

  /**
   * Get configuration
   */
  getConfig(): ConditionalPatternConfig {
    return { ...this.config };
  }

  /**
   * Validate pattern configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.routes.length === 0) {
      errors.push("Pattern must have at least one route");
    }

    for (const route of this.config.routes) {
      const nodeValidation = validateAgentNode(route.node);
      if (!nodeValidation.valid) {
        errors.push(
          `Route ${route.node.agent_id}: ${nodeValidation.errors.join(", ")}`
        );
      }

      if (route.priority < 0) {
        errors.push(
          `Route ${route.node.agent_id}: priority cannot be negative`
        );
      }
    }

    if (this.config.default_route) {
      const defaultExists = this.config.routes.some(
        r => r.node.agent_id === this.config.default_route
      );
      if (!defaultExists) {
        errors.push(
          `Default route ${this.config.default_route} does not exist`
        );
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
    type: "conditional";
    routes: ConditionalRoute[];
    defaultRoute?: string;
    evaluateAll: boolean;
  } {
    return {
      type: "conditional",
      routes: [...this.config.routes],
      defaultRoute: this.config.default_route,
      evaluateAll: this.config.evaluate_all,
    };
  }
}

/**
 * Create a conditional pattern
 */
export function createConditionalPattern(
  config?: Partial<ConditionalPatternConfig>
): ConditionalPattern {
  return new ConditionalPattern(config);
}

/**
 * Execute conditional routing
 */
export async function executeConditional(
  routes: ConditionalRoute[],
  input: Record<string, unknown>,
  defaultRoute?: string
): Promise<ExecutionResult> {
  const pattern = createConditionalPattern({
    routes,
    default_route: defaultRoute,
  });
  return pattern.execute(input);
}
