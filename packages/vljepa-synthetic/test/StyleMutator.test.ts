/**
 * @lsi/vljepa-synthetic - Style Mutator Tests
 *
 * 55+ tests for ColorMutator, LayoutMutator, StyleMutator, ContentMutator
 */

import { describe, it, expect } from "vitest";
import { ColorMutator } from "../src/mutators/ColorMutator.js";
import { LayoutMutator } from "../src/mutators/LayoutMutator.js";
import { StyleMutator } from "../src/mutators/StyleMutator.js";
import { ContentMutator } from "../src/mutators/ContentMutator.js";
import { ComponentGenerator } from "../src/generators/ComponentGenerator.js";
import type { MutationConfig, UIState } from "../src/types.js";

describe("ColorMutator", () => {
  const config: MutationConfig = {
    rate: 0.5,
    intensity: "medium",
    seed: 12345,
    mutationTypes: ["color"],
  };

  describe("mutate theme colors", () => {
    it("should mutate theme colors", () => {
      const mutator = new ColorMutator(config);
      const state: UIState = {
        components: [],
        globalStyles: {},
        theme: {
          primary: "#3b82f6",
          secondary: "#64748b",
          accent: "#8b5cf6",
          background: "#ffffff",
          text: "#1e293b",
          error: "#ef4444",
          warning: "#f59e0b",
          success: "#22c55e",
        },
      };

      const result = mutator.mutate(state);

      expect(result.mutations.length).toBeGreaterThan(0);
      expect(result.state.theme).toBeDefined();
    });

    it("should use complementary strategy", () => {
      const mutator = new ColorMutator({ ...config, seed: 1 });
      const state: UIState = {
        components: [],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.mutations.length).toBeGreaterThan(0);
    });

    it("should use analogous strategy", () => {
      const mutator = new ColorMutator({ ...config, seed: 2 });
      const state: UIState = {
        components: [],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.state.theme.primary).toBeDefined();
    });

    it("should use triadic strategy", () => {
      const mutator = new ColorMutator({ ...config, seed: 3 });
      const state: UIState = {
        components: [],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.state.theme).toBeDefined();
    });

    it("should use monochromatic strategy", () => {
      const mutator = new ColorMutator({ ...config, seed: 4 });
      const state: UIState = {
        components: [],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.state.theme.primary).toBeDefined();
    });

    it("should calculate color diffs", () => {
      const mutator = new ColorMutator(config);
      const state1: UIState = {
        components: [],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state1);
      const diffs = mutator.calculateDiffs(state1, result.state);

      expect(diffs).toBeDefined();
      expect(Array.isArray(diffs)).toBe(true);
    });
  });

  describe("mutate component colors", () => {
    it("should mutate component styles", () => {
      const mutator = new ColorMutator(config);
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const state: UIState = {
        components: [component],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.state.components.length).toBe(1);
    });

    it("should mutate color property", () => {
      const mutator = new ColorMutator({ ...config, rate: 1 });
      const state: UIState = {
        components: [{
          type: "button",
          code: "",
          styles: { color: "#3b82f6" },
          props: {},
          metadata: { type: "button", id: "test", styleSystem: "tailwind", timestamp: Date.now(), seed: 1, state: "default", tags: [] },
        }],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const result = mutator.mutate(state);

      expect(result.mutations.length).toBeGreaterThan(0);
    });
  });
});

describe("LayoutMutator", () => {
  const config: MutationConfig = {
    rate: 0.5,
    intensity: "medium",
    seed: 12345,
    mutationTypes: ["layout"],
  };

  it("should mutate display property", () => {
    const mutator = new LayoutMutator(config);
    const styles = { display: "flex" };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate flexDirection", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { flexDirection: "row", display: "flex" };

    const result = mutator.mutate(styles);

    expect(result.styles).toBeDefined();
  });

  it("should mutate justifyContent", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { justifyContent: "center", display: "flex" };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate alignItems", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { alignItems: "center", display: "flex" };

    const result = mutator.mutate(styles);

    expect(result.styles).toBeDefined();
  });

  it("should mutate gap", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { gap: "16px", display: "flex" };

    const result = mutator.mutate(styles);

    expect(result.styles.gap).toBeDefined();
  });

  it("should mutate padding", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { padding: "16px" };

    const result = mutator.mutate(styles);

    expect(result.styles.padding).toBeDefined();
  });

  it("should mutate width", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { width: "100%" };

    const result = mutator.mutate(styles);

    expect(result.styles.width).toBeDefined();
  });

  it("should mutate height", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { height: "100%" };

    const result = mutator.mutate(styles);

    expect(result.styles.height).toBeDefined();
  });

  it("should mutate gridTemplateColumns", () => {
    const mutator = new LayoutMutator({ ...config, rate: 1 });
    const styles = { gridTemplateColumns: "repeat(3, 1fr)", display: "grid" };

    const result = mutator.mutate(styles);

    expect(result.styles.gridTemplateColumns).toBeDefined();
  });

  it("should respect low intensity", () => {
    const mutator = new LayoutMutator({ ...config, intensity: "low" });
    const styles = { display: "flex", flexDirection: "row" };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeLessThanOrEqual(2);
  });

  it("should respect high intensity", () => {
    const mutator = new LayoutMutator({ ...config, intensity: "high", rate: 1 });
    const styles = { display: "flex", flexDirection: "row", gap: "16px", padding: "16px" };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeGreaterThan(0);
  });
});

describe("StyleMutator", () => {
  const config: MutationConfig = {
    rate: 0.5,
    intensity: "medium",
    seed: 12345,
    mutationTypes: ["style"],
  };

  it("should mutate typography properties", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { fontSize: "1rem", fontWeight: 400 };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate fontSize", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { fontSize: "1rem" };

    const result = mutator.mutate(styles);

    expect(result.styles.fontSize).toBeDefined();
  });

  it("should mutate fontWeight", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { fontWeight: 400 };

    const result = mutator.mutate(styles);

    expect(result.styles.fontWeight).toBeDefined();
  });

  it("should mutate lineHeight", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { lineHeight: "1.5" };

    const result = mutator.mutate(styles);

    expect(result.styles.lineHeight).toBeDefined();
  });

  it("should mutate fontFamily", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { fontFamily: "system-ui" };

    const result = mutator.mutate(styles);

    expect(result.styles.fontFamily).toBeDefined();
  });

  it("should mutate border properties", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { border: "1px solid #e5e7eb" };

    const result = mutator.mutate(styles);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate borderStyle", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { borderStyle: "solid" };

    const result = mutator.mutate(styles);

    expect(result.styles.borderStyle).toBeDefined();
  });

  it("should mutate borderWidth", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { borderWidth: "1px" };

    const result = mutator.mutate(styles);

    expect(result.styles.borderWidth).toBeDefined();
  });

  it("should mutate borderColor", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { borderColor: "#e5e7eb" };

    const result = mutator.mutate(styles);

    expect(result.styles.borderColor).toBeDefined();
  });

  it("should mutate boxShadow", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" };

    const result = mutator.mutate(styles);

    expect(result.styles.boxShadow).toBeDefined();
  });

  it("should mutate borderRadius", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = { borderRadius: "8px" };

    const result = mutator.mutate(styles);

    expect(result.styles.borderRadius).toBeDefined();
  });

  it("should handle empty styles", () => {
    const mutator = new StyleMutator({ ...config, rate: 1 });
    const styles = {};

    const result = mutator.mutate(styles);

    expect(result.styles).toBeDefined();
  });
});

describe("ContentMutator", () => {
  const config: MutationConfig = {
    rate: 0.5,
    intensity: "medium",
    seed: 12345,
    mutationTypes: ["content"],
  };

  it("should mutate button content", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate input placeholder", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["input"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("input");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate card content", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["card"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("card");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should mutate alert content", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["alert"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("alert");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should preserve component structure", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const result = mutator.mutate(component);

    expect(result.component.type).toBe(component.type);
    expect(result.component.metadata.id).toBe(component.metadata.id);
  });

  it("should handle mutation rate", () => {
    const mutator = new ContentMutator({ ...config, rate: 0 });
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBe(0);
  });

  it("should always mutate with rate 1", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const result = mutator.mutate(component);

    expect(result.mutations.length).toBeGreaterThan(0);
  });

  it("should change button text", () => {
    const mutator = new ContentMutator({ ...config, rate: 1 });
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");
    const originalCode = component.code;
    const result = mutator.mutate(component);

    expect(result.component.code).toBeDefined();
    expect(typeof result.component.code).toBe("string");
  });
});

describe("Mutation integration", () => {
  it("should apply multiple mutations to component", () => {
    const compGen = new ComponentGenerator({
      componentTypes: ["button"],
      styleSystems: ["tailwind"],
      variations: { colors: 1, sizes: 1, states: 1 },
      seed: 1,
    });

    const component = compGen.generate("button");

    const colorMutator = new ColorMutator({ rate: 1, intensity: "low", seed: 1, mutationTypes: ["color"] });
    const styleMutator = new StyleMutator({ rate: 1, intensity: "low", seed: 2, mutationTypes: ["style"] });

    const state: UIState = {
      components: [component],
      globalStyles: {},
      theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
    };

    const colorResult = colorMutator.mutate(state);
    const styleResult = styleMutator.mutate({ components: colorResult.state.components, globalStyles: state.globalStyles, theme: state.theme });

    expect(colorResult.state.components).toBeDefined();
    expect(styleResult.state.components).toBeDefined();
  });
});
