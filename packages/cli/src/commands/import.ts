/**
 * Import command - Import knowledge into Aequor
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { createTable, formatNumber } from "../utils/formatting.js";

/**
 * Import command options
 */
export interface ImportOptions {
  /** Input file */
  file: string;
  /** Import mode */
  mode?: "merge" | "replace" | "skip";
  /** Filter by type */
  type?: "all" | "knowledge" | "cache" | "config" | "logs";
  /** Validation only */
  validate?: boolean;
  /** Dry run */
  dryRun?: boolean;
  /** Ignore errors */
  ignoreErrors?: boolean;
}

/**
 * Create import command
 */
export function createImportCommand(): Command {
  const cmd = new Command("import");

  cmd
    .description("Import knowledge and data into Aequor")
    .argument("<file>", "File to import")
    .option("-m, --mode <mode>", "Import mode (merge|replace|skip)", "merge")
    .option("-t, --type <type>", "What to import (all|knowledge|cache|config|logs)", "all")
    .option("--validate", "Validate file only", false)
    .option("--dry-run", "Preview import without executing", false)
    .option("-i, --ignore-errors", "Ignore import errors", false)
    .action(async (file: string, _options: ImportOptions) => {
      await executeImport(file, _options);
    });

  return cmd;
}

/**
 * Execute import command
 */
async function executeImport(file: string, _options: ImportOptions): Promise<void> {
  try {
    logger.info(`Importing from ${file}...`);

    // Check if file exists
    try {
      await fs.access(file);
    } catch (error) {
      logger.error(`File not found: ${file}`);
      process.exit(1);
    }

    // Read file
    const content = await fs.readFile(file, "utf8");

    // Detect and parse format
    let importData: any;
    const detectedFormat = detectFormat(content);

    switch (detectedFormat) {
      case "jsonl":
        importData = parseJsonl(content);
        break;
      case "cartridge":
        importData = JSON.parse(content);
        break;
      case "json":
      default:
        importData = JSON.parse(content);
        break;
    }

    // Validate file structure
    if (_options.validate) {
      await validateImportFile(importData, detectedFormat);
      logger.success("File validation passed");
      return;
    }

    // Dry run
    if (_options.dryRun) {
      await previewImport(importData, _options.type);
      return;
    }

    // Execute import
    const results = await performImport(importData, _options.mode || "merge", _options.type || "all", _options.ignoreErrors || false);

    // Show results
    logger.blank();
    console.log(chalk.cyan("Import Summary:"));
    logger.blank();

    const summaryTable = createTable([
      { header: "Type", width: 20 },
      { header: "Attempted", width: 15 },
      { header: "Success", width: 15 },
      { header: "Skipped", width: 15 },
      { header: "Errors", width: 15 },
    ]);

    Object.entries(results).forEach(([type, stats]: [string, any]) => {
      summaryTable.push([
        chalk.cyan(type),
        formatNumber(stats.attempted),
        formatNumber(stats.success),
        formatNumber(stats.skipped),
        formatNumber(stats.errors),
      ]);
    });

    console.log(summaryTable.toString());
    logger.blank();

    // Show warnings if any
    if (Object.values(results).some((r: any) => r.errors > 0)) {
      console.log(chalk.yellow("Import completed with warnings:"));
      Object.entries(results).forEach(([type, stats]: [string, any]) => {
        if (stats.errors > 0) {
          console.log(`  ${chalk.yellow("•")} ${type}: ${stats.errors} errors`);
        }
      });
      logger.blank();
    }

    logger.success("Import completed successfully");

  } catch (error) {
    logger.error(`Import failed: ${(error as Error).message}`);
    if (!_options.ignoreErrors) {
      process.exit(1);
    }
  }
}

/**
 * Detect file format
 */
function detectFormat(content: string): "json" | "jsonl" | "cartridge" {
  try {
    const parsed = JSON.parse(content);

    // Check if it's a cartridge
    if (parsed.type === "aequor-cartridge") {
      return "cartridge";
    }

    // Check if it's JSONL
    if (content.includes("\n")) {
      try {
        const lines = content.split("\n").filter(Boolean);
        lines.forEach(line => JSON.parse(line));
        return "jsonl";
      } catch {
        // Not JSONL
      }
    }

    return "json";
  } catch {
    return "json"; // Default to JSON if parsing fails
  }
}

/**
 * Parse JSONL content
 */
function parseJsonl(content: string): any[] {
  const lines = content.split("\n").filter(Boolean);
  const results: any[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      results.push(parsed);
    } catch (error) {
      logger.warn(`Failed to parse line: ${error}`);
    }
  }

  return results;
}

/**
 * Validate import file
 */
async function validateImportFile(data: any, format: string): Promise<void> {
  if (format === "cartridge") {
    // Validate cartridge structure
    if (!data.type || data.type !== "aequor-cartridge") {
      throw new Error("Invalid cartridge format");
    }
    if (!data.data || !data.version) {
      throw new Error("Cartridge missing required fields");
    }
  } else if (format === "jsonl") {
    // Validate JSONL structure
    if (!Array.isArray(data)) {
      throw new Error("JSONL import must be an array");
    }
  } else {
    // Validate regular JSON structure
    if (!data.type || !data.data) {
      throw new Error("Invalid export format");
    }
  }

  logger.info("File validation passed");
}

/**
 * Preview import without executing
 */
async function previewImport(data: any, typeFilter?: string): Promise<void> {
  logger.info("Previewing import...");

  let itemsToImport: any[] = [];

  if (detectFormat(JSON.stringify(data)) === "jsonl") {
    itemsToImport = data;
  } else {
    const importData = data.data || data;
    if (typeFilter === "all") {
      itemsToImport = Object.values(importData || {}).flat();
    } else {
      itemsToImport = typeFilter ? (importData as Record<string, any>)?.[typeFilter] || [] : [];
    }
  }

  console.log(chalk.cyan("Import Preview:"));
  console.log(`  ${chalk.grey("•")} Total items: ${formatNumber(itemsToImport.length)}`);
  console.log(`  ${chalk.grey("•")} Import mode: merge`);
  console.log(`  ${chalk.grey("•")} Type filter: ${typeFilter || "all"}`);
  logger.blank();

  // Show sample items
  if (itemsToImport.length > 0) {
    console.log(chalk.cyan("Sample items:"));
    const sample = itemsToImport.slice(0, 3);
    sample.forEach((item: any, index: number) => {
      console.log(`  ${chalk.grey(`${index + 1}.`)} ${JSON.stringify(item).substring(0, 100)}...`);
    });
    if (itemsToImport.length > 3) {
      console.log(`  ${chalk.grey(`... and ${formatNumber(itemsToImport.length - 3)} more items`)}`);
    }
  }

  logger.blank();
  console.log(chalk.yellow("This is a preview. Use --dry-run to see more details."));
}

/**
 * Perform the actual import
 */
async function performImport(data: any, mode: string, typeFilter: string, ignoreErrors: boolean): Promise<any> {
  const results: Record<string, { attempted: number; success: number; skipped: number; errors: number }> = {};

  // Determine what to import based on type filter
  let importData: any;

  if (detectFormat(JSON.stringify(data)) === "jsonl") {
    importData = data;
  } else {
    importData = data.data || data;
  }

  // Import based on type filter
  const typesToImport = typeFilter === "all" ? Object.keys(importData) : [typeFilter];

  for (const type of typesToImport) {
    results[type] = { attempted: 0, success: 0, skipped: 0, errors: 0 };

    const items = Array.isArray(importData[type]) ? importData[type] : [importData[type]];

    for (const item of items) {
      results[type].attempted++;

      try {
        switch (type) {
          case "knowledge":
            await importKnowledgeItem(item, mode as "merge" | "replace" | "skip");
            results[type].success++;
            break;
          case "cache":
            await importCacheItem(item, mode as "merge" | "replace" | "skip");
            results[type].success++;
            break;
          case "config":
            await importConfigItem(item);
            results[type].success++;
            break;
          case "logs":
            await importLogItem(item);
            results[type].success++;
            break;
          default:
            logger.warn(`Unknown type: ${type}`);
            results[type].skipped++;
            break;
        }
      } catch (error) {
        results[type].errors++;
        if (!ignoreErrors) {
          throw error;
        }
        logger.warn(`Failed to import ${type} item: ${(error as Error).message}`);
      }
    }
  }

  return results;
}

/**
 * Import knowledge item
 */
async function importKnowledgeItem(item: any, mode: "merge" | "replace" | "skip"): Promise<void> {
  const config = await configManager.getAll() as any;
  const knowledgeDir = config.knowledge?.directory || "./knowledge";
  const filename = `${item.id || Date.now()}.json`;
  const filepath = join(knowledgeDir, filename);

  // Create directory if it doesn't exist
  await fs.mkdir(knowledgeDir, { recursive: true });

  // Handle mode
  if (mode === "skip") {
    try {
      await fs.access(filepath);
      logger.warn(`Knowledge entry ${filename} already exists, skipping`);
      return;
    } catch {
      // File doesn't exist, continue
    }
  }

  await fs.writeFile(filepath, JSON.stringify(item, null, 2));
  logger.info(`Imported knowledge entry: ${filename}`);
}

/**
 * Import cache item
 */
async function importCacheItem(item: any, mode: string): Promise<void> {
  const config = await configManager.getAll();
  const cacheDir = config.cache.directory || "./cache";

  // Generate cache key from query
  const cacheKey = item.query ? `cache_${Buffer.from(item.query).toString('base64').substring(0, 32)}.json` : `cache_${Date.now()}.json`;
  const filepath = join(cacheDir, cacheKey);

  // Create directory if it doesn't exist
  await fs.mkdir(cacheDir, { recursive: true });

  // Handle mode
  if (mode === "skip") {
    try {
      await fs.access(filepath);
      logger.warn(`Cache entry ${cacheKey} already exists, skipping`);
      return;
    } catch {
      // File doesn't exist, continue
    }
  }

  // Prepare cache entry
  const cacheEntry = {
    query: item.query,
    response: item.response,
    timestamp: item.timestamp || Date.now(),
    hits: item.hits || 0,
    embedding: item.embedding,
    metadata: item.metadata,
  };

  await fs.writeFile(filepath, JSON.stringify(cacheEntry, null, 2));
  logger.info(`Imported cache entry: ${cacheKey}`);
}

/**
 * Import config item
 */
async function importConfigItem(item: any): Promise<void> {
  if (item.config) {
    await configManager.save();
    logger.info("Imported configuration");
  }
}

/**
 * Import log item
 */
async function importLogItem(item: any): Promise<void> {
  const config = await configManager.getAll() as any;
  const logDir = config.logging?.directory || "./logs";
  const logFile = join(logDir, "imported.log");

  // Create directory if it doesn't exist
  await fs.mkdir(logDir, { recursive: true });

  // Format log entry
  const logEntry = JSON.stringify({
    ...item,
    imported: true,
    importTime: new Date().toISOString(),
  }) + "\n";

  await fs.appendFile(logFile, logEntry);
  logger.info(`Imported log entry`);
}