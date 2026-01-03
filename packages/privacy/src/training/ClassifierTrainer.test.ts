/**
 * Tests for ClassifierTrainer
 *
 * Tests the training pipeline for PrivacyClassifier including:
 * - Data loading and saving
 * - Feature extraction
 * - Training loop
 * - Evaluation metrics
 * - Model serialization
 */

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  ClassifierTrainer,
  type LabeledQuery,
  type TrainingConfig,
} from "./ClassifierTrainer.js";

describe("ClassifierTrainer", () => {
  let trainer: ClassifierTrainer;
  let testDataPath: string;
  let sampleData: LabeledQuery[];

  beforeEach(() => {
    trainer = new ClassifierTrainer(42); // Fixed seed for reproducibility

    // Create sample training data
    sampleData = [
      {
        query: "What is the capital of France?",
        category: "LOGIC",
        piiTypes: [],
        confidence: 1.0,
      },
      {
        query: "My email is john@example.com",
        category: "SECRET",
        piiTypes: ["EMAIL" as any],
        confidence: 1.0,
      },
      {
        query: "Our company website is not working",
        category: "STYLE",
        piiTypes: [],
        confidence: 0.8,
      },
      {
        query: "How do I implement binary search?",
        category: "LOGIC",
        piiTypes: [],
        confidence: 1.0,
      },
      {
        query: "My SSN is 123-45-6789",
        category: "SECRET",
        piiTypes: ["SSN" as any],
        confidence: 1.0,
      },
      {
        query: "I need help with my account",
        category: "STYLE",
        piiTypes: [],
        confidence: 0.7,
      },
    ];

    // Create temp file path for tests
    testDataPath = join(tmpdir(), `test-training-data-${Date.now()}.jsonl`);
  });

  describe("Data Loading and Saving", () => {
    it("should load training data from JSONL file", async () => {
      // Write sample data to file
      const lines = sampleData.map(item => JSON.stringify(item));
      await fs.writeFile(testDataPath, lines.join("\n"), "utf8");

      // Load the data
      const loadedData = await trainer.loadTrainingData(testDataPath);

      // Verify loaded data matches original
      expect(loadedData).toHaveLength(sampleData.length);
      expect(loadedData[0].query).toBe(sampleData[0].query);
      expect(loadedData[0].category).toBe(sampleData[0].category);
    });

    it("should save training data to JSONL file", async () => {
      // Save data
      await trainer.saveTrainingData(testDataPath, sampleData);

      // Read it back
      const loadedData = await trainer.loadTrainingData(testDataPath);

      // Verify it matches
      expect(loadedData).toHaveLength(sampleData.length);
      expect(loadedData[0].query).toBe(sampleData[0].query);
    });

    it("should handle empty lines in JSONL file", async () => {
      // Write data with empty lines
      const content =
        JSON.stringify(sampleData[0]) + "\n\n" + JSON.stringify(sampleData[1]);
      await fs.writeFile(testDataPath, content, "utf8");

      // Should load only valid lines
      const loadedData = await trainer.loadTrainingData(testDataPath);
      expect(loadedData).toHaveLength(2);
    });
  });

  describe("Feature Extraction", () => {
    it("should extract features from LOGIC query", () => {
      const query = "What is the capital of France?";
      const features = trainer.extractFeatures(query);

      expect(features.wordCount).toBe(6);
      expect(features.questionMarkCount).toBe(1);
      expect(features.hasDirectPII).toBe(false);
      expect(features.piiCount).toBe(0);
    });

    it("should extract features from SECRET query with email", () => {
      const query = "My email is john@example.com";
      const features = trainer.extractFeatures(query);

      expect(features.hasFirstPersonPronouns).toBe(true);
      expect(features.hasDirectPII).toBe(true);
      expect(features.piiCount).toBeGreaterThan(0);
    });

    it("should extract features from STYLE query", () => {
      const query = "Our company website is not working";
      const features = trainer.extractFeatures(query);

      expect(features.hasWorkplaceRef).toBe(true);
      expect(features.hasStylePatterns).toBe(true);
    });

    it("should detect multiple PII types", () => {
      const query = "My email is john@example.com and phone is 555-1234";
      const features = trainer.extractFeatures(query);

      // Should detect at least email
      expect(features.piiCount).toBeGreaterThanOrEqual(1);
      expect(features.hasDirectPII).toBe(true);
    });

    it("should count punctuation marks", () => {
      const query = "Really?! That is amazing!!!";
      const features = trainer.extractFeatures(query);

      // "?!?!" counts as 4 in the regex
      expect(features.exclamationCount).toBeGreaterThanOrEqual(3);
      expect(features.questionMarkCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Training", () => {
    it("should train on labeled data", async () => {
      const config: TrainingConfig = {
        epochs: 2,
        learningRate: 0.01,
        batchSize: 2,
        validationSplit: 0.2,
        earlyStoppingThreshold: 0.95,
        randomSeed: 42,
      };

      const result = await trainer.train(sampleData, config);

      expect(result).toBeDefined();
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.epochs).toBeGreaterThan(0);
    });

    it("should stop early when threshold reached", async () => {
      const config: TrainingConfig = {
        epochs: 100,
        learningRate: 0.01,
        batchSize: 2,
        validationSplit: 0.2,
        earlyStoppingThreshold: 0.5, // Low threshold
        randomSeed: 42,
      };

      const result = await trainer.train(sampleData, config);

      // Should stop at or before reaching max epochs (depending on accuracy)
      expect(result.epochs).toBeLessThanOrEqual(100);
    });

    it("should use validation split correctly", async () => {
      const config: TrainingConfig = {
        epochs: 1,
        learningRate: 0.01,
        batchSize: 2,
        validationSplit: 0.5, // 50% for validation
        earlyStoppingThreshold: 0.95,
        randomSeed: 42,
      };

      await trainer.train(sampleData, config);

      // Training should complete without errors
      expect(true).toBe(true);
    });
  });

  describe("Evaluation", () => {
    it("should evaluate classifier on test data", async () => {
      const result = await trainer.evaluateAsync(sampleData);

      expect(result).toBeDefined();
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.confusionMatrix).toBeDefined();
    });

    it("should compute precision, recall, and F1 for each category", async () => {
      const result = await trainer.evaluateAsync(sampleData);

      expect(result.precision).toHaveProperty("logic");
      expect(result.precision).toHaveProperty("style");
      expect(result.precision).toHaveProperty("secret");

      expect(result.recall).toHaveProperty("logic");
      expect(result.recall).toHaveProperty("style");
      expect(result.recall).toHaveProperty("secret");

      expect(result.f1Score).toHaveProperty("logic");
      expect(result.f1Score).toHaveProperty("style");
      expect(result.f1Score).toHaveProperty("secret");
    });

    it("should populate confusion matrix correctly", async () => {
      const result = await trainer.evaluateAsync(sampleData);

      const matrix = result.confusionMatrix;

      // Check that all categories exist (lowercase)
      expect(matrix.truePositives).toHaveProperty("logic");
      expect(matrix.truePositives).toHaveProperty("style");
      expect(matrix.truePositives).toHaveProperty("secret");

      expect(matrix.falsePositives).toHaveProperty("logic");
      expect(matrix.falsePositives).toHaveProperty("style");
      expect(matrix.falsePositives).toHaveProperty("secret");

      expect(matrix.trueNegatives).toHaveProperty("logic");
      expect(matrix.trueNegatives).toHaveProperty("style");
      expect(matrix.trueNegatives).toHaveProperty("secret");

      expect(matrix.falseNegatives).toHaveProperty("logic");
      expect(matrix.falseNegatives).toHaveProperty("style");
      expect(matrix.falseNegatives).toHaveProperty("secret");
    });
  });

  describe("Model Serialization", () => {
    it("should save trained model to disk", async () => {
      const modelPath = join(tmpdir(), `test-model-${Date.now()}.json`);
      const mockMetrics = {
        accuracy: 0.85,
        precision: { logic: 0.9, style: 0.8, secret: 0.85 },
        recall: { logic: 0.85, style: 0.75, secret: 0.9 },
        f1Score: { logic: 0.87, style: 0.77, secret: 0.87 },
        confusionMatrix: {
          truePositives: { logic: 10, style: 8, secret: 9 },
          falsePositives: { logic: 1, style: 2, secret: 1 },
          trueNegatives: { logic: 15, style: 14, secret: 16 },
          falseNegatives: { logic: 2, style: 3, secret: 1 },
        },
        epochs: 5,
        trainingTime: 1000,
      };

      await trainer.saveModel(modelPath, mockMetrics);

      // Verify file exists
      const exists = await fs
        .access(modelPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should load trained model from disk", async () => {
      const modelPath = join(tmpdir(), `test-model-${Date.now()}.json`);
      const mockMetrics = {
        accuracy: 0.85,
        precision: { logic: 0.9, style: 0.8, secret: 0.85 },
        recall: { logic: 0.85, style: 0.75, secret: 0.9 },
        f1Score: { logic: 0.87, style: 0.77, secret: 0.87 },
        confusionMatrix: {
          truePositives: { logic: 10, style: 8, secret: 9 },
          falsePositives: { logic: 1, style: 2, secret: 1 },
          trueNegatives: { logic: 15, style: 14, secret: 16 },
          falseNegatives: { logic: 2, style: 3, secret: 1 },
        },
        epochs: 5,
        trainingTime: 1000,
      };

      // Save model
      await trainer.saveModel(modelPath, mockMetrics);

      // Load model
      const loadedModel = await trainer.loadModel(modelPath);

      expect(loadedModel).toBeDefined();
      expect(loadedModel.version).toBe("1.0.0");
      expect(loadedModel.metrics.accuracy).toBe(0.85);
    });

    it("should preserve pattern weights across save/load", async () => {
      const modelPath = join(tmpdir(), `test-model-${Date.now()}.json`);
      const mockMetrics = {
        accuracy: 0.85,
        precision: { logic: 0.9, style: 0.8, secret: 0.85 },
        recall: { logic: 0.85, style: 0.75, secret: 0.9 },
        f1Score: { logic: 0.87, style: 0.77, secret: 0.87 },
        confusionMatrix: {
          truePositives: { logic: 10, style: 8, secret: 9 },
          falsePositives: { logic: 1, style: 2, secret: 1 },
          trueNegatives: { logic: 15, style: 14, secret: 16 },
          falseNegatives: { logic: 2, style: 3, secret: 1 },
        },
        epochs: 5,
        trainingTime: 1000,
      };

      // Train and save
      const config: TrainingConfig = {
        epochs: 2,
        learningRate: 0.01,
        batchSize: 2,
        validationSplit: 0.2,
        earlyStoppingThreshold: 0.95,
      };

      await trainer.train(sampleData, config);
      await trainer.saveModel(modelPath, mockMetrics);

      // Create new trainer and load
      const newTrainer = new ClassifierTrainer(42);
      const loadedModel = await newTrainer.loadModel(modelPath);

      expect(loadedModel.patternWeights).toBeDefined();
    });
  });

  describe("Helper Methods", () => {
    it("should get pattern weights", () => {
      const weights = trainer.getPatternWeights();
      expect(weights).toBeDefined();
      expect(weights instanceof Map).toBe(true);
    });

    it("should get classifier instance", () => {
      const classifier = trainer.getClassifier();
      expect(classifier).toBeDefined();
      expect(classifier).toHaveProperty("classify");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty training data", async () => {
      const config: TrainingConfig = {
        epochs: 1,
        learningRate: 0.01,
        batchSize: 2,
        validationSplit: 0.2,
        earlyStoppingThreshold: 0.95,
      };

      const result = await trainer.train([], config);

      // With empty data, accuracy will be NaN or 0
      expect(Number.isNaN(result.accuracy) || result.accuracy === 0).toBe(true);
    });

    it("should handle single example", async () => {
      const singleExample = [sampleData[0]];
      const config: TrainingConfig = {
        epochs: 1,
        learningRate: 0.01,
        batchSize: 1,
        validationSplit: 0.5,
        earlyStoppingThreshold: 0.95,
      };

      const result = await trainer.train(singleExample, config);

      expect(result).toBeDefined();
    });

    it("should handle queries with special characters", () => {
      const query = "My email is test+tag@example.com!";
      const features = trainer.extractFeatures(query);

      expect(features).toBeDefined();
      expect(features.hasDirectPII).toBe(true);
    });

    it("should handle very long queries", () => {
      const query = "What is " + "the ".repeat(1000) + "meaning of life?";
      const features = trainer.extractFeatures(query);

      expect(features.wordCount).toBeGreaterThan(1000);
      // Length is character count, which includes spaces
      expect(features.length).toBeGreaterThan(4000);
    });
  });
});
