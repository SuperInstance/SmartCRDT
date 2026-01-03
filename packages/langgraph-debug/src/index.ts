/**
 * @lsi/langgraph-debug
 *
 * Debugging and Visualization Tools for LangGraph Agent Workflows
 *
 * Provides comprehensive debugging capabilities including:
 * - Execution tracing and event collection
 * - Graph visualization (Mermaid, Graphviz, HTML, SVG)
 * - State inspection and comparison
 * - Performance profiling and bottleneck detection
 * - Breakpoint management and step debugging
 * - Variable watching and change notifications
 * - Interactive debug console (REPL)
 * - Timeline visualization
 */

// Main integration
export {
  createDebugIntegration,
  getDebugIntegration,
  DebugIntegration,
} from "./integration.js";

// Individual components
export {
  TraceCollector,
  GraphVisualizer,
  StateInspector,
  Profiler,
  BreakpointManager,
  VariableWatcher,
  DebugConsole,
  TimelineView,
} from "./integration.js";

// Types
export * from "./types.js";

// Package version
export const PACKAGE_NAME = "@lsi/langgraph-debug";
export const PACKAGE_VERSION = "1.0.0";
