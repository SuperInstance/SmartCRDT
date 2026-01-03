/**
 * @fileoverview Hook for accessing agent state by ID
 *
 * Provides hook for accessing state of a specific agent when multiple
 * agents are running concurrently.
 */

import { use, useMemo } from "react";
import type { AgentState } from "../state/SharedStateManager.js";
import { useSharedStateManager } from "../providers/CoagentsProvider.js";

/**
 * Hook to access state for a specific agent
 *
 * @param agentId - The agent ID to get state for
 * @returns The agent state or null if agent not found
 *
 * @example
 * ```tsx
 * const agentState = useAgentById('agent-123');
 * if (agentState) {
 *   console.log(agentState.query, agentState.status);
 * }
 * ```
 */
export function useAgentById(agentId: string): AgentState | null {
  const manager = useSharedStateManager();
  const state = manager.useState();

  return useMemo(() => {
    // If sessionId matches, return state
    if (state.sessionId === agentId) {
      return state;
    }
    // Otherwise, would look up in multi-agent registry
    return null;
  }, [state, agentId]);
}

/**
 * Hook to list all active agents
 *
 * @returns Array of agent IDs
 *
 * @example
 * ```tsx
 * const agentIds = useAgentList();
 * agentIds.forEach(id => {
 *   const state = useAgentById(id);
 *   // ...
 * });
 * ```
 */
export function useAgentList(): string[] {
  const manager = useSharedStateManager();
  const state = manager.useState();

  return useMemo(() => {
    // For now, just return current session
    return [state.sessionId];
  }, [state.sessionId]);
}

/**
 * Hook to create a new agent session
 *
 * @returns Function to create new agent
 *
 * @example
 * ```tsx
 * const { createAgent, currentAgentId } = useNewAgent();
 * const newId = createAgent({ privacy: 'sensitive' });
 * ```
 */
export function useNewAgent() {
  const manager = useSharedStateManager();
  const [currentAgentId, setCurrentAgentId] = use(() => {
    return manager.useState().sessionId;
  });

  const createAgent = (config?: {
    privacy?: "public" | "sensitive" | "sovereign";
  }) => {
    const newId = crypto.randomUUID();
    // Would create new agent state in backend
    setCurrentAgentId(newId);
    return newId;
  };

  const switchAgent = (agentId: string) => {
    setCurrentAgentId(agentId);
  };

  return { createAgent, switchAgent, currentAgentId };
}

export default useAgentById;
