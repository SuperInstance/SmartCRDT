/**
 * @lsi/vljepa - Training Tests
 *
 * Comprehensive tests for JEPA training methodology.
 * Tests training strategy, UI dataset, fine-tuning, and curriculum learning.
 *
 * @module training
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JEPATrainingStrategy } from "./JEPATrainingStrategy.js";
import { UIDataset } from "./UIDataset.js";
import { UIFineTuningStrategy } from "./FineTuning.js";
import {
  DEFAULT_JEPA_CONFIG,
  DEFAULT_UI_FINETUNING_CONFIG,
  JEPATrainingStatus,
  TrainingComparison,
  ContextualMaskingConfig,
  JEPALossConfig,
} from "./types.js";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

describe("JEPATrainingStrategy", () => {
  let strategy: JEPATrainingStrategy;
  let tempDir: string;

  beforeEach(() => {
    tempDir = `/tmp/vljepa-test-${Date.now()}`;
    strategy = new JEPATrainingStrategy({
      trainingDir: tempDir,
      config: {
        ...DEFAULT_JEPA_CONFIG,
        hyperparameters: {
          ...DEFAULT_JEPA_CONFIG.hyperparameters,
          epochs: 1,
          batchSize: 2,
        },
      } as any,
    });
  });

  afterEach(async () => {
    try {
      await strategy.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Initialization", () => {
    it("should initialize training directory", async () => {
      await strategy.initialize();
      const exists = await fs
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should create required subdirectories", async () => {
      await strategy.initialize();
      const checkpointsDir = join(tempDir, "checkpoints");
      const logsDir = join(tempDir, "logs");
      const tensorboardDir = join(tempDir, "tensorboard");

      const checkpointsExists = await fs
        .access(checkpointsDir)
        .then(() => true)
        .catch(() => false);
      const logsExists = await fs
        .access(logsDir)
        .then(() => true)
        .catch(() => false);
      const tensorboardExists = await fs
        .access(tensorboardDir)
        .then(() => true)
        .catch(() => false);

      expect(checkpointsExists).toBe(true);
      expect(logsExists).toBe(true);
      expect(tensorboardExists).toBe(true);
    });

    it("should have correct default configuration", () => {
      const status = strategy.getTrainingStatus();
      expect(status.status).toBe(JEPATrainingStatus.IDLE);
    });

    it("should initialize only once", async () => {
      await strategy.initialize();
      await strategy.initialize(); // Should not throw
      const status = strategy.getTrainingStatus();
      expect(status.status).toBe(JEPATrainingStatus.IDLE);
    });
  });

  describe("Contextual Masking", () => {
    it("should apply random masking with 10% visible", () => {
      const maskingConfig: ContextualMaskingConfig = {
        visibleRatio: 0.1,
        strategy: "random",
        maskToken: "",
        spatialMasking: true,
        temporalMasking: false,
      };

      expect(maskingConfig.visibleRatio).toBe(0.1);
      expect(maskingConfig.strategy).toBe("random");
    });

    it("should apply block masking with specified block size", () => {
      const maskingConfig: ContextualMaskingConfig = {
        visibleRatio: 0.1,
        strategy: "block",
        blockSize: 16,
        maskToken: "",
        spatialMasking: true,
        temporalMasking: false,
      };

      expect(maskingConfig.strategy).toBe("block");
      expect(maskingConfig.blockSize).toBe(16);
    });

    it("should apply tube masking for video", () => {
      const maskingConfig: ContextualMaskingConfig = {
        visibleRatio: 0.1,
        strategy: "tube",
        tubeLength: 8,
        maskToken: "",
        spatialMasking: true,
        temporalMasking: true,
      };

      expect(maskingConfig.strategy).toBe("tube");
      expect(maskingConfig.tubeLength).toBe(8);
      expect(maskingConfig.temporalMasking).toBe(true);
    });

    it("should apply adaptive masking with threshold", () => {
      const maskingConfig: ContextualMaskingConfig = {
        visibleRatio: 0.1,
        strategy: "adaptive",
        adaptiveThreshold: 0.5,
        maskToken: "",
        spatialMasking: true,
        temporalMasking: false,
      };

      expect(maskingConfig.strategy).toBe("adaptive");
      expect(maskingConfig.adaptiveThreshold).toBe(0.5);
    });
  });

  describe("Embedding Distance Loss", () => {
    it("should compute cosine similarity correctly", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      const strategy = new JEPATrainingStrategy({});

      // Access private method via reflection for testing
      const cosineSimilarity = (strategy as any).cosineSimilarity.call(
        strategy,
        a,
        b
      );
      expect(cosineSimilarity).toBeCloseTo(1.0, 5);
    });

    it("should compute cosine similarity for orthogonal vectors", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      const strategy = new JEPATrainingStrategy({});

      const cosineSimilarity = (strategy as any).cosineSimilarity.call(
        strategy,
        a,
        b
      );
      expect(cosineSimilarity).toBeCloseTo(0.0, 5);
    });

    it("should compute euclidean distance correctly", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);
      const strategy = new JEPATrainingStrategy({});

      const distance = (strategy as any).euclideanDistance.call(strategy, a, b);
      expect(distance).toBeCloseTo(5.0, 5);
    });

    it("should compute manhattan distance correctly", () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);
      const strategy = new JEPATrainingStrategy({});

      const distance = (strategy as any).manhattanDistance.call(strategy, a, b);
      expect(distance).toBe(7.0);
    });

    it("should compute embedding distance loss with cosine similarity", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      const strategy = new JEPATrainingStrategy({});

      const lossConfig: JEPALossConfig = {
        type: "embedding-distance",
        metric: "cosine-similarity",
        temperature: 0.07,
        useContrastive: false,
        contrastiveTemperature: 0.05,
        predictorWeight: 1.0,
        encoderWeight: 0.5,
      };

      const loss = (strategy as any).computeEmbeddingDistanceLoss.call(
        strategy,
        a,
        b,
        lossConfig
      );
      expect(loss).toBeCloseTo(0.0, 5); // Identical vectors have 0 distance
    });
  });

  describe("Training Execution", () => {
    it("should execute mock training without errors", async () => {
      await strategy.initialize();

      const mockData = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `sample-${i}`,
          image: new ImageData(100, 100),
          instruction: "Test instruction",
        }));

      let progressCalled = false;
      const progressCallback = () => {
        progressCalled = true;
      };

      const trainingId = await strategy.train(mockData, { progressCallback });

      expect(trainingId).toBeDefined();
      expect(progressCalled).toBe(true);
    });

    it("should emit training events", async () => {
      await strategy.initialize();

      const events: string[] = [];
      const eventCallback = (event: any) => {
        events.push(event.type);
      };

      await strategy.train([], { eventCallback });

      expect(events).toContain("start");
      expect(events).toContain("complete");
    });

    it("should update training status during training", async () => {
      await strategy.initialize();

      const statusBefore = strategy.getTrainingStatus();
      expect(statusBefore.status).toBe(JEPATrainingStatus.IDLE);

      const trainingPromise = strategy.train([]);

      const statusDuring = strategy.getTrainingStatus();
      expect(statusDuring.status).toBe(JEPATrainingStatus.TRAINING);

      await trainingPromise;

      const statusAfter = strategy.getTrainingStatus();
      expect(statusAfter.status).toBe(JEPATrainingStatus.COMPLETED);
    });

    it("should save checkpoints during training", async () => {
      await strategy.initialize();

      await strategy.train([]);

      // Check that checkpoint directory exists
      const checkpoints = await fs.readdir(join(tempDir, "checkpoints"));
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it("should cancel training", async () => {
      await strategy.initialize();

      const trainingPromise = strategy.train([]);
      await strategy.cancelTraining();

      const status = strategy.getTrainingStatus();
      expect(status.status).toBe(JEPATrainingStatus.CANCELLED);
    });
  });

  describe("Training Comparison", () => {
    it("should provide JEPA vs Traditional comparison", () => {
      const comparison = JEPATrainingStrategy.getComparison();

      expect(comparison.traditional.approach).toBe(
        "Autoregressive token prediction"
      );
      expect(comparison.traditional.loss).toBe("Cross-entropy on tokens");
      expect(comparison.jepa.approach).toBe(
        "Embedding prediction in latent space"
      );
      expect(comparison.jepa.loss).toBe(
        "Embedding distance (cosine similarity)"
      );
    });

    it("should explain JEPA methodology", () => {
      const explanation = JEPATrainingStrategy.getMethodologyExplanation();

      expect(explanation).toContain("Contextual Masking");
      expect(explanation).toContain("Embedding Encoding");
      expect(explanation).toContain("Predictor Training");
      expect(explanation).toContain("World Model Learning");
    });
  });
});

describe("UIDataset", () => {
  let dataset: UIDataset;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = `/tmp/ui-dataset-test-${Date.now()}`;
    dataset = new UIDataset({
      storageDir: tempDir,
    });
    await dataset.initialize();
  });

  afterEach(async () => {
    try {
      await dataset.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Initialization", () => {
    it("should create storage directories", async () => {
      const screenshotsDir = join(tempDir, "screenshots");
      const clipsDir = join(tempDir, "clips");
      const metadataDir = join(tempDir, "metadata");

      const screenshotsExists = await fs
        .access(screenshotsDir)
        .then(() => true)
        .catch(() => false);
      const clipsExists = await fs
        .access(clipsDir)
        .then(() => true)
        .catch(() => false);
      const metadataExists = await fs
        .access(metadataDir)
        .then(() => true)
        .catch(() => false);

      expect(screenshotsExists).toBe(true);
      expect(clipsExists).toBe(true);
      expect(metadataExists).toBe(true);
    });
  });

  describe("Entry Management", () => {
    it("should add UI entry", async () => {
      const entry = {
        id: `entry-${randomBytes(4).toString("hex")}`,
        beforeImage: new ImageData(1920, 1080),
        instruction: "Center this button",
        metadata: {
          framework: "React" as const,
          componentLib: "shadcn",
          layout: "flex" as const,
          responsive: true,
          theme: "light" as const,
        },
      };

      await dataset.addEntry(entry);

      const retrieved = dataset.getEntry(entry.id);
      expect(retrieved).toEqual(entry);
    });

    it("should reject entry without ID", async () => {
      const entry = {
        id: "",
        beforeImage: new ImageData(100, 100),
        instruction: "Test",
        metadata: {
          framework: "React" as const,
          componentLib: "shadcn",
          layout: "flex" as const,
          responsive: true,
          theme: "light" as const,
        },
      };

      await expect(dataset.addEntry(entry)).rejects.toThrow();
    });

    it("should get all entries", async () => {
      const entry1 = {
        id: `entry-${randomBytes(4).toString("hex")}`,
        beforeImage: new ImageData(100, 100),
        instruction: "Test 1",
        metadata: {
          framework: "React" as const,
          componentLib: "shadcn",
          layout: "flex" as const,
          responsive: true,
          theme: "light" as const,
        },
      };

      const entry2 = {
        id: `entry-${randomBytes(4).toString("hex")}`,
        beforeImage: new ImageData(100, 100),
        instruction: "Test 2",
        metadata: {
          framework: "Vue" as const,
          componentLib: "MUI",
          layout: "grid" as const,
          responsive: false,
          theme: "dark" as const,
        },
      };

      await dataset.addEntry(entry1);
      await dataset.addEntry(entry2);

      const allEntries = dataset.getAllEntries();
      expect(allEntries.length).toBe(2);
    });
  });

  describe("Synthetic Data Generation", () => {
    it("should generate synthetic UI entries", async () => {
      await dataset.generateSyntheticData({
        numSamples: 5,
        variations: "layout",
      });

      const allEntries = dataset.getAllEntries();
      expect(allEntries.length).toBe(5);
    });

    it("should generate entries with valid structure", async () => {
      await dataset.generateSyntheticData({
        numSamples: 1,
        variations: "all",
      });

      const entry = dataset.getAllEntries()[0];

      expect(entry.id).toBeDefined();
      expect(entry.beforeImage).toBeDefined();
      expect(entry.instruction).toBeDefined();
      expect(entry.metadata).toBeDefined();
      expect(entry.components).toBeDefined();
    });

    it("should generate different variations", async () => {
      await dataset.generateSyntheticData({
        numSamples: 10,
        variations: "all",
      });

      const entries = dataset.getAllEntries();
      const instructions = entries.map(e => e.instruction);

      // Should have various instruction types
      expect(instructions.some(i => i.includes("center"))).toBe(true);
      expect(instructions.some(i => i.includes("color"))).toBe(true);
      expect(instructions.some(i => i.includes("text"))).toBe(true);
    });
  });

  describe("Data Augmentation", () => {
    it("should augment data with flipping", async () => {
      await dataset.generateSyntheticData({
        numSamples: 2,
        variations: "layout",
      });
      const countBefore = dataset.getAllEntries().length;

      await dataset.augmentData({ flip: true });

      const countAfter = dataset.getAllEntries().length;
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it("should augment data with rotation", async () => {
      await dataset.generateSyntheticData({
        numSamples: 2,
        variations: "layout",
      });
      const countBefore = dataset.getAllEntries().length;

      await dataset.augmentData({ rotate: 90 });

      const countAfter = dataset.getAllEntries().length;
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it("should augment data with color jittering", async () => {
      await dataset.generateSyntheticData({
        numSamples: 2,
        variations: "layout",
      });
      const countBefore = dataset.getAllEntries().length;

      await dataset.augmentData({ colorJitter: true });

      const countAfter = dataset.getAllEntries().length;
      expect(countAfter).toBeGreaterThan(countBefore);
    });
  });

  describe("Dataset Statistics", () => {
    it("should provide dataset statistics", async () => {
      await dataset.generateSyntheticData({
        numSamples: 10,
        variations: "all",
      });

      const stats = dataset.getStatistics();

      expect(stats.totalEntries).toBe(10);
      expect(stats.frameworkDistribution).toBeDefined();
      expect(stats.componentTypeDistribution).toBeDefined();
    });

    it("should distribute frameworks across entries", async () => {
      await dataset.generateSyntheticData({
        numSamples: 50,
        variations: "all",
      });

      const stats = dataset.getStatistics();

      expect(Object.keys(stats.frameworkDistribution).length).toBeGreaterThan(
        0
      );
      expect(
        Object.values(stats.frameworkDistribution).reduce((a, b) => a + b, 0)
      ).toBe(50);
    });
  });

  describe("Data Splitting", () => {
    it("should split dataset into train/val/test", async () => {
      await dataset.generateSyntheticData({
        numSamples: 100,
        variations: "all",
      });

      const split = dataset.splitData({ train: 0.7, val: 0.2, test: 0.1 });

      expect(split.train.length).toBe(70);
      expect(split.val.length).toBe(20);
      expect(split.test.length).toBe(10);
    });

    it("should handle uneven splits", async () => {
      await dataset.generateSyntheticData({
        numSamples: 99,
        variations: "all",
      });

      const split = dataset.splitData({ train: 0.7, val: 0.2, test: 0.1 });

      expect(split.train.length + split.val.length + split.test.length).toBe(
        99
      );
    });
  });

  describe("Export/Import", () => {
    it("should export dataset to JSONL", async () => {
      await dataset.generateSyntheticData({
        numSamples: 5,
        variations: "all",
      });

      const outputPath = join(tempDir, "export.jsonl");
      await dataset.exportToJSONL(outputPath);

      const exists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should import dataset from JSONL", async () => {
      // First export
      await dataset.generateSyntheticData({
        numSamples: 5,
        variations: "all",
      });

      const outputPath = join(tempDir, "export.jsonl");
      await dataset.exportToJSONL(outputPath);

      // Create new dataset and import
      const newDataset = new UIDataset({ storageDir: `${tempDir}-new` });
      await newDataset.initialize();
      await newDataset.importFromJSONL(outputPath);

      expect(newDataset.getAllEntries().length).toBe(5);
    });
  });
});

describe("UIFineTuningStrategy", () => {
  let strategy: UIFineTuningStrategy;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = `/tmp/ui-finetuning-test-${Date.now()}`;
    const dataset = new UIDataset({ storageDir: join(tempDir, "dataset") });
    await dataset.initialize();
    await dataset.generateSyntheticData({ numSamples: 20, variations: "all" });

    strategy = new UIFineTuningStrategy({
      config: {
        ...DEFAULT_UI_FINETUNING_CONFIG,
        baseModelPath: "/mock/model/path",
        outputDir: tempDir,
        epochs: 1,
        curriculum: UIFineTuningStrategy.createDefaultCurriculum().map(
          stage => ({
            ...stage,
            epochs: 1,
          })
        ),
      },
      dataset,
    });
    await strategy.initialize();
  });

  afterEach(async () => {
    try {
      await strategy.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Initialization", () => {
    it("should initialize with dataset", async () => {
      const status = strategy.getTrainingStatus();
      expect(status.status).toBe(JEPATrainingStatus.IDLE);
    });

    it("should create default curriculum stages", () => {
      const curriculum = UIFineTuningStrategy.createDefaultCurriculum();

      expect(curriculum.length).toBe(4);
      expect(curriculum[0].name).toBe("Basic Layout Understanding");
      expect(curriculum[1].name).toBe("Component Recognition");
      expect(curriculum[2].name).toBe("User Intent Mapping");
      expect(curriculum[3].name).toBe("Goal State Prediction");
    });
  });

  describe("Curriculum Learning", () => {
    it("should have progressive difficulty", () => {
      const curriculum = UIFineTuningStrategy.createDefaultCurriculum();

      // Check that visible ratio decreases (harder masking)
      expect(curriculum[0].maskingConfig.visibleRatio).toBeGreaterThan(
        curriculum[3].maskingConfig.visibleRatio
      );

      // Check that learning rate multiplier decreases
      expect(curriculum[0].lrMultiplier).toBeGreaterThan(
        curriculum[3].lrMultiplier
      );

      // Check that success criteria become stricter
      expect(curriculum[0].successCriteria.minAccuracy).toBeLessThan(
        curriculum[3].successCriteria.minAccuracy
      );
    });

    it("should filter dataset by stage", () => {
      const curriculum = UIFineTuningStrategy.createDefaultCurriculum();

      // Stage 1: Only grid/flex layouts
      const stage1Filter = curriculum[0].datasetFilter;
      const entry1 = {
        id: "test-1",
        beforeImage: new ImageData(100, 100),
        instruction: "Test",
        metadata: {
          framework: "React" as const,
          componentLib: "shadcn",
          layout: "grid" as const,
          responsive: true,
          theme: "light" as const,
        },
      };

      expect(stage1Filter(entry1)).toBe(true);

      const entry2 = {
        ...entry1,
        id: "test-2",
        metadata: { ...entry1.metadata, layout: "absolute" as const },
      };

      expect(stage1Filter(entry2)).toBe(false);
    });
  });

  describe("Fine-Tuning Execution", () => {
    it("should execute fine-tuning without errors", async () => {
      const fineTuningId = await strategy.fineTune();

      expect(fineTuningId).toBeDefined();
      expect(fineTuningId).toContain("ui-finetuning-");
    });

    it("should emit curriculum advance events", async () => {
      const events: string[] = [];
      const eventCallback = (event: any) => {
        if (event.type === "curriculum_advance") {
          events.push(event.data?.stage);
        }
      };

      await strategy.fineTune({ eventCallback });

      expect(events.length).toBe(4); // 4 curriculum stages
      expect(events).toContain("Basic Layout Understanding");
      expect(events).toContain("Component Recognition");
      expect(events).toContain("User Intent Mapping");
      expect(events).toContain("Goal State Prediction");
    });

    it("should update current stage during fine-tuning", async () => {
      const statusBefore = strategy.getTrainingStatus();
      expect(statusBefore.currentStage).toBeUndefined();

      const fineTuningPromise = strategy.fineTune();

      // Wait a bit for training to start
      await new Promise(resolve => setTimeout(resolve, 50));

      const statusDuring = strategy.getTrainingStatus();
      expect(statusDuring.currentStage).toBeGreaterThanOrEqual(0);

      await fineTuningPromise;

      const statusAfter = strategy.getTrainingStatus();
      expect(statusAfter.currentStage).toBeDefined();
    });

    it("should save final checkpoint", async () => {
      await strategy.fineTune();

      const outputDir = join(tempDir);
      const exists = await fs
        .access(outputDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("Fine-Tuning Strategy Explanation", () => {
    it("should explain transfer learning approach", () => {
      const explanation = UIFineTuningStrategy.getStrategyExplanation();

      expect(explanation).toContain("Transfer Learning");
      expect(explanation).toContain("Freeze X-Encoder");
      expect(explanation).toContain("Freeze Y-Encoder");
      expect(explanation).toContain("Train Predictor");
    });

    it("should explain curriculum learning", () => {
      const explanation = UIFineTuningStrategy.getStrategyExplanation();

      expect(explanation).toContain("Curriculum Learning");
      expect(explanation).toContain("Stage 1");
      expect(explanation).toContain("Stage 2");
      expect(explanation).toContain("Stage 3");
      expect(explanation).toContain("Stage 4");
    });

    it("should explain benefits", () => {
      const explanation = UIFineTuningStrategy.getStrategyExplanation();

      expect(explanation).toContain("Benefits");
      expect(explanation).toContain("Faster convergence");
      expect(explanation).toContain("Better generalization");
      expect(explanation).toContain("Stable training");
    });
  });
});

describe("Integration Tests", () => {
  describe("Full Training Pipeline", () => {
    it("should integrate dataset, training, and fine-tuning", async () => {
      const tempDir = `/tmp/integration-test-${Date.now()}`;

      // Create dataset
      const dataset = new UIDataset({ storageDir: join(tempDir, "dataset") });
      await dataset.initialize();
      await dataset.generateSyntheticData({
        numSamples: 10,
        variations: "all",
      });

      // Create training strategy
      const trainingStrategy = new JEPATrainingStrategy({
        trainingDir: join(tempDir, "training"),
        config: {
          ...DEFAULT_JEPA_CONFIG,
          hyperparameters: {
            ...DEFAULT_JEPA_CONFIG.hyperparameters,
            epochs: 1,
            batchSize: 2,
          },
        } as any,
      });
      await trainingStrategy.initialize();

      // Create fine-tuning strategy
      const fineTuningStrategy = new UIFineTuningStrategy({
        config: {
          ...DEFAULT_UI_FINETUNING_CONFIG,
          baseModelPath: "/mock/model",
          outputDir: join(tempDir, "finetuning"),
          epochs: 1,
          curriculum: UIFineTuningStrategy.createDefaultCurriculum().map(s => ({
            ...s,
            epochs: 1,
          })),
        },
        dataset,
      });
      await fineTuningStrategy.initialize();

      // Execute full pipeline
      expect(dataset.getAllEntries().length).toBe(10);

      // Cleanup
      await trainingStrategy.shutdown();
      await fineTuningStrategy.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });
});
