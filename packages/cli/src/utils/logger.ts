/**
 * Logger utilities for consistent CLI output
 */

import chalk from "chalk";
import createSpinner from "ora";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  minLevel: LogLevel;
  /** Whether to use colors */
  colorize: boolean;
  /** Whether to show timestamps */
  showTimestamp: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  minLevel: LogLevel.INFO,
  colorize: true,
  showTimestamp: false,
};

/**
 * Logger class for consistent CLI output
 */
export class Logger {
  private config: LoggerConfig;
  private spinners: Map<string, ReturnType<typeof createSpinner>> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Format a log message with optional prefix
   */
  private format(
    message: string,
    _level: string,
    prefix: string,
    color: (msg: string) => string
  ): string {
    const timestamp = this.config.showTimestamp
      ? `${chalk.grey(new Date().toISOString())} `
      : "";
    const levelStr = prefix ? color(prefix) : "";
    return `${timestamp}${levelStr} ${message}`;
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    if (this.config.minLevel <= LogLevel.DEBUG) {
      console.log(this.format(message, "DEBUG", "DBG", chalk.grey));
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.config.minLevel <= LogLevel.INFO) {
      console.log(this.format(message, "INFO", "INFO", chalk.blue));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.config.minLevel <= LogLevel.WARN) {
      console.warn(this.format(message, "WARN", "WARN", chalk.yellow));
    }
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    if (this.config.minLevel <= LogLevel.ERROR) {
      console.error(this.format(message, "ERROR", "ERR", chalk.red));
    }
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    if (this.config.minLevel <= LogLevel.SUCCESS) {
      console.log(this.format(message, "SUCCESS", "✓", chalk.green));
    }
  }

  /**
   * Log a blank line
   */
  blank(): void {
    console.log("");
  }

  /**
   * Create a spinner for long-running operations
   */
  createSpinner(id: string, text: string): ReturnType<typeof createSpinner> {
    const spinner = createSpinner(text);
    this.spinners.set(id, spinner);
    return spinner;
  }

  /**
   * Start a spinner
   */
  startSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      if (text) spinner.text = text;
      spinner.start();
    }
  }

  /**
   * Update spinner text
   */
  updateSpinner(id: string, text: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.text = text;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.succeed(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.fail(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop spinner with info
   */
  infoSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.info(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Stop spinner with warning
   */
  warnSpinner(id: string, text?: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.warn(text);
      this.spinners.delete(id);
    }
  }

  /**
   * Remove a spinner
   */
  removeSpinner(id: string): void {
    const spinner = this.spinners.get(id);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(id);
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();
