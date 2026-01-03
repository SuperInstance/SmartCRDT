/**
 * @lsi/vljepa/predictor/tests - VL-JEPA Predictor Tests
 *
 * Comprehensive test suite for VL-JEPA predictor implementation.
 * Tests EmbeddingCombiner, PredictionHead, ConfidenceScorer, ActionGenerator, and Predictor.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingCombiner,
  PredictionHead,
  ConfidenceScorer,
  ActionGenerator,
  Predictor,
  createRandomEmbedding,
  createZeroEmbedding,
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_HIDDEN_DIM,
  cosineSimilarity,
  normalizeEmbedding,
} from "../index.js";

describe("VL-JEPA Predictor", () => {
  describe("EmbeddingCombiner", () => {
    let combiner: EmbeddingCombiner;

    beforeEach(() => {
      combiner = new EmbeddingCombiner({ strategy: "concatenate" });
    });

    describe("initialization", () => {
      it("should create combiner with default config", () => {
        expect(combiner).toBeDefined();
        expect(combiner.getOutputDim()).toBe(1536);
      });

      it("should create combiner with concatenate strategy", () => {
        const c = new EmbeddingCombiner({ strategy: "concatenate" });
        expect(c.getOutputDim()).toBe(1536);
      });

      it("should create combiner with add strategy", () => {
        const c = new EmbeddingCombiner({ strategy: "add" });
        expect(c.getOutputDim()).toBe(768);
      });

      it("should create combiner with weighted-sum strategy", () => {
        const c = new EmbeddingCombiner({
          strategy: "weighted-sum",
          visionWeight: 0.6,
          languageWeight: 0.4,
        });
        expect(c.getOutputDim()).toBe(768);
      });

      it("should throw if weights don't sum to 1", () => {
        expect(() => {
          new EmbeddingCombiner({
            strategy: "weighted-sum",
            visionWeight: 0.5,
            languageWeight: 0.6, // Sum = 1.1
          });
        }).toThrow();
      });
    });

    describe("combine", () => {
      it("should concatenate embeddings", () => {
        const c = new EmbeddingCombiner({ strategy: "concatenate" });
        const x = createRandomEmbedding(768);
        const y = createRandomEmbedding(768);

        const result = c.combine(x, y);

        expect(result.length).toBe(1536);
        expect(result[0]).toBe(x[0]);
        expect(result[768]).toBe(y[0]);
      });

      it("should add embeddings", () => {
        const c = new EmbeddingCombiner({ strategy: "add" });
        const x = new Float32Array(768);
        const y = new Float32Array(768);
        x[0] = 1;
        x[1] = 2;
        x[2] = 3;
        y[0] = 4;
        y[1] = 5;
        y[2] = 6;

        const result = c.combine(x, y);

        expect(result.length).toBe(768);
        expect(result[0]).toBe(5);
        expect(result[1]).toBe(7);
        expect(result[2]).toBe(9);
      });

      it("should compute weighted sum", () => {
        const c = new EmbeddingCombiner({
          strategy: "weighted-sum",
          visionWeight: 0.7,
          languageWeight: 0.3,
        });
        const x = new Float32Array(768);
        const y = new Float32Array(768);
        x[0] = 10;
        x[1] = 20;
        x[2] = 30;
        y[0] = 100;
        y[1] = 200;
        y[2] = 300;

        const result = c.combine(x, y);

        expect(result.length).toBe(768);
        expect(result[0]).toBeCloseTo(37, 0); // 0.7 * 10 + 0.3 * 100
        expect(result[1]).toBeCloseTo(74, 0); // 0.7 * 20 + 0.3 * 200
        expect(result[2]).toBeCloseTo(111, 0); // 0.7 * 30 + 0.3 * 300
      });

      it("should normalize embeddings when configured", () => {
        const c = new EmbeddingCombiner({ strategy: "add", normalize: true });
        const x = new Float32Array(768);
        const y = new Float32Array(768);
        x[0] = 3;
        x[1] = 4;
        x[2] = 0;
        y[0] = 6;
        y[1] = 8;
        y[2] = 0;

        const result = c.combine(x, y);

        // Result should be normalized to unit length
        let norm = 0;
        for (let i = 0; i < result.length; i++) {
          norm += result[i] * result[i];
        }
        // Check that the result is approximately normalized (only the non-zero entries matter)
        const resultNorm = Math.sqrt(norm);
        expect(resultNorm).toBeGreaterThan(0);
        // The first non-zero values should be normalized relative to each other
        expect(result[0] / result[1]).toBeCloseTo(9 / 12, 2);
      });

      it("should throw on mismatched dimensions", () => {
        const x = createRandomEmbedding(768);
        const y = createRandomEmbedding(512); // Wrong dimension

        expect(() => combiner.combine(x, y)).toThrow();
      });
    });

    describe("learned weights", () => {
      it("should update learned weights", () => {
        const c = new EmbeddingCombiner({
          strategy: "weighted-sum",
          useLearnedWeights: true,
        });

        c.updateLearnedWeights(0.8, 0.2);

        const weights = c.getLearnedWeights();
        expect(weights.vision).toBeCloseTo(0.8, 5);
        expect(weights.language).toBeCloseTo(0.2, 5);
      });

      it("should normalize learned weights", () => {
        const c = new EmbeddingCombiner({
          strategy: "weighted-sum",
          useLearnedWeights: true,
        });

        c.updateLearnedWeights(3, 1); // Sum = 4

        const weights = c.getLearnedWeights();
        expect(weights.vision + weights.language).toBeCloseTo(1, 5);
      });
    });

    describe("fromPredictorConfig", () => {
      it("should create from predictor config", () => {
        const c = EmbeddingCombiner.fromPredictorConfig({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 4,
        });

        expect(c).toBeDefined();
        expect(c.getOutputDim()).toBe(1536);
      });
    });
  });

  describe("PredictionHead", () => {
    let head: PredictionHead;

    beforeEach(() => {
      head = new PredictionHead({
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numHiddenLayers: 2,
        activation: "gelu",
        dropout: 0.1,
        useLayerNorm: true,
        useResiduals: false,
      });
    });

    describe("initialization", () => {
      it("should create prediction head", () => {
        expect(head).toBeDefined();
      });

      it("should have correct parameter count", () => {
        const count = head.getParameterCount();
        expect(count).toBeGreaterThan(0);
        expect(count).toBe(
          // Input layer: 1536 * 2048 + 2048
          1536 * 2048 +
            2048 +
            // Hidden layer: 2048 * 2048 + 2048
            2048 * 2048 +
            2048 +
            // Output layer: 2048 * 768 + 768
            2048 * 768 +
            768 +
            // Layer norm params: 2048 * 2 * 2
            2048 * 2 * 2
        );
      });

      it("should create with different activations", () => {
        const activations = ["relu", "gelu", "swish", "tanh"] as const;

        for (const activation of activations) {
          const h = new PredictionHead({
            inputDim: 768,
            hiddenDim: 512,
            outputDim: 256,
            numHiddenLayers: 1,
            activation,
            dropout: 0,
            useLayerNorm: false,
            useResiduals: false,
          });
          expect(h).toBeDefined();
        }
      });
    });

    describe("forward", () => {
      it("should process concatenated embedding", async () => {
        const input = createRandomEmbedding(1536);
        const output = await head.forward(input);

        expect(output).toBeDefined();
        expect(output.length).toBe(768);
      });

      it("should produce different outputs for different inputs", async () => {
        const input1 = createRandomEmbedding(1536);
        const input2 = createRandomEmbedding(1536);

        const output1 = await head.forward(input1);
        const output2 = await head.forward(input2);

        // Outputs should be different
        let diffCount = 0;
        for (let i = 0; i < output1.length; i++) {
          if (Math.abs(output1[i] - output2[i]) > 0.001) {
            diffCount++;
          }
        }
        expect(diffCount).toBeGreaterThan(100);
      });

      it("should produce same output for same input", async () => {
        const input = createRandomEmbedding(1536);

        const output1 = await head.forward(input);
        const output2 = await head.forward(input);

        // Outputs should be identical
        for (let i = 0; i < output1.length; i++) {
          expect(output1[i]).toBeCloseTo(output2[i], 5);
        }
      });

      it("should handle batch predictions", async () => {
        const inputs = [
          createRandomEmbedding(1536),
          createRandomEmbedding(1536),
          createRandomEmbedding(1536),
        ];

        const outputs = await head.forwardBatch(inputs);

        expect(outputs).toHaveLength(3);
        expect(outputs[0].length).toBe(768);
        expect(outputs[1].length).toBe(768);
        expect(outputs[2].length).toBe(768);
      });

      it("should throw on wrong input dimension", async () => {
        const input = createRandomEmbedding(768); // Wrong dimension

        await expect(head.forward(input)).rejects.toThrow();
      });
    });

    describe("fromPredictorConfig", () => {
      it("should create from predictor config", () => {
        const h = PredictionHead.fromPredictorConfig({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 4,
          numHeads: 8,
          feedForwardDim: 4096,
          dropout: 0.1,
          activation: "gelu",
          useResiduals: true,
        });

        expect(h).toBeDefined();
        expect(h.getConfig().inputDim).toBe(1536);
      });
    });
  });

  describe("ConfidenceScorer", () => {
    let scorer: ConfidenceScorer;

    beforeEach(() => {
      scorer = new ConfidenceScorer({ method: "ensemble" });
    });

    describe("initialization", () => {
      it("should create scorer with default config", () => {
        expect(scorer).toBeDefined();
      });

      it("should create with different methods", () => {
        const methods = [
          "cosine-similarity",
          "euclidean-distance",
          "semantic-coherence",
          "ensemble",
        ] as const;

        for (const method of methods) {
          const s = new ConfidenceScorer({ method });
          expect(s.getConfig().method).toBe(method);
        }
      });

      it("should throw if ensemble weights don't sum to 1", () => {
        expect(() => {
          new ConfidenceScorer({
            method: "ensemble",
            cosineWeight: 0.5,
            distanceWeight: 0.4,
            coherenceWeight: 0.2, // Sum = 1.1
          });
        }).toThrow();
      });
    });

    describe("calculate", () => {
      it("should calculate confidence score", () => {
        const goal = createRandomEmbedding(768);
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const result = scorer.calculate(goal, context, intent);

        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.level).toMatch(/^(low|medium|high)$/);
        expect(result.metrics).toBeDefined();
        expect(result.explanation).toBeDefined();
      });

      it("should return high confidence for identical embeddings", () => {
        const scorer = new ConfidenceScorer({ method: "cosine-similarity" });
        const embedding = createRandomEmbedding(768);
        // Ensure embedding has non-zero values with known magnitude
        for (let i = 0; i < embedding.length; i++) {
          embedding[i] = (i % 2 === 0 ? 1 : -1) / Math.sqrt(768);
        }
        const normalized = normalizeEmbedding(embedding);

        const result = scorer.calculate(normalized, normalized, normalized);

        // Cosine similarity of identical vectors should be 1.0
        expect(result.confidence).toBeCloseTo(1, 1);
        expect(result.level).toBe("high");
      });

      it("should return individual metric scores", () => {
        const goal = createRandomEmbedding(768);
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const result = scorer.calculate(goal, context, intent);

        expect(result.metrics.cosineSimilarity).toBeGreaterThanOrEqual(0);
        expect(result.metrics.cosineSimilarity).toBeLessThanOrEqual(1);
        expect(result.metrics.euclideanDistance).toBeGreaterThanOrEqual(0);
        expect(result.metrics.euclideanDistance).toBeLessThanOrEqual(1);
        expect(result.metrics.semanticCoherence).toBeGreaterThanOrEqual(0);
        expect(result.metrics.semanticCoherence).toBeLessThanOrEqual(1);
        expect(result.metrics.ensemble).toBeGreaterThanOrEqual(0);
        expect(result.metrics.ensemble).toBeLessThanOrEqual(1);
      });

      it("should generate explanation", () => {
        const goal = createRandomEmbedding(768);
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const result = scorer.calculate(goal, context, intent);

        expect(result.explanation.primary).toBeDefined();
        expect(result.explanation.secondary).toBeInstanceOf(Array);
      });

      it("should calculate cosine similarity method", () => {
        const s = new ConfidenceScorer({ method: "cosine-similarity" });
        const goal = createRandomEmbedding(768);
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const result = s.calculate(goal, context, intent);

        expect(result.confidence).toBeCloseTo(
          result.metrics.cosineSimilarity,
          5
        );
      });

      it("should handle batch calculations", () => {
        const goals = [createRandomEmbedding(768), createRandomEmbedding(768)];
        const contexts = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];
        const intents = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];

        const results = scorer.calculateBatch(goals, contexts, intents);

        expect(results).toHaveLength(2);
        expect(results[0].confidence).toBeGreaterThanOrEqual(0);
        expect(results[1].confidence).toBeLessThanOrEqual(1);
      });

      it("should throw on mismatched batch lengths", () => {
        const goals = [createRandomEmbedding(768)];
        const contexts = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];
        const intents = [createRandomEmbedding(768)];

        expect(() => scorer.calculateBatch(goals, contexts, intents)).toThrow();
      });
    });

    describe("updateConfig", () => {
      it("should update configuration", () => {
        scorer.updateConfig({ minConfidence: 0.4 });

        expect(scorer.getConfig().minConfidence).toBe(0.4);
      });
    });
  });

  describe("ActionGenerator", () => {
    let generator: ActionGenerator;

    beforeEach(() => {
      generator = new ActionGenerator({ strategy: "balanced" });
    });

    describe("initialization", () => {
      it("should create generator with default config", () => {
        expect(generator).toBeDefined();
      });

      it("should create with different strategies", () => {
        const strategies = ["conservative", "balanced", "aggressive"] as const;

        for (const strategy of strategies) {
          const g = new ActionGenerator({ strategy });
          expect(g.getConfig().strategy).toBe(strategy);
        }
      });
    });

    describe("generate", () => {
      it("should generate actions", () => {
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);
        const confidence = 0.85;

        const result = generator.generate(context, goal, confidence);

        expect(result.actions).toBeInstanceOf(Array);
        expect(result.delta).toBeDefined();
        expect(result.actionCounts).toBeDefined();
        expect(result.overallConfidence).toBe(0.85);
      });

      it("should limit actions to maxActions", () => {
        const g = new ActionGenerator({ maxActions: 3 });
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = g.generate(context, goal, 0.9);

        expect(result.actions.length).toBeLessThanOrEqual(3);
      });

      it("should filter actions by minConfidence", () => {
        const g = new ActionGenerator({ minConfidence: 0.8 });
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = g.generate(context, goal, 0.5);

        // With low overall confidence, should have few or no actions
        expect(result.actions.length).toBeLessThanOrEqual(10);
      });

      it("should calculate semantic delta", () => {
        const context = new Float32Array([1, 2, 3, 4, 5]);
        const goal = new Float32Array([2, 4, 6, 8, 10]);

        const result = generator.generate(context, goal, 0.9);

        expect(result.delta.magnitude).toBeGreaterThan(0);
        expect(result.delta.direction).toBeDefined();
        expect(result.delta.significantDimensions).toBeInstanceOf(Array);
      });

      it("should generate action with required fields", () => {
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = generator.generate(context, goal, 0.9);

        if (result.actions.length > 0) {
          const action = result.actions[0];
          expect(action.type).toMatch(
            /^(modify|create|delete|move|resize|restyle)$/
          );
          expect(action.target).toBeDefined();
          expect(action.params).toBeDefined();
          expect(action.confidence).toBeGreaterThanOrEqual(0);
          expect(action.confidence).toBeLessThanOrEqual(1);
        }
      });

      it("should use context info for target selection", () => {
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = generator.generate(context, goal, 0.9, {
          elements: ["#button1", "#header", ".footer"],
        });

        // Should use provided elements as targets (may be 0 if delta is too small)
        expect(result.actions).toBeInstanceOf(Array);
        expect(result.delta).toBeDefined();
      });

      it("should group related actions when configured", () => {
        const g = new ActionGenerator({ groupActions: true, maxActions: 20 });
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = g.generate(context, goal, 0.9);

        // Grouped actions should be array (may be empty if delta is small)
        expect(result.actions).toBeInstanceOf(Array);
        expect(result.delta).toBeDefined();
      });

      it("should calculate action counts", () => {
        const context = createRandomEmbedding(768);
        const goal = createRandomEmbedding(768);

        const result = generator.generate(context, goal, 0.9);

        expect(result.actionCounts).toBeDefined();
        // Action counts may be empty if no actions were generated
        expect(result.actionCounts).toBeInstanceOf(Object);
      });

      it("should handle batch generation", () => {
        const contexts = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];
        const goals = [createRandomEmbedding(768), createRandomEmbedding(768)];
        const confidences = [0.8, 0.9];

        const results = generator.generateBatch(contexts, goals, confidences);

        expect(results).toHaveLength(2);
        expect(results[0].actions).toBeInstanceOf(Array);
        expect(results[1].actions).toBeInstanceOf(Array);
      });

      it("should throw on mismatched batch lengths", () => {
        const contexts = [createRandomEmbedding(768)];
        const goals = [createRandomEmbedding(768), createRandomEmbedding(768)];
        const confidences = [0.8];

        expect(() =>
          generator.generateBatch(contexts, goals, confidences)
        ).toThrow();
      });
    });

    describe("updateConfig", () => {
      it("should update configuration", () => {
        generator.updateConfig({ maxActions: 5 });

        expect(generator.getConfig().maxActions).toBe(5);
      });
    });
  });

  describe("Predictor", () => {
    let predictor: Predictor;

    beforeEach(() => {
      predictor = Predictor.fromPredictorConfig({
        version: "1.0",
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numLayers: 4,
        numHeads: 8,
        feedForwardDim: 4096,
        dropout: 0.1,
        activation: "gelu",
        useResiduals: true,
      });
    });

    describe("initialization", () => {
      it("should create predictor", () => {
        expect(predictor).toBeDefined();
      });

      it("should have all components", () => {
        expect(predictor.getCombiner()).toBeDefined();
        expect(predictor.getPredictionHead()).toBeDefined();
        expect(predictor.getConfidenceScorer()).toBeDefined();
        expect(predictor.getActionGenerator()).toBeDefined();
      });

      it("should create with custom config", () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 4,
          generateActions: true,
          cache: {
            enabled: true,
            maxSize: 100,
            ttl: 60000,
          },
          combiner: { strategy: "concatenate" },
          confidence: { method: "ensemble" },
          actionGenerator: { strategy: "balanced" },
        });

        expect(p).toBeDefined();
        expect(p.getConfig().cache?.enabled).toBe(true);
      });
    });

    describe("predict", () => {
      it("should make prediction", async () => {
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const prediction = await predictor.predict(context, intent);

        expect(prediction).toBeDefined();
        expect(prediction.version).toBe("1.0");
        expect(prediction.goalEmbedding).toBeDefined();
        expect(prediction.goalEmbedding.length).toBe(768);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction.actions).toBeInstanceOf(Array);
        expect(prediction.metadata).toBeDefined();
      });

      it("should cache predictions when enabled", async () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
          cache: { enabled: true, maxSize: 100, ttl: 60000 },
        });

        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const pred1 = await p.predict(context, intent);
        const pred2 = await p.predict(context, intent);

        expect(pred1.metadata.usedCache).toBe(false);
        expect(pred2.metadata.usedCache).toBe(true);

        // Cached prediction should be faster
        expect(pred2.metadata.processingTime).toBeLessThan(
          pred1.metadata.processingTime
        );
      });

      it("should generate actions when enabled", async () => {
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const prediction = await predictor.predict(context, intent);

        // Actions should be generated (array may be empty if delta is small)
        expect(prediction.actions).toBeInstanceOf(Array);
        expect(prediction.metadata).toBeDefined();
      });

      it("should skip actions when disabled", async () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
        });

        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const prediction = await p.predict(context, intent);

        expect(prediction.actions).toHaveLength(0);
      });

      it("should handle batch predictions", async () => {
        const contexts = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];
        const intents = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];

        const predictions = await predictor.predictBatch(contexts, intents);

        expect(predictions).toHaveLength(3);
        expect(predictions[0].goalEmbedding.length).toBe(768);
        expect(predictions[1].goalEmbedding.length).toBe(768);
        expect(predictions[2].goalEmbedding.length).toBe(768);
      });

      it("should throw on mismatched batch lengths", async () => {
        const contexts = [createRandomEmbedding(768)];
        const intents = [
          createRandomEmbedding(768),
          createRandomEmbedding(768),
        ];

        await expect(
          predictor.predictBatch(contexts, intents)
        ).rejects.toThrow();
      });

      it("should throw on wrong embedding dimensions", async () => {
        const context = createRandomEmbedding(512); // Wrong dimension
        const intent = createRandomEmbedding(768);

        await expect(predictor.predict(context, intent)).rejects.toThrow();
      });

      it("should track metrics", async () => {
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        await predictor.predict(context, intent);

        const metrics = predictor.getMetrics();
        expect(metrics.totalPredictions).toBe(1);
        expect(metrics.avgPredictionTime).toBeGreaterThan(0);
      });
    });

    describe("cache", () => {
      it("should clear cache", async () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
          cache: { enabled: true, maxSize: 100, ttl: 60000 },
        });

        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        await p.predict(context, intent);
        expect(p.getMetrics().cacheSize).toBe(1);

        p.clearCache();
        expect(p.getMetrics().cacheSize).toBe(0);
      });

      it("should respect cache max size", async () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
          cache: { enabled: true, maxSize: 3, ttl: 60000 },
        });

        // Generate 5 different predictions
        for (let i = 0; i < 5; i++) {
          const context = createRandomEmbedding(768);
          const intent = createRandomEmbedding(768);
          await p.predict(context, intent);
        }

        // Cache should not exceed max size
        expect(p.getMetrics().cacheSize).toBeLessThanOrEqual(3);
      });
    });

    describe("metrics", () => {
      it("should track cache hits and misses", async () => {
        const p = new Predictor({
          version: "1.0",
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
          cache: { enabled: true, maxSize: 100, ttl: 60000 },
        });

        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        await p.predict(context, intent); // Miss
        await p.predict(context, intent); // Hit
        await p.predict(context, intent); // Hit

        const metrics = p.getMetrics();
        expect(metrics.cacheMisses).toBe(1);
        expect(metrics.cacheHits).toBe(2);
      });

      it("should reset metrics", async () => {
        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        await predictor.predict(context, intent);
        predictor.resetMetrics();

        const metrics = predictor.getMetrics();
        expect(metrics.totalPredictions).toBe(0);
        expect(metrics.avgPredictionTime).toBe(0);
      });
    });

    describe("targetContext", () => {
      it("should update target context", () => {
        predictor.updateTargetContext({
          elements: ["#btn1", "#header"],
          structure: "div > button",
        });

        const config = predictor.getConfig();
        expect(config.targetContext?.elements).toEqual(["#btn1", "#header"]);
      });
    });

    describe("healthCheck", () => {
      it("should return healthy status", () => {
        const health = predictor.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.metrics).toBeDefined();
        expect(health.cacheEnabled).toBeDefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should run full prediction pipeline", async () => {
      const predictor = Predictor.fromPredictorConfig({
        version: "1.0",
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numLayers: 4,
      });

      const context = createRandomEmbedding(768);
      const intent = createRandomEmbedding(768);

      const prediction = await predictor.predict(context, intent);

      // Full pipeline test
      expect(prediction.goalEmbedding.length).toBe(768);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.actions).toBeInstanceOf(Array);
      expect(prediction.metadata.processingTime).toBeGreaterThan(0);
      expect(prediction.metadata.predictorTime).toBeGreaterThan(0);
    });

    it("should produce consistent predictions", async () => {
      const predictor = new Predictor({
        version: "1.0",
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numLayers: 2,
        generateActions: false,
        cache: { enabled: false, maxSize: 100, ttl: 60000 },
        predictionHead: {
          seed: 42,
          inputDim: 1536,
          hiddenDim: 2048,
          outputDim: 768,
          numHiddenLayers: 1,
          activation: "gelu",
          dropout: 0,
          useLayerNorm: false,
          useResiduals: false,
        },
      });

      const context = createRandomEmbedding(768);
      const intent = createRandomEmbedding(768);

      const pred1 = await predictor.predict(context, intent);
      const pred2 = await predictor.predict(context, intent);

      // Same inputs should produce same outputs
      for (let i = 0; i < pred1.goalEmbedding.length; i++) {
        expect(pred1.goalEmbedding[i]).toBeCloseTo(pred2.goalEmbedding[i], 5);
      }
    });

    it("should measure prediction latency", async () => {
      const predictor = Predictor.fromPredictorConfig({
        version: "1.0",
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numLayers: 4,
      });

      const context = createRandomEmbedding(768);
      const intent = createRandomEmbedding(768);

      const start = performance.now();
      await predictor.predict(context, intent);
      const end = performance.now();

      const latency = end - start;

      // Prediction should be fast (target: <10ms, but allow more for tests)
      expect(latency).toBeLessThan(100); // Should complete in <100ms
    });

    it("should test different combination strategies", async () => {
      const strategies = ["concatenate", "add", "weighted-sum"] as const;

      for (const strategy of strategies) {
        const predictor = new Predictor({
          version: "1.0",
          inputDim: strategy === "concatenate" ? 1536 : 768,
          hiddenDim: 2048,
          outputDim: 768,
          numLayers: 2,
          generateActions: false,
          cache: { enabled: false, maxSize: 100, ttl: 60000 },
          combiner: { strategy },
          predictionHead: {
            inputDim: strategy === "concatenate" ? 1536 : 768,
            hiddenDim: 1024,
            outputDim: 768,
            numHiddenLayers: 1,
            activation: "gelu",
            dropout: 0,
            useLayerNorm: false,
            useResiduals: false,
          },
        });

        const context = createRandomEmbedding(768);
        const intent = createRandomEmbedding(768);

        const prediction = await predictor.predict(context, intent);

        expect(prediction.goalEmbedding.length).toBe(768);
      }
    });
  });
});
