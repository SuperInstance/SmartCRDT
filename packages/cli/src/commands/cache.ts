/**
 * Cache command - Manage semantic cache
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { CliTable3 } from "../utils/index.js";
import { createTable, formatBytes, formatNumber } from "../utils/formatting.js";
import { configManager } from "../config/manager.js";

/**
 * Cache command _options
 */
export interface CacheOptions {
  /** Output format */
  format?: "text" | "json";
}

/**
 * Create cache command
 */
export function createCacheCommand(): Command {
  const cmd = new Command("cache");

  cmd.description("Manage semantic cache");

  // Stats subcommand
  const statsCmd = new Command("stats");
  statsCmd
    .description("Show cache statistics")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: CacheOptions) => {
      await showCacheStats(_options.format);
    });

  // Clear subcommand
  const clearCmd = new Command("clear");
  clearCmd
    .description("Clear cache")
    .option("-y, --yes", "Skip confirmation")
    .action(async (_options: { yes?: boolean }) => {
      await clearCache(_options.yes);
    });

  // Warm subcommand
  const warmCmd = new Command("warm");
  warmCmd
    .description("Warm cache with common queries")
    .option("-q, --queries <number>", "Number of queries", "100")
    .action(async (_options: { queries?: string }) => {
      await warmCache(_options.queries);
    });

  // Invalidate subcommand
  const invalidateCmd = new Command("invalidate");
  invalidateCmd
    .description("Invalidate cache entries by pattern")
    .argument("<pattern>", "Pattern to match")
    .option(
      "-f, --format <format>",
      "Match format (exact/prefix/suffix/regex)",
      "exact"
    )
    .action(async (pattern: string, _options: { format?: string }) => {
      await invalidateCache(pattern, _options.format);
    });

  cmd.addCommand(statsCmd);
  cmd.addCommand(clearCmd);
  cmd.addCommand(warmCmd);
  cmd.addCommand(invalidateCmd);

  return cmd;
}

/**
 * Clear cache
 */
async function clearCache(skipConfirm?: boolean): Promise<void> {
  if (!skipConfirm) {
    logger.warn("This will clear all cached data");
    logger.info("Confirm with --yes flag to proceed");
    return;
  }

  logger.info("Clearing cache...");
  await configManager.clearCache();
  logger.success("Cache cleared successfully");
}

/**
 * Show cache statistics
 */
async function showCacheStats(format: string = "text"): Promise<void> {
  const _config = await configManager.getAll();
  const cacheSize = await configManager.getCacheSize();

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          enabled: _config.cache.enabled,
          size: cacheSize,
          maxSize: _config.cache.maxSize * 1024 * 1024,
          ttl: _config.cache.ttl,
          directory: _config.cache.directory,
          usage: cacheSize / (_config.cache.maxSize * 1024 * 1024),
        },
        null,
        2
      )
    );
  } else {
    logger.blank();

    console.log(chalk.cyan("Cache Status:"));
    logger.blank();

    const statusTable: CliTable3.Table = createTable([
      { header: "Setting", width: 25 },
      { header: "Value", width: 40 },
    ]);

    statusTable.push([
      chalk.cyan("Status"),
      _config.cache.enabled ? chalk.green("Enabled") : chalk.red("Disabled"),
    ]);
    statusTable.push([chalk.cyan("Current Size"), formatBytes(cacheSize)]);
    statusTable.push([
      chalk.cyan("Max Size"),
      formatBytes(_config.cache.maxSize * 1024 * 1024),
    ]);
    statusTable.push([
      chalk.cyan("Usage"),
      `${((cacheSize / (_config.cache.maxSize * 1024 * 1024)) * 100).toFixed(1)}%`,
    ]);
    statusTable.push([chalk.cyan("TTL"), `${_config.cache.ttl} seconds`]);
    statusTable.push([chalk.cyan("Directory"), _config.cache.directory]);

    console.log(statusTable.toString());
    logger.blank();

    console.log(chalk.cyan("Cache Management:"));
    console.log(
      `  ${chalk.grey("•")} Clear cache: ${chalk.cyan("aequor cache clear --yes")}`
    );
    console.log(
      `  ${chalk.grey("•")} Warm cache: ${chalk.cyan("aequor cache warm")}`
    );
    console.log(
      `  ${chalk.grey("•")} Invalidate entries: ${chalk.cyan("aequor cache invalidate <pattern>")}`
    );
    console.log(
      `  ${chalk.grey("•")} Disable cache: ${chalk.cyan("aequor _config set cache.enabled false")}`
    );
    logger.blank();
  }
}

/**
 * Warm cache with common queries
 */
async function warmCache(queriesStr?: string): Promise<void> {
  const queries = parseInt(queriesStr ?? "100", 10);

  logger.info(`Warming cache with ${formatNumber(queries)} common queries...`);

  // TODO: Implement cache warming
  logger.warn("Cache warming not yet implemented");
  logger.info("This would:");
  console.log(`  ${chalk.grey("1.")} Load common queries from database`);
  console.log(`  ${chalk.grey("2.")} Execute queries to populate cache`);
  console.log(`  ${chalk.grey("3.")} Measure cache hit rate improvement`);
  logger.blank();
}

/**
 * Invalidate cache entries by pattern
 */
async function invalidateCache(
  pattern: string,
  format?: string
): Promise<void> {
  const _config = (await configManager.getAll()) as any;
  const cacheDir = _config.cache.directory || "./cache";

  logger.info(`Invalidating cache entries matching: ${chalk.cyan(pattern)}`);

  try {
    const files = await fs.readdir(cacheDir);
    let invalidated = 0;

    for (const file of files) {
      let match = false;

      switch (format) {
        case "exact":
          match = file === pattern;
          break;
        case "prefix":
          match = file.startsWith(pattern);
          break;
        case "suffix":
          match = file.endsWith(pattern);
          break;
        case "regex":
          match = new RegExp(pattern).test(file);
          break;
        default:
          match = file === pattern;
      }

      if (match) {
        await fs.unlink(join(cacheDir, file));
        invalidated++;
      }
    }

    logger.success(`Invalidated ${formatNumber(invalidated)} cache entries`);
    logger.blank();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn("Cache directory not found");
    } else {
      logger.error(`Cache invalidation failed: ${(error as Error).message}`);
    }
  }
}
