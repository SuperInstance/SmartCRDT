/**
 * Pull Command
 *
 * Pull components from remote registry.
 * Supports progress bars, version selection, and force reinstall.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ComponentManager } from '@lsi/manager';
import { ConfigManager } from '@lsi/config';
import { createSpinner, success, createDownloadBar, formatBytes } from '../utils/progress.js';
import {
  createComponentNotFoundError,
  createDownloadFailedError,
  handleCliError,
  CliError,
} from '../utils/errors.js';
import chalk from 'chalk';

// ============================================================================
// PULL OPTIONS
// ============================================================================

/**
 * Pull command options
 */
export interface PullOptions {
  /** Specific version to pull */
  version?: string;
  /** Force re-download even if exists */
  force?: boolean;
  /** Skip dependencies */
  skipDependencies?: boolean;
  /** Debug mode */
  debug?: boolean;
  /** Dry run (don't actually install) */
  dryRun?: boolean;
}

// ============================================================================
// PULL COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Pull component from registry
 */
export async function pullCommand(
  componentName: string,
  options: PullOptions = {}
): Promise<void> {
  const spinner = createSpinner(`Preparing to pull ${componentName}...`);
  spinner.start();

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.load();

    // Create registry and manager instances
    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    const manager = new ComponentManager(config);
    await manager.initialize();

    // Check if component exists
    spinner.text = `Checking if ${componentName} exists...`;
    let componentInfo;
    try {
      componentInfo = await registry.info(componentName);
    } catch (error) {
      spinner.fail(`Component ${componentName} not found`);
      throw createComponentNotFoundError(
        componentName,
        (await registry.list()).map(c => c.name)
      );
    }

    // Check if already installed
    if (!options.force) {
      const installed = await registry.listInstalled();
      const existing = installed.find(i => i.name === componentName);

      if (existing && existing.version === componentInfo.latest_version) {
        spinner.succeed(
          `${componentName}@${existing.version} is already installed`
        );
        console.log(chalk.gray(`  Use --force to reinstall`));
        return;
      }

      if (existing) {
        spinner.info(
          `Updating ${componentName} from ${existing.version} to ${componentInfo.latest_version}`
        );
      }
    }

    // Get component manifest
    spinner.text = `Fetching ${componentName} manifest...`;
    const manifest = await registry.get(componentName, options.version);
    const targetVersion = manifest.version;

    // Show component info
    spinner.stop();
    console.log('');
    console.log(chalk.bold('Component:'), chalk.cyan(manifest.name));
    console.log(chalk.bold('Version:'), chalk.yellow(targetVersion));
    console.log(chalk.bold('Type:'), manifest.type);
    console.log(chalk.bold('Size:'), formatBytes(manifest.download?.archive?.size_mb * 1024 * 1024 || 0));
    console.log('');

    // Download component
    const downloadSpinner = createSpinner('Downloading component...');
    downloadSpinner.start();

    const archivePath = await registry.download(componentName, {
      version: options.version,
      force: options.force,
      on_progress: (progress) => {
        const percentage = progress.total > 0
          ? (progress.downloaded / progress.total * 100).toFixed(1)
          : '0.0';

        downloadSpinner.text = `${progress.operation} ${componentName} (${percentage}%) - ${formatBytes(progress.downloaded)}/${formatBytes(progress.total)}`;
      },
    });

    downloadSpinner.succeed(`Downloaded ${componentName}@${targetVersion}`);

    // Install component
    const installSpinner = createSpinner('Installing component...');
    installSpinner.start();

    const installed = await registry.install(componentName, {
      version: options.version,
      force: options.force,
      skip_dependencies: options.skipDependencies,
      dry_run: options.dryRun,
    });

    installSpinner.succeed(`Installed ${componentName}@${installed.version}`);

    // Show success message
    console.log('');
    success(`Successfully installed ${componentName}@${installed.version}`);
    console.log('');
    console.log(chalk.bold('Location:'), installed.path);
    console.log(chalk.bold('Installed at:'), new Date(installed.installed_at).toLocaleString());
    console.log('');

    // Show next steps
    console.log(chalk.bold('Next steps:'));
    console.log(`  ${chalk.cyan('aequor list')}           - List all installed components`);
    console.log(`  ${chalk.cyan('aequor run ' + componentName)}  - Run the component`);
    console.log(`  ${chalk.cyan('aequor info ' + componentName)}  - Show component information`);
    console.log('');

  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    // Handle other errors
    if (error instanceof Error) {
      throw createDownloadFailedError(componentName, error.message);
    }

    throw error;
  }
}

// ============================================================================
// BATCH PULL
// ============================================================================

/**
 * Pull multiple components
 */
export async function pullMultiple(
  componentNames: string[],
  options: PullOptions = {}
): Promise<void> {
  console.log(chalk.bold(`Pulling ${componentNames.length} component(s)...`));
  console.log('');

  const results = {
    success: [] as string[],
    failed: [] as Array<{ name: string; error: string }>,
  };

  for (const name of componentNames) {
    try {
      await pullCommand(name, options);
      results.success.push(name);
    } catch (error) {
      results.failed.push({
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Show summary
  console.log('');
  console.log(chalk.bold('Pull summary:'));
  console.log(`  ${chalk.green('Success:')} ${results.success.length}`);
  console.log(`  ${chalk.red('Failed:')} ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('');
    console.log(chalk.bold('Failed components:'));
    for (const { name, error } of results.failed) {
      console.log(`  ${chalk.red('✖')} ${name}: ${error}`);
    }
  }
}

// ============================================================================
// PULL ALL (UPDATE ALL)
// ============================================================================

/**
 * Pull all available updates for installed components
 */
export async function pullAll(options: PullOptions = {}): Promise<void> {
  const spinner = createSpinner('Checking for updates...');
  spinner.start();

  try {
    const configManager = new ConfigManager();
    const config = await configManager.load();

    const registry = new ComponentRegistry({
      local_path: config.components_path,
    });
    await registry.initialize();

    // Get installed components
    const installed = await registry.listInstalled();

    // Check for updates
    const updates = await registry.checkUpdates();

    spinner.stop();

    if (updates.length === 0) {
      console.log(chalk.green('All components are up to date!'));
      return;
    }

    console.log(chalk.bold(`Found ${updates.length} update(s):`));
    console.log('');

    for (const update of updates) {
      console.log(`  ${chalk.cyan(update.name)}: ${chalk.yellow(update.current_version)} → ${chalk.green(update.latest_version)}`);
    }

    console.log('');

    // Pull updates
    const componentNames = updates.map(u => u.name);
    await pullMultiple(componentNames, options);

  } catch (error) {
    handleCliError(error, options.debug || false);
  }
}
