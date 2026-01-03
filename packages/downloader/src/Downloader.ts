import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import * as https from 'https';
import {
  DownloadOptions,
  DownloadProgress,
  DownloadResult,
  DownloadError,
  ChecksumError,
  ExtractionError,
} from './types.js';
import { withRetry } from './retry.js';
import { ProgressBar } from './progress.js';
import { DownloadCache } from './Cache.js';

/**
 * Component Downloader with resume support and progress tracking
 */
export class Downloader {
  private cache: DownloadCache;
  private defaultOptions: DownloadOptions;

  constructor(cache?: DownloadCache, defaultOptions: DownloadOptions = {}) {
    this.cache = cache || new DownloadCache();
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      resume: true,
      verifyChecksum: true,
      extract: false,
      deleteAfterExtract: false,
      chunks: 1,
      ...defaultOptions,
    };
  }

  /**
   * Download component from URL
   */
  async download(
    url: string,
    destination: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const component = this.extractComponentName(url);
    const version = this.extractVersion(url);

    // Check cache first
    if (this.cache.has(component, version)) {
      const cached = this.cache.get(component, version);
      if (cached) {
        console.log(`Using cached ${component}@${version}`);
        return cached;
      }
    }

    // Create destination directory
    mkdirSync(dirname(destination), { recursive: true });

    // Progress tracking
    const progressBar = opts.onProgress
      ? null
      : new ProgressBar({ format: 'BAR' as any });

    // Download with retry
    const result = await withRetry(
      async () => {
        return this.doDownload(
          url,
          destination,
          component,
          version,
          opts,
          progressBar
        );
      },
      {
        maxRetries: opts.retries || 3,
        retryableErrors: [408, 429, 500, 502, 503, 504],
      }
    );

    // Verify checksum if requested
    if (opts.verifyChecksum && opts.expectedChecksum) {
      const verified = await this.verify(result.path, opts.expectedChecksum);
      if (!verified) {
        await fs.unlink(result.path);
        throw new ChecksumError(
          `Checksum verification failed for ${result.path}`,
          opts.expectedChecksum,
          await this.checksum(result.path)
        );
      }
    }

    // Extract if requested
    if (opts.extract) {
      await this.extract(result.path, dirname(destination));

      if (opts.deleteAfterExtract) {
        await fs.unlink(result.path);
      }
    }

    // Add to cache
    await this.cache.set(component, version, result.path);

    if (progressBar) {
      progressBar.stop();
    }

    return result.path;
  }

  /**
   * Resume interrupted download
   */
  async resume(
    url: string,
    partial: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options, resume: true };
    return this.download(url, partial, opts);
  }

  /**
   * Verify file checksum
   */
  async verify(file: string, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.checksum(file);
    return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
  }

  /**
   * Extract archive (placeholder - requires external packages)
   */
  async extract(archive: string, destination: string): Promise<void> {
    mkdirSync(destination, { recursive: true });

    const ext = this.getExtension(archive);

    // For now, just create a placeholder
    // Real extraction would require extract-zip and tar packages
    if (!ext.match(/\.(tar|tgz|zip|gz)$/)) {
      throw new ExtractionError(
        `Unsupported archive format: ${ext}`,
        archive
      );
    }

    // TODO: Implement actual extraction when packages are available
    console.log(`Extraction placeholder for ${ext} archives`);
  }

  /**
   * Calculate file checksum (SHA-256)
   */
  async checksum(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(file);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Download multiple files concurrently
   */
  async downloadMultiple(
    downloads: Array<{ url: string; destination: string; options?: DownloadOptions }>
  ): Promise<string[]> {
    // Simple concurrent downloads without p-limit
    const tasks = downloads.map(({ url, destination, options }) =>
      this.download(url, destination, options)
    );

    return Promise.all(tasks);
  }

  /**
   * Internal download implementation using Node.js https
   */
  private async doDownload(
    url: string,
    destination: string,
    component: string,
    version: string,
    options: DownloadOptions,
    progressBar: ProgressBar | null
  ): Promise<DownloadResult> {
    const startTime = Date.now();
    let downloadedBytes = 0;
    let totalBytes = 0;

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestOptions = {
        method: 'GET',
        timeout: options.timeout || 30000,
      };

      const req = https.request(urlObj, requestOptions, (response: any) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.doDownload(redirectUrl, destination, component, version, options, progressBar)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        // Handle errors
        if (response.statusCode !== 200) {
          reject(new DownloadError(`HTTP ${response.statusCode}`, response.statusCode.toString()));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        const writeStream = createWriteStream(destination);

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;

          const now = Date.now();
          if (now - startTime > 100) {
            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
            const remainingBytes = totalBytes - downloadedBytes;
            const eta = speed > 0 ? remainingBytes / speed : 0;
            const percentage = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

            const progressData: DownloadProgress = {
              component,
              version,
              downloaded: downloadedBytes,
              total: totalBytes,
              percentage,
              speed,
              eta,
            };

            if (options.onProgress) {
              options.onProgress(progressData);
            } else if (progressBar) {
              progressBar.update(progressData);
            }
          }
        });

        response.pipe(writeStream);

        writeStream.on('finish', async () => {
          const duration = Date.now() - startTime;
          const fileSize = await this.getFileSize(destination);
          const averageSpeed = duration > 0 ? (fileSize * 1000) / duration : 0;

          resolve({
            path: destination,
            size: fileSize,
            checksum: await this.checksum(destination),
            resumed: false,
            duration,
            averageSpeed,
          });
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      });

      req.on('error', (err: any) => {
        reject(new DownloadError(err.message, 'NETWORK_ERROR', err));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new DownloadError('Download timeout', 'TIMEOUT'));
      });

      req.setTimeout(options.timeout || 30000);
      req.end();
    });
  }

  /**
   * Download in chunks (for large files)
   */
  private async downloadInChunks(
    url: string,
    destination: string,
    component: string,
    version: string,
    options: DownloadOptions,
    progressBar: ProgressBar | null
  ): Promise<DownloadResult> {
    const chunks = options.chunks || 1;
    if (chunks <= 1) {
      return this.doDownload(url, destination, component, version, options, progressBar);
    }

    // For now, just do a regular download
    // Chunked download requires HTTP range support which not all servers support
    return this.doDownload(url, destination, component, version, options, progressBar);
  }

  /**
   * Get file size
   */
  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Check if file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Extract component name from URL
   */
  private extractComponentName(url: string): string {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    return basename(filename, this.getExtension(filename));
  }

  /**
   * Extract version from URL
   */
  private extractVersion(url: string): string {
    const match = url.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '0.0.0';
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const ext = filename.match(/\.(tar\.gz|tgz|tar|zip|gz)$/);
    return ext ? `.${ext[1]}` : '';
  }

  /**
   * Initialize cache
   */
  async initializeCache(): Promise<void> {
    await this.cache.initialize();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}
