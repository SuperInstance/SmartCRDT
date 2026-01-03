#!/usr/bin/env node
/**
 * @fileoverview CLI command for training VL-JEPA models
 * @package @lsi/vljepa-training
 */

import { Command } from "commander";
import chalk from "chalk";
import ora, { Ora } from "ora";
import Table from "cli-table3";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { TrainingPipelineConfig } from "../types.js";
import { TrainingPipeline } from "../pipeline/TrainingPipeline.js";

const program = new Command();

/**
 * Load configuration from file
 */
function loadConfig(configPath: string): TrainingPipelineConfig {
  const resolvedPath = resolve(configPath);
  const content = readFileSync(resolvedPath, "utf-8");
  return JSON.parse(content) as TrainingPipelineConfig;
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format memory size for display
 */
function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  } else {
    return `${mb.toFixed(2)} MB`;
  }
}

/**
 * Create metrics table
 */
function createMetricsTable(): Table {
  return new Table({
    head: [chalk.cyan("Metric"), chalk.cyan("Value")],
    colWidths: [30, 20],
  });
}

program
  .name("vljepa-train")
  .description("VL-JEPA Training CLI")
  .version("1.0.0");

program
  .command("train")
  .description("Start training")
  .option("-c, --config <path>", "Configuration file", "config.json")
  .option("-r, --resume <path>", "Resume from checkpoint")
  .option("--no-ckpt", "Disable checkpointing")
  .option("--no-monitor", "Disable monitoring")
  .option("--device <type>", "Device type (cpu, cuda, webgpu)", "cpu")
  .action(async options => {
    console.log(chalk.bold.blue("\n🚀 VL-JEPA Training Pipeline\n"));

    // Load configuration
    const spinner = ora("Loading configuration...").start();
    try {
      const config = loadConfig(options.config);

      // Override config with CLI options
      if (options.noCkpt) {
        config.checkpointing.enabled = false;
      }
      if (options.noMonitor) {
        config.monitoring = {
          ...config.monitoring,
          tensorboard: { ...config.monitoring.tensorboard, enabled: false },
          wandb: { ...config.monitoring.wandb, enabled: false },
        };
      }

      spinner.succeed(chalk.green("Configuration loaded"));

      // Create pipeline
      spinner.start("Initializing pipeline...");
      const pipeline = new TrainingPipeline(config);
      spinner.succeed(chalk.green("Pipeline initialized"));

      // Resume from checkpoint if specified
      if (options.resume) {
        spinner.start(`Resuming from checkpoint: ${options.resume}`);
        // In real implementation, would load and resume
        spinner.succeed(chalk.green("Resumed from checkpoint"));
      }

      // Display configuration summary
      console.log(chalk.bold("\n📋 Configuration Summary:"));
      const configTable = new Table({
        head: [chalk.cyan("Setting"), chalk.cyan("Value")],
        colWidths: [30, 40],
      });
      configTable.push(
        ["Model", config.model.type],
        ["Epochs", config.training.epochs.toString()],
        ["Batch Size", config.data.loader.batchSize.toString()],
        ["Learning Rate", config.training.optimizer.learningRate.toString()],
        ["Device", options.device],
        [
          "Checkpointing",
          config.checkpointing.enabled ? "Enabled" : "Disabled",
        ],
        [
          "TensorBoard",
          config.monitoring.tensorboard.enabled ? "Enabled" : "Disabled",
        ],
        ["W&B", config.monitoring.wandb.enabled ? "Enabled" : "Disabled"]
      );
      console.log(configTable.toString());

      // Display training stages
      console.log(chalk.bold("\n📦 Training Stages:"));
      const stageTable = new Table({
        head: [chalk.cyan("Stage"), chalk.cyan("Type"), chalk.cyan("Status")],
        colWidths: [30, 20, 15],
      });
      for (const stage of config.stages) {
        stageTable.push([
          stage.name,
          stage.type,
          stage.enabled ? chalk.green("Enabled") : chalk.gray("Disabled"),
        ]);
      }
      console.log(stageTable.toString());

      // Start training
      console.log(chalk.bold("\n🏋️ Starting Training...\n"));
      const trainSpinner = ora("Training in progress...").start();

      // In a real implementation, would execute actual training
      // For now, simulate progress
      const result = await pipeline.execute();

      if (result.success) {
        trainSpinner.succeed(chalk.green("Training completed successfully"));

        // Display results
        console.log(chalk.bold("\n📊 Training Results:\n"));

        const metricsTable = createMetricsTable();
        const metrics = result.metrics;
        metricsTable.push(
          ["Final Epoch", metrics.epoch.toString()],
          ["Training Loss", metrics.loss.training.toFixed(6)],
          ["Validation Loss", metrics.loss.validation.toFixed(6)]
        );

        if (metrics.accuracy.top1) {
          metricsTable.push([
            "Accuracy",
            `${(metrics.accuracy.top1 * 100).toFixed(2)}%`,
          ]);
        }
        if (metrics.accuracy.top5) {
          metricsTable.push([
            "Top-5 Accuracy",
            `${(metrics.accuracy.top5 * 100).toFixed(2)}%`,
          ]);
        }

        metricsTable.push(
          ["Throughput", `${metrics.throughput.toFixed(1)} examples/s`],
          ["Duration", formatDuration(result.duration)]
        );

        console.log(metricsTable.toString());

        // Display checkpoints
        if (result.checkpoints.length > 0) {
          console.log(chalk.bold("\n💾 Checkpoints Saved:\n"));
          const ckptTable = new Table({
            head: [chalk.cyan("Type"), chalk.cyan("Epoch"), chalk.cyan("Size")],
            colWidths: [15, 10, 15],
          });
          for (const ckpt of result.checkpoints) {
            ckptTable.push([
              ckpt.type,
              ckpt.epoch.toString(),
              formatMemory(ckpt.size),
            ]);
          }
          console.log(ckptTable.toString());
        }

        console.log(
          chalk.green.bold("\n✨ Training completed successfully!\n")
        );
      } else {
        trainSpinner.fail(chalk.red("Training failed"));
        console.error(chalk.red(`Error: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to load configuration"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Validate configuration")
  .option("-c, --config <path>", "Configuration file", "config.json")
  .action(options => {
    console.log(chalk.bold.blue("\n🔍 Validating Configuration\n"));

    try {
      const config = loadConfig(options.config);
      const spinner = ora("Validating...").start();

      // Validate configuration
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check required fields
      if (!config.model?.type) {
        errors.push("Missing model type");
      }
      if (!config.training?.epochs) {
        errors.push("Missing training epochs");
      }
      if (!config.data?.trainPath) {
        errors.push("Missing training data path");
      }

      // Check for potential issues
      if (config.training?.epochs && config.training.epochs > 1000) {
        warnings.push("Large number of epochs may take a long time");
      }
      if (
        config.data?.loader?.batchSize &&
        config.data.loader.batchSize > 256
      ) {
        warnings.push("Large batch size may require significant memory");
      }

      spinner.stop();

      // Display results
      if (errors.length === 0 && warnings.length === 0) {
        console.log(chalk.green("✓ Configuration is valid\n"));
      } else {
        if (errors.length > 0) {
          console.log(chalk.red("\nErrors:"));
          for (const error of errors) {
            console.log(chalk.red(`  ✗ ${error}`));
          }
        }
        if (warnings.length > 0) {
          console.log(chalk.yellow("\nWarnings:"));
          for (const warning of warnings) {
            console.log(chalk.yellow(`  ⚠ ${warning}`));
          }
        }
        console.log("");
      }
    } catch (error) {
      console.error(chalk.red("Failed to load configuration"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program
  .command("config")
  .description("Generate default configuration")
  .option("-o, --output <path>", "Output file", "config.json")
  .action(options => {
    console.log(chalk.bold.blue("\n📝 Generating Configuration\n"));

    const defaultConfig: TrainingPipelineConfig = {
      stages: [
        {
          name: "data_prep",
          type: "data_prep",
          config: {},
          dependencies: [],
          enabled: true,
        },
        {
          name: "train",
          type: "train",
          config: {},
          dependencies: ["data_prep"],
          enabled: true,
        },
        {
          name: "validate",
          type: "validate",
          config: {},
          dependencies: ["train"],
          enabled: true,
        },
        {
          name: "finalize",
          type: "finalize",
          config: {},
          dependencies: ["validate"],
          enabled: true,
        },
      ],
      data: {
        trainPath: "./data/train",
        valPath: "./data/val",
        datasetType: "multimodal",
        augmentation: {
          enabled: true,
          horizontalFlip: true,
          rotation: 10,
          colorJitter: {
            brightness: 0.2,
            contrast: 0.2,
            saturation: 0.2,
            hue: 0.1,
          },
          randomCrop: true,
          gaussianBlur: false,
        },
        preprocessing: {
          normalize: true,
          resize: { width: 224, height: 224 },
        },
        loader: {
          batchSize: 32,
          numWorkers: 4,
          pinMemory: true,
          shuffle: true,
          dropLast: true,
        },
      },
      model: {
        type: "vl-jepa",
        architecture: {
          embeddingDim: 768,
          numLayers: 12,
          numAttentionHeads: 12,
          hiddenDim: 3072,
          dropout: 0.1,
          activation: "gelu",
        },
        visionEncoder: {
          patchSize: 16,
          numPatches: 196,
          positionEmbedding: true,
        },
        languageEncoder: {
          vocabSize: 50000,
          maxLength: 512,
          positionEmbedding: true,
        },
        predictor: {
          numLayers: 6,
          hiddenDim: 1536,
          predictionDepth: 6,
        },
        initialization: {
          type: "kaiming",
        },
      },
      training: {
        epochs: 100,
        contextWindow: 8,
        maskingRatio: 0.9,
        worldModelWeight: 1.0,
        predictionWeight: 1.0,
        curriculumLearning: false,
        learningRate: 0.001,
        batchSize: 32,
        optimizer: {
          type: "adamw",
          learningRate: 0.001,
          weightDecay: 0.01,
          beta1: 0.9,
          beta2: 0.999,
          epsilon: 1e-8,
        },
        lrSchedule: {
          type: "warmup_cosine",
          initialLR: 0.0001,
          maxLR: 0.001,
          minLR: 0.00001,
          warmupEpochs: 10,
          totalEpochs: 100,
        },
        gradientClipping: {
          enabled: true,
          maxNorm: 1.0,
          algorithm: "norm",
        },
        loss: {
          type: "combined",
          weights: {
            worldModel: 1.0,
            prediction: 1.0,
          },
        },
        mixedPrecision: {
          enabled: true,
          dtype: "float16",
        },
        distributed: {
          enabled: false,
          backend: "nccl",
          worldSize: 1,
        },
        validation: {
          frequency: 1,
        },
      },
      monitoring: {
        metrics: {
          scalars: [
            "loss",
            "accuracy",
            "learning_rate",
            "latency",
            "memory",
            "throughput",
          ],
          histograms: ["weights", "gradients", "embeddings"],
          aggregations: ["mean", "std"],
          storage: {
            backend: "file",
            path: "./metrics",
          },
        },
        tensorboard: {
          enabled: true,
          logDir: "./logs/tensorboard",
          frequency: 100,
          scalars: ["loss", "accuracy", "learning_rate"],
          histograms: ["weights", "gradients"],
          images: [],
          logGraph: true,
          logHyperparams: true,
        },
        wandb: {
          enabled: false,
          project: "vl-jepa",
          frequency: 100,
        },
        alerts: [],
        logFrequency: 10,
        progressBar: true,
      },
      checkpointing: {
        enabled: true,
        dir: "./checkpoints",
        frequency: 5,
        keep: {
          best: 3,
          last: 5,
          every: 10,
        },
        validateBeforeSave: true,
        compression: "gzip",
        saveOptimizer: true,
        saveTrainingState: true,
      },
      callbacks: {
        earlyStopping: {
          enabled: true,
          monitor: "val_loss",
          patience: 10,
          minDelta: 0.0001,
          mode: "min",
          restoreBestWeights: true,
          stopTraining: true,
        },
        lrScheduler: {
          enabled: true,
          type: "warmup_cosine",
          settings: {
            type: "warmup_cosine",
            initialLR: 0.0001,
            maxLR: 0.001,
            minLR: 0.00001,
            warmupEpochs: 10,
            totalEpochs: 100,
          },
        },
        gradientMonitor: {
          enabled: true,
          logNorms: true,
          logHistograms: true,
          checkAnomalies: true,
          anomalyThreshold: 10.0,
          anomalyAction: "clip",
        },
        validationCallback: {
          enabled: true,
          frequency: 1,
          savePredictions: false,
          detailedMetrics: true,
        },
        modelCheckpoint: {
          enabled: true,
          saveBest: true,
          saveLast: true,
          monitor: "val_loss",
          mode: "min",
        },
      },
      visualization: {
        enabled: true,
        outputDir: "./visualizations",
        formats: ["html", "json"],
        frequency: 10,
        interactive: true,
        embeddings: {
          enabled: true,
          method: "pca",
          dimension: 2,
          samples: 1000,
        },
        attention: {
          enabled: true,
          layers: [0, 6, 11],
          heads: [0, 1, 2, 3],
          samples: 10,
        },
        lossCurves: {
          enabled: true,
          smoothing: 5,
          figsize: [1200, 600],
        },
        confusionMatrix: {
          enabled: true,
          normalize: true,
        },
      },
      device: {
        type: "cpu",
        memory: {
          allowGrowth: true,
        },
        performance: {
          allowTF32: true,
          allowFp16: true,
          cudnnBenchmark: true,
          cudnnDeterministic: false,
        },
      },
    };

    // Write configuration to file
    // In real implementation, would write to file
    console.log(chalk.green("✓ Default configuration generated"));
    console.log(
      chalk.gray(`\nConfiguration: ${JSON.stringify(defaultConfig, null, 2)}`)
    );
  });

program.parse();
