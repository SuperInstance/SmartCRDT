#!/usr/bin/env node

/**
 * @lsi/config-cli - CLI for Aequor Configuration Management
 *
 * Provides command-line interface for managing Aequor configuration:
 * - aequor config get <key>
 * - aequor config set <key> <value>
 * - aequor config list [--component <name>] [--app <name>]
 * - aequor config edit [--component <name>] [--app <name>]
 * - aequor config validate [--component <name>] [--app <name>]
 * - aequor config export <output> [--component <name>] [--app <name>]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { table } from 'table';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

// Import ConfigManager types (we'll use dynamic import to avoid build issues)
interface ConfigManager {
  load(): Promise<any>;
  save(config: any): Promise<void>;
  get<T = any>(path: string): T | undefined;
  set<T = any>(path: string, value: T): void;
  merge(config: any): void;
  getAll(): any;
  validate(): any;
  reset(): Promise<void>;
  loadComponentConfig(name: string): Promise<any>;
  saveComponentConfig(name: string, config: any): Promise<void>;
  watch(callback: (config: any) => void): Promise<void>;
  unwatch(): Promise<void>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format configuration value for display
 */
function formatValue(value: any, indent = 0): string {
  const prefix = ' '.repeat(indent);

  if (value === null) {
    return chalk.gray('null');
  }

  if (value === undefined) {
    return chalk.gray('undefined');
  }

  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.red('false');
  }

  if (typeof value === 'number') {
    return chalk.yellow(value.toString());
  }

  if (typeof value === 'string') {
    return chalk.blue(`"${value}"`);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return '[\n' + value.map(v => `${prefix}  ${formatValue(v, indent + 2)}`).join(',\n') + `\n${prefix}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    return '{\n' + keys.map(k => `${prefix}  ${chalk.cyan(k)}: ${formatValue((value as any)[k], indent + 2)}`).join(',\n') + `\n${prefix}}`;
  }

  return String(value);
}

/**
 * Parse value from string
 */
function parseValue(valueStr: string): any {
  // Try parsing as JSON first
  if (valueStr.startsWith('{') || valueStr.startsWith('[') || valueStr.startsWith('"')) {
    try {
      return JSON.parse(valueStr);
    } catch {
      // Fall through to other parsing methods
    }
  }

  // Try parsing as number
  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }

  if (/^-?\d+\.\d+$/.test(valueStr)) {
    return parseFloat(valueStr);
  }

  // Try parsing as boolean
  if (['true', '1', 'yes', 'on'].includes(valueStr.toLowerCase())) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(valueStr.toLowerCase())) {
    return false;
  }

  // Try parsing as array (comma-separated)
  if (valueStr.includes(',')) {
    return valueStr.split(',').map(v => parseValue(v.trim()));
  }

  // Default to string
  return valueStr;
}

/**
 * Get default editor command
 */
function getEditorCommand(): string {
  return process.env.EDITOR ||
         process.env.VISUAL ||
         (process.platform === 'win32' ? 'notepad' : 'vi');
}

/**
 * Get config directory
 */
function getConfigDir(): string {
  return path.join(os.homedir(), '.aequor');
}

/**
 * Get config file path
 */
function getConfigFilePath(component?: string, app?: string): string {
  const configDir = getConfigDir();

  if (component) {
    return path.join(configDir, 'components', component, 'config.yaml');
  }

  if (app) {
    return path.join(configDir, 'apps', app, 'config.yaml');
  }

  return path.join(configDir, 'config.yaml');
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

/**
 * Get configuration value
 */
async function getConfig(key: string, options: any): Promise<void> {
  const spinner = ora('Loading configuration').start();

  try {
    // Dynamic import to avoid build issues
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();

    if (options.component) {
      await manager.loadComponentConfig(options.component);
    }

    if (options.app) {
      await manager.loadComponentConfig(options.app);
    }

    const value = manager.get(key);

    spinner.stop();

    if (value === undefined) {
      console.log(chalk.yellow(`Configuration key '${key}' not found`));
      process.exit(1);
    }

    console.log(formatValue(value));

    if (options.json) {
      console.log('\n' + chalk.gray('JSON:'));
      console.log(JSON.stringify(value, null, 2));
    }
  } catch (error: any) {
    spinner.fail('Failed to load configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Set configuration value
 */
async function setConfig(key: string, valueStr: string, options: any): Promise<void> {
  const spinner = ora('Loading configuration').start();

  try {
    const value = parseValue(valueStr);

    // Dynamic import
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();
    manager.set(key, value);

    spinner.text = 'Saving configuration';

    await manager.save(manager.getAll());

    spinner.succeed(`Configuration updated: ${chalk.cyan(key)} = ${formatValue(value)}`);
  } catch (error: any) {
    spinner.fail('Failed to update configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * List configuration
 */
async function listConfig(options: any): Promise<void> {
  const spinner = ora('Loading configuration').start();

  try {
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();

    let config: any;

    if (options.component) {
      config = await manager.loadComponentConfig(options.component);
      if (!config) {
        spinner.fail(`Component '${options.component}' configuration not found`);
        process.exit(1);
      }
    } else if (options.app) {
      config = await manager.loadComponentConfig(options.app);
      if (!config) {
        spinner.fail(`App '${options.app}' configuration not found`);
        process.exit(1);
      }
    } else {
      config = manager.getAll();
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(chalk.bold(`\n${options.component ? `Component: ${options.component}` : options.app ? `App: ${options.app}` : 'Global Configuration'}\n`));

      const data: any[][] = [[chalk.bold('Key'), chalk.bold('Value')]];

      function flattenObject(obj: any, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;

          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenObject(value, fullKey);
          } else {
            const valueStr = Array.isArray(value)
              ? `[${value.length} items]`
              : typeof value === 'object'
              ? '{...}'
              : String(value);

            data.push([chalk.cyan(fullKey), valueStr]);
          }
        }
      }

      flattenObject(config);

      console.log(table(data, {
        border: table.getBorderCharacters('norc'),
        columnDefault: { width: 50 },
        columns: { 0: { width: 40, wrapWord: true }, 1: { width: 60, wrapWord: true } },
      }));
    }
  } catch (error: any) {
    spinner.fail('Failed to load configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Edit configuration
 */
async function editConfig(options: any): Promise<void> {
  const configPath = getConfigFilePath(options.component, options.app);

  try {
    // Ensure file exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });

    const exists = await fs.access(configPath).then(() => true).catch(() => false);

    if (!exists) {
      // Create default config
      const { ConfigManager } = await import('@lsi/config');
      const manager = new ConfigManager();
      await manager.load();

      if (options.component || options.app) {
        await fs.writeFile(configPath, '# Component/App Configuration\nname: ' + (options.component || options.app) + '\nversion: 1.0.0\n', 'utf-8');
      } else {
        await manager.save(manager.getAll());
      }
    }

    // Open in editor
    const editor = getEditorCommand();
    console.log(chalk.blue(`Opening ${configPath} in ${editor}...`));

    await exec(`${editor} "${configPath}"`, {
      stdio: 'inherit',
      env: { ...process.env, EDITOR: editor }
    });

    // Validate after edit
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    try {
      await manager.load();
      const validation = manager.validate();

      if (!validation.valid) {
        console.log(chalk.yellow('\n⚠️  Configuration validation warnings:'));
        validation.warnings.forEach((w: string) => console.log(chalk.yellow(`  - ${w}`)));

        if (validation.errors.length > 0) {
          console.log(chalk.red('\n❌ Configuration validation errors:'));
          validation.errors.forEach((e: string) => console.log(chalk.red(`  - ${e}`)));
          console.log(chalk.red('\nPlease fix the errors and edit again.'));
          process.exit(1);
        }
      }

      console.log(chalk.green('\n✓ Configuration is valid'));
    } catch (error: any) {
      console.log(chalk.yellow(`\n⚠️  Could not validate configuration: ${error.message}`));
    }
  } catch (error: any) {
    console.error(chalk.red(`Failed to edit configuration: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
async function validateConfig(options: any): Promise<void> {
  const spinner = ora('Validating configuration').start();

  try {
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();

    const validation = manager.validate();

    spinner.stop();

    if (validation.valid) {
      console.log(chalk.green('✓ Configuration is valid'));

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach((w: string) => {
          console.log(chalk.yellow(`  ⚠️  ${w}`));
        });
      }

      console.log(chalk.gray(`\nValidated: ${new Date().toISOString()}`));
    } else {
      console.log(chalk.red('❌ Configuration validation failed'));

      if (validation.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        validation.errors.forEach((e: string) => {
          console.log(chalk.red(`  ✗ ${e}`));
        });
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach((w: string) => {
          console.log(chalk.yellow(`  ⚠️  ${w}`));
        });
      }

      process.exit(1);
    }
  } catch (error: any) {
    spinner.fail('Failed to validate configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Export configuration
 */
async function exportConfig(output: string, options: any): Promise<void> {
  const spinner = ora('Exporting configuration').start();

  try {
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();

    const config = options.component
      ? await manager.loadComponentConfig(options.component)
      : options.app
      ? await manager.loadComponentConfig(options.app)
      : manager.getAll();

    if (!config) {
      spinner.fail('Configuration not found');
      process.exit(1);
    }

    const outputExt = path.extname(output).toLowerCase();
    let content: string;

    if (outputExt === '.json') {
      content = JSON.stringify(config, null, 2);
    } else {
      // Default to YAML
      const YAML = await import('yaml');
      content = YAML.stringify(config, { indent: 2 });
    }

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, content, 'utf-8');

    spinner.succeed(`Configuration exported to ${chalk.cyan(output)}`);
  } catch (error: any) {
    spinner.fail('Failed to export configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Initialize configuration
 */
async function initConfig(): Promise<void> {
  const spinner = ora('Initializing configuration').start();

  try {
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.load();

    spinner.succeed('Configuration initialized');

    console.log(chalk.green('\n✓ Aequor configuration directory created'));
    console.log(chalk.gray(`  Location: ${getConfigDir()}`));
    console.log(chalk.gray('\nEdit configuration with: aequor config edit'));
  } catch (error: any) {
    spinner.fail('Failed to initialize configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(options: any): Promise<void> {
  if (!options.force) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset all configuration to defaults?',
        default: false,
      },
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('Reset cancelled'));
      process.exit(0);
    }
  }

  const spinner = ora('Resetting configuration').start();

  try {
    const { ConfigManager } = await import('@lsi/config');
    const manager = new ConfigManager();

    await manager.reset();

    spinner.succeed('Configuration reset to defaults');
  } catch (error: any) {
    spinner.fail('Failed to reset configuration');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// ============================================================================
// CLI PROGRAM
// ============================================================================

const program = new Command();

program
  .name('aequor config')
  .description('CLI for Aequor configuration management')
  .version('1.0.0');

program
  .command('get <key>')
  .description('Get a configuration value')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .option('-j, --json', 'Output as JSON')
  .action(getConfig);

program
  .command('set <key> <value>')
  .description('Set a configuration value')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .action(setConfig);

program
  .command('list')
  .description('List all configuration values')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .option('-j, --json', 'Output as JSON')
  .action(listConfig);

program
  .command('edit')
  .description('Edit configuration in default editor')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .action(editConfig);

program
  .command('validate')
  .description('Validate configuration')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .action(validateConfig);

program
  .command('export <output>')
  .description('Export configuration to file')
  .option('-c, --component <name>', 'Component name')
  .option('-a, --app <name>', 'App name')
  .action(exportConfig);

program
  .command('init')
  .description('Initialize configuration directory')
  .action(initConfig);

program
  .command('reset')
  .description('Reset configuration to defaults')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(resetConfig);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
