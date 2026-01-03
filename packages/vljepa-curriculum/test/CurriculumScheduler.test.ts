/**
 * Tests for CurriculumScheduler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CurriculumScheduler } from "../src/schedulers/CurriculumScheduler.js";
import { Stage1Basic } from "../src/stages/Stage1Basic.js";
import { Stage2Components } from "../src/stages/Stage2Components.js";
import { CurriculumBuilder } from "../src/utils/CurriculumBuilder.js";
import type { CurriculumStage } from "../src/types.js";

describe("CurriculumScheduler", () => {
  let scheduler: CurriculumScheduler;
  let stages: CurriculumStage[];

  beforeEach(() => {
    stages = CurriculumBuilder.buildFast();
    scheduler = new CurriculumScheduler({ stages });
  });

  describe("Initialization", () => {
    it("should initialize with stages", async () => {
      await scheduler.initialize(stages);
      expect(scheduler.getCurrentStage()).toBe(0);
    });

    it("should have correct config", () => {
      const config = scheduler.getConfig();
      expect(config.stages.length).toBe(4);
      expect(config.strategy).toBe("sequential");
      expect(config.pacing).toBe("dynamic");
    });

    it("should have replay enabled", () => {
      const config = scheduler.getConfig();
      expect(config.replay.enabled).toBe(true);
    });

    it("should have adaptive enabled", () => {
      const config = scheduler.getConfig();
      expect(config.adaptive.enabled).toBe(true);
    });
  });

  describe("Stage Management", () => {
    it("should start first stage", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      const progress = scheduler.getProgress();
      expect(progress.currentStage).toBe(0);
    });

    it("should not start stage without prerequisites", async () => {
      await scheduler.initialize(stages);

      await expect(scheduler.startStage(3)).rejects.toThrow();
    });

    it("should update stage progress", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.3,
        accuracy: 0.7,
        mastery: 0.75,
      });

      const progress = scheduler.getProgress();
      expect(progress.stageProgress[0].epochs).toBe(5);
      expect(progress.stageProgress[0].mastery).toBe(0.75);
    });

    it("should complete stage when mastered", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 10,
        examples: 1000,
        loss: 0.05,
        accuracy: 0.95,
        mastery: 0.92,
      });

      const progress = scheduler.getProgress();
      expect(progress.stageProgress[0].status).toBe("mastered");
    });

    it("should advance to next stage when complete", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.completeStage(0);

      const progress = scheduler.getProgress();
      expect(progress.currentStage).toBe(1);
    });
  });

  describe("Progress Tracking", () => {
    it("should track overall mastery", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.2,
        accuracy: 0.8,
        mastery: 0.8,
      });

      const progress = scheduler.getProgress();
      expect(progress.overallMastery).toBeGreaterThan(0);
    });

    it("should track time spent", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      const progress1 = scheduler.getProgress();
      expect(progress1.timeSpent).toBe(0);

      // Simulate time passing
      await new Promise(resolve => setTimeout(resolve, 10));

      scheduler.completeStage(0);

      const progress2 = scheduler.getProgress();
      expect(progress2.timeSpent).toBeGreaterThan(0);
    });

    it("should generate completion predictions", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      const progress = scheduler.getProgress();
      expect(progress.predictions.length).toBe(4);

      for (const prediction of progress.predictions) {
        expect(prediction.stage).toBeGreaterThanOrEqual(0);
        expect(prediction.estimatedEpochs).toBeGreaterThan(0);
        expect(prediction.confidence).toBeGreaterThan(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Transition Logic", () => {
    it("should transition when mastery threshold met", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 8,
        examples: 800,
        loss: 0.08,
        accuracy: 0.9,
        mastery: 0.91,
      });

      expect(scheduler.shouldTransition(0)).toBe(true);
    });

    it("should not transition with low mastery", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.3,
        accuracy: 0.6,
        mastery: 0.7,
      });

      expect(scheduler.shouldTransition(0)).toBe(false);
    });

    it("should not transition with insufficient epochs", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 2,
        examples: 200,
        loss: 0.05,
        accuracy: 0.95,
        mastery: 0.95,
      });

      expect(scheduler.shouldTransition(0)).toBe(false);
    });
  });

  describe("Replay Buffer", () => {
    it("should add examples to replay buffer", async () => {
      await scheduler.initialize(stages);

      const example = {
        id: "test1",
        stageId: "stage1",
        imageData: { width: 64, height: 64, channels: 3, data: new Uint8Array(64 * 64 * 3) },
        embedding: new Float32Array(768),
        metadata: { labels: [], attributes: {} },
        difficulty: 0.5,
        timestamp: Date.now(),
      };

      scheduler.addToReplayBuffer(example, 0.5);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should sample replay examples", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.3,
        accuracy: 0.7,
        mastery: 0.75,
      });

      const batch = scheduler.getBatch(32);
      // Batch should be returned (empty if no replay)
      expect(Array.isArray(batch)).toBe(true);
    });
  });

  describe("Event History", () => {
    it("should record stage started event", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      const history = scheduler.getEventHistory();
      const stageStartedEvent = history.find(e => e.type === "stage_started");

      expect(stageStartedEvent).toBeDefined();
      expect(stageStartedEvent!.stage).toBe(0);
    });

    it("should record progress updated event", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.3,
        accuracy: 0.7,
        mastery: 0.75,
      });

      const history = scheduler.getEventHistory();
      const progressEvent = history.find(e => e.type === "progress_updated");

      expect(progressEvent).toBeDefined();
    });

    it("should record stage completed event", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.completeStage(0);

      const history = scheduler.getEventHistory();
      const completedEvent = history.find(e => e.type === "stage_completed");

      expect(completedEvent).toBeDefined();
    });
  });

  describe("Reset", () => {
    it("should reset to initial state", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      scheduler.updateProgress(0, {
        epoch: 5,
        examples: 500,
        loss: 0.3,
        accuracy: 0.7,
        mastery: 0.75,
      });

      scheduler.reset();

      expect(scheduler.getCurrentStage()).toBe(0);
      const history = scheduler.getEventHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should accept custom strategy", () => {
      const customScheduler = new CurriculumScheduler({
        stages,
        strategy: "adaptive",
      });

      const config = customScheduler.getConfig();
      expect(config.strategy).toBe("adaptive");
    });

    it("should accept custom pacing", () => {
      const customScheduler = new CurriculumScheduler({
        stages,
        pacing: "fixed",
      });

      const config = customScheduler.getConfig();
      expect(config.pacing).toBe("fixed");
    });

    it("should accept custom replay config", () => {
      const customScheduler = new CurriculumScheduler({
        stages,
        replay: {
          enabled: false,
          bufferSize: 500,
          strategy: ["uniform"],
          frequency: 10,
        },
      });

      const config = customScheduler.getConfig();
      expect(config.replay.enabled).toBe(false);
      expect(config.replay.bufferSize).toBe(500);
    });
  });

  describe("Stage Completion", () => {
    it("should mark curriculum as completed", async () => {
      await scheduler.initialize(stages);

      // Complete all stages
      for (let i = 0; i < 4; i++) {
        await scheduler.startStage(i);
        scheduler.completeStage(i);
      }

      const history = scheduler.getEventHistory();
      const completedEvent = history.find(e => e.type === "curriculum_completed");

      expect(completedEvent).toBeDefined();
    });

    it("should calculate correct overall mastery", async () => {
      await scheduler.initialize(stages);

      // Complete first stage
      await scheduler.startStage(0);
      scheduler.updateProgress(0, {
        epoch: 10,
        examples: 1000,
        loss: 0.05,
        accuracy: 0.95,
        mastery: 0.92,
      });

      const progress = scheduler.getProgress();
      expect(progress.overallMastery).toBeCloseTo(0.25, 1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty stage list", async () => {
      const emptyScheduler = new CurriculumScheduler({ stages: [] });
      await emptyScheduler.initialize([]);

      expect(emptyScheduler.getCurrentStage()).toBe(0);
    });

    it("should handle invalid stage index", async () => {
      await scheduler.initialize(stages);

      await expect(scheduler.startStage(-1)).rejects.toThrow();
      await expect(scheduler.startStage(10)).rejects.toThrow();
    });

    it("should handle rapid progress updates", async () => {
      await scheduler.initialize(stages);
      await scheduler.startStage(0);

      for (let i = 0; i < 100; i++) {
        scheduler.updateProgress(0, {
          epoch: i,
          examples: i * 100,
          loss: 0.5 - i * 0.01,
          accuracy: 0.5 + i * 0.005,
          mastery: 0.5 + i * 0.005,
        });
      }

      const progress = scheduler.getProgress();
      expect(progress.stageProgress[0].epochs).toBe(99);
    });
  });
});
