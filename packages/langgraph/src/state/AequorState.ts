/**
 * @fileoverview Aequor State - Shared state for LangGraph nodes
 *
 * Defines the state structure that flows through LangGraph nodes.
 */

/**
 * Aequor agent state
 */
export interface AequorState {
  /** User query */
  query: string;
  /** Intent vector (768-dim) */
  intent: number[];
  /** Routing decision */
  route: "local" | "cloud" | "hybrid";
  /** Privacy level */
  privacy: "public" | "sensitive" | "sovereign";
  /** Processed query (after privacy) */
  processedQuery?: string;
  /** Generated response */
  response?: string;
  /** Generated A2UI */
  ui?: unknown;
  /** Agent status */
  status: "idle" | "processing" | "waiting_human" | "complete" | "error";
  /** Session ID */
  sessionId: string;
  /** Complexity score (0-1) */
  complexity: number;
  /** Error if any */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create initial state
 */
export function createInitialState(
  query: string,
  sessionId?: string
): AequorState {
  return {
    query,
    intent: [],
    route: "local",
    privacy: "public",
    status: "idle",
    sessionId: sessionId ?? crypto.randomUUID(),
    complexity: 0,
  };
}

export default AequorState;
