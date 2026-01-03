/**
 * @fileoverview A2UIIntegration - Integrate A/B testing with A2UI framework
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type { A2UIResponse, A2UIEvent } from "@lsi/protocol";
import type {
  A2UIConfig,
  Experiment,
  Variant,
  AllocationResult,
  MetricValue,
  ConversionData,
  EngagementData,
  EventStorage,
} from "../types.js";

// ============================================================================
// A2UI INTEGRATION
// ============================================================================

/**
 * A2UIIntegration - Integration layer for A/B testing with A2UI
 *
 * Manages UI variant rendering, event tracking, and metric collection.
 */
export class A2UIIntegration {
  private config: A2UIConfig;
  private allocations: Map<string, AllocationResult> = new Map();
  private eventStorage: EventStorage;
  private metricBuffer: MetricValue[] = [];

  constructor(config: A2UIConfig, eventStorage: EventStorage) {
    this.config = config;
    this.eventStorage = eventStorage;
  }

  /**
   * Render a variant for a user
   */
  async renderVariant(
    userId: string,
    experiment: Experiment
  ): Promise<A2UIResponse> {
    // Allocate user to variant
    const allocation = await this.getOrCreateAllocation(userId, experiment);
    const variant = experiment.variants.find(v => v.id === allocation.variant);

    if (!variant) {
      // Return fallback variant
      return this.config.variants[this.config.fallbackVariant];
    }

    // Return variant UI
    if (variant.ui) {
      return variant.ui;
    }

    // Return default UI for variant
    return this.config.variants[this.config.defaultVariant];
  }

  /**
   * Track an A2UI event
   */
  async trackEvent(
    event: A2UIEvent,
    userId: string,
    experimentId: string
  ): Promise<void> {
    const allocation = this.allocations.get(`${userId}:${experimentId}`);

    const enrichedEvent: A2UIEvent = {
      ...event,
      userId,
      variantId: allocation?.variant,
      experimentId, // Include experimentId for storage
      timestamp: event.timestamp || Date.now(),
    };

    await this.eventStorage.saveEvent(enrichedEvent);

    // Convert to metric if applicable
    await this.convertEventToMetric(enrichedEvent, experimentId);
  }

  /**
   * Track a component interaction
   */
  async trackInteraction(
    userId: string,
    experimentId: string,
    componentId: string,
    interactionType: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent(
      {
        type: "interaction",
        componentId,
        data: { interactionType, ...data },
        timestamp: Date.now(),
      },
      userId,
      experimentId
    );
  }

  /**
   * Track a page view
   */
  async trackPageView(
    userId: string,
    experimentId: string,
    page: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.trackEvent(
      {
        type: "page_view",
        data: { page, ...data },
        timestamp: Date.now(),
      },
      userId,
      experimentId
    );
  }

  /**
   * Track a conversion event
   */
  async trackConversion(
    userId: string,
    experimentId: string,
    conversionType: string,
    value?: number,
    data?: Record<string, unknown>
  ): Promise<void> {
    const allocation = this.allocations.get(`${userId}:${experimentId}`);

    await this.trackEvent(
      {
        type: "conversion",
        data: { conversionType, value, ...data },
        timestamp: Date.now(),
      },
      userId,
      experimentId
    );

    // Also record as conversion metric
    if (allocation) {
      this.metricBuffer.push({
        name: "conversion",
        type: "conversion",
        value: value || 1,
        timestamp: Date.now(),
        userId,
        variant: allocation.variant,
        experiment: experimentId,
        metadata: { conversionType, ...data },
      });
    }
  }

  /**
   * Get buffered metrics
   */
  getBufferedMetrics(): MetricValue[] {
    return [...this.metricBuffer];
  }

  /**
   * Clear buffered metrics
   */
  clearBufferedMetrics(): void {
    this.metricBuffer = [];
  }

  /**
   * Get events for analysis
   */
  async getEvents(experimentId: string, userId?: string): Promise<A2UIEvent[]> {
    return this.eventStorage.getEvents(experimentId, userId);
  }

  /**
   * Get allocation for a user
   */
  getAllocation(
    userId: string,
    experimentId: string
  ): AllocationResult | undefined {
    return this.allocations.get(`${userId}:${experimentId}`);
  }

  /**
   * Clear allocation for a user
   */
  clearAllocation(userId: string, experimentId: string): void {
    this.allocations.delete(`${userId}:${experimentId}`);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get or create allocation for a user
   */
  private async getOrCreateAllocation(
    userId: string,
    experiment: Experiment
  ): Promise<AllocationResult> {
    const key = `${userId}:${experiment.id}`;
    let allocation = this.allocations.get(key);

    if (!allocation) {
      // Create new allocation (simple hash-based)
      const hash = this.hashUserId(userId, experiment.id);
      const variantIndex = hash % experiment.variants.length;
      const variant = experiment.variants[variantIndex];

      allocation = {
        userId,
        variant: variant.id,
        experiment: experiment.id,
        timestamp: Date.now(),
        strategy: "hash",
      };

      this.allocations.set(key, allocation);

      // Track impression
      await this.trackEvent(
        {
          type: "impression",
          data: { variantId: variant.id },
          timestamp: Date.now(),
        },
        userId,
        experiment.id
      );
    }

    return allocation;
  }

  /**
   * Convert event to metric
   */
  private async convertEventToMetric(
    event: A2UIEvent,
    experimentId: string
  ): Promise<void> {
    if (!event.variantId) return;

    let metricName: string | undefined;
    let metricValue: number | undefined;
    let metricType: "conversion" | "engagement" | "revenue" | "satisfaction" =
      "engagement";

    switch (event.type) {
      case "interaction":
        metricName = "interactions";
        metricValue = 1;
        metricType = "engagement";
        break;
      case "page_view":
        metricName = "page_views";
        metricValue = 1;
        metricType = "engagement";
        break;
      case "conversion":
        metricName = "conversion";
        metricValue = (event.data?.value as number) || 1;
        metricType = "conversion";
        break;
      case "impression":
        metricName = "impressions";
        metricValue = 1;
        metricType = "engagement";
        break;
    }

    if (metricName && metricValue !== undefined && event.userId) {
      this.metricBuffer.push({
        name: metricName,
        type: metricType,
        value: metricValue,
        timestamp: event.timestamp,
        userId: event.userId,
        variant: event.variantId,
        experiment: experimentId,
        metadata: event.data,
      });
    }
  }

  /**
   * Hash user ID for consistent allocation
   */
  private hashUserId(userId: string, experimentId: string): number {
    const combined = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// VARIANT COMPARATOR
// ============================================================================

/**
 * VariantComparator - Compare A2UI variants for differences
 */
export class VariantComparator {
  /**
   * Compare two A2UI responses
   */
  compareVariants(
    ui1: A2UIResponse,
    ui2: A2UIResponse
  ): {
    identical: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    // Compare component counts
    if (ui1.components.length !== ui2.components.length) {
      differences.push(
        `Component count: ${ui1.components.length} vs ${ui2.components.length}`
      );
    }

    // Compare component types
    const types1 = new Set(ui1.components.map(c => c.type));
    const types2 = new Set(ui2.components.map(c => c.type));

    for (const type of types1) {
      if (!types2.has(type)) {
        differences.push(`Component type "${type}" missing in second variant`);
      }
    }

    for (const type of types2) {
      if (!types1.has(type)) {
        differences.push(`Component type "${type}" missing in first variant`);
      }
    }

    // Compare layout
    if (ui1.layout?.type !== ui2.layout?.type) {
      differences.push(
        `Layout type: ${ui1.layout?.type} vs ${ui2.layout?.type}`
      );
    }

    return {
      identical: differences.length === 0,
      differences,
    };
  }

  /**
   * Calculate similarity score between two UIs
   */
  calculateSimilarity(ui1: A2UIResponse, ui2: A2UIResponse): number {
    const { differences } = this.compareVariants(ui1, ui2);

    // Simple heuristic: each difference reduces similarity by 10%
    return Math.max(0, 1 - differences.length * 0.1);
  }
}

// ============================================================================
// UI VARIANT GENERATOR
// ============================================================================

/**
 * UIVariantGenerator - Generate UI variants for testing
 */
export class UIVariantGenerator {
  /**
   * Create a variant from base UI with modifications
   */
  createVariant(
    baseUI: A2UIResponse,
    variantId: string,
    name: string,
    modifications: {
      componentId?: string;
      property?: string;
      value?: unknown;
      operation?: "replace" | "add" | "remove";
    }[]
  ): A2UIResponse {
    const variantUI: A2UIResponse = JSON.parse(JSON.stringify(baseUI));

    for (const mod of modifications) {
      if (mod.componentId) {
        const component = variantUI.components.find(
          c => c.id === mod.componentId
        );
        if (component) {
          if (mod.operation === "remove") {
            variantUI.components = variantUI.components.filter(
              c => c.id !== mod.componentId
            );
          } else if (mod.property && mod.value !== undefined) {
            if (mod.property === "props") {
              component.props = { ...component.props, ...mod.value };
            } else if (mod.property === "style") {
              component.style = { ...component.style, ...mod.value };
            } else {
              (component as any)[mod.property] = mod.value;
            }
          }
        }
      }
    }

    return variantUI;
  }

  /**
   * Generate multiple variants from base UI
   */
  generateVariants(
    baseUI: A2UIResponse,
    variantConfigs: Array<{
      id: string;
      name: string;
      modifications: Array<{
        componentId?: string;
        property?: string;
        value?: unknown;
        operation?: "replace" | "add" | "remove";
      }>;
    }>
  ): Map<string, A2UIResponse> {
    const variants = new Map<string, A2UIResponse>();

    // Add control (original)
    variants.set("control", baseUI);

    // Add variants
    for (const config of variantConfigs) {
      const variant = this.createVariant(
        baseUI,
        config.id,
        config.name,
        config.modifications
      );
      variants.set(config.id, variant);
    }

    return variants;
  }
}

// ============================================================================
// IN-MEMORY EVENT STORAGE (Default implementation)
// ============================================================================

/**
 * In-memory storage for events (for development/testing)
 */
export class InMemoryEventStorage implements EventStorage {
  private events: Map<string, A2UIEvent[]> = new Map();

  async saveEvent(event: A2UIEvent): Promise<void> {
    if (!event.experimentId) {
      // Skip events without experiment ID
      return;
    }
    const key = event.experimentId;
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    this.events.get(key)!.push(event);
  }

  async getEvents(experimentId: string, userId?: string): Promise<A2UIEvent[]> {
    const events = this.events.get(experimentId) || [];
    if (userId) {
      return events.filter(e => e.userId === userId);
    }
    return events;
  }

  async clearEvents(experimentId: string): Promise<void> {
    this.events.delete(experimentId);
  }

  /** Clear all events (for testing) */
  clear(): void {
    this.events.clear();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create A2UI integration
 */
export function createA2UIIntegration(
  config: A2UIConfig,
  eventStorage?: EventStorage
): A2UIIntegration {
  const storage = eventStorage || new InMemoryEventStorage();
  return new A2UIIntegration(config, storage);
}

/**
 * Create variant comparator
 */
export function createVariantComparator(): VariantComparator {
  return new VariantComparator();
}

/**
 * Create UI variant generator
 */
export function createUIVariantGenerator(): UIVariantGenerator {
  return new UIVariantGenerator();
}
