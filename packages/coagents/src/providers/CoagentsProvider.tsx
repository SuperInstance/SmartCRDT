/**
 * @fileoverview CoAgents Provider - Main integration point for CopilotKit with Aequor
 *
 * This provider wraps the application with CopilotKit and connects it to the
 * Aequor LangGraph backend, enabling human-in-the-loop orchestration.
 *
 * Features:
 * - CopilotKit integration
 * - LangGraph backend connection
 * - Shared state synchronization
 * - Human checkpoint support
 * - React 19 features (use, useOptimistic)
 */

import React, { type ReactNode } from "react";
import { CopilotKit, type CopilotKitConfig } from "@copilotkit/copilotkit";
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import type { AequorState, AgentConfig } from "../state/index.js";
import { SharedStateManager } from "../state/SharedStateManager.js";

/**
 * Configuration for CoAgentsProvider
 */
export interface CoagentsProviderConfig {
  /** CopilotKit configuration */
  copilotKit?: Partial<CopilotKitConfig>;
  /** LangGraph backend URL */
  langgraphUrl: string;
  /** Agent configuration */
  agentConfig: AgentConfig;
  /** Enable human checkpoints */
  enableCheckpoints?: boolean;
  /** Auto-generate A2UI from agent state */
  autoGenerateUI?: boolean;
}

/**
 * Props for CoagentsProvider
 */
export interface CoagentsProviderProps {
  /** Child components */
  children: ReactNode;
  /** Provider configuration */
  config: CoagentsProviderConfig;
}

/**
 * CoagentsProvider Component
 *
 * Wraps the app with CopilotKit and sets up the integration with Aequor's
 * LangGraph orchestration backend.
 *
 * @example
 * ```tsx
 * <CoagentsProvider config={{
 *   langgraphUrl: '/api/langgraph',
 *   agentConfig: { ... },
 *   enableCheckpoints: true,
 *   autoGenerateUI: true,
 * }}>
 *   <App />
 * </CoagentsProvider>
 * ```
 */
export const CoagentsProvider: React.FC<CoagentsProviderProps> = ({
  children,
  config,
}) => {
  const {
    copilotKit,
    langgraphUrl,
    agentConfig,
    enableCheckpoints = true,
    autoGenerateUI = true,
  } = config;

  // Initialize shared state manager
  const stateManager = React.useMemo(
    () => new SharedStateManager({ langgraphUrl, enableCheckpoints }),
    [langgraphUrl, enableCheckpoints]
  );

  // Expose agent state to CopilotKit
  const AgentStateReader: React.FC = () => {
    const state = stateManager.useState();

    useCopilotReadable({
      description:
        "Current Aequor agent state including query, intent, route, and response",
      value: JSON.stringify(state, null, 2),
    });

    return null;
  };

  // Register agent action with CopilotKit
  const AgentActions: React.FC = () => {
    useCopilotAction({
      name: "process_agent_query",
      description:
        "Process a query through the Aequor agent with intent encoding and routing",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "The user query to process",
          required: true,
        },
        {
          name: "privacy_level",
          type: "string",
          description: "Privacy level: public, sensitive, or sovereign",
          required: false,
        },
      ],
      handler: async ({ query, privacy_level = "public" }) => {
        return await stateManager.processQuery(query, privacy_level);
      },
    });

    useCopilotAction({
      name: "approve_checkpoint",
      description: "Approve a human checkpoint and resume agent execution",
      parameters: [
        {
          name: "checkpoint_id",
          type: "string",
          description: "ID of the checkpoint to approve",
          required: true,
        },
        {
          name: "feedback",
          type: "string",
          description: "Optional feedback from human",
          required: false,
        },
      ],
      handler: async ({ checkpoint_id, feedback }) => {
        return await stateManager.approveCheckpoint(checkpoint_id, feedback);
      },
    });

    useCopilotAction({
      name: "reject_checkpoint",
      description: "Reject a checkpoint and halt agent execution",
      parameters: [
        {
          name: "checkpoint_id",
          type: "string",
          description: "ID of the checkpoint to reject",
          required: true,
        },
        {
          name: "reason",
          type: "string",
          description: "Reason for rejection",
          required: true,
        },
      ],
      handler: async ({ checkpoint_id, reason }) => {
        return await stateManager.rejectCheckpoint(checkpoint_id, reason);
      },
    });

    return null;
  };

  // CopilotKit configuration with Aequor integration
  const copilotConfig: CopilotKitConfig = {
    endpoint: `${langgraphUrl}/copilotkit`,
    ...copilotKit,
  };

  return (
    <CopilotKit {...copilotConfig}>
      <SharedStateContext.Provider value={stateManager}>
        <AgentStateReader />
        <AgentActions />
        {children}
      </SharedStateContext.Provider>
    </CopilotKit>
  );
};

/**
 * Context for accessing shared state manager
 */
export const SharedStateContext =
  React.createContext<SharedStateManager | null>(null);

/**
 * Hook to access shared state manager
 */
export function useSharedStateManager(): SharedStateManager {
  const context = React.useContext(SharedStateContext);
  if (!context) {
    throw new Error(
      "useSharedStateManager must be used within CoagentsProvider"
    );
  }
  return context;
}

export default CoagentsProvider;
