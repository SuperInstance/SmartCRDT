/**
 * System command - System information and management
 */

import { Command } from "commander";
import chalk from "chalk";
import { cpus, freemem, totalmem } from "os";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { createTable, formatNumber, formatBytes } from "../utils/formatting.js";

/**
 * Create system command
 */
export function createSystemCommand(): Command {
  const cmd = new Command("system");

  cmd.description("System information and management");

  // Info subcommand
  const infoCmd = new Command("info");
  infoCmd
    .description("Show system information")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: SystemInfoOptions) => {
      await executeSystemInfo(_options);
    });

  // Health subcommand
  const healthCmd = new Command("health");
  healthCmd
    .description("Check system health")
    .option("-d, --detailed", "Show detailed health check")
    .action(async (_options: SystemHealthOptions) => {
      await executeSystemHealth(_options);
    });

  // Metrics subcommand
  const metricsCmd = new Command("metrics");
  metricsCmd
    .description("Show performance metrics")
    .option("-p, --_period <_period>", "Time _period", "session")
    .action(async (_options: SystemMetricsOptions) => {
      await executeSystemMetrics(_options);
    });

  cmd.addCommand(infoCmd);
  cmd.addCommand(healthCmd);
  cmd.addCommand(metricsCmd);

  return cmd;
}

/**
 * System info _options
 */
export interface SystemInfoOptions {
  format?: "text" | "json";
}

/**
 * System health _options
 */
export interface SystemHealthOptions {
  detailed?: boolean;
}

/**
 * System metrics _options
 */
export interface SystemMetricsOptions {
  _period?: string;
}

/**
 * Execute system info
 */
async function executeSystemInfo(_options: SystemInfoOptions): Promise<void> {
  try {
    const _config = await configManager.getAll();
    const osType = process.platform;
    const osArch = process.arch;
    const nodeVersion = process.version;
    const cpuInfo = cpus();
    const cpuModel = cpuInfo[0]?.model || "Unknown";
    const cpuCores = cpuInfo.length;
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const usedMemory = totalMemory - freeMemory;

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            system: {
              os: osType,
              arch: osArch,
              nodeVersion,
            },
            hardware: {
              cpu: {
                model: cpuModel,
                cores: cpuCores,
              },
              memory: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory,
              },
            },
            aequor: {
              version: (_config as any).version || "0.1.0",
              configPath: (_config as any)._configPath || "unknown",
            },
          },
          null,
          2
        )
      );
    } else {
      logger.blank();

      console.log(chalk.cyan("System Information:"));
      logger.blank();

      // System info table
      const systemTable = createTable([
        { header: "Setting", width: 20 },
        { header: "Value", width: 50 },
      ]);

      systemTable.push([chalk.cyan("Operating System"), `${osType} ${osArch}`]);
      systemTable.push([chalk.cyan("Node.js Version"), nodeVersion]);
      systemTable.push([chalk.cyan("CPU"), cpuModel]);
      systemTable.push([chalk.cyan("CPU Cores"), formatNumber(cpuCores)]);
      systemTable.push([chalk.cyan("Total Memory"), formatBytes(totalMemory)]);
      systemTable.push([chalk.cyan("Used Memory"), formatBytes(usedMemory)]);
      systemTable.push([chalk.cyan("Free Memory"), formatBytes(freeMemory)]);

      console.log(systemTable.toString());
      logger.blank();

      // Aequor info
      console.log(chalk.cyan("Aequor Information:"));
      console.log(
        `  ${chalk.grey("•")} Version: ${(_config as any).version || "0.1.0"}`
      );
      console.log(
        `  ${chalk.grey("•")} Config Path: ${(_config as any)._configPath || "unknown"}`
      );
      console.log(
        `  ${chalk.grey("•")} Cache: ${_config.cache.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
      );
      console.log(
        `  ${chalk.grey("•")} Privacy: ${_config.privacy.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
      );
      console.log(
        `  ${chalk.grey("•")} Local Backend: ${(_config.backend as any).local?.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
      );
      console.log(
        `  ${chalk.grey("•")} Cloud Backend: ${(_config.backend as any).cloud?.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`System info failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute system health
 */
async function executeSystemHealth(
  _options: SystemHealthOptions
): Promise<void> {
  try {
    const _config = await configManager.getAll();
    const freeMemory = freemem();
    const totalMemory = totalmem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    logger.blank();
    console.log(chalk.cyan("System Health Check:"));
    logger.blank();

    const healthTable = createTable([
      { header: "Component", width: 25 },
      { header: "Status", width: 15 },
      { header: "Details", width: 40 },
    ]);

    // Memory health
    let memoryStatus = chalk.green("Healthy");
    let memoryDetails = `${memoryUsagePercent.toFixed(1)}% used`;
    if (memoryUsagePercent > 90) {
      memoryStatus = chalk.red("Critical");
    } else if (memoryUsagePercent > 75) {
      memoryStatus = chalk.yellow("Warning");
    }

    healthTable.push([chalk.cyan("Memory"), memoryStatus, memoryDetails]);

    // Cache health
    const cacheStatus = _config.cache.enabled
      ? chalk.green("Enabled")
      : chalk.red("Disabled");
    healthTable.push([
      chalk.cyan("Cache"),
      cacheStatus,
      _config.cache.enabled
        ? `Max: ${_config.cache.maxSize}MB, TTL: ${_config.cache.ttl}s`
        : "Not configured",
    ]);

    // Privacy health
    const privacyStatus = (_config.privacy as any).enabled
      ? chalk.green("Enabled")
      : chalk.red("Disabled");
    healthTable.push([
      chalk.cyan("Privacy"),
      privacyStatus,
      `ε=${(_config.privacy as any).epsilon}`,
    ]);

    // Local backend health
    const localBackendStatus = (_config.backend as any).local?.enabled
      ? chalk.green("Enabled")
      : chalk.red("Disabled");
    healthTable.push([
      chalk.cyan("Local Backend"),
      localBackendStatus,
      (_config.backend as any).local?.enabled
        ? (_config.backend as any).local?.url
        : "Not configured",
    ]);

    // Cloud backend health
    const cloudBackendStatus = (_config.backend as any).cloud?.enabled
      ? chalk.green("Enabled")
      : chalk.red("Disabled");
    healthTable.push([
      chalk.cyan("Cloud Backend"),
      cloudBackendStatus,
      (_config.backend as any).cloud?.enabled
        ? `${(_config.backend as any).cloud?.provider} (${(_config.backend as any).cloud?.model})`
        : "Not configured",
    ]);

    console.log(healthTable.toString());
    logger.blank();

    // Overall health
    const allHealthy =
      memoryUsagePercent < 75 && _config.cache.enabled && (_config.privacy as any).enabled;

    if (allHealthy) {
      logger.success("All systems operational");
    } else {
      logger.warn("Some systems need attention");
    }
    logger.blank();

    // Detailed health check
    if (_options.detailed) {
      console.log(chalk.cyan("Detailed Health Information:"));
      logger.blank();

      console.log(`${chalk.cyan("Memory Analysis:")}`);
      console.log(`  ${chalk.grey("•")} Total: ${formatBytes(totalMemory)}`);
      console.log(`  ${chalk.grey("•")} Free: ${formatBytes(freeMemory)}`);
      console.log(
        `  ${chalk.grey("•")} Used: ${formatBytes(totalMemory - freeMemory)}`
      );
      console.log(
        `  ${chalk.grey("•")} Usage: ${memoryUsagePercent.toFixed(1)}%`
      );
      logger.blank();

      console.log(`${chalk.cyan("Configuration:")}`);
      console.log(
        `  ${chalk.grey("•")} Complexity Threshold: ${(_config as any).router.complexityThreshold}`
      );
      console.log(
        `  ${chalk.grey("•")} Default Backend: ${(_config as any).router.backend}`
      );
      console.log(
        `  ${chalk.grey("•")} Logging Level: ${(_config as any).logging._level}`
      );
      console.log(
        `  ${chalk.grey("•")} Shadow Logging: ${(_config as any).logging.shadowEnabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
      );
      logger.blank();
    }

    console.log(chalk.cyan("Health Management:"));
    console.log(
      `  ${chalk.grey("•")} Enable cache: ${chalk.cyan("aequor _config set cache.enabled true")}`
    );
    console.log(
      `  ${chalk.grey("•")} Enable privacy: ${chalk.cyan("aequor _config set privacy.enabled true")}`
    );
    console.log(
      `  ${chalk.grey("•")} Set backend: ${chalk.cyan("aequor _config set backend.local.url <url>")}`
    );
    logger.blank();
  } catch (error) {
    logger.error(`System health check failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute system metrics
 */
async function executeSystemMetrics(
  _options: SystemMetricsOptions
): Promise<void> {
  try {
    const _config = await configManager.getAll();

    logger.blank();
    console.log(chalk.cyan("Performance Metrics:"));
    logger.blank();

    console.log(`${chalk.cyan("Period:")} ${_options._period}`);
    logger.blank();

    const metricsTable = createTable([
      { header: "Metric", width: 30 },
      { header: "Value", width: 25 },
      { header: "Target", width: 20 },
    ]);

    // These would be real metrics in production
    // For now, showing placeholders

    metricsTable.push([chalk.cyan("Cache Hit Rate"), "N/A", "≥80%"]);

    metricsTable.push([chalk.cyan("Avg Query Latency"), "N/A", "<100ms"]);

    metricsTable.push([chalk.cyan("Cost Reduction"), "N/A", "≥90%"]);

    metricsTable.push([chalk.cyan("Privacy Coverage"), "N/A", "100%"]);

    console.log(metricsTable.toString());
    logger.blank();

    console.log(chalk.cyan("Metrics Information:"));
    console.log(
      `  ${chalk.grey("•")} Metrics collection requires additional setup`
    );
    console.log(`  ${chalk.grey("•")} See documentation for enabling metrics`);
    console.log(
      `  ${chalk.grey("•")} Metrics are stored in: ${(_config as any).logging.shadowPath || "./shadow-logs"}`
    );
    logger.blank();

    console.log(chalk.cyan("Enable Metrics:"));
    console.log(
      `  ${chalk.grey("1.")} Enable shadow logging: ${chalk.cyan("aequor _config set logging.shadowEnabled true")}`
    );
    console.log(`  ${chalk.grey("2.")} Run queries to collect data`);
    console.log(
      `  ${chalk.grey("3.")} Export training data: ${chalk.cyan("aequor train --stats")}`
    );
    logger.blank();
  } catch (error) {
    logger.error(`System metrics failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
