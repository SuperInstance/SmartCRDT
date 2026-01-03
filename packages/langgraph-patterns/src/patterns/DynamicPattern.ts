/**
 * @fileoverview Dynamic Pattern Implementation
 *
 * Enables runtime graph modification with support for adding/removing
 * nodes, reconfiguring edges, and live graph updates.
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
  DynamicPatternConfig,
  ModificationRule,
  ModificationTrigger,
  ModificationAction,
  EdgeConnection,
} from "../types.js";
import {
  DEFAULT_GRAPH_CONFIG,
  validateAgentNode,
  validateGraphConfig,
} from "../types.js";
import { SequentialPattern } from "./SequentialPattern.js";

/**
 * Pending modification
 */
interface PendingModification {
  rule: ModificationRule;
  triggerNode?: string;
  timestamp: number;
}

/**
 * Dynamic Pattern Class
 *
 * Executes a graph that can be modified at runtime based on
 * triggers and conditions.
 */
export class DynamicPattern {
  private config: DynamicPatternConfig;
  private currentExecution?: GraphState;
  private trace: TraceEntry[] = [];
  private currentNodes: AgentNode[] = [];
  private currentEdges: EdgeConnection[] = [];
  private pendingModifications: PendingModification[] = [];

  constructor(config: Partial<DynamicPatternConfig> = {}) {
    this.config = {
      initial_nodes: config.initial_nodes || [],
      modification_rules: config.modification_rules || [],
      allow_addition: config.allow_addition ?? true,
      allow_removal: config.allow_removal ?? true,
      allow_reconfiguration: config.allow_reconfiguration ?? true,
      graph: config.graph || DEFAULT_GRAPH_CONFIG,
    };

    // Initialize with initial nodes
    this.currentNodes = [...this.config.initial_nodes];
    this.currentEdges = this.generateInitialEdges();
  }

  /**
   * Execute the dynamic pattern
   *
   * @param initialInput - Initial input to the graph
   * @returns Execution result with all modifications applied
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
        nodes_remaining: this.currentNodes.length,
        status: "running",
      },
      state: {
        ...initialInput,
        _modifications: [],
        _graph_state: {
          nodes: this.currentNodes.map(n => n.agent_id),
          edges: this.currentEdges,
        },
      },
    };

    this.trace = [];
    this.pendingModifications = [];

    try {
      // Execute current graph sequentially
      await this.executeCurrentGraph(initialInput);

      // Apply any pending modifications
      await this.applyPendingModifications();

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Update metadata
      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status = "completed";

      // Build execution result
      return this.buildExecutionResult(totalDuration);
    } catch (error) {
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      this.currentExecution.errors.push({
        node_id: "dynamic_pattern",
        message: error instanceof Error ? error.message : String(error),
        timestamp: endTime,
        recoverable: false,
      });

      this.currentExecution.metadata.ended_at = endTime;
      this.currentExecution.metadata.duration = totalDuration;
      this.currentExecution.metadata.status = "failed";

      return this.buildExecutionResult(totalDuration);
    }
  }

  /**
   * Execute the current graph
   */
  private async executeCurrentGraph(
    input: Record<string, unknown>
  ): Promise<void> {
    let currentInput = { ...input };

    for (const node of this.currentNodes) {
      const nodeStart = Date.now();

      // Add trace entry
      this.addTraceEntry({
        timestamp: nodeStart,
        node_id: node.agent_id,
        operation: "enter",
        input: currentInput,
      });

      try {
        // Execute node
        const timeout = node.config.timeout || this.config.graph.timeout;
        const output = await Promise.race([
          this.executeNodeLogic(node, currentInput),
          this.createTimeoutPromise(timeout, node.agent_id),
        ]);

        const nodeEnd = Date.now();

        // Store output
        this.currentExecution!.outputs.set(node.agent_id, output);
        this.currentExecution!.metadata.nodes_executed++;
        this.currentExecution!.current_path.push(node.agent_id);

        // Add trace entry
        this.addTraceEntry({
          timestamp: nodeEnd,
          node_id: node.agent_id,
          operation: "exit",
          output,
          duration: nodeEnd - nodeStart,
        });

        // Check for modification triggers
        await this.checkModificationTriggers(node, output);

        // Update input for next node
        currentInput = this.mergeOutput(currentInput, output);
      } catch (error) {
        const nodeEnd = Date.now();

        const execError: ExecutionError = {
          node_id: node.agent_id,
          message: error instanceof Error ? error.message : String(error),
          timestamp: nodeEnd,
          recoverable: true,
        };
        this.currentExecution!.errors.push(execError);

        // Add trace entry for error
        this.addTraceEntry({
          timestamp: nodeEnd,
          node_id: node.agent_id,
          operation: "error",
          error: execError.message,
        });

        // Check for failure-based modification triggers
        await this.checkModificationTriggers(node, null, error);
      }
    }
  }

  /**
   * Check modification triggers after node execution
   */
  private async checkModificationTriggers(
    node: AgentNode,
    output: Record<string, unknown> | null,
    error?: unknown
  ): Promise<void> {
    for (const rule of this.config.modification_rules) {
      let shouldTrigger = false;

      // Check trigger type
      switch (rule.trigger) {
        case "on_success":
          shouldTrigger = output !== null && !error;
          break;
        case "on_failure":
          shouldTrigger = error !== undefined;
          break;
        case "on_timeout":
          shouldTrigger =
            error instanceof Error && error.message.includes("timeout");
          break;
        case "on_condition":
          if (output && rule.conditions.length > 0) {
            shouldTrigger = await this.evaluateConditions(
              rule.conditions[0],
              output
            );
          }
          break;
        case "manual":
          // Manual triggers are handled separately
          continue;
      }

      if (shouldTrigger) {
        this.pendingModifications.push({
          rule,
          triggerNode: node.agent_id,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Evaluate conditions for triggering
   */
  private async evaluateConditions(
    conditions: EdgeConnection["condition"],
    output: Record<string, unknown>
  ): Promise<boolean> {
    if (!conditions) return false;

    switch (conditions.type) {
      case "boolean":
        return this.checkBooleanCondition(conditions, output);
      case "pattern":
        return this.checkPatternCondition(conditions, output);
      case "expression":
        return this.checkExpressionCondition(conditions, output);
      case "custom":
        return conditions.validator
          ? conditions.validator(this.currentExecution!)
          : false;
      default:
        return false;
    }
  }

  /**
   * Check boolean condition
   */
  private checkBooleanCondition(
    condition: EdgeConnection["condition"],
    output: Record<string, unknown>
  ): boolean {
    if (!condition) return false;
    const value = this.getNestedValue(output, condition.expression);
    return value === condition.value;
  }

  /**
   * Check pattern condition
   */
  private checkPatternCondition(
    condition: EdgeConnection["condition"],
    output: Record<string, unknown>
  ): boolean {
    if (!condition) return false;
    const value = this.getNestedValue(output, condition.expression);
    if (typeof value === "string" && typeof condition.value === "string") {
      const pattern = new RegExp(condition.value);
      return pattern.test(value);
    }
    return false;
  }

  /**
   * Check expression condition
   */
  private checkExpressionCondition(
    condition: EdgeConnection["condition"],
    output: Record<string, unknown>
  ): boolean {
    if (!condition) return false;
    const value = this.getNestedValue(output, condition.expression);
    return value !== undefined && value !== null;
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
   * Apply all pending modifications
   */
  private async applyPendingModifications(): Promise<void> {
    for (const pending of this.pendingModifications) {
      await this.applyModification(pending);
    }

    // Record modifications in state
    if (this.currentExecution) {
      const state = this.currentExecution.state as {
        _modifications: PendingModification[];
        _graph_state: { nodes: string[]; edges: EdgeConnection[] };
      };
      state._modifications = [...this.pendingModifications];
      state._graph_state = {
        nodes: this.currentNodes.map(n => n.agent_id),
        edges: [...this.currentEdges],
      };
    }
  }

  /**
   * Apply a single modification
   */
  private async applyModification(pending: PendingModification): Promise<void> {
    const { rule, triggerNode } = pending;

    switch (rule.action) {
      case "add_node":
        if (this.config.allow_addition) {
          await this.applyAddNode(rule, triggerNode);
        }
        break;

      case "remove_node":
        if (this.config.allow_removal) {
          await this.applyRemoveNode(rule, triggerNode);
        }
        break;

      case "add_edge":
        if (this.config.allow_reconfiguration) {
          await this.applyAddEdge(rule);
        }
        break;

      case "remove_edge":
        if (this.config.allow_reconfiguration) {
          await this.applyRemoveEdge(rule);
        }
        break;

      case "reconfigure":
        if (this.config.allow_reconfiguration) {
          await this.applyReconfigure(rule);
        }
        break;

      case "replace":
        if (this.config.allow_removal && this.config.allow_addition) {
          await this.applyReplace(rule, triggerNode);
        }
        break;
    }
  }

  /**
   * Apply add node modification
   */
  private async applyAddNode(
    rule: ModificationRule,
    triggerNode?: string
  ): Promise<void> {
    // Create a new node based on the rule
    const newNode: AgentNode = {
      agent_id: `dynamic_node_${Date.now()}`,
      node_type: "agent",
      inputs: {},
      outputs: {},
      config: {
        model: "dynamic-model",
        timeout: 5000,
      },
    };

    this.currentNodes.push(newNode);

    // Add edge from trigger node if applicable
    if (triggerNode) {
      this.currentEdges.push({
        from_node: triggerNode,
        to_node: newNode.agent_id,
      });
    }
  }

  /**
   * Apply remove node modification
   */
  private async applyRemoveNode(
    rule: ModificationRule,
    triggerNode?: string
  ): Promise<void> {
    if (triggerNode) {
      this.currentNodes = this.currentNodes.filter(
        n => n.agent_id !== triggerNode
      );
      this.currentEdges = this.currentEdges.filter(
        e => e.from_node !== triggerNode && e.to_node !== triggerNode
      );
    }
  }

  /**
   * Apply add edge modification
   */
  private async applyAddEdge(rule: ModificationRule): Promise<void> {
    // Mock implementation - adds edge based on conditions
    if (this.currentNodes.length >= 2) {
      this.currentEdges.push({
        from_node: this.currentNodes[0].agent_id,
        to_node: this.currentNodes[1].agent_id,
      });
    }
  }

  /**
   * Apply remove edge modification
   */
  private async applyRemoveEdge(rule: ModificationRule): Promise<void> {
    if (this.currentEdges.length > 0) {
      this.currentEdges.pop();
    }
  }

  /**
   * Apply reconfigure modification
   */
  private async applyReconfigure(rule: ModificationRule): Promise<void> {
    // Reconfigure edges based on conditions
    if (this.currentNodes.length >= 2) {
      this.currentEdges = [
        {
          from_node: this.currentNodes[0].agent_id,
          to_node: this.currentNodes[1].agent_id,
        },
      ];
    }
  }

  /**
   * Apply replace modification
   */
  private async applyReplace(
    rule: ModificationRule,
    triggerNode?: string
  ): Promise<void> {
    if (triggerNode) {
      const index = this.currentNodes.findIndex(
        n => n.agent_id === triggerNode
      );
      if (index !== -1) {
        const replacementNode: AgentNode = {
          agent_id: `replacement_${triggerNode}`,
          node_type: "agent",
          inputs: {},
          outputs: {},
          config: {
            model: "replacement-model",
            timeout: 5000,
          },
        };
        this.currentNodes[index] = replacementNode;

        // Update edges
        this.currentEdges = this.currentEdges.map(e => ({
          ...e,
          from_node:
            e.from_node === triggerNode
              ? replacementNode.agent_id
              : e.from_node,
          to_node:
            e.to_node === triggerNode ? replacementNode.agent_id : e.to_node,
        }));
      }
    }
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
   * Generate initial edges
   */
  private generateInitialEdges(): EdgeConnection[] {
    const edges: EdgeConnection[] = [];
    for (let i = 0; i < this.currentNodes.length - 1; i++) {
      edges.push({
        from_node: this.currentNodes[i].agent_id,
        to_node: this.currentNodes[i + 1].agent_id,
      });
    }
    return edges;
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
  private buildExecutionResult(totalDuration: number): ExecutionResult {
    const outputs: Record<string, unknown> = {
      modifications_applied: this.pendingModifications.length,
      final_node_count: this.currentNodes.length,
      final_edge_count: this.currentEdges.length,
      modifications: this.pendingModifications.map(p => ({
        action: p.rule.action,
        trigger: p.rule.trigger,
        trigger_node: p.triggerNode,
        timestamp: p.timestamp,
      })),
      node_outputs: this.mapToObject(this.currentExecution!.outputs),
    };

    const nodeTimes = new Map<string, number>();
    for (const [nodeId, output] of this.currentExecution!.outputs) {
      if (typeof output === "object" && output !== null) {
        const result = output as { timestamp?: number };
        if (result.timestamp) {
          nodeTimes.set(nodeId, 0); // Duration tracked in trace
        }
      }
    }

    const metrics: ExecutionMetrics = {
      total_time: totalDuration,
      node_times: nodeTimes,
      nodes_executed: this.currentExecution!.metadata.nodes_executed,
      nodes_failed: this.currentExecution!.errors.length,
      nodes_retried: 0,
      tokens_used: this.currentExecution!.metadata.nodes_executed * 50,
      memory_used: 0,
      cache_hit_rate: 0,
    };

    const trace: ExecutionTrace = {
      entries: this.trace,
      initial_topology: {
        nodes: new Map(this.config.initial_nodes.map(n => [n.agent_id, n])),
        edges: this.generateInitialEdges(),
        entry_points:
          this.config.initial_nodes.length > 0
            ? [this.config.initial_nodes[0].agent_id]
            : [],
        exit_points:
          this.config.initial_nodes.length > 0
            ? [
                this.config.initial_nodes[this.config.initial_nodes.length - 1]
                  .agent_id,
              ]
            : [],
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
   * Convert Map to object
   */
  private mapToObject<T>(map: Map<string, T>): Record<string, T> {
    const obj: Record<string, T> = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `dyn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add a node at runtime
   */
  addNode(node: AgentNode): void {
    if (!this.config.allow_addition) {
      throw new Error("Node addition is not allowed");
    }
    const validation = validateAgentNode(node);
    if (!validation.valid) {
      throw new Error(`Invalid node: ${validation.errors.join(", ")}`);
    }
    this.currentNodes.push(node);
  }

  /**
   * Remove a node at runtime
   */
  removeNode(nodeId: string): void {
    if (!this.config.allow_removal) {
      throw new Error("Node removal is not allowed");
    }
    this.currentNodes = this.currentNodes.filter(n => n.agent_id !== nodeId);
  }

  /**
   * Add a modification rule
   */
  addModificationRule(rule: ModificationRule): void {
    this.config.modification_rules.push(rule);
  }

  /**
   * Trigger manual modification
   */
  async triggerManualModification(rule: ModificationRule): Promise<void> {
    const pending: PendingModification = {
      rule,
      timestamp: Date.now(),
    };
    await this.applyModification(pending);
  }

  /**
   * Get current graph state
   */
  getCurrentGraphState(): { nodes: AgentNode[]; edges: EdgeConnection[] } {
    return {
      nodes: [...this.currentNodes],
      edges: [...this.currentEdges],
    };
  }

  /**
   * Get configuration
   */
  getConfig(): DynamicPatternConfig {
    return {
      initial_nodes: [...this.config.initial_nodes],
      modification_rules: [...this.config.modification_rules],
      allow_addition: this.config.allow_addition,
      allow_removal: this.config.allow_removal,
      allow_reconfiguration: this.config.allow_reconfiguration,
      graph: { ...this.config.graph },
    };
  }

  /**
   * Validate pattern configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const node of this.config.initial_nodes) {
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
   * Get visualization data
   */
  getVisualization(): {
    type: "dynamic";
    nodes: AgentNode[];
    edges: EdgeConnection[];
    modificationRules: ModificationRule[];
  } {
    return {
      type: "dynamic",
      nodes: [...this.currentNodes],
      edges: [...this.currentEdges],
      modificationRules: [...this.config.modification_rules],
    };
  }
}

/**
 * Create a dynamic pattern
 */
export function createDynamicPattern(
  config?: Partial<DynamicPatternConfig>
): DynamicPattern {
  return new DynamicPattern(config);
}

/**
 * Execute dynamic pattern
 */
export async function executeDynamic(
  nodes: AgentNode[],
  modificationRules: ModificationRule[],
  input: Record<string, unknown>
): Promise<ExecutionResult> {
  const pattern = createDynamicPattern({
    initial_nodes: nodes,
    modification_rules: modificationRules,
  });
  return pattern.execute(input);
}
