/**
 * Affordance Detector for VL-JEPA World Model
 * Detects possible interactions (click, type, scroll, drag, etc.)
 */

import type {
  Affordance,
  UIElement,
  AffordanceEvidence,
  BoundingBox,
  VisualFeatures,
  ContextFeatures,
} from "../types.js";

export class AffordanceDetector {
  private affordanceHistory: Map<string, Affordance[]> = new Map();
  private confidenceThreshold = 0.5;

  /**
   * Detect all affordances for a UI element
   */
  detectAffordances(element: UIElement): Affordance[] {
    const affordances: Affordance[] = [];

    // Check each affordance type
    const clickable = this.detectClickable(element);
    if (clickable.probability >= this.confidenceThreshold) {
      affordances.push(clickable);
    }

    const typeable = this.detectTypeable(element);
    if (typeable.probability >= this.confidenceThreshold) {
      affordances.push(typeable);
    }

    const scrollable = this.detectScrollable(element);
    if (scrollable.probability >= this.confidenceThreshold) {
      affordances.push(scrollable);
    }

    const draggable = this.detectDraggable(element);
    if (draggable.probability >= this.confidenceThreshold) {
      affordances.push(draggable);
    }

    const hoverable = this.detectHoverable(element);
    if (hoverable.probability >= this.confidenceThreshold) {
      affordances.push(hoverable);
    }

    // Store in history
    this.affordanceHistory.set(element.id, affordances);

    return affordances;
  }

  /**
   * Detect if element is clickable
   */
  private detectClickable(element: UIElement): Affordance {
    const evidence: AffordanceEvidence[] = [];
    let probability = 0;

    // Visual evidence
    if (element.visual.hasBorder) {
      evidence.push({
        type: "has_border",
        confidence: 0.3,
        source: "visual",
      });
      probability += 0.3;
    }

    if (element.visual.hasShadow) {
      evidence.push({
        type: "has_shadow",
        confidence: 0.2,
        source: "visual",
      });
      probability += 0.2;
    }

    if (element.visual.icon) {
      evidence.push({
        type: "is_icon",
        confidence: 0.4,
        source: "visual",
      });
      probability += 0.4;
    }

    // Semantic evidence
    const clickableSemantics = [
      "button",
      "link",
      "click",
      "submit",
      "cancel",
      "ok",
      "yes",
      "no",
      "close",
      "delete",
    ];

    for (const term of clickableSemantics) {
      if (element.semantic.toLowerCase().includes(term)) {
        evidence.push({
          type: "semantic_match",
          confidence: 0.5,
          source: "semantic",
        });
        probability += 0.5;
        break;
      }
    }

    // Contextual evidence
    if (element.context.zIndex > 0) {
      evidence.push({
        type: "elevated",
        confidence: 0.1,
        source: "contextual",
      });
      probability += 0.1;
    }

    // Cap probability
    probability = Math.min(1, probability);

    return {
      id: `aff-click-${element.id}`,
      type: "click",
      element,
      probability,
      evidence,
    };
  }

  /**
   * Detect if element is typeable (text input)
   */
  private detectTypeable(element: UIElement): Affordance {
    const evidence: AffordanceEvidence[] = [];
    let probability = 0;

    // Semantic evidence
    const typeableSemantics = [
      "input",
      "text",
      "field",
      "search",
      "email",
      "password",
      "username",
      "form",
      "textarea",
    ];

    for (const term of typeableSemantics) {
      if (element.semantic.toLowerCase().includes(term)) {
        evidence.push({
          type: "semantic_match",
          confidence: 0.7,
          source: "semantic",
        });
        probability += 0.7;
        break;
      }
    }

    // Visual evidence
    if (element.visual.shape === "rectangle" && element.visual.size > 5000) {
      evidence.push({
        type: "large_rectangle",
        confidence: 0.2,
        source: "visual",
      });
      probability += 0.2;
    }

    // Cap probability
    probability = Math.min(1, probability);

    return {
      id: `aff-type-${element.id}`,
      type: "type",
      element,
      probability,
      evidence,
    };
  }

  /**
   * Detect if element is scrollable
   */
  private detectScrollable(element: UIElement): Affordance {
    const evidence: AffordanceEvidence[] = [];
    let probability = 0;

    // Semantic evidence
    const scrollableSemantics = [
      "scroll",
      "list",
      "feed",
      "timeline",
      "content",
    ];

    for (const term of scrollableSemantics) {
      if (element.semantic.toLowerCase().includes(term)) {
        evidence.push({
          type: "semantic_match",
          confidence: 0.6,
          source: "semantic",
        });
        probability += 0.6;
        break;
      }
    }

    // Visual evidence
    if (element.visual.shape === "rectangle" && element.visual.size > 10000) {
      evidence.push({
        type: "large_area",
        confidence: 0.3,
        source: "visual",
      });
      probability += 0.3;
    }

    // Contextual evidence
    if (element.context.neighbors.length > 5) {
      evidence.push({
        type: "many_children",
        confidence: 0.2,
        source: "contextual",
      });
      probability += 0.2;
    }

    // Cap probability
    probability = Math.min(1, probability);

    return {
      id: `aff-scroll-${element.id}`,
      type: "scroll",
      element,
      probability,
      evidence,
    };
  }

  /**
   * Detect if element is draggable
   */
  private detectDraggable(element: UIElement): Affordance {
    const evidence: AffordanceEvidence[] = [];
    let probability = 0;

    // Semantic evidence
    const draggableSemantics = ["drag", "move", "slider", "handle", "knob"];

    for (const term of draggableSemantics) {
      if (element.semantic.toLowerCase().includes(term)) {
        evidence.push({
          type: "semantic_match",
          confidence: 0.7,
          source: "semantic",
        });
        probability += 0.7;
        break;
      }
    }

    // Visual evidence
    if (element.visual.shape === "circle" && element.visual.size < 5000) {
      evidence.push({
        type: "small_circle",
        confidence: 0.3,
        source: "visual",
      });
      probability += 0.3;
    }

    // Cap probability
    probability = Math.min(1, probability);

    return {
      id: `aff-drag-${element.id}`,
      type: "drag",
      element,
      probability,
      evidence,
    };
  }

  /**
   * Detect if element is hoverable
   */
  private detectHoverable(element: UIElement): Affordance {
    const evidence: AffordanceEvidence[] = [];
    let probability = 0;

    // Hoverable is usually clickable
    const clickable = this.detectClickable(element);
    if (clickable.probability > 0.5) {
      evidence.push({
        type: "clickable_implies_hoverable",
        confidence: 0.4,
        source: "contextual",
      });
      probability += 0.4;
    }

    // Semantic evidence
    const hoverableSemantics = ["tooltip", "menu", "dropdown", "hover"];

    for (const term of hoverableSemantics) {
      if (element.semantic.toLowerCase().includes(term)) {
        evidence.push({
          type: "semantic_match",
          confidence: 0.6,
          source: "semantic",
        });
        probability += 0.6;
        break;
      }
    }

    // Cap probability
    probability = Math.min(1, probability);

    return {
      id: `aff-hover-${element.id}`,
      type: "hover",
      element,
      probability,
      evidence,
    };
  }

  /**
   * Get affordance history for an element
   */
  getHistory(elementId: string): Affordance[] {
    return this.affordanceHistory.get(elementId) || [];
  }

  /**
   * Get the most likely affordance for an element
   */
  getMostLikelyAffordance(element: UIElement): Affordance | null {
    const affordances = this.detectAffordances(element);

    if (affordances.length === 0) return null;

    // Sort by probability and return the highest
    affordances.sort((a, b) => b.probability - a.probability);
    return affordances[0];
  }

  /**
   * Check if an element has a specific affordance
   */
  hasAffordance(
    element: UIElement,
    affordanceType: Affordance["type"]
  ): boolean {
    const affordances = this.detectAffordances(element);
    return affordances.some(a => a.type === affordanceType);
  }

  /**
   * Batch detect affordances for multiple elements
   */
  batchDetect(elements: UIElement[]): Map<string, Affordance[]> {
    const results = new Map<string, Affordance[]>();

    for (const element of elements) {
      results.set(element.id, this.detectAffordances(element));
    }

    return results;
  }

  /**
   * Find elements with specific affordance
   */
  findWithAffordance(
    elements: UIElement[],
    affordanceType: Affordance["type"]
  ): UIElement[] {
    const matching: UIElement[] = [];

    for (const element of elements) {
      if (this.hasAffordance(element, affordanceType)) {
        matching.push(element);
      }
    }

    return matching;
  }

  /**
   * Create a UI element from raw data
   */
  createElement(config: {
    id?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    semantic?: string;
    visual?: Partial<VisualFeatures>;
    context?: Partial<ContextFeatures>;
  }): UIElement {
    const id = config.id || `element-${Date.now()}-${Math.random()}`;

    return {
      id,
      bounds: config.bounds || { x: 0, y: 0, width: 100, height: 100 },
      semantic: config.semantic || "",
      visual: {
        color: config.visual?.color || "#ffffff",
        shape: config.visual?.shape || "rectangle",
        size: config.visual?.size || 10000,
        text: config.visual?.text,
        icon: config.visual?.icon || false,
        hasBorder: config.visual?.hasBorder || false,
        hasShadow: config.visual?.hasShadow || false,
      },
      context: {
        position: config.context?.position || "unknown",
        neighbors: config.context?.neighbors || [],
        parent: config.context?.parent || "root",
        zIndex: config.context?.zIndex || 0,
      },
    };
  }

  /**
   * Clear affordance history
   */
  clearHistory(): void {
    this.affordanceHistory.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalElements: number;
    totalAffordances: number;
    avgAffordancesPerElement: number;
    typeDistribution: Map<string, number>;
  } {
    const typeDistribution = new Map<string, number>();
    let totalAffordances = 0;

    for (const affordances of this.affordanceHistory.values()) {
      totalAffordances += affordances.length;

      for (const affordance of affordances) {
        const count = typeDistribution.get(affordance.type) || 0;
        typeDistribution.set(affordance.type, count + 1);
      }
    }

    return {
      totalElements: this.affordanceHistory.size,
      totalAffordances,
      avgAffordancesPerElement:
        this.affordanceHistory.size > 0
          ? totalAffordances / this.affordanceHistory.size
          : 0,
      typeDistribution,
    };
  }
}
