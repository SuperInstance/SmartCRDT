/**
 * VisualDiff - Visual diffing for UI components
 */

import type { UIState } from "../types.js";

export interface VisualDifference {
  type: "color" | "size" | "position" | "opacity" | "visibility" | "font";
  path: string;
  property: string;
  before: unknown;
  after: unknown;
  severity: "minor" | "major";
}

export interface VisualRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class VisualDiff {
  /**
   * Compare visual properties
   */
  compareVisuals(before: UIState, after: UIState): VisualDifference[] {
    const differences: VisualDifference[] = [];

    // Compare styles
    const styleDiffs = this.compareStyles(before.styles, after.styles);
    differences.push(...styleDiffs);

    // Compare layout
    const layoutDiffs = this.compareLayout(before.layout, after.layout);
    differences.push(...layoutDiffs);

    // Compare component visuals
    const componentDiffs = this.compareComponents(
      before.components,
      after.components
    );
    differences.push(...componentDiffs);

    return differences;
  }

  /**
   * Find changed regions
   */
  findChangedRegions(before: UIState, after: UIState): VisualRegion[] {
    const regions: VisualRegion[] = [];

    // Find components with visual changes
    for (const afterComp of after.components) {
      const beforeComp = before.components.find(c => c.id === afterComp.id);

      if (!beforeComp) {
        // New component - entire component is a changed region
        const region = this.getComponentRegion(afterComp);
        if (region) {
          regions.push(region);
        }
      } else {
        // Check for visual changes
        const hasChanges = this.hasVisualChanges(beforeComp, afterComp);
        if (hasChanges) {
          const region = this.getComponentRegion(afterComp);
          if (region) {
            regions.push(region);
          }
        }
      }
    }

    return this.mergeRegions(regions);
  }

  /**
   * Generate heat map of changes
   */
  generateHeatMap(before: UIState, after: UIState): HeatMapRegion[] {
    const heatMap: HeatMapRegion[] = [];

    for (const afterComp of after.components) {
      const beforeComp = before.components.find(c => c.id === afterComp.id);
      const region = this.getComponentRegion(afterComp);

      if (!region) continue;

      const severity = this.calculateChangeSeverity(beforeComp, afterComp);

      heatMap.push({
        ...region,
        intensity: severity,
        componentId: afterComp.id,
      });
    }

    return heatMap;
  }

  /**
   * Generate side-by-side comparison
   */
  generateSideBySide(before: UIState, after: UIState): SideBySideComparison {
    const beforeRegions = this.getAllComponentRegions(before);
    const afterRegions = this.getAllComponentRegions(after);

    return {
      before: {
        state: before,
        regions: beforeRegions,
      },
      after: {
        state: after,
        regions: afterRegions,
      },
      differences: this.compareVisuals(before, after),
    };
  }

  /**
   * Generate overlay diff
   */
  generateOverlay(before: UIState, after: UIState): OverlayDiff {
    const changes: OverlayChange[] = [];

    for (const afterComp of after.components) {
      const beforeComp = before.components.find(c => c.id === afterComp.id);
      const region = this.getComponentRegion(afterComp);

      if (!region) continue;

      if (!beforeComp) {
        // New component
        changes.push({
          type: "addition",
          region,
          content: afterComp,
        });
      } else if (this.hasVisualChanges(beforeComp, afterComp)) {
        // Modified component
        changes.push({
          type: "modification",
          region,
          before: beforeComp,
          after: afterComp,
        });
      }
    }

    // Check for deletions
    for (const beforeComp of before.components) {
      const afterComp = after.components.find(c => c.id === beforeComp.id);
      const region = this.getComponentRegion(beforeComp);

      if (!afterComp && region) {
        changes.push({
          type: "deletion",
          region,
          content: beforeComp,
        });
      }
    }

    return {
      base: before,
      changes,
    };
  }

  /**
   * Calculate visual similarity score (0-1)
   */
  calculateSimilarity(before: UIState, after: UIState): number {
    const differences = this.compareVisuals(before, after);
    const totalComponents = Math.max(
      before.components.length,
      after.components.length
    );

    if (totalComponents === 0) {
      return 1.0;
    }

    const majorChanges = differences.filter(d => d.severity === "major").length;
    const minorChanges = differences.filter(d => d.severity === "minor").length;

    // Similarity decreases with changes
    const similarityScore =
      1 - (majorChanges * 0.2 + minorChanges * 0.05) / totalComponents;

    return Math.max(0, Math.min(1, similarityScore));
  }

  // Private methods

  private compareStyles(
    before: UIState["styles"],
    after: UIState["styles"]
  ): VisualDifference[] {
    const differences: VisualDifference[] = [];

    for (const [key, afterValue] of Object.entries(after.css)) {
      const beforeValue = before.css[key];

      if (beforeValue !== afterValue) {
        const type = this.inferPropertyType(key);
        differences.push({
          type,
          path: `styles.css.${key}`,
          property: key,
          before: beforeValue,
          after: afterValue,
          severity: "minor",
        });
      }
    }

    return differences;
  }

  private compareLayout(
    before: UIState["layout"],
    after: UIState["layout"]
  ): VisualDifference[] {
    const differences: VisualDifference[] = [];

    if (before.type !== after.type) {
      differences.push({
        type: "position",
        path: "layout.type",
        property: "type",
        before: before.type,
        after: after.type,
        severity: "major",
      });
    }

    differences.push(
      ...this.compareDimensions(before.dimensions, after.dimensions)
    );
    differences.push(...this.comparePositions(before.position, after.position));

    return differences;
  }

  private compareComponents(
    before: UIState["components"],
    after: UIState["components"]
  ): VisualDifference[] {
    const differences: VisualDifference[] = [];

    for (const afterComp of after.components) {
      const beforeComp = before.find(c => c.id === afterComp.id);

      if (!beforeComp) {
        continue; // Handled elsewhere
      }

      // Compare styles
      for (const [key, afterValue] of Object.entries(afterComp.styles)) {
        const beforeValue = beforeComp.styles[key];

        if (beforeValue !== afterValue) {
          const type = this.inferPropertyType(key);
          differences.push({
            type,
            path: `components.${afterComp.id}.styles.${key}`,
            property: key,
            before: beforeValue,
            after: afterValue,
            severity: "minor",
          });
        }
      }
    }

    return differences;
  }

  private compareDimensions(
    before: UIState["layout"]["dimensions"],
    after: UIState["layout"]["dimensions"]
  ): VisualDifference[] {
    const differences: VisualDifference[] = [];

    for (const key of [
      "width",
      "height",
      "minWidth",
      "minHeight",
      "maxWidth",
      "maxHeight",
    ] as const) {
      if (before[key] !== after[key]) {
        differences.push({
          type: "size",
          path: `layout.dimensions.${key}`,
          property: key,
          before: before[key],
          after: after[key],
          severity: "minor",
        });
      }
    }

    return differences;
  }

  private comparePositions(
    before: UIState["layout"]["position"],
    after: UIState["layout"]["position"]
  ): VisualDifference[] {
    const differences: VisualDifference[] = [];

    for (const key of ["top", "left", "right", "bottom"] as const) {
      if (before[key] !== after[key]) {
        differences.push({
          type: "position",
          path: `layout.position.${key}`,
          property: key,
          before: before[key],
          after: after[key],
          severity: "minor",
        });
      }
    }

    return differences;
  }

  private hasVisualChanges(
    before: UIState["components"][0],
    after: UIState["components"][0]
  ): boolean {
    return JSON.stringify(before.styles) !== JSON.stringify(after.styles);
  }

  private calculateChangeSeverity(
    before: UIState["components"][0] | undefined,
    after: UIState["components"][0]
  ): number {
    if (!before) {
      return 1.0; // New component - max intensity
    }

    let changes = 0;

    for (const key of Object.keys(after.styles)) {
      if (before.styles[key] !== after.styles[key]) {
        changes++;
      }
    }

    return Math.min(changes / 5, 1.0); // Normalize to 0-1
  }

  private getComponentRegion(
    component: UIState["components"][0]
  ): VisualRegion | null {
    // Try to extract region from styles
    const left = parseInt(component.styles.left ?? "0");
    const top = parseInt(component.styles.top ?? "0");
    const width = parseInt(component.styles.width ?? "100");
    const height = parseInt(component.styles.height ?? "100");

    if (isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height)) {
      return null;
    }

    return { x: left, y: top, width, height };
  }

  private getAllComponentRegions(state: UIState): ComponentRegion[] {
    const regions: ComponentRegion[] = [];

    for (const component of state.components) {
      const region = this.getComponentRegion(component);
      if (region) {
        regions.push({
          componentId: component.id,
          region,
        });
      }
    }

    return regions;
  }

  private mergeRegions(regions: VisualRegion[]): VisualRegion[] {
    if (regions.length === 0) {
      return [];
    }

    // Simple merging - combine overlapping regions
    const merged: VisualRegion[] = [];
    const sorted = [...regions].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const region of sorted) {
      let mergedRegion = region;

      for (let i = 0; i < merged.length; i++) {
        const existing = merged[i];

        if (this.regionsOverlap(existing, mergedRegion)) {
          merged[i] = this.mergeTwoRegions(existing, mergedRegion);
          mergedRegion = null;
          break;
        }
      }

      if (mergedRegion) {
        merged.push(mergedRegion);
      }
    }

    return merged;
  }

  private regionsOverlap(r1: VisualRegion, r2: VisualRegion): boolean {
    return !(
      r1.x + r1.width < r2.x ||
      r2.x + r2.width < r1.x ||
      r1.y + r1.height < r2.y ||
      r2.y + r2.height < r1.y
    );
  }

  private mergeTwoRegions(r1: VisualRegion, r2: VisualRegion): VisualRegion {
    const x = Math.min(r1.x, r2.x);
    const y = Math.min(r1.y, r2.y);
    const width = Math.max(r1.x + r1.width, r2.x + r2.width) - x;
    const height = Math.max(r1.y + r1.height, r2.y + r2.height) - y;

    return { x, y, width, height };
  }

  private inferPropertyType(property: string): VisualDifference["type"] {
    const colorProps = [
      "color",
      "backgroundColor",
      "borderColor",
      "outlineColor",
    ];
    const sizeProps = [
      "width",
      "height",
      "fontSize",
      "padding",
      "margin",
      "borderWidth",
    ];
    const positionProps = ["left", "right", "top", "bottom", "position"];
    const opacityProps = ["opacity", "visibility"];

    if (colorProps.some(p => property.includes(p))) {
      return "color";
    }
    if (sizeProps.some(p => property.includes(p))) {
      return "size";
    }
    if (positionProps.some(p => property.includes(p))) {
      return "position";
    }
    if (opacityProps.some(p => property.includes(p))) {
      return "opacity";
    }
    if (property.includes("font")) {
      return "font";
    }

    return "visibility";
  }
}

export interface HeatMapRegion extends VisualRegion {
  intensity: number;
  componentId: string;
}

export interface SideBySideComparison {
  before: {
    state: UIState;
    regions: ComponentRegion[];
  };
  after: {
    state: UIState;
    regions: ComponentRegion[];
  };
  differences: VisualDifference[];
}

export interface ComponentRegion {
  componentId: string;
  region: VisualRegion;
}

export interface OverlayDiff {
  base: UIState;
  changes: OverlayChange[];
}

export type OverlayChange =
  | { type: "addition"; region: VisualRegion; content: unknown }
  | { type: "deletion"; region: VisualRegion; content: unknown }
  | {
      type: "modification";
      region: VisualRegion;
      before: unknown;
      after: unknown;
    };
