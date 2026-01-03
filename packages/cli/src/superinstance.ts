#!/usr/bin/env node
/**
 * SuperInstance CLI - Main Entry Point
 *
 * Command-line interface for SuperInstance infrastructure.
 * Pull components. Build apps. The system learns and adapts.
 *
 * Usage:
 *   superinstance pull <component>    - Pull component from registry
 *   superinstance list                - List all components
 *   superinstance run <component>      - Run component
 *   superinstance info <component>     - Show component details
 *   superinstance update <component>   - Update component
 *   superinstance remove <component>   - Remove component
 *
 *   superinstance app install <app>    - Install app
 *   superinstance app run <app>        - Run app
 *   superinstance app list             - List apps
 *   superinstance app info <app>       - Show app details
 *
 *   superinstance config get <key>     - Get config value
 *   superinstance config set <key> <val> - Set config value
 *   superinstance config list          - List all config
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getGlobalRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import { ComponentManager } from '@lsi/manager';
import { DependencyResolver } from '@lsi/resolver';

// ============================================================================
// TYPES
// ============================================================================

interface CliOptions {
  debug?: boolean;
  quiet?: boolean;
}

interface ComponentOptions {
  version?: string;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

interface ConfigOptions {
  format?: 'json' | 'pretty';
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

class CliError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CliError';
  }
}

function handleError(error: unknown, debug: boolean = false): void {
  if (error instanceof CliError) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (error.details && debug) {
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }
    if (error.code) {
      console.error(chalk.gray(`Code: ${error.code}`));
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (debug) {
      console.error(chalk.gray(error.stack));
    }
  } else {
    console.error(chalk.red('Unknown error occurred'));
  }
  process.exit(1);
}

// ============================================================================
// COMPONENT COMMANDS
// ============================================================================

/**
 * Pull component from registry
 */
async function pullComponent(
  componentName: string,
  options: ComponentOptions = {}
): Promise<void> {
  try {
    const registry = await getGlobalRegistry();
    const manager = new ComponentManager();

    // Show what we're pulling
    if (!options.quiet) {
      console.log(chalk.cyan(`Pulling ${componentName}...`));
    }

    // Check if component exists
    const info = await registry.info(componentName);

    if (info.installed && !options.force) {
      console.log(chalk.yellow(`${componentName} is already installed (${info.current_version})`));

      if (info.update_available) {
        console.log(chalk.gray(`Update available: ${info.current_version} → ${info.latest_version}`));
        console.log(chalk.gray(`Run 'superinstance update ${componentName}' to update`));
      }
      return;
    }

    // Download and install
    const onProgress = options.debug
      ? (progress: any) => {
          console.log(
            chalk.gray(
              `[${progress.operation}] ${progress.downloaded}/${progress.total} (${progress.percentage}%)`
            )
          );
        }
      : undefined;

    const installed = await registry.install(componentName, {
      version: options.version,
      force: options.force,
      dry_run: options.dryRun,
      on_progress: onProgress,
    });

    if (!options.quiet) {
      console.log(chalk.green(`✔ Installed ${installed.name}@${installed.version}`));
      console.log(chalk.gray(`Location: ${installed.path}`));

      // Show dependencies
      if (installed.manifest.dependencies && installed.manifest.dependencies.length > 0) {
        const deps = installed.manifest.dependencies.map((d: any) => d.name).join(', ');
        console.log(chalk.gray(`Dependencies: ${deps}`));
      }
    }
  } catch (error) {
    throw new CliError(
      `Failed to pull component: ${componentName}`,
      'PULL_FAILED',
      error
    );
  }
}

/**
 * List all components
 */
async function listComponents(options: {
  installed?: boolean;
  type?: string;
  format?: 'json' | 'pretty' | 'plain';
  verbose?: boolean;
}): Promise<void> {
  try {
    const registry = await getGlobalRegistry();
    const components = await registry.list({
      include_installed: true,
      type: options.type,
    });

    if (options.format === 'json') {
      console.log(JSON.stringify(components, null, 2));
      return;
    }

    if (components.length === 0) {
      console.log(chalk.gray('No components found'));
      return;
    }

    // Display as table
    console.log(chalk.cyan.bold('\nAvailable Components\n'));

    for (const component of components) {
      const status = component.installed
        ? chalk.green('✔ installed')
        : chalk.gray('○ not installed');
      const version = component.installed
        ? `${component.current_version}${component.update_available ? chalk.gray(' (update available)') : ''}`
        : component.latest_version;

      console.log(`${chalk.cyan(component.name.padEnd(25))} ${status.padEnd(20)} ${version}`);

      if (options.verbose && component.description) {
        console.log(chalk.gray(`  ${component.description}`));
      }
    }

    console.log('');
    const installedCount = components.filter((c) => c.installed).length;
    console.log(chalk.gray(`${installedCount}/${components.length} components installed`));
  } catch (error) {
    throw new CliError('Failed to list components', 'LIST_FAILED', error);
  }
}

/**
 * Run component
 */
async function runComponent(
  componentName: string,
  args: string[],
  options: {
    interactive?: boolean;
    detach?: boolean;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    debug?: boolean;
  }
): Promise<void> {
  try {
    const manager = new ComponentManager();

    // Check if component is installed
    const installed = await manager.list();
    const component = installed.find((c) => c.name === componentName);

    if (!component) {
      throw new CliError(
        `Component not installed: ${componentName}\nRun 'superinstance pull ${componentName}' first`,
        'NOT_INSTALLED'
      );
    }

    // Run the component
    console.log(chalk.cyan(`Running ${componentName}...`));

    const result = await manager.run(componentName, {
      args,
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout,
    });

    if (!options.detach) {
      console.log(chalk.green(`✔ ${componentName} exited with code ${result.exitCode}`));
    }
  } catch (error) {
    throw new CliError(`Failed to run component: ${componentName}`, 'RUN_FAILED', error);
  }
}

/**
 * Show component details
 */
async function showComponentInfo(
  componentName: string,
  options: {
    version?: string;
    allVersions?: boolean;
    format?: 'json' | 'pretty';
    verbose?: boolean;
  }
): Promise<void> {
  try {
    const registry = await getGlobalRegistry();
    const manifest = await registry.get(componentName, options.version);

    if (options.format === 'json') {
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }

    // Display pretty info
    console.log(chalk.cyan.bold(`\n${manifest.name}\n`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Version:')}     ${manifest.version}`);
    console.log(`${chalk.bold('Description:')} ${manifest.description}`);
    console.log(`${chalk.bold('Type:')}        ${manifest.type}`);
    console.log(`${chalk.bold('Language:')}    ${manifest.language}`);

    if (manifest.author) {
      console.log(`${chalk.bold('Author:')}      ${manifest.author}`);
    }

    if (manifest.keywords && manifest.keywords.length > 0) {
      console.log(`${chalk.bold('Keywords:')}    ${manifest.keywords.join(', ')}`);
    }

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      console.log(`\n${chalk.bold('Dependencies:')}`);
      for (const dep of manifest.dependencies) {
        const required = dep.required ? chalk.green('required') : chalk.gray('optional');
        console.log(`  ${chalk.cyan(dep.name.padEnd(25))} ${dep.version.padEnd(15)} ${required}`);
      }
    }

    if (manifest.compatibility) {
      console.log(`\n${chalk.bold('Compatibility:')}`);
      if (manifest.compatibility.platforms) {
        console.log(`  Platforms: ${manifest.compatibility.platforms.join(', ')}`);
      }
      if (manifest.compatibility.arch) {
        console.log(`  Architectures: ${manifest.compatibility.arch.join(', ')}`);
      }
      if (manifest.compatibility.node) {
        console.log(`  Node.js: ${manifest.compatibility.node}`);
      }
    }

    console.log('');
  } catch (error) {
    throw new CliError(`Failed to get info for: ${componentName}`, 'INFO_FAILED', error);
  }
}

/**
 * Update component
 */
async function updateComponent(
  componentName: string,
  options: ComponentOptions = {}
): Promise<void> {
  try {
    const registry = await getGlobalRegistry();

    console.log(chalk.cyan(`Updating ${componentName}...`));

    const updated = await registry.update(componentName, {
      version: options.version,
      force: options.force,
      dry_run: options.dryRun,
    });

    if (!options.quiet) {
      console.log(chalk.green(`✔ Updated ${updated.name} to ${updated.version}`));
    }
  } catch (error) {
    throw new CliError(`Failed to update component: ${componentName}`, 'UPDATE_FAILED', error);
  }
}

/**
 * Remove component
 */
async function removeComponent(
  componentName: string,
  options: {
    version?: string;
    force?: boolean;
    purge?: boolean;
    dryRun?: boolean;
  }
): Promise<void> {
  try {
    const registry = await getGlobalRegistry();

    if (!options.force && !options.dryRun) {
      // Check for dependents
      const installed = await registry.listInstalled();
      const dependents: string[] = [];

      for (const component of installed) {
        if (component.manifest.dependencies) {
          for (const dep of component.manifest.dependencies) {
            if (dep.name === componentName) {
              dependents.push(component.name);
            }
          }
        }
      }

      if (dependents.length > 0) {
        throw new CliError(
          `Cannot remove ${componentName}: required by ${dependents.join(', ')}`,
          'HAS_DEPENDENTS',
          { dependents }
        );
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow(`Would remove: ${componentName}`));
      return;
    }

    await registry.uninstall(componentName, options.version);

    if (options.purge) {
      console.log(chalk.yellow(`Purged ${componentName} including configuration`));
    } else {
      console.log(chalk.green(`✔ Removed ${componentName}`));
    }
  } catch (error) {
    throw new CliError(`Failed to remove component: ${componentName}`, 'REMOVE_FAILED', error);
  }
}

// ============================================================================
// APP COMMANDS
// ============================================================================

/**
 * Install app
 */
async function installApp(
  appName: string,
  options: {
    force?: boolean;
    dryRun?: boolean;
    debug?: boolean;
  }
): Promise<void> {
  try {
    console.log(chalk.cyan(`Installing app: ${appName}`));

    const registry = await getGlobalRegistry();
    const manager = new ComponentManager();

    // Get app manifest
    const appManifest = await registry.get(`app-${appName}`);

    if (!appManifest) {
      throw new CliError(`App not found: ${appName}`, 'APP_NOT_FOUND');
    }

    // Install all components
    if (appManifest.components) {
      for (const component of appManifest.components) {
        await pullComponent(component, {
          force: options.force,
          dryRun: options.dryRun,
          debug: options.debug,
        });
      }
    }

    console.log(chalk.green(`✔ Installed app: ${appName}`));
  } catch (error) {
    throw new CliError(`Failed to install app: ${appName}`, 'APP_INSTALL_FAILED', error);
  }
}

/**
 * Run app
 */
async function runApp(
  appName: string,
  args: string[],
  options: {
    debug?: boolean;
  }
): Promise<void> {
  try {
    console.log(chalk.cyan(`Running app: ${appName}`));

    const manager = new ComponentManager();
    const result = await manager.run(`app-${appName}`, { args });

    console.log(chalk.green(`✔ App exited with code ${result.exitCode}`));
  } catch (error) {
    throw new CliError(`Failed to run app: ${appName}`, 'APP_RUN_FAILED', error);
  }
}

/**
 * List apps
 */
async function listApps(options: {
  format?: 'json' | 'pretty';
}): Promise<void> {
  try {
    const registry = await getGlobalRegistry();
    const apps = await registry.list({ type: 'app' });

    if (options.format === 'json') {
      console.log(JSON.stringify(apps, null, 2));
      return;
    }

    console.log(chalk.cyan.bold('\nAvailable Apps\n'));

    for (const app of apps) {
      const status = app.installed ? chalk.green('✔') : chalk.gray('○');
      console.log(`${status} ${chalk.cyan(app.name.padEnd(30))} ${app.description}`);
    }

    console.log('');
  } catch (error) {
    throw new CliError('Failed to list apps', 'APP_LIST_FAILED', error);
  }
}

/**
 * Show app info
 */
async function showAppInfo(
  appName: string,
  options: {
    format?: 'json' | 'pretty';
  }
): Promise<void> {
  try {
    const registry = await getGlobalRegistry();
    const manifest = await registry.get(`app-${appName}`);

    if (options.format === 'json') {
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }

    console.log(chalk.cyan.bold(`\n${manifest.name}\n`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Description:')} ${manifest.description}`);
    console.log(`${chalk.bold('Version:')}     ${manifest.version}`);

    if (manifest.components && manifest.components.length > 0) {
      console.log(`\n${chalk.bold('Components:')}`);
      for (const component of manifest.components) {
        console.log(`  ${chalk.cyan('•')} ${component}`);
      }
    }

    console.log('');
  } catch (error) {
    throw new CliError(`Failed to get app info: ${appName}`, 'APP_INFO_FAILED', error);
  }
}

// ============================================================================
// CONFIG COMMANDS
// ============================================================================

/**
 * Get config value
 */
async function getConfig(key: string, options: ConfigOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    await configManager.load();

    const value = configManager.get(key);

    if (options.format === 'json') {
      console.log(JSON.stringify({ key, value }, null, 2));
    } else {
      console.log(`${chalk.cyan(key)} = ${chalk.gray(JSON.stringify(value, null, 2))}`);
    }
  } catch (error) {
    throw new CliError(`Failed to get config: ${key}`, 'CONFIG_GET_FAILED', error);
  }
}

/**
 * Set config value
 */
async function setConfig(key: string, value: string, options: ConfigOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    await configManager.load();

    // Try to parse as JSON, fallback to string
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    configManager.set(key, parsedValue);
    await configManager.save(configManager.getAll());

    console.log(chalk.green(`✔ Set ${key} = ${JSON.stringify(parsedValue)}`));
  } catch (error) {
    throw new CliError(`Failed to set config: ${key}`, 'CONFIG_SET_FAILED', error);
  }
}

/**
 * List all config
 */
async function listConfig(options: ConfigOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    await configManager.load();

    const config = configManager.getAll();

    if (options.format === 'json') {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(chalk.cyan.bold('\nConfiguration\n'));
      console.log(chalk.gray('─'.repeat(50)));

      for (const [key, value] of Object.entries(config)) {
        console.log(`${chalk.cyan(key.padEnd(30))} ${chalk.gray(JSON.stringify(value))}`);
      }

      console.log('');
    }
  } catch (error) {
    throw new CliError('Failed to list config', 'CONFIG_LIST_FAILED', error);
  }
}

// ============================================================================
// CLI PROGRAM
// ============================================================================

function createProgram(): Command {
  const program = new Command();

  program
    .name('superinstance')
    .description('SuperInstance - Pull components. Build apps.')
    .version('1.0.0', '-v, --version', 'Display version number')
    .option('-d, --debug', 'Enable debug mode')
    .option('-q, --quiet', 'Suppress non-error output')
    .hook('preAction', (thisCommand) => {
      process.on('unhandledRejection', (error) => {
        handleError(error, thisCommand.opts().debug);
      });
    });

  // ========================================================================
  // COMPONENT COMMANDS
  // ========================================================================

  program
    .command('pull <component>')
    .description('Pull component from registry')
    .option('-v, --version <version>', 'Specific version to pull')
    .option('-f, --force', 'Force re-download even if exists')
    .option('--dry-run', 'Show what would be downloaded')
    .action(async (component, options) => {
      try {
        await pullComponent(component, { ...options, debug: program.opts().debug });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program
    .command('list')
    .description('List all components')
    .option('--installed', 'Show only installed components')
    .option('-t, --type <type>', 'Filter by component type')
    .option('--json', 'Output in JSON format')
    .option('--plain', 'Output in plain text')
    .option('-v, --verbose', 'Show more details')
    .action(async (options) => {
      try {
        await listComponents({
          ...options,
          format: options.json ? 'json' : options.plain ? 'plain' : 'pretty',
        });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program
    .command('run <component>')
    .description('Run component')
    .argument('[args...]', 'Arguments to pass to component')
    .option('-i, --interactive', 'Run in interactive mode')
    .option('-d, --detach', 'Run in background')
    .option('--cwd <path>', 'Working directory')
    .action(async (component, args, options) => {
      try {
        await runComponent(component, args, {
          ...options,
          debug: program.opts().debug,
        });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program
    .command('info <component>')
    .description('Show component details')
    .option('-v, --version <version>', 'Show info for specific version')
    .option('--all-versions', 'Show all available versions')
    .option('--json', 'Output in JSON format')
    .action(async (component, options) => {
      try {
        await showComponentInfo(component, {
          ...options,
          format: options.json ? 'json' : 'pretty',
        });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program
    .command('update <component>')
    .description('Update component to latest version')
    .option('-v, --version <version>', 'Update to specific version')
    .option('-f, --force', 'Force reinstall')
    .option('--dry-run', 'Show what would be updated')
    .action(async (component, options) => {
      try {
        await updateComponent(component, { ...options, debug: program.opts().debug });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program
    .command('remove <component>')
    .alias('rm')
    .description('Remove installed component')
    .option('-v, --version <version>', 'Remove specific version')
    .option('-f, --force', 'Force removal without confirmation')
    .option('--purge', 'Remove configuration as well')
    .option('--dry-run', 'Show what would be removed')
    .action(async (component, options) => {
      try {
        await removeComponent(component, options);
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  // ========================================================================
  // APP COMMANDS
  // ========================================================================

  const appCommand = new Command('app');
  appCommand.description('Manage apps');

  appCommand
    .command('install <app>')
    .description('Install app with all components')
    .option('-f, --force', 'Force reinstall')
    .option('--dry-run', 'Show what would be installed')
    .action(async (app, options) => {
      try {
        await installApp(app, { ...options, debug: program.opts().debug });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  appCommand
    .command('run <app>')
    .description('Run installed app')
    .argument('[args...]', 'Arguments to pass to app')
    .action(async (app, args, options) => {
      try {
        await runApp(app, args, { debug: program.opts().debug });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  appCommand
    .command('list')
    .description('List available apps')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        await listApps({ format: options.json ? 'json' : 'pretty' });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  appCommand
    .command('info <app>')
    .description('Show app details')
    .option('--json', 'Output in JSON format')
    .action(async (app, options) => {
      try {
        await showAppInfo(app, { format: options.json ? 'json' : 'pretty' });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program.addCommand(appCommand);

  // ========================================================================
  // CONFIG COMMANDS
  // ========================================================================

  const configCommand = new Command('config');
  configCommand.description('Manage configuration');

  configCommand
    .command('get <key>')
    .description('Get configuration value')
    .option('--json', 'Output in JSON format')
    .action(async (key, options) => {
      try {
        await getConfig(key, { format: options.json ? 'json' : 'pretty' });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  configCommand
    .command('set <key> <value>')
    .description('Set configuration value')
    .option('--json', 'Output in JSON format')
    .action(async (key, value, options) => {
      try {
        await setConfig(key, value, { format: options.json ? 'json' : 'pretty' });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  configCommand
    .command('list')
    .description('List all configuration')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        await listConfig({ format: options.json ? 'json' : 'pretty' });
      } catch (error) {
        handleError(error, program.opts().debug);
      }
    });

  program.addCommand(configCommand);

  // ========================================================================
  // HELP TEXT
  // ========================================================================

  program.addHelpText('after', `

Examples:
  $ superinstance pull router
  $ superinstance list --installed
  $ superinstance run router --query "test"
  $ superinstance info router
  $ superinstance update router
  $ superinstance remove router

  $ superinstance app install chat-assistant
  $ superinstance app run chat-assistant
  $ superinstance app list

  $ superinstance config get cache.enabled
  $ superinstance config set cache.enabled true
  $ superinstance config list

More info:
  $ superinstance <command> --help
  $ superinstance --help
`);

  return program;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('superinstance.js') || process.argv[1].endsWith('\\superinstance.js')) {
  main();
}

export { createProgram, main };
