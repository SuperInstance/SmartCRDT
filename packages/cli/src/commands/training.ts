/**
 * Training subcommands - Shadow logging, train, deploy, rollback, ab-test
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { createTable, formatNumber } from "../utils/formatting.js";

/**
 * Create training subcommands
 */
export function createTrainingSubCommands(): Command {
  const cmd = new Command("training");

  cmd.description(
    "Training and adapter management (shadow, train, deploy, rollback, ab-test)"
  );

  // Shadow subcommand
  const shadowCmd = new Command("shadow");
  shadowCmd
    .description("Show shadow logging status")
    .option("-e, --enable", "Enable shadow logging")
    .option("-d, --disable", "Disable shadow logging")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: TrainingShadowOptions) => {
      await executeTrainingShadow(_options);
    });

  // Train subcommand
  const trainCmd = new Command("train");
  trainCmd
    .description("Train adapter using shadow logs")
    .option("-o, --output <file>", "Output file", "training-data.jsonl")
    .option("-m, --min-quality <number>", "Minimum quality (0-1)", "0.6")
    .option("-b, --balance", "Balance by backend")
    .option("-f, --format <format>", "Output format (jsonl/orpo)", "jsonl")
    .action(async (_options: TrainingTrainOptions) => {
      await executeTrainingTrain(_options);
    });

  // Deploy subcommand
  const deployCmd = new Command("deploy");
  deployCmd
    .description("Deploy trained adapter")
    .argument("<adapter>", "Adapter file path")
    .option("-n, --name <name>", "Adapter name")
    .option("-f, --force", "Overwrite existing adapter")
    .action(async (adapter: string, _options: TrainingDeployOptions) => {
      await executeTrainingDeploy(adapter, _options);
    });

  // Rollback subcommand
  const rollbackCmd = new Command("rollback");
  rollbackCmd
    .description("Rollback to previous adapter version")
    .option("-v, --version <version>", "Specific version to rollback to")
    .option("-f, --force", "Force rollback without confirmation")
    .action(async (_options: TrainingRollbackOptions) => {
      await executeTrainingRollback(_options);
    });

  // AB test subcommand
  const abTestCmd = new Command("ab-test");
  abTestCmd
    .description("Run A/B test between adapters")
    .argument("<adapter-a>", "First adapter (A)")
    .argument("<adapter-b>", "Second adapter (B)")
    .option("-q, --queries <number>", "Number of test queries", "100")
    .option("-t, --traffic <percent>", "Traffic split for adapter A (%)", "50")
    .option("-d, --duration <minutes>", "Test duration", "60")
    .action(
      async (
        adapterA: string,
        adapterB: string,
        _options: TrainingABTestOptions
      ) => {
        await executeTrainingABTest(adapterA, adapterB, _options);
      }
    );

  cmd.addCommand(shadowCmd);
  cmd.addCommand(trainCmd);
  cmd.addCommand(deployCmd);
  cmd.addCommand(rollbackCmd);
  cmd.addCommand(abTestCmd);

  return cmd;
}

/**
 * Training shadow _options
 */
export interface TrainingShadowOptions {
  enable?: boolean;
  disable?: boolean;
  format?: "text" | "json";
}

/**
 * Training train _options
 */
export interface TrainingTrainOptions {
  output?: string;
  minQuality?: string;
  balance?: boolean;
  format?: string;
}

/**
 * Training deploy _options
 */
export interface TrainingDeployOptions {
  name?: string;
  force?: boolean;
}

/**
 * Training rollback _options
 */
export interface TrainingRollbackOptions {
  version?: string;
  force?: boolean;
}

/**
 * Training A/B test _options
 */
export interface TrainingABTestOptions {
  queries?: string;
  traffic?: string;
  duration?: string;
}

/**
 * Execute training shadow
 */
async function executeTrainingShadow(
  _options: TrainingShadowOptions
): Promise<void> {
  try {
    const _config = (await configManager.getAll()) as any;

    if (_options.enable) {
      await configManager.set("logging.shadowEnabled", true);
      logger.success("Shadow logging enabled");
      return;
    }

    if (_options.disable) {
      await configManager.set("logging.shadowEnabled", false);
      logger.success("Shadow logging disabled");
      return;
    }

    // Show status
    const shadowEnabled = _config.logging.shadowEnabled ?? false;
    const shadowPath = _config.logging.shadowPath ?? "./shadow-logs";

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            enabled: shadowEnabled,
            path: shadowPath,
          },
          null,
          2
        )
      );
    } else {
      logger.blank();
      console.log(chalk.cyan("Shadow Logging Status:"));
      logger.blank();

      const statusTable = createTable([
        { header: "Setting", width: 25 },
        { header: "Value", width: 40 },
      ]);

      statusTable.push([
        chalk.cyan("Status"),
        shadowEnabled ? chalk.green("Enabled") : chalk.red("Disabled"),
      ]);
      statusTable.push([chalk.cyan("Path"), shadowPath]);

      console.log(statusTable.toString());
      logger.blank();

      if (shadowEnabled) {
        // Count log entries
        try {
          const files = await fs.readdir(shadowPath);
          const jsonlFiles = files.filter(
            f => f.startsWith("shadow-") && f.endsWith(".jsonl")
          );
          console.log(
            `  ${chalk.grey("•")} Log files: ${formatNumber(jsonlFiles.length)}`
          );

          let totalEntries = 0;
          for (const file of jsonlFiles) {
            const filepath = join(shadowPath, file);
            const content = await fs.readFile(filepath, "utf8");
            totalEntries += content.split("\n").filter(Boolean).length;
          }
          console.log(
            `  ${chalk.grey("•")} Total entries: ${formatNumber(totalEntries)}`
          );
        } catch {
          console.log(`  ${chalk.grey("•")} No log files found`);
        }
      }

      logger.blank();
      console.log(chalk.cyan("Shadow Logging Management:"));
      console.log(
        `  ${chalk.grey("•")} Enable: ${chalk.cyan("aequor training shadow --enable")}`
      );
      console.log(
        `  ${chalk.grey("•")} Disable: ${chalk.cyan("aequor training shadow --disable")}`
      );
      console.log(
        `  ${chalk.grey("•")} Export data: ${chalk.cyan("aequor training train")}`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`Shadow logging status failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute training train
 */
async function executeTrainingTrain(
  _options: TrainingTrainOptions
): Promise<void> {
  try {
    const minQuality = parseFloat(_options.minQuality ?? "0.6");
    if (isNaN(minQuality) || minQuality < 0 || minQuality > 1) {
      logger.error("min-quality must be between 0 and 1");
      process.exit(1);
    }

    const _config = (await configManager.getAll()) as any;
    const shadowPath = _config.logging.shadowPath || "./shadow-logs";

    logger.info("Loading shadow logs...");
    const logs = await loadShadowLogs(shadowPath);

    if (logs.length === 0) {
      logger.warn("No shadow logs found");
      logger.info("Enable shadow logging and run queries first:");
      console.log(`  ${chalk.cyan("aequor training shadow --enable")}`);
      return;
    }

    logger.success(`Loaded ${formatNumber(logs.length)} log entries`);

    // TODO: Generate preference pairs, filter by quality, etc.
    // For now, just export raw logs

    const outputData = logs.map(log => JSON.stringify(log)).join("\n");
    const outputFile = _options.output ?? "training-data.jsonl";

    await fs.writeFile(outputFile, outputData, "utf8");

    logger.success(
      `Exported ${formatNumber(logs.length)} entries to ${chalk.cyan(outputFile)}`
    );
    logger.blank();
    logger.info("Usage:");
    console.log(`  ${chalk.cyan("python train_orpo.py --data " + outputFile)}`);
    logger.blank();
  } catch (error) {
    logger.error(`Training export failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute training deploy
 */
async function executeTrainingDeploy(
  adapter: string,
  _options: TrainingDeployOptions
): Promise<void> {
  try {
    logger.info(`Deploying adapter from ${chalk.cyan(adapter)}...`);

    // Check if adapter file exists
    try {
      await fs.access(adapter);
    } catch {
      logger.error(`Adapter file not found: ${adapter}`);
      process.exit(1);
    }

    // TODO: Implement adapter deployment
    logger.warn("Adapter deployment not yet implemented");
    logger.info("This would:");
    console.log(`  ${chalk.grey("1.")} Validate adapter file`);
    console.log(`  ${chalk.grey("2.")} Copy to adapters directory`);
    console.log(`  ${chalk.grey("3.")} Update configuration`);
    console.log(`  ${chalk.grey("4.")} Run health checks`);
    logger.blank();
  } catch (error) {
    logger.error(`Adapter deployment failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute training rollback
 */
async function executeTrainingRollback(
  _options: TrainingRollbackOptions
): Promise<void> {
  try {

    logger.info("Checking adapter versions...");

    // TODO: Implement rollback logic
    logger.warn("Adapter rollback not yet implemented");
    logger.info("This would:");
    console.log(`  ${chalk.grey("1.")} List available adapter versions`);
    console.log(`  ${chalk.grey("2.")} Select version to rollback to`);
    console.log(`  ${chalk.grey("3.")} Verify rollback safety`);
    console.log(`  ${chalk.grey("4.")} Execute rollback`);
    logger.blank();

    if (_options.version) {
      logger.info(`Rolling back to version ${chalk.cyan(_options.version)}`);
    }
  } catch (error) {
    logger.error(`Adapter rollback failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute training A/B test
 */
async function executeTrainingABTest(
  adapterA: string,
  adapterB: string,
  _options: TrainingABTestOptions
): Promise<void> {
  try {
    const queries = parseInt(_options.queries ?? "100", 10);
    const traffic = parseInt(_options.traffic ?? "50", 10);
    const duration = parseInt(_options.duration ?? "60", 10);

    logger.blank();
    console.log(chalk.cyan("A/B Test Configuration:"));
    logger.blank();

    const configTable = createTable([
      { header: "Setting", width: 25 },
      { header: "Value", width: 40 },
    ]);

    configTable.push([chalk.cyan("Adapter A"), adapterA]);
    configTable.push([chalk.cyan("Adapter B"), adapterB]);
    configTable.push([
      chalk.cyan("Traffic Split (A)"),
      `${traffic}% / ${100 - traffic}%`,
    ]);
    configTable.push([chalk.cyan("Test Queries"), formatNumber(queries)]);
    configTable.push([chalk.cyan("Duration"), `${duration} minutes`]);

    console.log(configTable.toString());
    logger.blank();

    logger.warn("A/B testing not yet implemented");
    logger.info("This would:");
    console.log(`  ${chalk.grey("1.")} Load both adapters`);
    console.log(
      `  ${chalk.grey("2.")} Split traffic according to configuration`
    );
    console.log(`  ${chalk.grey("3.")} Collect quality metrics`);
    console.log(`  ${chalk.grey("4.")} Determine statistical significance`);
    console.log(`  ${chalk.grey("5.")} Recommend winning adapter`);
    logger.blank();
  } catch (error) {
    logger.error(`A/B test failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Load shadow logs from directory
 */
async function loadShadowLogs(shadowPath: string): Promise<any[]> {
  const logs: any[] = [];

  try {
    await fs.access(shadowPath);
    const files = await fs.readdir(shadowPath);
    const jsonlFiles = files.filter(
      f => f.startsWith("shadow-") && f.endsWith(".jsonl")
    );

    for (const file of jsonlFiles) {
      const filepath = join(shadowPath, file);
      const content = await fs.readFile(filepath, "utf8");
      const lines = content.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          logs.push(entry);
        } catch {
          // Skip invalid lines
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return logs;
}
