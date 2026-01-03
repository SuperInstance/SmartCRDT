/**
 * @lsi/vljepa-synthetic - Style Generator
 *
 * Generates CSS styles for components and layouts.
 *
 * @module generators
 */

import type { CSSProperties, StyleSystem, ThemeColors } from "../types.js";
import { createSeededRandom, createColorUtils } from "../utils.js";

export interface StyleGeneratorConfig {
  styleSystem: StyleSystem;
  seed?: number;
}

export class StyleGenerator {
  private config: StyleGeneratorConfig;
  private rng: ReturnType<typeof createSeededRandom>;
  private colorUtils: ReturnType<typeof createColorUtils>;

  constructor(config: StyleGeneratorConfig) {
    this.config = config;
    const seed = config.seed ?? Date.now();
    this.rng = createSeededRandom(seed);
    this.colorUtils = createColorUtils(seed);
  }

  /**
   * Generate random theme colors
   */
  generateTheme(): ThemeColors {
    const baseHue = this.rng.int(0, 360);

    return {
      primary: this.colorUtils.randomHue(baseHue, baseHue + 30),
      secondary: this.colorUtils.randomHue(baseHue + 180, baseHue + 210),
      accent: this.colorUtils.randomHue(baseHue + 120, baseHue + 150),
      background: this.rng.pick(["#ffffff", "#f8fafc", "#f1f5f9"]),
      text: this.rng.pick(["#1e293b", "#334155", "#0f172a"]),
      error: "#ef4444",
      warning: "#f59e0b",
      success: "#22c55e",
    };
  }

  /**
   * Generate component styles
   */
  generateComponentStyles(_type?: string): CSSProperties {
    const baseStyles: CSSProperties = {
      padding: `${this.rng.int(8, 24)}px`,
      margin: `${this.rng.int(0, 16)}px`,
      borderRadius: `${this.rng.int(0, 12)}px`,
      fontSize: this.rng.pick(["0.875rem", "1rem", "1.125rem", "1.25rem"]),
      fontWeight: this.rng.int(400, 700),
      color: this.colorUtils.random(),
      backgroundColor: this.colorUtils.random(),
      border: this.rng.boolean() ? "1px solid #e5e7eb" : "none",
    };

    if (this.rng.boolean()) {
      baseStyles.boxShadow = `0 ${this.rng.int(1, 4)}px ${this.rng.int(4, 12)}px rgba(0, 0, 0, 0.${this.rng.int(5, 15)})`;
    }

    return baseStyles;
  }

  /**
   * Generate responsive styles
   */
  generateResponsiveStyles(): Record<string, CSSProperties> {
    return {
      sm: this.generateComponentStyles("sm"),
      md: this.generateComponentStyles("md"),
      lg: this.generateComponentStyles("lg"),
      xl: this.generateComponentStyles("xl"),
    };
  }

  /**
   * Generate animation styles
   */
  generateAnimationStyles(): CSSProperties {
    const animations = ["fade-in", "slide-up", "scale-in", "rotate"];
    const animation = this.rng.pick(animations);

    return {
      animation: `${animation} ${this.rng.float(0.2, 1)}s ease-${this.rng.pick(["in", "out"])}`,
    };
  }
}
