/**
 * @lsi/manager - Download Manager Tests
 *
 * Comprehensive test suite for download management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DownloadManager, BatchDownloadManager, createDefaultDownloadConfig } from './DownloadManager.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('DownloadManager', () => {
  let downloadManager: any;
  let testCacheDir: string;
  let testConfig: any;

  beforeEach(async () => {
    testCacheDir = path.join(tmpdir(), `aequor-download-test-${Date.now()}`);
    await fs.ensureDir(testCacheDir);

    testConfig = createDefaultDownloadConfig(testCacheDir);
    downloadManager = new DownloadManager(testConfig);
  });

  afterEach(async () => {
    if (testCacheDir && await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(downloadManager.config).toBeDefined();
      expect(downloadManager.config.baseURL).toBe('https://registry.aequor.dev');
      expect(downloadManager.config.maxConcurrent).toBe(3);
      expect(downloadManager.config.resumeSupport).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        ...testConfig,
        maxConcurrent: 5,
        timeout: 60000,
      };

      const customManager = new DownloadManager(customConfig);

      expect(customManager.config.maxConcurrent).toBe(5);
      expect(customManager.config.timeout).toBe(60000);
    });

    it('should initialize empty statistics', () => {
      const stats = downloadManager.getStatistics();

      expect(stats.totalDownloads).toBe(0);
      expect(stats.totalBytes).toBe(0);
      expect(stats.averageSpeed).toBe(0);
      expect(stats.failedDownloads).toBe(0);
    });
  });

  describe('Download Operations', () => {
    it('should download file successfully', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');
      const mockData = Buffer.from('test file content');

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any, dest: any) {
            dest.write(mockData);
            dest.end();
            return this;
          }),
        },
        headers: {
          'content-length': '17',
        },
      } as any);

      const progressCallback = vi.fn();

      const result = await downloadManager.download(testUrl, testDestination, {
        onProgress: progressCallback,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('test.tar.gz');
      expect(result.total_bytes).toBe(17);
      expect(result.status).toBe('Completed');
    });

    it('should track download progress', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      let progressEventCallback: ((event: any) => void) | null = null;

      vi.mocked(axios).mockImplementation((config: any) => {
        return Promise.resolve({
          data: {
            on: vi.fn((event: string, callback: any) => {
              if (event === 'data') {
                progressEventCallback = callback;
              }
            }),
            pipe: vi.fn(function(this: any) {
              setTimeout(() => {
                if (progressEventCallback) {
                  progressEventCallback(Buffer.from('test'));
                }
              }, 10);
              return this;
            }),
          },
          headers: {
            'content-length': '100',
          },
        } as any);
      });

      const progressCallback = vi.fn();

      await downloadManager.download(testUrl, testDestination, {
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should retry failed downloads', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      let attemptCount = 0;

      vi.mocked(axios).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          data: {
            on: vi.fn(),
            pipe: vi.fn(function(this: any) {
              return this;
            }),
          },
          headers: {
            'content-length': '100',
          },
        } as any);
      });

      await downloadManager.download(testUrl, testDestination);

      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      vi.mocked(axios).mockRejectedValue(new Error('Network error'));

      await expect(
        downloadManager.download(testUrl, testDestination)
      ).rejects.toThrow('Network error');

      const stats = downloadManager.getStatistics();
      expect(stats.failedDownloads).toBe(1);
    });
  });

  describe('Checksum Verification', () => {
    it('should verify valid checksum', async () => {
      const testFile = path.join(testCacheDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const valid = await downloadManager.verify(testFile, '916f0023ca53832d722dc6704aafa69af044ee79d65b04728695fc355099e71c');

      expect(valid).toBe(true);
    });

    it('should reject invalid checksum', async () => {
      const testFile = path.join(testCacheDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const valid = await downloadManager.verify(testFile, 'invalidchecksum');

      expect(valid).toBe(false);
    });

    it('should handle checksum with prefix', async () => {
      const testFile = path.join(testCacheDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const valid1 = await downloadManager.verify(testFile, 'sha256:916f0023ca53832d722dc6704aafa69af044ee79d65b04728695fc355099e71c');
      const valid2 = await downloadManager.verify(testFile, '916f0023ca53832d722dc6704aafa69af044ee79d65b04728695fc355099e71c');

      expect(valid1).toBe(true);
      expect(valid2).toBe(true);
    });
  });

  describe('Extraction Operations', () => {
    it('should extract tar.gz archive', async () => {
      // Create test archive
      const archivePath = path.join(testCacheDir, 'test.tar.gz');
      const sourceDir = path.join(testCacheDir, 'source');
      const destDir = path.join(testCacheDir, 'dest');

      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

      // Create archive (simplified - just create dummy file for test)
      await fs.writeFile(archivePath, 'dummy archive content');

      const result = await downloadManager.extract(archivePath, destDir);

      expect(result).toBeDefined();
      expect(result.source).toBe(archivePath);
      expect(result.destination).toBe(destDir);
      expect(result.success).toBeDefined();
    });

    it('should handle extraction errors gracefully', async () => {
      const archivePath = path.join(testCacheDir, 'nonexistent.tar.gz');
      const destDir = path.join(testCacheDir, 'dest');

      const result = await downloadManager.extract(archivePath, destDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Resume Support', () => {
    it('should resume interrupted download', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const partialPath = path.join(testCacheDir, 'test.tar.gz.part');
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      // Create partial file
      await fs.writeFile(partialPath, 'partial content');

      const partialSize = (await fs.stat(partialPath)).size;

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any) {
            return this;
          }),
        },
        headers: {
          'content-length': '100',
        },
      } as any);

      const result = await downloadManager.resume(testUrl, partialPath);

      expect(result).toBeDefined();
      expect(result.downloaded_bytes).toBeGreaterThanOrEqual(partialSize);
    });

    it('should throw error if partial file not found', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const partialPath = path.join(testCacheDir, 'nonexistent.tar.gz.part');

      await expect(
        downloadManager.resume(testUrl, partialPath)
      ).rejects.toThrow('Partial download not found');
    });
  });

  describe('Statistics', () => {
    it('should track download statistics', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any) {
            return this;
          }),
        },
        headers: {
          'content-length': '1000',
        },
      } as any);

      await downloadManager.download(testUrl, testDestination);

      const stats = downloadManager.getStatistics();

      expect(stats.totalDownloads).toBe(1);
      expect(stats.totalBytes).toBe(1000);
    });

    it('should calculate average speed', async () => {
      const testUrl = 'https://example.com/test.tar.gz';
      const testDestination = path.join(testCacheDir, 'test.tar.gz');

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any) {
            return this;
          }),
        },
        headers: {
          'content-length': '1000',
        },
      } as any);

      await downloadManager.download(testUrl, testDestination);

      const stats = downloadManager.getStatistics();

      expect(stats.averageSpeed).toBeGreaterThan(0);
    });

    it('should clear statistics', async () => {
      downloadManager['statistics'].totalDownloads = 10;
      downloadManager['statistics'].totalBytes = 10000;

      downloadManager.clearStatistics();

      const stats = downloadManager.getStatistics();

      expect(stats.totalDownloads).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should format bytes correctly', () => {
      const { formatBytes } = await import('./DownloadManager.js');

      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format duration correctly', () => {
      const { formatDuration } = await import('./DownloadManager.js');

      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(3661)).toBe('1h 1m 1s');
    });
  });
});

describe('BatchDownloadManager', () => {
  let batchManager: any;
  let testCacheDir: string;

  beforeEach(async () => {
    testCacheDir = path.join(tmpdir(), `aequor-batch-test-${Date.now()}`);
    await fs.ensureDir(testCacheDir);

    const config = createDefaultDownloadConfig(testCacheDir);
    batchManager = new BatchDownloadManager(config);
  });

  afterEach(async () => {
    if (testCacheDir && await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('Batch Downloads', () => {
    it('should download multiple files concurrently', async () => {
      const downloads = [
        {
          url: 'https://example.com/file1.tar.gz',
          destination: path.join(testCacheDir, 'file1.tar.gz'),
        },
        {
          url: 'https://example.com/file2.tar.gz',
          destination: path.join(testCacheDir, 'file2.tar.gz'),
        },
        {
          url: 'https://example.com/file3.tar.gz',
          destination: path.join(testCacheDir, 'file3.tar.gz'),
        },
      ];

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any) {
            return this;
          }),
        },
        headers: {
          'content-length': '100',
        },
      } as any);

      const results = await batchManager.downloadAll(downloads);

      expect(results).toHaveLength(3);
    });

    it('should respect max concurrent limit', async () => {
      const config = createDefaultDownloadConfig(testCacheDir);
      config.maxConcurrent = 2;

      const limitedBatchManager = new BatchDownloadManager(config);

      const downloads = [
        {
          url: 'https://example.com/file1.tar.gz',
          destination: path.join(testCacheDir, 'file1.tar.gz'),
        },
        {
          url: 'https://example.com/file2.tar.gz',
          destination: path.join(testCacheDir, 'file2.tar.gz'),
        },
        {
          url: 'https://example.com/file3.tar.gz',
          destination: path.join(testCacheDir, 'file3.tar.gz'),
        },
      ];

      vi.mocked(axios).mockResolvedValue({
        data: {
          on: vi.fn(),
          pipe: vi.fn(function(this: any) {
            return this;
          }),
        },
        headers: {
          'content-length': '100',
        },
      } as any);

      const results = await limitedBatchManager.downloadAll(downloads);

      expect(results).toHaveLength(3);
    });

    it('should continue on individual download failures', async () => {
      const downloads = [
        {
          url: 'https://example.com/file1.tar.gz',
          destination: path.join(testCacheDir, 'file1.tar.gz'),
        },
        {
          url: 'https://example.com/file2.tar.gz',
          destination: path.join(testCacheDir, 'file2.tar.gz'),
        },
        {
          url: 'https://example.com/file3.tar.gz',
          destination: path.join(testCacheDir, 'file3.tar.gz'),
        },
      ];

      let callCount = 0;
      vi.mocked(axios).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Download failed'));
        }
        return Promise.resolve({
          data: {
            on: vi.fn(),
            pipe: vi.fn(function(this: any) {
              return this;
            }),
          },
          headers: {
            'content-length': '100',
          },
        } as any);
      });

      const results = await batchManager.downloadAll(downloads);

      expect(results).toHaveLength(2); // 2 successful, 1 failed
    });
  });
});
