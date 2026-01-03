/**
 * List Command
 *
 * List all components in the registry or installed locally.
 * Supports filtering by type, stability, and formatting options.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import Table from 'cli-table3';
import chalk from 'chalk';
import { formatBytes } from '../utils/progress.js';

// ============================================================================
// LIST OPTIONS
// ============================================================================

/**
 * List command options
 */
export interface ListOptions {
  /** Show only installed components */
  installed?: boolean;
  /** Filter by component type */
  type?: string;
  /** Filter by stability level */
  stability?: string;
  /** Output format (table, json, plain) */
  format?: 'table' | 'json' | 'plain';
  /** Verbose output (show more details) */
  verbose?: boolean;
}

// ============================================================================
// LIST COMMAND IMPLEMENTATION
// ============================================================================

/**
 * List components
 */
export async function listCommand(options: ListOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  let components;

  if (options.installed) {
    // List installed components
    components = await registry.listInstalled();
  } else {
    // List all components with installation status
    components = await registry.list({
      include_installed: true,
      type: options.type as any,
      stability: options.stability as any,
    });
  }

  // Format output
  switch (options.format) {
    case 'json':
      formatJson(components);
      break;
    case 'plain':
      formatPlain(components, options.verbose);
      break;
    case 'table':
    default:
      formatTable(components, options.verbose, options.installed);
      break;
  }
}

/**
 * Format as table
 */
function formatTable(components: any[], verbose: boolean, installedOnly: boolean): void {
  if (components.length === 0) {
    console.log(chalk.yellow('No components found.'));
    return;
  }

  // Create table
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Version'),
      chalk.cyan('Type'),
      ...[verbose ? chalk.cyan('Size') : []],
      ...[!installedOnly ? chalk.cyan('Status') : []],
    ].filter(Boolean),
    style: {
      head: [],
      border: ['gray'],
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
  });

  // Add rows
  for (const component of components) {
    const row = [
      component.name,
      component.version || component.latest_version || component.current_version || '-',
      component.type || '-',
    ];

    if (verbose) {
      // Calculate size from manifest or path
      const size = component.manifest?.download?.archive?.size_mb
        ? formatBytes(component.manifest.download.archive.size_mb * 1024 * 1024)
        : '-';
      row.push(size);
    }

    if (!installedOnly) {
      // Show installation status
      if (component.installed) {
        if (component.update_available) {
          row.push(chalk.yellow('Update available'));
        } else {
          row.push(chalk.green('Installed'));
        }
      } else {
        row.push(chalk.gray('Not installed'));
      }
    }

    table.push(row);
  }

  console.log(table.toString());

  // Show summary
  console.log('');
  console.log(chalk.gray(`Total: ${components.length} component(s)`));
}

/**
 * Format as JSON
 */
function formatJson(components: any[]): void {
  console.log(JSON.stringify(components, null, 2));
}

/**
 * Format as plain text
 */
function formatPlain(components: any[], verbose?: boolean): void {
  if (components.length === 0) {
    console.log('No components found.');
    return;
  }

  for (const component of components) {
    console.log(chalk.bold(component.name));
    console.log(`  Version: ${component.version || component.latest_version || component.current_version || '-'}`);
    console.log(`  Type: ${component.type || '-'}`);

    if (verbose) {
      if (component.description) {
        console.log(`  Description: ${component.description}`);
      }

      if (component.stability) {
        console.log(`  Stability: ${component.stability}`);
      }

      if (component.keywords && component.keywords.length > 0) {
        console.log(`  Keywords: ${component.keywords.join(', ')}`);
      }

      if (component.manifest?.download?.archive?.size_mb) {
        const size = formatBytes(component.manifest.download.archive.size_mb * 1024 * 1024);
        console.log(`  Size: ${size}`);
      }

      if (component.installed !== undefined) {
        console.log(`  Installed: ${component.installed ? 'Yes' : 'No'}`);
      }

      if (component.update_available) {
        console.log(`  Update available: Yes (${component.latest_version})`);
      }
    }

    console.log('');
  }

  console.log(`Total: ${components.length} component(s)`);
}

// ============================================================================
// INSTALLED COMMAND (ALIAS)
// ============================================================================

/**
 * List only installed components
 */
export async function listInstalledCommand(options: ListOptions = {}): Promise<void> {
  await listCommand({ ...options, installed: true });
}

// ============================================================================
// UPDATES COMMAND
// ============================================================================

/**
 * List available updates
 */
export async function listUpdatesCommand(options: ListOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  const updates = await registry.checkUpdates();

  if (updates.length === 0) {
    console.log(chalk.green('All components are up to date!'));
    return;
  }

  console.log(chalk.bold(`Found ${updates.length} update(s):`));
  console.log('');

  // Create table
  const table = new Table({
    head: [
      chalk.cyan('Component'),
      chalk.cyan('Current'),
      chalk.cyan('Latest'),
      chalk.cyan('Action'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const update of updates) {
    table.push([
      update.name,
      chalk.yellow(update.current_version),
      chalk.green(update.latest_version),
      chalk.cyan(`aequor update ${update.name}`),
    ]);
  }

  console.log(table.toString());

  // Show update all command
  console.log('');
  console.log(chalk.gray('To update all components, run:'));
  console.log(chalk.cyan('  aequor update --all'));
}

// ============================================================================
// TYPES COMMAND
// ============================================================================

/**
 * List component types
 */
export async function listTypesCommand(): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  const components = await registry.list();

  // Group by type
  const byType: Record<string, number> = {};

  for (const component of components) {
    byType[component.type] = (byType[component.type] || 0) + 1;
  }

  // Create table
  const table = new Table({
    head: [
      chalk.cyan('Type'),
      chalk.cyan('Count'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const [type, count] of Object.entries(byType).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    table.push([type, count.toString()]);
  }

  console.log(table.toString());
  console.log('');
  console.log(chalk.gray(`Total types: ${Object.keys(byType).length}`));
}
