/**
 * Test command - Run diagnostics and health checks
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  createTable,
  formatDuration,
  getStatusBadge,
} from "../utils/formatting.js";
import { logger } from "../utils/logger.js";
import { configManager } from "../config/manager.js";
import { createOllamaAdapter } from "@lsi/cascade";

/**
 * Test command _options
 */
export interface TestOptions {
  /** Specific test to run */
  test?: "all" | "local" | "cloud" | "_config" | "cache";
  /** Verbose output */
  _verbose?: boolean;
  /** Output format */
  format?: "text" | "json";
}

/**
 * Test result
 */
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  message: string;
  details?: string;
}

/**
 * Create test command
 */
export function createTestCommand(): Command {
  const cmd = new Command("test");

  cmd
    .description("Run diagnostics and health checks")
    .option(
      "-t, --test <test>",
      "Specific test to run (all, local, cloud, _config, cache)",
      "all"
    )
    .option("-v, --_verbose", "Verbose output")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: TestOptions) => {
      await executeTest(_options);
    });

  return cmd;
}

/**
 * Execute test command
 */
async function executeTest(_options: TestOptions): Promise<void> {
  const results: TestResult[] = [];

  try {
    if (_options.test === "all" || _options.test === "_config") {
      results.push(await testConfig());
    }

    if (_options.test === "all" || _options.test === "local") {
      results.push(await testLocalBackend());
    }

    if (_options.test === "all" || _options.test === "cloud") {
      results.push(await testCloudBackend());
    }

    if (_options.test === "all" || _options.test === "cache") {
      results.push(await testCache());
    }

    if (_options.format === "json") {
      outputJsonResults(results);
    } else {
      outputTextResults(results, _options._verbose);
    }

    // Exit with error code if any test failed
    const hasFailures = results.some(r => !r.passed);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    logger.error(`Test command failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Test configuration
 */
async function testConfig(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    await configManager.load();
    const _config = await configManager.getAll();

    // Validate _config structure
    if (!_config.backend || !_config.routing || !_config.budget) {
      return {
        name: "Configuration",
        passed: false,
        duration: Date.now() - startTime,
        message: "Invalid configuration structure",
        details: "Missing required sections",
      };
    }

    return {
      name: "Configuration",
      passed: true,
      duration: Date.now() - startTime,
      message: "Configuration loaded successfully",
      details: `Path: ${configManager.getConfigPath()}`,
    };
  } catch (error) {
    return {
      name: "Configuration",
      passed: false,
      duration: Date.now() - startTime,
      message: "Failed to load configuration",
      details: (error as Error).message,
    };
  }
}

/**
 * Test local backend
 */
async function testLocalBackend(): Promise<TestResult> {
  const startTime = Date.now();

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

    if (health.healthy) {
      return {
        name: "Local Backend",
        passed: true,
        duration: Date.now() - startTime,
        message: "Local backend is healthy",
        details: `URL: ${backendConfig.localUrl}, Models: ${health.models?.length || 0}`,
      };
    } else {
      return {
        name: "Local Backend",
        passed: false,
        duration: Date.now() - startTime,
        message: "Local backend is unhealthy",
        details: health.error || "Unknown error",
      };
    }
  } catch (error) {
    return {
      name: "Local Backend",
      passed: false,
      duration: Date.now() - startTime,
      message: "Failed to connect to local backend",
      details: (error as Error).message,
    };
  }
}

/**
 * Test cloud backend
 */
async function testCloudBackend(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const backendConfig = await configManager.getBackendConfig();
    const apiKey = backendConfig.cloud?.apiKey;

    if (!apiKey || apiKey.length === 0) {
      return {
        name: "Cloud Backend",
        passed: false,
        duration: Date.now() - startTime,
        message: "No API key configured",
        details:
          "Set API key with: aequor _config set backend.cloud.apiKey <key>",
      };
    }

    // TODO: Implement actual cloud backend test
    return {
      name: "Cloud Backend",
      passed: true,
      duration: Date.now() - startTime,
      message: "Cloud backend configured (not tested)",
      details: "API key is set, but OpenAI integration is pending",
    };
  } catch (error) {
    return {
      name: "Cloud Backend",
      passed: false,
      duration: Date.now() - startTime,
      message: "Failed to test cloud backend",
      details: (error as Error).message,
    };
  }
}

/**
 * Test cache
 */
async function testCache(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const cacheDir = configManager.getCacheDir();

    // Try to initialize cache directory
    await configManager.initCacheDir();

    // Check if cache is writable
    const { constants } = await import("node:fs");
    const { access } = await import("node:fs/promises");
    await access(cacheDir, constants.W_OK);

    const cacheSize = await configManager.getCacheSize();

    return {
      name: "Cache",
      passed: true,
      duration: Date.now() - startTime,
      message: "Cache is accessible",
      details: `Directory: ${cacheDir}, Size: ${cacheSize} bytes`,
    };
  } catch (error) {
    return {
      name: "Cache",
      passed: false,
      duration: Date.now() - startTime,
      message: "Cache is not accessible",
      details: (error as Error).message,
    };
  }
}

/**
 * Output results as text
 */
function outputTextResults(
  results: TestResult[],
  _verbose: boolean = false
): void {
  logger.blank();

  console.log(chalk.cyan("Aequor Diagnostics"));
  console.log(chalk.grey("=".repeat(60)));
  logger.blank();

  const table = createTable([
    { header: "Test", width: 20 },
    { header: "Status", width: 12 },
    { header: "Duration", width: 12 },
    { header: "Message", width: 40 },
  ]);

  for (const result of results) {
    table.push([
      result.name,
      getStatusBadge(result.passed ? "Passed" : "Failed"),
      formatDuration(result.duration),
      result.message,
    ]);
  }

  console.log(table.toString());

  if (_verbose) {
    logger.blank();
    console.log(chalk.cyan("Details:"));
    logger.blank();

    for (const result of results) {
      console.log(chalk.yellow(result.name + ":"));
      console.log(
        `  Status: ${result.passed ? chalk.green("PASSED") : chalk.red("FAILED")}`
      );
      console.log(`  Duration: ${formatDuration(result.duration)}`);
      console.log(`  Message: ${result.message}`);
      if (result.details) {
        console.log(`  Details: ${result.details}`);
      }
      console.log();
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  logger.blank();
  if (passed === total) {
    logger.success(`All tests passed (${passed}/${total})`);
  } else {
    logger.warn(`Some tests failed (${passed}/${total} passed)`);
  }
  logger.blank();
}

/**
 * Output results as JSON
 */
function outputJsonResults(results: TestResult[]): void {
  const output = {
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    },
    tests: results,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
}
