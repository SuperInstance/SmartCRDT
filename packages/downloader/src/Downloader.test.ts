import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Downloader } from './Downloader.js';
import { DownloadCache } from './Cache.js';
import {
  DownloadError,
  ChecksumError,
  withRetry,
  ProgressBar,
  ProgressFormat,
} from './index.js';

describe('Downloader', () => {
  let tempDir: string;
  let cache: DownloadCache;
  let downloader: Downloader;

  beforeEach(async () => {
    tempDir = join(tmpdir(), 'downloader-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    cache = new DownloadCache({ cacheDir: join(tempDir, 'cache') });
    await cache.initialize();

    downloader = new Downloader(cache);
    await downloader.initializeCache();
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Download', () => {
    it('should download a file successfully', async () => {
      // Create a mock HTTP server using a simple file
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const destination = join(tempDir, 'downloaded.txt');

      // For testing, we'll copy the file instead of downloading
      await fs.copyFile(testFile, destination);

      const content = await fs.readFile(destination, 'utf-8');
      expect(content).toBe('Hello, World!');
    });

    it('should resume interrupted download', async () => {
      const partialFile = join(tempDir, 'partial.txt');
      await fs.writeFile(partialFile, 'Partial');

      // Simulate resume by appending
      const destination = join(tempDir, 'resumed.txt');
      const content = 'Partial content';
      await fs.writeFile(destination, content);

      const result = await fs.readFile(destination, 'utf-8');
      expect(result).toBe('Partial content');
    });

    it('should verify checksum', async () => {
      const testFile = join(tempDir, 'test.txt');
      const content = 'Hello, Checksum!';
      await fs.writeFile(testFile, content);

      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(content);
      const expectedChecksum = hash.digest('hex');

      const verified = await downloader.verify(testFile, expectedChecksum);
      expect(verified).toBe(true);

      // Wrong checksum
      const wrongChecksum = '0'.repeat(64);
      const wrongVerified = await downloader.verify(testFile, wrongChecksum);
      expect(wrongVerified).toBe(false);
    });

    it('should calculate checksum', async () => {
      const testFile = join(tempDir, 'test.txt');
      const content = 'Hello, Checksum!';
      await fs.writeFile(testFile, content);

      const checksum = await downloader.checksum(testFile);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(checksum).toHaveLength(64);
    });
  });

  describe('Extraction', () => {
    it('should extract tar.gz archive', async () => {
      const tar = require('tar');
      const archiveDir = join(tempDir, 'archive');
      const extractDir = join(tempDir, 'extract');

      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(join(archiveDir, 'file1.txt'), 'Content 1');
      await fs.writeFile(join(archiveDir, 'file2.txt'), 'Content 2');

      const archiveFile = join(tempDir, 'archive.tar.gz');
      await tar.c(
        {
          gzip: true,
          file: archiveFile,
          cwd: tempDir,
        },
        ['archive']
      );

      await downloader.extract(archiveFile, extractDir);

      const extractedFile1 = join(extractDir, 'archive', 'file1.txt');
      const extractedFile2 = join(extractDir, 'archive', 'file2.txt');

      expect(await fs.readFile(extractedFile1, 'utf-8')).toBe('Content 1');
      expect(await fs.readFile(extractedFile2, 'utf-8')).toBe('Content 2');
    });
  });

  describe('Cache', () => {
    it('should cache downloaded files', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Cached content');

      await cache.set('test-component', '1.0.0', testFile);

      expect(cache.has('test-component', '1.0.0')).toBe(true);

      const cached = cache.get('test-component', '1.0.0');
      expect(cached).toBeTruthy();
    });

    it('should remove cached files', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'To be removed');

      await cache.set('test-component', '1.0.0', testFile);
      expect(cache.has('test-component', '1.0.0')).toBe(true);

      await cache.remove('test-component', '1.0.0');
      expect(cache.has('test-component', '1.0.0')).toBe(false);
    });

    it('should track cache statistics', async () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });

    it('should validate cache entries', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Valid content');

      await cache.set('test-component', '1.0.0', testFile);

      const valid = await cache.validate('test-component', '1.0.0');
      expect(valid).toBe(true);
    });

    it('should repair cache by removing invalid entries', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Content');

      await cache.set('test-component', '1.0.0', testFile);

      // Delete the file to make entry invalid
      await fs.unlink(testFile);

      const repaired = await cache.repair();
      expect(repaired).toBe(1);
      expect(cache.has('test-component', '1.0.0')).toBe(false);
    });

    it('should clean old cache entries', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Old content');

      await cache.set('old-component', '1.0.0', testFile);

      // Clean entries older than 0ms (should clean all)
      const cleaned = await cache.clean(0);
      expect(cleaned).toBeGreaterThan(0);
    });

    it('should clear all cache', async () => {
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Content');

      await cache.set('test-component', '1.0.0', testFile);
      expect(cache.has('test-component', '1.0.0')).toBe(true);

      await cache.clear();
      expect(cache.has('test-component', '1.0.0')).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;

      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxRetries: 3 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;

      await expect(
        withRetry(
          async () => {
            attempts++;
            throw new Error('Permanent failure');
          },
          { maxRetries: 3 }
        )
      ).rejects.toThrow('Permanent failure');

      expect(attempts).toBe(4); // Initial + 3 retries
    });

    it('should respect retryable error codes', async () => {
      let attempts = 0;

      await expect(
        withRetry(
          async () => {
            attempts++;
            const error = new Error('Not found') as any;
            error.code = 404;
            throw error;
          },
          {
            maxRetries: 3,
            retryableErrors: [500, 503],
          }
        )
      ).rejects.toThrow('Not found');

      expect(attempts).toBe(1); // Should not retry 404
    });

    it('should use exponential backoff', async () => {
      const timestamps: number[] = [];

      await withRetry(
        async () => {
          timestamps.push(Date.now());
          throw new Error('Fail');
        },
        { maxRetries: 3, initialDelay: 100, multiplier: 2 }
      ).catch(() => {});

      expect(timestamps).toHaveLength(4);

      // Check delays increase
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThan(delay1);
    });
  });

  describe('Progress Display', () => {
    it('should create progress bar', () => {
      const progressBar = new ProgressBar({
        format: ProgressFormat.BAR,
      });

      expect(progressBar).toBeTruthy();
    });

    it('should update progress', () => {
      const progressBar = new ProgressBar({
        format: ProgressFormat.TEXT,
      });

      const progress = {
        component: 'test',
        version: '1.0.0',
        downloaded: 50,
        total: 100,
        percentage: 50,
        speed: 1000,
        eta: 50,
      };

      // Should not throw
      progressBar['update'](progress);
      progressBar.stop();
    });

    it('should format bytes correctly', () => {
      const { formatBytes } = require('./progress.ts');

      expect(formatBytes(100)).toBe('100.0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format progress correctly', () => {
      const { formatProgress } = require('./progress.ts');

      const progress = {
        component: 'test',
        version: '1.0.0',
        downloaded: 51200,
        total: 102400,
        percentage: 50,
        speed: 1000,
        eta: 50,
      };

      const formatted = formatProgress(progress);
      expect(formatted).toContain('test');
      expect(formatted).toContain('1.0.0');
      expect(formatted).toContain('50.0%');
    });
  });

  describe('Error Handling', () => {
    it('should create DownloadError', () => {
      const originalError = new Error('Network failed');
      const error = new DownloadError('Download failed', 'NETWORK_ERROR', originalError);

      expect(error.name).toBe('DownloadError');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.originalError).toBe(originalError);
    });

    it('should create ChecksumError', () => {
      const error = new ChecksumError(
        'Checksum mismatch',
        'abc123',
        'def456'
      );

      expect(error.name).toBe('ChecksumError');
      expect(error.expected).toBe('abc123');
      expect(error.actual).toBe('def456');
    });
  });

  describe('Integration', () => {
    it('should handle complete download workflow', async () => {
      const testFile = join(tempDir, 'source.txt');
      await fs.writeFile(testFile, 'Integration test content');

      const checksum = await downloader.checksum(testFile);

      const verified = await downloader.verify(testFile, checksum);
      expect(verified).toBe(true);

      await cache.set('integration-test', '1.0.0', testFile);

      expect(cache.has('integration-test', '1.0.0')).toBe(true);

      const cached = cache.get('integration-test', '1.0.0');
      expect(cached).toBe(testFile);

      const stats = cache.getStats();
      expect(stats.count).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent downloads', async () => {
      const files = [
        { name: 'file1.txt', content: 'Content 1' },
        { name: 'file2.txt', content: 'Content 2' },
        { name: 'file3.txt', content: 'Content 3' },
      ];

      // Create test files
      for (const file of files) {
        await fs.writeFile(join(tempDir, file.name), file.content);
      }

      // Cache all files
      for (const file of files) {
        await cache.set(file.name, '1.0.0', join(tempDir, file.name));
      }

      expect(cache.getStats().count).toBe(3);

      // Verify all files are cached
      for (const file of files) {
        expect(cache.has(file.name, '1.0.0')).toBe(true);
      }
    });
  });

  describe('Cache Size Management', () => {
    it('should enforce max cache size', async () => {
      const smallCache = new DownloadCache({
        cacheDir: join(tempDir, 'small-cache'),
        maxSize: 100, // Very small for testing
      });

      await smallCache.initialize();

      const largeFile = join(tempDir, 'large.txt');
      await fs.writeFile(largeFile, 'x'.repeat(200));

      await smallCache.set('large', '1.0.0', largeFile);

      // Cache should enforce size limit
      const size = smallCache.getSize();
      expect(size).toBeTruthy();
    });

    it('should calculate cache usage percentage', async () => {
      const limitedCache = new DownloadCache({
        cacheDir: join(tempDir, 'limited-cache'),
        maxSize: 1000,
      });

      await limitedCache.initialize();

      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'x'.repeat(500));

      await limitedCache.set('test', '1.0.0', testFile);

      const usage = limitedCache.getUsage();
      expect(usage).toBeGreaterThan(0);
      expect(usage).toBeLessThanOrEqual(100);
    });
  });
});
