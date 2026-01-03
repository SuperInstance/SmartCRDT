/**
 * @lsi/vljepa-synthetic - Layout Mutator
 *
 * Mutates layout properties in UI components.
 *
 * @module mutators
 */

import type {
  MutationConfig,
  AppliedMutation,
  CSSProperties,
} from "../types.js";
import { createSeededRandom } from "../utils.js";

export class LayoutMutator {
  private config: MutationConfig;
  private rng: ReturnType<typeof createSeededRandom>;

  constructor(config: MutationConfig) {
    this.config = config;
    this.rng = createSeededRandom(config.seed);
  }

  /**
   * Mutate layout properties
   */
  mutate(styles: CSSProperties): {
    styles: CSSProperties;
    mutations: AppliedMutation[];
  } {
    const mutations: AppliedMutation[] = [];
    const newStyles = { ...styles };

    const layoutProps = [
      "display",
      "flexDirection",
      "flexWrap",
      "justifyContent",
      "alignItems",
      "gridTemplateColumns",
      "gridTemplateRows",
      "gap",
      "padding",
      "margin",
      "width",
      "height",
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
    ];

    // Select properties to mutate based on intensity
    const mutationCount = this.getMutationCount();
    const propsToMutate = this.rng.pickN(layoutProps, mutationCount);

    for (const prop of propsToMutate) {
      const mutation = this.mutateProperty(newStyles, prop);
      mutations.push(mutation);
      (newStyles as any)[prop] = mutation.mutated;
    }

    return { styles: newStyles, mutations };
  }

  /**
   * Get number of properties to mutate based on intensity
   */
  private getMutationCount(): number {
    switch (this.config.intensity) {
      case "low":
        return this.rng.int(1, 2);
      case "medium":
        return this.rng.int(2, 4);
      case "high":
        return this.rng.int(4, 7);
      default:
        return 1;
    }
  }

  /**
   * Mutate a single property
   */
  private mutateProperty(styles: CSSProperties, prop: string): AppliedMutation {
    const original = styles[prop];

    let mutated: unknown;

    switch (prop) {
      case "display":
        mutated = this.mutateDisplay(original as string);
        break;

      case "flexDirection":
        mutated = this.mutateFlexDirection(original as string);
        break;

      case "justifyContent":
      case "alignItems":
        mutated = this.mutateAlignment(original as string);
        break;

      case "gap":
      case "padding":
      case "margin":
        mutated = this.mutateSpacing(original);
        break;

      case "width":
      case "height":
      case "minWidth":
      case "maxWidth":
      case "minHeight":
      case "maxHeight":
        mutated = this.mutateSize(original);
        break;

      case "gridTemplateColumns":
      case "gridTemplateRows":
        mutated = this.mutateGridTemplate(original as string);
        break;

      default:
        mutated = original;
    }

    return {
      type: "layout",
      target: prop,
      original,
      mutated,
      description: `Mutated ${prop} from ${original} to ${mutated}`,
    };
  }

  private mutateDisplay(original: string): string {
    const options = ["flex", "grid", "block", "inline-block", "inline-flex"];
    return this.rng.pick(options.filter(o => o !== original));
  }

  private mutateFlexDirection(original: string): string {
    const options = ["row", "column", "row-reverse", "column-reverse"];
    return this.rng.pick(options.filter(o => o !== original));
  }

  private mutateAlignment(original: string): string {
    const options = [
      "start",
      "end",
      "center",
      "space-between",
      "space-around",
      "stretch",
    ];
    return this.rng.pick(options.filter(o => o !== original));
  }

  private mutateSpacing(original: unknown): string {
    const values = ["4px", "8px", "16px", "24px", "32px", "0"];
    return this.rng.pick(values);
  }

  private mutateSize(original: unknown): string {
    const values = [
      "100%",
      "50%",
      "auto",
      "200px",
      "300px",
      "400px",
      "min-content",
      "max-content",
    ];
    return this.rng.pick(values);
  }

  private mutateGridTemplate(original: string): string {
    const columns = this.rng.int(1, 6);
    return `repeat(${columns}, 1fr)`;
  }
}
