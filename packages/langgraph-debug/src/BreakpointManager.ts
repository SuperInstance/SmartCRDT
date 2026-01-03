/**
 * Breakpoint Manager for LangGraph Debugging
 *
 * Manages breakpoints for debugging agent workflows, including
 * conditional breakpoints and execution control.
 */

import type {
  Breakpoint,
  TraceEvent,
  DebugSession,
  LogLevel,
} from "./types.js";

/**
 * Breakpoint hit result
 */
interface BreakpointHit {
  breakpoint: Breakpoint;
  event: TraceEvent;
  context: {
    currentState: Record<string, unknown>;
    traceId: string;
  };
}

/**
 * Breakpoint callback function type
 */
type BreakpointCallback = (hit: BreakpointHit) => void | Promise<void>;

/**
 * Execution state for stepping
 */
interface ExecutionState {
  paused: boolean;
  currentTraceId: string | null;
  currentNode: string | null;
  stepMode: "none" | "step_over" | "step_into" | "step_out" | "continue";
  skipDepth: number;
}

/**
 * Breakpoint Manager Class
 *
 * Manages breakpoints and execution control for debugging.
 */
export class BreakpointManager {
  private breakpoints: Map<string, Breakpoint> = new Map();
  private breakpointCounter = 0;
  private executionState: ExecutionState = {
    paused: false,
    currentTraceId: null,
    currentNode: null,
    stepMode: "none",
    skipDepth: 0,
  };
  private callbacks: Map<string, BreakpointCallback> = new Map();
  private hitHistory: Map<string, number> = new Map();

  /**
   * Add a breakpoint on a node
   */
  addBreakpoint(options: {
    nodeName?: string;
    agentId?: string;
    condition?: string;
  }): Breakpoint {
    const breakpoint: Breakpoint = {
      breakpoint_id: `bp_${++this.breakpointCounter}`,
      node_name: options.nodeName,
      agent_id: options.agentId,
      condition: options.condition,
      enabled: true,
      hit_count: 0,
      created_at: Date.now(),
    };

    this.breakpoints.set(breakpoint.breakpoint_id, breakpoint);
    return breakpoint;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(breakpointId: string): boolean {
    this.callbacks.delete(breakpointId);
    return this.breakpoints.delete(breakpointId);
  }

  /**
   * Enable a breakpoint
   */
  enableBreakpoint(breakpointId: string): boolean {
    const bp = this.breakpoints.get(breakpointId);
    if (bp) {
      bp.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a breakpoint
   */
  disableBreakpoint(breakpointId: string): boolean {
    const bp = this.breakpoints.get(breakpointId);
    if (bp) {
      bp.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get a breakpoint by ID
   */
  getBreakpoint(breakpointId: string): Breakpoint | undefined {
    return this.breakpoints.get(breakpointId);
  }

  /**
   * Get all breakpoints
   */
  getAllBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get breakpoints for a node
   */
  getBreakpointsForNode(nodeName: string): Breakpoint[] {
    return Array.from(this.breakpoints.values()).filter(
      bp => bp.node_name === nodeName && bp.enabled
    );
  }

  /**
   * Check if an event should trigger a breakpoint
   */
  async checkBreakpoint(
    event: TraceEvent,
    context: {
      currentState: Record<string, unknown>;
      traceId: string;
    }
  ): Promise<BreakpointHit | null> {
    if (!this.shouldCheckBreakpoint(event)) {
      return null;
    }

    for (const breakpoint of this.breakpoints.values()) {
      if (!breakpoint.enabled) {
        continue;
      }

      if (this.shouldHitBreakpoint(breakpoint, event, context.currentState)) {
        // Update hit count
        breakpoint.hit_count++;
        this.hitHistory.set(breakpoint.breakpoint_id, breakpoint.hit_count);

        // Check max hits
        if (
          breakpoint.max_hits &&
          breakpoint.hit_count >= breakpoint.max_hits
        ) {
          breakpoint.enabled = false;
        }

        const hit: BreakpointHit = {
          breakpoint,
          event,
          context,
        };

        // Trigger callback
        const callback = this.callbacks.get(breakpoint.breakpoint_id);
        if (callback) {
          await callback(hit);
        }

        return hit;
      }
    }

    return null;
  }

  /**
   * Determine if we should check for breakpoints on this event
   */
  private shouldCheckBreakpoint(event: TraceEvent): boolean {
    if (this.executionState.stepMode === "continue") {
      return false;
    }

    // Check step modes
    if (this.executionState.stepMode !== "none") {
      return this.shouldStep(event);
    }

    return event.event_type === "node_start" || event.event_type === "node_end";
  }

  /**
   * Check if a breakpoint should be hit
   */
  private shouldHitBreakpoint(
    breakpoint: Breakpoint,
    event: TraceEvent,
    state: Record<string, unknown>
  ): boolean {
    // Check node match
    if (breakpoint.node_name && event.node_name !== breakpoint.node_name) {
      return false;
    }

    // Check agent match
    if (breakpoint.agent_id && event.agent_id !== breakpoint.agent_id) {
      return false;
    }

    // Check condition if present
    if (breakpoint.condition) {
      return this.evaluateCondition(breakpoint.condition, event, state);
    }

    return true;
  }

  /**
   * Evaluate a breakpoint condition
   */
  private evaluateCondition(
    condition: string,
    event: TraceEvent,
    state: Record<string, unknown>
  ): boolean {
    try {
      // Create a safe evaluation context
      const context = {
        event: { ...event },
        state: { ...state },
        timestamp: event.timestamp,
        nodeName: event.node_name,
        agentId: event.agent_id,
      };

      // Simple condition evaluation (for production, use a proper expression parser)
      const func = new Function(
        "event",
        "state",
        "timestamp",
        "nodeName",
        "agentId",
        `return ${condition}`
      );

      return func(
        context.event,
        context.state,
        context.timestamp,
        context.nodeName,
        context.agentId
      );
    } catch (error) {
      console.error(
        `Error evaluating breakpoint condition: ${condition}`,
        error
      );
      return false;
    }
  }

  /**
   * Register a callback for a breakpoint
   */
  onBreakpointHit(breakpointId: string, callback: BreakpointCallback): void {
    this.callbacks.set(breakpointId, callback);
  }

  /**
   * Pause execution at the next opportunity
   */
  pause(): void {
    this.executionState.paused = true;
    this.executionState.stepMode = "step_over";
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.executionState.paused = false;
    this.executionState.stepMode = "none";
    this.executionState.skipDepth = 0;
  }

  /**
   * Step over the current node
   */
  stepOver(): void {
    this.executionState.paused = false;
    this.executionState.stepMode = "step_over";
    this.executionState.skipDepth = 0;
  }

  /**
   * Step into the next node
   */
  stepInto(): void {
    this.executionState.paused = false;
    this.executionState.stepMode = "step_into";
    this.executionState.skipDepth = 0;
  }

  /**
   * Step out of the current node
   */
  stepOut(): void {
    this.executionState.paused = false;
    this.executionState.stepMode = "step_out";
    this.executionState.skipDepth = 1;
  }

  /**
   * Continue to next breakpoint
   */
  continue(): void {
    this.executionState.paused = false;
    this.executionState.stepMode = "continue";
  }

  /**
   * Check if we should stop for stepping
   */
  private shouldStep(event: TraceEvent): boolean {
    switch (this.executionState.stepMode) {
      case "step_over":
        // Stop at same depth
        return this.executionState.skipDepth === 0;

      case "step_into":
        // Always stop
        return true;

      case "step_out":
        // Stop when returning to a lower depth
        if (this.executionState.skipDepth === 0) {
          this.executionState.stepMode = "none";
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Update execution depth for stepping
   */
  updateDepth(delta: number): void {
    this.executionState.skipDepth += delta;
  }

  /**
   * Get current execution state
   */
  getExecutionState(): ExecutionState {
    return { ...this.executionState };
  }

  /**
   * Check if execution is paused
   */
  isPaused(): boolean {
    return this.executionState.paused;
  }

  /**
   * Set current trace and node for context
   */
  setCurrentContext(traceId: string, nodeName: string | null): void {
    this.executionState.currentTraceId = traceId;
    this.executionState.currentNode = nodeName;
  }

  /**
   * Clear all breakpoints
   */
  clearAllBreakpoints(): void {
    this.breakpoints.clear();
    this.callbacks.clear();
    this.breakpointCounter = 0;
  }

  /**
   * Clear hit history
   */
  clearHitHistory(): void {
    this.hitHistory.clear();
    for (const bp of this.breakpoints.values()) {
      bp.hit_count = 0;
    }
  }

  /**
   * Get hit count for a breakpoint
   */
  getHitCount(breakpointId: string): number {
    return this.breakpoints.get(breakpointId)?.hit_count ?? 0;
  }

  /**
   * Get hit history for all breakpoints
   */
  getHitHistory(): Map<string, number> {
    return new Map(this.hitHistory);
  }

  /**
   * Find breakpoints that haven't been hit
   */
  findUnhitBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values()).filter(
      bp => bp.hit_count === 0 && bp.enabled
    );
  }

  /**
   * Find frequently hit breakpoints
   */
  findFrequentlyHitBreakpoints(threshold = 10): Breakpoint[] {
    return Array.from(this.breakpoints.values()).filter(
      bp => bp.hit_count >= threshold
    );
  }

  /**
   * Disable all breakpoints
   */
  disableAllBreakpoints(): void {
    for (const bp of this.breakpoints.values()) {
      bp.enabled = false;
    }
  }

  /**
   * Enable all breakpoints
   */
  enableAllBreakpoints(): void {
    for (const bp of this.breakpoints.values()) {
      bp.enabled = true;
    }
  }

  /**
   * Toggle a breakpoint
   */
  toggleBreakpoint(breakpointId: string): boolean | null {
    const bp = this.breakpoints.get(breakpointId);
    if (bp) {
      bp.enabled = !bp.enabled;
      return bp.enabled;
    }
    return null;
  }

  /**
   * Update breakpoint condition
   */
  updateCondition(breakpointId: string, condition: string): boolean {
    const bp = this.breakpoints.get(breakpointId);
    if (bp) {
      bp.condition = condition;
      return true;
    }
    return false;
  }

  /**
   * Set max hits for a breakpoint
   */
  setMaxHits(breakpointId: string, maxHits: number): boolean {
    const bp = this.breakpoints.get(breakpointId);
    if (bp) {
      bp.max_hits = maxHits;
      return true;
    }
    return false;
  }

  /**
   * Clone a breakpoint
   */
  cloneBreakpoint(breakpointId: string): Breakpoint | null {
    const original = this.breakpoints.get(breakpointId);
    if (!original) {
      return null;
    }

    const cloned: Breakpoint = {
      ...original,
      breakpoint_id: `bp_${++this.breakpointCounter}`,
      hit_count: 0,
      created_at: Date.now(),
    };

    this.breakpoints.set(cloned.breakpoint_id, cloned);
    return cloned;
  }

  /**
   * Get breakpoint statistics
   */
  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    totalHits: number;
    unhit: number;
  } {
    const bps = Array.from(this.breakpoints.values());
    return {
      total: bps.length,
      enabled: bps.filter(bp => bp.enabled).length,
      disabled: bps.filter(bp => !bp.enabled).length,
      totalHits: bps.reduce((sum, bp) => sum + bp.hit_count, 0),
      unhit: bps.filter(bp => bp.hit_count === 0).length,
    };
  }

  /**
   * Export breakpoints as JSON
   */
  exportBreakpoints(): string {
    return JSON.stringify(Array.from(this.breakpoints.values()), null, 2);
  }

  /**
   * Import breakpoints from JSON
   */
  importBreakpoints(jsonData: string): Breakpoint[] {
    const imported = JSON.parse(jsonData) as Breakpoint[];
    const breakpoints: Breakpoint[] = [];

    for (const bp of imported) {
      const newBp: Breakpoint = {
        ...bp,
        breakpoint_id: `bp_${++this.breakpointCounter}`,
        hit_count: 0,
      };
      this.breakpoints.set(newBp.breakpoint_id, newBp);
      breakpoints.push(newBp);
    }

    return breakpoints;
  }

  /**
   * Validate breakpoint configuration
   */
  validateBreakpoint(breakpoint: Breakpoint): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!breakpoint.node_name && !breakpoint.agent_id) {
      errors.push("Breakpoint must specify either node_name or agent_id");
    }

    if (breakpoint.condition) {
      try {
        // Try to parse the condition
        new Function("return " + breakpoint.condition);
      } catch (error) {
        errors.push(`Invalid condition: ${breakpoint.condition}`);
      }
    }

    if (breakpoint.max_hits !== undefined && breakpoint.max_hits <= 0) {
      errors.push("max_hits must be positive");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create breakpoint from expression
   */
  createBreakpointFromExpression(expression: string): Breakpoint | null {
    // Parse expressions like "break at node_name" or "break when condition"
    const match = expression.match(/break\s+(?:at\s+(\w+)|(?:when)\s+(.+))/i);

    if (!match) {
      return null;
    }

    const nodeName = match[1];
    const condition = match[2];

    return this.addBreakpoint({
      nodeName,
      condition,
    });
  }
}
