/**
 * @fileoverview Complete VL-JEPA LangGraph
 *
 * Complete LangGraph workflow that integrates VL-JEPA visual understanding
 * with CoAgents state management and human-in-the-loop checkpoints.
 *
 * Graph Flow:
 * Input → Visual Encoding → Intent Encoding → Prediction → Visual Reasoning
 * → Action Planning → Human Approval → A2UI Generation → Output
 *
 * @version 1.0.0
 */

import { StateGraph } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { VLJEPAAgentState } from "../../state/VLJEPAAgentState.js";
import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";
import type { CheckpointConfig } from "../../state/SharedStateManager.js";
import {
  VLJEPANode,
  createVLJEPANodeHandler,
  type VLJEPANodeConfig,
} from "../VLJEPANode.js";
import {
  VisualReasoningNode,
  createVisualReasoningNodeHandler,
} from "../VisualReasoningNode.js";

// ============================================================================
// GRAPH TYPES
// ============================================================================

/**
 * VL-JEPA graph configuration
 */
export interface VLJEPAGraphConfig {
  /** VL-JEPA node configuration */
  vljepaNode: VLJEPANodeConfig;

  /** Enable visual reasoning */
  enableVisualReasoning?: boolean;

  /** Enable human-in-the-loop checkpoints */
  enableHITL?: boolean;

  /** Checkpoint configuration */
  checkpointConfig?: {
    /** Require approval for destructive actions */
    requireDestructiveApproval?: boolean;

    /** Require approval for low-confidence actions */
    requireLowConfidenceApproval?: boolean;

    /** Auto-approval threshold */
    autoApprovalThreshold?: number;

    /** Checkpoint timeout in milliseconds */
    timeout?: number;
  };

  /** Enable A2UI generation */
  enableA2UI?: boolean;

  /** Graph metadata */
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    tags?: string[];
  };
}

/**
 * VL-JEPA graph input
 */
export interface VLJEPAGraphInput {
  /** Visual input (image data URL) */
  visualInput: string;

  /** User intent text */
  userIntent: string;

  /** Session ID */
  sessionId?: string;

  /** Optional context */
  context?: {
    /** Previous frame */
    previousFrame?: string;

    /** User preferences */
    preferences?: {
      autoApprovalThreshold?: number;
      preferredActionTypes?: string[];
    };
  };
}

/**
 * VL-JEPA graph output
 */
export interface VLJEPAGraphOutput {
  /** Updated agent state */
  state: VLJEPAAgentState;

  /** Generated actions */
  actions: VLJEPAAction[];

  /** A2UI components (if enabled) */
  a2ui?: unknown;

  /** Checkpoint results (if HITL enabled) */
  checkpoints?: Map<string, CheckpointResult>;

  /** Execution summary */
  summary: {
    /** Total execution time */
    executionTime: number;

    /** Number of nodes executed */
    nodesExecuted: number;

    /** Number of actions generated */
    actionCount: number;

    /** Number of checkpoints triggered */
    checkpointCount: number;

    /** Number of approvals required */
    approvalsRequired: number;

    /** Number of approvals granted */
    approvalsGranted: number;
  };
}

/**
 * Checkpoint result
 */
export interface CheckpointResult {
  /** Checkpoint ID */
  id: string;

  /** Checkpoint type */
  type:
    | "destructive_action"
    | "low_confidence"
    | "visual_confirmation"
    | "approval";

  /** Message */
  message: string;

  /** Actions requiring approval */
  actions: VLJEPAAction[];

  /** User decision */
  decision?: "approve" | "reject" | "modify";

  /** Timestamp */
  timestamp: number;

  /** Required flag */
  required: boolean;
}

// ============================================================================
// VL-JEPA LANGGRAPH
// ============================================================================

/**
 * VL-JEPA LangGraph
 *
 * Complete graph integrating VL-JEPA visual processing with CoAgents.
 */
export class VLJEPAGraph {
  private config: Required<VLJEPAGraphConfig>;
  private vljepaNode: VLJEPANode;
  private visualReasoningNode: VisualReasoningNode;
  private graph?: StateGraph<VLJEPAAgentState>;
  private checkpoints: Map<string, CheckpointResult> = new Map();

  constructor(config: VLJEPAGraphConfig) {
    this.config = {
      enableVisualReasoning: true,
      enableHITL: true,
      enableA2UI: true,
      checkpointConfig: {
        requireDestructiveApproval: true,
        requireLowConfidenceApproval: true,
        autoApprovalThreshold: 0.8,
        timeout: 60000, // 1 minute
      },
      metadata: {
        name: "vljepa-graph",
        description: "VL-JEPA visual understanding with CoAgents",
        version: "1.0.0",
        tags: ["vljepa", "visual", "coagents"],
      },
      ...config,
    };

    this.vljepaNode = new VLJEPANode(this.config.vljepaNode);
    this.visualReasoningNode = new VisualReasoningNode();
  }

  /**
   * Build the graph
   */
  async build(): Promise<StateGraph<VLJEPAAgentState>> {
    // Create state graph
    const graph = new StateGraph<VLJEPAAgentState>({
      channels: this.createStateChannels(),
    });

    // Add nodes
    graph.addNode(
      "vljepa_encoding",
      createVLJEPANodeHandler(this.config.vljepaNode)
    );

    if (this.config.enableVisualReasoning) {
      graph.addNode("visual_reasoning", createVisualReasoningNodeHandler());
    }

    if (this.config.enableHITL) {
      graph.addNode("hitl_checkpoint", this.createCheckpointNode());
    }

    if (this.config.enableA2UI) {
      graph.addNode("a2ui_generation", this.createA2UINode());
    }

    // Add edges
    graph.setEntryPoint("vljepa_encoding");

    if (this.config.enableVisualReasoning) {
      graph.addEdge("vljepa_encoding", "visual_reasoning");

      if (this.config.enableHITL) {
        graph.addEdge("visual_reasoning", "hitl_checkpoint");
      } else if (this.config.enableA2UI) {
        graph.addEdge("visual_reasoning", "a2ui_generation");
      }
    } else if (this.config.enableHITL) {
      graph.addEdge("vljepa_encoding", "hitl_checkpoint");

      if (this.config.enableA2UI) {
        graph.addEdge("hitl_checkpoint", "a2ui_generation");
      }
    } else if (this.config.enableA2UI) {
      graph.addEdge("vljepa_encoding", "a2ui_generation");
    }

    if (this.config.enableA2UI) {
      graph.addEdge("a2ui_generation", "END");
    } else if (!this.config.enableHITL) {
      graph.addEdge(
        this.config.enableVisualReasoning
          ? "visual_reasoning"
          : "vljepa_encoding",
        "END"
      );
    }

    this.graph = graph;
    return graph;
  }

  /**
   * Invoke the graph
   */
  async invoke(input: VLJEPAGraphInput): Promise<VLJEPAGraphOutput> {
    if (!this.graph) {
      await this.build();
    }

    const startTime = Date.now();
    this.checkpoints.clear();

    // Create initial state
    const initialState: VLJEPAAgentState = {
      query: input.userIntent,
      intent: [],
      route: "local",
      privacy: "public",
      status: "processing",
      sessionId: input.sessionId ?? crypto.randomUUID(),
      complexity: 0,
      vljepa: {
        version: "1.0",
        visualEmbedding: new Float32Array(768),
        intentEmbedding: new Float32Array(768),
        goalEmbedding: new Float32Array(768),
        confidence: 0,
        timestamp: Date.now(),
        actions: [],
        metadata: { processingTime: 0 },
      },
      visual: {
        embedding: {
          values: new Float32Array(768),
          dimension: 768,
          source: "x-encoder",
          timestamp: Date.now(),
          isNormalized: false,
        },
        elements: [],
        features: {
          colors: [],
          layout: { type: "unknown", confidence: 0 },
          spacing: {
            averageGap: 16,
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            margin: { top: 16, right: 16, bottom: 16, left: 16 },
            whitespaceRatio: 0.3,
          },
          typography: {
            families: [],
            sizes: [],
            weights: [],
            lineHeights: [],
            contrastScores: [],
            headingHierarchy: {},
          },
          hierarchy: {
            tree: { id: "root", type: "container", weight: 0, children: [] },
            depth: 0,
            focusPoints: [],
          },
          components: [],
        },
        confidence: 0,
        timestamp: Date.now(),
        dimensions: { width: 1920, height: 1080 },
      },
      embeddings: {
        fused: new Float32Array(768),
        visual: new Float32Array(768),
        intent: new Float32Array(768),
        goal: new Float32Array(768),
        weights: { visual: 0.5, intent: 0.5 },
        similarities: { visualIntent: 0, visualGoal: 0, intentGoal: 0 },
        timestamp: Date.now(),
      },
      pendingActions: [],
      actionHistory: [],
      visualContext: {
        currentFrame: {
          src: input.visualInput,
          dimensions: { width: 1920, height: 1080 },
          timestamp: Date.now(),
        },
        previousFrame: input.context?.previousFrame
          ? {
              src: input.context.previousFrame,
              dimensions: { width: 1920, height: 1080 },
              timestamp: Date.now() - 1000,
            }
          : undefined,
      },
      preferences: input.context?.preferences,
    };

    // Compile and invoke graph
    const compiled = await this.graph!.compile({
      checkpointer: this.config.enableHITL
        ? this.createCheckpointer()
        : undefined,
    });

    const result = await compiled.invoke(initialState, {
      configurable: { thread_id: initialState.sessionId },
    });

    const executionTime = Date.now() - startTime;

    return {
      state: result,
      actions: result.pendingActions ?? [],
      a2ui: result.ui,
      checkpoints: this.checkpoints.size > 0 ? this.checkpoints : undefined,
      summary: {
        executionTime,
        nodesExecuted: this.countNodesExecuted(),
        actionCount: result.pendingActions?.length ?? 0,
        checkpointCount: this.checkpoints.size,
        approvalsRequired: Array.from(this.checkpoints.values()).filter(
          c => c.required
        ).length,
        approvalsGranted: Array.from(this.checkpoints.values()).filter(
          c => c.decision === "approve"
        ).length,
      },
    };
  }

  /**
   * Stream graph execution
   */
  async *stream(
    input: VLJEPAGraphInput
  ): AsyncGenerator<Partial<VLJEPAAgentState>> {
    if (!this.graph) {
      await this.build();
    }

    const initialState: VLJEPAAgentState = {
      query: input.userIntent,
      intent: [],
      route: "local",
      privacy: "public",
      status: "processing",
      sessionId: input.sessionId ?? crypto.randomUUID(),
      complexity: 0,
      vljepa: {
        version: "1.0",
        visualEmbedding: new Float32Array(768),
        intentEmbedding: new Float32Array(768),
        goalEmbedding: new Float32Array(768),
        confidence: 0,
        timestamp: Date.now(),
        actions: [],
        metadata: { processingTime: 0 },
      },
      visual: {
        embedding: {
          values: new Float32Array(768),
          dimension: 768,
          source: "x-encoder",
          timestamp: Date.now(),
          isNormalized: false,
        },
        elements: [],
        features: {
          colors: [],
          layout: { type: "unknown", confidence: 0 },
          spacing: {
            averageGap: 16,
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            margin: { top: 16, right: 16, bottom: 16, left: 16 },
            whitespaceRatio: 0.3,
          },
          typography: {
            families: [],
            sizes: [],
            weights: [],
            lineHeights: [],
            contrastScores: [],
            headingHierarchy: {},
          },
          hierarchy: {
            tree: { id: "root", type: "container", weight: 0, children: [] },
            depth: 0,
            focusPoints: [],
          },
          components: [],
        },
        confidence: 0,
        timestamp: Date.now(),
        dimensions: { width: 1920, height: 1080 },
      },
      embeddings: {
        fused: new Float32Array(768),
        visual: new Float32Array(768),
        intent: new Float32Array(768),
        goal: new Float32Array(768),
        weights: { visual: 0.5, intent: 0.5 },
        similarities: { visualIntent: 0, visualGoal: 0, intentGoal: 0 },
        timestamp: Date.now(),
      },
      pendingActions: [],
      actionHistory: [],
      visualContext: {
        currentFrame: {
          src: input.visualInput,
          dimensions: { width: 1920, height: 1080 },
          timestamp: Date.now(),
        },
      },
    };

    const compiled = await this.graph!.compile();

    yield* compiled.stream(initialState, {
      configurable: { thread_id: initialState.sessionId },
    });
  }

  /**
   * Approve checkpoint
   */
  async approveCheckpoint(
    checkpointId: string,
    feedback?: string
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    checkpoint.decision = "approve";

    // Continue execution would happen here in a real implementation
  }

  /**
   * Reject checkpoint
   */
  async rejectCheckpoint(checkpointId: string, reason: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    checkpoint.decision = "reject";

    // Rollback would happen here in a real implementation
  }

  /**
   * Create state channels
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
        value: (x: string, y?: string) => y ?? x,
        default: () => "local",
      },
      privacy: {
        value: (x: string, y?: string) => y ?? x,
        default: () => "public",
      },
      status: {
        value: (x: string, y?: string) => y ?? x,
        default: () => "idle",
      },
      sessionId: {
        value: (x: string, y?: string) => y ?? x,
        default: () => crypto.randomUUID(),
      },
      complexity: {
        value: (x: number, y?: number) => y ?? x,
        default: () => 0,
      },
      vljepa: {
        value: (
          x: VLJEPAAgentState["vljepa"],
          y?: VLJEPAAgentState["vljepa"]
        ) => y ?? x,
        default: () => ({
          version: "1.0",
          visualEmbedding: new Float32Array(768),
          intentEmbedding: new Float32Array(768),
          goalEmbedding: new Float32Array(768),
          confidence: 0,
          timestamp: Date.now(),
          actions: [],
          metadata: { processingTime: 0 },
        }),
      },
      visual: {
        value: (
          x: VLJEPAAgentState["visual"],
          y?: VLJEPAAgentState["visual"]
        ) => y ?? x,
        default: () => ({
          embedding: {
            values: new Float32Array(768),
            dimension: 768,
            source: "x-encoder",
            timestamp: Date.now(),
            isNormalized: false,
          },
          elements: [],
          features: {
            colors: [],
            layout: { type: "unknown", confidence: 0 },
            spacing: {
              averageGap: 16,
              padding: { top: 16, right: 16, bottom: 16, left: 16 },
              margin: { top: 16, right: 16, bottom: 16, left: 16 },
              whitespaceRatio: 0.3,
            },
            typography: {
              families: [],
              sizes: [],
              weights: [],
              lineHeights: [],
              contrastScores: [],
              headingHierarchy: {},
            },
            hierarchy: {
              tree: { id: "root", type: "container", weight: 0, children: [] },
              depth: 0,
              focusPoints: [],
            },
            components: [],
          },
          confidence: 0,
          timestamp: Date.now(),
          dimensions: { width: 1920, height: 1080 },
        }),
      },
      embeddings: {
        value: (
          x: VLJEPAAgentState["embeddings"],
          y?: VLJEPAAgentState["embeddings"]
        ) => y ?? x,
        default: () => ({
          fused: new Float32Array(768),
          visual: new Float32Array(768),
          intent: new Float32Array(768),
          goal: new Float32Array(768),
          weights: { visual: 0.5, intent: 0.5 },
          similarities: { visualIntent: 0, visualGoal: 0, intentGoal: 0 },
          timestamp: Date.now(),
        }),
      },
      pendingActions: {
        value: (x: VLJEPAAction[], y?: VLJEPAAction[]) => y ?? x,
        default: () => [],
      },
      actionHistory: {
        value: (
          x: VLJEPAAgentState["actionHistory"],
          y?: VLJEPAAgentState["actionHistory"]
        ) => y ?? x,
        default: () => [],
      },
      visualContext: {
        value: (
          x: VLJEPAAgentState["visualContext"],
          y?: VLJEPAAgentState["visualContext"]
        ) => y ?? x,
        default: () => undefined,
      },
      preferences: {
        value: (
          x: VLJEPAAgentState["preferences"],
          y?: VLJEPAAgentState["preferences"]
        ) => y ?? x,
        default: () => undefined,
      },
    };
  }

  /**
   * Create checkpoint node
   */
  private createCheckpointNode() {
    return async (
      state: VLJEPAAgentState
    ): Promise<Partial<VLJEPAAgentState>> => {
      const actions = state.pendingActions ?? [];
      const checkpoints: CheckpointResult[] = [];

      // Check for destructive actions
      if (this.config.checkpointConfig.requireDestructiveApproval) {
        const destructive = actions.filter(
          a => a.type === "delete" || a.type === "remove"
        );

        if (destructive.length > 0) {
          const checkpoint: CheckpointResult = {
            id: crypto.randomUUID(),
            type: "destructive_action",
            message: `${destructive.length} destructive action(s) require approval`,
            actions: destructive,
            required: true,
            timestamp: Date.now(),
          };
          checkpoints.push(checkpoint);
          this.checkpoints.set(checkpoint.id, checkpoint);
        }
      }

      // Check for low-confidence actions
      if (this.config.checkpointConfig.requireLowConfidenceApproval) {
        const lowConfidence = actions.filter(
          a =>
            a.confidence <
            (this.config.checkpointConfig.autoApprovalThreshold ?? 0.8)
        );

        if (lowConfidence.length > 0) {
          const checkpoint: CheckpointResult = {
            id: crypto.randomUUID(),
            type: "low_confidence",
            message: `${lowConfidence.length} low-confidence action(s) require approval`,
            actions: lowConfidence,
            required: true,
            timestamp: Date.now(),
          };
          checkpoints.push(checkpoint);
          this.checkpoints.set(checkpoint.id, checkpoint);
        }
      }

      // Visual confirmation checkpoint
      if (actions.length > 0) {
        const checkpoint: CheckpointResult = {
          id: crypto.randomUUID(),
          type: "visual_confirmation",
          message: `Review ${actions.length} visual action(s) before execution`,
          actions,
          required: false,
          timestamp: Date.now(),
        };
        checkpoints.push(checkpoint);
        this.checkpoints.set(checkpoint.id, checkpoint);
      }

      return {
        status: checkpoints.some(c => c.required)
          ? "waiting_human"
          : "complete",
        metadata: {
          ...state.metadata,
          checkpoints: checkpoints.map(c => ({
            id: c.id,
            type: c.type,
            message: c.message,
            required: c.required,
          })),
        },
      };
    };
  }

  /**
   * Create A2UI generation node
   */
  private createA2UINode() {
    return async (
      state: VLJEPAAgentState
    ): Promise<Partial<VLJEPAAgentState>> => {
      // Convert actions to A2UI format
      const a2ui = this.actionsToA2UI(state.pendingActions ?? []);

      return {
        ui: a2ui,
        status: "complete",
      };
    };
  }

  /**
   * Convert actions to A2UI format
   */
  private actionsToA2UI(actions: VLJEPAAction[]): unknown {
    // Simplified A2UI conversion
    return {
      version: "1.0",
      components: actions.map(action => ({
        type: action.target,
        props: action.params,
        metadata: {
          confidence: action.confidence,
          reasoning: action.reasoning,
        },
      })),
    };
  }

  /**
   * Create checkpointer
   */
  private createCheckpointer() {
    const snapshots = new Map<string, VLJEPAAgentState>();

    return {
      get: async (config: RunnableConfig) => {
        const threadId = config.configurable?.thread_id as string;
        return snapshots.get(threadId);
      },
      put: async (config: RunnableConfig, state: VLJEPAAgentState) => {
        const threadId = config.configurable?.thread_id as string;
        snapshots.set(threadId, state);
      },
    };
  }

  /**
   * Count nodes executed
   */
  private countNodesExecuted(): number {
    let count = 1; // vljepa_encoding always runs
    if (this.config.enableVisualReasoning) count++;
    if (this.config.enableHITL) count++;
    if (this.config.enableA2UI) count++;
    return count;
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get graph structure
   */
  getGraphStructure() {
    return {
      nodes: [
        "vljepa_encoding",
        ...(this.config.enableVisualReasoning ? ["visual_reasoning"] : []),
        ...(this.config.enableHITL ? ["hitl_checkpoint"] : []),
        ...(this.config.enableA2UI ? ["a2ui_generation"] : []),
      ],
      edges: this.describeEdges(),
    };
  }

  /**
   * Describe graph edges
   */
  private describeEdges(): string[] {
    const edges: string[] = [];
    edges.push("START → vljepa_encoding");

    let lastNode = "vljepa_encoding";
    if (this.config.enableVisualReasoning) {
      edges.push(`${lastNode} → visual_reasoning`);
      lastNode = "visual_reasoning";
    }
    if (this.config.enableHITL) {
      edges.push(`${lastNode} → hitl_checkpoint`);
      lastNode = "hitl_checkpoint";
    }
    if (this.config.enableA2UI) {
      edges.push(`${lastNode} → a2ui_generation`);
      edges.push("a2ui_generation → END");
    } else {
      edges.push(`${lastNode} → END`);
    }

    return edges;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create VL-JEPA graph
 *
 * @param config - Graph configuration
 * @returns VL-JEPA graph instance
 */
export function createVLJEPAGraph(config: VLJEPAGraphConfig): VLJEPAGraph {
  return new VLJEPAGraph(config);
}

export default VLJEPAGraph;
