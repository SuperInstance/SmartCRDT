/**
 * Tests for Stage2Components
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Stage2Components } from "../src/stages/Stage2Components.js";

describe("Stage2Components", () => {
  let stage2: Stage2Components;

  beforeEach(() => {
    stage2 = new Stage2Components();
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const config = stage2.getConfig();
      expect(config.examples).toBe(15000);
      expect(config.epochs).toBe(15);
      expect(config.masteryThreshold).toBe(0.85);
      expect(config.difficulty).toBe("easy");
    });

    it("should initialize with custom config", () => {
      const custom = new Stage2Components({ examples: 5000, epochs: 10 });
      const config = custom.getConfig();
      expect(config.examples).toBe(5000);
      expect(config.epochs).toBe(10);
    });

    it("should have all component types", async () => {
      await stage2.initialize();
      const config = stage2.getConfig();
      expect(config.components.length).toBe(10);
    });

    it("should have all UI states", () => {
      const config = stage2.getConfig();
      expect(config.states).toContain("default");
      expect(config.states).toContain("hover");
      expect(config.states).toContain("active");
      expect(config.states).toContain("disabled");
      expect(config.states).toContain("focus");
    });
  });

  describe("Component Generation", () => {
    it("should generate button components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const buttons = examples.filter(e => e.component === "button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("should generate input components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const inputs = examples.filter(e => e.component === "input");
      expect(inputs.length).toBeGreaterThan(0);
    });

    it("should generate card components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const cards = examples.filter(e => e.component === "card");
      expect(cards.length).toBeGreaterThan(0);
    });

    it("should generate checkbox components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const checkboxes = examples.filter(e => e.component === "checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("should generate modal components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const modals = examples.filter(e => e.component === "modal");
      expect(modals.length).toBeGreaterThan(0);
    });
  });

  describe("State Generation", () => {
    it("should generate default state components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const defaultState = examples.filter(e => e.state === "default");
      expect(defaultState.length).toBeGreaterThan(0);
    });

    it("should generate hover state components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const hoverState = examples.filter(e => e.state === "hover");
      expect(hoverState.length).toBeGreaterThan(0);
    });

    it("should generate active state components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const activeState = examples.filter(e => e.state === "active");
      expect(activeState.length).toBeGreaterThan(0);
    });

    it("should generate disabled state components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const disabledState = examples.filter(e => e.state === "disabled");
      expect(disabledState.length).toBeGreaterThan(0);
    });

    it("should generate focus state components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const focusState = examples.filter(e => e.state === "focus");
      expect(focusState.length).toBeGreaterThan(0);
    });
  });

  describe("Example Properties", () => {
    it("should generate valid image data", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(10);
      for (const example of examples) {
        expect(example.imageData.width).toBeGreaterThan(0);
        expect(example.imageData.height).toBeGreaterThan(0);
        expect(example.imageData.channels).toBe(3);
        expect(example.imageData.data.length).toBe(
          example.imageData.width * example.imageData.height * example.imageData.channels
        );
      }
    });

    it("should generate 768-dim embeddings", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(10);
      for (const example of examples) {
        expect(example.embedding.length).toBe(768);
      }
    });

    it("should have difficulty in range 0.25-0.5", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(50);
      for (const example of examples) {
        expect(example.difficulty).toBeGreaterThanOrEqual(0.25);
        expect(example.difficulty).toBeLessThanOrEqual(0.5);
      }
    });

    it("should have valid attributes", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(10);
      for (const example of examples) {
        expect(example.attributes).toBeDefined();
        expect(example.attributes.size).toBeDefined();
        expect(example.attributes.variant).toBeDefined();
      }
    });
  });

  describe("Component Attributes", () => {
    it("should generate different sizes", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const sizes = new Set(examples.map(e => e.attributes.size));
      expect(sizes.size).toBeGreaterThan(1);
    });

    it("should generate different variants", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(100);
      const variants = new Set(examples.map(e => e.attributes.variant));
      expect(variants.size).toBeGreaterThan(1);
    });

    it("should include icon attribute", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(50);
      const withIcon = examples.filter(e => e.attributes.icon);
      expect(withIcon.length).toBeGreaterThan(0);
    });

    it("should include disabled attribute", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(50);
      const disabled = examples.filter(e => e.attributes.disabled);
      expect(disabled.length).toBeGreaterThan(0);
    });
  });

  describe("Embedding Properties", () => {
    it("should generate normalized embeddings", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(10);
      for (const example of examples) {
        let sumSquares = 0;
        for (let i = 0; i < example.embedding.length; i++) {
          sumSquares += example.embedding[i] * example.embedding[i];
        }
        const norm = Math.sqrt(sumSquares);
        expect(norm).toBeCloseTo(1.0, 5);
      }
    });

    it("should generate different embeddings for different components", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(50);

      const buttons = examples.filter(e => e.component === "button");
      const inputs = examples.filter(e => e.component === "input");

      if (buttons.length > 0 && inputs.length > 0) {
        const sim = cosineSimilarity(buttons[0].embedding, inputs[0].embedding);
        expect(sim).toBeLessThan(1.0);
      }
    });

    it("should generate similar embeddings for same component different states", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(200);

      const defaultButton = examples.find(e => e.component === "button" && e.state === "default");
      const hoverButton = examples.find(e => e.component === "button" && e.state === "hover");

      if (defaultButton && hoverButton) {
        const sim = cosineSimilarity(defaultButton.embedding, hoverButton.embedding);
        expect(sim).toBeGreaterThan(0.7);
      }
    });
  });

  describe("Evaluation", () => {
    it("should evaluate predictions correctly", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(5);
      const predictions = examples.map(e => e.embedding);

      for (let i = 0; i < examples.length; i++) {
        const result = stage2.evaluate(examples[i], predictions[i]);
        expect(result.loss).toBeCloseTo(0, 5);
        expect(result.accuracy).toBeCloseTo(1, 5);
      }
    });

    it("should calculate component recognition metric", async () => {
      await stage2.initialize();
      const example = (await stage2.generateExamples(1))[0];
      const result = stage2.evaluate(example, example.embedding);

      expect(result.metrics.component_recognition).toBeDefined();
      expect(result.metrics.component_recognition).toBeCloseTo(1, 1);
    });

    it("should calculate state recognition metric", async () => {
      await stage2.initialize();
      const example = (await stage2.generateExamples(1))[0];
      const result = stage2.evaluate(example, example.embedding);

      expect(result.metrics.state_recognition).toBeDefined();
    });
  });

  describe("Mastery Assessment", () => {
    it("should recognize mastered stage", () => {
      const progress = {
        stage: 1,
        stageId: "stage2_components",
        epochs: 15,
        examples: 15000,
        loss: 0.10,
        accuracy: 0.90,
        mastery: 0.87,
        status: "in_progress" as const,
      };

      expect(stage2.isMastered(progress)).toBe(true);
    });

    it("should not master low mastery stage", () => {
      const progress = {
        stage: 1,
        stageId: "stage2_components",
        epochs: 15,
        examples: 15000,
        loss: 0.25,
        accuracy: 0.70,
        mastery: 0.75,
        status: "in_progress" as const,
      };

      expect(stage2.isMastered(progress)).toBe(false);
    });
  });

  describe("Progress Tracking", () => {
    it("should track generation progress", async () => {
      await stage2.initialize();
      const progress1 = stage2.getGeneratorProgress();
      expect(progress1.generated).toBe(0);

      await stage2.generateExamples(100);

      const progress2 = stage2.getGeneratorProgress();
      expect(progress2.generated).toBe(100);
    });
  });

  describe("Complexity Distribution", () => {
    it("should distribute components evenly", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(1000);
      const counts: Record<string, number> = {};

      for (const example of examples) {
        counts[example.component] = (counts[example.component] || 0) + 1;
      }

      // All components should appear
      expect(Object.keys(counts).length).toBe(10);

      // Distribution should be roughly even (each between 5% and 15%)
      for (const count of Object.values(counts)) {
        const ratio = count / examples.length;
        expect(ratio).toBeGreaterThan(0.05);
        expect(ratio).toBeLessThan(0.15);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero examples", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(0);
      expect(examples.length).toBe(0);
    });

    it("should handle large batch", async () => {
      await stage2.initialize();
      const examples = await stage2.generateExamples(500);
      expect(examples.length).toBe(500);
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
