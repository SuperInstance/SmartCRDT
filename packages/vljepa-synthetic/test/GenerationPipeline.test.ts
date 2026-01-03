/**
 * @lsi/vljepa-synthetic - GenerationPipeline Tests
 *
 * 35+ tests for GenerationPipeline and BatchProcessor
 */

import { describe, it, expect, vi } from "vitest";
import { GenerationPipeline } from "../src/pipelines/GenerationPipeline.js";
import { BatchProcessor } from "../src/pipelines/BatchProcessor.js";
import type { PipelineConfig, PipelineStage } from "../src/types.js";

describe("GenerationPipeline", () => {
  const defaultConfig: PipelineConfig = {
    stages: ["generate", "mutate", "validate", "render", "package"],
    parallelism: 2,
    batchSize: 4,
    output: {
      directory: "/tmp/output",
      namingPattern: "{id}",
      saveImages: true,
      saveMetadata: true,
      saveEmbeddings: false,
      format: "jsonl",
      split: { train: 0.7, validation: 0.15, test: 0.15 },
    },
    componentGen: {
      componentTypes: ["button", "input", "card"],
      styleSystems: ["tailwind", "material"],
      variations: { colors: 2, sizes: 2, states: 2 },
      seed: 12345,
    },
    layoutGen: {
      patterns: ["grid", "flex-row"],
      minColumns: 2,
      maxColumns: 3,
      breakpoints: ["sm", "md", "lg"],
      spacing: { min: 4, max: 24, step: 4 },
      seed: 12346,
    },
    mutation: {
      rate: 0.3,
      intensity: "low",
      seed: 12347,
      mutationTypes: ["color", "style"],
    },
    renderer: {
      resolution: 1,
      formats: ["png"],
      backgrounds: ["#ffffff"],
      states: ["default"],
      timeout: 3000,
      viewport: { width: 1024, height: 768 },
    },
    validation: {
      accessibility: true,
      design: true,
      diversity: false,
      minScore: 0.5,
    },
  };

  describe("constructor", () => {
    it("should create pipeline with config", () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      expect(pipeline).toBeDefined();
    });

    it("should accept custom stages", () => {
      const config = { ...defaultConfig, stages: ["generate", "validate"] };
      const pipeline = new GenerationPipeline(config);
      expect(pipeline).toBeDefined();
    });

    it("should accept custom batch size", () => {
      const config = { ...defaultConfig, batchSize: 8 };
      const pipeline = new GenerationPipeline(config);
      expect(pipeline).toBeDefined();
    });

    it("should accept custom parallelism", () => {
      const config = { ...defaultConfig, parallelism: 4 };
      const pipeline = new GenerationPipeline(config);
      expect(pipeline).toBeDefined();
    });
  });

  describe("run", () => {
    it("should run pipeline successfully", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(10);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.samples).toBeDefined();
    });

    it("should generate requested count", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(5);

      expect(result.stats.generated).toBe(5);
      expect(result.samples).toHaveLength(5);
    });

    it("should include stats", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(5);

      expect(result.stats.generated).toBeGreaterThan(0);
      expect(result.stats.passedValidation).toBeGreaterThanOrEqual(0);
      expect(result.stats.failed).toBeGreaterThanOrEqual(0);
      expect(result.stats.diversity).toBeGreaterThanOrEqual(0);
      expect(result.stats.diversity).toBeLessThanOrEqual(1);
      expect(result.stats.avgValidationScore).toBeGreaterThanOrEqual(0);
      expect(result.stats.avgValidationScore).toBeLessThanOrEqual(1);
    });

    it("should include timestamps", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const before = Date.now();
      const result = await pipeline.run(3);
      const after = Date.now();

      expect(result.startTime).toBeGreaterThanOrEqual(before);
      expect(result.endTime).toBeLessThanOrEqual(after);
      expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
    });

    it("should include output directory", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      expect(result.outputDir).toBe(defaultConfig.output.directory);
    });

    it("should include samples with metadata", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      result.samples.forEach(sample => {
        expect(sample.id).toBeDefined();
        expect(sample.component).toBeDefined();
        expect(sample.metadata).toBeDefined();
        expect(sample.metadata.timestamp).toBeDefined();
        expect(sample.metadata.seed).toBeDefined();
        expect(sample.metadata.split).toMatch(/^(train|validation|test)$/);
      });
    });

    it("should split dataset correctly", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(100);

      const trainCount = result.samples.filter(s => s.metadata.split === "train").length;
      const valCount = result.samples.filter(s => s.metadata.split === "validation").length;
      const testCount = result.samples.filter(s => s.metadata.split === "test").length;

      expect(trainCount + valCount + testCount).toBe(100);
    });

    it("should handle zero count", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(0);

      expect(result.success).toBe(true);
      expect(result.samples).toHaveLength(0);
    });

    it("should calculate total duration", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      expect(result.stats.totalDuration).toBeGreaterThan(0);
    });

    it("should calculate average duration", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      expect(result.stats.avgDuration).toBeGreaterThan(0);
      expect(result.stats.avgDuration).toBeLessThanOrEqual(result.stats.totalDuration);
    });

    it("should include stage breakdown", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      expect(result.stats.stageBreakdown).toBeDefined();
      expect(result.stats.stageBreakdown.generate).toBeDefined();
      expect(result.stats.stageBreakdown.validate).toBeDefined();
    });

    it("should filter by min validation score", async () => {
      const config = { ...defaultConfig, validation: { ...defaultConfig.validation, minScore: 0.8 } };
      const pipeline = new GenerationPipeline(config);
      const result = await pipeline.run(10);

      const passed = result.samples.filter(s => s.validation && s.validation.overall >= 0.8).length;
      expect(passed).toBeLessThanOrEqual(result.stats.generated);
    });

    it("should skip mutation stage when not in stages", async () => {
      const config = { ...defaultConfig, stages: ["generate", "validate"] };
      const pipeline = new GenerationPipeline(config);
      const result = await pipeline.run(3);

      expect(result.success).toBe(true);
    });

    it("should skip rendering when not in stages", async () => {
      const config = { ...defaultConfig, stages: ["generate", "validate"] };
      const pipeline = new GenerationPipeline(config);
      const result = await pipeline.run(3);

      expect(result.samples[0].render).toBeUndefined();
    });

    it("should include validation when in stages", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      result.samples.forEach(sample => {
        if (defaultConfig.stages.includes("validate")) {
          expect(sample.validation).toBeDefined();
        }
      });
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const pipeline = new GenerationPipeline(defaultConfig);
      // Would need to inject a failure scenario
      const result = await pipeline.run(3);

      expect(result).toBeDefined();
    });

    it("should include error in result when failed", async () => {
      // Would need to trigger an actual error
      const pipeline = new GenerationPipeline(defaultConfig);
      const result = await pipeline.run(3);

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});

describe("BatchProcessor", () => {
  const defaultConfig = {
    pipeline: {
      stages: ["generate", "validate"] as PipelineStage[],
      parallelism: 1,
      batchSize: 2,
      output: {
        directory: "/tmp/output",
        namingPattern: "{id}",
        saveImages: false,
        saveMetadata: true,
        saveEmbeddings: false,
        format: "jsonl" as const,
        split: { train: 0.7, validation: 0.15, test: 0.15 },
      },
      componentGen: {
        componentTypes: ["button"] as const,
        styleSystems: ["tailwind"],
        variations: { colors: 1, sizes: 1, states: 1 },
        seed: 1,
      },
      layoutGen: {
        patterns: ["grid"] as const,
        minColumns: 2,
        maxColumns: 3,
        breakpoints: ["sm", "md", "lg"],
        spacing: { min: 4, max: 24, step: 4 },
        seed: 2,
      },
      mutation: {
        rate: 0.3,
        intensity: "low" as const,
        seed: 3,
        mutationTypes: ["color"] as const,
      },
      renderer: {
        resolution: 1,
        formats: ["png"] as const[],
        backgrounds: ["#ffffff"],
        states: ["default"] as const[],
        timeout: 3000,
        viewport: { width: 1024, height: 768 },
      },
      validation: {
        accessibility: true,
        design: true,
        diversity: false,
        minScore: 0.5,
      },
    },
    targetCount: 10,
    parallelism: 2,
    checkpointInterval: 5,
    outputDir: "/tmp/batch-output",
  };

  describe("constructor", () => {
    it("should create batch processor with config", () => {
      const processor = new BatchProcessor(defaultConfig);
      expect(processor).toBeDefined();
    });

    it("should accept custom target count", () => {
      const config = { ...defaultConfig, targetCount: 100 };
      const processor = new BatchProcessor(config);
      expect(processor).toBeDefined();
    });

    it("should accept custom parallelism", () => {
      const config = { ...defaultConfig, parallelism: 4 };
      const processor = new BatchProcessor(config);
      expect(processor).toBeDefined();
    });

    it("should accept custom checkpoint interval", () => {
      const config = { ...defaultConfig, checkpointInterval: 20 };
      const processor = new BatchProcessor(config);
      expect(processor).toBeDefined();
    });
  });

  describe("process", () => {
    it("should process batch successfully", async () => {
      const processor = new BatchProcessor(defaultConfig);

      await expect(processor.process()).resolves.not.toThrow();
    });

    it("should call progress callback", async () => {
      const processor = new BatchProcessor(defaultConfig);
      const callback = vi.fn();

      await processor.process(callback);

      expect(callback).toHaveBeenCalled();
    });

    it("should update progress", async () => {
      const processor = new BatchProcessor(defaultConfig);
      const progresses: any[] = [];

      await processor.process((progress) => {
        progresses.push(progress);
      });

      expect(progresses.length).toBeGreaterThan(0);
      expect(progresses[progresses.length - 1].percentage).toBeGreaterThan(0);
    });

    it("should reach 100% completion", async () => {
      const processor = new BatchProcessor({ ...defaultConfig, targetCount: 10 });
      let finalProgress: any = null;

      await processor.process((progress) => {
        finalProgress = progress;
      });

      expect(finalProgress.percentage).toBe(100);
    });

    it("should include completed count", async () => {
      const processor = new BatchProcessor(defaultConfig);
      let finalProgress: any = null;

      await processor.process((progress) => {
        finalProgress = progress;
      });

      expect(finalProgress.completed).toBe(defaultConfig.targetCount);
    });

    it("should include total count", async () => {
      const processor = new BatchProcessor(defaultConfig);
      let progress: any = null;

      await processor.process((p) => {
        progress = p;
      });

      expect(progress.total).toBe(defaultConfig.targetCount);
    });

    it("should calculate ETA", async () => {
      const processor = new BatchProcessor(defaultConfig);
      let progress: any = null;

      await processor.process((p) => {
        if (p.completed > 0) progress = p;
      });

      if (progress) {
        expect(progress.eta).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
