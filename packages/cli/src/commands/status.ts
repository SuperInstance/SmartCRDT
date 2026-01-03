/**
 * Status command - Show system health and statistics
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import {
  createTable,
  formatBytes,
  getStatusBadge,
} from "../utils/formatting.js";
import { configManager } from "../config/manager.js";
import { createOllamaAdapter } from "@lsi/cascade";

/**
 * Status command _options
 */
export interface StatusOptions {
  /** Output format */
  format?: "text" | "json";
  /** Check backend health */
  health?: boolean;
}

/**
 * Create status command
 */
export function createStatusCommand(): Command {
  const cmd = new Command("status");

  cmd
    .description("Show system health and statistics")
    .option("-f, --format <format>", "Output format", "text")
    .option("--health", "Check backend health only")
    .action(async (_options: StatusOptions) => {
      await executeStatus(_options);
    });

  return cmd;
}

/**
 * Execute status command
 */
async function executeStatus(_options: StatusOptions): Promise<void> {
  try {
    const _config = await configManager.getAll();

    if (_options.format === "json") {
      await outputJsonStatus(_config);
    } else {
      await outputTextStatus(_config, _options.health);
    }
  } catch (error) {
    logger.error(`Failed to get status: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Output status as text
 */
async function outputTextStatus(
  _config: any,
  healthOnly: boolean = false
): Promise<void> {
  logger.blank();

  // System status
  const systemTable = createTable([
    { header: "Component", width: 20 },
    { header: "Status", width: 15 },
    { header: "Details", width: 45 },
  ]);

  // Check local backend
  const localStatus = await checkLocalBackend();
  systemTable.push([
    chalk.cyan("Local Backend"),
    getStatusBadge(localStatus.healthy ? "Online" : "Offline"),
    localStatus.healthy
      ? `URL: ${_config.backend.localUrl}`
      : chalk.red(localStatus.error || "Not reachable"),
  ]);

  // Check cloud backend
  const cloudStatus = await checkCloudBackend();
  systemTable.push([
    chalk.cyan("Cloud Backend"),
    getStatusBadge(cloudStatus.healthy ? "Online" : "Offline"),
    cloudStatus.healthy
      ? `API: ${_config.backend.cloud?.baseURL || "OpenAI"}`
      : chalk.red(cloudStatus.error || "No API key"),
  ]);

  console.log(systemTable.toString());

  if (healthOnly) {
    return;
  }

  logger.blank();

  // Configuration summary
  const configTable = createTable([
    { header: "Setting", width: 25 },
    { header: "Value", width: 50 },
  ]);

  configTable.push([chalk.cyan("Backend Type"), _config.backend.type]);
  configTable.push([chalk.cyan("Default Model"), _config.defaultModel]);
  configTable.push([
    chalk.cyan("Complexity Threshold"),
    _config.routing.complexityThreshold.toString(),
  ]);
  configTable.push([
    chalk.cyan("Local First"),
    _config.routing.localFirst ? "Yes" : "No",
  ]);
  configTable.push([
    chalk.cyan("Cache Enabled"),
    _config.cache.enabled ? "Yes" : "No",
  ]);

  console.log(configTable.toString());
  logger.blank();

  // Cache status
  const cacheSize = await configManager.getCacheSize();
  const cacheTable = createTable([
    { header: "Cache", width: 20 },
    { header: "Value", width: 50 },
  ]);

  cacheTable.push([
    chalk.cyan("Status"),
    _config.cache.enabled
      ? getStatusBadge("Enabled")
      : getStatusBadge("Disabled"),
  ]);
  cacheTable.push([chalk.cyan("Size"), formatBytes(cacheSize)]);
  cacheTable.push([
    chalk.cyan("Max Size"),
    formatBytes(_config.cache.maxSize * 1024 * 1024),
  ]);
  cacheTable.push([chalk.cyan("TTL"), `${_config.cache.ttl}s`]);
  cacheTable.push([chalk.cyan("Directory"), _config.cache.directory]);

  console.log(cacheTable.toString());
  logger.blank();

  // Budget status
  const budgetTable = createTable([
    { header: "Budget", width: 20 },
    { header: "Limit", width: 20 },
    { header: "Used", width: 15 },
    { header: "Remaining", width: 15 },
  ]);

  budgetTable.push([
    chalk.cyan("Daily"),
    `$${(_config.budget.daily / 100).toFixed(2)}`,
    "TODO",
    "TODO",
  ]);
  budgetTable.push([
    chalk.cyan("Weekly"),
    `$${(_config.budget.weekly / 100).toFixed(2)}`,
    "TODO",
    "TODO",
  ]);
  budgetTable.push([
    chalk.cyan("Monthly"),
    `$${(_config.budget.monthly / 100).toFixed(2)}`,
    "TODO",
    "TODO",
  ]);

  console.log(budgetTable.toString());
  logger.blank();

  // Available models
  console.log(chalk.cyan("Available Models:"));
  logger.blank();

  const localModels = localStatus.models || [];
  const cloudModels = _config.cloudModels || [];

  if (localModels.length > 0) {
    console.log(chalk.green("Local Models:"));
    localModels.forEach((model: string) => {
      console.log(`  ${chalk.grey("•")} ${model}`);
    });
    logger.blank();
  }

  if (cloudModels.length > 0) {
    console.log(chalk.blue("Cloud Models:"));
    cloudModels.forEach((model: string) => {
      console.log(`  ${chalk.grey("•")} ${model}`);
    });
    logger.blank();
  }
}

/**
 * Output status as JSON
 */
async function outputJsonStatus(
  _config: Awaited<ReturnType<typeof configManager.getAll>>
): Promise<void> {
  const localStatus = await checkLocalBackend();
  const cloudStatus = await checkCloudBackend();
  const cacheSize = await configManager.getCacheSize();

  const status = {
    backend: {
      local: localStatus,
      cloud: cloudStatus,
    },
    _config,
    cache: {
      size: cacheSize,
      maxSize: _config.cache.maxSize * 1024 * 1024,
      ttl: _config.cache.ttl,
      directory: _config.cache.directory,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(status, null, 2));
}

/**
 * Check local backend health
 */
async function checkLocalBackend(): Promise<{
  healthy: boolean;
  models?: string[];
  error?: string;
}> {
  try {
    const _config = await configManager.getBackendConfig();
    const adapter = createOllamaAdapter(
      _config.localUrl || "http://localhost:11434",
      "llama2:7b",
      {
        timeout: 5000,
        maxRetries: 1,
        stream: false,
      }
    );

    const health = await adapter.checkHealth();
    return {
      healthy: health.healthy,
      models: health.models,
      error: health.error,
    };
  } catch (error) {
    return {
      healthy: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check cloud backend health
 */
async function checkCloudBackend(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    const _config = await configManager.getBackendConfig();
    const apiKey = _config.cloud?.apiKey;

    if (!apiKey || apiKey.length === 0) {
      return {
        healthy: false,
        error: "No API key configured",
      };
    }

    // TODO: Implement actual health check for OpenAI
    return {
      healthy: true,
    };
  } catch (error) {
    return {
      healthy: false,
      error: (error as Error).message,
    };
  }
}
