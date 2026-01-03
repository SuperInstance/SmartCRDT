/**
 * @fileoverview Shared State Manager - State synchronization between frontend and backend
 *
 * ================================================================================
 * COAGENTS FRONTEND STATE MANAGEMENT
 * ================================================================================
 *
 * The SharedStateManager is the frontend state orchestration layer for CoAgents.
 * It manages bidirectional state synchronization between:
 *
 * 1. Frontend (React/Zustand): User-facing state and UI updates
 * 2. Backend (LangGraph): Agent execution and state transitions
 * 3. Checkpoints: Human-in-the-loop pauses requiring user input
 *
 * ================================================================================
 * ARCHITECTURE
 * ================================================================================
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        React Components                          │
 * │  (useAgentState, useCheckpoint, useOptimistic)                 │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │                    SharedStateManager                            │
 * │  - Zustand store (local state)                                  │
 * │  - Action dispatcher (reducer pattern)                          │
 * │  - Subscription system (listeners)                              │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *            ┌────────────────────┼────────────────────┐
 *            │                    │                    │
 * ┌──────────▼─────────┐  ┌───────▼──────┐  ┌────────▼─────────┐
 * │  LangGraph Adapter │  │ Checkpoint   │  │  WebSocket/SSE   │
 * │  (Backend calls)   │  │  Manager     │  │  (Real-time)     │
 * └────────────────────┘  └──────────────┘  └──────────────────┘
 *            │                    │                    │
 *            └────────────────────┼────────────────────┘
 *                                 │
 * ┌───────────────────────────────▼─────────────────────────────────┐
 * │                      Aequor Backend                              │
 * │  (LangGraph execution, state transitions, checkpoints)          │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ================================================================================
 * STATE LIFECYCLE
 * ================================================================================
 *
 * 1. User submits query:
 *    - processQuery() called
 *    - State updated to 'processing'
 *    - LangGraph invoked via adapter
 *
 * 2. Agent execution:
 *    - Nodes execute sequentially
 *    - State updates stream back
 *    - UI re-renders on each update
 *
 * 3. Checkpoint reached:
 *    - State updated to 'waiting_human'
 *    - Checkpoint added to pending checkpoints
 *    - UI shows approval dialog
 *
 * 4. User approves:
 *    - approveCheckpoint() called
 *    - Backend notified
 *    - Execution resumes
 *
 * 5. Completion:
 *    - Final state received
 *    - Response + UI generated
 *    - State updated to 'complete'
 *
 * ================================================================================
 * ACTIONS
 * ================================================================================
 *
 * The manager uses a reducer pattern for state updates:
 *
 * - SET_QUERY: Update user query
 * - SET_INTENT: Update intent vector
 * - SET_ROUTE: Update routing decision
 * - SET_PRIVACY: Update privacy level
 * - SET_RESPONSE: Update response text
 * - SET_UI: Update A2UI spec
 * - SET_STATUS: Update execution status
 * - SET_ERROR: Update error message
 * - RESET: Reset to initial state
 *
 * ================================================================================
 * REACT INTEGRATION
 * ================================================================================
 *
 * Components access state via hooks:
 *
 * ```typescript
 * // Read state
 * const state = useAgentState();
 * const { query, status, response } = state;
 *
 * // Update state
 * const { processQuery, approveCheckpoint } = useSharedStateManager();
 * await processQuery('Hello world');
 *
 * // Listen for changes
 * useEffect(() => {
 *   const unsubscribe = manager.subscribe((state) => {
 *     console.log('State changed:', state);
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 *
 * ================================================================================
 * CHECKPOINT HANDLING
 * ================================================================================
 *
 * When a checkpoint is reached:
 *
 * 1. Backend pauses execution
 * 2. Checkpoint data sent to frontend
 * 3. Stored in checkpoints Map
 * 4. UI renders checkpoint dialog
 * 5. User approves/rejects/modifies
 * 6. Decision sent to backend
 * 7. Execution resumes or terminates
 *
 * @see packages/coagents/src/checkpoints/CheckpointManager.ts for checkpoint types
 * @see packages/coagents/src/adapters/LangGraphAdapter.ts for backend integration
 * @see packages/coagents/src/hooks/useSharedState.ts for React hooks
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { LangGraphAdapter } from "../adapters/LangGraphAdapter.js";

/**
 * Agent state interface
 */
export interface AgentState {
  /** User query */
  query: string;
  /** Intent vector (768-dim) */
  intent: number[];
  /** Routing decision (local/cloud/hybrid) */
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
  /** Complexity score */
  complexity: number;
  /** Error if any */
  error?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Default privacy level */
  defaultPrivacy?: "public" | "sensitive" | "sovereign";
  /** Complexity threshold for routing */
  complexityThreshold?: number;
  /** Enable checkpoints */
  enableCheckpoints?: boolean;
  /** Checkpoint nodes */
  checkpointNodes?: string[];
}

/**
 * Agent action type
 */
export type AgentAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_INTENT"; payload: number[] }
  | { type: "SET_ROUTE"; payload: "local" | "cloud" | "hybrid" }
  | { type: "SET_PRIVACY"; payload: "public" | "sensitive" | "sovereign" }
  | { type: "SET_RESPONSE"; payload: string }
  | { type: "SET_UI"; payload: unknown }
  | { type: "SET_STATUS"; payload: AgentState["status"] }
  | { type: "SET_ERROR"; payload: string }
  | { type: "RESET" };

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Checkpoint ID */
  id: string;
  /** Type of checkpoint */
  type: "confirmation" | "input" | "approval" | "correction";
  /** Message to show user */
  message: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether checkpoint is required */
  required?: boolean;
  /** Node that triggers checkpoint */
  nodeId: string;
}

/**
 * Checkpoint result
 */
export interface CheckpointResult {
  /** Checkpoint ID */
  id: string;
  /** Checkpoint type */
  type: CheckpointConfig["type"];
  /** Message to user */
  message: string;
  /** Agent state at checkpoint */
  state: AgentState;
  /** Timestamp */
  timestamp: number;
  /** Whether required */
  required: boolean;
  /** Timeout */
  timeout?: number;
}

/**
 * Human input for checkpoint
 */
export interface HumanInput {
  /** Checkpoint ID */
  checkpointId: string;
  /** User decision */
  decision: "approve" | "reject" | "modify";
  /** User feedback */
  feedback?: string;
  /** Modified state (if correction) */
  modifiedState?: Partial<AgentState>;
}

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  /** LangGraph backend URL */
  langgraphUrl: string;
  /** Enable checkpoints */
  enableCheckpoints?: boolean;
  /** Sync interval in milliseconds */
  syncInterval?: number;
}

/**
 * Shared State Manager Store
 */
interface StateStore {
  /** Current agent state */
  state: AgentState;
  /** Pending checkpoints */
  checkpoints: Map<string, CheckpointResult>;
  /** Action dispatcher */
  dispatch: (action: AgentAction) => void;
  /** Update entire state */
  setState: (state: Partial<AgentState>) => void;
  /** Process query through agent */
  processQuery: (query: string, privacy?: string) => Promise<AgentState>;
  /** Approve checkpoint */
  approveCheckpoint: (id: string, feedback?: string) => Promise<void>;
  /** Reject checkpoint */
  rejectCheckpoint: (id: string, reason: string) => Promise<void>;
  /** Subscribe to state changes */
  subscribe: (listener: (state: AgentState) => void) => () => void;
}

/**
 * Shared State Manager class
 *
 * Manages state synchronization between frontend and backend.
 */
export class SharedStateManager {
  private config: StateManagerConfig;
  private store: ReturnType<typeof createStateStore>;
  private adapter: LangGraphAdapter;
  private listeners: Set<(state: AgentState) => void> = new Set();
  private syncInterval?: ReturnType<typeof setInterval>;

  constructor(config: StateManagerConfig) {
    this.config = config;
    const { adapter, store } = this.initialize(config);
    this.adapter = adapter;
    this.store = store;

    // Start sync loop
    if (this.config.syncInterval && this.config.syncInterval > 0) {
      this.syncInterval = setInterval(
        () => this.syncState(),
        this.config.syncInterval
      );
    }
  }

  /**
   * Use hook for React components
   */
  useState(): AgentState {
    // This would be used with React's use() in components
    return this.store.getState().state;
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return this.store.getState().state;
  }

  /**
   * Update state
   */
  setState(update: Partial<AgentState>): void {
    this.store.getState().setState(update);
  }

  /**
   * Process a query through the agent
   */
  async processQuery(
    query: string,
    privacy: string = "public"
  ): Promise<AgentState> {
    const store = this.store.getState();
    return await store.processQuery(query, privacy);
  }

  /**
   * Approve a checkpoint
   */
  async approveCheckpoint(id: string, feedback?: string): Promise<void> {
    const store = this.store.getState();
    await store.approveCheckpoint(id, feedback);
  }

  /**
   * Reject a checkpoint
   */
  async rejectCheckpoint(id: string, reason: string): Promise<void> {
    const store = this.store.getState();
    await store.rejectCheckpoint(id, reason);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AgentState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Sync state with backend
   */
  private async syncState(): Promise<void> {
    // Fetch current state from backend
    try {
      const response = await fetch(`${this.config.langgraphUrl}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.getState().sessionId }),
      });
      if (response.ok) {
        const backendState = await response.json();
        this.setState(backendState);
      }
    } catch (error) {
      console.error("Failed to sync state:", error);
    }
  }

  /**
   * Notify listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Initialize store and adapter
   */
  private initialize(config: StateManagerConfig) {
    // Create Zustand store
    const store = createStateStore(config);

    // Create adapter
    const adapter = this.createAdapter();

    return { store, adapter };
  }

  /**
   * Create LangGraph adapter
   */
  private createAdapter(): LangGraphAdapter {
    // Dynamic import to avoid circular dependency
    const { LangGraphAdapter } = require("../adapters/LangGraphAdapter.js");
    return new LangGraphAdapter({
      backendUrl: this.config.langgraphUrl,
      enableCheckpoints: this.config.enableCheckpoints,
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  }
}

/**
 * Create Zustand store
 */
function createStateStore(config: StateManagerConfig) {
  return create<StateStore>()(
    devtools((set, get) => ({
      state: {
        query: "",
        intent: [],
        route: "local",
        privacy: "public",
        status: "idle",
        sessionId: crypto.randomUUID(),
        complexity: 0,
      },
      checkpoints: new Map(),

      dispatch: action => {
        set(state => {
          const newState = reducer(state.state, action);
          return { state: newState };
        });
      },

      setState: update => {
        set(state => ({
          state: { ...state.state, ...update },
        }));
      },

      processQuery: async (query, privacy = "public") => {
        set({
          state: { ...get().state, query, privacy, status: "processing" },
        });

        // Invoke LangGraph
        const adapter =
          new (require("../adapters/LangGraphAdapter.js").LangGraphAdapter)({
            backendUrl: config.langgraphUrl,
          });

        try {
          const result = await adapter.invoke({
            ...get().state,
            query,
            privacy,
          });

          set({ state: result });
          return result;
        } catch (error) {
          set({
            state: {
              ...get().state,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          throw error;
        }
      },

      approveCheckpoint: async (id, feedback) => {
        const checkpoint = get().checkpoints.get(id);
        if (!checkpoint) throw new Error(`Checkpoint not found: ${id}`);

        // Send approval to backend
        await fetch(`${config.langgraphUrl}/checkpoint/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkpointId: id, feedback }),
        });

        // Remove checkpoint
        set(state => {
          const checkpoints = new Map(state.checkpoints);
          checkpoints.delete(id);
          return { checkpoints };
        });
      },

      rejectCheckpoint: async (id, reason) => {
        const checkpoint = get().checkpoints.get(id);
        if (!checkpoint) throw new Error(`Checkpoint not found: ${id}`);

        // Send rejection to backend
        await fetch(`${config.langgraphUrl}/checkpoint/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkpointId: id, reason }),
        });

        // Update status to error
        set({
          state: {
            ...get().state,
            status: "error",
            error: reason,
          },
        });
      },

      subscribe: listener => {
        // Subscribe is handled by SharedStateManager class
        return () => {};
      },
    }))
  );
}

/**
 * Reducer for agent actions
 */
function reducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.payload };
    case "SET_INTENT":
      return { ...state, intent: action.payload };
    case "SET_ROUTE":
      return { ...state, route: action.payload };
    case "SET_PRIVACY":
      return { ...state, privacy: action.payload };
    case "SET_RESPONSE":
      return { ...state, response: action.payload };
    case "SET_UI":
      return { ...state, ui: action.payload };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, status: "error" };
    case "RESET":
      return {
        ...state,
        query: "",
        intent: [],
        response: undefined,
        ui: undefined,
        status: "idle",
        error: undefined,
      };
    default:
      return state;
  }
}

export default SharedStateManager;
