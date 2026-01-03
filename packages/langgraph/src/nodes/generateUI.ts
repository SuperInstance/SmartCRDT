/**
 * @fileoverview Generate UI Node - LangGraph node for A2UI generation
 *
 * Node that generates A2UI from agent state.
 */

import type { AequorState } from "../state/index.js";

/**
 * Generate UI node handler
 *
 * Generates A2UI from the agent state for display to the user.
 */
export async function generateUINode(
  state: AequorState
): Promise<Partial<AequorState>> {
  try {
    // TODO: Call actual A2UI generator
    const ui = {
      type: "surface",
      layout: "vertical",
      components: [
        {
          type: "text",
          content: state.response,
        },
      ],
    };

    return {
      ui,
      status: "complete",
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to generate UI",
    };
  }
}

export default generateUINode;
