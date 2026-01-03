#!/usr/bin/env node

/**
 * Aequor CLI - Main Entry Point
 *
 * Command-line interface for the Aequor Cognitive Orchestration Platform.
 * Provides commands for managing AI infrastructure components.
 *
 * Usage:
 *   aequor pull <component>    - Pull component from registry
 *   aequor list                - List all components
 *   aequor run <component>      - Run component
 *   aequor info <component>     - Show component information
 *   aequor update <component>   - Update component
 *   aequor remove <component>   - Remove component
 *   aequor search <query>       - Search for components
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '@lsi/config';
import {
  pullCommand,
  pullAll,
  pullMultiple,
} from './commands/pull.js';
import {
  listCommand,
  listInstalledCommand,
  listUpdatesCommand,
  listTypesCommand,
} from './commands/list.js';
import {
  runCommand,
  runMultiple,
  runInteractive,
  runAsService,
} from './commands/run.js';
import {
  infoCommand,
  infoVerifyCommand,
} from './commands/info.js';
import {
  updateCommand,
  checkUpdatesCommand,
  rollbackCommand,
} from './commands/update.js';
import {
  removeCommand,
  removeAllCommand,
  cleanCommand,
  purgeCommand,
} from './commands/remove.js';
import {
  searchCommand,
  searchByTypeCommand,
  fuzzySearchCommand,
  discoverCommand,
} from './commands/search.js';
import { handleCliError } from './utils/errors.js';

// ============================================================================
// CLI SETUP
// ============================================================================

const program = new Command();

program
  .name('aequor')
  .description('AI Infrastructure CLI - Manage modular AI components')
  .version('1.0.0')
  .option('-d, --debug', 'Enable debug mode (verbose logging)')
  .option('-q, --quiet', 'Suppress non-error output')
  .hook('preAction', (thisCommand) => {
    // Global error handling
    process.on('unhandledRejection', (error) => {
      handleCliError(error, thisCommand.opts().debug);
    });
  });

// ============================================================================
// PULL COMMAND
// ============================================================================

program
  .command('pull <component>')
  .description('Pull component from registry')
  .option('-v, --version <version>', 'Specific version to pull')
  .option('-f, --force', 'Force re-download even if exists')
  .option('--skip-dependencies', 'Skip installing dependencies')
  .option('--dry-run', 'Show what would be downloaded without downloading')
  .action(async (component, options) => {
    try {
      await pullCommand(component, {
        version: options.version,
        force: options.force,
        skipDependencies: options.skipDependencies,
        debug: program.opts().debug,
        dryRun: options.dryRun,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('pull-all')
  .description('Pull all available updates for installed components')
  .option('-f, --force', 'Force re-download even if up-to-date')
  .option('--skip-dependencies', 'Skip installing dependencies')
  .action(async (options) => {
    try {
      await pullAll({
        force: options.force,
        skipDependencies: options.skipDependencies,
        debug: program.opts().debug,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

program
  .command('list')
  .description('List all components')
  .option('--installed', 'Show only installed components')
  .option('-t, --type <type>', 'Filter by component type')
  .option('-s, --stability <stability>', 'Filter by stability level')
  .option('--json', 'Output in JSON format')
  .option('--plain', 'Output in plain text format')
  .option('-v, --verbose', 'Show more details')
  .action(async (options) => {
    try {
      await listCommand({
        installed: options.installed,
        type: options.type,
        stability: options.stability,
        format: options.json ? 'json' : options.plain ? 'plain' : 'table',
        verbose: options.verbose,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('installed')
  .description('List installed components (alias for "list --installed")')
  .option('-v, --verbose', 'Show more details')
  .action(async (options) => {
    try {
      await listInstalledCommand({
        verbose: options.verbose,
        format: 'table',
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('updates')
  .description('List available updates for installed components')
  .action(async () => {
    try {
      await listUpdatesCommand();
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('types')
  .description('List component types')
  .action(async () => {
    try {
      await listTypesCommand();
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// RUN COMMAND
// ============================================================================

program
  .command('run <component>')
  .description('Run component')
  .argument('[args...]', 'Arguments to pass to component')
  .option('-i, --interactive', 'Run in interactive mode')
  .option('-d, --detach', 'Run in background (as a service)')
  .option('--cwd <path>', 'Working directory')
  .option('--env <key=value>', 'Environment variables (can be used multiple times)', [])
  .option('--timeout <ms>', 'Timeout in milliseconds')
  .action(async (component, args, options) => {
    try {
      // Parse environment variables
      const env: Record<string, string> = {};
      if (options.env) {
        for (const e of options.env) {
          const [key, ...valueParts] = e.split('=');
          env[key] = valueParts.join('=');
        }
      }

      if (options.interactive) {
        await runInteractive(component, {
          args,
          env,
          cwd: options.cwd,
          timeout: options.timeout ? parseInt(options.timeout) : undefined,
        });
      } else if (options.detach) {
        const service = await runAsService(component, {
          args,
          env,
          cwd: options.cwd,
        });

        console.log(`Service started with PID: ${service.pid}`);
        console.log('To stop the service, press Ctrl+C or run: aequor stop');

        process.on('SIGINT', async () => {
          console.log('\\nStopping service...');
          await service.stop();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      } else {
        await runCommand(component, {
          args,
          env,
          cwd: options.cwd,
          timeout: options.timeout ? parseInt(options.timeout) : undefined,
          debug: program.opts().debug,
        });
      }
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// INFO COMMAND
// ============================================================================

program
  .command('info <component>')
  .description('Show component information')
  .option('-v, --version <version>', 'Show info for specific version')
  .option('--all-versions', 'Show all available versions')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Show more details')
  .action(async (component, options) => {
    try {
      await infoCommand(component, {
        version: options.version,
        allVersions: options.allVersions,
        format: options.json ? 'json' : 'pretty',
        verbose: options.verbose,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('verify <component>')
  .description('Verify component integrity')
  .action(async (component) => {
    try {
      await infoVerifyCommand(component);
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// UPDATE COMMAND
// ============================================================================

program
  .command('update [component]')
  .description('Update component(s) to latest version')
  .option('-v, --version <version>', 'Update to specific version')
  .option('-f, --force', 'Force reinstall even if up-to-date')
  .option('--skip-dependencies', 'Skip updating dependencies')
  .option('--all', 'Update all installed components')
  .option('--dry-run', 'Show what would be updated without updating')
  .action(async (component, options) => {
    try {
      await updateCommand(component, {
        version: options.version,
        force: options.force,
        skipDependencies: options.skipDependencies,
        all: options.all,
        dryRun: options.dryRun,
        debug: program.opts().debug,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('check-updates [component]')
  .description('Check for available updates (without installing)')
  .action(async (component) => {
    try {
      await checkUpdatesCommand(component);
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('rollback <component> [version]')
  .description('Rollback component to previous version')
  .action(async (component, version) => {
    try {
      await rollbackCommand(component, version);
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// REMOVE COMMAND
// ============================================================================

program
  .command('remove <component>')
  .alias('rm')
  .description('Remove installed component')
  .option('-v, --version <version>', 'Remove specific version')
  .option('-f, --force', 'Force removal without confirmation')
  .option('--all', 'Remove all versions')
  .option('--skip-dependencies', 'Skip dependency checks')
  .option('--dry-run', 'Show what would be removed without removing')
  .option('--purge', 'Remove configuration and cache as well')
  .action(async (component, options) => {
    try {
      await removeCommand(component, {
        version: options.version,
        force: options.force,
        all: options.all,
        skipDependencies: options.skipDependencies,
        dryRun: options.dryRun,
        purge: options.purge,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('clean')
  .description('Clean unused components and cache')
  .option('--older-than <days>', 'Remove components older than N days', parseInt)
  .option('--keep <components>', 'Comma-separated list of components to keep')
  .option('--all', 'Remove all unused components')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(async (options) => {
    try {
      const keep = options.keep ? options.keep.split(',').map((s: string) => s.trim()) : undefined;

      await cleanCommand({
        olderThan: options.olderThan,
        keep,
        all: options.all,
        dryRun: options.dryRun,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('purge')
  .description('Remove ALL components, configuration, and cache')
  .option('-f, --force', 'Purge without confirmation')
  .option('--dry-run', 'Show what would be purged without purging')
  .action(async (options) => {
    try {
      await purgeCommand({
        force: options.force,
        dryRun: options.dryRun,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// SEARCH COMMAND
// ============================================================================

program
  .command('search <query>')
  .description('Search for components')
  .option('-t, --type <type>', 'Filter by component type')
  .option('-s, --stability <stability>', 'Filter by stability level')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <n>', 'Maximum number of results', parseInt)
  .option('-o, --offset <n>', 'Offset for pagination', parseInt)
  .option('--json', 'Output in JSON format')
  .option('--plain', 'Output in plain text format')
  .option('-v, --verbose', 'Show more details')
  .action(async (query, options) => {
    try {
      await searchCommand(query, {
        type: options.type,
        stability: options.stability,
        category: options.category,
        limit: options.limit,
        offset: options.offset,
        format: options.json ? 'json' : options.plain ? 'plain' : 'table',
        verbose: options.verbose,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('fuzzy <query>')
  .description('Fuzzy search with typo tolerance')
  .action(async (query) => {
    try {
      await fuzzySearchCommand(query);
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

program
  .command('discover')
  .description('Discover popular and trending components')
  .option('-t, --type <type>', 'Show by type')
  .option('-s, --stability <stability>', 'Show by stability')
  .option('-l, --limit <n>', 'Limit results', parseInt)
  .action(async (options) => {
    try {
      await discoverCommand({
        type: options.type,
        stability: options.stability,
        limit: options.limit,
      });
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// CONFIG COMMAND
// ============================================================================

program
  .command('config')
  .description('Show or edit configuration')
  .option('--get <key>', 'Get configuration value')
  .option('--set <key=value>', 'Set configuration value')
  .option('--list', 'List all configuration values')
  .option('--reset', 'Reset to default configuration')
  .option('--validate', 'Validate configuration')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();

      if (options.get) {
        const value = configManager.get(options.get);
        console.log(JSON.stringify(value, null, 2));
      } else if (options.set) {
        const [key, ...valueParts] = options.set.split('=');
        const value = valueParts.join('=');

        // Try to parse as JSON, fallback to string
        try {
          configManager.set(key, JSON.parse(value));
        } catch {
          configManager.set(key, value);
        }

        await configManager.save(configManager.getAll());
        console.log(`Set ${key} = ${value}`);
      } else if (options.list) {
        console.log(JSON.stringify(configManager.getAll(), null, 2));
      } else if (options.reset) {
        await configManager.reset();
        console.log('Configuration reset to defaults');
      } else if (options.validate) {
        const validation = configManager.validate();

        if (validation.valid) {
          console.log(chalk.green('✔ Configuration is valid'));
        } else {
          console.log(chalk.red('✖ Configuration is invalid'));
          console.log('');

          for (const error of validation.errors) {
            console.log(`  ${chalk.red('•')} ${error}`);
          }

          for (const warning of validation.warnings) {
            console.log(`  ${chalk.yellow('⚠')} ${warning}`);
          }
        }
      } else {
        // Show current configuration
        console.log(JSON.stringify(configManager.getAll(), null, 2));
      }
    } catch (error) {
      handleCliError(error, program.opts().debug);
    }
  });

// ============================================================================
// HELP AND INFO
// ============================================================================

// Show examples in help
program.addHelpText('after', `

Examples:
  $ aequor pull cascade-router
  $ aequor list --installed
  $ aequor run cascade-router --query "test"
  $ aequor info cascade-router
  $ aequor search routing
  $ aequor update cascade-router
  $ aequor remove cascade-router

More info:
  $ aequor <command> --help
  $ aequor --help
`);

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleCliError(error, program.opts().debug);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { program };
