/**
 * Train command - Export training data for ORPO
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import {
  PreferencePairGenerator,
  DataSensitivity,
  type ShadowLogEntry,
} from "@lsi/cascade";
import { createTable, formatNumber } from "../utils/formatting.js";

/**
 * Train command _options
 */
export interface TrainOptions {
  /** Output file */
  output?: string;
  /** Minimum quality */
  minQuality?: string;
  /** Balance by backend */
  balance?: boolean;
  /** Output format */
  format?: "orpo" | "jsonl";
  /** Show statistics only */
  stats?: boolean;
}

/**
 * Create train command
 */
export function createTrainCommand(): Command {
  const cmd = new Command("train");

  cmd
    .description(
      "Export training data for ORPO (Odds Ratio Preference Optimization)"
    )
    .option("-o, --output <file>", "Output file", "training-data.jsonl")
    .option("-m, --min-quality <number>", "Minimum quality (0-1)", "0.6")
    .option("-b, --balance", "Balance by backend")
    .option("-f, --format <format>", "Output format (orpo|jsonl)", "jsonl")
    .option("-s, --stats", "Show statistics only")
    .action(async (_options: TrainOptions) => {
      await executeTrain(_options);
    });

  return cmd;
}

/**
 * Execute train command
 */
async function executeTrain(_options: TrainOptions): Promise<void> {
  try {
    // Validate min-quality
    const minQuality = parseFloat(_options.minQuality ?? "0.6");
    if (isNaN(minQuality) || minQuality < 0 || minQuality > 1) {
      logger.error("min-quality must be between 0 and 1");
      process.exit(1);
    }

    // Load shadow logs
    const _config = (await configManager.getAll()) as any;
    const shadowPath = _config.logging?.shadowPath || "./shadow-logs";

    logger.info("Loading shadow logs...");
    const logs = await loadShadowLogs(shadowPath);

    if (logs.length === 0) {
      logger.warn("No shadow logs found. Enable shadow logging first:");
      console.log(
        `  ${chalk.cyan("aequor _config --set logging.shadowEnabled true")}`
      );
      logger.blank();
      logger.info(
        "Shadow logging collects query/response pairs for ORPO training."
      );
      logger.info("Once enabled, run queries to populate the shadow logs.");
      return;
    }

    // Generate preference pairs
    const generator = new PreferencePairGenerator();
    let pairs = generator.generateFromLogs(logs);

    // Filter by quality
    pairs = filterByQuality(pairs, minQuality);

    // Balance by backend if requested
    if (_options.balance) {
      pairs = balanceByBackend(pairs);
    }

    // Calculate statistics
    const stats = calculateStats(pairs);

    if ((_options.format as string) === "json") {
      console.log(JSON.stringify({ pairs, stats }, null, 2));
    } else {
      logger.blank();

      // Display statistics
      console.log(chalk.cyan("Generated Preference Pairs:"));
      logger.blank();

      const statsTable = createTable([
        { header: "Metric", width: 30 },
        { header: "Value", width: 25 },
      ]);

      statsTable.push([
        chalk.cyan("Total Pairs"),
        formatNumber(stats.total) + " pairs",
      ]);
      statsTable.push([
        chalk.cyan("Avg Chosen Quality"),
        (stats.avgChosenQuality * 100).toFixed(1) + "%",
      ]);
      statsTable.push([
        chalk.cyan("Avg Rejected Quality"),
        (stats.avgRejectedQuality * 100).toFixed(1) + "%",
      ]);
      statsTable.push([
        chalk.cyan("Local Backend"),
        formatNumber(stats.backendDistribution.local) + " pairs",
      ]);
      statsTable.push([
        chalk.cyan("Cloud Backend"),
        formatNumber(stats.backendDistribution.cloud) + " pairs",
      ]);
      statsTable.push([
        chalk.cyan("Min Quality Filter"),
        `≥ ${(minQuality * 100).toFixed(0)}%`,
      ]);

      console.log(statsTable.toString());
      logger.blank();

      // Privacy breakdown
      console.log(chalk.cyan("Privacy Breakdown:"));
      const privacyStats = analyzePrivacy(pairs);
      console.log(
        `  ${chalk.grey("•")} SOVEREIGN: ${chalk.red(formatNumber(privacyStats.sovereign))} pairs (excluded)`
      );
      console.log(
        `  ${chalk.grey("•")} SENSITIVE: ${chalk.yellow(formatNumber(privacyStats.sensitive))} pairs (redacted)`
      );
      console.log(
        `  ${chalk.grey("•")} PUBLIC: ${chalk.green(formatNumber(privacyStats.public))} pairs (as-is)`
      );
      logger.blank();
    }

    // Export if not just showing stats
    if (!_options.stats) {
      const data = exportForORPO(pairs);
      await fs.writeFile(_options.output ?? "training-data.jsonl", data, "utf8");
      logger.success(
        `Exported ${formatNumber(pairs.length)} pairs to ${chalk.cyan(_options.output ?? "training-data.jsonl")}`
      );
      logger.blank();
      logger.info("Training data format:");
      logger.info("  Each line is a JSON object with:");
      logger.info("    - prompt: Original query");
      logger.info("    - chosen: Preferred response (higher quality)");
      logger.info("    - rejected: Dispreferred response (lower quality)");
      logger.blank();
      logger.info("Usage with ORPO training:");
      console.log(
        `  ${chalk.cyan("python train_orpo.py --data " + _options.output)}`
      );
    }
  } catch (error) {
    logger.error(`Train command failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Load shadow logs from directory
 */
async function loadShadowLogs(shadowPath: string): Promise<ShadowLogEntry[]> {
  const logs: ShadowLogEntry[] = [];

  try {
    // Check if directory exists
    await fs.access(shadowPath);

    // List all jsonl files
    const files = await fs.readdir(shadowPath);
    const jsonlFiles = files.filter(
      f => f.startsWith("shadow-") && f.endsWith(".jsonl")
    );

    if (jsonlFiles.length === 0) {
      return logs;
    }

    // Load each file
    for (const file of jsonlFiles) {
      const filepath = join(shadowPath, file);
      const content = await fs.readFile(filepath, "utf8");
      const lines = content.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as ShadowLogEntry;
          logs.push(entry);
        } catch (parseError) {
          logger.warn(`Failed to parse line in ${file}: ${parseError}`);
        }
      }
    }

    logger.info(
      `Loaded ${formatNumber(logs.length)} entries from ${formatNumber(jsonlFiles.length)} files`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    // Directory doesn't exist, return empty logs
  }

  return logs;
}

/**
 * Filter pairs by minimum quality
 */
function filterByQuality(
  pairs: Array<{ chosen: { quality: number }; rejected: { quality: number } }>,
  minQuality: number
): typeof pairs {
  return pairs.filter(
    pair =>
      pair.chosen.quality >= minQuality || pair.rejected.quality >= minQuality
  );
}

/**
 * Balance pairs by backend (equal local/cloud)
 */
function balanceByBackend(
  pairs: Array<{ chosen: { backend: string }; rejected: { backend: string } }>
): typeof pairs {
  const localPairs = pairs.filter(p => p.chosen.backend === "local");
  const cloudPairs = pairs.filter(p => p.chosen.backend === "cloud");

  const targetSize = Math.min(localPairs.length, cloudPairs.length);
  const balanced = [
    ...localPairs.slice(0, targetSize),
    ...cloudPairs.slice(0, targetSize),
  ];

  // Shuffle
  for (let i = balanced.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [balanced[i], balanced[j]] = [balanced[j], balanced[i]];
  }

  return balanced;
}

/**
 * Calculate statistics
 */
function calculateStats(
  pairs: Array<{
    chosen: { quality: number; backend: string };
    rejected: { quality: number; backend: string };
  }>
) {
  if (pairs.length === 0) {
    return {
      total: 0,
      avgChosenQuality: 0,
      avgRejectedQuality: 0,
      backendDistribution: { local: 0, cloud: 0 },
    };
  }

  let totalChosenQuality = 0;
  let totalRejectedQuality = 0;
  let localCount = 0;
  let cloudCount = 0;

  for (const pair of pairs) {
    totalChosenQuality += pair.chosen.quality;
    totalRejectedQuality += pair.rejected.quality;
    if (pair.chosen.backend === "local") {
      localCount++;
    } else {
      cloudCount++;
    }
  }

  return {
    total: pairs.length,
    avgChosenQuality: totalChosenQuality / pairs.length,
    avgRejectedQuality: totalRejectedQuality / pairs.length,
    backendDistribution: { local: localCount, cloud: cloudCount },
  };
}

/**
 * Analyze privacy distribution
 */
function analyzePrivacy(
  pairs: Array<{
    chosen: { sensitivity?: DataSensitivity };
    rejected: { sensitivity?: DataSensitivity };
  }>
): { sovereign: number; sensitive: number; public: number } {
  let sovereign = 0;
  let sensitive = 0;
  let public_ = 0;

  for (const pair of pairs) {
    const chosenSens = pair.chosen.sensitivity ?? DataSensitivity.PUBLIC;
    const rejectedSens = pair.rejected.sensitivity ?? DataSensitivity.PUBLIC;

    if (
      chosenSens === DataSensitivity.SOVEREIGN ||
      rejectedSens === DataSensitivity.SOVEREIGN
    ) {
      sovereign++;
    } else if (
      chosenSens === DataSensitivity.SENSITIVE ||
      rejectedSens === DataSensitivity.SENSITIVE
    ) {
      sensitive++;
    } else {
      public_++;
    }
  }

  return { sovereign, sensitive, public: public_ };
}

/**
 * Export pairs for ORPO training
 */
function exportForORPO(
  pairs: Array<{
    prompt: string;
    chosen: {
      response: string;
      model: string;
      quality: number;
      backend?: string;
    };
    rejected: {
      response: string;
      model: string;
      quality: number;
      backend?: string;
    };
  }>
): string {
  const lines: string[] = [];

  for (const pair of pairs) {
    const orpoPair = {
      prompt: pair.prompt,
      chosen: {
        response: pair.chosen.response,
        model: pair.chosen.model,
        quality: pair.chosen.quality,
      },
      rejected: {
        response: pair.rejected.response,
        model: pair.rejected.model,
        quality: pair.rejected.quality,
      },
    };
    lines.push(JSON.stringify(orpoPair));
  }

  return lines.join("\n");
}
