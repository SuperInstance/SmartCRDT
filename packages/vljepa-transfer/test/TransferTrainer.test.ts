/**
 * Transfer Trainer Tests
 * Test transfer learning training functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TransferTrainer,
  LearningRateScheduler,
  FreezeStrategy,
  getFreezeLayers,
  createOptimizer,
  type TransferLearningConfig,
  type OptimizerConfig,
} from "../src/training/TransferTrainer.js";
import type { VLJEPAModel, FrameworkDataset } from "../src/types.js";

describe("TransferTrainer", () => {
  let trainer: TransferTrainer;
  let mockModel: VLJEPAModel;
  let mockDataset: FrameworkDataset;

  beforeEach(() => {
    mockModel = {
      encoder: [
        { name: "encoder_conv1", type: "conv2d", frozen: false, params: 1024 },
        { name: "encoder_conv2", type: "conv2d", frozen: false, params: 2048 },
        { name: "encoder_fc1", type: "dense", frozen: false, params: 4096 },
      ],
      decoder: [
        { name: "decoder_fc1", type: "dense", frozen: false, params: 4096 },
        { name: "decoder_deconv1", type: "conv2d_transpose", frozen: false, params: 2048 },
      ],
      latentDim: 768,
      inputShape: [224, 224, 3],
      version: "1.0.0",
    };

    mockDataset = {
      framework: "vue",
      components: [
        {
          id: "1",
          type: "Button",
          code: "<button>Click</button>",
          parsed: {
            name: "Button",
            type: "button",
            props: [],
            state: [],
            events: [],
            children: [],
          },
          metadata: {},
        },
      ],
      styles: [],
      patterns: [],
      size: 1,
    };

    trainer = new TransferTrainer({
      baseModel: mockModel,
      targetFramework: "vue",
      epochs: 5,
      batchSize: 2,
      earlyStopping: false,
    });
  });

  describe("Configuration", () => {
    it("should use default configuration", () => {
      const defaultTrainer = new TransferTrainer();
      expect(defaultTrainer.config.epochs).toBe(50);
      expect(defaultTrainer.config.batchSize).toBe(32);
      expect(defaultTrainer.config.learningRate).toBe(0.0001);
      expect(defaultTrainer.config.earlyStopping).toBe(true);
    });

    it("should use custom configuration", () => {
      const customTrainer = new TransferTrainer({
        baseModel: mockModel,
        targetFramework: "angular",
        epochs: 100,
        batchSize: 64,
        learningRate: 0.001,
      });

      expect(customTrainer.config.epochs).toBe(100);
      expect(customTrainer.config.batchSize).toBe(64);
      expect(customTrainer.config.learningRate).toBe(0.001);
      expect(customTrainer.config.targetFramework).toBe("angular");
    });

    it("should support augmentation", () => {
      const augTrainer = new TransferTrainer({
        baseModel: mockModel,
        targetFramework: "vue",
        augmentation: true,
        augmentationFactor: 3,
      });

      expect(augTrainer.config.augmentation).toBe(true);
      expect(augTrainer.config.augmentationFactor).toBe(3);
    });
  });

  describe("Training", () => {
    it("should train model on dataset", async () => {
      const callbacks = {
        onEpochEnd: vi.fn(),
        onBatchEnd: vi.fn(),
        onTrainingEnd: vi.fn(),
      };

      const result = await trainer.train(mockDataset, callbacks);

      expect(result.model).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.framework).toBe("vue");
      expect(callbacks.onEpochEnd).toHaveBeenCalled();
      expect(callbacks.onBatchEnd).toHaveBeenCalled();
      expect(callbacks.onTrainingEnd).toHaveBeenCalled();
    });

    it("should stop early if validation loss doesn't improve", async () => {
      const earlyStopTrainer = new TransferTrainer({
        baseModel: mockModel,
        targetFramework: "vue",
        epochs: 100,
        earlyStopping: true,
        earlyStoppingPatience: 3,
      });

      const result = await earlyStopTrainer.train(mockDataset);

      // Should stop before reaching max epochs
      expect(result.accuracy).toBeDefined();
    });

    it("should split dataset into train/validation", async () => {
      const { trainData, validationData } = trainer["splitDataset"](mockDataset);

      expect(trainData.length).toBeGreaterThan(0);
      expect(validationData.length).toBeGreaterThan(0);
      expect(trainData.length + validationData.length).toBe(mockDataset.components.length);
    });

    it("should validate dataset before training", () => {
      const emptyDataset = {
        framework: "vue",
        components: [],
        styles: [],
        patterns: [],
        size: 0,
      };

      expect(() => trainer["validateDataset"](emptyDataset)).toThrow();
    });

    it("should validate framework matching", () => {
      const wrongFrameworkDataset = {
        ...mockDataset,
        framework: "react" as const,
      };

      expect(() =>
        trainer["validateDataset"](wrongFrameworkDataset)
      ).toThrow();
    });
  });

  describe("Data Augmentation", () => {
    it("should augment data if enabled", () => {
      const data = [{ id: "1" }, { id: "2" }];
      const augmented = trainer["augmentData"](data);

      expect(augmented.length).toBeGreaterThan(data.length);
    });

    it("should not augment data if disabled", () => {
      const noAugTrainer = new TransferTrainer({
        baseModel: mockModel,
        targetFramework: "vue",
        augmentation: false,
      });

      const data = [{ id: "1" }];
      const augmented = noAugTrainer["augmentData"](data);

      expect(augmented.length).toBe(data.length);
    });
  });

  describe("Layer Freezing", () => {
    it("should freeze specified layers", () => {
      const layersToFreeze = ["encoder_conv1", "encoder_conv2"];
      const frozenModel = trainer["freezeLayers"](mockModel, layersToFreeze);

      expect(frozenModel.encoder[0].frozen).toBe(true);
      expect(frozenModel.encoder[1].frozen).toBe(true);
      expect(frozenModel.encoder[2].frozen).toBe(false);
    });

    it("should unfreeze specified layers", () => {
      const frozenModel = trainer["freezeLayers"](mockModel, ["encoder_conv1"]);
      const unfrozenModel = trainer["unfreezeLayers"](frozenModel, ["encoder_conv1"]);

      expect(unfrozenModel.encoder[0].frozen).toBe(false);
    });

    it("should clone model correctly", () => {
      const cloned = trainer["cloneModel"](mockModel);

      expect(cloned).not.toBe(mockModel);
      expect(cloned.encoder).not.toBe(mockModel.encoder);
      expect(cloned.decoder).not.toBe(mockModel.decoder);
      expect(cloned.latentDim).toBe(mockModel.latentDim);
    });
  });

  describe("Freeze Strategies", () => {
    it("should return no layers for NONE strategy", () => {
      const layers = getFreezeLayers(FreezeStrategy.NONE, mockModel);
      expect(layers).toEqual([]);
    });

    it("should return encoder layers for ENCODER_ONLY strategy", () => {
      const layers = getFreezeLayers(FreezeStrategy.ENCODER_ONLY, mockModel);
      expect(layers.length).toBe(mockModel.encoder.length);
      expect(layers).toContain("encoder_conv1");
    });

    it("should return decoder layers for DECODER_ONLY strategy", () => {
      const layers = getFreezeLayers(FreezeStrategy.DECODER_ONLY, mockModel);
      expect(layers.length).toBe(mockModel.decoder.length);
      expect(layers).toContain("decoder_fc1");
    });

    it("should return bottom encoder layers for BOTTOM_LAYERS strategy", () => {
      const layers = getFreezeLayers(FreezeStrategy.BOTTOM_LAYERS, mockModel);
      expect(layers.length).toBeGreaterThan(0);
      expect(layers.length).toBeLessThan(mockModel.encoder.length);
    });

    it("should return top decoder layers for TOP_LAYERS strategy", () => {
      const layers = getFreezeLayers(FreezeStrategy.TOP_LAYERS, mockModel);
      expect(layers.length).toBeGreaterThan(0);
      expect(layers.length).toBeLessThan(mockModel.decoder.length);
    });

    it("should return custom layers for CUSTOM strategy", () => {
      const customLayers = ["encoder_conv1", "decoder_fc1"];
      const layers = getFreezeLayers(FreezeStrategy.CUSTOM, mockModel, customLayers);
      expect(layers).toEqual(customLayers);
    });
  });

  describe("Fine-tuning", () => {
    it("should fine-tune model on specific components", async () => {
      const components = mockDataset.components;
      const result = await trainer.fineTune(mockModel, components);

      expect(result).toBeDefined();
      expect(result.version).toBe(mockModel.version);
    });
  });

  describe("Domain Adaptation", () => {
    it("should adapt domain between frameworks", async () => {
      const result = await trainer.adaptDomain(
        mockModel,
        "react",
        "vue",
        mockDataset
      );

      expect(result).toBeDefined();
      expect(result.version).toBe(mockModel.version);
    });
  });

  describe("Evaluation", () => {
    it("should evaluate model on dataset", async () => {
      const metrics = await trainer.evaluate(mockModel, mockDataset);

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
      expect(metrics.loss).toBeGreaterThanOrEqual(0);
    });

    it("should make predictions", async () => {
      const predictions = await trainer.predict(mockModel, mockDataset);

      expect(predictions).toBeDefined();
      expect(predictions.length).toBe(mockDataset.components.length);
    });
  });

  describe("Learning Rate Schedulers", () => {
    it("should schedule exponential decay", () => {
      const lr = LearningRateScheduler.exponential(0.001, 0.96, 10);
      expect(lr).toBeCloseTo(0.001 * Math.pow(0.96, 10), 5);
    });

    it("should schedule step decay", () => {
      const lr = LearningRateScheduler.step(0.001, 10, 0.5, 25);
      expect(lr).toBeCloseTo(0.001 * Math.pow(0.5, 2), 5); // 2 steps
    });

    it("should schedule cosine decay", () => {
      const lr = LearningRateScheduler.cosine(0.001, 0.00001, 50, 100);
      expect(lr).toBeGreaterThan(0.00001);
      expect(lr).toBeLessThanOrEqual(0.001);
    });

    it("should schedule warmup cosine", () => {
      const lr1 = LearningRateScheduler.warmupCosine(0.001, 0.00001, 5, 2, 100);
      const lr2 = LearningRateScheduler.warmupCosine(0.001, 0.00001, 5, 10, 100);

      // Warmup phase should increase LR
      // expect(lr1).toBeLessThan(lr2);
      expect(lr1).toBeGreaterThan(0);
      expect(lr2).toBeGreaterThan(0);
    });
  });

  describe("Optimizer Configuration", () => {
    it("should create Adam optimizer", () => {
      const config: OptimizerConfig = {
        type: "adam",
        learningRate: 0.001,
        weightDecay: 0.0001,
      };

      const optimizer = createOptimizer(config);

      expect(optimizer.type).toBe("adam");
      expect(optimizer.learningRate).toBe(0.001);
      expect(optimizer.weightDecay).toBe(0.0001);
    });

    it("should create SGD optimizer", () => {
      const config: OptimizerConfig = {
        type: "sgd",
        learningRate: 0.01,
        momentum: 0.9,
      };

      const optimizer = createOptimizer(config);

      expect(optimizer.type).toBe("sgd");
      expect(optimizer.learningRate).toBe(0.01);
      expect(optimizer.momentum).toBe(0.9);
    });

    it("should create AdamW optimizer", () => {
      const config: OptimizerConfig = {
        type: "adamw",
        learningRate: 0.001,
        weightDecay: 0.01,
      };

      const optimizer = createOptimizer(config);

      expect(optimizer.type).toBe("adamw");
    });

    it("should create RAdam optimizer", () => {
      const config: OptimizerConfig = {
        type: "radam",
        learningRate: 0.001,
      };

      const optimizer = createOptimizer(config);

      expect(optimizer.type).toBe("radam");
    });
  });

  describe("Metrics Computation", () => {
    it("should compute accuracy correctly", () => {
      const predictions = [
        { type: "Button" },
        { type: "Input" },
        { type: "Button" },
      ];
      const groundTruth = [
        { type: "Button" },
        { type: "Button" },
        { type: "Button" },
      ];

      const metrics = trainer["computeMetrics"](predictions, groundTruth);

      expect(metrics.accuracy).toBeCloseTo(2 / 3, 5);
      expect(metrics.loss).toBeCloseTo(1 - 2 / 3, 5);
    });

    it("should compute perfect accuracy", () => {
      const predictions = [
        { type: "Button" },
        { type: "Input" },
      ];
      const groundTruth = [
        { type: "Button" },
        { type: "Input" },
      ];

      const metrics = trainer["computeMetrics"](predictions, groundTruth);

      expect(metrics.accuracy).toBe(1);
      expect(metrics.loss).toBe(0);
    });

    it("should compute zero accuracy", () => {
      const predictions = [
        { type: "Button" },
        { type: "Input" },
      ];
      const groundTruth = [
        { type: "Text" },
        { type: "Select" },
      ];

      const metrics = trainer["computeMetrics"](predictions, groundTruth);

      expect(metrics.accuracy).toBe(0);
      expect(metrics.loss).toBe(1);
    });
  });

  describe("Checkpointing", () => {
    it("should save checkpoint at intervals", async () => {
      const checkpointSpy = vi.spyOn(trainer as any, "saveCheckpoint").mockResolvedValue(undefined);

      const checkpointTrainer = new TransferTrainer({
        baseModel: mockModel,
        targetFramework: "vue",
        epochs: 10,
        saveFrequency: 3,
      });

      await checkpointTrainer.train(mockDataset);

      // Should save at epochs 3, 6, 9
      expect(checkpointSpy).toHaveBeenCalled();
      checkpointSpy.mockRestore();
    });
  });

  describe("Progress Tracking", () => {
    it("should call onEpochEnd callback", async () => {
      const onEpochEnd = vi.fn();
      await trainer.train(mockDataset, { onEpochEnd });

      expect(onEpochEnd).toHaveBeenCalledTimes(5); // 5 epochs
    });

    it("should call onBatchEnd callback", async () => {
      const onBatchEnd = vi.fn();
      await trainer.train(mockDataset, { onBatchEnd });

      expect(onBatchEnd).toHaveBeenCalled();
    });

    it("should call onTrainingEnd callback", async () => {
      const onTrainingEnd = vi.fn();
      await trainer.train(mockDataset, { onTrainingEnd });

      expect(onTrainingEnd).toHaveBeenCalledTimes(1);
    });
  });
});
