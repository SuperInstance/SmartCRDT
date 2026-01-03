/**
 * Tests for Stage1Basic
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Stage1Basic } from "../src/stages/Stage1Basic.js";

describe("Stage1Basic", () => {
  let stage1: Stage1Basic;

  beforeEach(() => {
    stage1 = new Stage1Basic();
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const config = stage1.getConfig();
      expect(config.examples).toBe(5000);
      expect(config.epochs).toBe(10);
      expect(config.masteryThreshold).toBe(0.90);
      expect(config.difficulty).toBe("very_easy");
    });

    it("should initialize with custom config", () => {
      const custom = new Stage1Basic({ examples: 1000, epochs: 5 });
      const config = custom.getConfig();
      expect(config.examples).toBe(1000);
      expect(config.epochs).toBe(5);
    });

    it("should have default concepts", async () => {
      await stage1.initialize();
      const config = stage1.getConfig();
      expect(config.concepts.length).toBeGreaterThan(0);
    });
  });

  describe("Concept Generation", () => {
    it("should generate shape concepts", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      const shapeExamples = examples.filter(e => e.concept.type === "shape");
      expect(shapeExamples.length).toBeGreaterThan(0);
    });

    it("should generate color concepts", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      const colorExamples = examples.filter(e => e.concept.type === "color");
      expect(colorExamples.length).toBeGreaterThan(0);
    });

    it("should generate typography concepts", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      const typoExamples = examples.filter(e => e.concept.type === "typography");
      expect(typoExamples.length).toBeGreaterThan(0);
    });

    it("should generate pattern concepts", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      const patternExamples = examples.filter(e => e.concept.type === "pattern");
      expect(patternExamples.length).toBeGreaterThan(0);
    });
  });

  describe("Example Properties", () => {
    it("should generate valid image data", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(5);
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
      await stage1.initialize();
      const examples = await stage1.generateExamples(5);
      for (const example of examples) {
        expect(example.embedding.length).toBe(768);
      }
    });

    it("should have difficulty in range 0-0.25", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(50);
      for (const example of examples) {
        expect(example.difficulty).toBeGreaterThanOrEqual(0);
        expect(example.difficulty).toBeLessThanOrEqual(0.25);
      }
    });

    it("should have valid labels", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      for (const example of examples) {
        expect(example.metadata.labels.length).toBeGreaterThan(0);
        expect(example.metadata.labels.every(l => typeof l === "string")).toBe(true);
      }
    });

    it("should have unique IDs", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(100);
      const ids = new Set(examples.map(e => e.id));
      expect(ids.size).toBe(100);
    });
  });

  describe("Embedding Properties", () => {
    it("should generate normalized embeddings", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(10);
      for (const example of examples) {
        let sumSquares = 0;
        for (let i = 0; i < example.embedding.length; i++) {
          sumSquares += example.embedding[i] * example.embedding[i];
        }
        const norm = Math.sqrt(sumSquares);
        expect(norm).toBeCloseTo(1.0, 5);
      }
    });

    it("should generate different embeddings for different concepts", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(50);
      const similarities: number[] = [];

      for (let i = 0; i < examples.length - 1; i++) {
        for (let j = i + 1; j < examples.length; j++) {
          const sim = cosineSimilarity(examples[i].embedding, examples[j].embedding);
          similarities.push(sim);
        }
      }

      // Average similarity should be less than 0.9 (different concepts)
      const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      expect(avgSim).toBeLessThan(0.9);
    });
  });

  describe("Evaluation", () => {
    it("should evaluate predictions correctly", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(5);
      const predictions = examples.map(e => e.embedding); // Perfect prediction

      for (let i = 0; i < examples.length; i++) {
        const result = stage1.evaluate(examples[i], predictions[i]);
        expect(result.loss).toBeCloseTo(0, 5);
        expect(result.accuracy).toBeCloseTo(1, 5);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it("should calculate higher loss for different embeddings", async () => {
      await stage1.initialize();
      const example = (await stage1.generateExamples(1))[0];
      const wrongPrediction = new Float32Array(768).fill(0.1);

      const result = stage1.evaluate(example, wrongPrediction);
      expect(result.loss).toBeGreaterThan(0);
      expect(result.accuracy).toBeLessThan(1);
    });
  });

  describe("Mastery Assessment", () => {
    it("should recognize mastered stage", () => {
      const progress = {
        stage: 0,
        stageId: "stage1_basic",
        epochs: 10,
        examples: 5000,
        loss: 0.05,
        accuracy: 0.95,
        mastery: 0.92,
        status: "in_progress" as const,
      };

      expect(stage1.isMastered(progress)).toBe(true);
    });

    it("should not master low mastery stage", () => {
      const progress = {
        stage: 0,
        stageId: "stage1_basic",
        epochs: 10,
        examples: 5000,
        loss: 0.2,
        accuracy: 0.7,
        mastery: 0.75,
        status: "in_progress" as const,
      };

      expect(stage1.isMastered(progress)).toBe(false);
    });

    it("should not master high loss stage", () => {
      const progress = {
        stage: 0,
        stageId: "stage1_basic",
        epochs: 10,
        examples: 5000,
        loss: 0.15,
        accuracy: 0.9,
        mastery: 0.91,
        status: "in_progress" as const,
      };

      expect(stage1.isMastered(progress)).toBe(false);
    });
  });

  describe("Progress Tracking", () => {
    it("should track generation progress", async () => {
      await stage1.initialize();
      const progress1 = stage1.getGeneratorProgress();
      expect(progress1.generated).toBe(0);
      expect(progress1.complete).toBe(false);

      await stage1.generateExamples(100);

      const progress2 = stage1.getGeneratorProgress();
      expect(progress2.generated).toBe(100);
    });

    it("should mark complete when target reached", async () => {
      const stage = new Stage1Basic({ examples: 50 });
      await stage.initialize();
      await stage.generateExamples(50);

      const progress = stage.getGeneratorProgress();
      expect(progress.complete).toBe(true);
    });
  });

  describe("Concept Variations", () => {
    it("should include variations for each concept", async () => {
      await stage1.initialize();
      const config = stage1.getConfig();

      for (const concept of config.concepts) {
        expect(concept.variations.length).toBeGreaterThan(0);
        expect(concept.labels.length).toBeGreaterThan(0);
      }
    });

    it("should sample variations with weights", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(100);
      const concepts = new Map<string, number>();

      for (const example of examples) {
        const key = example.concept.name;
        concepts.set(key, (concepts.get(key) || 0) + 1);
      }

      // All concepts should be represented
      expect(concepts.size).toBeGreaterThan(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero examples", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(0);
      expect(examples.length).toBe(0);
    });

    it("should handle single example", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(1);
      expect(examples.length).toBe(1);
      expect(examples[0].id).toBeDefined();
    });

    it("should handle large batch", async () => {
      await stage1.initialize();
      const examples = await stage1.generateExamples(1000);
      expect(examples.length).toBe(1000);
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
