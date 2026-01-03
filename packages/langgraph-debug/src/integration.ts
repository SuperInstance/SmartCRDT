/**
 * LangGraph Debug Integration
 *
 * Integrates debugging tools with LangGraph, CoAgents, and VL-JEPA
 * for comprehensive debugging and visualization.
 */

import type {
  ExecutionTrace,
  DebugSession,
  DebugSessionConfig,
  GraphStructure,
  TraceEvent,
  StateSnapshot,
} from "./types.js";

import { TraceCollector } from "./TraceCollector.js";
import { GraphVisualizer } from "./GraphVisualizer.js";
import { StateInspector } from "./StateInspector.js";
import { Profiler } from "./Profiler.js";
import { BreakpointManager } from "./BreakpointManager.js";
import { VariableWatcher } from "./VariableWatcher.js";
import { DebugConsole } from "./DebugConsole.js";
import { TimelineView } from "./TimelineView.js";

/**
 * Integration options
 */
export interface DebugIntegrationOptions {
  enableTracing?: boolean;
  enableProfiling?: boolean;
  enableVisualization?: boolean;
  enableBreakpoints?: boolean;
  enableWatches?: boolean;
  enableConsole?: boolean;
  logLevel?: "trace" | "debug" | "info" | "warn" | "error";
  autoExport?: boolean;
  exportPath?: string;
}

/**
 * Complete debug toolkit integration
 */
export class DebugIntegration {
  private collector: TraceCollector;
  private visualizer: GraphVisualizer;
  private inspector: StateInspector;
  private profiler: Profiler;
  private breakpoints: BreakpointManager;
  private watcher: VariableWatcher;
  private console: DebugConsole;
  private timeline: TimelineView;

  private activeSessionId: string | null = null;
  private enabled: boolean = false;

  constructor(options: DebugIntegrationOptions = {}) {
    this.collector = new TraceCollector();
    this.visualizer = new GraphVisualizer();
    this.inspector = new StateInspector();
    this.profiler = new Profiler();
    this.breakpoints = new BreakpointManager();
    this.watcher = new VariableWatcher();
    this.console = new DebugConsole();
    this.timeline = new TimelineView();

    this.enabled = options.enableTracing ?? true;
  }

  // ========== Session Management ==========

  /**
   * Start a debug session for a LangGraph workflow
   */
  startSession(
    graphId: string,
    graphConfig: Record<string, unknown>,
    options: Partial<DebugSessionConfig> = {}
  ): DebugSession {
    const session = this.collector.createSession(graphId, graphConfig, options);
    this.activeSessionId = session.session_id;

    // Register console commands
    this.registerConsoleCommands();

    return session;
  }

  /**
   * Get the active session
   */
  getActiveSession(): DebugSession | null {
    return this.activeSessionId
      ? this.collector.getSession(this.activeSessionId)
      : null;
  }

  /**
   * End the current debug session
   */
  endSession(): void {
    if (this.activeSessionId) {
      this.collector.clearSession(this.activeSessionId);
      this.activeSessionId = null;
    }
  }

  // ========== Tracing Integration ==========

  /**
   * Start a trace for execution
   */
  startTrace(initialState: Record<string, unknown>): ExecutionTrace | null {
    if (!this.activeSessionId) {
      return null;
    }

    return this.collector.startTrace(this.activeSessionId, initialState);
  }

  /**
   * Record a trace event
   */
  recordEvent(eventData: {
    event_type: TraceEvent["event_type"];
    node_name?: string;
    agent_id?: string;
    data: Record<string, unknown>;
  }): TraceEvent | null {
    if (!this.activeSessionId) {
      return null;
    }

    return this.collector.recordEvent(this.activeSessionId, eventData);
  }

  /**
   * End the current trace
   */
  endTrace(finalState?: Record<string, unknown>): void {
    if (this.activeSessionId) {
      this.collector.endTrace(this.activeSessionId, finalState);
    }
  }

  /**
   * Record a state snapshot
   */
  recordSnapshot(
    state: Record<string, unknown>,
    changedKeys: string[] = []
  ): StateSnapshot | null {
    if (!this.activeSessionId) {
      return null;
    }

    const snapshot = this.collector.recordSnapshot(
      this.activeSessionId,
      state,
      changedKeys
    );

    if (snapshot) {
      this.inspector.addSnapshot(this.activeSessionId, snapshot);
    }

    return snapshot;
  }

  // ========== Profiling Integration ==========

  /**
   * Start profiling a trace
   */
  startProfiling(traceId: string): void {
    this.profiler.startProfiling(traceId);
  }

  /**
   * Record node start for profiling
   */
  recordNodeStart(traceId: string, nodeId: string, nodeName: string): void {
    this.profiler.recordNodeStart(traceId, nodeId, nodeName);
  }

  /**
   * Record node end for profiling
   */
  recordNodeEnd(traceId: string, nodeId: string, success = true): void {
    this.profiler.recordNodeEnd(traceId, nodeId, success);
  }

  /**
   * End profiling and get report
   */
  endProfiling(traceId: string, graphId: string) {
    return this.profiler.endProfiling(traceId, graphId);
  }

  // ========== Visualization Integration ==========

  /**
   * Generate graph visualization
   */
  visualizeGraph(
    graph: GraphStructure,
    format: "mermaid" | "graphviz" | "html" | "svg" = "html"
  ): string {
    return this.visualizer.generateVisualization(graph, { format });
  }

  /**
   * Visualize execution trace
   */
  visualizeTrace(
    trace: ExecutionTrace,
    format: "mermaid" | "html" = "html"
  ): string {
    const graph = this.visualizer.graphFromTrace(trace);
    const path = this.visualizer.highlightExecutionPath(graph, trace);

    return this.visualizer.generateVisualization(graph, {
      format,
      highlight_path: path,
      show_timing: true,
    });
  }

  /**
   * Generate timeline visualization
   */
  visualizeTimeline(
    trace: ExecutionTrace,
    format: "html" | "mermaid" = "html"
  ): string {
    const entries = this.timeline.generateTimeline(trace);

    if (format === "html") {
      return this.timeline.generateHTMLTimeline(entries);
    } else {
      return this.timeline.generateMermaidTimeline(entries);
    }
  }

  // ========== Breakpoint Integration ==========

  /**
   * Set a breakpoint
   */
  setBreakpoint(options: {
    nodeName?: string;
    agentId?: string;
    condition?: string;
  }) {
    return this.breakpoints.addBreakpoint(options);
  }

  /**
   * Check if breakpoint should hit
   */
  async checkBreakpoint(
    event: TraceEvent,
    currentState: Record<string, unknown>
  ) {
    if (!this.activeSessionId) {
      return null;
    }

    const trace = this.collector.getActiveTrace();
    return this.breakpoints.checkBreakpoint(event, {
      currentState,
      traceId: trace?.trace_id ?? "",
    });
  }

  // ========== Watch Integration ==========

  /**
   * Add a variable watch
   */
  addWatch(variablePath: string, condition?: string) {
    return this.watcher.addWatch({ variablePath, condition });
  }

  /**
   * Check watches for state changes
   */
  async checkWatches(
    currentState: Record<string, unknown>,
    snapshot: StateSnapshot
  ) {
    if (!this.activeSessionId) {
      return [];
    }

    return this.watcher.checkWatches(
      this.activeSessionId,
      currentState,
      snapshot
    );
  }

  // ========== Console Integration ==========

  /**
   * Execute a console command
   */
  async executeConsoleCommand(command: string) {
    const session = this.getActiveSession();
    if (session) {
      this.console.updateContext({
        current_state:
          this.inspector.getCurrentState(this.activeSessionId!) ?? {},
        active_trace: session.active_trace,
      });
    }

    return this.console.executeCommand(command);
  }

  /**
   * Register debug console commands
   */
  private registerConsoleCommands(): void {
    // State inspection
    this.console.registerCommand("inspect_state", async (args, context) => {
      if (!this.activeSessionId) return "No active session";
      return this.inspector.getCurrentState(this.activeSessionId);
    });

    this.console.registerCommand("compare_states", async (args, context) => {
      if (!this.activeSessionId || args.length < 2)
        return "Usage: compare_states <snapshot1> <snapshot2>";
      const history = this.inspector.getStateHistory(this.activeSessionId);
      const snap1 = history.find(s => s.snapshot_id === args[0]);
      const snap2 = history.find(s => s.snapshot_id === args[1]);
      if (!snap1 || !snap2) return "Snapshot not found";
      return this.inspector.compareSnapshots(snap1, snap2);
    });

    // Trace inspection
    this.console.registerCommand("list_traces", async (args, context) => {
      if (!this.activeSessionId) return "No active session";
      return this.collector.getTraces(this.activeSessionId);
    });

    this.console.registerCommand("get_trace", async (args, context) => {
      if (!this.activeSessionId || !args[0])
        return "Usage: get_trace <trace_id>";
      return this.collector.getTrace(this.activeSessionId, args[0]);
    });

    // Profiling
    this.console.registerCommand("profile", async (args, context) => {
      return this.profiler.getAllProfiles();
    });

    this.console.registerCommand("bottlenecks", async (args, context) => {
      const profiles = this.profiler.getAllProfiles();
      const report = this.profiler["generateReport"]("debug", []);
      return report.bottlenecks;
    });

    // Visualization
    this.console.registerCommand("visualize", async (args, context) => {
      const format = args[0] as "mermaid" | "html" | "svg";
      if (!context.active_trace) return "No active trace";
      return this.visualizeTrace(context.active_trace, format);
    });

    // Timeline
    this.console.registerCommand("timeline", async (args, context) => {
      if (!context.active_trace) return "No active trace";
      const entries = this.timeline.generateTimeline(context.active_trace);
      return this.timeline.generateReport(entries, context.active_trace);
    });

    // Breakpoints
    this.console.registerCommand("list_breakpoints", async (args, context) => {
      return this.breakpoints.getAllBreakpoints();
    });

    this.console.registerCommand("set_breakpoint", async (args, context) => {
      const nodeName = args[0];
      const condition = args[1];
      return this.breakpoints.addBreakpoint({ nodeName, condition });
    });

    // Watches
    this.console.registerCommand("list_watches", async (args, context) => {
      return this.watcher.getAllWatches();
    });

    this.console.registerCommand("add_watch", async (args, context) => {
      const variablePath = args[0];
      const condition = args[1];
      return this.watcher.addWatch({ variablePath, condition });
    });

    // Export
    this.console.registerCommand("export", async (args, context) => {
      if (!this.activeSessionId) return "No active session";
      const format = args[0] as "json" | "csv" | "html";
      return this.collector.exportTraces(this.activeSessionId, { format });
    });
  }

  // ========== LangGraph Integration ==========

  /**
   * Wrap a LangGraph for automatic tracing
   */
  wrapLangGraph<T extends Record<string, unknown>>(
    graph: T,
    graphId: string
  ): T {
    const wrapped = { ...graph };

    // Wrap invoke method if present
    if (typeof wrapped.invoke === "function") {
      const originalInvoke = wrapped.invoke.bind(wrapped);
      wrapped.invoke = async (...args: unknown[]) => {
        this.startTrace({ args });
        const result = await originalInvoke(...args);
        this.endTrace({ result });
        return result;
      };
    }

    // Wrap stream method if present
    if (typeof wrapped.stream === "function") {
      const originalStream = wrapped.stream.bind(wrapped);
      wrapped.stream = async function* (...args: unknown[]) {
        this.startTrace({ args });
        yield* originalStream(...args);
        this.endTrace();
      };
    }

    return wrapped;
  }

  // ========== CoAgents Integration ==========

  /**
   * Wrap CoAgents for debugging
   */
  wrapCoAgent<T extends Record<string, unknown>>(agent: T, agentId: string): T {
    const wrapped = { ...agent };

    // Wrap run method
    if (typeof wrapped.run === "function") {
      const originalRun = wrapped.run.bind(wrapped);
      wrapped.run = async (...args: unknown[]) => {
        this.recordEvent({
          event_type: "node_start",
          agent_id: agentId,
          data: { args },
        });

        const result = await originalRun(...args);

        this.recordEvent({
          event_type: "node_end",
          agent_id: agentId,
          data: { result },
        });

        return result;
      };
    }

    return wrapped;
  }

  // ========== VL-JEPA Integration ==========

  /**
   * Collect VL-JEPA training traces
   */
  collectVLJEPATrace(data: {
    epoch: number;
    batch: number;
    loss: number;
    metrics: Record<string, number>;
  }): void {
    this.recordEvent({
      event_type: "custom",
      agent_id: "vl-jepa",
      data,
    });
  }

  // ========== Browser DevTools Integration ==========

  /**
   * Enable Chrome DevTools integration
   */
  enableDevTools(): void {
    if (typeof window !== "undefined") {
      // Expose debug interface to console
      (window as any).__aequor_debug = {
        getSession: () => this.getActiveSession(),
        getState: () =>
          this.activeSessionId
            ? this.inspector.getCurrentState(this.activeSessionId)
            : null,
        getTraces: () =>
          this.activeSessionId
            ? this.collector.getTraces(this.activeSessionId)
            : [],
        getProfiles: () => this.profiler.getAllProfiles(),
        getBreakpoints: () => this.breakpoints.getAllBreakpoints(),
        getWatches: () => this.watcher.getAllWatches(),
        visualize: (traceId: string) => {
          if (!this.activeSessionId) return null;
          const trace = this.collector.getTrace(this.activeSessionId, traceId);
          return trace ? this.visualizeTrace(trace, "html") : null;
        },
        console: this.console,
      };

      console.log("Aequor Debug Tools available at window.__aequor_debug");
    }
  }

  // ========== Export ==========

  /**
   * Export all debug data
   */
  async exportAll(format: "json" | "html" = "json"): Promise<string> {
    if (!this.activeSessionId) {
      throw new Error("No active session");
    }

    const exportResult = await this.collector.exportTraces(
      this.activeSessionId,
      {
        format: format === "json" ? "json" : "html",
        include_metrics: true,
        include_timeline: true,
        include_snapshots: true,
      }
    );

    if (typeof exportResult.output === "string") {
      return exportResult.output;
    }

    return new TextDecoder().decode(exportResult.output);
  }

  /**
   * Get complete debug report
   */
  generateDebugReport(): string {
    const session = this.getActiveSession();
    if (!session) {
      return "No active debug session";
    }

    const lines: string[] = [];
    lines.push("# Aequor Debug Report");
    lines.push(`\nSession: ${session.session_id}`);
    lines.push(`Started: ${new Date(session.start_time).toISOString()}`);
    lines.push(`Status: ${session.status}`);
    lines.push(`\n## Traces: ${session.traces.length}`);

    for (const trace of session.traces) {
      lines.push(`\n### Trace: ${trace.trace_id}`);
      lines.push(`- Duration: ${trace.duration_ms.toFixed(2)}ms`);
      lines.push(`- Events: ${trace.events.length}`);
      lines.push(`- Status: ${trace.status}`);
    }

    lines.push(`\n## Breakpoints: ${session.breakpoints.length}`);
    for (const bp of session.breakpoints) {
      lines.push(
        `- ${bp.breakpoint_id}: ${bp.node_name} (${bp.enabled ? "enabled" : "disabled"})`
      );
    }

    lines.push(`\n## Watches: ${session.watches.length}`);
    for (const watch of session.watches) {
      lines.push(`- ${watch.watch_id}: ${watch.variable_path}`);
    }

    return lines.join("\n");
  }

  // ========== Statistics ==========

  /**
   * Get debug statistics
   */
  getStatistics(): {
    sessions: number;
    totalTraces: number;
    totalEvents: number;
    breakpoints: number;
    watches: number;
  } {
    const sessions = this.collector.getAllSessions();
    const totalTraces = sessions.reduce((sum, s) => sum + s.traces.length, 0);
    const totalEvents = sessions.reduce(
      (sum, s) => sum + s.traces.reduce((eSum, t) => eSum + t.events.length, 0),
      0
    );

    return {
      sessions: sessions.length,
      totalTraces,
      totalEvents,
      breakpoints: this.breakpoints.getAllBreakpoints().length,
      watches: this.watcher.getAllWatches().length,
    };
  }
}

/**
 * Create a debug integration instance
 */
export function createDebugIntegration(
  options: DebugIntegrationOptions = {}
): DebugIntegration {
  return new DebugIntegration(options);
}

/**
 * Global debug instance (singleton)
 */
let globalDebugIntegration: DebugIntegration | null = null;

/**
 * Get or create the global debug integration
 */
export function getDebugIntegration(
  options?: DebugIntegrationOptions
): DebugIntegration {
  if (!globalDebugIntegration) {
    globalDebugIntegration = new DebugIntegration(options);
  }
  return globalDebugIntegration;
}

// Export all components
export {
  TraceCollector,
  GraphVisualizer,
  StateInspector,
  Profiler,
  BreakpointManager,
  VariableWatcher,
  DebugConsole,
  TimelineView,
};

// Export types
export * from "./types.js";
