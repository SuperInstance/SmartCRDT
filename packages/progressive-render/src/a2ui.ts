/**
 * @lsi/progressive-render - A2UI Integration
 *
 * Integration layer for converting A2UI components to progressive chunks
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type { A2UIComponent, A2UILayout, A2UIResponse } from "@lsi/protocol";

import type {
  ProgressiveChunk,
  RenderPhase,
  RenderStrategy,
  ChunkContent,
  ChunkPriority,
  ScheduleOptions,
} from "./types.js";

// ============================================================================
// A2UI TO PROGRESSIVE CHUNKS CONVERTER
// ============================================================================

/**
 * A2UIProgressiveConverter - Converts A2UI components to progressive chunks
 *
 * Handles conversion of A2UI responses into streamable chunks with:
 * - Automatic priority calculation based on component importance
 * - Dependency tracking for nested components
 * - Critical path detection (above-the-fold content)
 * - Component versioning for updates
 */
export class A2UIProgressiveConverter {
  private componentVersions: Map<string, number> = new Map();
  private priorityCache: Map<string, number> = new Map();

  /**
   * Convert A2UI response to progressive chunks
   *
   * @param response - A2UI response
   * @param strategy - Render strategy
   * @returns Array of progressive chunks
   */
  convertResponseToChunks(
    response: A2UIResponse,
    strategy: RenderStrategy = "critical-first"
  ): ProgressiveChunk[] {
    const chunks: ProgressiveChunk[] = [];
    const componentId = response.metadata?.sessionId || "default";

    // Add layout chunk first if present
    if (response.layout) {
      chunks.push(
        this.createLayoutChunk(componentId, response.layout, strategy)
      );
    }

    // Convert components
    for (const component of response.components) {
      const componentChunks = this.convertComponentToChunks(
        component,
        componentId,
        strategy
      );
      chunks.push(...componentChunks);
    }

    // Sort by priority based on strategy
    return this.sortChunksByStrategy(chunks, strategy);
  }

  /**
   * Convert single A2UI component to chunks
   *
   * @param component - A2UI component
   * @param componentId - Parent component ID
   * @param strategy - Render strategy
   * @returns Array of chunks
   */
  convertComponentToChunks(
    component: A2UIComponent,
    componentId: string,
    strategy: RenderStrategy = "critical-first"
  ): ProgressiveChunk[] {
    const chunks: ProgressiveChunk[] = [];
    const version = this.getComponentVersion(component.id);

    // Create skeleton chunk first
    if (strategy === "critical-first" || strategy === "top-down") {
      chunks.push(this.createSkeletonChunk(component, componentId));
    }

    // Create content chunk
    chunks.push(this.createComponentChunk(component, componentId, version));

    // Recursively convert children
    if (component.children && component.children.length > 0) {
      for (const child of component.children) {
        const childChunks = this.convertComponentToChunks(
          child,
          componentId,
          strategy
        );
        chunks.push(...childChunks);

        // Set parent relationship
        for (const chunk of childChunks) {
          chunk.parent_id = component.id;
        }
      }
    }

    return chunks;
  }

  /**
   * Create skeleton chunk for component
   *
   * @param component - A2UI component
   * @param componentId - Parent component ID
   * @returns Skeleton chunk
   */
  private createSkeletonChunk(
    component: A2UIComponent,
    componentId: string
  ): ProgressiveChunk {
    const skeletonConfig = this.getSkeletonConfigForComponent(component);

    return {
      chunk_id: `skeleton-${component.id}-${Date.now()}`,
      phase: "skeleton",
      content: { type: "skeleton", data: skeletonConfig },
      priority: this.calculatePriority(component, "skeleton"),
      created_at: new Date(),
      updated_at: new Date(),
      critical: this.isComponentCritical(component),
      component_id: componentId,
      dependencies: [],
      metadata: {
        source: "generated",
        strategy: "critical-first",
        content_type: component.type,
      },
    };
  }

  /**
   * Create content chunk for component
   *
   * @param component - A2UI component
   * @param componentId - Parent component ID
   * @param version - Component version
   * @returns Content chunk
   */
  private createComponentChunk(
    component: A2UIComponent,
    componentId: string,
    version: number
  ): ProgressiveChunk {
    return {
      chunk_id: `component-${component.id}-${Date.now()}-${version}`,
      phase: "content",
      content: { type: "component", data: component },
      priority: this.calculatePriority(component, "content"),
      created_at: new Date(),
      updated_at: new Date(),
      critical: this.isComponentCritical(component),
      component_id: componentId,
      dependencies: component.children?.map(c => c.id) || [],
      metadata: {
        source: "agent",
        strategy: "streaming",
        content_type: component.type,
        custom: { version },
      },
    };
  }

  /**
   * Create layout chunk
   *
   * @param componentId - Parent component ID
   * @param layout - A2UI layout
   * @param strategy - Render strategy
   * @returns Layout chunk
   */
  private createLayoutChunk(
    componentId: string,
    layout: A2UILayout,
    strategy: RenderStrategy
  ): ProgressiveChunk {
    return {
      chunk_id: `layout-${componentId}-${Date.now()}`,
      phase: "skeleton",
      content: { type: "layout", data: layout },
      priority: 100, // Layout is always high priority
      created_at: new Date(),
      updated_at: new Date(),
      critical: true,
      component_id: componentId,
      dependencies: [],
      metadata: {
        source: "agent",
        strategy,
        content_type: "layout",
      },
    };
  }

  // ========================================================================
  // PRIORITY CALCULATION
  // ========================================================================

  /**
   * Calculate priority for a component
   *
   * @param component - A2UI component
   * @param phase - Render phase
   * @returns Priority score (0-100)
   */
  calculatePriority(component: A2UIComponent, phase: RenderPhase): number {
    const cacheKey = `${component.id}-${phase}`;

    if (this.priorityCache.has(cacheKey)) {
      return this.priorityCache.get(cacheKey)!;
    }

    let priority = 50; // Base priority

    // Critical component bonus
    if (this.isComponentCritical(component)) {
      priority += 30;
    }

    // Phase-based priority
    if (phase === "skeleton") {
      priority += 20;
    }

    // Component type priority
    const typePriority: Record<string, number> = {
      container: 10,
      text: 20,
      button: 25,
      input: 30,
      image: 15,
      list: 20,
      table: 15,
      card: 20,
      modal: 10,
      spinner: 5,
      alert: 40,
      progress: 10,
    };

    priority += typePriority[component.type] || 0;

    // Position-based priority (top of screen = higher)
    if (
      component.style?.position === "fixed" ||
      component.style?.position === "sticky"
    ) {
      priority += 15;
    }

    // Visible components get priority
    if (component.visible !== false) {
      priority += 10;
    }

    // Clamp to 0-100
    priority = Math.max(0, Math.min(100, priority));

    this.priorityCache.set(cacheKey, priority);

    return priority;
  }

  /**
   * Check if component is critical (above-the-fold)
   *
   * @param component - A2UI component
   * @returns Whether component is critical
   */
  private isComponentCritical(component: A2UIComponent): boolean {
    // Fixed/sticky positioned elements are critical
    if (
      component.style?.position === "fixed" ||
      component.style?.position === "sticky"
    ) {
      return true;
    }

    // Top-positioned elements are critical
    if (component.style?.top === "0" || component.style?.top === "0px") {
      return true;
    }

    // Alerts are always critical
    if (component.type === "alert") {
      return true;
    }

    // Explicit critical marker
    if (component.props?.critical === true) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // COMPONENT VERSIONING
  // ========================================================================

  /**
   * Get component version (increment if modified)
   *
   * @param componentId - Component identifier
   * @returns Current version
   */
  getComponentVersion(componentId: string): number {
    const version = this.componentVersions.get(componentId) || 0;
    this.componentVersions.set(componentId, version + 1);
    return version;
  }

  /**
   * Reset component version
   *
   * @param componentId - Component identifier
   */
  resetComponentVersion(componentId: string): void {
    this.componentVersions.delete(componentId);
    this.priorityCache.clear(); // Clear priority cache
  }

  // ========================================================================
  // SKELETON CONFIGURATION
  // ========================================================================

  /**
   * Get skeleton configuration for component
   *
   * @param component - A2UI component
   * @returns Skeleton configuration
   */
  private getSkeletonConfigForComponent(
    component: A2UIComponent
  ): SkeletonConfig {
    const baseConfig: SkeletonConfig = {
      type: "rect",
      animation: "shimmer",
      className: `skeleton-${component.type}`,
    };

    switch (component.type) {
      case "text":
        return {
          ...baseConfig,
          type: "text",
          lines: (component.props?.lines as number) || 3,
          height: 16,
        };

      case "button":
        return {
          ...baseConfig,
          type: "rect",
          width: component.props?.fullWidth ? "100%" : 120,
          height: 40,
          radius: 4,
        };

      case "input":
      case "textarea":
        return {
          ...baseConfig,
          type: "rect",
          width: "100%",
          height: component.type === "textarea" ? 100 : 40,
          radius: 4,
        };

      case "image":
        return {
          ...baseConfig,
          type: "rect",
          width: component.props?.width || 200,
          height: component.props?.height || 200,
          radius: 4,
        };

      case "circle":
        return {
          ...baseConfig,
          type: "circle",
          width: component.props?.size || 40,
          height: component.props?.size || 40,
        };

      case "list":
        return {
          ...baseConfig,
          type: "custom",
          className: "skeleton-list",
          lines: component.props?.items?.length || 5,
        };

      default:
        return {
          ...baseConfig,
          width: component.props?.width || "100%",
          height: component.props?.height || 40,
        };
    }
  }

  // ========================================================================
  // CHUNK SORTING
  // ========================================================================

  /**
   * Sort chunks by strategy
   *
   * @param chunks - Array of chunks
   * @param strategy - Render strategy
   * @returns Sorted chunks
   */
  private sortChunksByStrategy(
    chunks: ProgressiveChunk[],
    strategy: RenderStrategy
  ): ProgressiveChunk[] {
    const sorted = [...chunks];

    switch (strategy) {
      case "critical-first":
        return sorted.sort((a, b) => {
          // Critical chunks first
          if (a.critical && !b.critical) return -1;
          if (!a.critical && b.critical) return 1;
          // Then by priority
          return b.priority - a.priority;
        });

      case "top-down":
        return sorted.sort((a, b) => {
          // Parents before children
          if (a.child_ids?.length && !b.child_ids?.length) return -1;
          if (!a.child_ids?.length && b.child_ids?.length) return 1;
          // Then by priority
          return b.priority - a.priority;
        });

      case "lazy":
        return sorted.sort((a, b) => {
          // Low priority last
          return b.priority - a.priority;
        });

      case "streaming":
        // Stream in order of creation
        return sorted;

      default:
        return sorted;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.componentVersions.clear();
    this.priorityCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getCacheStats(): { versions: number; priorities: number } {
    return {
      versions: this.componentVersions.size,
      priorities: this.priorityCache.size,
    };
  }
}

// ============================================================================
// SKELETON CONFIG TYPE
// ============================================================================

interface SkeletonConfig {
  type: "text" | "circle" | "rect" | "custom";
  width?: string | number;
  height?: string | number;
  lines?: number;
  animation?: "pulse" | "wave" | "shimmer" | "none";
  radius?: string | number;
  className?: string;
}
