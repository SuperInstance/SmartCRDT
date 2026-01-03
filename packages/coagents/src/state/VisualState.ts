/**
 * @fileoverview Visual State Management for VL-JEPA + CoAgents
 *
 * Manages visual state derived from VL-JEPA embeddings, including UI elements,
 * visual features, and layout understanding.
 *
 * @version 1.0.0
 */

import type { VLJEPAAction } from "@lsi/vljepa/src/protocol.js";
import type { EmbeddingVector } from "./EmbeddingState.js";

// ============================================================================
// VISUAL STATE TYPES
// ============================================================================

/**
 * Visual UI element with enhanced properties
 */
export interface VisualUIElement {
  /** Unique element ID */
  id: string;

  /** Element type */
  type: UIElementType;

  /** Bounding box (normalized 0-1) */
  bbox: BoundingBox;

  /** Element description */
  description: string;

  /** Confidence in detection */
  confidence: number;

  /** CSS selector */
  selector: string;

  /** Current styles (inferred) */
  styles: UIStyles;

  /** Text content (if any) */
  text?: string;

  /** Children elements */
  children?: VisualUIElement[];

  /** Parent element ID */
  parentId?: string;

  /** Element hierarchy depth */
  depth: number;

  /** Interaction capabilities */
  interactions: InteractionType[];
}

/**
 * UI element types
 */
export type UIElementType =
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "text"
  | "heading"
  | "image"
  | "icon"
  | "container"
  | "list"
  | "list-item"
  | "card"
  | "modal"
  | "dropdown"
  | "menu"
  | "navbar"
  | "sidebar"
  | "footer"
  | "header"
  | "section"
  | "unknown";

/**
 * Bounding box
 */
export interface BoundingBox {
  /** X coordinate (normalized 0-1) */
  x: number;

  /** Y coordinate (normalized 0-1) */
  y: number;

  /** Width (normalized 0-1) */
  width: number;

  /** Height (normalized 0-1) */
  height: number;

  /** Center X */
  centerX?: number;

  /** Center Y */
  centerY?: number;
}

/**
 * UI styles
 */
export interface UIStyles {
  /** Display property */
  display?: string;

  /** Position */
  position?: string;

  /** Flexbox properties */
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  flexWrap?: string;
  gap?: string;

  /** Grid properties */
  gridTemplateColumns?: string;
  gridTemplateRows?: string;

  /** Box model */
  padding?:
    | string
    | { top: number; right: number; bottom: number; left: number };
  margin?:
    | string
    | { top: number; right: number; bottom: number; left: number };
  border?: string;

  /** Colors */
  backgroundColor?: string;
  color?: string;
  borderColor?: string;

  /** Typography */
  fontFamily?: string;
  fontSize?: string | number;
  fontWeight?: string | number;
  lineHeight?: string | number;
  textAlign?: string;

  /** Sizing */
  width?: string | number;
  height?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;

  /** Other */
  opacity?: number;
  visibility?: string;
  cursor?: string;
  boxShadow?: string;
  borderRadius?: string | number;
}

/**
 * Interaction types
 */
export type InteractionType =
  | "click"
  | "hover"
  | "focus"
  | "input"
  | "drag"
  | "scroll"
  | "swipe"
  | "pinch"
  | "none";

/**
 * Visual features
 */
export interface VisualFeatures {
  /** Dominant colors */
  colors: ColorInfo[];

  /** Layout information */
  layout: LayoutInfo;

  /** Spacing information */
  spacing: SpacingInfo;

  /** Typography information */
  typography: TypographyInfo;

  /** Visual hierarchy */
  hierarchy: VisualHierarchy;

  /** Component detection */
  components: ComponentInfo[];
}

/**
 * Color information
 */
export interface ColorInfo {
  /** Color value (hex) */
  value: string;

  /** Frequency/proportion */
  frequency: number;

  /** Color category */
  category:
    | "primary"
    | "secondary"
    | "accent"
    | "background"
    | "text"
    | "border";

  /** Accessibility score */
  contrastRatio?: number;
}

/**
 * Layout information
 */
export interface LayoutInfo {
  /** Layout type */
  type: LayoutType;

  /** Grid information (if applicable) */
  grid?: GridInfo;

  /** Flex information (if applicable) */
  flex?: FlexInfo;

  /** Absolute positioning info */
  absolute?: AbsoluteInfo;

  /** Layout confidence */
  confidence: number;
}

/**
 * Layout types
 */
export type LayoutType =
  | "grid"
  | "flex"
  | "absolute"
  | "table"
  | "float"
  | "unknown";

/**
 * Grid information
 */
export interface GridInfo {
  /** Number of columns */
  columns: number;

  /** Number of rows */
  rows: number;

  /** Gap size */
  gap: number;

  /** Column widths */
  columnWidths?: number[];
}

/**
 * Flex information
 */
export interface FlexInfo {
  /** Direction */
  direction: "row" | "column" | "row-reverse" | "column-reverse";

  /** Justification */
  justifyContent: string;

  /** Alignment */
  alignItems: string;

  /** Wrap behavior */
  flexWrap: string;

  /** Gap size */
  gap: number;
}

/**
 * Absolute positioning info
 */
export interface AbsoluteInfo {
  /** Positioning strategy */
  strategy: "fixed" | "absolute" | "relative";

  /** Z-index ranges */
  zIndexRange: [number, number];
}

/**
 * Spacing information
 */
export interface SpacingInfo {
  /** Average gap between elements */
  averageGap: number;

  /** Padding estimates */
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  /** Margin estimates */
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  /** Whitespace ratio */
  whitespaceRatio: number;
}

/**
 * Typography information
 */
export interface TypographyInfo {
  /** Font families detected */
  families: string[];

  /** Font sizes */
  sizes: number[];

  /** Font weights */
  weights: number[];

  /** Line heights */
  lineHeights: number[];

  /** Text contrast scores */
  contrastScores: number[];

  /** Heading hierarchy */
  headingHierarchy: {
    h1?: number;
    h2?: number;
    h3?: number;
    h4?: number;
    h5?: number;
    h6?: number;
  };
}

/**
 * Visual hierarchy
 */
export interface VisualHierarchy {
  /** Hierarchy tree */
  tree: HierarchyNode;

  /** Visual depth */
  depth: number;

  /** Focus points */
  focusPoints: FocusPoint[];
}

/**
 * Hierarchy node
 */
export interface HierarchyNode {
  /** Node ID */
  id: string;

  /** Element type */
  type: UIElementType;

  /** Visual weight */
  weight: number;

  /** Children */
  children: HierarchyNode[];
}

/**
 * Focus point
 */
export interface FocusPoint {
  /** Point coordinates (normalized 0-1) */
  x: number;

  y: number;

  /** Focus strength */
  strength: number;

  /** Reason for focus */
  reason: "size" | "color" | "position" | "contrast" | "motion" | "text";
}

/**
 * Component information
 */
export interface ComponentInfo {
  /** Component type */
  type: ComponentType;

  /** Confidence in detection */
  confidence: number;

  /** Elements in component */
  elementIds: string[];

  /** Component bounds */
  bounds: BoundingBox;
}

/**
 * Component types
 */
export type ComponentType =
  | "navbar"
  | "sidebar"
  | "card"
  | "modal"
  | "form"
  | "table"
  | "list"
  | "carousel"
  | "tabs"
  | "accordion"
  | "hero"
  | "footer"
  | "header"
  | "grid"
  | "unknown";

/**
 * Visual state
 */
export interface VisualState {
  /** Visual embedding */
  embedding: EmbeddingVector;

  /** Detected UI elements */
  elements: VisualUIElement[];

  /** Visual features */
  features: VisualFeatures;

  /** Overall confidence */
  confidence: number;

  /** Timestamp */
  timestamp: number;

  /** Frame dimensions */
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Visual state configuration
 */
export interface VisualStateConfig {
  /** Enable element detection */
  enableElementDetection?: boolean;

  /** Enable feature extraction */
  enableFeatureExtraction?: boolean;

  /** Enable component detection */
  enableComponentDetection?: boolean;

  /** Minimum element confidence */
  minElementConfidence?: number;

  /** Maximum elements to detect */
  maxElements?: number;
}

// ============================================================================
// VISUAL STATE MANAGER
// ============================================================================

/**
 * Visual State Manager
 *
 * Manages visual state derived from VL-JEPA embeddings.
 */
export class VisualStateManager {
  private config: Required<VisualStateConfig>;

  constructor(config: VisualStateConfig = {}) {
    this.config = {
      enableElementDetection: true,
      enableFeatureExtraction: true,
      enableComponentDetection: true,
      minElementConfidence: 0.3,
      maxElements: 100,
      ...config,
    };
  }

  // ========================================================================
  // ELEMENT DETECTION
  // ========================================================================

  /**
   * Detect UI elements from actions
   *
   * @param actions - VL-JEPA actions
   * @returns Detected UI elements
   */
  detectElements(actions: VLJEPAAction[]): VisualUIElement[] {
    const elements: VisualUIElement[] = [];
    const seenTargets = new Map<string, VisualUIElement>();

    for (const action of actions) {
      const existing = seenTargets.get(action.target);
      if (existing) {
        // Update existing element with new action info
        this.updateElementFromAction(existing, action);
        continue;
      }

      const element = this.createElementFromAction(action);
      if (element && element.confidence >= this.config.minElementConfidence) {
        elements.push(element);
        seenTargets.set(action.target, element);
      }
    }

    // Build hierarchy
    this.buildHierarchy(elements);

    return elements.slice(0, this.config.maxElements);
  }

  /**
   * Create element from action
   */
  private createElementFromAction(
    action: VLJEPAAction
  ): VisualUIElement | null {
    const type = this.inferElementType(action);
    const selector = this.inferSelector(action.target);
    const bbox = this.estimateBoundingBox(action);
    const styles = this.extractStyles(action);
    const interactions = this.inferInteractions(action, styles);

    return {
      id: crypto.randomUUID(),
      type,
      bbox,
      description: action.reasoning ?? `${action.type} on ${action.target}`,
      confidence: action.confidence,
      selector,
      styles,
      text: this.extractText(action.params),
      depth: this.estimateDepth(action.target),
      interactions,
    };
  }

  /**
   * Update element from action
   */
  private updateElementFromAction(
    element: VisualUIElement,
    action: VLJEPAAction
  ): void {
    // Merge styles
    const newStyles = this.extractStyles(action);
    element.styles = { ...element.styles, ...newStyles };

    // Update confidence if higher
    if (action.confidence > element.confidence) {
      element.confidence = action.confidence;
    }

    // Update description if provided
    if (action.reasoning) {
      element.description = action.reasoning;
    }
  }

  /**
   * Build element hierarchy
   */
  private buildHierarchy(elements: VisualUIElement[]): void {
    // Clear existing children
    for (const element of elements) {
      element.children = [];
      element.parentId = undefined;
    }

    // Build parent-child relationships based on selectors
    for (const child of elements) {
      for (const parent of elements) {
        if (child === parent) continue;

        if (this.isChildOf(child, parent)) {
          child.parentId = parent.id;
          child.depth = parent.depth + 1;
          parent.children = parent.children ?? [];
          parent.children.push(child);
          break;
        }
      }
    }
  }

  /**
   * Check if element is child of another
   */
  private isChildOf(child: VisualUIElement, parent: VisualUIElement): boolean {
    // Check if child's selector is descendant of parent's selector
    return (
      child.selector.startsWith(parent.selector) ||
      child.selector.includes(`${parent.selector} `) ||
      child.selector.includes(`${parent.selector}>`)
    );
  }

  /**
   * Infer element type from action
   */
  private inferElementType(action: VLJEPAAction): UIElementType {
    const target = action.target.toLowerCase();
    const params = action.params;

    // Check by target name
    if (target.includes("button") || params["onClick"]) return "button";
    if (target.includes("input") && target.includes("text")) return "input";
    if (target.includes("textarea")) return "textarea";
    if (target.includes("select") || params["options"]) return "select";
    if (target.includes("checkbox") || params["type"] === "checkbox")
      return "checkbox";
    if (target.includes("radio") || params["type"] === "radio") return "radio";
    if (target.includes("img") || params["src"]) return "image";
    if (target.includes("icon") || params["icon"]) return "icon";
    if (target.includes("list"))
      return target.includes("item") ? "list-item" : "list";
    if (target.includes("card")) return "card";
    if (target.includes("modal") || target.includes("dialog")) return "modal";
    if (target.includes("dropdown")) return "dropdown";
    if (target.includes("menu")) return "menu";
    if (target.includes("navbar") || target.includes("navigation"))
      return "navbar";
    if (target.includes("sidebar")) return "sidebar";
    if (target.includes("header")) return "header";
    if (target.includes("footer")) return "footer";
    if (target.includes("section")) return "section";

    // Check by tag names
    if (
      target.startsWith("h1") ||
      target.startsWith("h2") ||
      target.startsWith("h3") ||
      target.startsWith("h4") ||
      target.startsWith("h5") ||
      target.startsWith("h6")
    ) {
      return "heading";
    }

    // Check by display type
    if (
      params["display"]?.includes("flex") ||
      params["display"]?.includes("grid")
    ) {
      return "container";
    }

    return "unknown";
  }

  /**
   * Infer CSS selector from target
   */
  private inferSelector(target: string): string {
    if (target.startsWith("#") || target.startsWith(".")) {
      return target;
    }
    if (target.includes(">") || target.includes(" ")) {
      return target;
    }
    return `#${target}`;
  }

  /**
   * Estimate bounding box from action
   */
  private estimateBoundingBox(action: VLJEPAAction): BoundingBox {
    // Default: unknown position
    const bbox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

    // Try to extract position from params
    const params = action.params;
    if (typeof params["x"] === "number") bbox.x = params["x"] as number;
    if (typeof params["y"] === "number") bbox.y = params["y"] as number;
    if (typeof params["width"] === "number")
      bbox.width = params["width"] as number;
    if (typeof params["height"] === "number")
      bbox.height = params["height"] as number;

    // Calculate center if dimensions available
    if (bbox.width > 0 && bbox.height > 0) {
      bbox.centerX = bbox.x + bbox.width / 2;
      bbox.centerY = bbox.y + bbox.height / 2;
    }

    return bbox;
  }

  /**
   * Extract styles from action params
   */
  private extractStyles(action: VLJEPAAction): UIStyles {
    const params = action.params;
    const styles: UIStyles = {};

    const styleProps: (keyof UIStyles)[] = [
      "display",
      "position",
      "flexDirection",
      "justifyContent",
      "alignItems",
      "flexWrap",
      "gap",
      "gridTemplateColumns",
      "gridTemplateRows",
      "padding",
      "margin",
      "border",
      "backgroundColor",
      "color",
      "borderColor",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "textAlign",
      "width",
      "height",
      "maxWidth",
      "maxHeight",
      "opacity",
      "visibility",
      "cursor",
      "boxShadow",
      "borderRadius",
    ];

    for (const prop of styleProps) {
      if (params[prop] !== undefined) {
        styles[prop] = params[prop] as string & number;
      }
    }

    return styles;
  }

  /**
   * Infer interaction types from action and styles
   */
  private inferInteractions(
    action: VLJEPAAction,
    styles: UIStyles
  ): InteractionType[] {
    const interactions: InteractionType[] = [];

    // Check for clickable
    if (
      action.type === "click" ||
      styles.cursor === "pointer" ||
      styles.cursor === "hand"
    ) {
      interactions.push("click");
    }

    // Check for hover
    if (styles.cursor === "pointer") {
      interactions.push("hover");
    }

    // Check for input
    if (styles.cursor === "text") {
      interactions.push("input");
      interactions.push("focus");
    }

    // Check for draggable
    if (styles.cursor === "move" || styles.cursor === "grab") {
      interactions.push("drag");
    }

    return interactions.length > 0 ? interactions : ["none"];
  }

  /**
   * Extract text from params
   */
  private extractText(params: Record<string, unknown>): string | undefined {
    return (
      (params["text"] as string) ??
      (params["content"] as string) ??
      (params["label"] as string) ??
      (params["placeholder"] as string) ??
      (params["value"] as string) ??
      undefined
    );
  }

  /**
   * Estimate element depth from target
   */
  private estimateDepth(target: string): number {
    // Count hierarchy separators
    const separators = (target.match(/[>\s]/g) ?? []).length;
    return separators;
  }

  // ========================================================================
  // FEATURE EXTRACTION
  // ========================================================================

  /**
   * Extract visual features from elements and actions
   *
   * @param elements - UI elements
   * @param actions - VL-JEPA actions
   * @returns Visual features
   */
  extractFeatures(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): VisualFeatures {
    return {
      colors: this.extractColors(elements, actions),
      layout: this.extractLayout(elements, actions),
      spacing: this.extractSpacing(elements),
      typography: this.extractTypography(elements, actions),
      hierarchy: this.extractHierarchy(elements),
      components: this.detectComponents(elements),
    };
  }

  /**
   * Extract color information
   */
  private extractColors(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): ColorInfo[] {
    const colorMap = new Map<string, ColorInfo>();

    // Extract from elements
    for (const element of elements) {
      const styles = element.styles;

      if (styles.backgroundColor) {
        const bg = styles.backgroundColor;
        colorMap.set(bg, {
          value: bg,
          frequency: (colorMap.get(bg)?.frequency ?? 0) + 1,
          category: "background",
        });
      }

      if (styles.color) {
        const color = styles.color;
        colorMap.set(color, {
          value: color,
          frequency: (colorMap.get(color)?.frequency ?? 0) + 1,
          category: "text",
        });
      }

      if (styles.borderColor) {
        const border = styles.borderColor;
        colorMap.set(border, {
          value: border,
          frequency: (colorMap.get(border)?.frequency ?? 0) + 1,
          category: "border",
        });
      }
    }

    // Extract from actions
    for (const action of actions) {
      const params = action.params;
      for (const [key, value] of Object.entries(params)) {
        if (key.includes("color") && typeof value === "string") {
          colorMap.set(value, {
            value,
            frequency: (colorMap.get(value)?.frequency ?? 0) + 1,
            category: key.includes("background")
              ? "background"
              : key.includes("border")
                ? "border"
                : "primary",
          });
        }
      }
    }

    return Array.from(colorMap.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Extract layout information
   */
  private extractLayout(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): LayoutInfo {
    const layoutTypes: LayoutType[] = [];

    // Check actions for layout hints
    for (const action of actions) {
      const display = action.params["display"];
      if (typeof display === "string") {
        if (display.includes("flex")) layoutTypes.push("flex");
        if (display.includes("grid")) layoutTypes.push("grid");
        if (display.includes("absolute")) layoutTypes.push("absolute");
        if (display.includes("table")) layoutTypes.push("table");
      }
    }

    // Most common layout type
    const type = this.getMostCommon(layoutTypes) ?? "unknown";

    return {
      type,
      grid: type === "grid" ? this.extractGridInfo(actions) : undefined,
      flex: type === "flex" ? this.extractFlexInfo(actions) : undefined,
      absolute:
        type === "absolute" ? this.extractAbsoluteInfo(elements) : undefined,
      confidence: layoutTypes.length > 0 ? 0.8 : 0.3,
    };
  }

  /**
   * Extract grid information
   */
  private extractGridInfo(actions: VLJEPAAction[]): GridInfo {
    let columns = 2;
    let rows = 2;
    let gap = 16;

    for (const action of actions) {
      const params = action.params;
      if (typeof params["gridTemplateColumns"] === "string") {
        const colStr = params["gridTemplateColumns"] as string;
        columns = colStr.split(/\s+/).length;
      }
      if (typeof params["gridTemplateRows"] === "string") {
        const rowStr = params["gridTemplateRows"] as string;
        rows = rowStr.split(/\s+/).length;
      }
      if (typeof params["gap"] === "number") {
        gap = params["gap"] as number;
      } else if (typeof params["gap"] === "string") {
        gap = parseInt(params["gap"]) || gap;
      }
    }

    return { columns, rows, gap };
  }

  /**
   * Extract flex information
   */
  private extractFlexInfo(actions: VLJEPAAction[]): FlexInfo {
    let direction: FlexInfo["direction"] = "row";
    let justifyContent = "flex-start";
    let alignItems = "stretch";
    let flexWrap = "nowrap";
    let gap = 0;

    for (const action of actions) {
      const params = action.params;
      if (typeof params["flexDirection"] === "string") {
        direction = params["flexDirection"] as FlexInfo["direction"];
      }
      if (typeof params["justifyContent"] === "string") {
        justifyContent = params["justifyContent"];
      }
      if (typeof params["alignItems"] === "string") {
        alignItems = params["alignItems"];
      }
      if (typeof params["flexWrap"] === "string") {
        flexWrap = params["flexWrap"];
      }
      if (typeof params["gap"] === "number") {
        gap = params["gap"];
      }
    }

    return { direction, justifyContent, alignItems, flexWrap, gap };
  }

  /**
   * Extract absolute positioning info
   */
  private extractAbsoluteInfo(elements: VisualUIElement[]): AbsoluteInfo {
    const zIndexes = elements
      .map(e => parseInt(e.styles.zIndex?.toString() ?? "0"))
      .filter(z => !isNaN(z));

    const minZ = zIndexes.length > 0 ? Math.min(...zIndexes) : 0;
    const maxZ = zIndexes.length > 0 ? Math.max(...zIndexes) : 0;

    return {
      strategy: "absolute",
      zIndexRange: [minZ, maxZ],
    };
  }

  /**
   * Extract spacing information
   */
  private extractSpacing(elements: VisualUIElement[]): SpacingInfo {
    const gaps: number[] = [];
    const paddings: number[] = [];

    for (const element of elements) {
      // Extract gap from flex/grid
      if (typeof element.styles.gap === "number") {
        gaps.push(element.styles.gap);
      }

      // Extract padding
      const padding = element.styles.padding;
      if (typeof padding === "object") {
        paddings.push(padding.top, padding.right, padding.bottom, padding.left);
      } else if (typeof padding === "string") {
        const parsed = parseInt(padding.replace("px", ""));
        if (!isNaN(parsed)) paddings.push(parsed);
      }
    }

    const avgGap =
      gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 16;

    const avgPadding =
      paddings.length > 0
        ? paddings.reduce((sum, p) => sum + p, 0) / paddings.length
        : 16;

    return {
      averageGap: avgGap,
      padding: {
        top: avgPadding,
        right: avgPadding,
        bottom: avgPadding,
        left: avgPadding,
      },
      margin: {
        top: avgPadding,
        right: avgPadding,
        bottom: avgPadding,
        left: avgPadding,
      },
      whitespaceRatio: 0.3, // Default estimate
    };
  }

  /**
   * Extract typography information
   */
  private extractTypography(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): TypographyInfo {
    const families = new Set<string>();
    const sizes: number[] = [];
    const weights: number[] = [];
    const lineHeights: number[] = [];

    for (const element of elements) {
      if (element.styles.fontFamily) {
        families.add(element.styles.fontFamily);
      }
      if (element.styles.fontSize) {
        const size =
          typeof element.styles.fontSize === "number"
            ? element.styles.fontSize
            : parseInt(element.styles.fontSize.toString().replace("px", ""));
        if (!isNaN(size)) sizes.push(size);
      }
      if (element.styles.fontWeight) {
        const weight =
          typeof element.styles.fontWeight === "number"
            ? element.styles.fontWeight
            : parseInt(element.styles.fontWeight.toString());
        if (!isNaN(weight)) weights.push(weight);
      }
      if (element.styles.lineHeight) {
        const height =
          typeof element.styles.lineHeight === "number"
            ? element.styles.lineHeight
            : parseFloat(element.styles.lineHeight.toString());
        if (!isNaN(height)) lineHeights.push(height);
      }
    }

    return {
      families: Array.from(families),
      sizes: [...new Set(sizes)].sort((a, b) => a - b),
      weights: [...new Set(weights)].sort((a, b) => a - b),
      lineHeights: [...new Set(lineHeights)],
      contrastScores: [], // Would need color analysis
      headingHierarchy: this.extractHeadingHierarchy(elements),
    };
  }

  /**
   * Extract heading hierarchy
   */
  private extractHeadingHierarchy(
    elements: VisualUIElement[]
  ): TypographyInfo["headingHierarchy"] {
    const hierarchy: TypographyInfo["headingHierarchy"] = {};

    for (const element of elements) {
      const selector = element.selector.toLowerCase();
      const size =
        typeof element.styles.fontSize === "number"
          ? element.styles.fontSize
          : parseInt(element.styles.fontSize?.toString() ?? "0");

      if (selector.includes("h1")) hierarchy.h1 = hierarchy.h1 ?? size;
      if (selector.includes("h2")) hierarchy.h2 = hierarchy.h2 ?? size;
      if (selector.includes("h3")) hierarchy.h3 = hierarchy.h3 ?? size;
      if (selector.includes("h4")) hierarchy.h4 = hierarchy.h4 ?? size;
      if (selector.includes("h5")) hierarchy.h5 = hierarchy.h5 ?? size;
      if (selector.includes("h6")) hierarchy.h6 = hierarchy.h6 ?? size;
    }

    return hierarchy;
  }

  /**
   * Extract visual hierarchy
   */
  private extractHierarchy(elements: VisualUIElement[]): VisualHierarchy {
    const tree = this.buildHierarchyTree(elements);
    const depth = this.calculateMaxDepth(elements);
    const focusPoints = this.identifyFocusPoints(elements);

    return { tree, depth, focusPoints };
  }

  /**
   * Build hierarchy tree
   */
  private buildHierarchyTree(elements: VisualUIElement[]): HierarchyNode {
    // Find root elements (no parent)
    const roots = elements.filter(e => !e.parentId);

    if (roots.length === 0 && elements.length > 0) {
      // All elements have parents, find top-level by depth
      const minDepth = Math.min(...elements.map(e => e.depth));
      const topLevel = elements.filter(e => e.depth === minDepth);
      return this.buildNode(topLevel[0], elements);
    }

    return this.buildNode(roots[0], elements);
  }

  /**
   * Build hierarchy node from element
   */
  private buildNode(
    element: VisualUIElement,
    allElements: VisualUIElement[]
  ): HierarchyNode {
    const children = allElements.filter(e => e.parentId === element.id);

    return {
      id: element.id,
      type: element.type,
      weight: this.calculateVisualWeight(element),
      children: children.map(c => this.buildNode(c, allElements)),
    };
  }

  /**
   * Calculate visual weight of element
   */
  private calculateVisualWeight(element: VisualUIElement): number {
    let weight = 0.5;

    // Size contributes to weight
    const size = element.bbox.width * element.bbox.height;
    weight += size * 0.3;

    // Contrast contributes (simplified)
    if (element.styles.color || element.styles.backgroundColor) {
      weight += 0.1;
    }

    // Position contributes (center = higher weight)
    if (element.bbox.centerX && element.bbox.centerY) {
      const centerDistance = Math.sqrt(
        Math.pow(element.bbox.centerX - 0.5, 2) +
          Math.pow(element.bbox.centerY - 0.5, 2)
      );
      weight += (1 - centerDistance) * 0.1;
    }

    return Math.min(1, Math.max(0, weight));
  }

  /**
   * Calculate max depth
   */
  private calculateMaxDepth(elements: VisualUIElement[]): number {
    return Math.max(...elements.map(e => e.depth), 0);
  }

  /**
   * Identify focus points
   */
  private identifyFocusPoints(elements: VisualUIElement[]): FocusPoint[] {
    const focusPoints: FocusPoint[] = [];

    for (const element of elements) {
      const weight = this.calculateVisualWeight(element);

      if (weight > 0.6) {
        focusPoints.push({
          x: element.bbox.centerX ?? element.bbox.x + element.bbox.width / 2,
          y: element.bbox.centerY ?? element.bbox.y + element.bbox.height / 2,
          strength: weight,
          reason: this.determineFocusReason(element),
        });
      }
    }

    return focusPoints.sort((a, b) => b.strength - a.strength).slice(0, 5);
  }

  /**
   * Determine focus reason
   */
  private determineFocusReason(element: VisualUIElement): FocusPoint["reason"] {
    const size = element.bbox.width * element.bbox.height;

    if (size > 0.3) return "size";
    if (
      element.styles.color === "red" ||
      element.styles.backgroundColor === "yellow"
    ) {
      return "color";
    }
    if (element.bbox.centerX && element.bbox.centerY) {
      const centerDistance = Math.sqrt(
        Math.pow(element.bbox.centerX - 0.5, 2) +
          Math.pow(element.bbox.centerY - 0.5, 2)
      );
      if (centerDistance < 0.2) return "position";
    }
    if (element.type === "heading" || element.type === "button") return "text";

    return "contrast";
  }

  /**
   * Detect components
   */
  private detectComponents(elements: VisualUIElement[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    // Group by type and proximity
    const byType = new Map<UIElementType, VisualUIElement[]>();
    for (const element of elements) {
      const list = byType.get(element.type) ?? [];
      list.push(element);
      byType.set(element.type, list);
    }

    // Detect navbars
    const navbarElements = byType.get("navbar");
    if (navbarElements && navbarElements.length > 0) {
      components.push({
        type: "navbar",
        confidence: 0.8,
        elementIds: navbarElements.map(e => e.id),
        bounds: this.calculateGroupBounds(navbarElements),
      });
    }

    // Detect cards
    const cardElements = byType.get("card");
    if (cardElements && cardElements.length > 0) {
      for (const card of cardElements) {
        components.push({
          type: "card",
          confidence: 0.7,
          elementIds: [card.id],
          bounds: card.bbox,
        });
      }
    }

    return components;
  }

  /**
   * Calculate group bounds
   */
  private calculateGroupBounds(elements: VisualUIElement[]): BoundingBox {
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
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }

  /**
   * Get most common value in array
   */
  private getMostCommon<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;

    const counts = new Map<T, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: T | undefined;

    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  /**
   * Calculate overall visual confidence
   */
  calculateConfidence(
    elements: VisualUIElement[],
    actions: VLJEPAAction[]
  ): number {
    if (elements.length === 0) return 0;

    const elementConfidence =
      elements.reduce((sum, e) => sum + e.confidence, 0) / elements.length;

    const actionConfidence =
      actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;

    return (elementConfidence + actionConfidence) / 2;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<VisualStateConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create visual state manager
 *
 * @param config - Manager configuration
 * @returns Visual state manager instance
 */
export function createVisualStateManager(
  config?: VisualStateConfig
): VisualStateManager {
  return new VisualStateManager(config);
}

export default VisualStateManager;
