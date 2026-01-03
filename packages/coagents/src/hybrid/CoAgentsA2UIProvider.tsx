/**
 * @fileoverview CoAgents + A2UI Hybrid Provider
 *
 * Combines CoAgents and A2UI for seamless agent-driven UI generation.
 * Streams agent state as A2UI updates in real-time.
 *
 * Features:
 * - Combine CoAgents and A2UI
 * - Stream agent state as A2UI updates
 * - Handle human interactions
 * - Sync state bidirectionally
 * - React 19 features (use, useOptimistic)
 */

import React, { type ReactNode } from "react";
import { use } from "react";
import {
  CoagentsProvider,
  useSharedStateManager,
} from "../providers/CoagentsProvider.js";
import { StateToA2UIConverter } from "./StateToA2UIConverter.js";
import { A2UIProvider } from "@lsi/a2ui/renderer";
import type { A2UIResponse, AgentState } from "../state/index.js";
import type { ConverterConfig } from "./StateToA2UIConverter.js";

/**
 * Hybrid provider configuration
 */
export interface HybridProviderConfig {
  /** LangGraph backend URL */
  langgraphUrl: string;
  /** Converter configuration */
  converter?: ConverterConfig;
  /** Auto-generate UI on state change */
  autoGenerateUI?: boolean;
  /** Enable streaming UI updates */
  enableStreaming?: boolean;
}

/**
 * Props for CoAgentsA2UIProvider
 */
export interface CoAgentsA2UIProviderProps {
  /** Child components */
  children: ReactNode;
  /** Provider configuration */
  config: HybridProviderConfig;
}

/**
 * CoAgents + A2UI Hybrid Provider
 *
 * Combines both providers for seamless integration.
 *
 * @example
 * ```tsx
 * <CoAgentsA2UIProvider config={{
 *   langgraphUrl: '/api/langgraph',
 *   autoGenerateUI: true,
 *   enableStreaming: true,
 * }}>
 *   <App />
 * </CoAgentsA2UIProvider>
 * ```
 */
export const CoAgentsA2UIProvider: React.FC<CoAgentsA2UIProviderProps> = ({
  children,
  config,
}) => {
  const {
    langgraphUrl,
    converter,
    autoGenerateUI = true,
    enableStreaming = true,
  } = config;

  // Create converter instance
  const converterInstance = React.useMemo(
    () => new StateToA2UIConverter(converter),
    [converter]
  );

  return (
    <CoagentsProvider
      config={{
        langgraphUrl,
        agentConfig: {},
        enableCheckpoints: true,
        autoGenerateUI,
      }}
    >
      <HybridA2UIWrapper
        converter={converterInstance}
        autoGenerateUI={autoGenerateUI}
        enableStreaming={enableStreaming}
      >
        {children}
      </HybridA2UIWrapper>
    </CoagentsProvider>
  );
};

/**
 * Internal wrapper component
 */
const HybridA2UIWrapper: React.FC<{
  children: ReactNode;
  converter: StateToA2UIConverter;
  autoGenerateUI: boolean;
  enableStreaming: boolean;
}> = ({ children, converter, autoGenerateUI, enableStreaming }) => {
  const manager = useSharedStateManager();
  const state = manager.useState();
  const [uiResponse, setUIResponse] = React.useState<A2UIResponse | null>(null);

  // Generate UI when state changes
  React.useEffect(() => {
    if (autoGenerateUI && state.status !== "idle") {
      const ui = converter.convert(state);
      setUIResponse(ui);
    }
  }, [state, converter, autoGenerateUI]);

  // Subscribe to streaming updates
  React.useEffect(() => {
    if (!enableStreaming) return;

    const unsubscribe = manager.subscribe(newState => {
      if (autoGenerateUI && newState.status !== "idle") {
        const ui = converter.convert(newState);
        setUIResponse(ui);
      }
    });

    return unsubscribe;
  }, [manager, converter, autoGenerateUI, enableStreaming]);

  return (
    <A2UIProvider
      initialUI={uiResponse ?? undefined}
      onAction={handleAction}
      config={{
        streaming: enableStreaming,
        theme: "auto",
      }}
    >
      {children}
    </A2UIProvider>
  );
};

/**
 * Handle A2UI actions
 */
async function handleAction(
  action: string,
  props?: Record<string, unknown>
): Promise<void> {
  switch (action) {
    case "copy":
      if (props?.content) {
        await navigator.clipboard.writeText(props.content as string);
      }
      break;

    case "regenerate":
      // Trigger regeneration via manager
      break;

    case "feedback":
      // Send feedback
      console.log("Feedback:", props);
      break;

    default:
      console.log("Unknown action:", action, props);
  }
}

/**
 * Hook to use CoAgents + A2UI hybrid
 */
export function useHybridA2UI() {
  const manager = useSharedStateManager();
  const state = manager.useState();
  const converter = React.useMemo(() => new StateToA2UIConverter(), []);

  const generateUI = React.useCallback(
    (agentState?: AgentState) => {
      return converter.convert(agentState ?? state);
    },
    [converter, state]
  );

  return {
    state,
    generateUI,
    converter,
  };
}

export default CoAgentsA2UIProvider;
