/**
 * Progress Display Utilities
 *
 * Provides progress bars, spinners, and status messages for CLI operations.
 * Uses cli-progress for download bars and ora for spinners.
 */

import * as cliProgress from 'cli-progress';
import chalk from 'chalk';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Progress callback for download operations
 */
export interface ProgressCallback {
  (progress: DownloadProgress): void;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Component name */
  name: string;
  /** Bytes downloaded */
  downloaded: number;
  /** Total bytes */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current operation */
  operation: 'downloading' | 'extracting' | 'installing' | 'verifying';
  /** Download speed (bytes/sec) */
  speed?: number;
  /** ETA (seconds) */
  eta?: number;
}

// ============================================================================
// PROGRESS BAR CLASS
// ============================================================================

/**
 * Multi-progress bar manager
 */
export class ProgressManager {
  private multiBar: cliProgress.MultiBar;
  private bars: Map<string, cliProgress.SingleBar>;

  constructor() {
    this.multiBar = new cliProgress.MultiBar({
      stream: process.stderr,
      clearOnComplete: false,
      hideCursor: true,
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} {operation} | {name}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      barsize: 100,
    });

    this.bars = new Map();
  }

  /**
   * Create a new progress bar
   */
  createBar(name: string, total: number, operation: string = 'downloading'): cliProgress.SingleBar {
    const bar = this.multiBar.create(total, 0, {
      name,
      operation: operation.padEnd(12),
    });

    this.bars.set(name, bar);
    return bar;
  }

  /**
   * Update progress bar
   */
  updateBar(name: string, value: number, operation?: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(value, {
        operation: operation ? operation.padEnd(12) : undefined,
      });
    }
  }

  /**
   * Complete progress bar
   */
  completeBar(name: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(bar.getTotal());
      this.multiBar.stop();
      this.bars.delete(name);
    }
  }

  /**
   * Remove progress bar
   */
  removeBar(name: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      this.multiBar.remove(bar);
      this.bars.delete(name);
    }
  }

  /**
   * Stop all progress bars
   */
  stop(): void {
    this.multiBar.stop();
    this.bars.clear();
  }

  /**
   * Create a progress callback for a component
   */
  createProgressCallback(name: string, total: number): ProgressCallback {
    this.createBar(name, total, 'downloading');

    return (progress: DownloadProgress) => {
      this.updateBar(name, progress.downloaded, progress.operation);

      if (progress.percentage >= 100) {
        this.completeBar(name);
      }
    };
  }
}

// ============================================================================
// PROGRESS BAR FACTORY
// ============================================================================

/**
 * Create a download progress bar
 */
export function createDownloadBar(name: string, totalBytes: number): {
  bar: cliProgress.SingleBar;
  update: (downloaded: number, total?: number) => void;
  complete: () => void;
} {
  const bar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} bytes | {name}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    barsize: 80,
  }, cliProgress.Presets.shades_grey);

  bar.start(totalBytes, 0, { name });

  return {
    bar,
    update: (downloaded: number, _total?: number) => {
      bar.update(downloaded, { name });
    },
    complete: () => {
      bar.update(totalBytes, { name });
      bar.stop();
    },
  };
}

// ============================================================================
// SPINNER HELPERS
// ============================================================================

/**
 * Spinner state (for ora compatibility)
 */
export interface SpinnerState {
  /** Start spinner */
  start: (text?: string) => SpinnerState;
  /** Stop spinner with success */
  succeed: (text?: string) => SpinnerState;
  /** Stop spinner with failure */
  fail: (text?: string) => SpinnerState;
  /** Stop spinner with info */
  info: (text?: string) => SpinnerState;
  /** Stop spinner with warning */
  warn: (text?: string) => SpinnerState;
  /** Update spinner text */
  text: string;
  /** Stop spinner */
  stop: () => SpinnerState;
}

/**
 * Simple spinner implementation (fallback if ora is not available)
 */
class SimpleSpinner implements SpinnerState {
  private _text: string = '';
  private interval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  constructor(text?: string) {
    if (text) {
      this._text = text;
    }
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
    if (this.interval) {
      process.stderr.write('\r' + this.frames[this.frameIndex] + ' ' + this._text);
    }
  }

  start(text?: string): SpinnerState {
    if (text) {
      this._text = text;
    }

    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stderr.write('\r' + this.frames[this.frameIndex] + ' ' + this._text);
    }, 80);

    return this;
  }

  stop(): SpinnerState {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stderr.write('\r' + ' '.repeat(this._text.length + 2) + '\r');
    }
    return this;
  }

  succeed(text?: string): SpinnerState {
    this.stop();
    const message = text || this._text;
    console.log(chalk.green('✔') + ' ' + message);
    return this;
  }

  fail(text?: string): SpinnerState {
    this.stop();
    const message = text || this._text;
    console.error(chalk.red('✖') + ' ' + message);
    return this;
  }

  info(text?: string): SpinnerState {
    this.stop();
    const message = text || this._text;
    console.log(chalk.blue('ℹ') + ' ' + message);
    return this;
  }

  warn(text?: string): SpinnerState {
    this.stop();
    const message = text || this._text;
    console.warn(chalk.yellow('⚠') + ' ' + message);
    return this;
  }
}

/**
 * Create a spinner (uses ora if available, otherwise falls back to simple spinner)
 */
export function createSpinner(text?: string): SpinnerState {
  try {
    // Try to use ora
    const ora = require('ora');
    return ora(text);
  } catch {
    // Fall back to simple spinner
    return new SimpleSpinner(text);
  }
}

// ============================================================================
// STATUS MESSAGE HELPERS
// ============================================================================

/**
 * Print a success message
 */
export function success(message: string): void {
  console.log(chalk.green('✔') + ' ' + message);
}

/**
 * Print an error message
 */
export function error(message: string): void {
  console.error(chalk.red('✖') + ' ' + message);
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
  console.warn(chalk.yellow('⚠') + ' ' + message);
}

/**
 * Print an info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ') + ' ' + message);
}

/**
 * Print a debug message (only in debug mode)
 */
export function debug(message: string, enabled: boolean = false): void {
  if (enabled) {
    console.log(chalk.gray('●') + ' ' + chalk.gray(message));
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format speed to human-readable string
 */
export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s';
}

/**
 * Calculate download speed
 */
export function calculateSpeed(
  downloaded: number,
  startTime: number
): number {
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed <= 0) {
    return 0;
  }
  return downloaded / elapsed;
}

/**
 * Calculate ETA
 */
export function calculateETA(
  downloaded: number,
  total: number,
  speed: number
): number {
  if (speed <= 0) {
    return 0;
  }
  const remaining = total - downloaded;
  return remaining / speed;
}

// ============================================================================
// BATCH PROGRESS
// ============================================================================

/**
 * Batch download progress tracker
 */
export class BatchProgress {
  private total: number;
  private completed: number = 0;
  private failed: number = 0;
  private progressManager: ProgressManager;

  constructor(total: number) {
    this.total = total;
    this.progressManager = new ProgressManager();
  }

  /**
   * Start a component download
   */
  start(name: string, size: number): void {
    this.progressManager.createBar(name, size, 'downloading');
  }

  /**
   * Update component download progress
   */
  update(name: string, downloaded: number): void {
    this.progressManager.updateBar(name, downloaded);
  }

  /**
   * Mark component as completed
   */
  complete(name: string): void {
    this.progressManager.completeBar(name);
    this.completed++;
  }

  /**
   * Mark component as failed
   */
  fail(name: string): void {
    this.progressManager.removeBar(name);
    this.failed++;
  }

  /**
   * Get completion status
   */
  getStatus(): {
    completed: number;
    failed: number;
    remaining: number;
    percentage: number;
  } {
    const remaining = this.total - this.completed - this.failed;
    const percentage = ((this.completed + this.failed) / this.total) * 100;

    return {
      completed: this.completed,
      failed: this.failed,
      remaining,
      percentage,
    };
  }

  /**
   * Stop all progress bars
   */
  stop(): void {
    this.progressManager.stop();
  }
}
