/**
 * @fileoverview Visual Reasoning LangGraph Node
 *
 * LangGraph node that performs visual reasoning on VL-JEPA embeddings
 * to extract insights, patterns, and high-level understanding.
 *
 * @version 1.0.0
 */

import type { RunnableConfig } from "@langchain/core/runnables";
import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";
import type { VLJEPAAgentState } from "../state/VLJEPAAgentState.js";
import type { VisualUIElement, VisualFeatures } from "../state/VisualState.js";
import type { EmbeddingVector } from "../state/EmbeddingState.js";

// ============================================================================
// VISUAL REASONING TYPES
// ============================================================================

/**
 * Visual reasoning result
 */
export interface VisualReasoningResult {
  /** High-level insights */
  insights: VisualInsight[];

  /** Detected patterns */
  patterns: VisualPattern[];

  /** Design recommendations */
  recommendations: DesignRecommendation[];

  /** Accessibility issues */
  accessibilityIssues: AccessibilityIssue[];

  /** UX concerns */
  uxConcerns: UXConcern[];

  /** Overall quality score */
  qualityScore: number;
}

/**
 * Visual insight
 */
export interface VisualInsight {
  /** Insight type */
  type:
    | "layout"
    | "color"
    | "typography"
    | "spacing"
    | "alignment"
    | "hierarchy";

  /** Insight description */
  description: string;

  /** Confidence */
  confidence: number;

  /** Affected elements */
  affectedElements: string[];

  /** Severity */
  severity: "info" | "warning" | "error";
}

/**
 * Visual pattern
 */
export interface VisualPattern {
  /** Pattern type */
  type:
    | "grid"
    | "list"
    | "card"
    | "form"
    | "navbar"
    | "sidebar"
    | "hero"
    | "unknown";

  /** Pattern name */
  name: string;

  /** Description */
  description: string;

  /** Elements in pattern */
  elements: string[];

  /** Confidence */
  confidence: number;

  /** Bounds (normalized 0-1) */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Design recommendation
 */
export interface DesignRecommendation {
  /** Recommendation type */
  type: "add" | "modify" | "remove" | "reorder";

  /** Target element */
  target: string;

  /** Recommendation description */
  description: string;

  /** Suggested action */
  suggestedAction: VLJEPAAction;

  /** Priority */
  priority: "low" | "medium" | "high" | "critical";

  /** Expected impact */
  impact: "low" | "medium" | "high";
}

/**
 * Accessibility issue
 */
export interface AccessibilityIssue {
  /** WCAG criterion */
  wcagCriterion: string;

  /** Issue description */
  description: string;

  /** Affected elements */
  affectedElements: string[];

  /** Severity */
  severity: "low" | "medium" | "high" | "critical";

  /** Suggested fix */
  suggestedFix: VLJEPAAction;
}

/**
 * UX concern
 */
export interface UXConcern {
  /** Concern type */
  type:
    | "navigation"
    | "readability"
    | "clarity"
    | "feedback"
    | "consistency"
    | "performance";

  /** Description */
  description: string;

  /** Affected elements */
  affectedElements: string[];

  /** Severity */
  severity: "low" | "medium" | "high";

  /** Recommendation */
  recommendation: string;
}

/**
 * Visual reasoning node configuration
 */
export interface VisualReasoningNodeConfig {
  /** Enable insight generation */
  enableInsights?: boolean;

  /** Enable pattern detection */
  enablePatterns?: boolean;

  /** Enable recommendations */
  enableRecommendations?: boolean;

  /** Enable accessibility checking */
  enableAccessibility?: boolean;

  /** Enable UX analysis */
  enableUXAnalysis?: boolean;

  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Quality scoring weights */
  qualityWeights?: {
    hierarchy: number;
    consistency: number;
    accessibility: number;
    responsiveness: number;
  };
}

// ============================================================================
// VISUAL REASONING NODE
// ============================================================================

/**
 * Visual Reasoning LangGraph Node
 *
 * Performs visual reasoning on VL-JEPA embeddings to extract insights,
 * detect patterns, and provide recommendations.
 */
export class VisualReasoningNode {
  private config: Required<VisualReasoningNodeConfig>;

  constructor(config: VisualReasoningNodeConfig = {}) {
    this.config = {
      enableInsights: true,
      enablePatterns: true,
      enableRecommendations: true,
      enableAccessibility: true,
      enableUXAnalysis: true,
      minConfidence: 0.4,
      qualityWeights: {
        hierarchy: 0.3,
        consistency: 0.3,
        accessibility: 0.2,
        responsiveness: 0.2,
      },
      ...config,
    };
  }

  /**
   * Process state through visual reasoning
   *
   * @param state - Current agent state
   * @param config - Runnable config
   * @returns Updated agent state with reasoning results
   */
  async invoke(
    state: VLJEPAAgentState,
    config?: RunnableConfig
  ): Promise<Partial<VLJEPAAgentState>> {
    const elements = state.visual.elements;
    const features = state.visual.features;
    const embeddings = state.embeddings;

    const reasoning: VisualReasoningResult = {
      insights: this.config.enableInsights
        ? this.generateInsights(elements, features)
        : [],
      patterns: this.config.enablePatterns
        ? this.detectPatterns(elements, features)
        : [],
      recommendations: this.config.enableRecommendations
        ? this.generateRecommendations(elements, features)
        : [],
      accessibilityIssues: this.config.enableAccessibility
        ? this.checkAccessibility(elements, features)
        : [],
      uxConcerns: this.config.enableUXAnalysis
        ? this.analyzeUX(elements, features)
        : [],
      qualityScore: 0,
    };

    // Calculate overall quality score
    reasoning.qualityScore = this.calculateQualityScore(
      reasoning,
      elements,
      features
    );

    return {
      metadata: {
        ...state.metadata,
        visualReasoning: reasoning,
      },
    };
  }

  /**
   * Generate visual insights
   */
  private generateInsights(
    elements: VisualUIElement[],
    features: VisualFeatures
  ): VisualInsight[] {
    const insights: VisualInsight[] = [];

    // Layout insights
    if (features.layout.type === "unknown") {
      insights.push({
        type: "layout",
        description:
          "Layout type could not be determined - consider using flexbox or grid",
        confidence: 0.7,
        affectedElements: elements.map(e => e.id),
        severity: "warning",
      });
    }

    // Color insights
    if (features.colors.length < 2) {
      insights.push({
        type: "color",
        description:
          "Limited color palette detected - consider adding accent colors",
        confidence: 0.6,
        affectedElements: elements.map(e => e.id),
        severity: "info",
      });
    }

    // Typography insights
    if (features.typography.sizes.length > 6) {
      insights.push({
        type: "typography",
        description:
          "Too many font sizes detected - consider consolidating to a scale",
        confidence: 0.8,
        affectedElements: elements.map(e => e.id),
        severity: "warning",
      });
    }

    // Spacing insights
    const avgGap = features.spacing.averageGap;
    if (avgGap < 8 || avgGap > 32) {
      insights.push({
        type: "spacing",
        description: `Unusual spacing detected (${avgGap}px) - consider using 8px grid`,
        confidence: 0.7,
        affectedElements: elements.map(e => e.id),
        severity: "info",
      });
    }

    // Alignment insights
    const misaligned = this.checkAlignment(elements);
    if (misaligned.length > 0) {
      insights.push({
        type: "alignment",
        description: `${misaligned.length} elements may be misaligned`,
        confidence: 0.6,
        affectedElements: misaligned,
        severity: "warning",
      });
    }

    // Hierarchy insights
    if (features.hierarchy.depth > 6) {
      insights.push({
        type: "hierarchy",
        description: "Deep nesting detected - consider flattening structure",
        confidence: 0.7,
        affectedElements: elements.filter(e => e.depth > 4).map(e => e.id),
        severity: "info",
      });
    }

    return insights;
  }

  /**
   * Detect visual patterns
   */
  private detectPatterns(
    elements: VisualUIElement[],
    features: VisualFeatures
  ): VisualPattern[] {
    const patterns: VisualPattern[] = [];

    // Detect grid pattern
    if (features.layout.type === "grid" && features.layout.grid) {
      patterns.push({
        type: "grid",
        name: "Grid Layout",
        description: `${features.layout.grid.columns}x${features.layout.grid.rows} grid`,
        elements: elements.map(e => e.id),
        confidence: features.layout.confidence,
        bounds: this.calculateGroupBounds(elements),
      });
    }

    // Detect card pattern
    const cards = elements.filter(e => e.type === "card");
    if (cards.length > 1) {
      patterns.push({
        type: "card",
        name: "Card Grid",
        description: `${cards.length} cards detected`,
        elements: cards.map(e => e.id),
        confidence: 0.8,
        bounds: this.calculateGroupBounds(cards),
      });
    }

    // Detect navbar pattern
    const navbar = elements.find(e => e.type === "navbar");
    if (navbar) {
      patterns.push({
        type: "navbar",
        name: "Navigation Bar",
        description: "Top navigation detected",
        elements: [navbar.id],
        confidence: 0.9,
        bounds: navbar.bbox,
      });
    }

    // Detect form pattern
    const inputs = elements.filter(
      e => e.type === "input" || e.type === "textarea" || e.type === "select"
    );
    if (inputs.length >= 2) {
      patterns.push({
        type: "form",
        name: "Form",
        description: `${inputs.length} form inputs detected`,
        elements: inputs.map(e => e.id),
        confidence: 0.8,
        bounds: this.calculateGroupBounds(inputs),
      });
    }

    return patterns;
  }

  /**
   * Generate design recommendations
   */
  private generateRecommendations(
    elements: VisualUIElement[],
    features: VisualFeatures
  ): DesignRecommendation[] {
    const recommendations: DesignRecommendation[] = [];

    // Check for responsive design
    const hasResponsive = elements.some(
      e => e.styles.maxWidth !== undefined || e.styles.width === "100%"
    );

    if (!hasResponsive) {
      recommendations.push({
        type: "modify",
        target: "container",
        description: "Add responsive constraints for better mobile experience",
        suggestedAction: {
          type: "modify",
          target: "container",
          params: { maxWidth: "1200px", width: "100%" },
          confidence: 0.8,
          reasoning: "Responsive design improves mobile UX",
        },
        priority: "high",
        impact: "high",
      });
    }

    // Check for focus indicators
    const hasFocusIndicators = elements.some(
      e => e.styles.outline !== undefined || e.styles.boxShadow !== undefined
    );

    if (!hasFocusIndicators) {
      recommendations.push({
        type: "modify",
        target: "interactive",
        description: "Add visible focus indicators for accessibility",
        suggestedAction: {
          type: "modify",
          target: "interactive",
          params: { outline: "2px solid blue" },
          confidence: 0.9,
          reasoning: "Focus indicators are required for WCAG compliance",
        },
        priority: "high",
        impact: "medium",
      });
    }

    // Check for proper heading hierarchy
    const headingCounts = {
      h1: elements.filter(e => e.selector.includes("h1")).length,
      h2: elements.filter(e => e.selector.includes("h2")).length,
    };

    if (headingCounts.h1 === 0) {
      recommendations.push({
        type: "add",
        target: "heading",
        description: "Add h1 heading for page title",
        suggestedAction: {
          type: "create",
          target: "h1",
          params: { text: "Page Title", tag: "h1" },
          confidence: 0.9,
          reasoning: "Every page should have a single h1 heading",
        },
        priority: "high",
        impact: "high",
      });
    }

    if (headingCounts.h1 > 1) {
      recommendations.push({
        type: "modify",
        target: "h1",
        description: "Multiple h1 headings detected - use only one",
        suggestedAction: {
          type: "modify",
          target: "h1:nth-child(n+2)",
          params: { tag: "h2" },
          confidence: 0.8,
          reasoning: "Use only one h1 per page for SEO and accessibility",
        },
        priority: "medium",
        impact: "medium",
      });
    }

    return recommendations;
  }

  /**
   * Check accessibility issues
   */
  private checkAccessibility(
    elements: VisualUIElement[],
    features: VisualFeatures
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check color contrast
    const lowContrast = features.typography.contrastScores.filter(
      score => score < 4.5
    ).length;

    if (lowContrast > 0) {
      issues.push({
        wcagCriterion: "WCAG 2.1 AA (1.4.3)",
        description: `${lowContrast} text elements have insufficient color contrast (< 4.5:1)`,
        affectedElements: elements
          .filter(e => e.type === "text" || e.type === "heading")
          .map(e => e.id),
        severity: "high",
        suggestedFix: {
          type: "modify",
          target: "text",
          params: { color: "#000000" },
          confidence: 0.7,
          reasoning: "Increase text color contrast for readability",
        },
      });
    }

    // Check for alt text on images
    const images = elements.filter(e => e.type === "image");
    const imagesWithoutAlt = images.filter(img => !img.text);

    if (imagesWithoutAlt.length > 0) {
      issues.push({
        wcagCriterion: "WCAG 2.1 A (1.1.1)",
        description: `${imagesWithoutAlt.length} images are missing alt text`,
        affectedElements: imagesWithoutAlt.map(e => e.id),
        severity: "critical",
        suggestedFix: {
          type: "modify",
          target: "img",
          params: { alt: "Descriptive text" },
          confidence: 0.9,
          reasoning: "All images must have alt text for screen readers",
        },
      });
    }

    // Check for form labels
    const inputs = elements.filter(
      e => e.type === "input" || e.type === "textarea" || e.type === "select"
    );
    const inputsWithoutLabels = inputs.filter(input => !input.text);

    if (inputsWithoutLabels.length > 0) {
      issues.push({
        wcagCriterion: "WCAG 2.1 A (1.3.1)",
        description: `${inputsWithoutLabels.length} form inputs are missing labels`,
        affectedElements: inputsWithoutLabels.map(e => e.id),
        severity: "high",
        suggestedFix: {
          type: "modify",
          target: "input",
          params: { label: "Field label" },
          confidence: 0.9,
          reasoning: "All form inputs must have associated labels",
        },
      });
    }

    // Check button text
    const buttons = elements.filter(e => e.type === "button");
    const buttonsWithoutText = buttons.filter(
      btn => !btn.text || btn.text.length < 3
    );

    if (buttonsWithoutText.length > 0) {
      issues.push({
        wcagCriterion: "WCAG 2.1 A (2.4.4)",
        description: `${buttonsWithoutText.length} buttons have unclear text`,
        affectedElements: buttonsWithoutText.map(e => e.id),
        severity: "medium",
        suggestedFix: {
          type: "modify",
          target: "button",
          params: { text: "Clear action text" },
          confidence: 0.8,
          reasoning: "Buttons should have descriptive text",
        },
      });
    }

    return issues;
  }

  /**
   * Analyze UX concerns
   */
  private analyzeUX(
    elements: VisualUIElement[],
    features: VisualFeatures
  ): UXConcern[] {
    const concerns: UXConcern[] = [];

    // Check navigation clarity
    const navItems = elements.filter(
      e => e.type === "navbar" || e.selector.includes("nav")
    );
    if (navItems.length === 0) {
      concerns.push({
        type: "navigation",
        description: "No navigation detected",
        affectedElements: [],
        severity: "medium",
        recommendation: "Add clear navigation to help users find content",
      });
    }

    // Check readability
    const avgFontSize =
      features.typography.sizes.length > 0
        ? features.typography.sizes.reduce((sum, size) => sum + size, 0) /
          features.typography.sizes.length
        : 16;

    if (avgFontSize < 14) {
      concerns.push({
        type: "readability",
        description: "Font size may be too small for comfortable reading",
        affectedElements: elements
          .filter(e => e.type === "text")
          .map(e => e.id),
        severity: "medium",
        recommendation: "Increase base font size to at least 16px",
      });
    }

    // Check clarity
    const focusPoints = features.hierarchy.focusPoints;
    if (focusPoints.length > 5) {
      concerns.push({
        type: "clarity",
        description: "Too many focal points may confuse users",
        affectedElements: [],
        severity: "low",
        recommendation:
          "Reduce number of focal points for clearer visual hierarchy",
      });
    }

    // Check consistency
    const fontFamilies = features.typography.families;
    if (fontFamilies.length > 3) {
      concerns.push({
        type: "consistency",
        description: "Multiple font families detected - may reduce consistency",
        affectedElements: [],
        severity: "low",
        recommendation: "Limit to 2-3 font families for consistency",
      });
    }

    return concerns;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    reasoning: VisualReasoningResult,
    elements: VisualUIElement[],
    features: VisualFeatures
  ): number {
    let score = 1.0;

    // Deduct for accessibility issues
    const criticalIssues = reasoning.accessibilityIssues.filter(
      i => i.severity === "critical"
    ).length;
    score -= criticalIssues * 0.15;

    const highIssues = reasoning.accessibilityIssues.filter(
      i => i.severity === "high"
    ).length;
    score -= highIssues * 0.1;

    // Deduct for UX concerns
    const highConcerns = reasoning.uxConcerns.filter(
      c => c.severity === "high"
    ).length;
    score -= highConcerns * 0.05;

    // Bonus for patterns
    score += reasoning.patterns.length * 0.02;

    // Bonus for hierarchy
    if (features.hierarchy.depth > 0 && features.hierarchy.depth <= 4) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check element alignment
   */
  private checkAlignment(elements: VisualUIElement[]): string[] {
    const misaligned: string[] = [];

    // Group elements by y-coordinate (rows)
    const rows = new Map<number, VisualUIElement[]>();
    for (const element of elements) {
      const y = Math.round(element.bbox.y * 100); // Round to nearest 1%
      const row = rows.get(y) ?? [];
      row.push(element);
      rows.set(y, row);
    }

    // Check alignment within rows
    for (const [y, rowElements] of rows) {
      if (rowElements.length < 2) continue;

      // Check if elements are evenly spaced
      const sorted = rowElements.sort((a, b) => a.bbox.x - b.bbox.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          sorted[i].bbox.x - (sorted[i - 1].bbox.x + sorted[i - 1].bbox.width);
        const avgGap = features => features.spacing.averageGap / 100; // Normalize

        // If gap varies significantly from average, flag as misaligned
        if (Math.abs(gap - 0.05) > 0.03) {
          // 5% gap with 3% tolerance
          misaligned.push(sorted[i].id);
        }
      }
    }

    return misaligned;
  }

  /**
   * Calculate group bounds
   */
  private calculateGroupBounds(elements: VisualUIElement[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...elements.map(e => e.bbox.x));
    const minY = Math.min(...elements.map(e => e.bbox.y));
    const maxX = Math.max(...elements.map(e => e.bbox.x + e.bbox.width));
    const maxY = Math.max(...elements.map(e => e.bbox.y + e.bbox.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

// ============================================================================
// NODE FACTORY
// ============================================================================

/**
 * Create visual reasoning node
 *
 * @param config - Node configuration
 * @returns Visual reasoning node instance
 */
export function createVisualReasoningNode(
  config?: VisualReasoningNodeConfig
): VisualReasoningNode {
  return new VisualReasoningNode(config);
}

/**
 * Create visual reasoning node handler for LangGraph
 *
 * @param config - Node configuration
 * @returns Node handler function
 */
export function createVisualReasoningNodeHandler(
  config?: VisualReasoningNodeConfig
) {
  const node = new VisualReasoningNode(config);

  return async (state: VLJEPAAgentState, runnableConfig?: RunnableConfig) => {
    return await node.invoke(state, runnableConfig);
  };
}

export default VisualReasoningNode;
