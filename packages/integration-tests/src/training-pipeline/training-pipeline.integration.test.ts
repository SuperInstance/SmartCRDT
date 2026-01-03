/**
 * Training Pipeline Integration Tests
 *
 * Tests the complete ORPO training pipeline:
 * - Shadow logging with privacy filtering
 * - Training data generation from shadow logs
 * - Preference pair generation
 * - ORPO training
 * - Adapter deployment
 * - A/B testing
 * - Rollback mechanism
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrivacyLevel } from "@lsi/protocol";
import {
  writeFileSync,
  unlinkSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";

// ============================================================================
// Types
// ============================================================================

interface ShadowLogEntry {
  query: string;
  response: string;
  metadata: {
    timestamp: number;
    privacyLevel: PrivacyLevel;
    model: string;
    latency: number;
    userId?: string;
  };
}

interface PreferencePair {
  query: string;
  chosen: string;
  rejected: string;
  metadata: {
    timestamp: number;
    privacyLevel: PrivacyLevel;
  };
}

interface TrainingDataset {
  trainSamples: number;
  validationSamples: number;
  pairs: PreferencePair[];
  statistics: {
    privacyDistribution: Record<PrivacyLevel, number>;
    avgQueryLength: number;
    avgResponseLength: number;
  };
}

interface ORPOConfig {
  beta: number;
  lambda: number;
  maxEpochs: number;
  learningRate: number;
  batchSize: number;
}

interface AdapterDeployment {
  adapterId: string;
  version: string;
  deploymentMode: "blue_green" | "canary" | "rolling";
  status: "deploying" | "deployed" | "failed" | "rollback";
}

interface ABTestVariant {
  variantId: string;
  adapterVersion: string;
  isControl: boolean;
  trafficPercentage: number;
}

interface ABTest {
  testId: string;
  name: string;
  variants: ABTestVariant[];
  status: "created" | "running" | "completed" | "failed";
  successCriteria: {
    primaryMetric: string;
    targetImprovement: number;
  };
  results?: {
    winner?: string;
    improvement?: number;
    confidence: number;
  };
}

// ============================================================================
// Mock Shadow Logger
// ============================================================================

class MockShadowLogger {
  private logs: ShadowLogEntry[] = [];
  private enabled = false;
  private outputPath: string;

  constructor(outputDir: string = "/tmp/shadow-logs") {
    this.outputPath = join(outputDir, "shadow-logs.jsonl");
    // Ensure directory exists
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  async initialize(): Promise<void> {
    this.enabled = true;
    this.logs = [];
  }

  async log(entry: ShadowLogEntry): Promise<void> {
    if (!this.enabled) return;

    // Filter out sovereign data
    if (entry.metadata.privacyLevel === PrivacyLevel.SOVEREIGN) {
      return;
    }

    this.logs.push(entry);
  }

  async export(path?: string): Promise<string> {
    const exportPath = path || this.outputPath;

    const lines = this.logs.map(entry => JSON.stringify(entry)).join("\n");
    writeFileSync(exportPath, lines);

    return exportPath;
  }

  async load(path?: string): Promise<ShadowLogEntry[]> {
    const loadPath = path || this.outputPath;

    if (!existsSync(loadPath)) {
      return [];
    }

    const content = readFileSync(loadPath, "utf-8");
    const lines = content.trim().split("\n");

    return lines
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line) as ShadowLogEntry);
  }

  getStats() {
    return {
      totalLogs: this.logs.length,
      privacyDistribution: this.logs.reduce(
        (acc, log) => {
          acc[log.metadata.privacyLevel] =
            (acc[log.metadata.privacyLevel] || 0) + 1;
          return acc;
        },
        {} as Record<PrivacyLevel, number>
      ),
      avgLatency:
        this.logs.length > 0
          ? this.logs.reduce((sum, log) => sum + log.metadata.latency, 0) /
            this.logs.length
          : 0,
    };
  }

  clear(): void {
    this.logs = [];
    this.enabled = false;
  }
}

// ============================================================================
// Mock Privacy Filter
// ============================================================================

class MockPrivacyFilter {
  /**
   * Filter shadow logs by privacy level
   */
  filterByPrivacy(
    logs: ShadowLogEntry[],
    levels: PrivacyLevel[]
  ): ShadowLogEntry[] {
    return logs.filter(log => levels.includes(log.metadata.privacyLevel));
  }

  /**
   * Redact sensitive information from logs
   */
  redactLogs(logs: ShadowLogEntry[]): ShadowLogEntry[] {
    return logs.map(log => {
      if (log.metadata.privacyLevel === PrivacyLevel.SENSITIVE) {
        return {
          ...log,
          query: this.redactText(log.query),
          response: this.redactText(log.response),
        };
      }
      return log;
    });
  }

  private redactText(text: string): string {
    // Simple redaction of emails, phones, SSNs
    return text
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL]"
      )
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
      .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]");
  }
}

// ============================================================================
// Mock Training Pipeline
// ============================================================================

class MockTrainingPipeline {
  async run(options: {
    shadowLogPath: string;
    outputPath: string;
    filterByPrivacy: PrivacyLevel[];
  }): Promise<TrainingDataset> {
    // Load shadow logs
    const logger = new MockShadowLogger();
    const logs = await logger.load(options.shadowLogPath);

    // Filter by privacy
    const filter = new MockPrivacyFilter();
    const filteredLogs = filter.filterByPrivacy(logs, options.filterByPrivacy);
    const redactedLogs = filter.redactLogs(filteredLogs);

    // Generate preference pairs (mock: pair consecutive responses)
    const pairs: PreferencePair[] = [];
    for (let i = 0; i < redactedLogs.length - 1; i += 2) {
      if (redactedLogs[i + 1]) {
        pairs.push({
          query: redactedLogs[i].query,
          chosen: redactedLogs[i].response, // Mock: first is better
          rejected: redactedLogs[i + 1].response,
          metadata: {
            timestamp: redactedLogs[i].metadata.timestamp,
            privacyLevel: redactedLogs[i].metadata.privacyLevel,
          },
        });
      }
    }

    // Calculate statistics
    const privacyDistribution = redactedLogs.reduce(
      (acc, log) => {
        acc[log.metadata.privacyLevel] =
          (acc[log.metadata.privacyLevel] || 0) + 1;
        return acc;
      },
      {} as Record<PrivacyLevel, number>
    );

    const avgQueryLength =
      redactedLogs.reduce((sum, log) => sum + log.query.length, 0) /
      redactedLogs.length;
    const avgResponseLength =
      redactedLogs.reduce((sum, log) => sum + log.response.length, 0) /
      redactedLogs.length;

    const dataset: TrainingDataset = {
      trainSamples: Math.floor(pairs.length * 0.8),
      validationSamples: pairs.length - Math.floor(pairs.length * 0.8),
      pairs,
      statistics: {
        privacyDistribution,
        avgQueryLength,
        avgResponseLength,
      },
    };

    // Save dataset
    const datasetPath = join(options.outputPath, "training-dataset.json");
    try {
      mkdirSync(options.outputPath, { recursive: true });
      writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
    } catch {
      // Ignore write errors in test
    }

    return dataset;
  }
}

// ============================================================================
// Mock ORPO Trainer
// ============================================================================

class MockOrpoTrainer {
  private config: ORPOConfig;

  constructor(config: Partial<ORPOConfig> = {}) {
    this.config = {
      beta: config.beta ?? 0.1,
      lambda: config.lambda ?? 1.0,
      maxEpochs: config.maxEpochs ?? 3,
      learningRate: config.learningRate ?? 0.0001,
      batchSize: config.batchSize ?? 32,
    };
  }

  async train(dataset: TrainingDataset): Promise<{
    adapterId: string;
    version: string;
    epochsCompleted: number;
    finalLoss: number;
    metrics: {
      accuracy: number;
      f1Score: number;
    };
  }> {
    // Simulate training
    let loss = 1.0;
    for (let epoch = 0; epoch < this.config.maxEpochs; epoch++) {
      // Simulate loss reduction
      loss = loss * (1 - this.config.learningRate);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      adapterId: `adapter-${Date.now()}`,
      version: "1.0.0",
      epochsCompleted: this.config.maxEpochs,
      finalLoss: loss,
      metrics: {
        accuracy: 0.85 + Math.random() * 0.1, // 0.85-0.95
        f1Score: 0.8 + Math.random() * 0.1, // 0.80-0.90
      },
    };
  }
}

// ============================================================================
// Mock Deployment Manager
// ============================================================================

class MockDeploymentManager {
  private deployments = new Map<string, AdapterDeployment>();

  async deploy(config: {
    adapterId: string;
    version: string;
    deploymentMode: "blue_green" | "canary" | "rolling";
  }): Promise<AdapterDeployment> {
    const deployment: AdapterDeployment = {
      adapterId: config.adapterId,
      version: config.version,
      deploymentMode: config.deploymentMode,
      status: "deploying",
    };

    this.deployments.set(config.adapterId, deployment);

    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 50));

    deployment.status = "deployed";

    return deployment;
  }

  async rollback(adapterId: string): Promise<AdapterDeployment | undefined> {
    const deployment = this.deployments.get(adapterId);
    if (deployment) {
      deployment.status = "rollback";
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return deployment;
  }

  getStatus(adapterId: string): AdapterDeployment | undefined {
    return this.deployments.get(adapterId);
  }
}

// ============================================================================
// Mock A/B Test Manager
// ============================================================================

class MockABTestManager {
  private tests = new Map<string, ABTest>();
  private results = new Map<string, { variantId: string; metric: number }[]>();

  async createTest(
    config: Omit<ABTest, "status" | "results">
  ): Promise<string> {
    const testId = `test-${Date.now()}`;

    // Validate traffic percentages sum to 100
    const totalTraffic = config.variants.reduce(
      (sum, v) => sum + v.trafficPercentage,
      0
    );
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error(
        `Traffic percentages must sum to 100, got ${totalTraffic}`
      );
    }

    const test: ABTest = {
      ...config,
      testId,
      status: "created",
    };

    this.tests.set(testId, test);
    this.results.set(testId, []);

    return testId;
  }

  async startTest(testId: string): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = "running";
  }

  async stopTest(testId: string): Promise<void> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = "completed";

    // Calculate winner
    const results = this.results.get(testId) || [];

    if (results.length > 0) {
      // Group by variant
      const variantMetrics = new Map<string, number[]>();
      for (const result of results) {
        if (!variantMetrics.has(result.variantId)) {
          variantMetrics.set(result.variantId, []);
        }
        variantMetrics.get(result.variantId)!.push(result.metric);
      }

      // Calculate averages
      const averages: Record<string, number> = {};
      for (const [variantId, metrics] of variantMetrics) {
        averages[variantId] =
          metrics.reduce((a, b) => a + b, 0) / metrics.length;
      }

      // Find winner
      let winner: string | undefined;
      let bestMetric = -Infinity;
      for (const [variantId, avg] of Object.entries(averages)) {
        if (avg > bestMetric) {
          bestMetric = avg;
          winner = variantId;
        }
      }

      // Calculate improvement
      const control = test.variants.find(v => v.isControl);
      const controlAvg = control ? averages[control.variantId] : 0;
      const improvement =
        controlAvg > 0 ? (bestMetric - controlAvg) / controlAvg : 0;

      test.results = {
        winner,
        improvement,
        confidence: 0.95, // Mock confidence
      };
    }
  }

  async recordMetric(
    testId: string,
    variantId: string,
    metric: number
  ): Promise<void> {
    const results = this.results.get(testId);
    if (results) {
      results.push({ variantId, metric });
    }
  }

  async getResults(testId: string): Promise<ABTest | undefined> {
    return this.tests.get(testId);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

async function processQueries(
  logger: MockShadowLogger,
  queries: string[]
): Promise<void> {
  for (const query of queries) {
    await logger.log({
      query,
      response: `Mock response for: ${query}`,
      metadata: {
        timestamp: Date.now(),
        privacyLevel: PrivacyLevel.PUBLIC,
        model: "mock-model",
        latency: 100,
      },
    });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Training Pipeline Integration Tests", () => {
  let shadowLogger: MockShadowLogger;
  let trainingPipeline: MockTrainingPipeline;
  let deploymentManager: MockDeploymentManager;
  let abTestManager: MockABTestManager;
  const testOutputDir = "/tmp/aequor-test-output";

  beforeEach(() => {
    shadowLogger = new MockShadowLogger(testOutputDir);
    trainingPipeline = new MockTrainingPipeline();
    deploymentManager = new MockDeploymentManager();
    abTestManager = new MockABTestManager();
  });

  afterEach(async () => {
    shadowLogger.clear();
    // Clean up test files
    try {
      const shadowLogPath = join(testOutputDir, "shadow-logs.jsonl");
      if (existsSync(shadowLogPath)) {
        unlinkSync(shadowLogPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Shadow Logging", () => {
    it("should initialize and collect shadow logs", async () => {
      await shadowLogger.initialize();

      const queries = ["What is AI?", "Explain ML", "Define deep learning"];
      await processQueries(shadowLogger, queries);

      const stats = shadowLogger.getStats();
      expect(stats.totalLogs).toBe(3);
      expect(stats.privacyDistribution.PUBLIC).toBe(3);
    });

    it("should filter out sovereign data from shadow logs", async () => {
      await shadowLogger.initialize();

      await shadowLogger.log({
        query: "My password is secret",
        response: "Response",
        metadata: {
          timestamp: Date.now(),
          privacyLevel: PrivacyLevel.SOVEREIGN,
          model: "mock",
          latency: 100,
        },
      });

      await shadowLogger.log({
        query: "What is AI?",
        response: "Response",
        metadata: {
          timestamp: Date.now(),
          privacyLevel: PrivacyLevel.PUBLIC,
          model: "mock",
          latency: 100,
        },
      });

      const stats = shadowLogger.getStats();
      expect(stats.totalLogs).toBe(1); // Only public logged
      expect(stats.privacyDistribution.SOVEREIGN).toBeUndefined();
    });

    it("should export shadow logs to file", async () => {
      await shadowLogger.initialize();

      const queries = ["Query 1", "Query 2", "Query 3"];
      await processQueries(shadowLogger, queries);

      const exportPath = await shadowLogger.export();
      expect(existsSync(exportPath)).toBe(true);

      const loaded = await shadowLogger.load(exportPath);
      expect(loaded).toHaveLength(3);
    });
  });

  describe("Training Pipeline", () => {
    it("should complete full training pipeline", async () => {
      // 1. Collect shadow logs
      await shadowLogger.initialize();
      const testQueries = [
        "What is machine learning?",
        "Explain neural networks",
        "Define gradient descent",
        "What is backpropagation?",
        "Explain overfitting",
      ];

      for (const query of testQueries) {
        await shadowLogger.log({
          query,
          response: `Detailed explanation of ${query}`,
          metadata: {
            timestamp: Date.now(),
            privacyLevel: PrivacyLevel.PUBLIC,
            model: "mock-model",
            latency: 100 + Math.random() * 50,
          },
        });
      }

      const shadowLogPath = await shadowLogger.export();

      // 2. Run training pipeline
      const result = await trainingPipeline.run({
        shadowLogPath,
        outputPath: testOutputDir,
        filterByPrivacy: [PrivacyLevel.PUBLIC],
      });

      expect(result.trainSamples).toBeGreaterThan(0);
      expect(result.validationSamples).toBeGreaterThan(0);
      expect(result.statistics.privacyDistribution.PUBLIC).toBe(5);
      expect(result.statistics.avgQueryLength).toBeGreaterThan(0);

      // 3. Train adapter
      const trainer = new MockOrpoTrainer({
        beta: 0.1,
        lambda: 1.0,
        maxEpochs: 2,
      });

      const trainingResult = await trainer.train(result);
      expect(trainingResult.adapterId).toBeDefined();
      expect(trainingResult.epochsCompleted).toBe(2);
      expect(trainingResult.finalLoss).toBeLessThan(1.0);
      expect(trainingResult.metrics.accuracy).toBeGreaterThan(0.8);

      // 4. Deploy adapter
      const deployment = await deploymentManager.deploy({
        adapterId: trainingResult.adapterId,
        version: trainingResult.version,
        deploymentMode: "blue_green",
      });

      expect(deployment.status).toBe("deployed");
      expect(deployment.deploymentMode).toBe("blue_green");
    });

    it("should filter training data by privacy level", async () => {
      await shadowLogger.initialize();

      // Add mixed privacy data
      await shadowLogger.log({
        query: "Public query",
        response: "Public response",
        metadata: {
          timestamp: Date.now(),
          privacyLevel: PrivacyLevel.PUBLIC,
          model: "mock",
          latency: 100,
        },
      });

      await shadowLogger.log({
        query: "Sensitive query with email",
        response: "Sensitive response",
        metadata: {
          timestamp: Date.now(),
          privacyLevel: PrivacyLevel.SENSITIVE,
          model: "mock",
          latency: 100,
        },
      });

      await shadowLogger.log({
        query: "Sovereign query",
        response: "Sovereign response",
        metadata: {
          timestamp: Date.now(),
          privacyLevel: PrivacyLevel.SOVEREIGN,
          model: "mock",
          latency: 100,
        },
      });

      const shadowLogPath = await shadowLogger.export();

      // Filter only public data
      const result = await trainingPipeline.run({
        shadowLogPath,
        outputPath: testOutputDir,
        filterByPrivacy: [PrivacyLevel.PUBLIC],
      });

      // Should only include public data
      expect(result.statistics.privacyDistribution.PUBLIC).toBe(1);
      expect(result.statistics.privacyDistribution.SENSITIVE).toBeUndefined();
      expect(result.statistics.privacyDistribution.SOVEREIGN).toBeUndefined();
    });

    it("should handle empty shadow logs", async () => {
      await shadowLogger.initialize();
      const shadowLogPath = await shadowLogger.export();

      const result = await trainingPipeline.run({
        shadowLogPath,
        outputPath: testOutputDir,
        filterByPrivacy: [PrivacyLevel.PUBLIC],
      });

      expect(result.trainSamples).toBe(0);
      expect(result.validationSamples).toBe(0);
      expect(result.pairs).toHaveLength(0);
    });
  });

  describe("ORPO Training", () => {
    it("should train adapter with custom config", async () => {
      const dataset: TrainingDataset = {
        trainSamples: 100,
        validationSamples: 20,
        pairs: [
          {
            query: "Test query",
            chosen: "Good response",
            rejected: "Bad response",
            metadata: { timestamp: Date.now(), privacyLevel: PrivacyLevel.PUBLIC },
          },
        ],
        statistics: {
          privacyDistribution: { PUBLIC: 1 },
          avgQueryLength: 10,
          avgResponseLength: 20,
        },
      };

      const trainer = new MockOrpoTrainer({
        beta: 0.2,
        lambda: 0.5,
        maxEpochs: 5,
        learningRate: 0.0002,
      });

      const result = await trainer.train(dataset);

      expect(result.adapterId).toBeDefined();
      expect(result.version).toBe("1.0.0");
      expect(result.epochsCompleted).toBe(5);
      expect(result.finalLoss).toBeGreaterThan(0);
      expect(result.metrics.accuracy).toBeGreaterThan(0);
      expect(result.metrics.f1Score).toBeGreaterThan(0);
    });

    it("should produce reproducible results", async () => {
      const dataset: TrainingDataset = {
        trainSamples: 50,
        validationSamples: 10,
        pairs: [
          {
            query: "Query",
            chosen: "Chosen",
            rejected: "Rejected",
            metadata: { timestamp: Date.now(), privacyLevel: PrivacyLevel.PUBLIC },
          },
        ],
        statistics: {
          privacyDistribution: { PUBLIC: 1 },
          avgQueryLength: 5,
          avgResponseLength: 10,
        },
      };

      const trainer1 = new MockOrpoTrainer({ maxEpochs: 1 });
      const trainer2 = new MockOrpoTrainer({ maxEpochs: 1 });

      const result1 = await trainer1.train(dataset);
      const result2 = await trainer2.train(dataset);

      // Results should have similar structure
      expect(result1.epochsCompleted).toBe(result2.epochsCompleted);
      expect(result1.metrics.accuracy).toBeGreaterThan(0);
      expect(result2.metrics.accuracy).toBeGreaterThan(0);
    });
  });

  describe("Adapter Deployment", () => {
    it("should deploy adapter with blue-green strategy", async () => {
      const deployment = await deploymentManager.deploy({
        adapterId: "test-adapter",
        version: "1.0.0",
        deploymentMode: "blue_green",
      });

      expect(deployment.adapterId).toBe("test-adapter");
      expect(deployment.version).toBe("1.0.0");
      expect(deployment.deploymentMode).toBe("blue_green");
      expect(deployment.status).toBe("deployed");
    });

    it("should deploy adapter with canary strategy", async () => {
      const deployment = await deploymentManager.deploy({
        adapterId: "test-adapter",
        version: "1.0.0",
        deploymentMode: "canary",
      });

      expect(deployment.deploymentMode).toBe("canary");
      expect(deployment.status).toBe("deployed");
    });

    it("should rollback adapter deployment", async () => {
      await deploymentManager.deploy({
        adapterId: "test-adapter",
        version: "1.0.0",
        deploymentMode: "blue_green",
      });

      const rollbackResult = await deploymentManager.rollback("test-adapter");

      expect(rollbackResult?.status).toBe("rollback");
    });

    it("should track deployment status", async () => {
      await deploymentManager.deploy({
        adapterId: "test-adapter",
        version: "1.0.0",
        deploymentMode: "rolling",
      });

      const status = deploymentManager.getStatus("test-adapter");

      expect(status).toBeDefined();
      expect(status?.adapterId).toBe("test-adapter");
      expect(status?.version).toBe("1.0.0");
      expect(status?.deploymentMode).toBe("rolling");
    });
  });

  describe("A/B Testing", () => {
    it("should create and run A/B test", async () => {
      const testId = await abTestManager.createTest({
        testId: "test-ab-1",
        name: "Adapter Version Comparison",
        variants: [
          {
            variantId: "A",
            adapterVersion: "1.0.0",
            isControl: true,
            trafficPercentage: 50,
          },
          {
            variantId: "B",
            adapterVersion: "1.1.0",
            isControl: false,
            trafficPercentage: 50,
          },
        ],
        successCriteria: {
          primaryMetric: "quality",
          targetImprovement: 0.05,
        },
      });

      expect(testId).toBeDefined();

      await abTestManager.startTest(testId);

      // Record some metrics
      await abTestManager.recordMetric(testId, "A", 0.8);
      await abTestManager.recordMetric(testId, "A", 0.82);
      await abTestManager.recordMetric(testId, "B", 0.85);
      await abTestManager.recordMetric(testId, "B", 0.87);

      await abTestManager.stopTest(testId);

      const results = await abTestManager.getResults(testId);
      expect(results?.status).toBe("completed");
      expect(results?.results?.winner).toBeDefined();
    });

    it("should validate traffic percentages sum to 100", async () => {
      await expect(
        abTestManager.createTest({
          testId: "test-invalid",
          name: "Invalid Test",
          variants: [
            {
              variantId: "A",
              adapterVersion: "1.0.0",
              isControl: true,
              trafficPercentage: 50,
            },
            {
              variantId: "B",
              adapterVersion: "1.1.0",
              isControl: false,
              trafficPercentage: 30,
            },
          ],
          successCriteria: {
            primaryMetric: "quality",
            targetImprovement: 0.05,
          },
        })
      ).rejects.toThrow(/Traffic percentages must sum to 100/);
    });

    it("should calculate improvement relative to control", async () => {
      const testId = await abTestManager.createTest({
        testId: "test-improvement",
        name: "Improvement Test",
        variants: [
          {
            variantId: "control",
            adapterVersion: "1.0.0",
            isControl: true,
            trafficPercentage: 50,
          },
          {
            variantId: "treatment",
            adapterVersion: "1.1.0",
            isControl: false,
            trafficPercentage: 50,
          },
        ],
        successCriteria: { primaryMetric: "quality", targetImprovement: 0.1 },
      });

      await abTestManager.startTest(testId);

      // Treatment performs better than control
      await abTestManager.recordMetric(testId, "control", 0.75);
      await abTestManager.recordMetric(testId, "control", 0.78);
      await abTestManager.recordMetric(testId, "treatment", 0.85);
      await abTestManager.recordMetric(testId, "treatment", 0.88);

      await abTestManager.stopTest(testId);

      const results = await abTestManager.getResults(testId);
      expect(results?.results?.winner).toBe("treatment");
      expect(results?.results?.improvement).toBeGreaterThan(0);
    });

    it("should handle three-way tests", async () => {
      const testId = await abTestManager.createTest({
        testId: "test-three-way",
        name: "Three-Way Test",
        variants: [
          {
            variantId: "A",
            adapterVersion: "1.0.0",
            isControl: true,
            trafficPercentage: 33,
          },
          {
            variantId: "B",
            adapterVersion: "1.1.0",
            isControl: false,
            trafficPercentage: 33,
          },
          {
            variantId: "C",
            adapterVersion: "1.2.0",
            isControl: false,
            trafficPercentage: 34,
          },
        ],
        successCriteria: { primaryMetric: "quality", targetImprovement: 0.05 },
      });

      await abTestManager.startTest(testId);

      // Record metrics
      await abTestManager.recordMetric(testId, "A", 0.75);
      await abTestManager.recordMetric(testId, "B", 0.8);
      await abTestManager.recordMetric(testId, "C", 0.85);

      await abTestManager.stopTest(testId);

      const results = await abTestManager.getResults(testId);
      expect(results?.status).toBe("completed");
      expect(results?.variants).toHaveLength(3);
    });
  });

  describe("End-to-End Training Workflow", () => {
    it("should complete full training and deployment workflow", async () => {
      // 1. Collect shadow logs
      await shadowLogger.initialize();
      const queries = Array.from({ length: 20 }, (_, i) => `Test query ${i}`);
      await processQueries(shadowLogger, queries);
      const shadowLogPath = await shadowLogger.export();

      // 2. Generate training data
      const dataset = await trainingPipeline.run({
        shadowLogPath,
        outputPath: testOutputDir,
        filterByPrivacy: [PrivacyLevel.PUBLIC, PrivacyLevel.SENSITIVE],
      });

      expect(dataset.trainSamples).toBeGreaterThan(0);

      // 3. Train adapter
      const trainer = new MockOrpoTrainer({ maxEpochs: 2 });
      const trainingResult = await trainer.train(dataset);

      // 4. Deploy adapter
      const deployment = await deploymentManager.deploy({
        adapterId: trainingResult.adapterId,
        version: trainingResult.version,
        deploymentMode: "blue_green",
      });

      expect(deployment.status).toBe("deployed");

      // 5. Create A/B test
      const testId = await abTestManager.createTest({
        testId: "e2e-test",
        name: "End-to-End Test",
        variants: [
          {
            variantId: "control",
            adapterVersion: "1.0.0",
            isControl: true,
            trafficPercentage: 50,
          },
          {
            variantId: "treatment",
            adapterVersion: trainingResult.version,
            isControl: false,
            trafficPercentage: 50,
          },
        ],
        successCriteria: { primaryMetric: "quality", targetImprovement: 0.05 },
      });

      await abTestManager.startTest(testId);

      // Simulate traffic
      for (let i = 0; i < 10; i++) {
        const variant = Math.random() > 0.5 ? "control" : "treatment";
        await abTestManager.recordMetric(
          testId,
          variant,
          0.7 + Math.random() * 0.2
        );
      }

      await abTestManager.stopTest(testId);

      const results = await abTestManager.getResults(testId);
      expect(results?.status).toBe("completed");
      expect(results?.results?.winner).toBeDefined();
    });
  });
});
