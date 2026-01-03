/**
 * Integration Tests for Curriculum Learning
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CurriculumScheduler } from "../src/schedulers/CurriculumScheduler.js";
import { CurriculumBuilder } from "../src/utils/CurriculumBuilder.js";
import { JEPATrainer } from "../src/trainers/JEPATrainer.js";
import { ProgressMonitor } from "../src/schedulers/ProgressMonitor.js";
import { MetricsTracker } from "../src/evaluators/MetricsTracker.js";
import { TransitionDecider } from "../src/evaluators/TransitionDecider.js";
import { ReplayBuffer } from "../src/samplers/ReplayBuffer.js";
import { DataAugmentation } from "../src/utils/DataAugmentation.js";

describe("Curriculum Integration", () => {
  describe("End-to-End Curriculum Flow", () => {
    it("should build complete curriculum", () => {
      const stages = CurriculumBuilder.buildDefault();

      expect(stages.length).toBe(4);
      expect(stages[0].type).toBe("basic");
      expect(stages[1].type).toBe("components");
      expect(stages[2].type).toBe("layouts");
      expect(stages[3].type).toBe("applications");
    });

    it("should build fast curriculum", () => {
      const stages = CurriculumBuilder.buildFast();

      expect(stages.length).toBe(4);
      expect(stages[0].config.examples).toBe(1000);
    });

    it("should build comprehensive curriculum", () => {
      const stages = CurriculumBuilder.buildComprehensive();

      expect(stages.length).toBe(4);
      expect(stages[0].config.examples).toBe(10000);
    });

    it("should use curriculum builder sequentially", () => {
      const stages = new CurriculumBuilder()
        .addStage1({ examples: 100 })
        .addStage2({ examples: 200 })
        .addStage3({ examples: 300 })
        .addStage4({ examples: 400 })
        .build();

      expect(stages.length).toBe(4);
      expect(stages[0].config.examples).toBe(100);
      expect(stages[1].config.examples).toBe(200);
      expect(stages[2].config.examples).toBe(300);
      expect(stages[3].config.examples).toBe(400);
    });
  });

  describe("Scheduler and Stages Integration", () => {
    it("should initialize scheduler with curriculum", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages });
      await scheduler.initialize(stages);

      expect(scheduler.getCurrentStage()).toBe(0);
    });

    it("should progress through all stages", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages });
      await scheduler.initialize(stages);

      // Complete all stages
      for (let i = 0; i < stages.length; i++) {
        await scheduler.startStage(i);
        scheduler.updateProgress(i, {
          epoch: stages[i].config.epochs,
          examples: stages[i].config.examples,
          loss: 0.05,
          accuracy: 0.95,
          mastery: 0.95,
        });
      }

      const progress = scheduler.getProgress();
      expect(progress.overallMastery).toBeCloseTo(1.0, 1);
    });

    it("should track stage completion times", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages });
      await scheduler.initialize(stages);

      await scheduler.startStage(0);
      await new Promise(resolve => setTimeout(resolve, 10));
      scheduler.completeStage(0);

      const progress = scheduler.getProgress();
      expect(progress.timeSpent).toBeGreaterThan(0);
    });
  });

  describe("Trainer Integration", () => {
    it("should train with curriculum examples", async () => {
      const stages = CurriculumBuilder.buildFast();
      const trainer = new JEPATrainer({ epochs: 5, batchSize: 8 });

      // Generate examples from first stage
      const examples = await stages[0].dataGenerator.generate(10);

      const result = await trainer.trainBatch(examples);
      expect(result.loss).toBeGreaterThanOrEqual(0);
      expect(result.predictions.length).toBe(10);
    });

    it("should evaluate stage progress", async () => {
      const stages = CurriculumBuilder.buildFast();
      const examples = await stages[0].dataGenerator.generate(10);
      const trainer = new JEPATrainer();

      const result = trainer.evaluate(examples);
      expect(result.accuracy).toBeGreaterThan(0);
    });
  });

  describe("Progress Monitoring", () => {
    it("should track progress across stages", () => {
      const stages = CurriculumBuilder.buildFast();
      const monitor = new ProgressMonitor(stages);

      const progress = monitor.getStageProgress(0);
      expect(progress.stage).toBe(0);
      expect(progress.status).toBe("not_started");
    });

    it("should update progress metrics", () => {
      const stages = CurriculumBuilder.buildFast();
      const monitor = new ProgressMonitor(stages);

      monitor.updateProgress(0, {
        loss: 0.3,
        accuracy: 0.7,
        mastery: 0.75,
        epoch: 5,
        examples: 500,
      });

      const progress = monitor.getStageProgress(0);
      expect(progress.loss).toBe(0.3);
      expect(progress.accuracy).toBe(0.7);
    });

    it("should detect loss stability", () => {
      const stages = CurriculumBuilder.buildFast();
      const monitor = new ProgressMonitor(stages);

      // Add decreasing loss values
      for (let i = 0; i < 10; i++) {
        monitor.updateProgress(0, {
          loss: 0.5 - i * 0.05,
          accuracy: 0.5 + i * 0.05,
          mastery: 0.5 + i * 0.05,
          epoch: i,
          examples: i * 100,
        });
      }

      expect(monitor.isLossStable(0)).toBe(true);
    });
  });

  describe("Metrics Tracking", () => {
    it("should track metrics across stages", () => {
      const tracker = new MetricsTracker();

      tracker.track({
        type: "loss",
        stageId: "stage1",
        timestamp: Date.now(),
        value: 0.3,
      });

      const metrics = tracker.getMetrics("stage1");
      expect(metrics.loss.values.length).toBe(1);
      expect(metrics.loss.values[0]).toBe(0.3);
    });

    it("should calculate metric statistics", () => {
      const tracker = new MetricsTracker();

      for (let i = 0; i < 10; i++) {
        tracker.track({
          type: "accuracy",
          stageId: "stage1",
          timestamp: Date.now(),
          value: 0.5 + i * 0.05,
        });
      }

      const metrics = tracker.getMetrics("stage1");
      expect(metrics.accuracy.mean).toBeGreaterThan(0.5);
      expect(metrics.accuracy.min).toBe(0.5);
      expect(metrics.accuracy.max).toBe(0.95);
    });

    it("should track multiple stages", () => {
      const tracker = new MetricsTracker();

      tracker.track({
        type: "loss",
        stageId: "stage1",
        timestamp: Date.now(),
        value: 0.3,
      });

      tracker.track({
        type: "loss",
        stageId: "stage2",
        timestamp: Date.now(),
        value: 0.4,
      });

      const allMetrics = tracker.getAllMetrics();
      expect(allMetrics.size).toBe(2);
    });
  });

  describe("Transition Decisions", () => {
    it("should decide not to transition with low mastery", () => {
      const decider = new TransitionDecider();
      const progress = {
        stage: 0,
        stageId: "stage1",
        epochs: 5,
        examples: 500,
        loss: 0.4,
        accuracy: 0.6,
        mastery: 0.6,
        status: "in_progress" as const,
        config: { masteryThreshold: 0.9, epochs: 10, examples: 1000, batchSize: 32, patience: 3, prerequisites: [] },
      };

      const metrics = {
        stageId: "stage1",
        loss: { values: [0.5, 0.45, 0.4], timestamps: [1, 2, 3], min: 0.4, max: 0.5, mean: 0.45, std: 0.05 },
        accuracy: { values: [0.5, 0.55, 0.6], timestamps: [1, 2, 3], min: 0.5, max: 0.6, mean: 0.55, std: 0.05 },
        mastery: { values: [0.55, 0.58, 0.6], timestamps: [1, 2, 3], min: 0.55, max: 0.6, mean: 0.58, std: 0.025 },
        timing: { values: [], timestamps: [], min: Infinity, max: -Infinity, mean: 0, std: 0 },
        custom: new Map(),
      };

      const decision = decider.shouldTransition(progress, metrics);
      expect(decision.shouldTransition).toBe(false);
    });

    it("should decide to transition when mastered", () => {
      const decider = new TransitionDecider();
      const progress = {
        stage: 0,
        stageId: "stage1",
        epochs: 10,
        examples: 1000,
        loss: 0.05,
        accuracy: 0.95,
        mastery: 0.92,
        status: "in_progress" as const,
        config: { masteryThreshold: 0.9, epochs: 10, examples: 1000, batchSize: 32, patience: 3, prerequisites: [] },
      };

      const metrics = {
        stageId: "stage1",
        loss: { values: [0.1, 0.07, 0.05], timestamps: [1, 2, 3], min: 0.05, max: 0.1, mean: 0.073, std: 0.025 },
        accuracy: { values: [0.9, 0.93, 0.95], timestamps: [1, 2, 3], min: 0.9, max: 0.95, mean: 0.927, std: 0.025 },
        mastery: { values: [0.88, 0.9, 0.92], timestamps: [1, 2, 3], min: 0.88, max: 0.92, mean: 0.9, std: 0.02 },
        timing: { values: [], timestamps: [], min: Infinity, max: -Infinity, mean: 0, std: 0 },
        custom: new Map(),
      };

      const decision = decider.shouldTransition(progress, metrics);
      expect(decision.shouldTransition).toBe(true);
    });

    it("should estimate readiness", () => {
      const decider = new TransitionDecider();
      const progress = {
        stage: 0,
        stageId: "stage1",
        epochs: 7,
        examples: 700,
        loss: 0.15,
        accuracy: 0.85,
        mastery: 0.8,
        status: "in_progress" as const,
        config: { masteryThreshold: 0.9, epochs: 10, examples: 1000, batchSize: 32, patience: 3, prerequisites: [] },
      };

      const metrics = {
        stageId: "stage1",
        loss: { values: [0.2, 0.18, 0.15], timestamps: [1, 2, 3], min: 0.15, max: 0.2, mean: 0.177, std: 0.025 },
        accuracy: { values: [0.8, 0.83, 0.85], timestamps: [1, 2, 3], min: 0.8, max: 0.85, mean: 0.827, std: 0.025 },
        mastery: { values: [0.75, 0.78, 0.8], timestamps: [1, 2, 3], min: 0.75, max: 0.8, mean: 0.777, std: 0.025 },
        timing: { values: [], timestamps: [], min: Infinity, max: -Infinity, mean: 0, std: 0 },
        custom: new Map(),
      };

      const readiness = decider.estimateReadiness(progress, metrics);
      expect(readiness).toBeGreaterThan(0);
      expect(readiness).toBeLessThanOrEqual(1);
    });
  });

  describe("Replay Buffer Integration", () => {
    it("should store and replay examples", () => {
      const buffer = new ReplayBuffer(100);

      const example = {
        id: "test1",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      buffer.add(example, 0.8);
      expect(buffer.size()).toBe(1);

      const sampled = buffer.sample(1);
      expect(sampled.length).toBe(1);
      expect(sampled[0].id).toBe("test1");
    });

    it("should prioritize high loss examples", () => {
      const buffer = new ReplayBuffer(10);

      // Add examples with different priorities (loss)
      for (let i = 0; i < 5; i++) {
        buffer.add({
          id: `test${i}`,
          stageId: "stage1",
          imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
          embedding: new Float32Array(768),
          metadata: { labels: [], attributes: {} },
          difficulty: 0.5,
          timestamp: Date.now(),
        }, i * 0.2); // Higher loss = higher priority
      }

      const sampled = buffer.sample(3);
      expect(sampled.length).toBe(3);

      // Should sample highest priority examples
      expect(sampled[0].id).toBe("test4"); // Highest priority
    });

    it("should evict lowest priority when full", () => {
      const buffer = new ReplayBuffer(3);

      buffer.add({
        id: "low",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      }, 0.1);

      buffer.add({
        id: "high1",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      }, 0.9);

      buffer.add({
        id: "high2",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      }, 0.8);

      buffer.add({
        id: "high3",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      }, 0.7);

      // Low priority should be evicted
      expect(buffer.size()).toBe(3);
      const allIds = buffer.sample(10).map(e => e.id);
      expect(allIds).not.toContain("low");
    });
  });

  describe("Data Augmentation Integration", () => {
    it("should apply flip augmentation", () => {
      const example = {
        id: "test",
        stageId: "stage1",
        imageData: {
          width: 4,
          height: 4,
          channels: 3,
          data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48]),
        },
        embedding: new Float32Array(768).fill(0.1),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      const augmented = DataAugmentation.augment(example, { flip: true });
      expect(augmented.imageData.data).not.toEqual(example.imageData.data);
    });

    it("should apply brightness adjustment", () => {
      const example = {
        id: "test",
        stageId: "stage1",
        imageData: {
          width: 2,
          height: 2,
          channels: 1,
          data: new Uint8Array([100, 150, 200, 250]),
        },
        embedding: new Float32Array(768).fill(0.1),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      const augmented = DataAugmentation.augment(example, { brightness: 0.2 });
      expect(augmented.imageData.data).not.toEqual(example.imageData.data);
    });

    it("should create mixup examples", () => {
      const example1 = {
        id: "test1",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768).fill(0.5),
        metadata: { labels: ["a"], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      const example2 = {
        id: "test2",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768).fill(0.7),
        metadata: { labels: ["b"], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      const mixed = DataAugmentation.mixup(example1, example2, 0.5);
      expect(mixed.length).toBe(1);
      expect(mixed[0].metadata.labels).toContain("a");
      expect(mixed[0].metadata.labels).toContain("b");
    });
  });

  describe("Full Training Pipeline", () => {
    it("should run simplified training pipeline", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages });
      const trainer = new JEPATrainer({ epochs: 3, batchSize: 8 });
      const tracker = new MetricsTracker();
      const decider = new TransitionDecider();

      await scheduler.initialize(stages);

      // Train first stage
      await scheduler.startStage(0);

      const examples = await stages[0].dataGenerator.generate(20);

      // Train for 3 epochs
      for (let epoch = 0; epoch < 3; epoch++) {
        const result = await trainer.trainBatch(examples);

        tracker.track({
          type: "loss",
          stageId: "stage1",
          timestamp: Date.now(),
          value: result.loss,
        });

        tracker.track({
          type: "accuracy",
          stageId: "stage1",
          timestamp: Date.now(),
          value: result.metrics.accuracy || 0,
        });

        scheduler.updateProgress(0, {
          epoch: epoch + 1,
          examples: examples.length,
          loss: result.loss,
          accuracy: 0.8,
          mastery: 0.8,
        });
      }

      const progress = scheduler.getProgress();
      expect(progress.stageProgress[0].epochs).toBe(3);
    });
  });

  describe("Example Generation", () => {
    it("should generate examples from all stages", async () => {
      const stages = CurriculumBuilder.buildFast();

      for (const stage of stages) {
        const examples = await stage.dataGenerator.generate(10);
        expect(examples.length).toBe(10);

        for (const example of examples) {
          expect(example.embedding.length).toBe(768);
          expect(example.imageData.width).toBeGreaterThan(0);
          expect(example.imageData.height).toBeGreaterThan(0);
        }
      }
    });

    it("should have 50K+ total examples across stages", async () => {
      const stages = CurriculumBuilder.buildDefault();

      let total = 0;
      for (const stage of stages) {
        total += stage.config.examples;
      }

      expect(total).toBeGreaterThanOrEqual(50000);
    });
  });

  describe("Stage Progression", () => {
    it("should respect prerequisites", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages });
      await scheduler.initialize(stages);

      // Stage 2 requires stage 1
      await expect(scheduler.startStage(1)).rejects.toThrow();

      // Complete stage 1
      await scheduler.startStage(0);
      scheduler.completeStage(0);

      // Now stage 2 should be accessible
      await scheduler.startStage(1);
      expect(scheduler.getCurrentStage()).toBe(1);
    });

    it("should auto-advance in sequential mode", async () => {
      const stages = CurriculumBuilder.buildFast();
      const scheduler = new CurriculumScheduler({ stages, strategy: "sequential" });
      await scheduler.initialize(stages);

      await scheduler.startStage(0);
      scheduler.completeStage(0);

      expect(scheduler.getCurrentStage()).toBe(1);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate example counts", () => {
      const stages = CurriculumBuilder.buildDefault();

      const stage1Examples = stages[0].config.examples;
      const stage2Examples = stages[1].config.examples;
      const stage3Examples = stages[2].config.examples;
      const stage4Examples = stages[3].config.examples;

      expect(stage1Examples).toBeGreaterThanOrEqual(5000);
      expect(stage2Examples).toBeGreaterThanOrEqual(15000);
      expect(stage3Examples).toBeGreaterThanOrEqual(20000);
      expect(stage4Examples).toBeGreaterThanOrEqual(10000);
    });

    it("should validate difficulty progression", () => {
      const stages = CurriculumBuilder.buildDefault();

      // Each stage should have appropriate difficulty
      expect(["very_easy", "easy"]).toContain(stages[0].difficulty);
      expect(["easy", "medium"]).toContain(stages[1].difficulty);
      expect(["medium", "hard"]).toContain(stages[2].difficulty);
      expect(["hard"]).toContain(stages[3].difficulty);
    });

    it("should validate mastery thresholds", () => {
      const stages = CurriculumBuilder.buildDefault();

      // Mastery thresholds should decrease as stages get harder
      const t1 = stages[0].config.masteryThreshold;
      const t2 = stages[1].config.masteryThreshold;
      const t3 = stages[2].config.masteryThreshold;
      const t4 = stages[3].config.masteryThreshold;

      expect(t1).toBeGreaterThanOrEqual(t2);
      expect(t2).toBeGreaterThanOrEqual(t3);
      expect(t3).toBeGreaterThanOrEqual(t4);
    });
  });
});
