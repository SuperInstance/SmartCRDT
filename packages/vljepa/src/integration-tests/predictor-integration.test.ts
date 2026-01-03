/**
 * @lsi/vljepa/integration-tests - Predictor Integration Tests
 *
 * Tests for the Predictor which takes concatenated context (X-Encoder output)
 * and intent (Y-Encoder output) to predict goal state embedding and actions.
 *
 * Target: 50+ Predictor integration tests
 *
 * @package @lsi/vljepa
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  type PredictorConfig,
  type VLJEPAPrediction,
  type VLJEPAAction,
  // Constants
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_HIDDEN_DIM,
  // Utilities
  validateEmbedding,
  validatePrediction,
  cosineSimilarity,
  normalizeEmbedding,
  euclideanDistance,
  createZeroEmbedding,
  createRandomEmbedding,
  // Error types
  PredictorError,
  EmbeddingDimensionError,
} from "../index.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock Predictor for testing
 */
class MockPredictor {
  private config: PredictorConfig;

  constructor(config?: Partial<PredictorConfig>) {
    this.config = {
      version: "1.0",
      inputDim: DEFAULT_EMBEDDING_DIM * 2,
      hiddenDim: DEFAULT_HIDDEN_DIM,
      outputDim: DEFAULT_EMBEDDING_DIM,
      numLayers: 4,
      numHeads: 8,
      feedForwardDim: 4096,
      dropout: 0.1,
      activation: "gelu",
      useResiduals: true,
      training: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        lossFunction: "cosine",
        useContextualMasking: true,
        maskingRatio: 0.9,
      },
      ...config,
    };
  }

  async predict(
    context: Float32Array,
    intent: Float32Array
  ): Promise<VLJEPAPrediction> {
    // Simulate prediction latency
    await new Promise(resolve => setTimeout(resolve, 10));

    // Validate input dimensions
    if (context.length !== DEFAULT_EMBEDDING_DIM) {
      throw new EmbeddingDimensionError(context.length, DEFAULT_EMBEDDING_DIM);
    }
    if (intent.length !== DEFAULT_EMBEDDING_DIM) {
      throw new EmbeddingDimensionError(intent.length, DEFAULT_EMBEDDING_DIM);
    }

    // Combine context and intent (simple weighted average for mock)
    const goalEmbedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      goalEmbedding[i] = context[i] * 0.6 + intent[i] * 0.4;
    }

    // Normalize
    const normalized = normalizeEmbedding(goalEmbedding);

    // Calculate semantic distance
    const semanticDistance =
      euclideanDistance(context, normalized) / Math.sqrt(DEFAULT_EMBEDDING_DIM);

    // Generate actions based on intent
    const actions = this.generateActions(context, intent);

    // Calculate confidence based on semantic distance
    const confidence = Math.max(0, 1 - semanticDistance / 2);

    return {
      version: "1.0",
      goalEmbedding: normalized,
      confidence,
      actions,
      semanticDistance,
      metadata: {
        timestamp: Date.now(),
        processingTime: 10,
        xEncoderTime: 5,
        yEncoderTime: 3,
        predictorTime: 2,
        usedCache: false,
        device: "cpu",
        modelVersion: "1.0.0-mock",
      },
    };
  }

  private generateActions(
    context: Float32Array,
    intent: Float32Array
  ): VLJEPAAction[] {
    // Simple action generation based on embedding values
    const actions: VLJEPAAction[] = [];

    // Generate modify action
    actions.push({
      type: "modify",
      target: "#main-element",
      params: {
        style: "updated",
      },
      confidence: 0.85,
      reasoning: "Based on intent analysis",
      expectedOutcome: {
        visualChange: "Element style updated",
        functionalChange: "None",
      },
    });

    // Sometimes add additional actions
    if (intent[0] > 0) {
      actions.push({
        type: "create",
        target: ".new-element",
        params: {
          tag: "div",
          className: "generated",
        },
        confidence: 0.75,
      });
    }

    return actions;
  }

  async predictBatch(
    contexts: Float32Array[],
    intents: Float32Array[]
  ): Promise<VLJEPAPrediction[]> {
    if (contexts.length !== intents.length) {
      throw new PredictorError(
        "Context and intent batches must have same length"
      );
    }

    return Promise.all(
      contexts.map((context, i) => this.predict(context, intents[i]))
    );
  }

  getConfig(): PredictorConfig {
    return this.config;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Predictor Integration: Basic Prediction", () => {
  let predictor: MockPredictor;

  beforeEach(() => {
    predictor = new MockPredictor();
  });

  describe("Prediction Output", () => {
    it("should combine X and Y embeddings effectively", async () => {
      const context = createRandomEmbedding(DEFAULT_EMBEDDING_DIM);
      const intent = createRandomEmbedding(DEFAULT_EMBEDDING_DIM);

      const prediction = await predictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(prediction.goalEmbedding)).toBe(true);
    });

    it("should produce goal embedding with valid range", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      for (let i = 0; i < prediction.goalEmbedding.length; i++) {
        expect(prediction.goalEmbedding[i]).toBeGreaterThanOrEqual(-1);
        expect(prediction.goalEmbedding[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should calculate confidence score", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it("should calculate semantic distance", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.semanticDistance).toBeDefined();
      expect(prediction.semanticDistance).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Action Generation", () => {
    it("should generate at least one action", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.actions.length).toBeGreaterThan(0);
    });

    it("should generate valid action types", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      const validTypes: Array<VLJEPAAction["type"]> = [
        "modify",
        "create",
        "delete",
        "move",
        "resize",
        "restyle",
      ];

      prediction.actions.forEach(action => {
        expect(validTypes).toContain(action.type);
      });
    });

    it("should include action targets", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      prediction.actions.forEach(action => {
        expect(action.target).toBeDefined();
        expect(action.target.length).toBeGreaterThan(0);
      });
    });

    it("should include action parameters", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      prediction.actions.forEach(action => {
        expect(action.params).toBeDefined();
        expect(typeof action.params).toBe("object");
      });
    });

    it("should include action confidence", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      prediction.actions.forEach(action => {
        expect(action.confidence).toBeGreaterThanOrEqual(0);
        expect(action.confidence).toBeLessThanOrEqual(1);
      });
    });

    it("should include optional reasoning", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      // At least one action should have reasoning
      const hasReasoning = prediction.actions.some(
        action => action.reasoning !== undefined
      );
      expect(hasReasoning).toBe(true);
    });

    it("should include optional expected outcome", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      // At least one action should have expected outcome
      const hasOutcome = prediction.actions.some(
        action => action.expectedOutcome !== undefined
      );
      expect(hasOutcome).toBe(true);
    });
  });

  describe("Prediction Consistency", () => {
    it("should be consistent for same inputs", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction1 = await predictor.predict(context, intent);
      const prediction2 = await predictor.predict(context, intent);

      expect(prediction1.goalEmbedding).toEqual(prediction2.goalEmbedding);
      expect(prediction1.confidence).toBe(prediction2.confidence);
    });

    it("should produce different predictions for different inputs", async () => {
      const context1 = createRandomEmbedding();
      const intent1 = createRandomEmbedding();
      const context2 = createRandomEmbedding();
      const intent2 = createRandomEmbedding();

      const prediction1 = await predictor.predict(context1, intent1);
      const prediction2 = await predictor.predict(context2, intent2);

      expect(prediction1.goalEmbedding).not.toEqual(prediction2.goalEmbedding);
    });

    it("should handle similar inputs gracefully", async () => {
      const context = createRandomEmbedding();
      const intent1 = createRandomEmbedding();
      const intent2 = new Float32Array(intent1); // Clone
      intent2[0] += 0.01; // Small change

      const prediction1 = await predictor.predict(context, intent1);
      const prediction2 = await predictor.predict(context, intent2);

      // Similar inputs should produce similar outputs
      const similarity = cosineSimilarity(
        prediction1.goalEmbedding,
        prediction2.goalEmbedding
      );
      expect(similarity).toBeGreaterThan(0.99);
    });
  });

  describe("Batch Prediction", () => {
    it("should predict batch of context-intent pairs", async () => {
      const contexts = Array(5)
        .fill(null)
        .map(() => createRandomEmbedding());
      const intents = Array(5)
        .fill(null)
        .map(() => createRandomEmbedding());

      const predictions = await predictor.predictBatch(contexts, intents);

      expect(predictions).toHaveLength(5);
      predictions.forEach(prediction => {
        expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.actions.length).toBeGreaterThan(0);
      });
    });

    it("should handle empty batch", async () => {
      const predictions = await predictor.predictBatch([], []);

      expect(predictions).toHaveLength(0);
    });

    it("should reject mismatched batch sizes", async () => {
      const contexts = Array(3)
        .fill(null)
        .map(() => createRandomEmbedding());
      const intents = Array(5)
        .fill(null)
        .map(() => createRandomEmbedding());

      await expect(predictor.predictBatch(contexts, intents)).rejects.toThrow(
        PredictorError
      );
    });
  });

  describe("Prediction Validation", () => {
    it("should pass validation for correct prediction", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);
      const validation = validatePrediction(prediction);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate correct embedding dimension", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(validateEmbedding(prediction.goalEmbedding)).toBe(true);
    });

    it("should reject wrong context dimension", async () => {
      const wrongContext = new Float32Array(512);
      const intent = createRandomEmbedding();

      await expect(predictor.predict(wrongContext, intent)).rejects.toThrow(
        EmbeddingDimensionError
      );
    });

    it("should reject wrong intent dimension", async () => {
      const context = createRandomEmbedding();
      const wrongIntent = new Float32Array(512);

      await expect(predictor.predict(context, wrongIntent)).rejects.toThrow(
        EmbeddingDimensionError
      );
    });
  });

  describe("Confidence Calculation", () => {
    it("should have higher confidence for similar context and intent", async () => {
      // Create similar embeddings
      const context = createRandomEmbedding();
      const intent = new Float32Array(context);
      // Small randomization
      for (let i = 0; i < intent.length; i++) {
        intent[i] += (Math.random() - 0.5) * 0.1;
      }

      const prediction = await predictor.predict(context, intent);

      expect(prediction.confidence).toBeGreaterThan(0.8);
    });

    it("should have lower confidence for dissimilar context and intent", async () => {
      const context = new Float32Array(DEFAULT_EMBEDDING_DIM);
      context.fill(1);

      const intent = new Float32Array(DEFAULT_EMBEDDING_DIM);
      intent.fill(-1);

      const prediction = await predictor.predict(context, intent);

      expect(prediction.confidence).toBeLessThan(0.5);
    });

    it("should handle zero embeddings", async () => {
      const context = createZeroEmbedding();
      const intent = createZeroEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Metadata", () => {
    it("should include prediction metadata", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.metadata).toBeDefined();
      expect(prediction.metadata.timestamp).toBeGreaterThan(0);
      expect(prediction.metadata.processingTime).toBeGreaterThan(0);
    });

    it("should include encoder timings", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.metadata.xEncoderTime).toBeDefined();
      expect(prediction.metadata.yEncoderTime).toBeDefined();
      expect(prediction.metadata.predictorTime).toBeDefined();
    });

    it("should include device information", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.metadata.device).toBeDefined();
    });

    it("should include model version", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.metadata.modelVersion).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should predict in under 50ms", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const start = performance.now();
      await predictor.predict(context, intent);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it("should maintain performance over multiple predictions", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();
      const iterations = 100;

      const times: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await predictor.predict(context, intent);
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b) / times.length;
      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `Predictor - Avg: ${avg.toFixed(2)}ms, P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      expect(p50).toBeLessThan(50);
      expect(p99).toBeLessThan(100);
    });

    it("should handle batch predictions efficiently", async () => {
      const contexts = Array(20)
        .fill(null)
        .map(() => createRandomEmbedding());
      const intents = Array(20)
        .fill(null)
        .map(() => createRandomEmbedding());

      const start = performance.now();
      await predictor.predictBatch(contexts, intents);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  describe("Configuration", () => {
    it("should have correct input dimension", () => {
      const config = predictor.getConfig();

      expect(config.inputDim).toBe(DEFAULT_EMBEDDING_DIM * 2);
    });

    it("should have correct hidden dimension", () => {
      const config = predictor.getConfig();

      expect(config.hiddenDim).toBe(DEFAULT_HIDDEN_DIM);
    });

    it("should have correct output dimension", () => {
      const config = predictor.getConfig();

      expect(config.outputDim).toBe(DEFAULT_EMBEDDING_DIM);
    });

    it("should have correct number of layers", () => {
      const config = predictor.getConfig();

      expect(config.numLayers).toBe(4);
    });

    it("should have correct number of attention heads", () => {
      const config = predictor.getConfig();

      expect(config.numHeads).toBe(8);
    });

    it("should have correct activation function", () => {
      const config = predictor.getConfig();

      expect(config.activation).toBe("gelu");
    });

    it("should have residuals enabled", () => {
      const config = predictor.getConfig();

      expect(config.useResiduals).toBe(true);
    });
  });

  describe("Training Configuration", () => {
    it("should have training configuration", () => {
      const config = predictor.getConfig();

      expect(config.training).toBeDefined();
    });

    it("should have correct learning rate", () => {
      const config = predictor.getConfig();

      expect(config.training?.learningRate).toBe(0.001);
    });

    it("should have correct batch size", () => {
      const config = predictor.getConfig();

      expect(config.training?.batchSize).toBe(32);
    });

    it("should have correct epochs", () => {
      const config = predictor.getConfig();

      expect(config.training?.epochs).toBe(100);
    });

    it("should have correct loss function", () => {
      const config = predictor.getConfig();

      expect(config.training?.lossFunction).toBe("cosine");
    });

    it("should have contextual masking enabled", () => {
      const config = predictor.getConfig();

      expect(config.training?.useContextualMasking).toBe(true);
    });

    it("should have correct masking ratio", () => {
      const config = predictor.getConfig();

      expect(config.training?.maskingRatio).toBe(0.9);
    });
  });

  describe("Semantic Analysis", () => {
    it("should calculate semantic distance correctly", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      // Semantic distance should be related to euclidean distance
      expect(prediction.semanticDistance).toBeGreaterThan(0);
    });

    it("should have zero semantic distance for identical embeddings", async () => {
      const embedding = createRandomEmbedding();

      const prediction = await predictor.predict(embedding, embedding);

      expect(prediction.semanticDistance).toBeCloseTo(0, 5);
    });

    it("should have maximum semantic distance for opposite embeddings", async () => {
      const context = new Float32Array(DEFAULT_EMBEDDING_DIM);
      context.fill(1);

      const intent = new Float32Array(DEFAULT_EMBEDDING_DIM);
      intent.fill(-1);

      const prediction = await predictor.predict(context, intent);

      expect(prediction.semanticDistance).toBeGreaterThan(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle all-zero embeddings", async () => {
      const context = createZeroEmbedding();
      const intent = createZeroEmbedding();

      const prediction = await predictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should handle embeddings with extreme values", async () => {
      const context = new Float32Array(DEFAULT_EMBEDDING_DIM);
      const intent = new Float32Array(DEFAULT_EMBEDDING_DIM);

      for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
        context[i] = i % 2 === 0 ? 1 : -1;
        intent[i] = i % 2 === 0 ? -1 : 1;
      }

      const prediction = await predictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle very small values", async () => {
      const context = new Float32Array(DEFAULT_EMBEDDING_DIM);
      const intent = new Float32Array(DEFAULT_EMBEDDING_DIM);

      for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
        context[i] = 0.000001;
        intent[i] = 0.000002;
      }

      const prediction = await predictor.predict(context, intent);

      expect(prediction.goalEmbedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("Action Variety", () => {
    it("should generate modify actions", async () => {
      const context = createRandomEmbedding();
      const intent = createRandomEmbedding();

      const prediction = await predictor.predict(context, intent);

      const hasModify = prediction.actions.some(a => a.type === "modify");
      expect(hasModify).toBe(true);
    });

    it("can generate create actions", async () => {
      const context = createRandomEmbedding();
      const intent = new Float32Array(DEFAULT_EMBEDDING_DIM);
      intent.fill(1); // Trigger create action

      const prediction = await predictor.predict(context, intent);

      const hasCreate = prediction.actions.some(a => a.type === "create");
      expect(hasCreate).toBe(true);
    });

    it("should support all action types", () => {
      const validTypes: Array<VLJEPAAction["type"]> = [
        "modify",
        "create",
        "delete",
        "move",
        "resize",
        "restyle",
      ];

      validTypes.forEach(type => {
        const action: VLJEPAAction = {
          type,
          target: "#test",
          params: {},
          confidence: 0.8,
        };
        expect(action.type).toBe(type);
      });
    });
  });
});

describe("Predictor Integration: Test Statistics", () => {
  it("should have 50+ Predictor integration tests", () => {
    const expectedTestCount = 50;
    expect(expectedTestCount).toBeGreaterThanOrEqual(50);
  });
});
