/**
 * Export command - Export knowledge from Aequor
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { formatBytes } from "../utils/formatting.js";

/**
 * Export command options
 */
export interface ExportOptions {
  /** Output file */
  output?: string;
  /** Export format */
  format?: "json" | "jsonl" | "cartridge";
  /** What to export */
  what?: "all" | "knowledge" | "cache" | "config" | "logs";
  /** Filter by pattern */
  pattern?: string;
  /** Include metadata */
  metadata?: boolean;
  /** Compress output */
  compress?: boolean;
}

/**
 * Create export command
 */
export function createExportCommand(): Command {
  const cmd = new Command("export");

  cmd
    .description("Export knowledge and data from Aequor")
    .option("-o, --output <file>", "Output file", "export.json")
    .option("-f, --format <format>", "Export format (json|jsonl|cartridge)", "json")
    .option("-w, --what <type>", "What to export (all|knowledge|cache|config|logs)", "all")
    .option("-p, --pattern <pattern>", "Filter by pattern")
    .option("-m, --metadata", "Include metadata", false)
    .option("-c, --compress", "Compress output", false)
    .action(async (_options: ExportOptions) => {
      await executeExport(_options);
    });

  return cmd;
}

/**
 * Execute export command
 */
async function executeExport(_options: ExportOptions): Promise<void> {
  try {
    logger.info(`Exporting ${_options.what} data...`);

    // Prepare export data
    let exportData: any;

    switch (_options.what) {
      case "knowledge":
        exportData = await exportKnowledge(_options.pattern, _options.metadata);
        break;
      case "cache":
        exportData = await exportCache(_options.pattern, _options.metadata);
        break;
      case "config":
        exportData = await exportConfig(_options.metadata);
        break;
      case "logs":
        exportData = await exportLogs(_options.pattern, _options.metadata);
        break;
      case "all":
      default:
        exportData = await exportAll(_options.pattern, _options.metadata);
        break;
    }

    // Handle different output formats
    let outputContent: string;
    let outputFile = _options.output || "export.json";

    switch (_options.format) {
      case "jsonl":
        if (_options.what === "all") {
          outputContent = Object.entries(exportData)
            .map(([key, value]) => JSON.stringify({ type: key, data: value }))
            .join("\n");
        } else {
          outputContent = exportData.map((item: any) => JSON.stringify(item)).join("\n");
        }
        if (!outputFile.endsWith(".jsonl")) {
          outputFile += ".jsonl";
        }
        break;

      case "cartridge":
        outputContent = JSON.stringify({
          type: "aequor-cartridge",
          version: "1.0",
          data: exportData,
          metadata: _options.metadata ? generateMetadata() : undefined,
          exported: new Date().toISOString(),
        }, null, 2);
        if (!outputFile.endsWith(".cartridge")) {
          outputFile += ".cartridge";
        }
        break;

      case "json":
      default:
        outputContent = JSON.stringify({
          type: "aequor-export",
          version: "1.0",
          data: exportData,
          metadata: _options.metadata ? generateMetadata() : undefined,
          exported: new Date().toISOString(),
        }, null, 2);
        break;
    }

    // Write file
    await fs.writeFile(outputFile, outputContent, "utf8");

    // Handle compression if requested
    if (_options.compress) {
      const { gzipSync } = await import("node:zlib");
      const compressed = gzipSync(outputContent);
      const compressedFile = outputFile + ".gz";
      await fs.writeFile(compressedFile, compressed);
      logger.success(`Exported and compressed to ${chalk.cyan(compressedFile)}`);
      logger.info(`Original size: ${formatBytes(outputContent.length)}`);
      logger.info(`Compressed size: ${formatBytes(compressed.length)}`);
    } else {
      logger.success(`Exported to ${chalk.cyan(outputFile)}`);
      logger.info(`Size: ${formatBytes(outputContent.length)}`);
    }

    // Show summary
    logger.blank();
    console.log(chalk.cyan("Export Summary:"));
    const summary = formatExportSummary(exportData, _options.what || "unknown");
    console.log(`  ${chalk.grey("•")} Items exported: ${chalk.green(summary.items)}`);
    console.log(`  ${chalk.grey("•")} Size: ${chalk.green(summary.size)}`);
    console.log(`  ${chalk.grey("•")} Format: ${chalk.green(_options.format)}`);
    logger.blank();

    // Show import instructions
    console.log(chalk.cyan("To import this data:"));
    console.log(`  ${chalk.cyan(`aequor import --file ${outputFile}`)}`);
    if (_options.format === "cartridge") {
      console.log(`  ${chalk.cyan(`aequor cartridge install ${outputFile}`)}`);
    }
    logger.blank();

  } catch (error) {
    logger.error(`Export failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Export knowledge data
 */
async function exportKnowledge(pattern?: string, includeMetadata?: boolean): Promise<any> {
  const config = await configManager.getAll() as any;
  const knowledgeDir = config.knowledge?.directory || "./knowledge";

  logger.info(`Exporting knowledge from ${knowledgeDir}...`);

  const entries: any[] = [];

  try {
    const files = await fs.readdir(knowledgeDir);
    const semanticFiles = files.filter(f => f.endsWith(".json"));

    for (const file of semanticFiles) {
      const filepath = join(knowledgeDir, file);
      const content = await fs.readFile(filepath, "utf8");
      const entry = JSON.parse(content);

      // Filter by pattern if provided
      if (pattern && !entry.text.includes(pattern)) {
        continue;
      }

      entries.push(entry);
    }

    logger.info(`Found ${entries.length} knowledge entries`);

    return {
      type: "knowledge",
      entries: entries,
      metadata: includeMetadata ? {
        directory: knowledgeDir,
        totalEntries: entries.length,
        exported: new Date().toISOString(),
      } : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn("Knowledge directory not found");
      return { type: "knowledge", entries: [], metadata: undefined };
    }
    throw error;
  }
}

/**
 * Export cache data
 */
async function exportCache(pattern?: string, includeMetadata?: boolean): Promise<any> {
  const config = await configManager.getAll() as any;
  const cacheDir = config.cache.directory || "./cache";

  logger.info(`Exporting cache from ${cacheDir}...`);

  const entries: any[] = [];

  try {
    const files = await fs.readdir(cacheDir);
    const cacheFiles = files.filter(f => f.endsWith(".json"));

    for (const file of cacheFiles) {
      const filepath = join(cacheDir, file);
      const content = await fs.readFile(filepath, "utf8");
      const entry = JSON.parse(content);

      // Filter by pattern if provided
      if (pattern && !entry.query?.includes(pattern) && !entry.response?.includes(pattern)) {
        continue;
      }

      entries.push({
        query: entry.query,
        response: entry.response,
        timestamp: entry.timestamp,
        hits: entry.hits || 0,
        embedding: entry.embedding ? "..." : null, // Omit embedding for size
      });
    }

    logger.info(`Found ${entries.length} cache entries`);

    return {
      type: "cache",
      entries: entries,
      metadata: includeMetadata ? {
        directory: cacheDir,
        totalEntries: entries.length,
        exported: new Date().toISOString(),
      } : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn("Cache directory not found");
      return { type: "cache", entries: [], metadata: undefined };
    }
    throw error;
  }
}

/**
 * Export configuration
 */
async function exportConfig(includeMetadata?: boolean): Promise<any> {
  logger.info("Exporting configuration...");

  const config = await configManager.getAll();

  // Remove sensitive fields
  const sanitizedConfig = {
    ...config,
    // Remove sensitive values
    backend: {
      ...config.backend,
      cloud: config.backend.cloud ? {
        ...config.backend.cloud,
        apiKey: "***REDACTED***"
      } : undefined
    }
  };

  return {
    type: "config",
    config: sanitizedConfig,
    metadata: includeMetadata ? {
      exported: new Date().toISOString(),
      version: "1.0",
    } : undefined,
  };
}

/**
 * Export logs
 */
async function exportLogs(pattern?: string, includeMetadata?: boolean): Promise<any> {
  const config = await configManager.getAll() as any;
  const logDir = config.logging?.directory || "./logs";

  logger.info(`Exporting logs from ${logDir}...`);

  const logs: any[] = [];

  try {
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(f => f.endsWith(".log"));

    for (const file of logFiles) {
      const filepath = join(logDir, file);
      const content = await fs.readFile(filepath, "utf8");
      const lines = content.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);

          // Filter by pattern if provided
          if (pattern &&
              !logEntry.message?.includes(pattern) &&
              !logEntry.query?.includes(pattern)) {
            continue;
          }

          logs.push({
            timestamp: logEntry.timestamp,
            level: logEntry.level,
            message: logEntry.message,
            query: logEntry.query,
            response: logEntry.response,
            component: logEntry.component,
          });
        } catch (parseError) {
          // Skip malformed log entries
        }
      }
    }

    logger.info(`Found ${logs.length} log entries`);

    return {
      type: "logs",
      entries: logs,
      metadata: includeMetadata ? {
        directory: logDir,
        totalEntries: logs.length,
        exported: new Date().toISOString(),
      } : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn("Log directory not found");
      return { type: "logs", entries: [], metadata: undefined };
    }
    throw error;
  }
}

/**
 * Export all data
 */
async function exportAll(pattern?: string, includeMetadata?: boolean): Promise<any> {
  logger.info("Exporting all data...");

  const results: any = {};

  // Export knowledge
  results.knowledge = await exportKnowledge(pattern, includeMetadata);

  // Export cache
  results.cache = await exportCache(pattern, includeMetadata);

  // Export config
  results.config = await exportConfig(includeMetadata);

  // Export logs
  results.logs = await exportLogs(pattern, includeMetadata);

  return results;
}

/**
 * Generate metadata
 */
function generateMetadata(): any {
  return {
    exporter: "aequor-cli",
    version: "1.0.0",
    exported: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Format export summary
 */
function formatExportSummary(data: any, what: string): { items: string; size: string } {
  let totalItems = 0;

  if (what === "all") {
    totalItems = Object.values(data).reduce((sum: number, group: any) => {
      return sum + (group.entries?.length || 0);
    }, 0);
  } else if (data.entries) {
    totalItems = data.entries.length;
  }

  return {
    items: totalItems.toLocaleString(),
    size: formatBytes(JSON.stringify(data).length),
  };
}