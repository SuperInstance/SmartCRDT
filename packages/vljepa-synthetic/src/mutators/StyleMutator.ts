/**
 * @lsi/vljepa-synthetic - Style Mutator
 *
 * Mutates style properties like typography, borders, shadows, etc.
 *
 * @module mutators
 */

import type {
  MutationConfig,
  AppliedMutation,
  CSSProperties,
} from "../types.js";
import { createSeededRandom, createColorUtils } from "../utils.js";

export class StyleMutator {
  private config: MutationConfig;
  private rng: ReturnType<typeof createSeededRandom>;
  private colorUtils: ReturnType<typeof createColorUtils>;

  constructor(config: MutationConfig) {
    this.config = config;
    this.rng = createSeededRandom(config.seed);
    this.colorUtils = createColorUtils(config.seed + 1);
  }

  /**
   * Mutate style properties
   */
  mutate(styles: CSSProperties): {
    styles: CSSProperties;
    mutations: AppliedMutation[];
  } {
    const mutations: AppliedMutation[] = [];
    const newStyles = { ...styles };

    // Typography mutations
    if (this.rng.float(0, 1) < this.config.rate) {
      const typoMutation = this.mutateTypography(newStyles);
      mutations.push(typoMutation);
      Object.assign(newStyles, typoMutation.mutated as CSSProperties);
    }

    // Border mutations
    if (this.rng.float(0, 1) < this.config.rate) {
      const borderMutation = this.mutateBorder(newStyles);
      mutations.push(borderMutation);
      Object.assign(newStyles, borderMutation.mutated as CSSProperties);
    }

    // Shadow mutations
    if (this.rng.float(0, 1) < this.config.rate) {
      const shadowMutation = this.mutateShadow(newStyles);
      mutations.push(shadowMutation);
      Object.assign(newStyles, shadowMutation.mutated as CSSProperties);
    }

    // Border radius mutations
    if (this.rng.float(0, 1) < this.config.rate) {
      const radiusMutation = this.mutateBorderRadius(newStyles);
      mutations.push(radiusMutation);
      (newStyles as any).borderRadius = radiusMutation.mutated;
    }

    return { styles: newStyles, mutations };
  }

  /**
   * Mutate typography properties
   */
  private mutateTypography(styles: CSSProperties): AppliedMutation {
    const mutations: Record<string, unknown> = {};

    const fontSizes = [
      "0.75rem",
      "0.875rem",
      "1rem",
      "1.125rem",
      "1.25rem",
      "1.5rem",
      "2rem",
    ];
    const fontWeights = [300, 400, 500, 600, 700, 800];
    const lineHeights = ["1", "1.25", "1.5", "1.75", "2"];
    const fontFamilies = [
      "system-ui, sans-serif",
      "Georgia, serif",
      "'Courier New', monospace",
      "Arial, sans-serif",
      "Times New Roman, serif",
    ];

    if (this.rng.boolean()) {
      mutations.fontSize = this.rng.pick(fontSizes);
    }
    if (this.rng.boolean()) {
      mutations.fontWeight = this.rng.pick(fontWeights);
    }
    if (this.rng.boolean()) {
      mutations.lineHeight = this.rng.pick(lineHeights);
    }
    if (this.rng.boolean()) {
      mutations.fontFamily = this.rng.pick(fontFamilies);
    }

    return {
      type: "style",
      target: "typography",
      original: styles,
      mutated: mutations,
      description: "Mutated typography properties",
    };
  }

  /**
   * Mutate border properties
   */
  private mutateBorder(styles: CSSProperties): AppliedMutation {
    const borderStyles = ["solid", "dashed", "dotted", "double"];
    const borderWidths = ["1px", "2px", "3px", "4px"];

    const mutations: Record<string, unknown> = {
      borderStyle: this.rng.pick(borderStyles),
      borderWidth: this.rng.pick(borderWidths),
      borderColor: this.colorUtils.random(),
    };

    return {
      type: "style",
      target: "border",
      original: styles,
      mutated: mutations,
      description: "Mutated border properties",
    };
  }

  /**
   * Mutate box shadow
   */
  private mutateShadow(styles: CSSProperties): AppliedMutation {
    const shadows = [
      "none",
      "0 1px 2px rgba(0, 0, 0, 0.05)",
      "0 2px 4px rgba(0, 0, 0, 0.1)",
      "0 4px 6px rgba(0, 0, 0, 0.1)",
      "0 10px 15px rgba(0, 0, 0, 0.1)",
      "0 20px 25px rgba(0, 0, 0, 0.15)",
      "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      `0 ${this.rng.int(1, 10)}px ${this.rng.int(4, 20)}px rgba(0, 0, 0, 0.${this.rng.int(5, 25)})`,
    ];

    return {
      type: "style",
      target: "shadow",
      original: styles.boxShadow,
      mutated: this.rng.pick(shadows),
      description: "Mutated box shadow",
    };
  }

  /**
   * Mutate border radius
   */
  private mutateBorderRadius(styles: CSSProperties): AppliedMutation {
    const radii = ["0", "4px", "8px", "12px", "16px", "24px", "50%", "9999px"];

    return {
      type: "style",
      target: "borderRadius",
      original: styles.borderRadius,
      mutated: this.rng.pick(radii),
      description: "Mutated border radius",
    };
  }
}
