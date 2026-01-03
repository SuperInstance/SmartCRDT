// import cliProgress from 'cli-progress';
import { DownloadProgress } from './types.js';

// Mock cli-progress for now (real dependency would be installed)
class MockSingleBar {
  constructor(options: any, presets: any) {}
  start(total: number, value: number, payload: any) {}
  update(value: number, payload: any) {}
  stop() {}
}

const cliProgress = {
  SingleBar: MockSingleBar,
  Presets: {
    shades_grey: {},
  },
};

/**
 * Progress display format
 */
export enum ProgressFormat {
  /** CLI progress bar */
  BAR,
  /** JSON output for machine parsing */
  JSON,
  /** Simple text */
  TEXT,
  /** Spinner for small downloads */
  SPINNER,
  /** Silent (no output) */
  SILENT,
}

/**
 * Progress display options
 */
export interface ProgressOptions {
  /** Display format */
  format?: ProgressFormat;
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Whether to show ETA */
  showEta?: boolean;
  /** Whether to show speed */
  showSpeed?: boolean;
  /** Custom progress bar template */
  template?: string;
  /** Stream to write to (default: stderr) */
  stream?: NodeJS.WriteStream;
}

/**
 * Default progress options
 */
const DEFAULT_PROGRESS_OPTIONS: ProgressOptions = {
  format: ProgressFormat.BAR,
  updateInterval: 100,
  showEta: true,
  showSpeed: true,
  stream: process.stderr,
};

/**
 * Progress bar for displaying download progress
 */
export class ProgressBar {
  private bar: cliProgress.SingleBar | null = null;
  private format: ProgressFormat;
  private options: ProgressOptions;
  private lastUpdate: number = 0;
  private startTime: number = 0;
  private currentProgress: DownloadProgress | null = null;

  constructor(options: ProgressOptions = {}) {
    this.options = { ...DEFAULT_PROGRESS_OPTIONS, ...options };
    this.format = this.options.format || ProgressFormat.BAR;
  }

  /**
   * Start progress display
   */
  start(progress: DownloadProgress): void {
    this.startTime = Date.now();
    this.currentProgress = progress;

    switch (this.format) {
      case ProgressFormat.BAR:
        this.startBar();
        break;
      case ProgressFormat.JSON:
        this.outputJson(progress);
        break;
      case ProgressFormat.TEXT:
        this.outputText(progress);
        break;
      case ProgressFormat.SPINNER:
        this.startSpinner();
        break;
      case ProgressFormat.SILENT:
        // No output
        break;
    }
  }

  /**
   * Update progress display
   */
  update(progress: DownloadProgress): void {
    this.currentProgress = progress;
    const now = Date.now();

    // Throttle updates
    if (now - this.lastUpdate < (this.options.updateInterval || 100)) {
      return;
    }
    this.lastUpdate = now;

    switch (this.format) {
      case ProgressFormat.BAR:
        this.updateBar(progress);
        break;
      case ProgressFormat.JSON:
        this.outputJson(progress);
        break;
      case ProgressFormat.TEXT:
        this.outputText(progress);
        break;
      case ProgressFormat.SPINNER:
        this.updateSpinner(progress);
        break;
      case ProgressFormat.SILENT:
        // No output
        break;
    }
  }

  /**
   * Stop progress display
   */
  stop(complete = true): void {
    if (this.format === ProgressFormat.BAR && this.bar) {
      this.bar.stop();
      this.bar = null;
    }

    if (complete && this.currentProgress) {
      this.outputComplete();
    }
  }

  /**
   * Start CLI progress bar
   */
  private startBar(): void {
    const template = this.options.template || this.getDefaultTemplate();

    this.bar = new cliProgress.SingleBar({
      format: template,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: false,
    }, cliProgress.Presets.shades_grey as any);

    if (this.currentProgress) {
      this.bar.start(this.currentProgress.total, 0, {
        speed: '0 B/s',
        eta: '0s',
      });
    }
  }

  /**
   * Update CLI progress bar
   */
  private updateBar(progress: DownloadProgress): void {
    if (!this.bar) return;

    this.bar.update(progress.downloaded, {
      speed: this.formatSpeed(progress.speed),
      eta: this.formatEta(progress.eta),
    });
  }

  /**
   * Start spinner
   */
  private startSpinner(): void {
    // Simple spinner implementation
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frame = 0;

    this.spinnerInterval = setInterval(() => {
      const frameText = frames[frame % frames.length];
      const progress = this.currentProgress;

      if (progress) {
        this.output(`${frameText} Downloading ${progress.component}@${progress.version}: ${progress.percentage.toFixed(1)}%`);
      }

      frame++;
    }, 80);
  }

  /**
   * Update spinner
   */
  private updateSpinner(progress: DownloadProgress): void {
    // Spinner updates itself via interval
    this.currentProgress = progress;
  }

  private spinnerInterval: NodeJS.Timeout | null = null;

  /**
   * Output JSON format
   */
  private outputJson(progress: DownloadProgress): void {
    const output = {
      type: 'progress',
      timestamp: new Date().toISOString(),
      ...progress,
    };

    this.output(JSON.stringify(output));
  }

  /**
   * Output text format
   */
  private outputText(progress: DownloadProgress): void {
    const parts = [
      `Downloading ${progress.component}@${progress.version}`,
      `${this.formatBytes(progress.downloaded)}/${this.formatBytes(progress.total)}`,
      `${progress.percentage.toFixed(1)}%`,
    ];

    if (this.options.showSpeed) {
      parts.push(this.formatSpeed(progress.speed));
    }

    if (this.options.showEta) {
      parts.push(`ETA: ${this.formatEta(progress.eta)}`);
    }

    this.output(parts.join(' | '));
  }

  /**
   * Output completion message
   */
  private outputComplete(): void {
    const duration = Date.now() - this.startTime;
    const progress = this.currentProgress;

    if (!progress) return;

    switch (this.format) {
      case ProgressFormat.BAR:
        // Already handled by bar
        break;
      case ProgressFormat.JSON:
        this.output(JSON.stringify({
          type: 'complete',
          timestamp: new Date().toISOString(),
          component: progress.component,
          version: progress.version,
          duration,
        }));
        break;
      case ProgressFormat.TEXT:
      case ProgressFormat.SPINNER:
        this.output(`✓ Downloaded ${progress.component}@${progress.version} (${this.formatBytes(progress.total)}) in ${(duration / 1000).toFixed(1)}s`);
        break;
      case ProgressFormat.SILENT:
        break;
    }

    // Clean up spinner
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  /**
   * Get default progress bar template
   */
  private getDefaultTemplate(): string {
    let template = '{bar} {percentage}% | {value}/{total}';

    if (this.options.showSpeed) {
      template += ' | {speed}';
    }

    if (this.options.showEta) {
      template += ' | ETA: {eta}';
    }

    return template;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format speed to human readable
   */
  private formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }

  /**
   * Format ETA to human readable
   */
  private formatEta(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Write output to stream
   */
  private output(message: string): void {
    const stream = this.options.stream || process.stderr;
    stream.write(message + '\n');
  }
}

/**
 * Multi-progress bar for concurrent downloads
 */
export class MultiProgressBar {
  private bars: Map<string, ProgressBar> = new Map();
  private format: ProgressFormat;

  constructor(format: ProgressFormat = ProgressFormat.BAR) {
    this.format = format;
  }

  /**
   * Create a new progress bar for a download
   */
  create(id: string, progress: DownloadProgress): void {
    const bar = new ProgressBar({ format: this.format });
    this.bars.set(id, bar);
    bar.start(progress);
  }

  /**
   * Update a progress bar
   */
  update(id: string, progress: DownloadProgress): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.update(progress);
    }
  }

  /**
   * Remove a progress bar
   */
  remove(id: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.stop();
      this.bars.delete(id);
    }
  }

  /**
   * Stop all progress bars
   */
  stopAll(): void {
    for (const bar of this.bars.values()) {
      bar.stop();
    }
    this.bars.clear();
  }
}

/**
 * Create a progress callback from options
 */
export function createProgressCallback(
  options: ProgressOptions = {}
): (progress: DownloadProgress) => void {
  const bar = new ProgressBar(options);

  return (progress: DownloadProgress) => {
    if (!bar['currentProgress']) {
      bar.start(progress);
    } else {
      bar.update(progress);
    }
  };
}

/**
 * Format progress for logging
 */
export function formatProgress(progress: DownloadProgress): string {
  return `${progress.component}@${progress.version}: ${progress.percentage.toFixed(1)}% (${formatBytes(progress.downloaded)}/${formatBytes(progress.total)})`;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
