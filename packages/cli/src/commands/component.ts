/**
 * Component Command
 *
 * Unified command interface for component management.
 * This file aggregates all component-related commands:
 * - pull: Download and install components
 * - list: List available/installed components
 * - run: Run components directly
 * - info: Show detailed component information
 * - update: Update components to latest versions
 * - remove: Remove installed components
 *
 * Usage:
 *   superinstance component pull <name>
 *   superinstance component list
 *   superinstance component run <name>
 *   superinstance component info <name>
 *   superinstance component update <name>
 *   superinstance component remove <name>
 */

// Re-export all component command implementations
export * from './pull.js';
export * from './list.js';
export * from './run.js';
export * from './info.js';
export * from './update.js';
export * from './remove.js';

// Import for direct use
import { pullCommand, pullMultiple, pullAll } from './pull.js';
import { listCommand, listInstalledCommand, listUpdatesCommand, listTypesCommand } from './list.js';
import { runCommand, runWithConfig, runInteractive, runAsService } from './run.js';
import { infoCommand, infoVerifyCommand } from './info.js';
import { updateCommand, checkUpdatesCommand, rollbackCommand } from './update.js';
import { removeCommand, cleanCommand, purgeCommand } from './remove.js';

import chalk from 'chalk';

// ============================================================================
// UNIFIED COMPONENT COMMAND HANDLER
// ============================================================================

/**
 * Component command options
 */
export interface ComponentCommandOptions {
  /** Command to execute */
  command: 'pull' | 'list' | 'run' | 'info' | 'update' | 'remove';
  /** Component name */
  name?: string;
  /** Arguments for run command */
  args?: string[];
  /** Additional options passed to sub-commands */
  options?: any;
}

/**
 * Execute component command
 *
 * This is the main entry point for all component-related operations.
 * It routes to the appropriate sub-command based on the action.
 */
export async function componentCommand(action: string, args: string[], options: any = {}): Promise<void> {
  const [name, ...restArgs] = args;

  switch (action) {
    case 'pull':
      await handlePull(name, restArgs, options);
      break;

    case 'list':
      await handleList(options);
      break;

    case 'run':
      await handleRun(name, restArgs, options);
      break;

    case 'info':
      await handleInfo(name, options);
      break;

    case 'update':
      await handleUpdate(name, options);
      break;

    case 'remove':
      await handleRemove(name, options);
      break;

    default:
      showComponentHelp();
      break;
  }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Handle pull command
 */
async function handlePull(name: string | undefined, _args: string[], options: any): Promise<void> {
  if (!name) {
    console.error(chalk.red('Error: Component name is required'));
    console.log('');
    console.log('Usage: superinstance component pull <name> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --version <version>  Pull specific version');
    console.log('  --force              Force re-download even if exists');
    console.log('  --skip-dependencies  Skip dependency resolution');
    console.log('  --dry-run            Show what would be downloaded');
    return;
  }

  // Parse options
  const pullOptions: any = {
    version: options.version,
    force: options.force,
    skipDependencies: options.skipDependencies,
    dryRun: options.dryRun,
    debug: options.debug,
  };

  await pullCommand(name, pullOptions);
}

/**
 * Handle list command
 */
async function handleList(options: any): Promise<void> {
  const listOptions: any = {
    installed: options.installed,
    type: options.type,
    stability: options.stability,
    format: options.format || 'table',
    verbose: options.verbose,
  };

  if (options.updates) {
    await listUpdatesCommand(listOptions);
  } else if (options.types) {
    await listTypesCommand();
  } else if (options.installed) {
    await listInstalledCommand(listOptions);
  } else {
    await listCommand(listOptions);
  }
}

/**
 * Handle run command
 */
async function handleRun(name: string | undefined, args: string[], options: any): Promise<void> {
  if (!name) {
    console.error(chalk.red('Error: Component name is required'));
    console.log('');
    console.log('Usage: superinstance component run <name> [args...] [options]');
    console.log('');
    console.log('Options:');
    console.log('  --interactive        Run in interactive mode');
    console.log('  --service            Run as background service');
    console.log('  --config <path>      Use custom configuration');
    console.log('  --env <key=val>      Set environment variable');
    console.log('  --timeout <ms>       Set execution timeout');
    return;
  }

  const runOptions: any = {
    args,
    env: options.env,
    cwd: options.cwd,
    detach: options.detach,
    debug: options.debug,
    quiet: options.quiet,
    timeout: options.timeout,
  };

  let exitCode: number;

  if (options.interactive) {
    exitCode = await runInteractive(name, runOptions);
  } else if (options.service) {
    const service = await runAsService(name, runOptions);
    console.log('');
    console.log(chalk.green(`Component running as service (PID: ${service.pid})`));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    return; // Don't exit, keep running
  } else if (options.config) {
    exitCode = await runWithConfig(name, options.config, runOptions);
  } else {
    exitCode = await runCommand(name, runOptions);
  }

  process.exit(exitCode);
}

/**
 * Handle info command
 */
async function handleInfo(name: string | undefined, options: any): Promise<void> {
  if (!name) {
    console.error(chalk.red('Error: Component name is required'));
    console.log('');
    console.log('Usage: superinstance component info <name> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --all-versions      Show all available versions');
    console.log('  --verify            Verify component integrity');
    console.log('  --format <format>   Output format (pretty, json)');
    console.log('  --verbose           Show detailed information');
    return;
  }

  const infoOptions: any = {
    installed: options.installed,
    allVersions: options.allVersions || options['all-versions'],
    format: options.format || 'pretty',
    verbose: options.verbose,
  };

  if (options.verify) {
    await infoVerifyCommand(name);
  } else {
    await infoCommand(name, infoOptions);
  }
}

/**
 * Handle update command
 */
async function handleUpdate(name: string | undefined, options: any): Promise<void> {
  const updateOptions: any = {
    version: options.version,
    force: options.force,
    skipDependencies: options.skipDependencies,
    dryRun: options.dryRun || options['dry-run'],
    all: options.all,
    debug: options.debug,
  };

  if (options.check || options['check-only']) {
    await checkUpdatesCommand(name || undefined);
  } else if (options.rollback) {
    const targetVersion = typeof options.rollback === 'string' ? options.rollback : undefined;
    await rollbackCommand(name, targetVersion);
  } else if (options.all) {
    await updateCommand(undefined, updateOptions);
  } else if (name) {
    await updateCommand(name, updateOptions);
  } else {
    console.error(chalk.red('Error: Component name or --all is required'));
    console.log('');
    console.log('Usage: superinstance component update <name> [options]');
    console.log('   or: superinstance component update --all [options]');
    console.log('');
    console.log('Options:');
    console.log('  --all               Update all components');
    console.log('  --version <version> Update to specific version');
    console.log('  --force             Force reinstall');
    console.log('  --check             Check for updates without installing');
    console.log('  --rollback [ver]    Rollback to previous version');
    console.log('  --dry-run           Show what would be updated');
  }
}

/**
 * Handle remove command
 */
async function handleRemove(name: string | undefined, options: any): Promise<void> {
  if (!name) {
    console.error(chalk.red('Error: Component name is required'));
    console.log('');
    console.log('Usage: superinstance component remove <name> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --all               Remove all versions');
    console.log('  --version <version> Remove specific version');
    console.log('  --force             Skip confirmation');
    console.log('  --purge             Also remove config and cache');
    console.log('  --skip-deps         Skip dependency checks');
    return;
  }

  const removeOptions: any = {
    version: options.version,
    force: options.force,
    all: options.all,
    skipDependencies: options.skipDependencies || options['skip-deps'],
    dryRun: options.dryRun || options['dry-run'],
    purge: options.purge,
  };

  await removeCommand(name, removeOptions);
}

// ============================================================================
// HELP AND DOCUMENTATION
// ============================================================================

/**
 * Show component command help
 */
function showComponentHelp(): void {
  console.log('');
  console.log(chalk.bold('SuperInstance Component Management'));
  console.log('');
  console.log('Usage: superinstance component <command> [options]');
  console.log('');
  console.log(chalk.bold('Commands:'));
  console.log('');
  console.log('  ' + chalk.cyan('pull <name>') + '      Download and install a component');
  console.log('  ' + chalk.cyan('list') + '             List available or installed components');
  console.log('  ' + chalk.cyan('run <name>') + '       Run a component');
  console.log('  ' + chalk.cyan('info <name>') + '      Show detailed component information');
  console.log('  ' + chalk.cyan('update <name>') + '    Update a component to the latest version');
  console.log('  ' + chalk.cyan('remove <name>') + '    Remove an installed component');
  console.log('');
  console.log(chalk.bold('Examples:'));
  console.log('');
  console.log('  # Pull a component');
  console.log('  $ superinstance component pull router');
  console.log('');
  console.log('  # List all installed components');
  console.log('  $ superinstance component list --installed');
  console.log('');
  console.log('  # Run a component');
  console.log('  $ superinstance component run cache --port 6379');
  console.log('');
  console.log('  # Show component information');
  console.log('  $ superinstance component info router --verbose');
  console.log('');
  console.log('  # Update a component');
  console.log('  $ superinstance component update router');
  console.log('');
  console.log('  # Update all components');
  console.log('  $ superinstance component update --all');
  console.log('');
  console.log('  # Remove a component');
  console.log('  $ superinstance component remove old-router --force');
  console.log('');
  console.log(chalk.bold('For more help on each command:'));
  console.log('  $ superinstance component <command> --help');
  console.log('');
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Pull multiple components
 */
export async function componentPullMultiple(names: string[], options: any = {}): Promise<void> {
  await pullMultiple(names, options);
}

/**
 * Update all components
 */
export async function componentUpdateAll(options: any = {}): Promise<void> {
  await pullAll(options);
}

/**
 * Clean unused components
 */
export async function componentClean(options: any = {}): Promise<void> {
  await cleanCommand(options);
}

/**
 * Purge all components
 */
export async function componentPurge(options: any = {}): Promise<void> {
  await purgeCommand(options);
}

// ============================================================================
// COMMAND EXPORTS FOR CLI INTEGRATION
// ============================================================================

/**
 * Command definitions for CLI integration
 */
export const componentCommands = {
  pull: {
    description: 'Download and install a component',
    handler: pullCommand,
    examples: [
      'superinstance component pull router',
      'superinstance component pull router --version 1.2.0',
      'superinstance component pull router --force',
    ],
  },
  list: {
    description: 'List components',
    handler: listCommand,
    examples: [
      'superinstance component list',
      'superinstance component list --installed',
      'superinstance component list --type router',
    ],
  },
  run: {
    description: 'Run a component',
    handler: runCommand,
    examples: [
      'superinstance component run cache',
      'superinstance component run router --port 8080',
      'superinstance component run cache --interactive',
    ],
  },
  info: {
    description: 'Show component information',
    handler: infoCommand,
    examples: [
      'superinstance component info router',
      'superinstance component info router --verbose',
      'superinstance component info router --verify',
    ],
  },
  update: {
    description: 'Update a component',
    handler: updateCommand,
    examples: [
      'superinstance component update router',
      'superinstance component update --all',
      'superinstance component update router --check',
    ],
  },
  remove: {
    description: 'Remove a component',
    handler: removeCommand,
    examples: [
      'superinstance component remove old-router',
      'superinstance component remove router --purge',
      'superinstance component remove router --force',
    ],
  },
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  pull: pullCommand,
  list: listCommand,
  run: runCommand,
  info: infoCommand,
  update: updateCommand,
  remove: removeCommand,
  pullMultiple,
  pullAll,
  checkUpdates: checkUpdatesCommand,
  rollback: rollbackCommand,
  clean: cleanCommand,
  purge: purgeCommand,
  runInteractive,
  runAsService,
  runWithConfig,
  infoVerify: infoVerifyCommand,
  componentCommands,
};
