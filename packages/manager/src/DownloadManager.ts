/**
 * @lsi/manager - Download Manager
 *
 * Manages component downloads with progress tracking, resume support,
 * checksum verification, and concurrent download management.
 */

import axios, { AxiosProgressEvent } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import tar from 'tar';
import archiver from 'archiver';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Component or file name */
  name: string;
  /** Target version (if applicable) */
  version?: string;
  /** Bytes downloaded */
  downloaded_bytes: number;
  /** Total bytes to download */
  total_bytes: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Download speed in bytes/sec */
  speed: number;
  /** Estimated remaining time in seconds */
  eta: number;
  /** Current status message */
  status: string;
  /** Download URL */
  url?: string;
  /** Destination path */
  destination?: string;
  /** Whether download is resumable */
  resumable: boolean;
  /** Timestamp of progress update */
  timestamp: Date;
}

/**
 * Download configuration
 */
export interface DownloadConfig {
  /** Base URL for downloads */
  baseURL: string;
  /** Cache directory for downloads */
  cacheDir: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Maximum concurrent downloads */
  maxConcurrent: number;
  /** Chunk size for streaming downloads (bytes) */
  chunkSize: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Whether to verify checksums */
  verifyChecksum: boolean;
  /** Whether to support resuming downloads */
  resumeSupport: boolean;
}

/**
 * Download task
 */
export interface DownloadTask {
  /** Unique task ID */
  id: string;
  /** Download URL */
  url: string;
  /** Destination path */
  destination: string;
  /** Expected checksum (optional) */
  checksum?: string;
  /** Current progress */
  progress: DownloadProgress;
  /** Number of retry attempts */
  retries: number;
  /** Task status */
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  /** Error message if failed */
  error?: string;
  /** Partial download path (for resume) */
  partialPath?: string;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  /** Source archive path */
  source: string;
  /** Destination directory */
  destination: string;
  /** Number of files extracted */
  fileCount: number;
  /** Total extracted size in bytes */
  extractedSize: number;
  /** Extraction duration in milliseconds */
  duration: number;
  /** Whether extraction was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Download statistics
 */
export interface DownloadStatistics {
  /** Total downloads completed */
  totalDownloads: number;
  /** Total bytes downloaded */
  totalBytes: number;
  /** Average download speed (bytes/sec) */
  averageSpeed: number;
  /** Total download time (milliseconds) */
  totalTime: number;
  /** Number of failed downloads */
  failedDownloads: number;
  /** Number of resumed downloads */
  resumedDownloads: number;
}

// ============================================================================
// DOWNLOAD MANAGER
// ============================================================================

/**
 * Manages component downloads with progress tracking and resume support
 */
export class DownloadManager {
  private config: DownloadConfig;
  private activeDownloads: Map<string, DownloadTask>;
  private downloadQueue: DownloadTask[];
  private statistics: DownloadStatistics;
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void>;
  private startTime: number;

  constructor(config: DownloadConfig) {
    this.config = config;
    this.activeDownloads = new Map();
    this.downloadQueue = [];
    this.statistics = {
      totalDownloads: 0,
      totalBytes: 0,
      averageSpeed: 0,
      totalTime: 0,
      failedDownloads: 0,
      resumedDownloads: 0,
    };
    this.progressCallbacks = new Map();
    this.startTime = Date.now();
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Download file with progress tracking
   */
  async download(
    url: string,
    destination: string,
    options: {
      checksum?: string;
      onProgress?: (progress: DownloadProgress) => void;
      taskId?: string;
    } = {}
  ): Promise<DownloadProgress> {
    const taskId = options.taskId || this.generateTaskId(url);
    const partialPath = `${destination}.part`;

    // Check for partial download to resume
    const resumeByte = await this.getPartialDownloadSize(partialPath);
    const resumable = resumeByte > 0 && this.config.resumeSupport;

    // Create download task
    const task: DownloadTask = {
      id: taskId,
      url,
      destination,
      checksum: options.checksum,
      retries: 0,
      status: resumable ? 'downloading' : 'pending',
      partialPath,
      progress: {
        name: path.basename(destination),
        downloaded_bytes: resumeByte,
        total_bytes: 0,
        progress: 0,
        speed: 0,
        eta: 0,
        status: 'Initializing',
        url,
        destination,
        resumable,
        timestamp: new Date(),
      },
    };

    this.activeDownloads.set(taskId, task);

    if (options.onProgress) {
      this.progressCallbacks.set(taskId, options.onProgress);
    }

    try {
      // Perform download with retry logic
      await this.downloadWithRetry(task, resumeByte);

      // Verify checksum if provided
      if (options.checksum && this.config.verifyChecksum) {
        const valid = await this.verify(destination, options.checksum);
        if (!valid) {
          throw new Error(`Checksum verification failed for ${destination}`);
        }
      }

      // Move partial to final destination
      if (await fs.pathExists(partialPath)) {
        await fs.move(partialPath, destination, { overwrite: true });
      }

      task.status = 'completed';
      task.progress.status = 'Completed';
      task.progress.progress = 100;

      // Update statistics
      this.statistics.totalDownloads++;
      this.statistics.totalBytes += task.progress.downloaded_bytes;

      return task.progress;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.progress.status = 'Failed';
      this.statistics.failedDownloads++;
      throw error;
    } finally {
      this.activeDownloads.delete(taskId);
      this.progressCallbacks.delete(taskId);
    }
  }

  /**
   * Verify file integrity using checksum
   */
  async verify(filePath: string, checksum: string): boolean {
    try {
      const fileHash = await this.calculateChecksum(filePath);
      const expectedHash = checksum.replace(/^sha256?:/i, '');
      return fileHash === expectedHash;
    } catch (error) {
      console.error(`Checksum verification failed:`, error);
      return false;
    }
  }

  /**
   * Extract tar.gz archive to destination
   */
  async extract(archive: string, destination: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    let fileCount = 0;
    let extractedSize = 0;

    try {
      await fs.ensureDir(destination);

      // Extract archive
      await tar.x({
        file: archive,
        cwd: destination,
        strip: 1, // Remove leading directory component
      });

      // Count files and calculate size
      const files = await this.listFilesRecursive(destination);
      fileCount = files.length;

      for (const file of files) {
        const stats = await fs.stat(file);
        extractedSize += stats.size;
      }

      const duration = Date.now() - startTime;

      return {
        source: archive,
        destination,
        fileCount,
        extractedSize,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        source: archive,
        destination,
        fileCount,
        extractedSize,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resume interrupted download
   */
  async resume(url: string, partial: string): Promise<DownloadProgress> {
    if (!await fs.pathExists(partial)) {
      throw new Error(`Partial download not found: ${partial}`);
    }

    const destination = partial.replace(/\.part$/, '');
    const resumeByte = await this.getPartialDownloadSize(partial);

    return this.download(url, destination, {
      taskId: this.generateTaskId(url),
    });
  }

  /**
   * Cancel active download
   */
  cancel(taskId: string): void {
    const task = this.activeDownloads.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = 'Download cancelled';
      task.progress.status = 'Cancelled';
      this.activeDownloads.delete(taskId);
    }
  }

  /**
   * Pause download
   */
  pause(taskId: string): void {
    const task = this.activeDownloads.get(taskId);
    if (task && task.status === 'downloading') {
      task.status = 'paused';
      task.progress.status = 'Paused';
    }
  }

  /**
   * Get download statistics
   */
  getStatistics(): DownloadStatistics {
    const totalTime = Date.now() - this.startTime;
    return {
      ...this.statistics,
      totalTime,
      averageSpeed: totalTime > 0 ? (this.statistics.totalBytes * 1000) / totalTime : 0,
    };
  }

  /**
   * Clear download statistics
   */
  clearStatistics(): void {
    this.statistics = {
      totalDownloads: 0,
      totalBytes: 0,
      averageSpeed: 0,
      totalTime: 0,
      failedDownloads: 0,
      resumedDownloads: 0,
    };
    this.startTime = Date.now();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Download with retry logic
   */
  private async downloadWithRetry(task: DownloadTask, resumeByte: number): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        task.status = 'downloading';
        task.progress.status = 'Downloading';

        await this.performDownload(task, resumeByte);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        task.retries = attempt + 1;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          task.progress.status = `Retrying in ${delay}ms...`;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Perform actual download
   */
  private async performDownload(task: DownloadTask, resumeByte: number): Promise<void> {
    const headers: Record<string, string> = {};
    if (resumeByte > 0) {
      headers['Range'] = `bytes=${resumeByte}-`;
      this.statistics.resumedDownloads++;
    }

    const response = await axios({
      method: 'GET',
      url: task.url,
      responseType: 'stream',
      headers,
      timeout: this.config.timeout,
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        const totalBytes = progressEvent.total || (resumeByte > 0 ? resumeByte : 0);
        const downloadedBytes = (resumeByte + (progressEvent.loaded || 0));

        task.progress.total_bytes = totalBytes;
        task.progress.downloaded_bytes = downloadedBytes;
        task.progress.progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

        // Calculate speed
        const elapsedTime = Date.now() - this.startTime;
        task.progress.speed = elapsedTime > 0 ? (downloadedBytes * 1000) / elapsedTime : 0;

        // Calculate ETA
        if (task.progress.speed > 0) {
          const remainingBytes = totalBytes - downloadedBytes;
          task.progress.eta = remainingBytes / task.progress.speed;
        }

        // Notify callback
        const callback = this.progressCallbacks.get(task.id);
        if (callback) {
          callback(task.progress);
        }
      },
    });

    // Save to file
    const writeStream = fs.createWriteStream(task.partialPath || `${task.destination}.part`, {
      flags: resumeByte > 0 ? 'a' : 'w', // Append if resuming
    });

    await pipeline(response.data, writeStream);
  }

  /**
   * Calculate SHA256 checksum of file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data: Buffer) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });
  }

  /**
   * Get size of partial download for resume
   */
  private async getPartialDownloadSize(partialPath: string): Promise<number> {
    try {
      const stats = await fs.stat(partialPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * List all files in directory recursively
   */
  private async listFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.listFilesRecursive(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(url: string): string {
    return createHash('md5').update(url + Date.now()).digest('hex');
  }
}

// ============================================================================
// BATCH DOWNLOAD MANAGER
// ============================================================================

/**
 * Manages multiple concurrent downloads
 */
export class BatchDownloadManager {
  private downloadManager: DownloadManager;
  private maxConcurrent: number;
  private activeDownloads: Set<string>;

  constructor(config: DownloadConfig) {
    this.downloadManager = new DownloadManager(config);
    this.maxConcurrent = config.maxConcurrent;
    this.activeDownloads = new Set();
  }

  /**
   * Download multiple files concurrently
   */
  async downloadAll(
    downloads: Array<{ url: string; destination: string; checksum?: string }>
  ): Promise<DownloadProgress[]> {
    const results: DownloadProgress[] = [];
    const queue = [...downloads];

    const processDownload = async (): Promise<void> => {
      while (queue.length > 0 && this.activeDownloads.size < this.maxConcurrent) {
        const item = queue.shift()!;
        const taskId = this.downloadManager['generateTaskId'](item.url);
        this.activeDownloads.add(taskId);

        try {
          const result = await this.downloadManager.download(item.url, item.destination, {
            checksum: item.checksum,
            taskId,
          });
          results.push(result);
        } catch (error) {
          // Continue with other downloads
          console.error(`Download failed for ${item.url}:`, error);
        } finally {
          this.activeDownloads.delete(taskId);
        }
      }
    };

    // Start initial downloads
    const workers = Array.from({ length: this.maxConcurrent }, () => processDownload());

    await Promise.all(workers);

    return results;
  }

  /**
   * Get overall statistics
   */
  getStatistics(): DownloadStatistics {
    return this.downloadManager.getStatistics();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default download configuration
 */
export function createDefaultDownloadConfig(baseDir: string): DownloadConfig {
  return {
    baseURL: 'https://registry.aequor.dev',
    cacheDir: path.join(baseDir, 'cache'),
    timeout: 30000, // 30 seconds
    maxConcurrent: 3,
    chunkSize: 1024 * 1024, // 1MB
    maxRetries: 5,
    retryDelay: 1000, // 1 second
    verifyChecksum: true,
    resumeSupport: true,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
