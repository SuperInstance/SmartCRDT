/**
 * Tests for TelemetryCollector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelemetryCollector } from './TelemetryCollector.js';
import type { TelemetryEntry } from './types.js';
import { promises as fs } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';

describe('TelemetryCollector', () => {
  const testDataDir = join(process.cwd(), 'test-data-telemetry');
  let collector: TelemetryCollector;

  beforeEach(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
    collector = new TelemetryCollector({
      dataDir: testDataDir,
      maxMemoryEntries: 10,
      flushInterval: 100,
    });
    await collector.start();
  });

  afterEach(async () => {
    await collector.stop();
    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('recording', () => {
    it('should record entry successfully', async () => {
      const entry: TelemetryEntry = {
        timestamp: Date.now(),
        query: 'test query',
        route: 'local',
        complexity: 0.5,
        latency: 100,
        success: true,
        cached: false,
      };

      await collector.record(entry);

      const stats = await collector.getStats();
      expect(stats.bufferEntries).toBe(1);
    });

    it('should record multiple entries', async () => {
      for (let i = 0; i < 5; i++) {
        const entry: TelemetryEntry = {
          timestamp: Date.now(),
          query: `query ${i}`,
          route: 'local',
          complexity: 0.5,
          latency: 100,
          success: true,
          cached: false,
        };

        await collector.record(entry);
      }

      const stats = await collector.getStats();
      expect(stats.bufferEntries).toBe(5);
    });

    it('should flush when buffer is full', async () => {
      const maxEntries = 10;

      for (let i = 0; i < maxEntries + 1; i++) {
        const entry: TelemetryEntry = {
          timestamp: Date.now(),
          query: `query ${i}`,
          route: 'local',
          complexity: 0.5,
          latency: 100,
          success: true,
          cached: false,
        };

        await collector.record(entry);
      }

      const stats = await collector.getStats();
      // Buffer should be flushed, leaving only 1 entry
      expect(stats.bufferEntries).toBeLessThanOrEqual(1);
    });
  });

  describe('retrieval', () => {
    it('should get recent entries', async () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        const entry: TelemetryEntry = {
          timestamp: now - i * 1000,
          query: `query ${i}`,
          route: 'local',
          complexity: 0.5,
          latency: 100,
          success: true,
          cached: false,
        };

        await collector.record(entry);
      }

      const recent = await collector.getRecent(3000); // Last 3 seconds
      expect(recent.length).toBe(3);
    });

    it('should return empty array when no entries', async () => {
      const recent = await collector.getRecent(1000);
      expect(recent).toEqual([]);
    });
  });

  describe('statistics', () => {
    it('should get statistics', async () => {
      const stats = await collector.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBeDefined();
      expect(stats.bufferEntries).toBeDefined();
      expect(stats.diskEntries).toBeDefined();
    });

    it('should track entries correctly', async () => {
      const initialStats = await collector.getStats();

      const entry: TelemetryEntry = {
        timestamp: Date.now(),
        query: 'test',
        route: 'local',
        complexity: 0.5,
        latency: 100,
        success: true,
        cached: false,
      };

      await collector.record(entry);

      const newStats = await collector.getStats();
      expect(newStats.bufferEntries).toBe(initialStats.bufferEntries + 1);
    });
  });

  describe('pruning', () => {
    it('should prune old entries', async () => {
      // Create entries in old file
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const telemetryDir = join(testDataDir, 'telemetry');
      await fs.mkdir(telemetryDir, { recursive: true });

      const oldFile = join(
        telemetryDir,
        `${oldDate.toISOString().split('T')[0]}.jsonl`
      );

      await fs.writeFile(oldFile, JSON.stringify({
        timestamp: oldDate.getTime(),
        query: 'old query',
        route: 'local',
        complexity: 0.5,
        latency: 100,
        success: true,
        cached: false,
      }) + '\n');

      // Prune entries older than 5 days
      const deleted = await collector.prune(5);

      expect(deleted).toBe(1);

      // Old file should be deleted
      const exists = await fs.access(oldFile).then(() => true, () => false);
      expect(exists).toBe(false);
    });
  });

  describe('clearing', () => {
    it('should clear all data', async () => {
      // Add some entries
      for (let i = 0; i < 5; i++) {
        const entry: TelemetryEntry = {
          timestamp: Date.now(),
          query: `query ${i}`,
          route: 'local',
          complexity: 0.5,
          latency: 100,
          success: true,
          cached: false,
        };

        await collector.record(entry);
      }

      // Clear data
      await collector.clear();

      const stats = await collector.getStats();
      expect(stats.bufferEntries).toBe(0);
      expect(stats.diskEntries).toBe(0);
    });
  });

  describe('query hashing', () => {
    it('should hash queries when enabled', async () => {
      const collectorWithHashing = new TelemetryCollector({
        dataDir: testDataDir,
        hashQueries: true,
      });

      await collectorWithHashing.start();

      try {
        const entry: TelemetryEntry = {
          timestamp: Date.now(),
          query: 'sensitive query',
          route: 'local',
          complexity: 0.5,
          latency: 100,
          success: true,
          cached: false,
        };

        await collectorWithHashing.record(entry);

        const recent = await collectorWithHashing.getRecent(1000);
        expect(recent[0].query).toMatch(/^hash:/);
        expect(recent[0].query).not.toBe('sensitive query');
      } finally {
        await collectorWithHashing.stop();
      }
    });
  });
});
