/**
 * Models command - List and manage available models
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import {
  createTable,
  formatModelName,
} from "../utils/formatting.js";
import { configManager } from "../config/manager.js";
import { createOllamaAdapter } from "@lsi/cascade";
import type { OllamaModel } from "@lsi/protocol";

/**
 * Models command _options
 */
export interface ModelsOptions {
  /** Output format */
  format?: "text" | "json";
  /** Verbose output */
  _verbose?: boolean;
  /** Refresh model list */
  refresh?: boolean;
}

/**
 * Create models command
 */
export function createModelsCommand(): Command {
  const cmd = new Command("models");

  cmd
    .description("List and manage available models")
    .option("-f, --format <format>", "Output format", "text")
    .option("-v, --_verbose", "Show detailed model information")
    .option("-r, --refresh", "Refresh model list from backend")
    .action(async (_options: ModelsOptions) => {
      await executeModels(_options);
    });

  return cmd;
}

/**
 * Execute models command
 */
async function executeModels(_options: ModelsOptions): Promise<void> {
  try {
    const _config = await configManager.getAll();
    const localModels = await getLocalModels();

    if (_options.format === "json") {
      outputJsonModels(localModels, _config);
    } else {
      outputTextModels(localModels, _config, _options._verbose);
    }
  } catch (error) {
    logger.error(`Failed to list models: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Get local models from Ollama
 */
async function getLocalModels(): Promise<OllamaModel[]> {
  try {
    const backendConfig = await configManager.getBackendConfig();
    const adapter = createOllamaAdapter(
      backendConfig.localUrl || "http://localhost:11434",
      "llama2:7b",
      {
        timeout: 5000,
        maxRetries: 1,
        stream: false,
      }
    );

    const health = await adapter.checkHealth();
    if (health.healthy && health.models) {
      // Get detailed model info
      const models: OllamaModel[] = [];
      for (const modelName of health.models) {
        models.push({
          name: modelName,
          size: 0,
          details: {
            family: "unknown",
            parameter_size: "unknown",
            quantization_level: "unknown",
          },
        });
      }
      return models;
    }

    return [];
  } catch (error) {
    logger.warn(`Failed to get local models: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Output models as text
 */
function outputTextModels(
  localModels: OllamaModel[],
  _config: Awaited<ReturnType<typeof configManager.getAll>>,
  _verbose: boolean = false
): void {
  logger.blank();

  // Local models table
  if (localModels.length > 0) {
    console.log(chalk.cyan("Local Models (Ollama):"));
    logger.blank();

    const table = createTable([
      { header: "Model", width: 30 },
      { header: "Family", width: 15 },
      { header: "Parameters", width: 15 },
      { header: "Status", width: 10 },
    ]);

    for (const model of localModels) {
      const isDefault = model.name === _config.defaultModel;
      const status = isDefault ? chalk.green("Default") : "";
      const family = model.details?.family || "Unknown";
      const params = model.details?.parameter_size || "Unknown";

      table.push([
        isDefault ? chalk.green(`* ${model.name}`) : model.name,
        family,
        params,
        status,
      ]);
    }

    console.log(table.toString());
    logger.blank();
  } else {
    console.log(chalk.yellow("No local models found"));
    console.log(chalk.grey("Make sure Ollama is running: ollama serve"));
    logger.blank();
  }

  // Cloud models
  if (_config.cloudModels.length > 0) {
    console.log(chalk.cyan("Cloud Models:"));
    logger.blank();

    const cloudTable = createTable([
      { header: "Model", width: 40 },
      { header: "Status", width: 15 },
    ]);

    for (const model of _config.cloudModels) {
      const isDefault = model === _config.defaultModel;
      const status = isDefault ? chalk.green("Default") : "";
      cloudTable.push([
        isDefault
          ? chalk.green(`* ${formatModelName(model)}`)
          : formatModelName(model),
        status,
      ]);
    }

    console.log(cloudTable.toString());
    logger.blank();
  }

  // Current settings
  console.log(chalk.cyan("Current Settings:"));
  console.log(`  Backend Type: ${chalk.green(_config.backend.type)}`);
  console.log(`  Default Model: ${chalk.green(_config.defaultModel)}`);
  logger.blank();

  // Help text
  console.log(chalk.grey("Tips:"));
  console.log(
    `  ${chalk.grey("•")} Set default model: ${chalk.cyan("aequor _config set defaultModel <model>")}`
  );
  console.log(
    `  ${chalk.grey("•")} Pull new model: ${chalk.cyan("ollama pull <model>")}`
  );
  console.log(
    `  ${chalk.grey("•")} Run local model: ${chalk.cyan('aequor query "<text>" --local --model <model>')}`
  );
  logger.blank();
}

/**
 * Output models as JSON
 */
function outputJsonModels(
  localModels: OllamaModel[],
  _config: Awaited<ReturnType<typeof configManager.getAll>>
): void {
  const output = {
    local: localModels,
    cloud: _config.cloudModels,
    default: _config.defaultModel,
    backendType: _config.backend.type,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
}
