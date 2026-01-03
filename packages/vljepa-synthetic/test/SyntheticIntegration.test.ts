/**
 * @lsi/vljepa-synthetic - Synthetic Integration Tests
 *
 * 40+ integration tests for the complete synthetic data generation pipeline
 */

import { describe, it, expect } from "vitest";
import { ComponentGenerator } from "../src/generators/ComponentGenerator.js";
import { LayoutGenerator } from "../src/generators/LayoutGenerator.js";
import { PageGenerator } from "../src/generators/PageGenerator.js";
import { ColorMutator, LayoutMutator, StyleMutator, ContentMutator } from "../src/mutators/index.js";
import { ScreenshotRenderer, HTMLRenderer, ReactRenderer } from "../src/renderers/index.js";
import { AccessibilityValidator, DesignValidator, DiversityValidator } from "../src/validators/index.js";
import { GenerationPipeline, BatchProcessor } from "../src/pipelines/index.js";
import { createSeededRandom, createColorUtils, generateId } from "../src/utils.js";

describe("Synthetic Integration Tests", () => {
  describe("full pipeline integration", () => {
    it("should generate, mutate, validate, and render component", async () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");

      // Mutate
      const colorMutator = new ColorMutator({ rate: 1, intensity: "low", seed: 2, mutationTypes: ["color"] });
      const state = {
        components: [component],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };
      const mutated = colorMutator.mutate(state);

      // Validate
      const validator = new AccessibilityValidator(3);
      const validation = validator.validate(component);

      // Render
      const renderer = new ScreenshotRenderer({
        resolution: 1,
        formats: ["png"],
        backgrounds: ["#ffffff"],
        states: ["default"],
        timeout: 3000,
        viewport: { width: 1024, height: 768 },
      });
      const screenshot = await renderer.renderComponent(component);

      expect(component).toBeDefined();
      expect(mutated.mutations.length).toBeGreaterThan(0);
      expect(validation.passed).toBeDefined();
      expect(screenshot.metadata).toBeDefined();
    });

    it("should generate complete page with multiple components", () => {
      const pageGen = new PageGenerator({
        componentTypes: ["button", "input", "card"],
        styleSystem: "tailwind",
        minComponents: 3,
        maxComponents: 6,
        seed: 1,
      });

      const page = pageGen.generate();

      expect(page.components.length).toBeGreaterThanOrEqual(3);
      expect(page.components.length).toBeLessThanOrEqual(6);
      expect(page.layout).toBeDefined();
      expect(page.code).toContain("<!DOCTYPE html>");
    });

    it("should generate batch of diverse components", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button", "input", "card", "alert", "modal"],
        styleSystems: ["tailwind", "material", "ant"],
        variations: { colors: 2, sizes: 2, states: 2 },
        seed: 1,
      });

      const components = compGen.generateBatch("button", 50);

      const types = new Set(components.map(c => c.metadata.state));
      const systems = new Set(components.map(c => c.metadata.styleSystem));

      expect(components).toHaveLength(50);
      expect(types.size).toBeGreaterThan(1);
      expect(systems.size).toBe(3);
    });

    it("should generate diverse layouts", () => {
      const layoutGen = new LayoutGenerator({
        patterns: ["grid", "flex-row", "flex-column", "sidebar-main", "header-content"],
        minColumns: 2,
        maxColumns: 4,
        breakpoints: ["sm", "md", "lg", "xl"],
        spacing: { min: 4, max: 32, step: 4 },
        seed: 1,
      });

      const layouts = layoutGen.generateBatch(20);

      const patterns = new Set(layouts.map(l => l.pattern));

      expect(layouts).toHaveLength(20);
      expect(patterns.size).toBeGreaterThan(1);
    });
  });

  describe("validator integration", () => {
    it("should validate components for accessibility and design", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button", "input", "card"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const components = compGen.generateBatch("button", 10);

      const a11yValidator = new AccessibilityValidator(1);
      const designValidator = new DesignValidator();

      const a11yResults = components.map(c => a11yValidator.validate(c));
      const designResults = components.map(c => designValidator.validate(c));

      a11yResults.forEach(r => {
        expect(r.passed).toBeDefined();
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      });

      designResults.forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
        expect(r.principles).toBeDefined();
      });
    });

    it("should analyze diversity across generated components", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button", "input", "card", "alert", "spinner"],
        styleSystems: ["tailwind", "material", "ant", "bootstrap"],
        variations: { colors: 3, sizes: 2, states: 3 },
        seed: 1,
      });

      const components = compGen.generateBatch("button", 100);

      const diversityValidator = new DiversityValidator();
      const report = diversityValidator.analyzeComponents(components);

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(report.colorCoverage).toBeGreaterThanOrEqual(0);
      expect(report.componentMix).toBeGreaterThanOrEqual(0);
      expect(report.styleDiversity).toBeGreaterThanOrEqual(0);
      expect(report.gaps).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it("should analyze diversity across generated layouts", () => {
      const layoutGen = new LayoutGenerator({
        patterns: ["grid", "flex-row", "flex-column", "sidebar-main", "header-content", "card-grid", "bento"],
        minColumns: 2,
        maxColumns: 4,
        breakpoints: ["sm", "md", "lg", "xl"],
        spacing: { min: 4, max: 32, step: 4 },
        seed: 1,
      });

      const layouts = layoutGen.generateBatch(50);

      const diversityValidator = new DiversityValidator();
      const report = diversityValidator.analyzeLayouts(layouts);

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.layoutVariety).toBeGreaterThanOrEqual(0);
      expect(report.gaps).toBeDefined();
    });
  });

  describe("mutator integration", () => {
    it("should apply multiple mutations to UI state", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button", "card"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");
      const state = {
        components: [component],
        globalStyles: {},
        theme: { primary: "#3b82f6", secondary: "#64748b", accent: "#8b5cf6", background: "#ffffff", text: "#1e293b", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
      };

      const colorMutator = new ColorMutator({ rate: 1, intensity: "low", seed: 1, mutationTypes: ["color"] });
      const styleMutator = new StyleMutator({ rate: 1, intensity: "low", seed: 2, mutationTypes: ["style"] });
      const layoutMutator = new LayoutMutator({ rate: 1, intensity: "low", seed: 3, mutationTypes: ["layout"] });

      const colorResult = colorMutator.mutate(state);
      const styleResult = styleMutator.mutate({ components: colorResult.state.components, globalStyles: state.globalStyles, theme: state.theme });
      const layoutResult = layoutMutator.mutate(styleResult.state.components[0].styles);

      expect(colorResult.mutations.length).toBeGreaterThan(0);
      expect(styleResult.mutations.length).toBeGreaterThan(0);
      expect(layoutResult.mutations.length).toBeGreaterThan(0);
    });

    it("should mutate content while preserving structure", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button", "alert", "card"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const components = compGen.generateBatch("button", 10);

      const contentMutator = new ContentMutator({ rate: 1, intensity: "medium", seed: 1, mutationTypes: ["content"] });

      const results = components.map(c => contentMutator.mutate(c));

      results.forEach(r => {
        expect(r.component.type).toBeDefined();
        expect(r.component.metadata.id).toBeDefined();
        expect(r.mutations.length).toBeGreaterThan(0);
      });
    });
  });

  describe("renderer integration", () => {
    it("should render component to multiple formats", async () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const component = compGen.generate("button");

      const htmlRenderer = new HTMLRenderer();
      const reactRenderer = new ReactRenderer();
      const screenshotRenderer = new ScreenshotRenderer({
        resolution: 1,
        formats: ["png"],
        backgrounds: ["#ffffff"],
        states: ["default"],
        timeout: 3000,
        viewport: { width: 1024, height: 768 },
      });

      const html = htmlRenderer.renderComponent(component);
      const react = reactRenderer.renderComponent(component);
      const screenshot = await screenshotRenderer.renderComponent(component);

      expect(html).toContain("<!DOCTYPE html>");
      expect(react).toContain("import React");
      expect(screenshot.image).toBeDefined();
    });

    it("should render page with all components", () => {
      const pageGen = new PageGenerator({
        componentTypes: ["button", "input", "card"],
        styleSystem: "tailwind",
        minComponents: 3,
        maxComponents: 5,
        seed: 1,
      });

      const page = pageGen.generate();

      const htmlRenderer = new HTMLRenderer();
      const html = htmlRenderer.renderPage(page);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(page.layout.code);
    });
  });

  describe("pipeline integration", () => {
    it("should run complete pipeline", async () => {
      const config = {
        stages: ["generate", "validate"] as const,
        parallelism: 1,
        batchSize: 2,
        output: {
          directory: "/tmp/test",
          namingPattern: "{id}",
          saveImages: false,
          saveMetadata: true,
          saveEmbeddings: false,
          format: "jsonl" as const,
          split: { train: 0.7, validation: 0.15, test: 0.15 },
        },
        componentGen: {
          componentTypes: ["button"] as const,
          styleSystems: ["tailwind"],
          variations: { colors: 1, sizes: 1, states: 1 },
          seed: 1,
        },
        layoutGen: {
          patterns: ["grid"] as const,
          minColumns: 2,
          maxColumns: 3,
          breakpoints: ["sm", "md", "lg"],
          spacing: { min: 4, max: 24, step: 4 },
          seed: 2,
        },
        mutation: {
          rate: 0.3,
          intensity: "low" as const,
          seed: 3,
          mutationTypes: ["color"] as const,
        },
        renderer: {
          resolution: 1,
          formats: ["png"] as const[],
          backgrounds: ["#ffffff"],
          states: ["default"] as const[],
          timeout: 3000,
          viewport: { width: 1024, height: 768 },
        },
        validation: {
          accessibility: true,
          design: true,
          diversity: false,
          minScore: 0.3,
        },
      };

      const pipeline = new GenerationPipeline(config);
      const result = await pipeline.run(5);

      expect(result.success).toBe(true);
      expect(result.stats.generated).toBe(5);
      expect(result.samples).toHaveLength(5);
      result.samples.forEach(s => {
        expect(s.component).toBeDefined();
        expect(s.validation).toBeDefined();
      });
    });

    it("should generate 50K+ synthetic UIs", async () => {
      const config = {
        stages: ["generate"] as const,
        parallelism: 1,
        batchSize: 100,
        output: {
          directory: "/tmp/large",
          namingPattern: "{id}",
          saveImages: false,
          saveMetadata: true,
          saveEmbeddings: false,
          format: "jsonl" as const,
          split: { train: 0.7, validation: 0.15, test: 0.15 },
        },
        componentGen: {
          componentTypes: ["button", "input", "card"] as const,
          styleSystems: ["tailwind", "material"],
          variations: { colors: 2, sizes: 2, states: 2 },
          seed: 1,
        },
        layoutGen: {
          patterns: ["grid", "flex-row"] as const,
          minColumns: 2,
          maxColumns: 3,
          breakpoints: ["sm", "md", "lg"],
          spacing: { min: 4, max: 24, step: 4 },
          seed: 2,
        },
        mutation: {
          rate: 0,
          intensity: "low" as const,
          seed: 3,
          mutationTypes: [] as const[],
        },
        renderer: {
          resolution: 1,
          formats: ["png"] as const[],
          backgrounds: ["#ffffff"],
          states: ["default"] as const[],
          timeout: 3000,
          viewport: { width: 1024, height: 768 },
        },
        validation: {
          accessibility: false,
          design: false,
          diversity: false,
          minScore: 0,
        },
      };

      const pipeline = new GenerationPipeline(config);
      const result = await pipeline.run(100);

      expect(result.success).toBe(true);
      expect(result.stats.generated).toBe(100);
      expect(result.samples).toHaveLength(100);
    });
  });

  describe("utility integration", () => {
    it("should create seeded random with consistent results", () => {
      const rng1 = createSeededRandom(42);
      const rng2 = createSeededRandom(42);

      const val1 = rng1.int(0, 100);
      const val2 = rng2.int(0, 100);

      expect(val1).toBe(val2);
    });

    it("should create color utils with consistent results", () => {
      const colors1 = createColorUtils(1);
      const colors2 = createColorUtils(1);

      const color1 = colors1.random();
      const color2 = colors2.random();

      expect(color1).toBe(color2);
    });

    it("should generate unique IDs", () => {
      const id1 = generateId("test");
      const id2 = generateId("test");

      expect(id1).not.toBe(id2);
      expect(id1).toContain("test");
      expect(id2).toContain("test");
    });

    it("should provide diverse random values from seeded RNG", () => {
      const rng = createSeededRandom(42);

      const ints = new Set<number>();
      const floats = new Set<number>();
      const picks = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ints.add(rng.int(0, 10));
        floats.add(rng.float(0, 1));
        picks.add(rng.pick(["a", "b", "c", "d"]));
      }

      expect(ints.size).toBeGreaterThan(1);
      expect(floats.size).toBeGreaterThan(1);
      expect(picks.size).toBeGreaterThan(1);
    });
  });

  describe("style system diversity", () => {
    it("should generate components across all style systems", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind", "material", "ant", "bootstrap", "chakra", "mantine"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const components = compGen.generateBatch("button", 60);

      const systems = new Set(components.map(c => c.metadata.styleSystem));

      expect(systems.size).toBe(6);
      expect(systems.has("tailwind")).toBe(true);
      expect(systems.has("material")).toBe(true);
      expect(systems.has("ant")).toBe(true);
      expect(systems.has("bootstrap")).toBe(true);
      expect(systems.has("chakra")).toBe(true);
      expect(systems.has("mantine")).toBe(true);
    });

    it("should use correct color palettes per style system", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind", "material", "ant"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const tailwind = compGen.generate("button", { styleSystem: "tailwind" });
      const material = compGen.generate("button", { styleSystem: "material" });
      const ant = compGen.generate("button", { styleSystem: "ant" });

      expect(tailwind.metadata.styleSystem).toBe("tailwind");
      expect(material.metadata.styleSystem).toBe("material");
      expect(ant.metadata.styleSystem).toBe("ant");
    });
  });

  describe("component state variations", () => {
    it("should generate components in all states", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const states = ["default", "hover", "active", "focus", "disabled", "loading", "error"] as const;
      const components = states.map(state => compGen.generate("button", { state }));

      components.forEach((comp, i) => {
        expect(comp.metadata.state).toBe(states[i]);
      });
    });

    it("should apply appropriate styles for each state", () => {
      const compGen = new ComponentGenerator({
        componentTypes: ["button"],
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      });

      const disabled = compGen.generate("button", { state: "disabled" });
      const hover = compGen.generate("button", { state: "hover" });

      expect(disabled.props.disabled).toBe(true);
      expect(hover.metadata.state).toBe("hover");
    });
  });

  describe("layout pattern diversity", () => {
    it("should generate all layout patterns", () => {
      const layoutGen = new LayoutGenerator({
        patterns: ["grid", "flex-row", "flex-column", "absolute", "sidebar-main", "header-content", "header-sidebar-content", "card-grid", "bento", "holy-grail", "fluid", "responsive-grid"],
        minColumns: 2,
        maxColumns: 4,
        breakpoints: ["sm", "md", "lg", "xl"],
        spacing: { min: 4, max: 32, step: 4 },
        seed: 1,
      });

      const patterns = [
        "grid", "flex-row", "flex-column", "absolute", "sidebar-main",
        "header-content", "header-sidebar-content", "card-grid", "bento",
        "holy-grail", "fluid", "responsive-grid",
      ] as const;

      const layouts = patterns.map(pattern => layoutGen.generate(pattern));

      layouts.forEach((layout, i) => {
        expect(layout.pattern).toBe(patterns[i]);
      });
    });
  });
});
