/**
 * @fileoverview React hooks for accessing CoAgents shared state
 *
 * Provides React hooks for accessing and manipulating shared agent state
 * using React 19 features (use, useOptimistic).
 */

import { use, useOptimistic, useState, useCallback, useEffect } from "react";
import type {
  AgentState,
  AgentAction,
  HumanInput,
} from "../state/SharedStateManager.js";
import { useSharedStateManager } from "../providers/CoagentsProvider.js";
import type { CheckpointResult } from "../state/index.js";

/**
 * Hook to access shared agent state
 *
 * @example
 * ```tsx
 * const state = useAgentState();
 * console.log(state.query, state.status);
 * ```
 */
export function useAgentState(): AgentState {
  const manager = useSharedStateManager();
  return manager.useState();
}

/**
 * Hook to update agent state with optimistic updates
 *
 * @example
 * ```tsx
 * const [state, update] = useOptimisticState();
 * update({ type: 'SET_QUERY', payload: 'Hello' });
 * ```
 */
export function useOptimisticState(): [
  AgentState,
  (action: AgentAction) => void,
] {
  const manager = useSharedStateManager();
  const state = manager.useState();
  const [optimisticState, setOptimisticState] = useOptimistic(state);

  const dispatch = useCallback((action: AgentAction) => {
    setOptimisticState(prev => {
      // Apply action optimistically
      switch (action.type) {
        case "SET_QUERY":
          return { ...prev, query: action.payload };
        case "SET_RESPONSE":
          return { ...prev, response: action.payload };
        case "SET_STATUS":
          return { ...prev, status: action.payload };
        default:
          return prev;
      }
    });
  }, []);

  return [optimisticState, dispatch];
}

/**
 * Hook to process queries through the agent
 *
 * @example
 * ```tsx
 * const { processQuery, isLoading, error } = useAgentAction();
 * await processQuery('What is the weather?');
 * ```
 */
export function useAgentAction() {
  const manager = useSharedStateManager();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const processQuery = useCallback(
    async (query: string, privacy?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await manager.processQuery(query, privacy);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error("Unknown error");
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [manager]
  );

  return { processQuery, isLoading, error };
}

/**
 * Hook to manage checkpoints
 *
 * @example
 * ```tsx
 * const { checkpoints, approve, reject, waitForCheckpoint } = useCheckpoint();
 * await approve('checkpoint-123', 'Looks good');
 * ```
 */
export function useCheckpoint() {
  const manager = useSharedStateManager();
  const [checkpoints, setCheckpoints] = useState<Map<string, CheckpointResult>>(
    new Map()
  );

  // Subscribe to checkpoint updates
  useEffect(() => {
    return manager.subscribe(state => {
      // Update checkpoints when state changes
      if (state.status === "waiting_human") {
        // Would get checkpoint from state
      }
    });
  }, [manager]);

  const approve = useCallback(
    async (id: string, feedback?: string) => {
      await manager.approveCheckpoint(id, feedback);
      setCheckpoints(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [manager]
  );

  const reject = useCallback(
    async (id: string, reason: string) => {
      await manager.rejectCheckpoint(id, reason);
      setCheckpoints(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [manager]
  );

  const waitForCheckpoint = useCallback(
    async (id: string): Promise<HumanInput> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Checkpoint timeout"));
        }, 30000); // 30 second default

        const unsubscribe = manager.subscribe(state => {
          if (state.status !== "waiting_human") {
            clearTimeout(timeout);
            unsubscribe();
            resolve({
              checkpointId: id,
              decision: "approve",
            });
          }
        });
      });
    },
    [manager]
  );

  return { checkpoints, approve, reject, waitForCheckpoint };
}

/**
 * Hook to subscribe to state changes
 *
 * @example
 * ```tsx
 * useAgentStateChange((state) => {
 *   console.log('State changed:', state);
 * });
 * ```
 */
export function useAgentStateChange(
  callback: (state: AgentState) => void,
  deps: unknown[] = []
): void {
  const manager = useSharedStateManager();

  useEffect(() => {
    const unsubscribe = manager.subscribe(callback);
    return unsubscribe;
  }, [manager, ...deps]);
}

/**
 * Hook to get agent history
 *
 * @example
 * ```tsx
 * const { history, addHistory, clearHistory } = useAgentHistory();
 * ```
 */
export function useAgentHistory() {
  const [history, setHistory] = useState<
    Array<{ timestamp: number; state: AgentState }>
  >([]);

  const addHistory = useCallback((state: AgentState) => {
    setHistory(prev => [...prev, { timestamp: Date.now(), state }]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addHistory, clearHistory };
}

export default useAgentState;
