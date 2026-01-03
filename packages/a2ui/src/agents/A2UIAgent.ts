/**
 * A2UI Agent - AI agent for generating UI from user intentions
 *
 * The A2UI Agent is the core intelligence that converts user requests
 * into appropriate UI specifications. It uses intent encoding, pattern
 * matching, and learning from feedback to continuously improve.
 */

import type { IntentVector } from "@lsi/privacy";
import type {
  A2UIResponse,
  A2UIUpdate,
  A2UIContext,
  UIRequirements,
  UIFeedback,
  ComponentCatalog,
  A2UIAgentConfig as ProtocolAgentConfig,
} from "@lsi/protocol";
import { IntentEncoderBridge } from "../integration/IntentEncoderBridge.js";
import {
  IntentToUIMapper,
  MappingContext,
} from "../integration/IntentToUIMapper.js";
import { UIRequirementAnalyzer } from "./UIRequirementAnalyzer.js";
import { ComponentSelector } from "./ComponentSelector.js";

// ============================================================================
// TYPES
// ============================================================================

export interface A2UIAgentConfig {
  agentId: string;
  encoder: any; // IntentEncoder instance
  catalog: ComponentCatalog;
  streaming?: boolean;
  cache?: boolean;
  personalization?: boolean;
  maxComponents?: number;
  timeout?: number;
  learningEnabled?: boolean;
}

export interface GenerationOptions {
  streaming?: boolean;
  includeMetadata?: boolean;
  enablePersonalization?: boolean;
  respectAccessibility?: boolean;
  timeout?: number;
}

export interface StreamingContext {
  sessionId: string;
  updates: A2UIUpdate[];
  startTime: number;
  componentCount: number;
}

// ============================================================================
// A2UI AGENT
// ============================================================================

/**
 * Main A2UI Agent for generating UI from user intentions
 *
 * Coordinates between intent encoding, requirement analysis, component
 * selection, and UI generation to produce appropriate interfaces.
 */
export class A2UIAgent {
  private config: A2UIAgentConfig;
  private intentBridge: IntentEncoderBridge;
  private intentMapper: IntentToUIMapper;
  private requirementAnalyzer: UIRequirementAnalyzer;
  private componentSelector: ComponentSelector;
  private feedbackHistory: Map<string, UIFeedback[]>;
  private cache: Map<string, { response: A2UIResponse; timestamp: number }>;
  private activeStreams: Map<string, StreamingContext>;

  constructor(config: A2UIAgentConfig) {
    this.config = config;
    this.feedbackHistory = new Map();
    this.cache = new Map();
    this.activeStreams = new Map();

    // Initialize sub-components
    this.intentBridge = new IntentEncoderBridge({
      encoder: config.encoder,
      catalog: config.catalog,
      enablePersonalization: config.personalization ?? true,
      maxComponents: config.maxComponents ?? 100,
    });

    this.intentMapper = new IntentToUIMapper();
    this.requirementAnalyzer = new UIRequirementAnalyzer({
      catalog: config.catalog,
    });
    this.componentSelector = new ComponentSelector({ catalog: config.catalog });
  }

  /**
   * Generate A2UI from user intention
   *
   * @param intention - User's natural language intention
   * @param context - Generation context
   * @param options - Generation options
   * @returns Complete A2UI response
   */
  async generateUI(
    intention: string,
    context: A2UIContext,
    options: GenerationOptions = {}
  ): Promise<A2UIResponse> {
    const startTime = Date.now();
    const timeout = options.timeout ?? this.config.timeout ?? 30000;

    // Check cache first
    if (this.config.cache && options.streaming !== true) {
      const cacheKey = this.getCacheKey(intention, context);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) {
        // 5 min cache
        return cached.response;
      }
    }

    // Set timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("UI generation timeout")), timeout);
    });

    try {
      const response = await Promise.race([
        this.generateUIInternal(intention, context, options),
        timeoutPromise,
      ]);

      // Cache response
      if (this.config.cache) {
        const cacheKey = this.getCacheKey(intention, context);
        this.cache.set(cacheKey, { response, timestamp: Date.now() });
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.message === "UI generation timeout") {
        return this.getTimeoutResponse(context);
      }
      throw error;
    }
  }

  /**
   * Stream A2UI updates (for SSE)
   *
   * @param intention - User's natural language intention
   * @param context - Generation context
   * @returns Async generator of A2UI updates
   */
  async *streamUI(
    intention: string,
    context: A2UIContext
  ): AsyncGenerator<A2UIUpdate, A2UIUpdate, unknown> {
    const streamId = `${context.sessionId}-${Date.now()}`;
    const startTime = Date.now();

    // Initialize streaming context
    const streamContext: StreamingContext = {
      sessionId: context.sessionId,
      updates: [],
      startTime,
      componentCount: 0,
    };
    this.activeStreams.set(streamId, streamContext);

    try {
      // Step 1: Encode intention
      yield* this.streamEncoding(intention, context, streamContext);

      // Step 2: Analyze requirements
      yield* this.streamRequirements(context, streamContext);

      // Step 3: Select and build components
      yield* this.streamComponents(context, streamContext);

      // Step 4: Finalize
      yield {
        type: "done",
        done: true,
        index: streamContext.updates.length,
        total: streamContext.updates.length,
      };

      return { type: "done", done: true };
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Record user feedback for learning
   *
   * @param sessionId - Session ID
   * @param feedback - User feedback
   */
  recordFeedback(sessionId: string, feedback: UIFeedback): void {
    if (!this.config.learningEnabled) {
      return;
    }

    const history = this.feedbackHistory.get(sessionId) || [];
    history.push(feedback);
    this.feedbackHistory.set(sessionId, history);

    // Update intent mapper with feedback
    if (feedback.metadata?.intentVector) {
      this.intentMapper.recordFeedback(
        feedback.metadata.userId || "unknown",
        feedback.metadata.intentVector,
        feedback.data.requirements || {},
        feedback.data.rating || 3
      );
    }
  }

  /**
   * Get personalized UI for user
   *
   * @param userId - User ID
   * @param intention - User's intention
   * @param context - Generation context
   * @returns Personalized A2UI response
   */
  async getPersonalizedUI(
    userId: string,
    intention: string,
    context: A2UIContext
  ): Promise<A2UIResponse> {
    // Get user's feedback history
    const userFeedback = this.feedbackHistory.get(userId) || [];

    // Enrich context with user preferences
    const enrichedContext: A2UIContext = {
      ...context,
      preferences: this.extractUserPreferences(userFeedback),
    };

    return this.generateUI(intention, enrichedContext, {
      enablePersonalization: true,
      includeMetadata: true,
    });
  }

  /**
   * Get agent statistics
   *
   * @returns Agent statistics
   */
  getStats() {
    return {
      totalGenerations: this.cache.size,
      activeStreams: this.activeStreams.size,
      feedbackRecords: Array.from(this.feedbackHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      cacheHitRate: 0, // Would need to track hits/misses
      averageGenerationTime: 0, // Would need to track timing
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS - Internal Generation
  // ==========================================================================

  private async generateUIInternal(
    intention: string,
    context: A2UIContext,
    options: GenerationOptions
  ): Promise<A2UIResponse> {
    // Step 1: Encode intention to intent vector
    const intentVector = await this.intentBridge.encodeIntention(intention);

    // Step 2: Analyze UI requirements from intent
    const requirements = await this.requirementAnalyzer.analyze(
      intentVector,
      context
    );

    // Step 3: Select appropriate components
    const selectedComponents = await this.componentSelector.selectComponents(
      requirements,
      context
    );

    // Step 4: Build A2UI response
    const response: A2UIResponse = {
      version: "0.8",
      surface: requirements.surface || "main",
      components: selectedComponents,
      layout: requirements.layout || { type: "flex", spacing: 16 },
      data: requirements.dataBindings,
      actions: requirements.actions,
      metadata:
        options.includeMetadata !== false
          ? {
              timestamp: new Date(),
              sessionId: context.sessionId,
              agentId: this.config.agentId,
              generationTime: Date.now(),
              tokensUsed: intention.length / 4, // Rough estimate
              intentVector,
              confidence: requirements.confidence,
              userPreferences: context.preferences?.map(p => p.key),
            }
          : undefined,
    };

    // Apply personalization if enabled
    if (options.enablePersonalization && context.preferences) {
      this.applyPersonalization(response, context.preferences);
    }

    return response;
  }

  // ==========================================================================
  // PRIVATE METHODS - Streaming
  // ==========================================================================

  private async *streamEncoding(
    intention: string,
    context: A2UIContext,
    streamContext: StreamingContext
  ): AsyncGenerator<A2UIUpdate> {
    yield {
      type: "data",
      data: { status: "encoding", message: "Analyzing intention..." },
    };

    const intentVector = await this.intentBridge.encodeIntention(intention);

    // Store intent vector in context for later use
    (context as any).intentVector = intentVector;

    yield {
      type: "data",
      data: { status: "encoded", intentVector },
    };
  }

  private async *streamRequirements(
    context: A2UIContext,
    streamContext: StreamingContext
  ): AsyncGenerator<A2UIUpdate> {
    yield {
      type: "data",
      data: { status: "analyzing", message: "Determining UI requirements..." },
    };

    const intentVector = (context as any).intentVector;
    const requirements = await this.requirementAnalyzer.analyze(
      intentVector,
      context
    );

    // Store requirements for later use
    (context as any).requirements = requirements;

    yield {
      type: "data",
      data: { status: "requirements", requirements },
    };
  }

  private async *streamComponents(
    context: A2UIContext,
    streamContext: StreamingContext
  ): AsyncGenerator<A2UIUpdate> {
    const requirements = (context as any).requirements;

    for (let i = 0; i < requirements.components.length; i++) {
      const componentType = requirements.components[i];
      const component = await this.componentSelector.createComponent(
        componentType,
        i,
        requirements
      );

      if (component) {
        yield {
          type: "component",
          componentId: component.id,
          data: component,
          index: streamContext.componentCount++,
          total: requirements.components.length,
        };
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Utilities
  // ==========================================================================

  private getCacheKey(intention: string, context: A2UIContext): string {
    return `${intention}-${context.sessionId}-${context.userId || "anonymous"}`;
  }

  private getTimeoutResponse(context: A2UIContext): A2UIResponse {
    return {
      version: "0.8",
      surface: "main",
      components: [
        {
          type: "alert",
          id: "timeout-alert",
          props: {
            variant: "warning",
            message:
              "UI generation is taking longer than expected. Please try again.",
          },
        },
      ],
      metadata: {
        timestamp: new Date(),
        sessionId: context.sessionId,
        agentId: this.config.agentId,
        generationTime: Date.now(),
      },
    };
  }

  private applyPersonalization(
    response: A2UIResponse,
    preferences: any[]
  ): void {
    for (const pref of preferences) {
      switch (pref.key) {
        case "theme":
          if (response.metadata) {
            response.metadata.userPreferences = [
              ...(response.metadata.userPreferences || []),
              "theme",
            ];
          }
          break;
        case "spacing":
          if (response.layout) {
            response.layout.spacing = pref.value as number;
          }
          break;
      }
    }
  }

  private extractUserPreferences(feedback: UIFeedback[]): any[] {
    const preferences: any[] = [];
    const prefCounts = new Map<string, number>();

    for (const fb of feedback) {
      for (const pref of fb.data.preferences || []) {
        const count = prefCounts.get(pref.key) || 0;
        prefCounts.set(pref.key, count + 1);
      }
    }

    // Convert to preferences with confidence
    for (const [key, count] of prefCounts) {
      preferences.push({
        key,
        confidence: count / feedback.length,
      });
    }

    return preferences;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an A2UI Agent
 *
 * @param config - Agent configuration
 * @returns Configured A2UI agent
 */
export function createA2UIAgent(config: A2UIAgentConfig): A2UIAgent {
  return new A2UIAgent(config);
}
