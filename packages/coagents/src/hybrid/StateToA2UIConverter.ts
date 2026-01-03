/**
 * @fileoverview State to A2UI Converter - Convert CoAgents state to A2UI format
 *
 * Converts CoAgents agent state into A2UI components and layouts.
 * This enables automatic UI generation from agent state.
 *
 * Features:
 * - Convert state to A2UI response
 * - Derive layout from state
 * - Extract components from state
 * - Generate actions from state
 * - Map tool calls to components
 */

import type {
  A2UIResponse,
  A2UIComponent,
  A2UILayout,
  A2UIAction,
} from "@lsi/protocol";
import type { AgentState } from "../state/SharedStateManager.js";

/**
 * Tool call interface
 */
interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

/**
 * Converter configuration
 */
export interface ConverterConfig {
  /** Default layout type */
  defaultLayout?: "vertical" | "horizontal" | "grid" | "tabs";
  /** Enable streaming updates */
  enableStreaming?: boolean;
  /** Component theme */
  theme?: "light" | "dark" | "auto";
}

/**
 * State to A2UI Converter class
 *
 * Converts CoAgents agent state to A2UI format.
 */
export class StateToA2UIConverter {
  private config: Required<ConverterConfig>;

  constructor(config: ConverterConfig = {}) {
    this.config = {
      defaultLayout: "vertical",
      enableStreaming: true,
      theme: "auto",
      ...config,
    };
  }

  /**
   * Convert agent state to A2UI response
   */
  convert(state: AgentState): A2UIResponse {
    const layout = this.deriveLayout(state);
    const components = this.extractComponents(state);
    const actions = this.generateActions(state);

    return {
      version: "1.0",
      layout,
      components,
      actions,
      metadata: {
        sessionId: state.sessionId,
        timestamp: Date.now(),
        status: state.status,
        theme: this.config.theme,
      },
    };
  }

  /**
   * Derive layout from agent state
   */
  deriveLayout(state: AgentState): A2UILayout {
    // Determine layout based on state
    const hasResponse = !!state.response;
    const hasUI = !!state.ui;
    const isWaiting = state.status === "waiting_human";

    if (isWaiting) {
      return {
        type: "modal",
        direction: "column",
        alignment: "center",
        padding: "large",
      };
    }

    if (hasUI) {
      // Use the UI from state if available
      return state.ui as A2UILayout;
    }

    // Default layout
    return {
      type: this.config.defaultLayout,
      direction: "column",
      alignment: "stretch",
      padding: "medium",
      spacing: "medium",
    };
  }

  /**
   * Extract components from agent state
   */
  extractComponents(state: AgentState): A2UIComponent[] {
    const components: A2UIComponent[] = [];

    // Add query display
    if (state.query) {
      components.push({
        id: "query-display",
        type: "text",
        props: {
          content: state.query,
          variant: "h6",
          style: { marginBottom: "1rem" },
        },
      });
    }

    // Add response display
    if (state.response) {
      components.push({
        id: "response-display",
        type: "markdown",
        props: {
          content: state.response,
          style: { padding: "1rem", background: "#f5f5f5" },
        },
      });
    }

    // Add status indicator
    components.push({
      id: "status-indicator",
      type: "badge",
      props: {
        label: state.status,
        color: this.getStatusColor(state.status),
      },
    });

    // Add metadata display
    if (state.metadata) {
      components.push({
        id: "metadata-display",
        type: "collapsible",
        props: {
          title: "Metadata",
          content: JSON.stringify(state.metadata, null, 2),
        },
      });
    }

    return components;
  }

  /**
   * Generate actions from agent state
   */
  generateActions(state: AgentState): A2UIAction[] {
    const actions: A2UIAction[] = [];

    // Add copy action
    if (state.response) {
      actions.push({
        id: "copy-response",
        type: "button",
        label: "Copy",
        icon: "copy",
        handler: "copy",
        props: {
          content: state.response,
        },
      });
    }

    // Add regenerate action
    actions.push({
      id: "regenerate",
      type: "button",
      label: "Regenerate",
      icon: "refresh",
      handler: "regenerate",
    });

    // Add feedback actions
    actions.push({
      id: "feedback-positive",
      type: "button",
      label: "Helpful",
      icon: "thumbs-up",
      handler: "feedback",
      props: {
        sentiment: "positive",
      },
    });

    actions.push({
      id: "feedback-negative",
      type: "button",
      label: "Not Helpful",
      icon: "thumbs-down",
      handler: "feedback",
      props: {
        sentiment: "negative",
      },
    });

    return actions;
  }

  /**
   * Convert tool calls to components
   */
  toolCallsToComponents(toolCalls: ToolCall[]): A2UIComponent[] {
    return toolCalls.map(tool => ({
      id: `tool-${tool.id}`,
      type: this.mapToolToComponent(tool.name),
      props: {
        ...tool.parameters,
        toolName: tool.name,
      },
    }));
  }

  /**
   * Map tool name to component type
   */
  private mapToolToComponent(toolName: string): A2UIComponent["type"] {
    const toolMap: Record<string, A2UIComponent["type"]> = {
      search: "search",
      calculator: "input",
      code_editor: "code",
      file_browser: "list",
      chart: "chart",
      table: "table",
      image: "image",
    };

    return toolMap[toolName] || "text";
  }

  /**
   * Get status color
   */
  private getStatusColor(status: AgentState["status"]): string {
    const colors: Record<AgentState["status"], string> = {
      idle: "default",
      processing: "primary",
      waiting_human: "warning",
      complete: "success",
      error: "error",
    };

    return colors[status] || "default";
  }
}

/**
 * Create default converter
 */
export function createConverter(
  config?: ConverterConfig
): StateToA2UIConverter {
  return new StateToA2UIConverter(config);
}

export default StateToA2UIConverter;
