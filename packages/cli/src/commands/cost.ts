/**
 * Cost command - View cost tracking and budget information
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import {
  createTable,
  formatCost,
  createProgressBar,
} from "../utils/formatting.js";
import { CliTable3 } from "../utils/index.js";
import { configManager } from "../config/manager.js";

/**
 * Cost command _options
 */
export interface CostOptions {
  /** Time _period */
  _period?: "day" | "week" | "month" | "all";
  /** Output format */
  format?: "text" | "json";
  /** Budget management */
  budget?: boolean;
  /** Set budget */
  set?: string;
}

/**
 * Create cost command
 */
export function createCostCommand(): Command {
  const cmd = new Command("cost");

  cmd
    .description("View cost tracking and budget information")
    .option(
      "-p, --_period <_period>",
      "Time _period (day, week, month, all)",
      "month"
    )
    .option("-f, --format <format>", "Output format", "text")
    .option("-b, --budget", "Manage budget")
    .option("--set <amount>", "Set budget (e.g., --set daily:10.00)")
    .action(async (_options: CostOptions) => {
      await executeCost(_options);
    });

  // Budget subcommand
  cmd
    .command("budget")
    .description("Manage budget settings")
    .option("--daily <amount>", "Set daily budget in USD")
    .option("--weekly <amount>", "Set weekly budget in USD")
    .option("--monthly <amount>", "Set monthly budget in USD")
    .action(async (_options: BudgetOptions) => {
      await executeBudget(_options);
    });

  return cmd;
}

/**
 * Budget management _options
 */
export interface BudgetOptions {
  daily?: string;
  weekly?: string;
  monthly?: string;
}

/**
 * Execute cost command
 */
async function executeCost(_options: CostOptions): Promise<void> {
  try {
    const _config = await configManager.getAll();

    if (_options.set) {
      await setBudget(_options.set);
      return;
    }

    if (_options.format === "json") {
      outputJsonCost(_config);
    } else {
      await outputTextCost(_config, _options._period);
    }
  } catch (error) {
    logger.error(`Failed to get cost information: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Execute budget command
 */
async function executeBudget(_options: BudgetOptions): Promise<void> {
  try {
    if (_options.daily) {
      await setBudget(`daily:${_options.daily}`);
    }
    if (_options.weekly) {
      await setBudget(`weekly:${_options.weekly}`);
    }
    if (_options.monthly) {
      await setBudget(`monthly:${_options.monthly}`);
    }

    if (!_options.daily && !_options.weekly && !_options.monthly) {
      // Show current budget settings
      const _config = await configManager.getAll();
      outputBudgetStatus(_config);
    }
  } catch (error) {
    logger.error(`Failed to manage budget: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Set budget
 */
async function setBudget(spec: string): Promise<void> {
  const [_period, amount] = spec.split(":");

  if (!_period || !amount) {
    logger.error("Invalid budget specification. Use format: <_period>:<amount>");
    logger.info("Example: --set daily:10.00");
    process.exit(1);
  }

  const dollars = parseFloat(amount);
  if (isNaN(dollars) || dollars <= 0) {
    logger.error("Invalid amount. Must be a positive number.");
    process.exit(1);
  }

  const cents = Math.round(dollars * 100);

  switch (_period.toLowerCase()) {
    case "daily":
      await configManager.set("budget.daily", cents);
      logger.success(`Daily budget set to ${formatCost(cents)}`);
      break;
    case "weekly":
      await configManager.set("budget.weekly", cents);
      logger.success(`Weekly budget set to ${formatCost(cents)}`);
      break;
    case "monthly":
      await configManager.set("budget.monthly", cents);
      logger.success(`Monthly budget set to ${formatCost(cents)}`);
      break;
    default:
      logger.error(`Invalid _period: ${_period}`);
      logger.info("Valid periods: daily, weekly, monthly");
      process.exit(1);
  }
}

/**
 * Output cost as text
 */
async function outputTextCost(
  _config: Awaited<ReturnType<typeof configManager.getAll>>,
  _period: string = "month"
): Promise<void> {
  logger.blank();

  console.log(chalk.cyan("Cost Summary:"));
  logger.blank();

  const costTable: CliTable3.Table = createTable([
    { header: "Period", width: 15 },
    { header: "Spent", width: 15 },
    { header: "Budget", width: 15 },
    { header: "Remaining", width: 15 },
    { header: "Usage", width: 20 },
  ]);

  // TODO: Implement actual cost tracking
  // For now, show budget and 0 spent
  const periods = [
    { name: "Daily", budget: _config.budget.daily, spent: 0 },
    { name: "Weekly", budget: _config.budget.weekly, spent: 0 },
    { name: "Monthly", budget: _config.budget.monthly, spent: 0 },
  ];

  for (const p of periods) {
    const remaining = p.budget - p.spent;

    costTable.push([
      p.name,
      formatCost(p.spent),
      formatCost(p.budget),
      formatCost(remaining),
      createProgressBar(p.spent, p.budget),
    ]);
  }

  console.log(costTable.toString());
  logger.blank();

  console.log(chalk.grey("Note: Cost tracking is not yet implemented"));
  console.log(
    chalk.grey("Budgets are configured but no actual costs are being tracked")
  );
  logger.blank();

  console.log(chalk.cyan("Budget Management:"));
  console.log(
    `  ${chalk.grey("•")} Set daily budget: ${chalk.cyan("aequor cost budget --daily 10.00")}`
  );
  console.log(
    `  ${chalk.grey("•")} Set weekly budget: ${chalk.cyan("aequor cost budget --weekly 50.00")}`
  );
  console.log(
    `  ${chalk.grey("•")} Set monthly budget: ${chalk.cyan("aequor cost budget --monthly 200.00")}`
  );
  logger.blank();
}

/**
 * Output budget status
 */
function outputBudgetStatus(
  _config: Awaited<ReturnType<typeof configManager.getAll>>
): void {
  logger.blank();
  console.log(chalk.cyan("Current Budget Settings:"));
  logger.blank();

  const budgetTable: CliTable3.Table = createTable([
    { header: "Period", width: 15 },
    { header: "Budget", width: 20 },
    { header: "Alert Threshold", width: 20 },
  ]);

  budgetTable.push([
    "Daily",
    formatCost(_config.budget.daily),
    `${_config.budget.alertThreshold}%`,
  ]);
  budgetTable.push([
    "Weekly",
    formatCost(_config.budget.weekly),
    `${_config.budget.alertThreshold}%`,
  ]);
  budgetTable.push([
    "Monthly",
    formatCost(_config.budget.monthly),
    `${_config.budget.alertThreshold}%`,
  ]);

  console.log(budgetTable.toString());
  logger.blank();
}

/**
 * Output cost as JSON
 */
function outputJsonCost(
  _config: Awaited<ReturnType<typeof configManager.getAll>>
): void {
  const cost = {
    budget: {
      daily: _config.budget.daily,
      weekly: _config.budget.weekly,
      monthly: _config.budget.monthly,
      alertThreshold: _config.budget.alertThreshold,
    },
    spent: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    remaining: {
      daily: _config.budget.daily,
      weekly: _config.budget.weekly,
      monthly: _config.budget.monthly,
    },
    note: "Cost tracking not yet implemented",
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(cost, null, 2));
}
