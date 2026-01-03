/**
 * Trace Collector for LangGraph Execution
 *
 * Collects, filters, samples, and exports execution traces for debugging
 * and performance analysis.
 */

import type {
  TraceEvent,
  ExecutionTrace,
  DebugSession,
  DebugSessionConfig,
  EventFilter,
  TraceExportOptions,
  TraceExportResult,
  LogLevel,
  TraceEventType,
  StateSnapshot,
} from "./types.js";

/**
 * Trace Collector Class
 *
 * Manages collection of execution traces with filtering, sampling,
 * and export capabilities.
 */
export class TraceCollector {
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId: string | null = null;
  private eventBuffer: Map<string, TraceEvent[]> = new Map();
  private sessionIdCounter = 0;
  private traceIdCounter = 0;

  /**
   * Create a new debug session
   */
  createSession(
    graphId: string,
    graphConfig: Record<string, unknown>,
    config: Partial<DebugSessionConfig> = {}
  ): DebugSession {
    const sessionId = `session_${++this.sessionIdCounter}`;
    const defaultConfig: DebugSessionConfig = {
      enable_tracing: true,
      log_level: "info",
      sampling_rate: 1.0,
      enable_profiling: true,
      enable_snapshots: true,
      snapshot_interval_ms: 1000,
      max_events: 10000,
      break_on_error: true,
      verbose: false,
    };

    const session: DebugSession = {
      session_id: sessionId,
      graph_config: graphConfig,
      config: { ...defaultConfig, ...config },
      traces: [],
      start_time: Date.now(),
      status: "active",
      breakpoints: [],
      watches: [],
      metadata: { graph_id: graphId },
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;
    this.eventBuffer.set(sessionId, []);

    return session;
  }

  /**
   * Get an active debug session
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get the currently active session
   */
  getActiveSession(): DebugSession | null {
    return this.activeSessionId
      ? (this.sessions.get(this.activeSessionId) ?? null)
      : null;
  }

  /**
   * Start a new execution trace
   */
  startTrace(
    sessionId: string,
    initialState: Record<string, unknown>
  ): ExecutionTrace {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const traceId = `trace_${++this.traceIdCounter}`;
    const graphId = session.metadata.graph_id as string;

    const trace: ExecutionTrace = {
      trace_id: traceId,
      graph_id: graphId,
      start_time: Date.now(),
      end_time: 0,
      duration_ms: 0,
      events: [],
      metrics: {
        total_time_ms: 0,
        node_times: new Map(),
        nodes_executed: 0,
        edges_traversed: 0,
        error_count: 0,
        warning_count: 0,
        avg_node_time_ms: 0,
      },
      timeline: [],
      state_snapshots: [],
      final_state: {},
      initial_state: initialState,
      status: "running",
      metadata: {},
    };

    session.active_trace = trace;
    session.traces.push(trace);

    // Record graph_start event
    this.recordEvent(sessionId, {
      event_type: "graph_start",
      data: { initial_state },
      agent_id: graphId,
    });

    return trace;
  }

  /**
   * End an execution trace
   */
  endTrace(sessionId: string, finalState?: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (!session?.active_trace) {
      return;
    }

    const trace = session.active_trace;
    trace.end_time = Date.now();
    trace.duration_ms = trace.end_time - trace.start_time;
    trace.status = "completed";

    if (finalState) {
      trace.final_state = finalState;
    }

    // Calculate final metrics
    trace.metrics.total_time_ms = trace.duration_ms;
    trace.metrics.avg_node_time_ms =
      trace.metrics.nodes_executed > 0
        ? trace.duration_ms / trace.metrics.nodes_executed
        : 0;

    // Record graph_end event
    this.recordEvent(sessionId, {
      event_type: "graph_end",
      data: {
        duration_ms: trace.duration_ms,
        final_state: trace.final_state,
      },
      agent_id: trace.graph_id,
    });

    session.active_trace = undefined;
  }

  /**
   * Record a trace event
   */
  recordEvent(
    sessionId: string,
    eventData: Partial<TraceEvent> & {
      event_type: TraceEventType;
      data: Record<string, unknown>;
    }
  ): TraceEvent | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.config.enable_tracing) {
      return null;
    }

    // Apply sampling
    if (Math.random() > session.config.sampling_rate) {
      return null;
    }

    const trace = session.active_trace;
    const graphId = session.metadata.graph_id as string;

    const event: TraceEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event_type: eventData.event_type,
      timestamp: Date.now(),
      agent_id: eventData.agent_id,
      node_name: eventData.node_name,
      graph_id: graphId,
      trace_id: trace?.trace_id ?? "",
      parent_event_id: eventData.parent_event_id,
      data: eventData.data,
      priority: this.determinePriority(eventData.event_type),
      level: this.determineLogLevel(eventData.event_type),
      metadata: eventData.metadata,
    };

    // Apply filters
    if (!this.shouldIncludeEvent(session, event)) {
      return null;
    }

    // Add to buffer
    const buffer = this.eventBuffer.get(sessionId) ?? [];
    buffer.push(event);
    this.eventBuffer.set(sessionId, buffer);

    // Add to active trace
    if (trace) {
      trace.events.push(event);

      // Update metrics based on event type
      this.updateMetricsFromEvent(trace, event);
    }

    // Check max events limit
    if (
      session.config.max_events &&
      buffer.length > session.config.max_events
    ) {
      buffer.shift(); // Remove oldest event
    }

    return event;
  }

  /**
   * Determine event priority based on type
   */
  private determinePriority(eventType: TraceEventType): TraceEvent["priority"] {
    switch (eventType) {
      case "error":
        return "critical";
      case "warning":
        return "high";
      case "node_start":
      case "node_end":
      case "graph_start":
      case "graph_end":
        return "medium";
      default:
        return "low";
    }
  }

  /**
   * Determine log level based on event type
   */
  private determineLogLevel(eventType: TraceEventType): LogLevel {
    switch (eventType) {
      case "error":
        return "error";
      case "warning":
        return "warn";
      case "graph_start":
      case "graph_end":
      case "node_start":
      case "node_end":
        return "info";
      default:
        return "debug";
    }
  }

  /**
   * Check if event should be included based on filters
   */
  private shouldIncludeEvent(
    session: DebugSession,
    event: TraceEvent
  ): boolean {
    // Check log level filter
    const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];
    if (
      levels.indexOf(event.level) < levels.indexOf(session.config.log_level)
    ) {
      return false;
    }

    // Apply custom filters
    for (const filter of session.config.event_filters ?? []) {
      if (
        filter.event_types &&
        !filter.event_types.includes(event.event_type)
      ) {
        continue;
      }
      if (
        filter.agent_ids &&
        event.agent_id &&
        !filter.agent_ids.includes(event.agent_id)
      ) {
        continue;
      }
      if (
        filter.node_names &&
        event.node_name &&
        !filter.node_names.includes(event.node_name)
      ) {
        continue;
      }
      if (filter.min_level) {
        const minLevelIndex = levels.indexOf(filter.min_level);
        const eventLevelIndex = levels.indexOf(event.level);
        if (eventLevelIndex < minLevelIndex) {
          continue;
        }
      }
      if (filter.custom_filter && !filter.custom_filter(event)) {
        continue;
      }
      return true;
    }

    // Include if no filters or no filters matched
    return (
      !session.config.event_filters || session.config.event_filters.length === 0
    );
  }

  /**
   * Update trace metrics from event
   */
  private updateMetricsFromEvent(
    trace: ExecutionTrace,
    event: TraceEvent
  ): void {
    switch (event.event_type) {
      case "node_start":
        trace.metrics.nodes_executed++;
        break;
      case "edge_traversal":
        trace.metrics.edges_traversed++;
        break;
      case "error":
        trace.metrics.error_count++;
        break;
      case "warning":
        trace.metrics.warning_count++;
        break;
    }
  }

  /**
   * Record a state snapshot
   */
  recordSnapshot(
    sessionId: string,
    state: Record<string, unknown>,
    changedKeys: string[] = []
  ): StateSnapshot | null {
    const session = this.sessions.get(sessionId);
    const trace = session?.active_trace;

    if (!trace || !session?.config.enable_snapshots) {
      return null;
    }

    const parentSnapshot =
      trace.state_snapshots.length > 0
        ? trace.state_snapshots[trace.state_snapshots.length - 1]
        : undefined;

    const snapshot: StateSnapshot = {
      snapshot_id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      graph_id: trace.graph_id,
      state: { ...state },
      version: trace.state_snapshots.length,
      changed_keys,
      parent_snapshot_id: parentSnapshot?.snapshot_id,
    };

    trace.state_snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get events for a session
   */
  getEvents(sessionId: string, filters?: Partial<EventFilter>): TraceEvent[] {
    const buffer = this.eventBuffer.get(sessionId) ?? [];
    if (!filters) {
      return [...buffer];
    }

    return buffer.filter(event => {
      if (
        filters.event_types &&
        !filters.event_types.includes(event.event_type)
      ) {
        return false;
      }
      if (
        filters.agent_ids &&
        event.agent_id &&
        !filters.agent_ids.includes(event.agent_id)
      ) {
        return false;
      }
      if (
        filters.node_names &&
        event.node_name &&
        !filters.node_names.includes(event.node_name)
      ) {
        return false;
      }
      if (filters.custom_filter && !filters.custom_filter(event)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get traces for a session
   */
  getTraces(sessionId: string): ExecutionTrace[] {
    const session = this.sessions.get(sessionId);
    return session?.traces ?? [];
  }

  /**
   * Get a specific trace
   */
  getTrace(sessionId: string, traceId: string): ExecutionTrace | undefined {
    const session = this.sessions.get(sessionId);
    return session?.traces.find(t => t.trace_id === traceId);
  }

  /**
   * Aggregate events by type
   */
  aggregateEventsByType(sessionId: string): Map<TraceEventType, number> {
    const events = this.getEvents(sessionId);
    const counts = new Map<TraceEventType, number>();

    for (const event of events) {
      const count = counts.get(event.event_type) ?? 0;
      counts.set(event.event_type, count + 1);
    }

    return counts;
  }

  /**
   * Aggregate events by agent/node
   */
  aggregateEventsByAgent(sessionId: string): Map<string, number> {
    const events = this.getEvents(sessionId);
    const counts = new Map<string, number>();

    for (const event of events) {
      const key = event.agent_id ?? event.node_name ?? "unknown";
      const count = counts.get(key) ?? 0;
      counts.set(key, count + 1);
    }

    return counts;
  }

  /**
   * Export traces to various formats
   */
  async exportTraces(
    sessionId: string,
    options: TraceExportOptions = {
      format: "json",
      include_metrics: true,
      include_timeline: true,
      include_snapshots: true,
      compress: false,
    }
  ): Promise<TraceExportResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let traces = session.traces;

    // Apply time range filter
    if (options.time_range) {
      traces = traces.filter(
        t =>
          t.start_time >= options.time_range!.start &&
          t.start_time <= options.time_range!.end
      );
    }

    // Calculate event count
    const eventCount = traces.reduce((sum, t) => sum + t.events.length, 0);

    let output: string | Uint8Array;

    switch (options.format) {
      case "json":
        output = this.exportAsJSON(traces, options);
        break;
      case "csv":
        output = this.exportAsCSV(traces, options);
        break;
      case "html":
        output = this.exportAsHTML(traces, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    const sizeBytes =
      typeof output === "string" ? new Blob([output]).size : output.byteLength;

    const result: TraceExportResult = {
      export_id: `export_${Date.now()}`,
      format: options.format,
      exported_at: Date.now(),
      output,
      size_bytes: sizeBytes,
      trace_count: traces.length,
      event_count: eventCount,
    };

    return result;
  }

  /**
   * Export traces as JSON
   */
  private exportAsJSON(
    traces: ExecutionTrace[],
    options: TraceExportOptions
  ): string {
    const data: Record<string, unknown>[] = traces.map(trace => {
      const obj: Record<string, unknown> = {
        trace_id: trace.trace_id,
        graph_id: trace.graph_id,
        start_time: trace.start_time,
        end_time: trace.end_time,
        duration_ms: trace.duration_ms,
        status: trace.status,
        events: trace.events,
      };

      if (options.include_metrics) {
        obj.metrics = {
          ...trace.metrics,
          node_times: Array.from(trace.metrics.node_times.entries()),
        };
      }

      if (options.include_timeline) {
        obj.timeline = trace.timeline;
      }

      if (options.include_snapshots) {
        obj.state_snapshots = trace.state_snapshots;
      }

      return obj;
    });

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export traces as CSV
   */
  private exportAsCSV(
    traces: ExecutionTrace[],
    options: TraceExportOptions
  ): string {
    const headers = [
      "trace_id",
      "graph_id",
      "event_id",
      "event_type",
      "timestamp",
      "agent_id",
      "node_name",
      "level",
      "priority",
    ];

    const rows: string[][] = [headers];

    for (const trace of traces) {
      for (const event of trace.events) {
        rows.push([
          trace.trace_id,
          trace.graph_id,
          event.event_id,
          event.event_type,
          event.timestamp.toString(),
          event.agent_id ?? "",
          event.node_name ?? "",
          event.level,
          event.priority,
        ]);
      }
    }

    return rows.map(row => row.join(",")).join("\n");
  }

  /**
   * Export traces as HTML
   */
  private exportAsHTML(
    traces: ExecutionTrace[],
    options: TraceExportOptions
  ): string {
    const tracesHTML = traces
      .map(
        trace => `
        <div class="trace">
          <h2>Trace: ${trace.trace_id}</h2>
          <p><strong>Graph:</strong> ${trace.graph_id}</p>
          <p><strong>Duration:</strong> ${trace.duration_ms}ms</p>
          <p><strong>Status:</strong> ${trace.status}</p>
          ${
            options.include_metrics
              ? `<div class="metrics">
              <h3>Metrics</h3>
              <p>Nodes Executed: ${trace.metrics.nodes_executed}</p>
              <p>Edges Traversed: ${trace.metrics.edges_traversed}</p>
              <p>Errors: ${trace.metrics.error_count}</p>
              <p>Warnings: ${trace.metrics.warning_count}</p>
            </div>`
              : ""
          }
          <div class="events">
            <h3>Events (${trace.events.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Agent/Node</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                ${trace.events
                  .map(
                    event => `
                  <tr>
                    <td>${new Date(event.timestamp).toISOString()}</td>
                    <td>${event.event_type}</td>
                    <td>${event.agent_id ?? event.node_name ?? ""}</td>
                    <td>${event.level}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>LangGraph Debug Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .trace { margin-bottom: 40px; padding: 20px; border: 1px solid #ccc; }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>LangGraph Debug Export</h1>
          <p>Exported: ${new Date().toISOString()}</p>
          ${tracesHTML}
        </body>
      </html>
    `;
  }

  /**
   * Clear all data for a session
   */
  clearSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.traces = [];
      session.active_trace = undefined;
      this.eventBuffer.set(sessionId, []);
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
    this.eventBuffer.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }
}
