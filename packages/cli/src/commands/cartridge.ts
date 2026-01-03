/**
 * Cartridge command - Manage knowledge cartridges
 */

import { Command } from "commander";
import chalk from "chalk";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import { CliTable3 } from "../utils/index.js";
import { createTable, formatNumber, formatBytes } from "../utils/formatting.js";
import { configManager } from "../config/manager.js";

/**
 * Cartridge metadata
 */
export interface CartridgeMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags: string[];
  size: number;
  entryCount: number;
  installedAt: string;
  enabled: boolean;
}

/**
 * Create cartridge command
 */
export function createCartridgeCommand(): Command {
  const cmd = new Command("cartridge");

  cmd
    .description("Manage knowledge cartridges")
    .argument("[action]", "Action to perform", "list");

  // List subcommand
  const listCmd = new Command("list");
  listCmd
    .description("List installed cartridges")
    .option("-a, --all", "Show all including disabled")
    .option("-d, --detailed", "Show detailed information")
    .option("-f, --format <format>", "Output format", "text")
    .action(async (_options: CartridgeListOptions) => {
      await executeCartridgeList(_options);
    });

  // Install subcommand
  const installCmd = new Command("install");
  installCmd
    .description("Install a cartridge from file or URL")
    .argument("<source>", "Cartridge file path or URL")
    .option("-f, --force", "Overwrite if already installed")
    .option("-e, --enable", "Enable after installation")
    .action(async (source: string, _options: CartridgeInstallOptions) => {
      await executeCartridgeInstall(source, _options);
    });

  // Load subcommand
  const loadCmd = new Command("load");
  loadCmd
    .description("Load (enable) a cartridge")
    .argument("<name>", "Cartridge name")
    .action(async (name: string) => {
      await executeCartridgeLoad(name);
    });

  // Unload subcommand
  const unloadCmd = new Command("unload");
  unloadCmd
    .description("Unload (disable) a cartridge")
    .argument("<name>", "Cartridge name")
    .action(async (name: string) => {
      await executeCartridgeUnload(name);
    });

  // Create subcommand
  const createCmd = new Command("create");
  createCmd
    .description("Create a new cartridge")
    .argument("<name>", "Cartridge name")
    .option("-d, --description <text>", "Cartridge description", "")
    .option("-t, --tag <tag>", "Tags (can be used multiple times)", [])
    .option("-o, --output <path>", "Output directory", "./cartridges")
    .action(async (name: string, _options: CartridgeCreateOptions) => {
      await executeCartridgeCreate(name, _options);
    });

  // Add subcommands
  cmd.addCommand(listCmd);
  cmd.addCommand(installCmd);
  cmd.addCommand(loadCmd);
  cmd.addCommand(unloadCmd);
  cmd.addCommand(createCmd);

  return cmd;
}

/**
 * Cartridge list _options
 */
export interface CartridgeListOptions {
  all?: boolean;
  detailed?: boolean;
  format?: "text" | "json";
}

/**
 * Cartridge install _options
 */
export interface CartridgeInstallOptions {
  force?: boolean;
  enable?: boolean;
}

/**
 * Cartridge create _options
 */
export interface CartridgeCreateOptions {
  description?: string;
  tag?: string[];
  output?: string;
}

/**
 * Execute cartridge list
 */
async function executeCartridgeList(
  _options: CartridgeListOptions
): Promise<void> {
  try {
    const _config = (await configManager.getAll()) as any;
    const cartridgeDir = _config.cartridge?.directory || "./cartridges";

    // Get installed cartridges
    const cartridges = await getInstalledCartridges(cartridgeDir);

    // Filter out disabled if --all not specified
    const filtered = _options.all
      ? cartridges
      : cartridges.filter(c => c.enabled);

    if (_options.format === "json") {
      console.log(
        JSON.stringify(
          {
            cartridges: filtered,
            count: filtered.length,
            totalSize: cartridges.reduce((sum, c) => sum + c.size, 0),
          },
          null,
          2
        )
      );
    } else {
      logger.blank();

      if (filtered.length === 0) {
        logger.warn("No cartridges found");
        logger.info("Install cartridges using:");
        console.log(`  ${chalk.cyan("aequor cartridge install <path>")}`);
        logger.blank();
        return;
      }

      console.log(chalk.cyan("Installed Cartridges:"));
      logger.blank();

      const summaryTable: CliTable3.Table = createTable([
        { header: "Name", width: 25 },
        { header: "Version", width: 12 },
        { header: "Entries", width: 10 },
        { header: "Size", width: 12 },
        { header: "Status", width: 10 },
      ]);

      for (const cartridge of filtered) {
        summaryTable.push([
          cartridge.name,
          cartridge.version,
          formatNumber(cartridge.entryCount),
          formatBytes(cartridge.size),
          cartridge.enabled ? chalk.green("Enabled") : chalk.red("Disabled"),
        ]);
      }

      console.log(summaryTable.toString());
      logger.blank();

      const totalSize = cartridges.reduce((sum, c) => sum + c.size, 0);
      const totalEntries = cartridges.reduce((sum, c) => sum + c.entryCount, 0);
      console.log(`${chalk.cyan("Total:")}`);
      console.log(
        `  ${chalk.grey("•")} Cartridges: ${formatNumber(cartridges.length)}`
      );
      console.log(
        `  ${chalk.grey("•")} Entries: ${formatNumber(totalEntries)}`
      );
      console.log(`  ${chalk.grey("•")} Size: ${formatBytes(totalSize)}`);
      logger.blank();

      // Detailed view
      if (_options.detailed && filtered.length > 0) {
        console.log(chalk.cyan("Cartridge Details:"));
        logger.blank();

        for (const cartridge of filtered) {
          console.log(chalk.bold(cartridge.name));
          console.log(`  ${chalk.grey("•")} Version: ${cartridge.version}`);
          console.log(
            `  ${chalk.grey("•")} Description: ${cartridge.description || "No description"}`
          );
          if (cartridge.author) {
            console.log(`  ${chalk.grey("•")} Author: ${cartridge.author}`);
          }
          if (cartridge.tags.length > 0) {
            console.log(
              `  ${chalk.grey("•")} Tags: ${cartridge.tags.join(", ")}`
            );
          }
          console.log(
            `  ${chalk.grey("•")} Entries: ${formatNumber(cartridge.entryCount)}`
          );
          console.log(
            `  ${chalk.grey("•")} Size: ${formatBytes(cartridge.size)}`
          );
          console.log(
            `  ${chalk.grey("•")} Installed: ${cartridge.installedAt}`
          );
          console.log(
            `  ${chalk.grey("•")} Status: ${cartridge.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
          );
          logger.blank();
        }
      }

      console.log(chalk.cyan("Cartridge Management:"));
      console.log(
        `  ${chalk.grey("•")} Install cartridge: ${chalk.cyan("aequor cartridge install <path>")}`
      );
      console.log(
        `  ${chalk.grey("•")} Load cartridge: ${chalk.cyan("aequor cartridge load <name>")}`
      );
      console.log(
        `  ${chalk.grey("•")} Unload cartridge: ${chalk.cyan("aequor cartridge unload <name>")}`
      );
      console.log(
        `  ${chalk.grey("•")} Create cartridge: ${chalk.cyan("aequor cartridge create <name>")}`
      );
      logger.blank();
    }
  } catch (error) {
    logger.error(`Cartridge list failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute cartridge install
 */
async function executeCartridgeInstall(
  source: string,
  _options: CartridgeInstallOptions
): Promise<void> {
  try {
    const _config = (await configManager.getAll()) as any;
    const cartridgeDir = _config.cartridge?.directory || "./cartridges";

    logger.info(`Installing cartridge from ${chalk.cyan(source)}...`);

    // Check if source is a URL or file path
    let cartridgeData: string;
    let cartridgePath: string;

    if (source.startsWith("http://") || source.startsWith("https://")) {
      // Download from URL
      logger.info("Downloading cartridge...");
      cartridgePath = join(
        cartridgeDir,
        source.split("/").pop() || "cartridge.json"
      );
      // TODO: Implement download logic
      logger.warn("URL download not yet implemented");
      logger.info("Please download manually and use file path");
      process.exit(1);
    } else {
      // Load from file
      cartridgePath = join(cartridgeDir, source);
      cartridgeData = await fs.readFile(cartridgePath, "utf8");
    }

    // Parse cartridge metadata
    const metadata: CartridgeMetadata = JSON.parse(cartridgeData);

    // Check if already installed
    const existing = await getInstalledCartridges(cartridgeDir);
    const alreadyInstalled = existing.find(c => c.name === metadata.name);

    if (alreadyInstalled && !_options.force) {
      logger.warn(
        `Cartridge ${chalk.cyan(metadata.name)} is already installed`
      );
      logger.info("Use --force to reinstall");
      process.exit(1);
    }

    // Install cartridge
    const targetPath = join(cartridgeDir, `${metadata.name}.json`);

    // Copy cartridge file
    await fs.copyFile(cartridgePath, targetPath);

    // Update metadata with install timestamp
    metadata.installedAt = new Date().toISOString();
    metadata.enabled = _options.enable ?? true;

    await fs.writeFile(targetPath, JSON.stringify(metadata, null, 2), "utf8");

    logger.success(
      `Installed cartridge ${chalk.cyan(metadata.name)} v${metadata.version}`
    );
    logger.blank();
    console.log(`${chalk.cyan("Cartridge Details:")}`);
    console.log(`  ${chalk.grey("•")} Name: ${metadata.name}`);
    console.log(`  ${chalk.grey("•")} Version: ${metadata.version}`);
    console.log(
      `  ${chalk.grey("•")} Description: ${metadata.description || "No description"}`
    );
    console.log(
      `  ${chalk.grey("•")} Entries: ${formatNumber(metadata.entryCount)}`
    );
    console.log(`  ${chalk.grey("•")} Size: ${formatBytes(metadata.size)}`);
    console.log(
      `  ${chalk.grey("•")} Status: ${metadata.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`
    );
    logger.blank();

    if (!metadata.enabled) {
      logger.info(`Enable the cartridge using:`);
      console.log(`  ${chalk.cyan(`aequor cartridge load ${metadata.name}`)}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.error(`Cartridge file not found: ${source}`);
      process.exit(1);
    }
    logger.error(`Cartridge install failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute cartridge load
 */
async function executeCartridgeLoad(name: string): Promise<void> {
  try {
    const _config = (await configManager.getAll()) as any;
    const cartridgeDir = _config.cartridge?.directory || "./cartridges";
    const cartridgePath = join(cartridgeDir, `${name}.json`);

    // Check if cartridge exists
    const data = await fs.readFile(cartridgePath, "utf8");
    const metadata: CartridgeMetadata = JSON.parse(data);

    // Enable cartridge
    metadata.enabled = true;

    await fs.writeFile(
      cartridgePath,
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    logger.success(`Loaded cartridge ${chalk.cyan(name)}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.error(`Cartridge not found: ${name}`);
      logger.info("List available cartridges using:");
      console.log(`  ${chalk.cyan("aequor cartridge list")}`);
      process.exit(1);
    }
    logger.error(`Cartridge load failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute cartridge unload
 */
async function executeCartridgeUnload(name: string): Promise<void> {
  try {
    const _config = (await configManager.getAll()) as any;
    const cartridgeDir = _config.cartridge?.directory || "./cartridges";
    const cartridgePath = join(cartridgeDir, `${name}.json`);

    // Check if cartridge exists
    const data = await fs.readFile(cartridgePath, "utf8");
    const metadata: CartridgeMetadata = JSON.parse(data);

    // Disable cartridge
    metadata.enabled = false;

    await fs.writeFile(
      cartridgePath,
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    logger.success(`Unloaded cartridge ${chalk.cyan(name)}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.error(`Cartridge not found: ${name}`);
      logger.info("List available cartridges using:");
      console.log(`  ${chalk.cyan("aequor cartridge list")}`);
      process.exit(1);
    }
    logger.error(`Cartridge unload failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute cartridge create
 */
async function executeCartridgeCreate(
  name: string,
  _options: CartridgeCreateOptions
): Promise<void> {
  try {
    const outputDir = _options.output || "./cartridges";

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const cartridgePath = join(outputDir, `${name}.json`);

    // Check if already exists
    try {
      await fs.access(cartridgePath);
      logger.warn(`Cartridge ${chalk.cyan(name)} already exists`);
      logger.info("Use a different name or delete the existing cartridge");
      process.exit(1);
    } catch {
      // File doesn't exist, continue
    }

    // Create cartridge metadata
    const metadata: CartridgeMetadata = {
      name,
      version: "0.1.0",
      description: _options.description || "",
      tags: _options.tag || [],
      size: 0,
      entryCount: 0,
      installedAt: new Date().toISOString(),
      enabled: true,
    };

    // Write cartridge file
    await fs.writeFile(
      cartridgePath,
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    logger.success(`Created cartridge ${chalk.cyan(name)}`);
    logger.blank();
    console.log(`${chalk.cyan("Next Steps:")}`);
    console.log(`  ${chalk.grey("1.")} Add knowledge entries to the cartridge`);
    console.log(
      `  ${chalk.grey("2.")} Update the cartridge file with your data`
    );
    console.log(`  ${chalk.grey("3.")} Test the cartridge locally`);
    console.log(`  ${chalk.grey("4.")} Share the cartridge file with others`);
    logger.blank();
    console.log(`${chalk.cyan("Cartridge Location:")}`);
    console.log(`  ${cartridgePath}`);
    logger.blank();

    // Create template for adding entries
    const templatePath = join(outputDir, `${name}.template.jsonl`);
    const template = [
      {
        prompt: "Example question 1",
        response: "Example answer 1",
        metadata: { source: "user" },
      },
      {
        prompt: "Example question 2",
        response: "Example answer 2",
        metadata: { source: "user" },
      },
    ];

    await fs.writeFile(
      templatePath,
      template.map(e => JSON.stringify(e)).join("\n"),
      "utf8"
    );

    logger.info(`Created entry template at ${chalk.cyan(templatePath)}`);
    logger.info("Add your entries to this file, then run:");
    console.log(
      `  ${chalk.cyan(`aequor cartridge install ${name}.template.jsonl`)}`
    );
  } catch (error) {
    logger.error(`Cartridge creation failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Get installed cartridges from directory
 */
async function getInstalledCartridges(
  cartridgeDir: string
): Promise<CartridgeMetadata[]> {
  const cartridges: CartridgeMetadata[] = [];

  try {
    await fs.access(cartridgeDir);

    const files = await fs.readdir(cartridgeDir);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const filepath = join(cartridgeDir, file);
        const data = await fs.readFile(filepath, "utf8");
        const metadata: CartridgeMetadata = JSON.parse(data);

        // Get file size
        const stats = await fs.stat(filepath);
        metadata.size = stats.size;

        cartridges.push(metadata);
      } catch {
        // Skip invalid cartridges
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return cartridges;
}
