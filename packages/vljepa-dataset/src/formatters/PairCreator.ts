/**
 * @fileoverview Pair Creator - Create before/after UI state pairs
 * @description Generates paired UI states for VL-JEPA training
 */

// @ts-ignore - Sharp is optional
import type sharp from "sharp";
import type {
  UIStatePair,
  UIState,
  CollectedScreenshot,
  DOMStructure,
  DetectedComponent,
  ChangeType,
  VisualDiff,
  BoundingBoxDiff,
  ElementChange,
  StyleChange,
  ContentChange,
  PairMetadata,
  BoundingBox,
  DatasetError,
} from "../types.js";

/**
 * Pair Creator configuration
 */
export interface PairCreatorConfig {
  minSimilarity: number;
  maxSimilarity: number;
  includeDOM: boolean;
  generateSynthetic: boolean;
  syntheticVariations: number;
}

/**
 * Style variation types
 */
type StyleVariation =
  | "color-primary"
  | "color-secondary"
  | "spacing"
  | "typography"
  | "border-radius"
  | "shadow"
  | "opacity";

/**
 * Layout variation types
 */
type LayoutVariation =
  | "position"
  | "alignment"
  | "grid"
  | "flex-direction"
  | "width"
  | "height";

/**
 * Content variation types
 */
type ContentVariation = "text" | "icon" | "image" | "badge";

/**
 * Pair Creator class
 */
export class PairCreator {
  private config: PairCreatorConfig;
  private sharpInstance: typeof sharp | null = null;
  private pairs: Map<string, UIStatePair> = new Map();

  constructor(config?: Partial<PairCreatorConfig>) {
    this.config = {
      minSimilarity: config?.minSimilarity ?? 0.3,
      maxSimilarity: config?.maxSimilarity ?? 0.9,
      includeDOM: config?.includeDOM ?? true,
      generateSynthetic: config?.generateSynthetic ?? true,
      syntheticVariations: config?.syntheticVariations ?? 5,
    };
  }

  /**
   * Initialize Sharp
   */
  private async getSharp(): Promise<typeof sharp> {
    if (!this.sharpInstance) {
      try {
        this.sharpInstance = (await import("sharp")).default;
      } catch (error) {
        throw new Error(
          "Sharp library not available. Install it with: npm install sharp"
        );
      }
    }
    return this.sharpInstance;
  }

  /**
   * Create pairs from screenshots
   */
  async createPairs(
    screenshots: CollectedScreenshot[],
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];

    // Create pairs from similar screenshots
    const similarPairs = await this.findSimilarPairs(
      screenshots,
      domStructures
    );
    pairs.push(...similarPairs);

    // Generate synthetic variations
    if (this.config.generateSynthetic) {
      const syntheticPairs = await this.generateSyntheticPairs(
        screenshots,
        domStructures
      );
      pairs.push(...syntheticPairs);
    }

    // Filter by similarity
    return pairs.filter(pair => {
      const similarity = pair.diff.similarity;
      return (
        similarity >= this.config.minSimilarity &&
        similarity <= this.config.maxSimilarity
      );
    });
  }

  /**
   * Find similar screenshot pairs
   */
  private async findSimilarPairs(
    screenshots: CollectedScreenshot[],
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];

    for (let i = 0; i < screenshots.length; i++) {
      for (let j = i + 1; j < screenshots.length; j++) {
        const similarity = await this.calculateImageSimilarity(
          screenshots[i].image,
          screenshots[j].image
        );

        if (
          similarity >= this.config.minSimilarity &&
          similarity <= this.config.maxSimilarity
        ) {
          const before = this.createUIState(
            screenshots[i],
            domStructures?.get(screenshots[i].id)
          );
          const after = this.createUIState(
            screenshots[j],
            domStructures?.get(screenshots[j].id)
          );

          const diff = await this.createDiff(before, after);
          const changeType = this.determineChangeType(diff);

          const pair: UIStatePair = {
            id: `pair_${i}_${j}_${Date.now()}`,
            before,
            after,
            changeType,
            changeDescription: this.generateChangeDescription(diff, changeType),
            diff,
            metadata: {
              timestamp: Date.now(),
              source: "collection",
              category: screenshots[i].metadata.category ?? "general",
              difficulty: this.assessDifficulty(diff),
              tags: [changeType],
            },
          };

          pairs.push(pair);
        }
      }
    }

    return pairs;
  }

  /**
   * Generate synthetic pairs by applying variations
   */
  async generateSyntheticPairs(
    screenshots: CollectedScreenshot[],
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];

    for (const screenshot of screenshots.slice(0, 100)) {
      // Generate style variations
      const stylePairs = await this.generateStyleVariations(
        screenshot,
        domStructures
      );
      pairs.push(...stylePairs);

      // Generate layout variations
      const layoutPairs = await this.generateLayoutVariations(
        screenshot,
        domStructures
      );
      pairs.push(...layoutPairs);

      // Generate content variations
      const contentPairs = await this.generateContentVariations(
        screenshot,
        domStructures
      );
      pairs.push(...contentPairs);
    }

    return pairs;
  }

  /**
   * Generate style variations
   */
  private async generateStyleVariations(
    screenshot: CollectedScreenshot,
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];
    const variations: StyleVariation[] = [
      "color-primary",
      "color-secondary",
      "spacing",
      "shadow",
    ];

    const before = this.createUIState(
      screenshot,
      domStructures?.get(screenshot.id)
    );

    for (const variation of variations) {
      const after = await this.applyStyleVariation(before, variation);
      const diff = await this.createDiff(before, after);

      const pair: UIStatePair = {
        id: `pair_style_${variation}_${screenshot.id}_${Date.now()}`,
        before,
        after,
        changeType: "style",
        changeDescription: `Applied ${variation} variation`,
        diff,
        metadata: {
          timestamp: Date.now(),
          source: "synthetic",
          category: screenshot.metadata.category ?? "general",
          difficulty: "easy",
          tags: ["style", variation],
        },
      };

      pairs.push(pair);
    }

    return pairs;
  }

  /**
   * Apply style variation to UI state
   */
  private async applyStyleVariation(
    state: UIState,
    variation: StyleVariation
  ): Promise<UIState> {
    const sharp = await this.getSharp();

    let modifiedImage = sharp(state.screenshot.image);

    switch (variation) {
      case "color-primary":
        // Apply blue tint
        modifiedImage = modifiedImage.modulate({
          hue: 10,
        });
        break;

      case "color-secondary":
        // Apply warm tint
        modifiedImage = modifiedImage.tint({ r: 255, g: 200, b: 200 });
        break;

      case "spacing":
        // Simulate spacing change with slight crop
        modifiedImage = modifiedImage.extract({
          left: 10,
          top: 10,
          width: state.screenshot.metadata.width - 20,
          height: state.screenshot.metadata.height - 20,
        });
        break;

      case "shadow":
        // Simulate shadow with slight blur
        modifiedImage = modifiedImage.blur(2);
        break;
    }

    const modifiedBuffer = await modifiedImage.png().toBuffer();

    // Create modified components
    const modifiedComponents = state.components.map(comp => ({
      ...comp,
      styles: {
        ...comp.styles,
        ...(variation === "color-primary" && {
          backgroundColor: this.adjustColor(
            comp.styles.backgroundColor ?? "#ffffff",
            10
          ),
        }),
        ...(variation === "shadow" && {
          boxShadow: comp.styles.boxShadow || "0 2px 8px rgba(0,0,0,0.15)",
        }),
      },
    }));

    return {
      ...state,
      screenshot: {
        ...state.screenshot,
        image: modifiedBuffer,
      },
      components: modifiedComponents,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate layout variations
   */
  private async generateLayoutVariations(
    screenshot: CollectedScreenshot,
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];
    const before = this.createUIState(
      screenshot,
      domStructures?.get(screenshot.id)
    );

    // Simulate position shift
    const after = await this.applyLayoutVariation(before, "position");
    const diff = await this.createDiff(before, after);

    pairs.push({
      id: `pair_layout_position_${screenshot.id}_${Date.now()}`,
      before,
      after,
      changeType: "layout",
      changeDescription: "Position layout change",
      diff,
      metadata: {
        timestamp: Date.now(),
        source: "synthetic",
        category: screenshot.metadata.category ?? "general",
        difficulty: "medium",
        tags: ["layout", "position"],
      },
    });

    return pairs;
  }

  /**
   * Apply layout variation
   */
  private async applyLayoutVariation(
    state: UIState,
    variation: LayoutVariation
  ): Promise<UIState> {
    const sharp = await this.getSharp();

    let modifiedImage = sharp(state.screenshot.image);

    if (variation === "position") {
      // Simulate position shift with slight translation
      const { width, height } = state.screenshot.metadata;
      modifiedImage = modifiedImage
        .extract({
          left: 20,
          top: 20,
          width: Math.max(100, width - 40),
          height: Math.max(100, height - 40),
        })
        .extend({
          top: 20,
          left: 20,
          bottom: 20,
          right: 20,
          background: "#ffffff",
        });
    }

    const modifiedBuffer = await modifiedImage.png().toBuffer();

    return {
      ...state,
      screenshot: {
        ...state.screenshot,
        image: modifiedBuffer,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Generate content variations
   */
  private async generateContentVariations(
    screenshot: CollectedScreenshot,
    domStructures?: Map<string, DOMStructure>
  ): Promise<UIStatePair[]> {
    const pairs: UIStatePair[] = [];
    const before = this.createUIState(
      screenshot,
      domStructures?.get(screenshot.id)
    );

    // Simulate text content change
    const after = await this.applyContentVariation(before, "text");
    const diff = await this.createDiff(before, after);

    pairs.push({
      id: `pair_content_text_${screenshot.id}_${Date.now()}`,
      before,
      after,
      changeType: "content",
      changeDescription: "Text content change",
      diff,
      metadata: {
        timestamp: Date.now(),
        source: "synthetic",
        category: screenshot.metadata.category ?? "general",
        difficulty: "easy",
        tags: ["content", "text"],
      },
    });

    return pairs;
  }

  /**
   * Apply content variation
   */
  private async applyContentVariation(
    state: UIState,
    variation: ContentVariation
  ): Promise<UIState> {
    // Create modified components with changed text
    const modifiedComponents = state.components.map(comp => ({
      ...comp,
      text:
        variation === "text" && comp.text
          ? this.modifyText(comp.text)
          : comp.text,
    }));

    return {
      ...state,
      components: modifiedComponents,
      timestamp: Date.now(),
    };
  }

  /**
   * Create UI state from screenshot and DOM
   */
  private createUIState(
    screenshot: CollectedScreenshot,
    dom?: DOMStructure
  ): UIState {
    return {
      id: screenshot.id,
      screenshot,
      dom,
      components: dom?.components ?? [],
      timestamp: Date.now(),
    };
  }

  /**
   * Create visual diff between states
   */
  private async createDiff(
    before: UIState,
    after: UIState
  ): Promise<VisualDiff> {
    const similarity = await this.calculateImageSimilarity(
      before.screenshot.image,
      after.screenshot.image
    );

    const boundingBoxes = await this.compareBoundingBoxes(before, after);
    const elementChanges = this.compareElements(before, after);
    const styleChanges = this.compareStyles(before, after);
    const contentChanges = this.compareContent(before, after);

    return {
      boundingBoxes,
      elementChanges,
      styleChanges,
      contentChanges,
      similarity,
    };
  }

  /**
   * Compare bounding boxes
   */
  private async compareBoundingBoxes(
    before: UIState,
    after: UIState
  ): Promise<BoundingBoxDiff[]> {
    const diffs: BoundingBoxDiff[] = [];

    const beforeComps = new Map(before.components.map(c => [c.selector, c]));
    const afterComps = new Map(after.components.map(c => [c.selector, c]));

    // Find moved or resized components
    for (const [selector, beforeComp] of beforeComps) {
      const afterComp = afterComps.get(selector);
      if (!afterComp) {
        diffs.push({
          before: beforeComp.boundingBox,
          after: beforeComp.boundingBox,
          changeType: "removed",
          confidence: 0.9,
        });
        continue;
      }

      const beforeBox = beforeComp.boundingBox;
      const afterBox = afterComp.boundingBox;

      if (beforeBox.x !== afterBox.x || beforeBox.y !== afterBox.y) {
        diffs.push({
          before: beforeBox,
          after: afterBox,
          changeType: "moved",
          confidence: 0.8,
        });
      }

      if (
        beforeBox.width !== afterBox.width ||
        beforeBox.height !== afterBox.height
      ) {
        diffs.push({
          before: beforeBox,
          after: afterBox,
          changeType: "resized",
          confidence: 0.8,
        });
      }
    }

    return diffs;
  }

  /**
   * Compare elements
   */
  private compareElements(before: UIState, after: UIState): ElementChange[] {
    const changes: ElementChange[] = [];

    const beforeComps = new Map(before.components.map(c => [c.selector, c]));
    const afterComps = new Map(after.components.map(c => [c.selector, c]));

    // Find added elements
    for (const [selector, afterComp] of afterComps) {
      if (!beforeComps.has(selector)) {
        changes.push({
          type: afterComp.type,
          selector,
          change: "added",
          after: afterComp,
          confidence: 0.85,
        });
      }
    }

    // Find removed elements
    for (const [selector, beforeComp] of beforeComps) {
      if (!afterComps.has(selector)) {
        changes.push({
          type: beforeComp.type,
          selector,
          change: "removed",
          before: beforeComp,
          confidence: 0.85,
        });
      }
    }

    return changes;
  }

  /**
   * Compare styles
   */
  private compareStyles(before: UIState, after: UIState): StyleChange[] {
    const changes: StyleChange[] = [];

    const beforeComps = new Map(before.components.map(c => [c.selector, c]));
    const afterComps = new Map(after.components.map(c => [c.selector, c]));

    for (const [selector, beforeComp] of beforeComps) {
      const afterComp = afterComps.get(selector);
      if (!afterComp) continue;

      const beforeStyles = beforeComp.styles;
      const afterStyles = afterComp.styles;

      // Check for style changes
      const properties: string[] = [
        "backgroundColor",
        "color",
        "fontSize",
        "fontWeight",
        "padding",
        "margin",
        "borderRadius",
        "border",
      ];

      for (const prop of properties) {
        const beforeValue = beforeStyles[prop as keyof typeof beforeStyles];
        const afterValue = afterStyles[prop as keyof typeof afterStyles];

        if (beforeValue !== afterValue) {
          const impact = ["backgroundColor", "color"].includes(prop)
            ? "high"
            : ["fontSize", "fontWeight"].includes(prop)
              ? "medium"
              : "low";

          changes.push({
            selector,
            property: prop,
            before: String(beforeValue ?? ""),
            after: String(afterValue ?? ""),
            impact: impact as "low" | "medium" | "high",
          });
        }
      }
    }

    return changes;
  }

  /**
   * Compare content
   */
  private compareContent(before: UIState, after: UIState): ContentChange[] {
    const changes: ContentChange[] = [];

    const beforeComps = new Map(before.components.map(c => [c.selector, c]));
    const afterComps = new Map(after.components.map(c => [c.selector, c]));

    for (const [selector, beforeComp] of beforeComps) {
      const afterComp = afterComps.get(selector);
      if (!afterComp) continue;

      if (beforeComp.text !== afterComp.text) {
        changes.push({
          selector,
          changeType: "text",
          before: beforeComp.text,
          after: afterComp.text,
          confidence: 0.95,
        });
      }
    }

    return changes;
  }

  /**
   * Determine change type from diff
   */
  private determineChangeType(diff: VisualDiff): ChangeType {
    const hasStyleChanges = diff.styleChanges.length > 0;
    const hasLayoutChanges = diff.boundingBoxes.some(
      b => b.changeType === "moved" || b.changeType === "resized"
    );
    const hasContentChanges = diff.contentChanges.length > 0;
    const hasElementChanges = diff.elementChanges.length > 0;

    const changeCount =
      (hasStyleChanges ? 1 : 0) +
      (hasLayoutChanges ? 1 : 0) +
      (hasContentChanges ? 1 : 0) +
      (hasElementChanges ? 1 : 0);

    if (changeCount > 1) return "multi";
    if (hasStyleChanges) return "style";
    if (hasLayoutChanges) return "layout";
    if (hasContentChanges) return "content";
    return "state";
  }

  /**
   * Generate human-readable change description
   */
  private generateChangeDescription(
    diff: VisualDiff,
    changeType: ChangeType
  ): string {
    const parts: string[] = [];

    if (diff.styleChanges.length > 0) {
      parts.push(`${diff.styleChanges.length} style changes`);
    }

    if (diff.boundingBoxes.length > 0) {
      const moved = diff.boundingBoxes.filter(
        b => b.changeType === "moved"
      ).length;
      const resized = diff.boundingBoxes.filter(
        b => b.changeType === "resized"
      ).length;
      if (moved > 0) parts.push(`${moved} elements moved`);
      if (resized > 0) parts.push(`${resized} elements resized`);
    }

    if (diff.contentChanges.length > 0) {
      parts.push(`${diff.contentChanges.length} content changes`);
    }

    if (diff.elementChanges.length > 0) {
      const added = diff.elementChanges.filter(
        e => e.change === "added"
      ).length;
      const removed = diff.elementChanges.filter(
        e => e.change === "removed"
      ).length;
      if (added > 0) parts.push(`${added} elements added`);
      if (removed > 0) parts.push(`${removed} elements removed`);
    }

    return parts.length > 0 ? parts.join(", ") : `${changeType} change`;
  }

  /**
   * Assess difficulty of change
   */
  private assessDifficulty(diff: VisualDiff): "easy" | "medium" | "hard" {
    const totalChanges =
      diff.styleChanges.length +
      diff.boundingBoxes.length +
      diff.contentChanges.length +
      diff.elementChanges.length;

    if (totalChanges <= 2) return "easy";
    if (totalChanges <= 5) return "medium";
    return "hard";
  }

  /**
   * Calculate image similarity
   */
  private async calculateImageSimilarity(
    image1: Buffer,
    image2: Buffer
  ): Promise<number> {
    const sharp = await this.getSharp();

    try {
      const stats1 = await sharp(image1).stats();
      const stats2 = await sharp(image2).stats();

      let similarity = 0;
      for (let i = 0; i < 3; i++) {
        const meanDiff = Math.abs(
          stats1.channels[i].mean - stats2.channels[i].mean
        );
        similarity += 1 - meanDiff / 256;
      }

      return similarity / 3;
    } catch {
      return 0.5;
    }
  }

  /**
   * Adjust color hue
   */
  private adjustColor(color: string, amount: number): string {
    // Simple color adjustment (placeholder)
    return color;
  }

  /**
   * Modify text content
   */
  private modifyText(text: string): string {
    return text + " (modified)";
  }

  /**
   * Get all created pairs
   */
  getPairs(): UIStatePair[] {
    return Array.from(this.pairs.values());
  }

  /**
   * Clear pairs
   */
  clear(): void {
    this.pairs.clear();
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}
