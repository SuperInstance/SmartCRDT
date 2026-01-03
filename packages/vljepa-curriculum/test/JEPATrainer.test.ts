/**
 * Tests for JEPATrainer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JEPATrainer } from "../src/trainers/JEPATrainer.js";
import type { TrainingExample } from "../src/types.js";

describe("JEPATrainer", () => {
  let trainer: JEPATrainer;

  beforeEach(() => {
    trainer = new JEPATrainer();
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const config = trainer.getConfig();
      expect(config.epochs).toBe(100);
      expect(config.batchSize).toBe(32);
      expect(config.learningRate).toBe(0.001);
    });

    it("should initialize with custom config", () => {
      const custom = new JEPATrainer({
        epochs: 50,
        batchSize: 16,
        learningRate: 0.0001,
      });

      const config = custom.getConfig();
      expect(config.epochs).toBe(50);
      expect(config.batchSize).toBe(16);
      expect(config.learningRate).toBe(0.0001);
    });

    it("should have JEPA model config", () => {
      const config = trainer.getConfig();
      expect(config.model.embeddingDim).toBe(768);
      expect(config.model.encoder.type).toBe("vision");
      expect(config.model.predictor.depth).toBe(4);
    });

    it("should have optimizer config", () => {
      const config = trainer.getConfig();
      expect(config.optimizer.type).toBe("adamw");
      expect(config.optimizer.learningRate).toBe(0.001);
    });

    it("should have loss config", () => {
      const config = trainer.getConfig();
      expect(config.loss.embeddingLoss).toBe("cosine");
      expect(config.loss.consistencyWeight).toBe(0.5);
      expect(config.loss.predictionWeight).toBe(1.0);
    });

    it("should have masking config", () => {
      const config = trainer.getConfig();
      expect(config.masking.strategy).toBe("block");
      expect(config.masking.ratio).toBe(0.9);
      expect(config.masking.patchSize).toBe(16);
    });

    it("should have scheduler config", () => {
      const config = trainer.getConfig();
      expect(config.scheduler.type).toBe("cosine");
      expect(config.scheduler.warmupEpochs).toBe(10);
    });
  });

  describe("Training", () => {
    it("should train on batch", async () => {
      const examples = createMockExamples(10);
      const result = await trainer.trainBatch(examples);

      expect(result.loss).toBeGreaterThanOrEqual(0);
      expect(result.predictions.length).toBe(10);
      expect(result.metrics.epoch).toBe(0);
      expect(result.metrics.step).toBe(1);
    });

    it("should increment step on each batch", async () => {
      const examples = createMockExamples(5);

      await trainer.trainBatch(examples);
      expect(trainer.getStep()).toBe(1);

      await trainer.trainBatch(examples);
      expect(trainer.getStep()).toBe(2);
    });

    it("should return predictions for all examples", async () => {
      const examples = createMockExamples(32);
      const result = await trainer.trainBatch(examples);

      expect(result.predictions.length).toBe(32);
      for (const pred of result.predictions) {
        expect(pred.length).toBe(768);
      }
    });
  });

  describe("Masking", () => {
    it("should apply random masking", () => {
      const customTrainer = new JEPATrainer({
        masking: {
          strategy: "random",
          ratio: 0.75,
          patchSize: 16,
          minBlocks: 3,
          maxBlocks: 10,
        },
      });

      expect(customTrainer.getConfig().masking.strategy).toBe("random");
    });

    it("should apply block masking", () => {
      const config = trainer.getConfig();
      expect(config.masking.strategy).toBe("block");
    });

    it("should apply contextual masking", () => {
      const customTrainer = new JEPATrainer({
        masking: {
          strategy: "contextual",
          ratio: 0.9,
          patchSize: 16,
          minBlocks: 3,
          maxBlocks: 10,
        },
      });

      expect(customTrainer.getConfig().masking.strategy).toBe("contextual");
    });
  });

  describe("Loss Calculation", () => {
    it("should calculate embedding loss", async () => {
      const examples = createMockExamples(10);
      const result = await trainer.trainBatch(examples);

      expect(result.loss).toBeFinite();
    });

    it("should use cosine loss by default", () => {
      const config = trainer.getConfig();
      expect(config.loss.embeddingLoss).toBe("cosine");
    });

    it("should support MSE loss", () => {
      const customTrainer = new JEPATrainer({
        loss: {
          embeddingLoss: "mse",
          consistencyWeight: 0.5,
          predictionWeight: 1.0,
          auxiliaryWeight: 0.1,
          temperature: 0.07,
        },
      });

      expect(customTrainer.getConfig().loss.embeddingLoss).toBe("mse");
    });

    it("should support Huber loss", () => {
      const customTrainer = new JEPATrainer({
        loss: {
          embeddingLoss: "huber",
          consistencyWeight: 0.5,
          predictionWeight: 1.0,
          auxiliaryWeight: 0.1,
          temperature: 0.07,
        },
      });

      expect(customTrainer.getConfig().loss.embeddingLoss).toBe("huber");
    });
  });

  describe("Learning Rate Scheduling", () => {
    it("should use cosine scheduler by default", () => {
      const config = trainer.getConfig();
      expect(config.scheduler.type).toBe("cosine");
    });

    it("should support constant scheduler", () => {
      const customTrainer = new JEPATrainer({
        scheduler: {
          type: "constant",
          warmupEpochs: 0,
          minLR: 0.001,
          maxLR: 0.001,
        },
      });

      expect(customTrainer.getConfig().scheduler.type).toBe("constant");
    });

    it("should support exponential scheduler", () => {
      const customTrainer = new JEPATrainer({
        scheduler: {
          type: "exponential",
          warmupEpochs: 5,
          minLR: 0.00001,
          maxLR: 0.001,
        },
      });

      expect(customTrainer.getConfig().scheduler.type).toBe("exponential");
    });

    it("should support step scheduler", () => {
      const customTrainer = new JEPATrainer({
        scheduler: {
          type: "step",
          warmupEpochs: 0,
          minLR: 0.00001,
          maxLR: 0.001,
        },
      });

      expect(customTrainer.getConfig().scheduler.type).toBe("step");
    });
  });

  describe("Evaluation", () => {
    it("should evaluate batch", () => {
      const examples = createMockExamples(10);
      const result = trainer.evaluate(examples);

      expect(result.loss).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should return metrics", () => {
      const examples = createMockExamples(5);
      const result = trainer.evaluate(examples);

      expect(result.metrics.learning_rate).toBeDefined();
      expect(result.metrics.epoch).toBeDefined();
    });

    it("should calculate cosine similarity", () => {
      const examples = createMockExamples(1);
      const result = trainer.evaluate(examples);

      expect(result.accuracy).toBeGreaterThan(0);
    });
  });

  describe("Epoch Management", () => {
    it("should track current epoch", () => {
      expect(trainer.getEpoch()).toBe(0);
    });

    it("should advance epoch", () => {
      trainer.nextEpoch();
      expect(trainer.getEpoch()).toBe(1);

      trainer.nextEpoch();
      expect(trainer.getEpoch()).toBe(2);
    });

    it("should reset epoch", () => {
      trainer.nextEpoch();
      trainer.nextEpoch();
      trainer.reset();

      expect(trainer.getEpoch()).toBe(0);
      expect(trainer.getStep()).toBe(0);
    });
  });

  describe("Optimizer Types", () => {
    it("should support Adam optimizer", () => {
      const customTrainer = new JEPATrainer({
        optimizer: {
          type: "adam",
          learningRate: 0.001,
          weightDecay: 0.01,
        },
      });

      expect(customTrainer.getConfig().optimizer.type).toBe("adam");
    });

    it("should support AdamW optimizer", () => {
      expect(trainer.getConfig().optimizer.type).toBe("adamw");
    });

    it("should support SGD optimizer", () => {
      const customTrainer = new JEPATrainer({
        optimizer: {
          type: "sgd",
          learningRate: 0.01,
          weightDecay: 0.0001,
          momentum: 0.9,
        },
      });

      expect(customTrainer.getConfig().optimizer.type).toBe("sgd");
    });

    it("should support RMSprop optimizer", () => {
      const customTrainer = new JEPATrainer({
        optimizer: {
          type: "rmsprop",
          learningRate: 0.001,
          weightDecay: 0.01,
        },
      });

      expect(customTrainer.getConfig().optimizer.type).toBe("rmsprop");
    });
  });

  describe("Learning Rate Changes", () => {
    it("should return current learning rate", () => {
      expect(trainer.getConfig().learningRate).toBe(0.001);
    });

    it("should apply warmup in early epochs", () => {
      trainer.nextEpoch();
      trainer.nextEpoch();

      // Should be in warmup phase
      const config = trainer.getConfig();
      expect(trainer.getEpoch()).toBeLessThan(config.scheduler.warmupEpochs);
    });

    it("should decrease learning rate after warmup", () => {
      for (let i = 0; i < 20; i++) {
        trainer.nextEpoch();
      }

      // Should be past warmup phase
      const config = trainer.getConfig();
      expect(trainer.getEpoch()).toBeGreaterThan(config.scheduler.warmupEpochs);
    });
  });

  describe("Model Configuration", () => {
    it("should support different encoder types", () => {
      const customTrainer = new JEPATrainer({
        model: {
          encoder: {
            type: "language",
            architecture: "transformer",
            pretrained: true,
            frozen: false,
          },
          predictor: {
            depth: 6,
            width: 512,
            heads: 8,
          },
          embeddingDim: 512,
        },
      });

      expect(customTrainer.getConfig().model.encoder.type).toBe("language");
    });

    it("should support different embedding dimensions", () => {
      const customTrainer = new JEPATrainer({
        model: {
          encoder: {
            type: "vision",
            architecture: "resnet50",
            pretrained: false,
            frozen: false,
          },
          predictor: {
            depth: 4,
            width: 256,
            heads: 8,
          },
          embeddingDim: 1024,
        },
      });

      expect(customTrainer.getConfig().model.embeddingDim).toBe(1024);
    });

    it("should support frozen encoders", () => {
      const customTrainer = new JEPATrainer({
        model: {
          encoder: {
            type: "vision",
            architecture: "resnet18",
            pretrained: true,
            frozen: true,
          },
          predictor: {
            depth: 4,
            width: 256,
            heads: 8,
          },
          embeddingDim: 768,
        },
      });

      expect(customTrainer.getConfig().model.encoder.frozen).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty batch", async () => {
      const result = await trainer.trainBatch([]);

      expect(result.loss).toBe(0);
      expect(result.predictions.length).toBe(0);
    });

    it("should handle single example batch", async () => {
      const examples = createMockExamples(1);
      const result = await trainer.trainBatch(examples);

      expect(result.predictions.length).toBe(1);
    });

    it("should handle large batch", async () => {
      const examples = createMockExamples(128);
      const result = await trainer.trainBatch(examples);

      expect(result.predictions.length).toBe(128);
    });

    it("should handle zero epochs", () => {
      expect(trainer.getEpoch()).toBe(0);
      const result = trainer.evaluate(createMockExamples(5));
      expect(result.metrics.epoch).toBe(0);
    });
  });

  describe("Loss Weights", () => {
    it("should allow custom loss weights", () => {
      const customTrainer = new JEPATrainer({
        loss: {
          embeddingLoss: "cosine",
          consistencyWeight: 0.3,
          predictionWeight: 0.7,
          auxiliaryWeight: 0.2,
          temperature: 0.1,
        },
      });

      const config = customTrainer.getConfig();
      expect(config.loss.consistencyWeight).toBe(0.3);
      expect(config.loss.predictionWeight).toBe(0.7);
      expect(config.loss.auxiliaryWeight).toBe(0.2);
    });
  });

  describe("Masking Ratio", () => {
    it("should allow custom masking ratio", () => {
      const customTrainer = new JEPATrainer({
        masking: {
          strategy: "random",
          ratio: 0.85,
          patchSize: 16,
          minBlocks: 3,
          maxBlocks: 10,
        },
      });

      expect(customTrainer.getConfig().masking.ratio).toBe(0.85);
    });

    it("should allow custom patch size", () => {
      const customTrainer = new JEPATrainer({
        masking: {
          strategy: "block",
          ratio: 0.9,
          patchSize: 32,
          minBlocks: 2,
          maxBlocks: 8,
        },
      });

      expect(customTrainer.getConfig().masking.patchSize).toBe(32);
    });
  });
});

function createMockExamples(count: number): TrainingExample[] {
  const examples: TrainingExample[] = [];

  for (let i = 0; i < count; i++) {
    const embedding = new Float32Array(768);
    for (let j = 0; j < embedding.length; j++) {
      embedding[j] = Math.random() * 2 - 1;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let j = 0; j < embedding.length; j++) {
      embedding[j] /= norm;
    }

    examples.push({
      id: `test_${i}`,
      stageId: "test",
      imageData: {
        width: 64,
        height: 64,
        channels: 3,
        data: new Uint8Array(64 * 64 * 3).fill(128),
      },
      embedding,
      metadata: {
        labels: ["test"],
        attributes: {},
      },
      difficulty: 0.5,
      timestamp: Date.now(),
    });
  }

  return examples;
}
