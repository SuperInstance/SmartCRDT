/**
 * Run Command
 *
 * Run installed components as processes.
 * Supports argument passing, output capture, and environment variables.
 */

import { ComponentManager } from '@lsi/manager';
import { ConfigManager } from '@lsi/config';
import { createSpinner, success, info, error as logError } from '../utils/progress.js';
import {
  createComponentNotInstalledError,
  createCommandFailedError,
  CliError,
} from '../utils/errors.js';
import chalk from 'chalk';
import { ChildProcess } from 'child_process';

// ============================================================================
// RUN OPTIONS
// ============================================================================

/**
 * Run command options
 */
export interface RunOptions {
  /** Arguments to pass to component */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Detach process (run in background) */
  detach?: boolean;
  /** Debug mode */
  debug?: boolean;
  /** Quiet mode (suppress output) */
  quiet?: boolean;
  /** Timeout (milliseconds) */
  timeout?: number;
}

// ============================================================================
// RUN COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Run component
 */
export async function runCommand(
  componentName: string,
  options: RunOptions = {}
): Promise<number> {
  const spinner = createSpinner(`Preparing to run ${componentName}...`);
  spinner.start();

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create manager instance
    const manager = new ComponentManager(config);
    await manager.initialize();

    // Check if component is installed
    spinner.text = `Checking if ${componentName} is installed...`;
    const status = await manager.status(componentName);

    if (status.status !== 'installed' && status.status !== 'running') {
      spinner.fail(`Component ${componentName} is not installed`);
      throw createComponentNotInstalledError(componentName);
    }

    spinner.stop();

    // Show component info
    console.log('');
    console.log(chalk.bold('Running component:'), chalk.cyan(componentName));
    console.log(chalk.bold('Version:'), chalk.yellow(status.version));
    console.log(chalk.bold('Path:'), status.path);
    console.log('');

    // Run component
    info(`Starting ${componentName}...`);

    const childProcess = await manager.run(componentName, options.args || []);

    // Handle output
    if (!options.quiet) {
      childProcess.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });

      childProcess.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });
    }

    // Wait for exit
    const exitCode = await waitForExit(childProcess, options.timeout);

    if (exitCode === 0) {
      success(`${componentName} exited successfully`);
    } else {
      logError(`${componentName} exited with code ${exitCode}`);
    }

    return exitCode;

  } catch (err) {
    if (err instanceof CliError) {
      throw err;
    }

    throw createCommandFailedError(
      `run ${componentName}`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Wait for process to exit with optional timeout
 */
async function waitForExit(
  process: ChildProcess,
  timeout?: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout) {
      timeoutId = setTimeout(() => {
        process.kill();
        reject(new Error(`Process timeout after ${timeout}ms`));
      }, timeout);
    }

    process.on('exit', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(code || 0);
    });

    process.on('error', (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(err);
    });
  });
}

// ============================================================================
// RUN MULTIPLE
// ============================================================================

/**
 * Run multiple components in parallel
 */
export async function runMultiple(
  componentNames: string[],
  options: RunOptions = {}
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  console.log(chalk.bold(`Running ${componentNames.length} component(s) in parallel...`));
  console.log('');

  const promises = componentNames.map(async (name) => {
    try {
      const exitCode = await runCommand(name, { ...options, quiet: true });
      results.set(name, exitCode);
      return { name, exitCode, success: true };
    } catch (error) {
      return { name, exitCode: -1, success: false, error };
    }
  });

  const outcomes = await Promise.all(promises);

  // Show summary
  console.log('');
  console.log(chalk.bold('Run summary:'));
  console.log('');

  for (const outcome of outcomes) {
    if (outcome.success) {
      const icon = outcome.exitCode === 0 ? chalk.green('✔') : chalk.yellow('⚠');
      console.log(`${icon} ${outcome.name}: exit code ${outcome.exitCode}`);
    } else {
      console.log(`${chalk.red('✖')} ${outcome.name}: ${outcome.error}`);
    }
  }

  return results;
}

// ============================================================================
// RUN WITH CONFIG
// ============================================================================

/**
 * Run component with custom configuration
 */
export async function runWithConfig(
  componentName: string,
  configPath: string,
  options: RunOptions = {}
): Promise<number> {
  // Load custom configuration
  const fs = await import('fs-extra');
  const yaml = await import('yaml');

  if (!await fs.pathExists(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configContent = await fs.readFile(configPath, 'utf8');
  const customConfig = yaml.parse(configContent);

  // Merge with environment variables
  const env = {
    ...process.env,
    ...customConfig.env,
    ...options.env,
  };

  return runCommand(componentName, {
    ...options,
    env,
  });
}

// ============================================================================
// RUN INTERACTIVE
// ============================================================================

/**
 * Run component in interactive mode
 */
export async function runInteractive(
  componentName: string,
  options: RunOptions = {}
): Promise<number> {
  const { spawn } = await import('child_process');

  const configManager = new ConfigManager();
  const config = await configManager.load();

  const manager = new ComponentManager(config);
  await manager.initialize();

  const status = await manager.status(componentName);

  if (status.status !== 'installed') {
    throw createComponentNotInstalledError(componentName);
  }

  // Spawn with stdio inherit for interactive mode
  const childProcess = spawn('node', [
    status.path + '/dist/index.js',
    ...(options.args || []),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...options.env,
    },
    cwd: options.cwd,
  });

  return waitForExit(childProcess, options.timeout);
}

// ============================================================================
// RUN AS SERVICE
// ============================================================================

/**
 * Run component as a background service
 */
export async function runAsService(
  componentName: string,
  options: RunOptions = {}
): Promise<{ pid: number; stop: () => Promise<void> }> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const manager = new ComponentManager(config);
  await manager.initialize();

  const status = await manager.status(componentName);

  if (status.status !== 'installed') {
    throw createComponentNotInstalledError(componentName);
  }

  info(`Starting ${componentName} as a service...`);

  const childProcess = await manager.run(componentName, options.args || []);

  // Detach process
  childProcess.unref();

  return {
    pid: childProcess.pid || 0,
    stop: async () => {
      info(`Stopping ${componentName} (PID: ${childProcess.pid})...`);
      childProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
  };
}
