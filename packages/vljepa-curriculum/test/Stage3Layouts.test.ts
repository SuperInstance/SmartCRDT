/**
 * Tests for Stage3Layouts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Stage3Layouts } from "../src/stages/Stage3Layouts.js";

describe("Stage3Layouts", () => {
  let stage3: Stage3Layouts;

  beforeEach(() => {
    stage3 = new Stage3Layouts();
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const config = stage3.getConfig();
      expect(config.examples).toBe(20000);
      expect(config.epochs).toBe(20);
      expect(config.masteryThreshold).toBe(0.80);
      expect(config.difficulty).toBe("medium");
      expect(config.responsive).toBe(true);
    });

    it("should initialize with custom config", () => {
      const custom = new Stage3Layouts({ examples: 5000, epochs: 10, responsive: false });
      const config = custom.getConfig();
      expect(config.examples).toBe(5000);
      expect(config.epochs).toBe(10);
      expect(config.responsive).toBe(false);
    });

    it("should have all layout patterns", async () => {
      await stage3.initialize();
      const config = stage3.getConfig();
      expect(config.layouts.length).toBe(8);
    });

    it("should have complexity levels", () => {
      const config = stage3.getConfig();
      expect(config.complexity).toContain("simple");
      expect(config.complexity).toContain("moderate");
      expect(config.complexity).toContain("complex");
    });
  });

  describe("Layout Generation", () => {
    it("should generate flex_row layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const flexRows = examples.filter(e => e.layout === "flex_row");
      expect(flexRows.length).toBeGreaterThan(0);
    });

    it("should generate flex_column layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const flexCols = examples.filter(e => e.layout === "flex_column");
      expect(flexCols.length).toBeGreaterThan(0);
    });

    it("should generate grid layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const grids = examples.filter(e => e.layout === "grid");
      expect(grids.length).toBeGreaterThan(0);
    });

    it("should generate sidebar layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const sidebars = examples.filter(e => e.layout === "sidebar");
      expect(sidebars.length).toBeGreaterThan(0);
    });

    it("should generate navbar layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const navbars = examples.filter(e => e.layout === "navbar");
      expect(navbars.length).toBeGreaterThan(0);
    });

    it("should generate hero layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const heroes = examples.filter(e => e.layout === "hero");
      expect(heroes.length).toBeGreaterThan(0);
    });

    it("should generate absolute layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const absolutes = examples.filter(e => e.layout === "absolute");
      expect(absolutes.length).toBeGreaterThan(0);
    });

    it("should generate stack layouts", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const stacks = examples.filter(e => e.layout === "stack");
      expect(stacks.length).toBeGreaterThan(0);
    });
  });

  describe("Component Placement", () => {
    it("should place multiple components", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        expect(example.components.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should have valid positions", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        for (const comp of example.components) {
          expect(comp.position.x).toBeGreaterThanOrEqual(0);
          expect(comp.position.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should have valid sizes", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        for (const comp of example.components) {
          expect(comp.size.width).toBeGreaterThan(0);
          expect(comp.size.height).toBeGreaterThan(0);
        }
      }
    });

    it("should have z-order", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        for (const comp of example.components) {
          expect(typeof comp.zOrder).toBe("number");
        }
      }
    });
  });

  describe("Spatial Relations", () => {
    it("should generate spatial relations", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        expect(example.spatial.relations.length).toBeGreaterThan(0);
      }
    });

    it("should have valid relation types", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      const validRelations = ["above", "below", "left_of", "right_of", "contains", "overlaps", "aligned"];

      for (const example of examples) {
        for (const rel of example.spatial.relations) {
          expect(validRelations).toContain(rel.relation);
        }
      }
    });

    it("should have distances", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        for (const rel of example.spatial.relations) {
          expect(rel.distance).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should have hierarchy", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        expect(example.spatial.hierarchy).toBeDefined();
        expect(example.spatial.hierarchy.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Example Properties", () => {
    it("should generate valid image data", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(5);
      for (const example of examples) {
        expect(example.imageData.width).toBe(400);
        expect(example.imageData.height).toBe(300);
        expect(example.imageData.channels).toBe(3);
      }
    });

    it("should generate 768-dim embeddings", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(5);
      for (const example of examples) {
        expect(example.embedding.length).toBe(768);
      }
    });

    it("should have difficulty in range 0.5-0.75", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      for (const example of examples) {
        expect(example.difficulty).toBeGreaterThanOrEqual(0.5);
        expect(example.difficulty).toBeLessThanOrEqual(0.75);
      }
    });

    it("should include complexity in metadata", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(10);
      for (const example of examples) {
        expect(example.metadata.attributes.complexity).toBeDefined();
      }
    });
  });

  describe("Responsive Variants", () => {
    it("should include responsive variants when enabled", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(20);
      const withResponsive = examples.filter(e => e.responsive);

      expect(withResponsive.length).toBeGreaterThan(0);
    });

    it("should have mobile variant", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const withResponsive = examples.filter(e => e.responsive);

      if (withResponsive.length > 0) {
        expect(withResponsive[0].responsive!.mobile).toBeDefined();
      }
    });

    it("should have tablet variant", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const withResponsive = examples.filter(e => e.responsive);

      if (withResponsive.length > 0) {
        expect(withResponsive[0].responsive!.tablet).toBeDefined();
      }
    });

    it("should have desktop variant", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const withResponsive = examples.filter(e => e.responsive);

      if (withResponsive.length > 0) {
        expect(withResponsive[0].responsive!.desktop).toBeDefined();
      }
    });

    it("should not include responsive when disabled", async () => {
      const stage = new Stage3Layouts({ responsive: false });
      await stage.initialize();
      const examples = await stage.generateExamples(20);

      const withResponsive = examples.filter(e => e.responsive);
      expect(withResponsive.length).toBe(0);
    });
  });

  describe("Complexity Levels", () => {
    it("should generate simple layouts with few components", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const simple = examples.filter(e => e.metadata.attributes.complexity === "simple");

      if (simple.length > 0) {
        for (const ex of simple) {
          expect(ex.components.length).toBeLessThanOrEqual(4);
        }
      }
    });

    it("should generate moderate layouts with medium components", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const moderate = examples.filter(e => e.metadata.attributes.complexity === "moderate");

      if (moderate.length > 0) {
        for (const ex of moderate) {
          expect(ex.components.length).toBeGreaterThanOrEqual(4);
          expect(ex.components.length).toBeLessThanOrEqual(7);
        }
      }
    });

    it("should generate complex layouts with many components", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(50);
      const complex = examples.filter(e => e.metadata.attributes.complexity === "complex");

      if (complex.length > 0) {
        for (const ex of complex) {
          expect(ex.components.length).toBeGreaterThanOrEqual(7);
        }
      }
    });
  });

  describe("Evaluation", () => {
    it("should evaluate predictions correctly", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(5);
      const predictions = examples.map(e => e.embedding);

      for (let i = 0; i < examples.length; i++) {
        const result = stage3.evaluate(examples[i], predictions[i]);
        expect(result.loss).toBeCloseTo(0, 5);
        expect(result.accuracy).toBeGreaterThan(0);
      }
    });

    it("should calculate spatial accuracy metric", async () => {
      await stage3.initialize();
      const example = (await stage3.generateExamples(1))[0];
      const result = stage3.evaluate(example, example.embedding);

      expect(result.metrics.spatial_accuracy).toBeDefined();
    });

    it("should calculate layout recognition metric", async () => {
      await stage3.initialize();
      const example = (await stage3.generateExamples(1))[0];
      const result = stage3.evaluate(example, example.embedding);

      expect(result.metrics.layout_recognition).toBeDefined();
    });
  });

  describe("Mastery Assessment", () => {
    it("should recognize mastered stage", () => {
      const progress = {
        stage: 2,
        stageId: "stage3_layouts",
        epochs: 20,
        examples: 20000,
        loss: 0.15,
        accuracy: 0.85,
        mastery: 0.82,
        status: "in_progress" as const,
      };

      expect(stage3.isMastered(progress)).toBe(true);
    });

    it("should not master low mastery stage", () => {
      const progress = {
        stage: 2,
        stageId: "stage3_layouts",
        epochs: 20,
        examples: 20000,
        loss: 0.30,
        accuracy: 0.65,
        mastery: 0.70,
        status: "in_progress" as const,
      };

      expect(stage3.isMastered(progress)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero examples", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(0);
      expect(examples.length).toBe(0);
    });

    it("should handle single component layout", async () => {
      await stage3.initialize();
      const examples = await stage3.generateExamples(100);
      const singleComponent = examples.find(e => e.components.length === 2);
      expect(singleComponent).toBeDefined();
    });
  });
});

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
