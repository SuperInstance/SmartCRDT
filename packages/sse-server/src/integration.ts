/**
 * Integration layer for SSE Server with Aequor components
 *
 * Provides streaming integration for:
 * - Aequor responses (ATP/ACP protocol)
 * - CoAgents state (agent orchestration)
 * - A2UI progressive updates (UI generation)
 * - VL-JEPA embeddings (vision-language understanding)
 */

import type {
  SSEEvent,
  SSEServer,
  IntegrationConfig,
  AequorStreamEvent,
  CoAgentsStreamEvent,
  A2UIStreamEvent,
  VLJEPATreamEvent,
  AequorResponse,
} from "./types.js";
import { SSEError, SSEErrorCode } from "./types.js";

// ============================================================================
// AEQUOR INTEGRATION
// ============================================================================

export interface AequorIntegrationOptions {
  /** SSE server instance */
  server: SSEServer;
  /** Channel name for Aequor responses */
  channel: string;
  /** Enable streaming */
  enable_streaming: boolean;
  /** Chunk size for streaming */
  chunk_size: number;
}

/**
 * Aequor response streamer
 */
export class AequorStreamer {
  private channel: string;
  private server: SSEServer;
  private enabled: boolean;
  private chunkSize: number;

  constructor(options: AequorIntegrationOptions) {
    this.server = options.server;
    this.channel = options.channel || "aequor";
    this.enabled = options.enable_streaming !== false;
    this.chunkSize = options.chunk_size || 100;

    // Create channel if not exists
    if (!this.server.hasChannel(this.channel)) {
      this.server.createChannel(this.channel, {
        description: "Aequor cognitive orchestration responses",
        persistent: true,
      });
    }
  }

  /**
   * Stream Aequor response progressively
   */
  async streamResponse(
    clientId: string,
    response: AequorResponse,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const content = response.content || "";
    const chunks = this.chunkContent(content, this.chunkSize);
    const totalChunks = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      const event: AequorStreamEvent = {
        event: "aequor-response",
        id: `aequor_${Date.now()}_${i}`,
        data: {
          content: chunks[i],
          backend: response.backend,
          model: response.model,
          is_final: i === chunks.length - 1,
          chunk_index: i,
          total_chunks: totalChunks,
          metadata: response.metadata,
        },
      };

      this.server.sendToClient(clientId, event);

      if (onProgress) {
        onProgress((i + 1) / totalChunks);
      }

      // Small delay between chunks
      await this.delay(10);
    }
  }

  /**
   * Broadcast Aequor response to channel
   */
  async broadcastResponse(response: AequorResponse): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const event: AequorStreamEvent = {
      event: "aequor-response",
      id: `aequor_${Date.now()}`,
      data: {
        content: response.content || "",
        backend: response.backend,
        model: response.model,
        is_final: true,
        chunk_index: 0,
        total_chunks: 1,
        metadata: response.metadata,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream error
   */
  streamError(clientId: string, error: Error): void {
    const event: SSEEvent = {
      event: "aequor-error",
      data: {
        message: error.message,
        name: error.name,
        timestamp: Date.now(),
      },
    };

    this.server.sendToClient(clientId, event);
  }

  /**
   * Chunk content for streaming
   */
  private chunkContent(content: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += size) {
      chunks.push(content.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// COAGENTS INTEGRATION
// ============================================================================

export interface CoAgentsIntegrationOptions {
  /** SSE server instance */
  server: SSEServer;
  /** Channel name for CoAgents state */
  channel: string;
  /** Enable state streaming */
  enable_state_streaming: boolean;
}

/**
 * CoAgents state streamer
 */
export class CoAgentsStreamer {
  private channel: string;
  private server: SSEServer;
  private enabled: boolean;

  constructor(options: CoAgentsIntegrationOptions) {
    this.server = options.server;
    this.channel = options.channel || "coagents";
    this.enabled = options.enable_state_streaming !== false;

    // Create channel if not exists
    if (!this.server.hasChannel(this.channel)) {
      this.server.createChannel(this.channel, {
        description: "CoAgents agent orchestration state",
        persistent: true,
      });
    }
  }

  /**
   * Stream agent state update
   */
  streamAgentState(
    agentId: string,
    state: Record<string, unknown>,
    status: "idle" | "thinking" | "acting" | "error",
    progress?: number
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: CoAgentsStreamEvent = {
      event: "coagents-state",
      id: `coagents_${agentId}_${Date.now()}`,
      data: {
        agent_id: agentId,
        state,
        status,
        progress,
        timestamp: Date.now(),
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream agent thinking state
   */
  streamThinking(agentId: string, thought: string): void {
    this.streamAgentState(agentId, { thought }, "thinking");
  }

  /**
   * Stream agent action
   */
  streamAction(
    agentId: string,
    action: string,
    params: Record<string, unknown>
  ): void {
    this.streamAgentState(agentId, { action, params }, "acting");
  }

  /**
   * Stream agent error
   */
  streamError(agentId: string, error: Error): void {
    this.streamAgentState(agentId, { error: error.message }, "error");
  }

  /**
   * Stream agent completion
   */
  streamCompletion(agentId: string, result: unknown): void {
    this.streamAgentState(agentId, { result }, "idle", 1);
  }
}

// ============================================================================
// A2UI INTEGRATION
// ============================================================================

export interface A2UIIntegrationOptions {
  /** SSE server instance */
  server: SSEServer;
  /** Channel name for A2UI updates */
  channel: string;
  /** Enable progressive rendering */
  enable_progressive: boolean;
}

/**
 * A2UI progressive update streamer
 */
export class A2UIStreamer {
  private channel: string;
  private server: SSEServer;
  private enabled: boolean;

  constructor(options: A2UIIntegrationOptions) {
    this.server = options.server;
    this.channel = options.channel || "a2ui";
    this.enabled = options.enable_progressive !== false;

    // Create channel if not exists
    if (!this.server.hasChannel(this.channel)) {
      this.server.createChannel(this.channel, {
        description: "A2UI progressive UI updates",
        persistent: true,
      });
    }
  }

  /**
   * Stream component creation
   */
  streamCreate(
    componentType: string,
    props: Record<string, unknown>,
    priority: "low" | "normal" | "high" | "critical" = "normal"
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: A2UIStreamEvent = {
      event: "a2ui-update",
      id: `a2ui_create_${Date.now()}`,
      data: {
        type: "create",
        component: {
          type: componentType,
          props,
        },
        priority,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream component update
   */
  streamUpdate(
    componentId: string,
    props: Record<string, unknown>,
    priority: "low" | "normal" | "high" | "critical" = "normal"
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: A2UIStreamEvent = {
      event: "a2ui-update",
      id: `a2ui_update_${componentId}_${Date.now()}`,
      data: {
        type: "update",
        component: {
          id: componentId,
          type: "unknown",
          props,
        },
        priority,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream component deletion
   */
  streamDelete(
    componentId: string,
    priority: "low" | "normal" | "high" | "critical" = "normal"
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: A2UIStreamEvent = {
      event: "a2ui-update",
      id: `a2ui_delete_${componentId}_${Date.now()}`,
      data: {
        type: "delete",
        component: {
          id: componentId,
          type: "unknown",
          props: {},
        },
        priority,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream layout update
   */
  streamLayout(
    layoutType: string,
    layoutProps?: Record<string, unknown>,
    priority: "low" | "normal" | "high" | "critical" = "normal"
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: A2UIStreamEvent = {
      event: "a2ui-update",
      id: `a2ui_layout_${Date.now()}`,
      data: {
        type: "create",
        component: {
          type: "Layout",
          props: {},
        },
        layout: {
          type: layoutType,
          props: layoutProps,
        },
        priority,
      },
    };

    this.server.broadcast(this.channel, event);
  }
}

// ============================================================================
// VL-JEPA INTEGRATION
// ============================================================================

export interface VLJEPAIntegrationOptions {
  /** SSE server instance */
  server: SSEServer;
  /** Channel name for VL-JEPA embeddings */
  channel: string;
  /** Enable embedding streaming */
  enable_embedding_stream: boolean;
}

/**
 * VL-JEPA embedding streamer
 */
export class VLJEPATreamer {
  private channel: string;
  private server: SSEServer;
  private enabled: boolean;

  constructor(options: VLJEPAIntegrationOptions) {
    this.server = options.server;
    this.channel = options.channel || "vljepa";
    this.enabled = options.enable_embedding_stream !== false;

    // Create channel if not exists
    if (!this.server.hasChannel(this.channel)) {
      this.server.createChannel(this.channel, {
        description: "VL-JEPA vision-language embeddings",
        persistent: true,
      });
    }
  }

  /**
   * Stream vision embedding
   */
  streamVisionEmbedding(
    embedding: number[],
    confidence: number,
    processingTimeMs: number,
    metadata?: {
      input_shape?: number[];
      model_version?: string;
      gpu_enabled?: boolean;
    }
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: VLJEPATreamEvent = {
      event: "vljepa-embedding",
      id: `vljepa_vision_${Date.now()}`,
      data: {
        type: "vision",
        embedding,
        confidence,
        processing_time_ms: processingTimeMs,
        metadata,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream language embedding
   */
  streamLanguageEmbedding(
    embedding: number[],
    confidence: number,
    processingTimeMs: number,
    metadata?: {
      input_shape?: number[];
      model_version?: string;
      gpu_enabled?: boolean;
    }
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: VLJEPATreamEvent = {
      event: "vljepa-embedding",
      id: `vljepa_language_${Date.now()}`,
      data: {
        type: "language",
        embedding,
        confidence,
        processing_time_ms: processingTimeMs,
        metadata,
      },
    };

    this.server.broadcast(this.channel, event);
  }

  /**
   * Stream prediction embedding
   */
  streamPredictionEmbedding(
    embedding: number[],
    confidence: number,
    processingTimeMs: number,
    metadata?: {
      input_shape?: number[];
      model_version?: string;
      gpu_enabled?: boolean;
    }
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: VLJEPATreamEvent = {
      event: "vljepa-embedding",
      id: `vljepa_prediction_${Date.now()}`,
      data: {
        type: "prediction",
        embedding,
        confidence,
        processing_time_ms: processingTimeMs,
        metadata,
      },
    };

    this.server.broadcast(this.channel, event);
  }
}

// ============================================================================
// UNIFIED INTEGRATION
// ============================================================================

export interface UnifiedIntegrationOptions {
  /** SSE server instance */
  server: SSEServer;
  /** Integration configuration */
  config?: Partial<IntegrationConfig>;
}

/**
 * Unified integration manager
 */
export class SSEIntegration {
  private aequor: AequorStreamer;
  private coagents: CoAgentsStreamer;
  private a2ui: A2UIStreamer;
  private vljepa: VLJEPATreamer;
  private config: IntegrationConfig;

  constructor(options: UnifiedIntegrationOptions) {
    this.config = {
      enable_aequor: true,
      enable_coagents: true,
      enable_a2ui: true,
      enable_vljepa: true,
      channels: {
        aequor: "aequor",
        coagents: "coagents",
        a2ui: "a2ui",
        vljepa: "vljepa",
      },
      ...options.config,
    };

    this.aequor = new AequorStreamer({
      server: options.server,
      channel: this.config.channels.aequor,
      enable_streaming: this.config.enable_aequor,
      chunk_size: 100,
    });

    this.coagents = new CoAgentsStreamer({
      server: options.server,
      channel: this.config.channels.coagents,
      enable_state_streaming: this.config.enable_coagents,
    });

    this.a2ui = new A2UIStreamer({
      server: options.server,
      channel: this.config.channels.a2ui,
      enable_progressive: this.config.enable_a2ui,
    });

    this.vljepa = new VLJEPATreamer({
      server: options.server,
      channel: this.config.channels.vljepa,
      enable_embedding_stream: this.config.enable_vljepa,
    });
  }

  /**
   * Get Aequor streamer
   */
  getAequor(): AequorStreamer {
    return this.aequor;
  }

  /**
   * Get CoAgents streamer
   */
  getCoAgents(): CoAgentsStreamer {
    return this.coagents;
  }

  /**
   * Get A2UI streamer
   */
  getA2UI(): A2UIStreamer {
    return this.a2ui;
  }

  /**
   * Get VL-JEPA streamer
   */
  getVLJEPA(): VLJEPATreamer {
    return this.vljepa;
  }

  /**
   * Get configuration
   */
  getConfig(): IntegrationConfig {
    return { ...this.config };
  }
}

/**
 * Create SSE integration
 */
export function createSSEIntegration(
  server: SSEServer,
  config?: Partial<IntegrationConfig>
): SSEIntegration {
  return new SSEIntegration({ server, config });
}
