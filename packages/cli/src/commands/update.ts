/**
 * Update Command
 *
 * Update installed components to their latest versions.
 * Supports dry-run, force, and selective updates.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import { createSpinner, success, info, warning } from '../utils/progress.js';
import { CliError } from '../utils/errors.js';
import chalk from 'chalk';

// ============================================================================
// UPDATE OPTIONS
// ============================================================================

/**
 * Update command options
 */
export interface UpdateOptions {
  /** Update to specific version (instead of latest) */
  version?: string;
  /** Force reinstall even if up-to-date */
  force?: boolean;
  /** Skip dependencies */
  skipDependencies?: boolean;
  /** Dry run (don't actually update) */
  dryRun?: boolean;
  /** Update all components */
  all?: boolean;
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// UPDATE COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Update component
 */
export async function updateCommand(
  componentName?: string,
  options: UpdateOptions = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  if (options.all) {
    await updateAll(registry, options);
    return;
  }

  if (!componentName) {
    throw new Error('Either specify a component name or use --all');
  }

  const spinner = createSpinner(`Checking for updates for ${componentName}...`);
  spinner.start();

  try {
    // Check if component is installed
    const installed = await registry.listInstalled();
    const existing = installed.find(i => i.name === componentName);

    if (!existing) {
      spinner.fail(`${componentName} is not installed`);
      console.log('');
      console.log(`To install ${componentName}, run:`);
      console.log(chalk.cyan(`  aequor pull ${componentName}`));
      console.log('');
      return;
    }

    // Get latest version info
    const info = await registry.info(componentName);

    // Check if update is available
    if (!options.force && !info.update_available) {
      spinner.succeed(`${componentName} is already up to date`);
      console.log('');
      console.log(chalk.gray(`  Current version: ${existing.version}`));
      console.log(chalk.gray(`  Latest version: ${info.latest_version}`));
      console.log('');
      return;
    }

    spinner.stop();

    // Show update info
    console.log('');
    console.log(chalk.bold('Updating component:'), chalk.cyan(componentName));
    console.log(chalk.bold('From:'), chalk.yellow(existing.version));
    console.log(chalk.bold('To:'), chalk.green(info.latest_version));
    console.log('');

    if (options.dryRun) {
      info(chalk.gray('Dry run: skipping actual update'));
      console.log('');
      return;
    }

    // Perform update
    const updateSpinner = createSpinner('Updating component...');
    updateSpinner.start();

    const updated = await registry.update(componentName, {
      version: options.version,
      force: options.force,
      skip_dependencies: options.skipDependencies,
    });

    updateSpinner.succeed(`Updated ${componentName} to ${updated.version}`);

    console.log('');
    success(`Successfully updated ${componentName}`);
    console.log('');
    console.log(chalk.bold('New version:'), chalk.green(updated.version));
    console.log(chalk.bold('Updated at:'), new Date(updated.installed_at).toLocaleString());
    console.log('');

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw error;
  }
}

/**
 * Update all components
 */
async function updateAll(
  registry: ComponentRegistry,
  options: UpdateOptions
): Promise<void> {
  const spinner = createSpinner('Checking for updates...');
  spinner.start();

  try {
    // Get all updates
    const updates = await registry.checkUpdates();

    spinner.stop();

    if (updates.length === 0) {
      console.log('');
      success('All components are already up to date!');
      console.log('');
      return;
    }

    // Show available updates
    console.log('');
    console.log(chalk.bold(`Found ${updates.length} update(s):`));
    console.log('');

    for (const update of updates) {
      console.log(`  ${chalk.cyan(update.name)}: ${chalk.yellow(update.current_version)} → ${chalk.green(update.latest_version)}`);
    }

    console.log('');

    if (options.dryRun) {
      info(chalk.gray('Dry run: skipping actual updates'));
      console.log('');
      return;
    }

    // Update each component
    const results = {
      success: [] as string[],
      failed: [] as Array<{ name: string; error: string }>,
      skipped: [] as string[],
    };

    for (const update of updates) {
      const updateSpinner = createSpinner(`Updating ${update.name}...`);

      try {
        await registry.update(update.name, {
          force: options.force,
          skip_dependencies: options.skipDependencies,
        });

        updateSpinner.succeed(`Updated ${update.name} to ${update.latest_version}`);
        results.success.push(update.name);

      } catch (error) {
        updateSpinner.fail(`Failed to update ${update.name}`);
        results.failed.push({
          name: update.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Show summary
    console.log('');
    console.log(chalk.bold('Update summary:'));
    console.log('');

    if (results.success.length > 0) {
      console.log(chalk.green(`✔ Updated: ${results.success.length}`));
      for (const name of results.success) {
        console.log(`  ${chalk.cyan(name)}`);
      }
      console.log('');
    }

    if (results.failed.length > 0) {
      console.log(chalk.red(`✖ Failed: ${results.failed.length}`));
      for (const { name, error } of results.failed) {
        console.log(`  ${chalk.red(name)}: ${error}`);
      }
      console.log('');
    }

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw error;
  }
}

// ============================================================================
// CHECK UPDATES COMMAND
// ============================================================================

/**
 * Check for available updates (without installing)
 */
export async function checkUpdatesCommand(
  componentName?: string
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  const spinner = createSpinner('Checking for updates...');
  spinner.start();

  try {
    let updates;

    if (componentName) {
      // Check specific component
      const info = await registry.info(componentName);
      const installed = await registry.listInstalled();
      const existing = installed.find(i => i.name === componentName);

      if (!existing) {
        spinner.fail(`${componentName} is not installed`);
        return;
      }

      if (info.update_available) {
        updates = [{
          name: componentName,
          current_version: existing.version,
          latest_version: info.latest_version,
          update_available: true,
        }];
      } else {
        updates = [];
      }
    } else {
      // Check all components
      updates = await registry.checkUpdates();
    }

    spinner.stop();

    if (updates.length === 0) {
      console.log('');
      success('All components are up to date!');
      console.log('');
      return;
    }

    // Show updates
    console.log('');
    console.log(chalk.bold(`Available updates (${updates.length}):`));
    console.log('');

    for (const update of updates) {
      console.log(`  ${chalk.cyan(update.name)}: ${chalk.yellow(update.current_version)} → ${chalk.green(update.latest_version)}`);
      console.log(`    ${chalk.gray('Run: ' + chalk.cyan(`aequor update ${update.name}`))}`);
      console.log('');
    }

  } catch (error) {
    spinner.fail('Failed to check for updates');
    throw error;
  }
}

// ============================================================================
// ROLLBACK COMMAND
// ============================================================================

/**
 * Rollback component to previous version
 */
export async function rollbackCommand(
  componentName: string,
  targetVersion?: string
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  const spinner = createSpinner(`Preparing rollback for ${componentName}...`);
  spinner.start();

  try {
    // Get installed version
    const installed = await registry.listInstalled();
    const existing = installed.find(i => i.name === componentName);

    if (!existing) {
      spinner.fail(`${componentName} is not installed`);
      return;
    }

    // Get available versions
    const info = await registry.info(componentName);

    spinner.stop();

    if (targetVersion && !info.versions.includes(targetVersion)) {
      console.log('');
      console.error(chalk.red(`Version ${targetVersion} not available`));
      console.log('');
      console.log('Available versions:');
      for (const version of info.versions) {
        const isCurrent = version === existing.version;
        console.log(`  ${isCurrent ? chalk.green('→') : ' '} ${version}`);
      }
      console.log('');
      return;
    }

    // If no target version, use the previous version
    if (!targetVersion) {
      const currentIndex = info.versions.indexOf(existing.version);
      if (currentIndex <= 0) {
        warning('No previous version available');
        console.log('');
        console.log('Available versions:');
        for (const version of info.versions) {
          const isCurrent = version === existing.version;
          console.log(`  ${isCurrent ? chalk.green('→') : ' '} ${version}`);
        }
        console.log('');
        return;
      }

      targetVersion = info.versions[currentIndex - 1];
    }

    // Show rollback info
    console.log('');
    console.log(chalk.bold('Rolling back component:'), chalk.cyan(componentName));
    console.log(chalk.bold('From:'), chalk.yellow(existing.version));
    console.log(chalk.bold('To:'), chalk.green(targetVersion));
    console.log('');

    // Perform rollback
    const rollbackSpinner = createSpinner('Rolling back...');
    rollbackSpinner.start();

    const rolledBack = await registry.install(componentName, {
      version: targetVersion,
      force: true,
    });

    rollbackSpinner.succeed(`Rolled back ${componentName} to ${rolledBack.version}`);

    console.log('');
    success(`Successfully rolled back ${componentName}`);
    console.log('');
    console.log(chalk.bold('Current version:'), chalk.green(rolledBack.version));
    console.log('');

  } catch (error) {
    spinner.fail('Failed to rollback component');
    throw error;
  }
}
