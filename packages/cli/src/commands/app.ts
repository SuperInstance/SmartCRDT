/**
 * App Commands
 *
 * Commands for managing Aequor apps:
 * - app install: Pull and configure an app with all components
 * - app run: Start an app with all its components
 * - app list: List available and installed apps
 * - app info: Show detailed app information
 */

import { AppManager } from '@lsi/app-manager';
import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import { createSpinner, success } from '../utils/progress.js';
import {
  createCommandFailedError,
  CliError,
} from '../utils/errors.js';
import chalk from 'chalk';
import Table from 'cli-table3';

// ============================================================================
// APP INSTALL OPTIONS
// ============================================================================

/**
 * App install command options
 */
export interface AppInstallOptions {
  /** Target version */
  version?: string;
  /** Include advanced components */
  includeAdvanced?: boolean;
  /** Force re-download */
  force?: boolean;
  /** Dry run (don't actually install) */
  dryRun?: boolean;
  /** Skip dependencies */
  skipDependencies?: boolean;
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// APP RUN OPTIONS
// ============================================================================

/**
 * App run command options
 */
export interface AppRunOptions {
  /** Environment override */
  environment?: string;
  /** Custom configuration file */
  config?: string;
  /** Detach from terminal */
  detached?: boolean;
  /** Port override */
  port?: number;
  /** Log level override */
  logLevel?: string;
  /** Enable metrics override */
  enableMetrics?: boolean;
  /** Enable tracing override */
  enableTracing?: boolean;
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// APP LIST OPTIONS
// ============================================================================

/**
 * App list command options
 */
export interface AppListOptions {
  /** Show only installed apps */
  installed?: boolean;
  /** Filter by category */
  category?: string;
  /** Output format (table, json, plain) */
  format?: 'table' | 'json' | 'plain';
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// APP INFO OPTIONS
// ============================================================================

/**
 * App info command options
 */
export interface AppInfoOptions {
  /** Output format (pretty, json) */
  format?: 'pretty' | 'json';
  /** Include health check */
  includeHealth?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// APP INSTALL COMMAND
// ============================================================================

/**
 * Install app (pull command alias)
 *
 * Fetches app manifest from registry, resolves component dependencies,
 * pulls all required components, and sets up app configuration.
 */
export async function appInstallCommand(
  appName: string,
  options: AppInstallOptions = {}
): Promise<void> {
  const spinner = createSpinner(`Preparing to install ${appName}...`);
  spinner.start();

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create registry instance
    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    // Create app manager instance
    const appManager = new AppManager(registry);
    await appManager.initialize();

    // Check if app exists
    spinner.text = `Checking if ${appName} exists...`;

    // For now, we'll attempt to pull and let the AppManager handle errors
    // In production, we'd check an app registry first

    spinner.text = `Installing ${appName}...`;

    // Pull app (this resolves dependencies, downloads components, and configures)
    const appState = await appManager.pull(appName, {
      version: options.version,
      includeAdvanced: options.includeAdvanced,
      force: options.force,
      dryRun: options.dryRun,
      skipDependencies: options.skipDependencies,
      onProgress: (progress: any) => {
        spinner.text = progress.message;
      },
    });

    spinner.stop();

    // Show success message
    console.log('');
    success(`Successfully installed app: ${appName}@${appState.version}`);
    console.log('');
    console.log(chalk.bold('App Information:'));
    console.log(`  Name: ${chalk.cyan(appState.name)}`);
    console.log(`  Version: ${chalk.yellow(appState.version)}`);
    console.log(`  Components: ${appState.components.length}`);
    console.log(`  Path: ${appState.path}`);
    console.log('');

    // List components
    if (appState.components.length > 0) {
      console.log(chalk.bold('Components:'));
      for (const component of appState.components) {
        const status = component.status === 'running' || component.status === 'resolved'
          ? chalk.green('✔')
          : chalk.yellow('○');
        const advanced = component.advanced ? chalk.gray(' (advanced)') : '';
        console.log(`  ${status} ${component.name}@${component.version}${advanced}`);
      }
      console.log('');
    }

    // Show next steps
    console.log(chalk.bold('Next steps:'));
    console.log(`  ${chalk.cyan('superinstance app run ' + appName)}  - Start the app`);
    console.log(`  ${chalk.cyan('superinstance app list')}          - List all apps`);
    console.log(`  ${chalk.cyan('superinstance app info ' + appName)}  - Show app details`);
    console.log('');

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    // Handle app manager errors
    if (error instanceof Error && error.message.includes('not found')) {
      spinner.fail(`App ${appName} not found`);
      throw createAppNotFoundError(appName, []);
    }

    // Handle other errors
    if (error instanceof Error) {
      throw createCommandFailedError(`app install ${appName}`, error.message);
    }

    throw error;
  }
}

// ============================================================================
// APP RUN COMMAND
// ============================================================================

/**
 * Run app
 *
 * Starts an installed app with all its components.
 * Handles component startup order and manages app lifecycle.
 */
export async function appRunCommand(
  appName: string,
  options: AppRunOptions = {}
): Promise<void> {
  const spinner = createSpinner(`Preparing to run ${appName}...`);
  spinner.start();

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create registry instance
    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    // Create app manager instance
    const appManager = new AppManager(registry);
    await appManager.initialize();

    // Check if app is installed
    spinner.text = `Checking ${appName} installation...`;

    const appState = await (appManager as any).getAppState(appName);

    if (!appState) {
      spinner.fail(`App not installed: ${appName}`);
      throw createAppNotInstalledError(appName);
    }

    spinner.text = `Starting ${appName}...`;

    // Run app
    await appManager.run(appName, {
      environment: options.environment,
      config: options.config,
      detached: options.detached,
      port: options.port,
      logLevel: options.logLevel,
      enableMetrics: options.enableMetrics,
      enableTracing: options.enableTracing,
    });

    // Success message is printed by AppManager
    spinner.stop();

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    // Handle app not installed
    if (error instanceof Error && error.message.includes('not found')) {
      spinner.fail(`App not installed: ${appName}`);
      throw createAppNotInstalledError(appName);
    }

    // Handle other errors
    if (error instanceof Error) {
      throw createCommandFailedError(`app run ${appName}`, error.message);
    }

    throw error;
  }
}

// ============================================================================
// APP LIST COMMAND
// ============================================================================

/**
 * List apps
 *
 * Lists available apps from the registry and shows installation status.
 */
export async function appListCommand(options: AppListOptions = {}): Promise<void> {
  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create registry instance
    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    // Create app manager instance
    const appManager = new AppManager(registry);
    await appManager.initialize();

    // Get installed apps
    const apps = await appManager.list();

    // Filter by category if specified
    let filteredApps = apps;
    if (options.category) {
      filteredApps = apps.filter(app => app.category === options.category);
    }

    // Format output
    switch (options.format) {
      case 'json':
        formatJson(filteredApps);
        break;
      case 'plain':
        formatPlain(filteredApps, options.verbose);
        break;
      case 'table':
      default:
        formatTable(filteredApps, options.verbose);
        break;
    }

  } catch (error) {
    if (error instanceof Error) {
      throw createCommandFailedError('app list', error.message);
    }
    throw error;
  }
}

/**
 * Format apps as table
 */
function formatTable(apps: any[], verbose: boolean): void {
  if (apps.length === 0) {
    console.log(chalk.yellow('No apps found.'));
    return;
  }

  // Create table
  const tableHead = [
    chalk.cyan('Name'),
    chalk.cyan('Version'),
    chalk.cyan('Category'),
    chalk.cyan('Components'),
  ];
  if (verbose) {
    tableHead.push(chalk.cyan('Advanced'));
  }
  tableHead.push(chalk.cyan('Status'));

  const table = new Table({
    head: tableHead,
    style: {
      head: [],
      border: ['gray'],
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
  });

  // Add rows
  for (const app of apps) {
    const row = [
      app.name,
      app.current_version || app.latest_version,
      app.category,
      app.component_count.toString(),
    ];

    if (verbose) {
      row.push(app.advanced_component_count.toString());
    }

    // Show status
    if (app.installed) {
      row.push(chalk.green('Installed'));
    } else {
      row.push(chalk.gray('Not installed'));
    }

    table.push(row);
  }

  console.log(table.toString());

  // Show summary
  console.log('');
  console.log(chalk.gray(`Total: ${apps.length} app(s)`));
}

/**
 * Format apps as JSON
 */
function formatJson(apps: any[]): void {
  console.log(JSON.stringify(apps, null, 2));
}

/**
 * Format apps as plain text
 */
function formatPlain(apps: any[], verbose?: boolean): void {
  if (apps.length === 0) {
    console.log('No apps found.');
    return;
  }

  for (const app of apps) {
    console.log(chalk.bold(app.name));
    console.log(`  Version: ${app.current_version || app.latest_version}`);
    console.log(`  Category: ${app.category}`);
    console.log(`  Components: ${app.component_count}`);

    if (verbose) {
      if (app.description) {
        console.log(`  Description: ${app.description}`);
      }

      if (app.keywords && app.keywords.length > 0) {
        console.log(`  Keywords: ${app.keywords.join(', ')}`);
      }

      if (app.advanced_component_count > 0) {
        console.log(`  Advanced Components: ${app.advanced_component_count}`);
      }

      if (app.installed) {
        console.log(`  Status: Installed`);
      } else {
        console.log(`  Status: Not installed`);
      }
    }

    console.log('');
  }

  console.log(`Total: ${apps.length} app(s)`);
}

// ============================================================================
// APP INFO COMMAND
// ============================================================================

/**
 * Show app information
 *
 * Displays detailed information about an app including manifest,
 * component list, dependencies, and installation status.
 */
export async function appInfoCommand(
  appName: string,
  options: AppInfoOptions = {}
): Promise<void> {
  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create registry instance
    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    // Create app manager instance
    const appManager = new AppManager(registry);
    await appManager.initialize();

    // Get app state
    const appState = await (appManager as any).getAppState(appName);

    if (!appState) {
      throw createAppNotInstalledError(appName);
    }

    // Load manifest
    const manifest = await (appManager as any).loadAppManifestFromPath(appState.path);

    // Get status with health check if requested
    const status = await appManager.status(appName, options.includeHealth);

    // Format output
    switch (options.format) {
      case 'json':
        formatInfoJson(manifest, status, appState);
        break;
      case 'pretty':
      default:
        formatInfoPretty(manifest, status, appState, options);
        break;
    }

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('not found')) {
      throw createAppNotInstalledError(appName);
    }

    if (error instanceof Error) {
      throw createCommandFailedError(`app info ${appName}`, error.message);
    }

    throw error;
  }
}

/**
 * Format app info as pretty output
 */
function formatInfoPretty(
  manifest: any,
  status: any,
  appState: any,
  options: AppInfoOptions
): void {
  console.log('');

  // Header
  console.log(chalk.bold.white(manifest.metadata.name));
  if (manifest.metadata.description) {
    console.log(chalk.gray(manifest.metadata.description));
  }
  console.log('');

  // Basic info table
  const basicInfo = [
    [chalk.bold('Version:'), manifest.metadata.version],
    [chalk.bold('Category:'), manifest.category],
    [chalk.bold('Author:'), manifest.metadata.author || '-'],
    [chalk.bold('License:'), manifest.metadata.license || '-'],
    [chalk.bold('Status:'), formatStatus(status.status)],
  ];

  if (manifest.metadata.repository) {
    basicInfo.push([chalk.bold('Repository:'), manifest.metadata.repository]);
  }

  if (manifest.metadata.homepage) {
    basicInfo.push([chalk.bold('Homepage:'), manifest.metadata.homepage]);
  }

  // Print basic info
  for (const [key, value] of basicInfo) {
    console.log(`${key} ${value}`);
  }

  console.log('');

  // Components
  if (manifest.components && manifest.components.length > 0) {
    console.log(chalk.bold('Components:'));
    for (const component of manifest.components) {
      const required = component.required ? '' : chalk.gray(' (optional)');
      console.log(`  ${chalk.cyan(component.name)}${chalk.gray('@')}${chalk.yellow(component.version)}${required}`);

      if (component.configuration && Object.keys(component.configuration).length > 0 && options.verbose) {
        console.log(chalk.gray(`    Configuration:`));
        for (const [key, value] of Object.entries(component.configuration)) {
          console.log(chalk.gray(`      ${key}: ${JSON.stringify(value)}`));
        }
      }
    }
    console.log('');
  }

  // Advanced components
  if (manifest.advanced_components && manifest.advanced_components.length > 0) {
    console.log(chalk.bold('Advanced Components:'));
    for (const component of manifest.advanced_components) {
      console.log(`  ${chalk.cyan(component.name)}${chalk.gray('@')}${chalk.yellow(component.version)}`);
    }
    console.log('');
  }

  // Configuration
  if (manifest.configuration && options.verbose) {
    console.log(chalk.bold('Configuration:'));
    if (manifest.configuration.environment) {
      console.log(`  Environment: ${manifest.configuration.environment}`);
    }
    if (manifest.configuration.log_level) {
      console.log(`  Log Level: ${manifest.configuration.log_level}`);
    }
    if (manifest.configuration.enable_metrics !== undefined) {
      console.log(`  Metrics: ${manifest.configuration.enable_metrics ? 'enabled' : 'disabled'}`);
    }
    if (manifest.configuration.enable_tracing !== undefined) {
      console.log(`  Tracing: ${manifest.configuration.enable_tracing ? 'enabled' : 'disabled'}`);
    }
    console.log('');
  }

  // Networking
  if (manifest.networking) {
    console.log(chalk.bold('Networking:'));
    if (manifest.networking.host) {
      console.log(`  Host: ${manifest.networking.host}`);
    }
    if (manifest.networking.port) {
      console.log(`  Port: ${manifest.networking.port}`);
    }
    if (manifest.networking.tls_enabled) {
      console.log(`  TLS: ${chalk.green('enabled')}`);
    }
    console.log('');
  }

  // Storage
  if (manifest.storage && options.verbose) {
    console.log(chalk.bold('Storage:'));
    if (manifest.storage.data_path) {
      console.log(`  Data Path: ${manifest.storage.data_path}`);
    }
    if (manifest.storage.cache_path) {
      console.log(`  Cache Path: ${manifest.storage.cache_path}`);
    }
    if (manifest.storage.persistence_enabled !== undefined) {
      console.log(`  Persistence: ${manifest.storage.persistence_enabled ? 'enabled' : 'disabled'}`);
    }
    if (manifest.storage.backup_enabled !== undefined) {
      console.log(`  Backup: ${manifest.storage.backup_enabled ? 'enabled' : 'disabled'}`);
    }
    console.log('');
  }

  // Health check
  if (status.health && options.includeHealth) {
    console.log(chalk.bold('Health Status:'));
    console.log(`  Overall: ${status.health.healthy ? chalk.green('healthy') : chalk.red('unhealthy')}`);

    if (status.health.components && Object.keys(status.health.components).length > 0) {
      console.log('');
      console.log('  Components:');
      for (const [name, healthy] of Object.entries(status.health.components)) {
        const statusIcon = healthy ? chalk.green('✔') : chalk.red('✖');
        console.log(`    ${statusIcon} ${name}`);
      }
    }

    if (status.health.last_check) {
      console.log('');
      console.log(`  Last Check: ${new Date(status.health.last_check).toLocaleString()}`);
    }
    console.log('');
  }

  // Installation info
  if (options.verbose && appState) {
    console.log(chalk.bold('Installation:'));
    console.log(`  Path: ${appState.path}`);
    console.log(`  Status: ${formatStatus(appState.status)}`);
    if (appState.pid) {
      console.log(`  PID: ${appState.pid}`);
    }
    console.log('');
  }

  // Keywords
  if (manifest.metadata.keywords && manifest.metadata.keywords.length > 0) {
    console.log(chalk.bold('Keywords:'));
    console.log(`  ${manifest.metadata.keywords.map((k: string) => chalk.cyan(k)).join(', ')}`);
    console.log('');
  }
}

/**
 * Format app info as JSON
 */
function formatInfoJson(manifest: any, status: any, appState: any): void {
  const output = {
    manifest,
    status,
    state: appState,
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Format status with color
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'running':
      return chalk.green(status);
    case 'configured':
    case 'resolved':
      return chalk.blue(status);
    case 'stopped':
      return chalk.gray(status);
    case 'failed':
      return chalk.red(status);
    default:
      return status;
  }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an "app not found" error
 */
function createAppNotFoundError(
  appName: string,
  available: string[]
): CliError {
  const suggestions: any[] = [
    {
      text: 'Check the app name for typos',
      command: 'superinstance app list',
    },
  ];

  // Add "did you mean?" suggestions
  if (available && available.length > 0) {
    const similar = findSimilar(appName, available);
    if (similar.length > 0) {
      suggestions.push({
        text: 'Did you mean one of these?',
        command: `superinstance app install ${similar[0]}`,
      });
    }
  }

  return new CliError({
    code: 'APP_NOT_FOUND' as any,
    message: `App '${appName}' not found`,
    severity: 'error',
    suggestions,
    exitCode: 1,
    showStackTrace: false,
  });
}

/**
 * Create an "app not installed" error
 */
function createAppNotInstalledError(appName: string): CliError {
  return new CliError({
    code: 'APP_NOT_INSTALLED' as any,
    message: `App '${appName}' is not installed`,
    severity: 'error',
    suggestions: [
      {
        text: 'Install the app first',
        command: `superinstance app install ${appName}`,
      },
    ],
    exitCode: 1,
    showStackTrace: false,
  });
}

/**
 * Find similar app names (for "did you mean?" suggestions)
 */
function findSimilar(target: string, available: string[]): string[] {
  const threshold = 3; // Maximum edit distance

  const similar = available.filter(name => {
    const distance = levenshteinDistance(target, name);
    return distance <= threshold;
  });

  // Sort by edit distance
  similar.sort((a, b) =>
    levenshteinDistance(target, a) - levenshteinDistance(target, b)
  );

  return similar.slice(0, 3); // Return top 3 matches
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
