/**
 * @fileoverview Aequor LangGraph - Main agent orchestration graph
 *
 * ================================================================================
 * AEQUOR MULTI-AGENT ORCHESTRATION GRAPH
 * ================================================================================
 *
 * This module defines the complete LangGraph workflow for Aequor agent
 * orchestration. It connects all agent nodes into a unified processing pipeline
 * that handles queries from user input to UI generation.
 *
 * ================================================================================
 * GRAPH STRUCTURE
 * ================================================================================
 *
 * ```
 *                    ┌─────────────────────────────────────────────────────────┐
 *                    │                        ENTRY                            │
 *                    │                     User Query                         │
 *                    └────────────────────────────┬────────────────────────────┘
 *                                                 │
 *                                                 ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  encode_intent: Encode query to 768-dim intent vector                        │
 * │  - Uses IntentEncoder with epsilon-differential privacy                     │
 * │  - Calculates query complexity score                                        │
 * │  - Output: { intent, complexity }                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                                 │
 *                                                 ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  route_query: Decide execution path based on complexity & privacy           │
 * │  - Complexity < 0.7 AND NOT sovereign → local                               │
 * │  - Complexity >= 0.7 OR sensitive → cloud (via privacy)                     │
 * │  - Sovereign data → local (never cloud)                                     │
 * │  - Output: { route }                                                        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                                 │
 *                     ┌───────────────────────────┴───────────────────┐
 *                     │                                               │
 *                     │ (route === 'cloud' OR 'hybrid')               │ (route === 'local')
 *                     ▼                                               ▼
 * ┌───────────────────────────────┐                   ┌───────────────────────────────┐
 * │  apply_privacy: Privacy layer │                   │  [SKIP - Direct to response]  │
 * │  - Redact sensitive info      │                   │                               │
 * │  - Encode with R-A Protocol   │                   └───────────────────────────────┘
 * │  - Output: { processedQuery }  │                                    │
 * └───────────────────────────────┘                                    │
 *                     │                                                    │
 *                     └────────────────────────────┬───────────────────────┘
 *                                                  ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  generate_response: Call LLM to generate response                            │
 * │  - Local: Llama2 (or configured model)                                      │
 * │  - Cloud: GPT-4 (or configured model)                                       │
 * │  - Output: { response }                                                     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                                 │
 *                                                 ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  generate_ui: Generate A2UI from response                                    │
 * │  - Maps intent to UI requirements                                           │
 * │  - Selects components from catalog                                          │
 * │  - Applies personalization                                                  │
 * │  - Output: { ui }                                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                                 │
 *                                                 ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                        END: Return final result                             │
 * │  { intent, route, response, ui, metadata }                                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ================================================================================
 * CHECKPOINT INTEGRATION
 * ================================================================================
 *
 * Checkpoints can be inserted at any node to pause execution for human input:
 *
 * 1. After encode_intent: Confirm intent classification
 * 2. After route_query: Confirm cloud routing (cost warning)
 * 3. After apply_privacy: Confirm redactions (transparency)
 * 4. After generate_response: Review response before finalizing
 * 5. After generate_ui: Preview UI before rendering
 *
 * Checkpoints are managed by the Checkpointer and expose state to the frontend
 * via CoAgents. User approval/resume triggers continuation.
 *
 * ================================================================================
 * STATE CHANNELS
 * ================================================================================
 *
 * The graph uses the following state channels:
 *
 * - query: string - Original user query
 * - intent: number[] - 768-dimensional intent vector
 * - route: 'local' | 'cloud' | 'hybrid' - Routing decision
 * - privacy: 'public' | 'sensitive' | 'sovereign' - Privacy level
 * - processedQuery?: string - Query after privacy transformations
 * - response?: string - Final LLM response
 * - ui?: unknown - A2UI specification
 * - status: 'idle' | 'processing' | 'complete' | 'error' - Execution status
 * - sessionId: string - Session identifier
 * - complexity: number - Query complexity (0-1)
 * - error?: string - Error message if any
 * - metadata?: Record<string, unknown> - Additional metadata
 *
 * State is passed between nodes and can be accessed by conditional edges.
 *
 * ================================================================================
 * CONDITIONAL ROUTING
 * ================================================================================
 *
 * The route_query node determines the execution path:
 *
 * ```typescript
 * function routeCondition(state: AequorState): string {
 *   // Sovereign data ALWAYS routes local
 *   if (state.privacy === 'sovereign') return 'local';
 *
 *   // Complex queries route to cloud
 *   if (state.complexity >= 0.7) return 'cloud';
 *
 *   // Simple queries route local
 *   return 'local';
 * }
 * ```
 *
 * The conditional edge then routes:
 * - 'local' → generate_response (skip privacy node)
 * - 'cloud' → apply_privacy → generate_response
 * - 'hybrid' → apply_privacy → generate_response
 *
 * ================================================================================
 * EXAMPLE EXECUTION FLOWS
 * ================================================================================
 *
 * Example 1: Simple query, public data
 * ```
 * Input: { query: "What is 2+2?", privacy: 'public' }
 *   ↓ encode_intent
 * { intent: [...], complexity: 0.2 }
 *   ↓ route_query (complexity < 0.7)
 * route: 'local'
 *   ↓ (skip privacy)
 *   ↓ generate_response (local)
 * { response: "2+2 equals 4." }
 *   ↓ generate_ui
 * { ui: { components: [...], layout: {...} } }
 *   ↓ END
 * ```
 *
 * Example 2: Complex query, sensitive data
 * ```
 * Input: { query: "Analyze my medical records for trends", privacy: 'sensitive' }
 *   ↓ encode_intent
 * { intent: [...], complexity: 0.8 }
 *   ↓ route_query (complexity >= 0.7)
 * route: 'cloud'
 *   ↓ apply_privacy (redaction + encoding)
 * { processedQuery: "Analyze [REDACTED] for trends" }
 *   ↓ generate_response (cloud)
 * { response: "Based on the data..." }
 *   ↓ generate_ui
 * { ui: { components: [...], layout: {...} } }
 *   ↓ END
 * ```
 *
 * Example 3: Sovereign data (forced local)
 * ```
 * Input: { query: "Process financial data", privacy: 'sovereign' }
 *   ↓ encode_intent
 * { intent: [...], complexity: 0.9 }
 *   ↓ route_query (sovereign overrides)
 * route: 'local'  // Forced local despite high complexity
 *   ↓ (skip privacy)
 *   ↓ generate_response (local)
 * { response: "Processing locally..." }
 *   ↓ generate_ui
 * { ui: { components: [...], layout: {...} } }
 *   ↓ END
 * ```
 *
 * ================================================================================
 * INTEGRATION POINTS
 * ================================================================================
 *
 * - @lsi/privacy: IntentEncoder for encoding, PrivacyLayer for redaction
 * - @lsi/cascade: CascadeRouter for complexity-based routing
 * - @lsi/protocol: ATP/ACP types for request/response
 * - @lsi/a2ui: A2UIAgent for UI generation
 * - @lsi/coagents: SharedStateManager for state sync
 *
 * ================================================================================
 * USAGE
 * ================================================================================
 *
 * ```typescript
 * import { AequorGraph } from '@lsi/langgraph';
 *
 * // Create and build graph
 * const graph = new AequorGraph({
 *   enableCheckpoints: true,
 *   enableStreaming: true,
 *   defaultLocalModel: 'llama2',
 *   defaultCloudModel: 'gpt-4'
 * });
 *
 * graph.build();
 *
 * // Compile with checkpoint support
 * const compiled = await graph.compile();
 *
 * // Execute
 * const result = await compiled.invoke({
 *   query: 'Hello world',
 *   sessionId: 'session-123',
 *   privacy: 'public'
 * }, {
 *   configurable: { thread_id: 'session-123' }
 * });
 *
 * // Or stream
 * for await (const state of compiled.stream(input)) {
 *   console.log('State update:', state);
 * }
 * ```
 *
 * @see packages/langgraph/src/nodes/ for individual node implementations
 * @see packages/coagents/src/adapters/LangGraphAdapter.ts for frontend integration
 * @see packages/protocol/src/index.ts for ATP/ACP protocol types
 */

import { StateGraph, END } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AequorState } from "../state/index.js";
import type { CompiledGraph } from "../index.js";
import { encodeIntentNode } from "../nodes/encodeIntent.js";
import { routeQueryNode } from "../nodes/routeQuery.js";
import { applyPrivacyNode } from "../nodes/applyPrivacy.js";
import { generateResponseNode } from "../nodes/generateResponse.js";
import { generateUINode } from "../nodes/generateUI.js";
import { createCheckpointer } from "../checkpoints/index.js";

/**
 * Aequor Graph configuration
 */
export interface AequorGraphConfig {
  /** Enable checkpoints */
  enableCheckpoints?: boolean;
  /** Enable streaming */
  enableStreaming?: boolean;
  /** Default model for local routing */
  defaultLocalModel?: string;
  /** Default model for cloud routing */
  defaultCloudModel?: string;
}

/**
 * Aequor Graph class
 *
 * Builds and compiles the LangGraph for Aequor agent orchestration.
 */
export class AequorGraph {
  private config: Required<AequorGraphConfig>;
  private graph?: StateGraph<AequorState>;

  constructor(config: AequorGraphConfig = {}) {
    this.config = {
      enableCheckpoints: true,
      enableStreaming: true,
      defaultLocalModel: "llama2",
      defaultCloudModel: "gpt-4",
      ...config,
    };
  }

  /**
   * Build the graph with all nodes and edges
   */
  build(): StateGraph<AequorState> {
    // Create state graph with Aequor state channels
    const graph = new StateGraph({
      channels: this.createStateChannels(),
    });

    // Add all nodes
    graph.addNode("encode_intent", encodeIntentNode);
    graph.addNode("route_query", routeQueryNode);
    graph.addNode("apply_privacy", applyPrivacyNode);
    graph.addNode("generate_response", generateResponseNode);
    graph.addNode("generate_ui", generateUINode);

    // Set entry point
    graph.setEntryPoint("encode_intent");

    // Add edges between nodes
    graph.addEdge("encode_intent", "route_query");

    // Conditional edge based on routing decision
    graph.addConditionalEdges("route_query", this.routeCondition, {
      local: "generate_response",
      cloud: "apply_privacy",
      hybrid: "apply_privacy",
    });

    graph.addEdge("apply_privacy", "generate_response");
    graph.addEdge("generate_response", "generate_ui");
    graph.addEdge("generate_ui", END);

    this.graph = graph;
    return graph;
  }

  /**
   * Compile the graph with checkpoint support
   */
  async compile(): Promise<CompiledGraph> {
    if (!this.graph) {
      this.build();
    }

    const compiled = await this.graph!.compile({
      checkpointer: this.config.enableCheckpoints
        ? createCheckpointer()
        : undefined,
    });

    return compiled as CompiledGraph;
  }

  /**
   * Conditional routing logic
   */
  private routeCondition(state: AequorState): string {
    return state.route;
  }

  /**
   * Create state channels for LangGraph
   */
  private createStateChannels() {
    return {
      query: {
        value: (x: string, y?: string) => y ?? x,
        default: () => "",
      },
      intent: {
        value: (x: number[], y?: number[]) => y ?? x,
        default: () => [],
      },
      route: {
        value: (
          x: "local" | "cloud" | "hybrid",
          y?: "local" | "cloud" | "hybrid"
        ) => y ?? x,
        default: () => "local" as const,
      },
      privacy: {
        value: (
          x: "public" | "sensitive" | "sovereign",
          y?: "public" | "sensitive" | "sovereign"
        ) => y ?? x,
        default: () => "public" as const,
      },
      processedQuery: {
        value: (x: string | undefined, y?: string) => y ?? x,
        default: () => undefined,
      },
      response: {
        value: (x: string | undefined, y?: string) => y ?? x,
        default: () => undefined,
      },
      ui: {
        value: (x: unknown, y?: unknown) => y ?? x,
        default: () => null,
      },
      status: {
        value: (x: AequorState["status"], y?: AequorState["status"]) => y ?? x,
        default: () => "idle" as const,
      },
      sessionId: {
        value: (x: string, y?: string) => y ?? x,
        default: () => crypto.randomUUID(),
      },
      complexity: {
        value: (x: number, y?: number) => y ?? x,
        default: () => 0,
      },
      error: {
        value: (x: string | undefined, y?: string) => y ?? x,
        default: () => undefined,
      },
      metadata: {
        value: (
          x: Record<string, unknown> | undefined,
          y?: Record<string, unknown>
        ) => y ?? x,
        default: () => undefined,
      },
    };
  }
}

/**
 * Create a default Aequor graph
 */
export function createAequorGraph(config?: AequorGraphConfig): AequorGraph {
  return new AequorGraph(config);
}

export default AequorGraph;
