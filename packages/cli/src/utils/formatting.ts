/**
 * Formatting utilities for CLI output
 */

import { default as CliTable3 } from "cli-table3";
import chalk from "chalk";

/**
 * Table column definition
 */
export interface TableColumn {
  /** Column header */
  header: string;
  /** Column width (characters) */
  width: number;
  /** Alignment */
  align?: "left" | "center" | "right";
}

/**
 * Create a formatted table for CLI output
 */
export function createTable(columns: TableColumn[]): any {
  const colWidths: number[] = [];
  const colAligns: ("left" | "center" | "right")[] = [];
  const heads: string[] = [];

  for (const col of columns) {
    colWidths.push(col.width);
    colAligns.push(col.align || "left");
    heads.push(col.header);
  }

  return new CliTable3({
    head: heads.map(h => chalk.cyan(h)),
    colWidths,
    colAligns,
    style: {
      head: [],
      border: ["grey"],
    },
  });
}

/**
 * Format a duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Format a percentage with color coding
 */
export function formatPercentage(value: number, total: number): string {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const formatted = `${percentage.toFixed(1)}%`;

  if (percentage >= 90) {
    return chalk.green(formatted);
  } else if (percentage >= 70) {
    return chalk.yellow(formatted);
  } else {
    return chalk.red(formatted);
  }
}

/**
 * Truncate text to fit within a width
 */
export function truncate(
  text: string,
  maxWidth: number,
  suffix = "..."
): string {
  if (text.length <= maxWidth) {
    return text;
  }
  return text.substring(0, maxWidth - suffix.length) + suffix;
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return `${chalk.green("✓")} ${message}`;
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return `${chalk.red("✗")} ${message}`;
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return `${chalk.yellow("⚠")} ${message}`;
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return `${chalk.blue("ℹ")} ${message}`;
}

/**
 * Create a horizontal rule
 */
export function createHorizontalRule(char = "─", width = 60): string {
  return char.repeat(Math.max(10, width));
}

/**
 * Create a section header
 */
export function createSectionHeader(title: string, char = "─"): string {
  const rule = char.repeat(Math.max(10, title.length + 4));
  return `\n${chalk.cyan(rule)}\n${chalk.cyan.bold(title)}\n${chalk.cyan(rule)}\n`;
}

/**
 * Format a key-value pair
 */
export function formatKeyValue(key: string, value: string, indent = 0): string {
  const prefix = " ".repeat(indent);
  return `${prefix}${chalk.cyan(key)}: ${value}`;
}

/**
 * Format a list item
 */
export function formatListItem(
  text: string,
  index?: number,
  indent = 0
): string {
  const prefix = " ".repeat(indent);
  const bullet =
    index !== undefined ? `${chalk.cyan(index + 1)}.` : `${chalk.cyan("•")}`;
  return `${prefix}${bullet} ${text}`;
}

/**
 * Create a box around text
 */
export function createBox(
  text: string,
  options: {
    /** Box character style */
    style?: "single" | "double" | "rounded";
    /** Padding inside box */
    padding?: number;
  } = {}
): string {
  const { style = "single", padding = 1 } = options;

  const chars = {
    single: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
    double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
    rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  };

  const c = chars[style];
  const lines = text.split("\n");
  const maxWidth = Math.max(...lines.map(l => l.length));
  const width = maxWidth + padding * 2;

  const pad = " ".repeat(padding);
  const horizontal = c.h.repeat(width);

  let output = c.tl + horizontal + c.tr + "\n";

  for (const line of lines) {
    const paddedLine = pad + line.padEnd(maxWidth) + pad;
    output += c.v + paddedLine + c.v + "\n";
  }

  output += c.bl + horizontal + c.br;

  return output;
}

/**
 * Format command syntax
 */
export function formatCommand(command: string): string {
  return chalk.cyan(command);
}

/**
 * Format an option/flag
 */
export function formatOption(option: string): string {
  return chalk.yellow(option);
}

/**
 * Format an argument
 */
export function formatArgument(arg: string): string {
  return chalk.green(arg);
}

/**
 * Format a code snippet
 */
export function formatCode(code: string): string {
  return chalk.grey(code);
}

/**
 * Format a dimension vector sample
 */
export function formatVectorSample(vector: number[], sampleSize = 5): string {
  const sample = Array.from(vector.slice(0, sampleSize)).map(v => v.toFixed(4));
  const remaining = vector.length - sampleSize;
  return `[${sample.join(", ")}${remaining > 0 ? ", ..." : ""}]`;
}

/**
 * Format a model name for display
 */
export function formatModelName(model: string): string {
  // Shorten common model names
  const shortNames: Record<string, string> = {
    "gpt-4-turbo-preview": "GPT-4 Turbo",
    "gpt-4-1106-preview": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "gpt-3.5-turbo-1106": "GPT-3.5 Turbo",
    "llama2:13b": "Llama 2 13B",
    "llama2:7b": "Llama 2 7B",
    "mistral:7b": "Mistral 7B",
    "codellama:13b": "Code Llama 13B",
  };

  return shortNames[model] || model;
}

/**
 * Create a progress bar string
 */
export function createProgressBar(
  current: number,
  total: number,
  width = 30
): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.floor(percentage * width);
  const empty = width - filled;

  const filledBar = chalk.green("█".repeat(filled));
  const emptyBar = "░".repeat(empty);

  return `${filledBar}${emptyBar} ${formatPercentage(current, total)}`;
}

/**
 * Format a cost in USD
 */
export function formatCost(cents: number): string {
  const dollars = cents / 100;
  return chalk.green(`$${dollars.toFixed(2)}`);
}

/**
 * Get a status badge with color
 */
export function getStatusBadge(status: string): string {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case "healthy":
    case "online":
    case "available":
    case "ready":
      return chalk.green.bgBlack(` ${status.toUpperCase()} `);
    case "unhealthy":
    case "offline":
    case "unavailable":
      return chalk.red.bgBlack(` ${status.toUpperCase()} `);
    case "degraded":
    case "warning":
      return chalk.yellow.bgBlack(` ${status.toUpperCase()} `);
    case "loading":
    case "pending":
      return chalk.blue.bgBlack(` ${status.toUpperCase()} `);
    default:
      return chalk.grey.bgBlack(` ${status.toUpperCase()} `);
  }
}
