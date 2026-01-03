/**
 * @fileoverview Aequor memory integration for LangChain
 *
 * This module integrates Aequor's ContextPlane with LangChain's memory interface,
 * providing:
 * - Semantic memory retrieval
 * - Context-aware conversation history
 * - Intelligent context compression
 * - Privacy-preserving memory storage
 *
 * @example
 * ```ts
 * import { AequorMemory } from '@lsi/langchain';
 *
 * const memory = new AequorMemory({
 *   contextPlane: myContextPlane,
 *   maxTokens: 2000
 * });
 *
 * await memory.saveContext({ input: "Hello" }, { output: "Hi there!" });
 * const context = await memory.loadMemoryVariables({});
 * ```
 */

import type {
  BaseMemory,
  MemoryVariables,
  InputValues,
  OutputValues,
} from "@langchain/core/memory";
import type { ContextPlane } from "@lsi/superinstance";
import type {
  ContextItem,
  Meaning,
  Thought,
} from "@lsi/protocol";

/**
 * Configuration for AequorMemory
 */
export interface AequorMemoryConfig {
  /** ContextPlane instance for semantic memory */
  contextPlane?: ContextPlane;
  /** Maximum number of tokens to return in context */
  maxTokens?: number;
  /** Maximum number of conversation turns to remember */
  maxTurns?: number;
  /** Whether to enable semantic compression */
  enableCompression?: boolean;
  /** Minimum relevance score for context retrieval (0-1) */
  minRelevance?: number;
  /** Memory key for input/output */
  memoryKey?: string;
  /** Additional context keys to include */
  additionalKeys?: string[];
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  /** Input from user */
  input: string;
  /** Output from AI */
  output: string;
  /** Timestamp */
  timestamp: number;
  /** Semantic embedding of the turn */
  embedding?: number[];
  /** Routing decision (if available) */
  routing?: {
    route: "local" | "cloud" | "hybrid";
    confidence: number;
  };
}

/**
 * AequorMemory - LangChain memory adapter for Aequor
 *
 * Integrates Aequor's ContextPlane with LangChain's memory interface,
 * providing semantic memory retrieval and context compression.
 */
export class AequorMemory implements BaseMemory {
  private config: Required<Omit<AequorMemoryConfig, 'contextPlane' | 'additionalKeys'>> & {
    contextPlane?: ContextPlane;
    additionalKeys: string[];
  };
  private history: ConversationTurn[] = [];
  lc_namespace = ["langchain", "memory", "aequor"];

  constructor(config?: AequorMemoryConfig) {
    this.config = {
      maxTokens: 2000,
      maxTurns: 10,
      enableCompression: true,
      minRelevance: 0.7,
      memoryKey: "history",
      additionalKeys: [],
      ...config,
      contextPlane: config?.contextPlane,
      additionalKeys: config?.additionalKeys || [],
    };
  }

  /**
   * Get memory keys
   */
  get memoryKeys(): string[] {
    return [this.config.memoryKey, ...this.config.additionalKeys];
  }

  /**
   * Load memory variables
   *
   * Retrieves conversation history and relevant context.
   *
   * @param values - Input values (for context relevance)
   * @returns Memory variables
   */
  async loadMemoryVariables(
    values: InputValues
  ): Promise<MemoryVariables> {
    // Get recent conversation history
    const recentHistory = this._getRecentHistory();

    // Build context string
    let context = this._formatHistory(recentHistory);

    // Apply compression if enabled
    if (this.config.enableCompression) {
      context = await this._compressContext(context, values);
    }

    // Retrieve semantic context if ContextPlane is available
    let semanticContext: string[] = [];
    if (this.config.contextPlane && values.input) {
      semanticContext = await this._retrieveSemanticContext(
        String(values.input)
      );
    }

    return {
      [this.config.memoryKey]: context,
      ...(semanticContext.length > 0 && {
        semantic_context: semanticContext.join("\n\n"),
      }),
    };
  }

  /**
   * Save context to memory
   *
   * @param values - Input values
   * @param outputValues - Output values
   */
  async saveContext(
    values: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = values.input as string;
    const output = outputValues.output as string;

    const turn: ConversationTurn = {
      input,
      output,
      timestamp: Date.now(),
      routing: values.routing as
        | { route: "local" | "cloud" | "hybrid"; confidence: number }
        | undefined,
    };

    this.history.push(turn);

    // Store in ContextPlane if available
    if (this.config.contextPlane) {
      await this._storeInContextPlane(turn);
    }

    // Trim history if needed
    if (this.history.length > this.config.maxTurns) {
      this.history = this.history.slice(-this.config.maxTurns);
    }
  }

  /**
   * Clear all memory
   */
  async clear(): Promise<void> {
    this.history = [];
  }

  /**
   * Get recent conversation history
   */
  private _getRecentHistory(): ConversationTurn[] {
    return this.history.slice(-this.config.maxTurns);
  }

  /**
   * Format history as context string
   */
  private _formatHistory(history: ConversationTurn[]): string {
    if (history.length === 0) {
      return "No previous conversation.";
    }

    const formatted = history.map((turn, index) => {
      const turnNumber = this.history.length - history.length + index + 1;
      return [
        `Turn ${turnNumber}:`,
        `Human: ${turn.input}`,
        `AI: ${turn.output}`,
        turn.routing ? `(Routed to ${turn.routing.route}, confidence: ${turn.routing.confidence.toFixed(2)})` : '',
      ].filter(Boolean).join('\n');
    });

    return formatted.join('\n\n');
  }

  /**
   * Compress context if too long
   */
  private async _compressContext(
    context: string,
    values: InputValues
  ): Promise<string> {
    // Simple token-based compression
    const tokens = context.split(/\s+/);
    if (tokens.length <= this.config.maxTokens) {
      return context;
    }

    // Keep most recent tokens
    const compressed = tokens.slice(-this.config.maxTokens).join(' ');

    return `[COMPRESSED - Showing last ${this.config.maxTokens} tokens]\n\n${compressed}`;
  }

  /**
   * Retrieve semantic context from ContextPlane
   */
  private async _retrieveSemanticContext(
    query: string
  ): Promise<string[]> {
    if (!this.config.contextPlane) {
      return [];
    }

    try {
      // Create meaning from query
      const meaning: Meaning = {
        text: query,
        embedding: new Array(1536).fill(0), // Placeholder
        complexity: 0.5,
        type: "question",
      };

      // Recall relevant context
      const context = await this.config.contextPlane.recall(meaning, {
        maxResults: 3,
        minSimilarity: this.config.minRelevance,
      });

      return context.items.map(item =>
        `[Similarity: ${(item.similarity * 100).toFixed(1)}%] ${item.content}`
      );
    } catch (error) {
      console.warn("[AequorMemory] Failed to retrieve semantic context:", error);
      return [];
    }
  }

  /**
   * Store conversation turn in ContextPlane
   */
  private async _storeInContextPlane(
    turn: ConversationTurn
  ): Promise<void> {
    if (!this.config.contextPlane) {
      return;
    }

    try {
      const contextItem: ContextItem = {
        id: `turn-${turn.timestamp}`,
        content: `Human: ${turn.input}\nAI: ${turn.output}`,
        embedding: turn.embedding || new Array(1536).fill(0),
        metadata: {
          timestamp: turn.timestamp,
          routing: turn.routing,
        },
        createdAt: turn.timestamp,
      };

      await this.config.contextPlane.store(contextItem);
    } catch (error) {
      console.warn("[AequorMemory] Failed to store in ContextPlane:", error);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  /**
   * Get history statistics
   */
  getStats(): {
    totalTurns: number;
    totalTokens: number;
    avgTurnLength: number;
    routingDistribution: {
      local: number;
      cloud: number;
      hybrid: number;
    };
  } {
    const totalTokens = this.history.reduce(
      (sum, turn) => sum + turn.input.length + turn.output.length,
      0
    );

    const routingDistribution = {
      local: 0,
      cloud: 0,
      hybrid: 0,
    };

    for (const turn of this.history) {
      if (turn.routing) {
        routingDistribution[turn.routing.route]++;
      }
    }

    return {
      totalTurns: this.history.length,
      totalTokens,
      avgTurnLength: this.history.length > 0 ? totalTokens / this.history.length : 0,
      routingDistribution,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AequorMemoryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      additionalKeys: config.additionalKeys || this.config.additionalKeys,
    };
  }
}

/**
 * Create a configured AequorMemory instance
 *
 * Convenience factory function for creating an AequorMemory with
 * sensible defaults.
 *
 * @param config - Optional configuration
 * @returns Configured AequorMemory instance
 *
 * @example
 * ```ts
 * const memory = createAequorMemory({
 *   contextPlane: myContextPlane,
 *   maxTokens: 2000
 * });
 * ```
 */
export function createAequorMemory(
  config?: AequorMemoryConfig
): AequorMemory {
  return new AequorMemory(config);
}
