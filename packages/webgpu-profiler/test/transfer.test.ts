/**
 * Tests for TransferProfiler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TransferProfiler } from '../src/transfer/TransferProfiler.js';

describe('TransferProfiler', () => {
  let profiler: TransferProfiler;

  beforeEach(() => {
    profiler = new TransferProfiler();
  });

  describe('transfer tracking', () => {
    it('should begin and complete transfer', () => {
      const id = profiler.beginTransfer(1024 * 1024, 'host-to-device');
      expect(id).toMatch(/^transfer-\d+$/);

      const bandwidth = profiler.completeTransfer(id);
      expect(bandwidth).toBeGreaterThan(0);
    });

    it('should throw on complete without begin', () => {
      expect(() => profiler.completeTransfer('nonexistent')).toThrow('No active transfer found');
    });

    it('should record multiple transfers', () => {
      const id1 = profiler.beginTransfer(512, 'host-to-device');
      profiler.completeTransfer(id1);

      const id2 = profiler.beginTransfer(1024, 'device-to-host');
      profiler.completeTransfer(id2);

      expect(profiler.getCount()).toBe(2);
    });
  });

  describe('direction statistics', () => {
    it('should track statistics by direction', () => {
      for (let i = 0; i < 5; i++) {
        const id = profiler.beginTransfer(1024, 'host-to-device');
        profiler.completeTransfer(id);
      }

      const stats = profiler.getDirectionStats('host-to-device');

      expect(stats).toBeDefined();
      expect(stats?.count).toBe(5);
      expect(stats?.mean).toBeGreaterThan(0);
    });

    it('should return undefined for unknown direction', () => {
      const stats = profiler.getDirectionStats('host-to-device');
      expect(stats).toBeUndefined();
    });

    it('should get all direction statistics', () => {
      const id1 = profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer(id1);

      const id2 = profiler.beginTransfer(2048, 'device-to-host');
      profiler.completeTransfer(id2);

      const allStats = profiler.getAllDirectionStats();

      expect(allStats.size).toBe(2);
      expect(allStats.has('host-to-device')).toBe(true);
      expect(allStats.has('device-to-host')).toBe(true);
    });
  });

  describe('bandwidth analysis', () => {
    it('should analyze bandwidth by size', () => {
      for (let i = 0; i < 10; i++) {
        const size = (i + 1) * 1024;
        const id = profiler.beginTransfer(size, 'host-to-device');
        profiler.completeTransfer(id);
      }

      const buckets = profiler.analyzeBandwidthBySize(5);

      expect(buckets.length).toBe(5);
      for (const bucket of buckets) {
        expect(bucket.minSize).toBeLessThanOrEqual(bucket.maxSize);
      }
    });

    it('should get peak bandwidth', () => {
      const id1 = profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer(id1);

      const id2 = profiler.beginTransfer(2048, 'host-to-device');
      profiler.completeTransfer(id2);

      const peak = profiler.getPeakBandwidth();
      expect(peak).toBeGreaterThan(0);
    });

    it('should get peak bandwidth by direction', () => {
      const id = profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer(id);

      const peakH2D = profiler.getPeakBandwidth('host-to-device');
      const peakD2H = profiler.getPeakBandwidth('device-to-host');

      expect(peakH2D).toBeGreaterThan(0);
      expect(peakD2H).toBe(0);
    });

    it('should get average bandwidth', () => {
      for (let i = 0; i < 3; i++) {
        const id = profiler.beginTransfer(1024, 'host-to-device');
        profiler.completeTransfer(id);
      }

      const avg = profiler.getAverageBandwidth();
      expect(avg).toBeGreaterThan(0);
    });
  });

  describe('transfer metrics', () => {
    it('should get total bytes transferred', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'host-to-device');
      profiler.completeTransfer('transfer-1');

      const total = profiler.getTotalBytes();
      expect(total).toBe(3072);
    });

    it('should get total bytes by direction', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'device-to-host');
      profiler.completeTransfer('transfer-1');

      const h2d = profiler.getTotalBytes('host-to-device');
      const d2h = profiler.getTotalBytes('device-to-host');

      expect(h2d).toBe(1024);
      expect(d2h).toBe(2048);
    });

    it('should get total transfer time', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'host-to-device');
      profiler.completeTransfer('transfer-1');

      const totalTime = profiler.getTotalTransferTime();
      expect(totalTime).toBeGreaterThan(0);
    });
  });

  describe('timeline', () => {
    it('should get transfer timeline', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'device-to-host');
      profiler.completeTransfer('transfer-1');

      const timeline = profiler.getTimeline();

      expect(timeline.length).toBe(2);
      expect(timeline[0].direction).toBe('host-to-device');
      expect(timeline[1].direction).toBe('device-to-host');
    });
  });

  describe('filtered queries', () => {
    beforeEach(() => {
      profiler.beginTransfer(512, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'host-to-device');
      profiler.completeTransfer('transfer-1');

      profiler.beginTransfer(1024, 'device-to-host');
      profiler.completeTransfer('transfer-2');
    });

    it('should get transfers by size range', () => {
      const transfers = profiler.getTransfersBySize(1000, 1500);

      expect(transfers.length).toBe(1);
      expect(transfers[0].size).toBe(1024);
    });

    it('should get slowest transfers', () => {
      const slowest = profiler.getSlowestTransfers(2);

      expect(slowest.length).toBe(2);
      expect(slowest[0].duration).toBeGreaterThanOrEqual(slowest[1].duration);
    });

    it('should get fastest transfers', () => {
      const fastest = profiler.getFastestTransfers(2);

      expect(fastest.length).toBe(2);
      expect(fastest[0].duration).toBeLessThanOrEqual(fastest[1].duration);
    });
  });

  describe('statistics calculations', () => {
    it('should calculate percentiles correctly', () => {
      for (let i = 0; i < 20; i++) {
        const id = profiler.beginTransfer(1024, 'host-to-device');
        profiler.completeTransfer(id);
      }

      const stats = profiler.getDirectionStats('host-to-device');
      expect(stats).toBeDefined();

      expect(stats?.percentiles.p50).toBeGreaterThan(0);
      expect(stats?.percentiles.p90).toBeGreaterThanOrEqual(stats?.percentiles.p50);
    });

    it('should calculate standard deviation', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      const stats = profiler.getDirectionStats('host-to-device');
      expect(stats?.stdDev).toBe(0); // Only one sample
    });
  });

  describe('metrics', () => {
    it('should generate performance metrics', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      profiler.beginTransfer(2048, 'device-to-host');
      profiler.completeTransfer('transfer-1');

      const metrics = profiler.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);

      const bandwidthMetric = metrics.find((m) => m.name.includes('bandwidth'));
      expect(bandwidthMetric).toBeDefined();
      expect(bandwidthMetric?.type).toBe('throughput');
    });
  });

  describe('recordTransfer', () => {
    it('should record transfer directly', () => {
      profiler.recordTransfer({
        id: 'manual-1',
        direction: 'host-to-device',
        size: 1024,
        startTime: performance.now() - 10,
        endTime: performance.now(),
        duration: 10_000_000, // 10ms in nanoseconds
        bandwidth: 0.1,
        async: false,
      });

      expect(profiler.getCount()).toBe(1);

      const stats = profiler.getDirectionStats('host-to-device');
      expect(stats?.count).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      profiler.beginTransfer(1024, 'host-to-device');
      profiler.completeTransfer('transfer-0');

      expect(profiler.getCount()).toBe(1);

      profiler.clear();

      expect(profiler.getCount()).toBe(0);
    });
  });
});

describe('TransferProfiler edge cases', () => {
  it('should handle zero-size transfers', () => {
    const profiler = new TransferProfiler();

    const id = profiler.beginTransfer(0, 'host-to-device');
    const bandwidth = profiler.completeTransfer(id);

    expect(bandwidth).toBe(0);
  });

  it('should handle device-to-device transfers', () => {
    const profiler = new TransferProfiler();

    const id = profiler.beginTransfer(1024, 'device-to-device');
    const bandwidth = profiler.completeTransfer(id);

    expect(bandwidth).toBeGreaterThan(0);

    const stats = profiler.getDirectionStats('device-to-device');
    expect(stats?.count).toBe(1);
  });
});
