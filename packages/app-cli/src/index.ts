/**
 * @lsi/app-cli - App CLI Commands
 *
 * Command-line interface for managing Aequor apps
 */

import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { AppManager } from "@lsi/app-manager";

// ============================================================================
// APP PULL COMMAND
// ============================================================================

/**
 * Create app pull command
 */
export function createAppPullCommand(): Command {
  const command = new Command("pull");

  command
    .argument("<app>", "App name to pull")
    .description("Pull complete app from registry")
    .option("-v, --version <version>", "Target version")
    .option("--include-advanced", "Include advanced components")
    .option("-f, --force", "Force re-download")
    .option("--dry-run", "Preview without downloading")
    .option("--skip-dependencies", "Skip dependency resolution")
    .action(async (app: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        const state = await manager.pull(app, {
          version: options.version,
          includeAdvanced: options.includeAdvanced,
          force: options.force,
          dryRun: options.dryRun,
          skipDependencies: options.skipDependencies,
          onProgress: (progress) => {
            if (options.verbose) {
              console.log(
                chalk.gray(`[${progress.progress}%]`) +
                  chalk.cyan(` ${progress.message}`)
              );
            }
          },
        });

        console.log("");
        console.log(chalk.green.bold("✓ App pulled successfully"));
        console.log(chalk.gray(`  Name: ${state.name}`));
        console.log(chalk.gray(`  Version: ${state.version}`));
        console.log(chalk.gray(`  Path: ${state.path}`));
        console.log(chalk.gray(`  Components: ${state.components.length}`));
        console.log("");
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP RUN COMMAND
// ============================================================================

/**
 * Create app run command
 */
export function createAppRunCommand(): Command {
  const command = new Command("run");

  command
    .argument("<app>", "App name to run")
    .description("Run complete app")
    .option("-e, --environment <env>", "Environment override")
    .option("-c, --config <path>", "Custom configuration file")
    .option("-d, --detached", "Run in background")
    .option("-p, --port <port>", "Port override", parseInt)
    .option("--log-level <level>", "Log level override")
    .option("--enable-metrics", "Enable metrics")
    .option("--enable-tracing", "Enable tracing")
    .action(async (app: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        await manager.run(app, {
          environment: options.environment,
          config: options.config,
          detached: options.detached,
          port: options.port,
          logLevel: options.logLevel,
          enableMetrics: options.enableMetrics,
          enableTracing: options.enableTracing,
        });
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP STOP COMMAND
// ============================================================================

/**
 * Create app stop command
 */
export function createAppStopCommand(): Command {
  const command = new Command("stop");

  command
    .argument("<app>", "App name to stop")
    .description("Stop running app")
    .action(async (app: string) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        await manager.stop(app);
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP ENHANCE COMMAND
// ============================================================================

/**
 * Create app enhance command
 */
export function createAppEnhanceCommand(): Command {
  const command = new Command("enhance");

  command
    .argument("<app>", "App name to enhance")
    .description("Add advanced components to app")
    .option("-w, --with <components>", "Comma-separated list of components")
    .option("--all", "Add all available advanced components")
    .option("--dry-run", "Preview changes without applying")
    .option("--skip-dependencies", "Skip dependency checks")
    .action(async (app: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        let components: string[] = [];

        if (options.all) {
          // Add all advanced components
          // TODO: Get available advanced components from manifest
          console.log(chalk.yellow("Warning: --all not yet implemented"));
          console.log(chalk.gray("Use --with to specify components"));
          return;
        } else if (options.with) {
          components = options.with.split(",").map((c: string) => c.trim());
        } else {
          console.error(chalk.red("Error: Specify --with or --all"));
          process.exit(1);
        }

        await manager.enhance(app, {
          components,
          dryRun: options.dryRun,
          skipDependencies: options.skipDependencies,
        });
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP LIST COMMAND
// ============================================================================

/**
 * Create app list command
 */
export function createAppListCommand(): Command {
  const command = new Command("list");

  command
    .description("List all apps")
    .option("-v, --verbose", "Show detailed information")
    .option("--registry", "List available apps in registry")
    .action(async (options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        const apps = await manager.list();

        if (apps.length === 0) {
          console.log(chalk.yellow("No apps installed"));
          console.log(chalk.gray('Run "aequor app pull <app>" to install an app'));
          return;
        }

        if (options.verbose) {
          // Detailed table view
          const table = new Table({
            head: [
              chalk.cyan("Name"),
              chalk.cyan("Version"),
              chalk.cyan("Category"),
              chalk.cyan("Components"),
              chalk.cyan("Advanced"),
            ],
            colWidths: [25, 12, 20, 12, 10],
          });

          for (const app of apps) {
            table.push([
              app.name,
              app.current_version || app.latest_version,
              app.category,
              app.component_count.toString(),
              app.advanced_component_count.toString(),
            ]);
          }

          console.log("");
          console.log(table.toString());
          console.log("");
        } else {
          // Simple list view
          console.log("");
          for (const app of apps) {
            const version = app.current_version || app.latest_version;
            console.log(chalk.cyan(app.name) + chalk.gray(` @ ${version}`));
            console.log(chalk.gray(`  ${app.description}`));
            console.log("");
          }
        }

        console.log(chalk.gray(`Total: ${apps.length} app(s)`));
        console.log("");
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP STATUS COMMAND
// ============================================================================

/**
 * Create app status command
 */
export function createAppStatusCommand(): Command {
  const command = new Command("status");

  command
    .argument("<app>", "App name")
    .description("Show app status")
    .option("--components", "Show component details")
    .option("--health", "Show health check results")
    .action(async (app: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        const state = await manager.status(app, options.health);

        console.log("");
        console.log(chalk.cyan.bold(state.name));
        console.log(chalk.gray(`━`.repeat(50)));

        console.log(chalk.gray(`Status: ${formatStatus(state.status)}`));
        console.log(chalk.gray(`Version: ${state.version}`));
        console.log(chalk.gray(`Path: ${state.path}`));
        console.log(chalk.gray(`Updated: ${state.updated_at.toLocaleString()}`));

        if (state.pid) {
          console.log(chalk.gray(`PID: ${state.pid}`));
        }

        if (options.components && state.components.length > 0) {
          console.log("");
          console.log(chalk.cyan("Components:"));

          const table = new Table({
            head: [
              chalk.cyan("Name"),
              chalk.cyan("Version"),
              chalk.cyan("Status"),
              chalk.cyan("Type"),
            ],
            colWidths: [25, 12, 15, 10],
          });

          for (const component of state.components) {
            table.push([
              component.name,
              component.version,
              formatStatus(component.status),
              component.advanced ? "Advanced" : "Core",
            ]);
          }

          console.log(table.toString());
        }

        if (options.health && state.health) {
          console.log("");
          console.log(chalk.cyan("Health:"));

          if (state.health.healthy) {
            console.log(chalk.green("  ✓ All components healthy"));
          } else {
            console.log(chalk.red("  ✗ Some components unhealthy"));
          }

          for (const [component, healthy] of Object.entries(state.health.components)) {
            const status = healthy ? chalk.green("✓") : chalk.red("✗");
            console.log(`    ${status} ${component}`);
          }

          console.log(chalk.gray(`  Last check: ${state.health.last_check.toLocaleString()}`));
        }

        console.log("");
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP REMOVE COMMAND
// ============================================================================

/**
 * Create app remove command
 */
export function createAppRemoveCommand(): Command {
  const command = new Command("remove");

  command
    .argument("<app>", "App name to remove")
    .description("Remove app")
    .option("-k, --keep-data", "Keep app data")
    .option("-f, --force", "Force removal without confirmation")
    .action(async (app: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        if (!options.force) {
          // In production, prompt for confirmation
          console.log(chalk.yellow(`Removing app: ${app}`));
          console.log(chalk.gray('Use --force to skip confirmation'));
        }

        await manager.remove(app, options.keepData);
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// APP SEARCH COMMAND
// ============================================================================

/**
 * Create app search command
 */
export function createAppSearchCommand(): Command {
  const command = new Command("search");

  command
    .argument("<query>", "Search query")
    .description("Search for apps")
    .option("--category <category>", "Filter by category")
    .option("--limit <n>", "Limit results", "20")
    .action(async (query: string, options) => {
      try {
        const manager = new AppManager();
        await manager.initialize();

        const results = await manager.search({
          query,
          category: options.category,
          limit: parseInt(options.limit),
        });

        if (results.length === 0) {
          console.log(chalk.yellow("No results found"));
          return;
        }

        console.log("");
        console.log(chalk.cyan(`Found ${results.length} result(s)`));
        console.log("");

        for (const result of results) {
          console.log(chalk.cyan(result.name) + chalk.gray(` (${result.category})`));
          console.log(chalk.gray(`  ${result.description}`));
          console.log(
            chalk.gray(
              `  Relevance: ${Math.round(result.score * 100)}% | ` +
                `Components: ${result.component_count}`
            )
          );

          if (result.matched_fields.length > 0) {
            console.log(
              chalk.gray(`  Matched: ${result.matched_fields.join(", ")}`)
            );
          }

          console.log("");
        }
      } catch (error) {
        console.error(chalk.red("Error:"), (error as Error).message);
        process.exit(1);
      }
    });

  return command;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  switch (status) {
    case "running":
      return chalk.green("● Running");
    case "stopped":
      return chalk.gray("○ Stopped");
    case "configured":
      return chalk.blue("◐ Configured");
    case "failed":
      return chalk.red("✗ Failed");
    default:
      return chalk.gray(status);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  createAppPullCommand,
  createAppRunCommand,
  createAppStopCommand,
  createAppEnhanceCommand,
  createAppListCommand,
  createAppStatusCommand,
  createAppRemoveCommand,
  createAppSearchCommand,
};
