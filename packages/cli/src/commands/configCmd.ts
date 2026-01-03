/**
 * Config command - Manage Aequor configuration
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";

/**
 * Create _config command
 */
export function createConfigCommand(): Command {
  const cmd = new Command("_config");

  cmd
    .description("Manage Aequor configuration")
    .argument("[action]", "Action to perform", "get")
    .argument("[key]", "Configuration key (e.g., backend.localUrl)")
    .argument("[value]", "Configuration value (for set action)")
    .option("-e, --edit", "Open _config in editor")
    .option("--reset", "Reset configuration to defaults")
    .option("--show", "Show current configuration")
    .action(
      async (
        action: string,
        key: string,
        value: string,
        _options: ConfigOptions
      ) => {
        await executeConfigCommand(action, key, value, _options);
      }
    );

  return cmd;
}

/**
 * Config command _options
 */
export interface ConfigOptions {
  edit?: boolean;
  reset?: boolean;
  show?: boolean;
}

/**
 * Execute _config command
 */
async function executeConfigCommand(
  action: string,
  key: string,
  value: string,
  _options: ConfigOptions
): Promise<void> {
  try {
    if (_options.reset) {
      await configManager.reset();
      logger.success("Configuration reset to defaults");
      return;
    }

    if (_options.show) {
      await showConfig();
      return;
    }

    if (_options.edit) {
      await editConfig();
      return;
    }

    switch (action.toLowerCase()) {
      case "get":
        await getConfigValue(key);
        break;
      case "set":
        await setConfigValue(key, value);
        break;
      case "delete":
        await deleteConfigValue(key);
        break;
      case "list":
        await listConfig();
        break;
      default:
        // If no action specified, treat as get
        if (!key && !value) {
          await listConfig();
        } else if (key && !value) {
          await getConfigValue(key);
        } else {
          logger.error(`Unknown action: ${action}`);
          logger.info("Valid actions: get, set, delete, list");
          process.exit(1);
        }
    }
  } catch (error) {
    logger.error(`Config command failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Get configuration value
 */
async function getConfigValue(key: string): Promise<void> {
  if (!key) {
    logger.error("Configuration key is required");
    logger.info("Usage: aequor _config get <key>");
    logger.info("Example: aequor _config get backend.localUrl");
    process.exit(1);
  }

  const value = await configManager.get(key);

  if (value === undefined) {
    logger.warn(`Configuration key '${key}' not found`);
    process.exit(1);
  }

  // Pretty print based on type
  if (typeof value === "object") {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(value);
  }
}

/**
 * Set configuration value
 */
async function setConfigValue(key: string, value: string): Promise<void> {
  if (!key) {
    logger.error("Configuration key is required");
    logger.info("Usage: aequor _config set <key> <value>");
    logger.info(
      "Example: aequor _config set backend.localUrl http://localhost:11434"
    );
    process.exit(1);
  }

  if (!value) {
    logger.error("Configuration value is required");
    process.exit(1);
  }

  // Try to parse value as JSON/number/boolean
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if not valid JSON
  }

  await configManager.set(key, parsedValue);
  logger.success(
    `Configuration updated: ${chalk.cyan(key)} = ${chalk.green(JSON.stringify(parsedValue))}`
  );
}

/**
 * Delete configuration value
 */
async function deleteConfigValue(key: string): Promise<void> {
  if (!key) {
    logger.error("Configuration key is required");
    logger.info("Usage: aequor _config delete <key>");
    process.exit(1);
  }

  await configManager.delete(key);
}

/**
 * List all configuration
 */
async function listConfig(): Promise<void> {
  const _config = await configManager.getAll();

  console.log(chalk.cyan("Aequor Configuration:"));
  console.log(chalk.grey("=".repeat(60)));
  logger.blank();

  console.log(chalk.yellow("Backend:"));
  console.log(`  type: ${chalk.green(_config.backend.type)}`);
  console.log(`  localUrl: ${chalk.green(_config.backend.localUrl)}`);
  console.log(
    `  cloud.apiKey: ${_config.backend.cloud?.apiKey ? "***" + _config.backend.cloud.apiKey.slice(-4) : "(not set)"}`
  );
  console.log(
    `  cloud.baseURL: ${chalk.green(_config.backend.cloud?.baseURL || "default")}`
  );

  logger.blank();

  console.log(chalk.yellow("Routing:"));
  console.log(
    `  complexityThreshold: ${chalk.green(_config.routing.complexityThreshold.toString())}`
  );
  console.log(
    `  localFirst: ${chalk.green(_config.routing.localFirst.toString())}`
  );
  console.log(
    `  maxRetries: ${chalk.green(_config.routing.maxRetries.toString())}`
  );
  console.log(
    `  timeout: ${chalk.green(_config.routing.timeout.toString() + "ms")}`
  );

  logger.blank();

  console.log(chalk.yellow("Budget:"));
  console.log(
    `  daily: ${chalk.green("$" + (_config.budget.daily / 100).toFixed(2))}`
  );
  console.log(
    `  weekly: ${chalk.green("$" + (_config.budget.weekly / 100).toFixed(2))}`
  );
  console.log(
    `  monthly: ${chalk.green("$" + (_config.budget.monthly / 100).toFixed(2))}`
  );
  console.log(
    `  alertThreshold: ${chalk.green(_config.budget.alertThreshold.toString() + "%")}`
  );

  logger.blank();

  console.log(chalk.yellow("Cache:"));
  console.log(`  enabled: ${chalk.green(_config.cache.enabled.toString())}`);
  console.log(
    `  maxSize: ${chalk.green(_config.cache.maxSize.toString() + " MB")}`
  );
  console.log(`  ttl: ${chalk.green(_config.cache.ttl.toString() + "s")}`);
  console.log(`  directory: ${chalk.green(_config.cache.directory)}`);

  logger.blank();

  console.log(chalk.yellow("Display:"));
  console.log(`  colorize: ${chalk.green(_config.display.colorize.toString())}`);
  console.log(
    `  showTimestamp: ${chalk.green(_config.display.showTimestamp.toString())}`
  );
  console.log(`  format: ${chalk.green(_config.display.format)}`);
  console.log(
    `  streaming: ${chalk.green(_config.display.streaming.toString())}`
  );

  logger.blank();

  console.log(chalk.yellow("Privacy:"));
  console.log(`  enabled: ${chalk.green(_config.privacy.enabled.toString())}`);
  console.log(
    `  redactionLevel: ${chalk.green(_config.privacy.redactionLevel)}`
  );
  console.log(
    `  localOnly: ${chalk.green(_config.privacy.localOnly.toString())}`
  );

  logger.blank();

  console.log(chalk.yellow("Models:"));
  console.log(`  default: ${chalk.green(_config.defaultModel)}`);
  console.log(`  local: ${chalk.green(_config.localModels.join(", "))}`);
  console.log(`  cloud: ${chalk.green(_config.cloudModels.join(", "))}`);

  logger.blank();
  console.log(chalk.grey(`Config file: ${configManager.getConfigPath()}`));
}

/**
 * Show current configuration
 */
async function showConfig(): Promise<void> {
  const _config = await configManager.getAll();
  console.log(JSON.stringify(_config, null, 2));
}

/**
 * Edit configuration in editor
 */
async function editConfig(): Promise<void> {
  const editor = process.env.EDITOR || "vi";
  const configPath = configManager.getConfigPath();

  logger.info(`Opening ${configPath} in ${editor}...`);

  const { exec } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    exec(`${editor} "${configPath}"`, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  logger.success("Configuration file saved");
}
