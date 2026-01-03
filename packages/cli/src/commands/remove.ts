/**
 * Remove Command
 *
 * Remove installed components.
 * Supports force removal, dependency checking, and cleanup.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import { createSpinner, success, warning, info } from '../utils/progress.js';
import {
  createComponentNotInstalledError,
  CliError,
} from '../utils/errors.js';
import chalk from 'chalk';
import * as inquirer from 'inquirer';

// ============================================================================
// REMOVE OPTIONS
// ============================================================================

/**
 * Remove command options
 */
export interface RemoveOptions {
  /** Specific version to remove (if multiple installed) */
  version?: string;
  /** Force removal without confirmation */
  force?: boolean;
  /** Remove all versions */
  all?: boolean;
  /** Skip dependency checks */
  skipDependencies?: boolean;
  /** Dry run (don't actually remove) */
  dryRun?: boolean;
  /** Purge component (remove configuration and cache) */
  purge?: boolean;
}

// ============================================================================
// REMOVE COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Remove component
 */
export async function removeCommand(
  componentName: string,
  options: RemoveOptions = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  // Check if component is installed
  const spinner = createSpinner(`Checking ${componentName}...`);
  spinner.start();

  const installed = await registry.listInstalled();
  const existing = installed.filter(i => i.name === componentName);

  if (existing.length === 0) {
    spinner.fail(`${componentName} is not installed`);
    throw createComponentNotInstalledError(componentName);
  }

  spinner.stop();

  // If multiple versions installed and --all not specified
  if (existing.length > 1 && !options.all && !options.version) {
    console.log('');
    console.log(chalk.bold(`Multiple versions of ${componentName} installed:`));
    console.log('');

    for (const comp of existing) {
      console.log(`  ${chalk.cyan(comp.version)} ${chalk.gray(`(${comp.path})`)}`);
    }

    console.log('');
    console.log('To remove all versions, use:');
    console.log(chalk.cyan(`  aequor remove ${componentName} --all`));
    console.log('');
    console.log('To remove a specific version, use:');
    console.log(chalk.cyan(`  aequor remove ${componentName} --version <version>`));
    console.log('');

    return;
  }

  // Determine which versions to remove
  const toRemove = options.version
    ? existing.filter(e => e.version === options.version)
    : existing;

  if (toRemove.length === 0) {
    console.log('');
    console.error(chalk.red(`Version ${options.version} not found`));
    console.log('');
    return;
  }

  // Show dependents
  if (!options.skipDependencies) {
    const dependents = await findDependents(registry, componentName, toRemove);

    if (dependents.length > 0) {
      console.log('');
      warning(`The following component(s) depend on ${componentName}:`);
      console.log('');

      for (const dependent of dependents) {
        console.log(`  ${chalk.cyan(dependent.name)} ${chalk.gray(`(${dependent.version})`)}`);
      }

      console.log('');
      console.log('Removing this component may break dependent components.');
      console.log('');

      if (!options.force) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to proceed anyway?',
            default: false,
          },
        ]);

        if (!answers.proceed) {
          info('Removal cancelled');
          console.log('');
          return;
        }
      }
    }
  }

  // Show removal info
  console.log('');
  console.log(chalk.bold('Removing component(s):'));
  console.log('');

  for (const comp of toRemove) {
    console.log(`  ${chalk.cyan(comp.name)}@${chalk.yellow(comp.version)}`);
    if (options.purge) {
      console.log(`    ${chalk.gray('Purge: enabled (will remove config and cache)')}`);
    }
  }

  console.log('');

  // Confirm removal
  if (!options.force && !options.dryRun) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${toRemove.length} component(s)?`,
        default: false,
      },
    ]);

    if (!answers.confirm) {
      info('Removal cancelled');
      console.log('');
      return;
    }
  }

  if (options.dryRun) {
    info(chalk.gray('Dry run: skipping actual removal'));
    console.log('');
    return;
  }

  // Perform removal
  const removeSpinner = createSpinner('Removing component(s)...');
  removeSpinner.start();

  try {
    for (const comp of toRemove) {
      await registry.uninstall(comp.name, comp.version);

      // Purge if requested
      if (options.purge) {
        await purgeComponent(registry, comp);
      }
    }

    removeSpinner.succeed(`Removed ${toRemove.length} component(s)`);

    console.log('');
    success(`Successfully removed ${componentName}`);
    console.log('');

  } catch (error) {
    removeSpinner.fail('Failed to remove component(s)');
    if (error instanceof CliError) {
      throw error;
    }
    throw error;
  }
}

/**
 * Remove all versions of a component
 */
export async function removeAllCommand(
  componentName: string,
  options: RemoveOptions = {}
): Promise<void> {
  await removeCommand(componentName, { ...options, all: true });
}

/**
 * Find components that depend on the given component
 */
async function findDependents(
  registry: ComponentRegistry,
  componentName: string,
  versions: any[]
): Promise<Array<{ name: string; version: string }>> {
  const installed = await registry.listInstalled();
  const dependents: Array<{ name: string; version: string }> = [];

  for (const component of installed) {
    if (component.manifest.dependencies) {
      for (const dep of component.manifest.dependencies) {
        if (dep.name === componentName) {
          dependents.push({
            name: component.name,
            version: component.version,
          });
        }
      }
    }
  }

  return dependents;
}

/**
 * Purge component configuration and cache
 */
async function purgeComponent(
  registry: ComponentRegistry,
  component: any
): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  // Remove config directory
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.aequor', 'config', component.name);
  if (await fs.pathExists(configDir)) {
    await fs.remove(configDir);
  }

  // Remove cache directory
  const cacheDir = path.join(process.env.HOME || process.env.USERPROFILE || '~', '.aequor', 'cache', component.name);
  if (await fs.pathExists(cacheDir)) {
    await fs.remove(cacheDir);
  }
}

// ============================================================================
// CLEAN COMMAND
// ============================================================================

/**
 * Clean unused components and cache
 */
export async function cleanCommand(options: {
  /** Remove components older than this many days */
  olderThan?: number;
  /** Keep these components (never remove) */
  keep?: string[];
  /** Maximum cache size in MB */
  maxCacheSize?: number;
  /** Dry run (don't actually delete) */
  dryRun?: boolean;
  /** Remove all unused components */
  all?: boolean;
} = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });

  const spinner = createSpinner('Scanning for unused components...');
  spinner.start();

  const installed = await registry.listInstalled();

  spinner.stop();

  // Determine which components to remove
  const toRemove: any[] = [];

  for (const component of installed) {
    // Skip if in keep list
    if (options.keep && options.keep.includes(component.name)) {
      continue;
    }

    // Check age
    if (options.olderThan || options.all) {
      const installedAt = new Date(component.installed_at);
      const daysSinceInstall = (Date.now() - installedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (options.all || daysSinceInstall > (options.olderThan || 30)) {
        toRemove.push(component);
      }
    }
  }

  if (toRemove.length === 0) {
    console.log('');
    success('No unused components found');
    console.log('');
    return;
  }

  // Show components to remove
  console.log('');
  console.log(chalk.bold(`Found ${toRemove.length} unused component(s):`));
  console.log('');

  for (const component of toRemove) {
    const installedAt = new Date(component.installed_at);
    const daysSinceInstall = Math.floor((Date.now() - installedAt.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`  ${chalk.cyan(component.name)}@${chalk.yellow(component.version)} ${chalk.gray(`(${daysSinceInstall} days old)`)}`);
  }

  console.log('');

  if (options.dryRun) {
    info(chalk.gray('Dry run: skipping actual removal'));
    console.log('');
    console.log(chalk.gray(`Would free up: ${calculateSize(toRemove)}`));
    console.log('');
    return;
  }

  // Confirm removal
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove ${toRemove.length} unused component(s)?`,
      default: false,
    },
  ]);

  if (!answers.confirm) {
    info('Cleanup cancelled');
    console.log('');
    return;
  }

  // Perform removal
  const removeSpinner = createSpinner('Removing unused components...');
  removeSpinner.start();

  for (const component of toRemove) {
    await registry.uninstall(component.name, component.version);
  }

  removeSpinner.succeed(`Removed ${toRemove.length} unused component(s)`);

  console.log('');
  success(`Cleanup complete. Freed up: ${calculateSize(toRemove)}`);
  console.log('');
}

/**
 * Calculate total size of components
 */
function calculateSize(components: any[]): string {
  // This is a simplified calculation
  // In reality, you'd calculate based on actual file sizes
  const avgSizeMB = 50; // Assume 50MB per component
  const totalMB = components.length * avgSizeMB;

  if (totalMB < 1024) {
    return `${totalMB} MB`;
  } else {
    return `${(totalMB / 1024).toFixed(2)} GB`;
  }
}

// ============================================================================
// PURGE COMMAND
// ============================================================================

/**
 * Purge all components, configuration, and cache
 */
export async function purgeCommand(options: {
  /** Force purge without confirmation */
  force?: boolean;
  /** Dry run (don't actually delete) */
  dryRun?: boolean;
} = {}): Promise<void> {
  console.log('');
  warning('This will remove ALL components, configuration, and cache!');
  console.log('');
  console.log(chalk.red('This action cannot be undone!'));
  console.log('');

  if (!options.force) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to purge everything?',
        default: false,
      },
    ]);

    if (!answers.confirm) {
      info('Purge cancelled');
      console.log('');
      return;
    }
  }

  if (options.dryRun) {
    info(chalk.gray('Dry run: skipping actual purge'));
    console.log('');
    return;
  }

  const spinner = createSpinner('Purging everything...');
  spinner.start();

  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    const os = await import('os');

    const aequorDir = path.join(os.homedir(), '.aequor');

    await fs.remove(aequorDir);

    spinner.succeed('Purged all components, configuration, and cache');

    console.log('');
    success('Aequor has been completely removed from your system');
    console.log('');
    console.log('To reinstall, run:');
    console.log(chalk.cyan('  aequor pull <component>'));
    console.log('');

  } catch (error) {
    spinner.fail('Failed to purge');
    throw error;
  }
}
