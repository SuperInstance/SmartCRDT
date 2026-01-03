#!/usr/bin/env node
/**
 * Aequor CLI - Command-line interface for the Aequor Cognitive Orchestration Platform
 *
 * Main entry point for the CLI tool
 */

import { Command } from "commander";
import chalk from "chalk";
import packageJson from "../package.json" with { type: "json" };
import { createQueryCommand } from "./commands/query.js";
import { createChatCommand } from "./commands/chat.js";
import { createStatusCommand } from "./commands/status.js";
import { createConfigCommand } from "./commands/configCmd.js";
import { createModelsCommand } from "./commands/models.js";
import { createCostCommand } from "./commands/cost.js";
import { createCacheCommand } from "./commands/cache.js";
import { createTestCommand } from "./commands/test.js";
import { createPrivacyCommand } from "./commands/privacy.js";
import { createTrainCommand } from "./commands/train.js";
import { createCartridgeCommand } from "./commands/cartridge.js";
import { createSystemCommand } from "./commands/system.js";
import { createPrivacySubCommands } from "./commands/privacySub.js";
import { createTrainingSubCommands } from "./commands/training.js";
import { createExportCommand } from "./commands/export.js";
import { createImportCommand } from "./commands/import.js";
import { createAppPullCommand, createAppRunCommand, createAppStopCommand, createAppEnhanceCommand, createAppListCommand, createAppStatusCommand, createAppRemoveCommand, createAppSearchCommand } from "@lsi/app-cli";

/**
 * Create the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name("aequor")
    .description("Aequor Cognitive Orchestration Platform - CLI")
    .version(packageJson.version, "-v, --version", "Display version number")
    .helpOption("-h, --help", "Display help for command");

  // Add commands
  program.addCommand(createQueryCommand());
  program.addCommand(createChatCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createConfigCommand());
  program.addCommand(createModelsCommand());
  program.addCommand(createCostCommand());
  program.addCommand(createCacheCommand());
  program.addCommand(createTestCommand());
  program.addCommand(createPrivacyCommand());
  program.addCommand(createTrainCommand());
  program.addCommand(createExportCommand());
  program.addCommand(createImportCommand());
  program.addCommand(createCartridgeCommand());
  program.addCommand(createSystemCommand());
  program.addCommand(createPrivacySubCommands());
  program.addCommand(createTrainingSubCommands());

  // Add app commands
  const appCommand = new Command("app");
  appCommand.description("Manage complete apps");
  appCommand.addCommand(createAppPullCommand());
  appCommand.addCommand(createAppRunCommand());
  appCommand.addCommand(createAppStopCommand());
  appCommand.addCommand(createAppEnhanceCommand());
  appCommand.addCommand(createAppListCommand());
  appCommand.addCommand(createAppStatusCommand());
  appCommand.addCommand(createAppRemoveCommand());
  appCommand.addCommand(createAppSearchCommand());
  program.addCommand(appCommand);

  // Add help command
  program
    .command("help")
    .description("Show help for a command")
    .argument("[command]", "Command to show help for")
    .action((command: string) => {
      if (command) {
        // Show specific command help
        const cmd = program.commands.find(c => c.name() === command);
        if (cmd) {
          cmd.help();
        } else {
          console.error(chalk.red(`Unknown command: ${command}`));
          console.log("");
          program.help();
        }
      } else {
        program.help();
      }
    });

  // Add examples command
  program
    .command("examples")
    .description("Show usage examples")
    .action(() => {
      console.log(chalk.cyan.bold("\nAequor CLI Examples\n"));
      console.log(chalk.grey("═".repeat(60)));
      console.log(chalk.cyan.bold("\n=== Query Examples ===\n"));
      console.log(chalk.yellow("# Simple query (uses local model)"));
      console.log(chalk.cyan('  aequor query "What is 2+2?"\n'));
      console.log(chalk.yellow("# Complex query (uses cloud model)"));
      console.log(chalk.cyan('  aequor query "Explain quantum computing"\n'));
      console.log(chalk.yellow("# With routing trace"));
      console.log(
        chalk.cyan('  aequor query "How do I sort an array?" --trace\n')
      );
      console.log(chalk.cyan.bold("\n=== Cache Examples ===\n"));
      console.log(chalk.yellow("# Show cache statistics"));
      console.log(chalk.cyan("  aequor cache stats\n"));
      console.log(chalk.yellow("# Clear cache"));
      console.log(chalk.cyan("  aequor cache clear\n"));
      console.log(chalk.yellow("# Warm cache with common queries"));
      console.log(chalk.cyan("  aequor cache warm\n"));
      console.log(chalk.cyan.bold("\n=== Privacy Examples ===\n"));
      console.log(chalk.yellow("# Analyze query privacy"));
      console.log(
        chalk.cyan('  aequor privacy "My email is test@example.com"\n')
      );
      console.log(chalk.yellow("# Classify and show reasoning"));
      console.log(
        chalk.cyan(
          '  aequor privacy "What is JavaScript?" --classify --detailed\n'
        )
      );
      console.log(chalk.cyan.bold("\n=== Training Examples ===\n"));
      console.log(chalk.yellow("# Export training data"));
      console.log(chalk.cyan("  aequor train -o my-data.jsonl\n"));
      console.log(chalk.yellow("# With quality filter"));
      console.log(chalk.cyan("  aequor train --min-quality 0.8 --balance\n"));
      console.log(chalk.cyan.bold("\n=== Export Examples ===\n"));
      console.log(chalk.yellow("# Export all data"));
      console.log(chalk.cyan("  aequor export -o backup.json\n"));
      console.log(chalk.yellow("# Export only knowledge"));
      console.log(chalk.cyan("  aequor export -o knowledge.json -w knowledge\n"));
      console.log(chalk.yellow("# Export as cartridge"));
      console.log(chalk.cyan("  aequor export -o my-data.cartridge -f cartridge\n"));
      console.log(chalk.yellow("# Compress export"));
      console.log(chalk.cyan("  aequor export -o export.json -c\n"));
      console.log(chalk.cyan.bold("\n=== Import Examples ===\n"));
      console.log(chalk.yellow("# Import all data"));
      console.log(chalk.cyan("  aequor import backup.json\n"));
      console.log(chalk.yellow("# Import only knowledge"));
      console.log(chalk.cyan("  aequor import knowledge.json -t knowledge\n"));
      console.log(chalk.yellow("# Replace existing data"));
      console.log(chalk.cyan("  aequor import backup.json -m replace\n"));
      console.log(chalk.yellow("# Validate file before import"));
      console.log(chalk.cyan("  aequor import backup.json --validate\n"));
      console.log(chalk.yellow("# Preview import without executing"));
      console.log(chalk.cyan("  aequor import backup.json --dry-run\n"));
      console.log(chalk.cyan.bold("\n=== Status Examples ===\n"));
      console.log(chalk.yellow("# Show system status"));
      console.log(chalk.cyan("  aequor status\n"));
      console.log(chalk.yellow("# With component details"));
      console.log(chalk.cyan("  aequor status --components --metrics\n"));
      console.log(chalk.cyan.bold("\n=== Configuration Examples ===\n"));
      console.log(chalk.yellow("# Enable caching"));
      console.log(chalk.cyan("  aequor config cache.enabled true\n"));
      console.log(chalk.yellow("# Set privacy epsilon"));
      console.log(chalk.cyan("  aequor config privacy.epsilon 1.0\n"));
      console.log(chalk.yellow("# Get all configuration"));
      console.log(chalk.cyan("  aequor config --list\n"));
      console.log("");
    });

  // Add quick start guide
  program
    .command("quickstart")
    .description("Show quick start guide")
    .action(() => {
      console.log(chalk.cyan.bold("\nAequor Platform Quick Start\n"));
      console.log(chalk.grey("═".repeat(60)));
      console.log(chalk.cyan("\n1. Configuration (first time only)\n"));
      console.log(chalk.yellow("   aequor config cache.enabled true"));
      console.log(chalk.yellow("   aequor config privacy.epsilon 1.0\n"));
      console.log(chalk.cyan("2. Run your first query\n"));
      console.log(chalk.yellow('   aequor query "What is Aequor?"\n'));
      console.log(chalk.cyan("3. Check cache performance\n"));
      console.log(chalk.yellow("   aequor cache stats\n"));
      console.log(chalk.cyan("4. Analyze query privacy\n"));
      console.log(
        chalk.yellow('   aequor privacy "My email is user@example.com"\n')
      );
      console.log(chalk.cyan("5. Export training data\n"));
      console.log(chalk.yellow("   aequor train\n"));
      console.log(chalk.cyan("\nFor more help:\n"));
      console.log(chalk.yellow("  aequor help [command]"));
      console.log(chalk.yellow("  aequor examples\n"));
      console.log("");
    });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

// Export for testing
export { createProgram, main };

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
