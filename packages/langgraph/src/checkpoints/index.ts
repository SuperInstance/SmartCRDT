/**
 * @fileoverview LangGraph Checkpoint Support
 *
 * Provides checkpoint support for LangGraph state persistence.
 */

import type { AequorState } from "../state/index.js";
import type {
  Checkpoint,
  CheckpointConfig as LangCheckpointConfig,
} from "@langchain/langgraph";

/**
 * Simple memory checkpointer
 */
class MemoryCheckpointer {
  private checkpoints: Map<string, AequorState> = new Map();

  async get(config: {
    configurable: { thread_id: string };
  }): Promise<AequorState | undefined> {
    const threadId = config.configurable.thread_id;
    return this.checkpoints.get(threadId);
  }

  async put(
    config: { configurable: { thread_id: string } },
    state: AequorState
  ): Promise<void> {
    const threadId = config.configurable.thread_id;
    this.checkpoints.set(threadId, state);
  }
}

/**
 * Create checkpointer for LangGraph
 */
export function createCheckpointer() {
  return new MemoryCheckpointer();
}

export default createCheckpointer;
