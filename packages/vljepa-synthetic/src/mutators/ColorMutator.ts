/**
 * @lsi/vljepa-synthetic - Color Mutator
 *
 * Mutates colors in UI components using various color theory strategies.
 *
 * @module mutators
 */

import type {
  MutationConfig,
  AppliedMutation,
  UIState,
  CSSProperties,
  ColorDiff,
} from "../types.js";
import { createSeededRandom, createColorUtils } from "../utils.js";

export class ColorMutator {
  private config: MutationConfig;
  private rng: ReturnType<typeof createSeededRandom>;
  private colorUtils: ReturnType<typeof createColorUtils>;

  constructor(config: MutationConfig) {
    this.config = config;
    this.rng = createSeededRandom(config.seed);
    this.colorUtils = createColorUtils(config.seed + 1);
  }

  /**
   * Mutate colors in UI state
   */
  mutate(state: UIState): { state: UIState; mutations: AppliedMutation[] } {
    const mutations: AppliedMutation[] = [];
    const newState = JSON.parse(JSON.stringify(state)) as UIState;

    // Mutate theme colors
    if (this.rng.float(0, 1) < this.config.rate) {
      const themeMutation = this.mutateThemeColors(
        newState.theme as unknown as Record<string, string>
      );
      mutations.push(themeMutation);
      newState.theme =
        themeMutation.mutated as unknown as typeof newState.theme;
    }

    // Mutate component colors
    for (const component of newState.components) {
      if (this.rng.float(0, 1) < this.config.rate) {
        const compMutation = this.mutateComponentColors(component);
        mutations.push(compMutation);
        component.styles = compMutation.mutated as CSSProperties;
      }
    }

    // Mutate global styles
    if (this.rng.float(0, 1) < this.config.rate) {
      const globalMutation = this.mutateGlobalStyles(newState.globalStyles);
      mutations.push(globalMutation);
      newState.globalStyles = globalMutation.mutated as CSSProperties;
    }

    return { state: newState, mutations };
  }

  /**
   * Mutate theme colors using color theory
   */
  private mutateThemeColors(theme: Record<string, string>): AppliedMutation {
    const strategies = [
      "complementary",
      "analogous",
      "triadic",
      "monochromatic",
      "shift-hue",
      "adjust-saturation",
      "adjust-lightness",
    ];

    const strategy = this.rng.pick(strategies);
    const newTheme = { ...theme };

    switch (strategy) {
      case "complementary":
        newTheme.primary = this.colorUtils.complementary(theme.primary);
        newTheme.accent = this.colorUtils.complementary(theme.accent);
        break;

      case "analogous":
        const primaryAnalogous = this.colorUtils.analogous(theme.primary, 1);
        newTheme.primary = primaryAnalogous[1];
        break;

      case "triadic":
        const triadic = this.colorUtils.triadic(theme.primary);
        newTheme.secondary = triadic[1];
        newTheme.accent = triadic[2];
        break;

      case "monochromatic":
        const mono = this.colorUtils.monochromatic(theme.primary, 5);
        newTheme.primary = mono[this.rng.int(0, 4)];
        break;

      case "shift-hue":
        newTheme.primary = this.colorUtils.randomHue(
          this.getHue(theme.primary) - 30,
          this.getHue(theme.primary) + 30
        );
        break;

      case "adjust-saturation":
        // Simplified saturation adjustment
        newTheme.primary = this.colorUtils.random();
        break;

      case "adjust-lightness":
        newTheme.primary = this.colorUtils.random();
        break;
    }

    return {
      type: "color",
      target: "theme",
      original: theme,
      mutated: newTheme,
      description: `Applied ${strategy} color strategy`,
    };
  }

  /**
   * Mutate component colors
   */
  private mutateComponentColors(component: {
    styles: CSSProperties;
  }): AppliedMutation {
    const newStyles = { ...component.styles };
    const colorProps = ["color", "backgroundColor", "borderColor", "boxShadow"];
    const propToMutate = colorProps.filter(p => p in newStyles);

    if (propToMutate.length > 0) {
      const prop = this.rng.pick(propToMutate);
      const original = newStyles[prop];

      if (typeof original === "string") {
        newStyles[prop] = this.colorUtils.random();

        return {
          type: "color",
          target: `component.${prop}`,
          original,
          mutated: newStyles[prop],
          description: `Changed ${prop} color`,
        };
      }
    }

    // Fallback: add a new color property
    newStyles.color = this.colorUtils.random();

    return {
      type: "color",
      target: "component",
      original: {},
      mutated: newStyles,
      description: "Added color property",
    };
  }

  /**
   * Mutate global styles colors
   */
  private mutateGlobalStyles(styles: CSSProperties): AppliedMutation {
    const newStyles = { ...styles };

    if (typeof styles.color === "string") {
      newStyles.color = this.colorUtils.complementary(styles.color);
    }

    if (typeof styles.backgroundColor === "string") {
      newStyles.backgroundColor = this.colorUtils.analogous(
        styles.backgroundColor,
        1
      )[1];
    }

    return {
      type: "color",
      target: "global",
      original: styles,
      mutated: newStyles,
      description: "Mutated global colors",
    };
  }

  /**
   * Calculate color differences between two UI states
   */
  calculateDiffs(original: UIState, mutated: UIState): ColorDiff[] {
    const diffs: ColorDiff[] = [];

    // Compare theme colors
    for (const key of Object.keys(original.theme)) {
      const orig = (original.theme as unknown as Record<string, string>)[key];
      const mut = (mutated.theme as unknown as Record<string, string>)[key];
      if (orig !== mut) {
        diffs.push({
          property: `theme.${key}`,
          original: orig,
          mutated: mut,
          distance: this.colorUtils.distance(orig, mut),
        });
      }
    }

    return diffs;
  }

  /**
   * Get approximate hue from hex color
   */
  private getHue(hex: string): number {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;

    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }

    return h * 360;
  }
}
