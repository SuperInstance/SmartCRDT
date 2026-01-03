/**
 * Tests for TimelineView
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimelineView } from '../src/timeline/TimelineView.js';
import type { FrameProfile } from '../src/types.js';

describe('TimelineView', () => {
  let timelineView: TimelineView;

  beforeEach(() => {
    timelineView = new TimelineView();
  });

  const createMockFrames = (): FrameProfile[] => [
    {
      frameNumber: 0,
      startTime: 0,
      endTime: 16.67,
      duration: 16.67,
      kernels: [
        {
          id: 'kernel-0',
          name: 'test-kernel-1',
          startTime: 1,
          endTime: 5,
          duration: 4_000_000,
          dispatchSize: [16, 16, 1],
        },
        {
          id: 'kernel-1',
          name: 'test-kernel-2',
          startTime: 6,
          endTime: 10,
          duration: 4_000_000,
          dispatchSize: [32, 32, 1],
        },
      ],
      allocations: [
        {
          id: 'alloc-0',
          type: 'buffer',
          size: 1024,
          usage: ['STORAGE'],
          timestamp: 2,
          freed: true,
          freeTimestamp: 8,
          lifetime: 6,
        },
      ],
      transfers: [
        {
          id: 'transfer-0',
          direction: 'host-to-device',
          size: 2048,
          startTime: 10,
          endTime: 14,
          duration: 4_000_000,
          bandwidth: 0.5,
          async: false,
        },
      ],
      metadata: {},
    },
    {
      frameNumber: 1,
      startTime: 16.67,
      endTime: 33.34,
      duration: 16.67,
      kernels: [
        {
          id: 'kernel-2',
          name: 'test-kernel-3',
          startTime: 17,
          endTime: 20,
          duration: 3_000_000,
          dispatchSize: [64, 64, 1],
        },
      ],
      allocations: [],
      transfers: [],
      metadata: {},
    },
  ];

  describe('createTimeline', () => {
    it('should create timeline from frames', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      expect(events.length).toBeGreaterThan(0);
    });

    it('should include kernel events', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const kernelEvents = events.filter((e) => e.type === 'kernel');

      expect(kernelEvents.length).toBe(3); // 2 in frame 0, 1 in frame 1
    });

    it('should include memory events', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const memoryEvents = events.filter((e) => e.type === 'memory');

      expect(memoryEvents.length).toBe(1);
    });

    it('should include transfer events', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const transferEvents = events.filter((e) => e.type === 'transfer');

      expect(transferEvents.length).toBe(1);
    });

    it('should include frame events if sync enabled', () => {
      const view = new TimelineView({ showSync: true });
      const frames = createMockFrames();
      const events = view.createTimeline(frames);

      const syncEvents = events.filter((e) => e.type === 'synchronization');

      expect(syncEvents.length).toBe(2); // One per frame
    });

    it('should respect showKernels config', () => {
      const view = new TimelineView({ showKernels: false });
      const frames = createMockFrames();
      const events = view.createTimeline(frames);

      const kernelEvents = events.filter((e) => e.type === 'kernel');

      expect(kernelEvents.length).toBe(0);
    });

    it('should respect showMemory config', () => {
      const view = new TimelineView({ showMemory: false });
      const frames = createMockFrames();
      const events = view.createTimeline(frames);

      const memoryEvents = events.filter((e) => e.type === 'memory');

      expect(memoryEvents.length).toBe(0);
    });

    it('should respect showTransfers config', () => {
      const view = new TimelineView({ showTransfers: false });
      const frames = createMockFrames();
      const events = view.createTimeline(frames);

      const transferEvents = events.filter((e) => e.type === 'transfer');

      expect(transferEvents.length).toBe(0);
    });

    it('should sort events by start time', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      for (let i = 1; i < events.length; i++) {
        expect(events[i].startTime).toBeGreaterThanOrEqual(events[i - 1].startTime);
      }
    });

    it('should populate event metadata', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const kernelEvent = events.find((e) => e.type === 'kernel');

      expect(kernelEvent?.metadata).toBeDefined();
    });
  });

  describe('aggregation', () => {
    it('should aggregate events by frame', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const aggregated = timelineView.aggregateEvents(events, 'frame');

      expect(aggregated.length).toBeGreaterThan(0);
    });

    it('should aggregate events by millisecond', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const aggregated = timelineView.aggregateEvents(events, 'millisecond');

      expect(aggregated.length).toBeGreaterThan(0);
    });

    it('should aggregate events by second', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const aggregated = timelineView.aggregateEvents(events, 'second');

      expect(aggregated.length).toBeGreaterThan(0);
    });

    it('should return events unchanged when aggregation is none', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const aggregated = timelineView.aggregateEvents(events, 'none');

      expect(aggregated.length).toBe(events.length);
    });
  });

  describe('filtering', () => {
    it('should filter events by predicate', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const kernelEvents = timelineView.filterEvents(events, (e) => e.type === 'kernel');

      expect(kernelEvents.length).toBe(3);
    });

    it('should get events by type', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const kernelEvents = timelineView.getEventsByType(events, 'kernel');

      expect(kernelEvents.length).toBe(3);
      expect(kernelEvents.every((e) => e.type === 'kernel')).toBe(true);
    });

    it('should get events by time range', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const filtered = timelineView.getEventsByTimeRange(events, 0, 20);

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((e) => e.startTime >= 0 && e.endTime <= 20)).toBe(true);
    });
  });

  describe('overlap detection', () => {
    it('should find overlapping events', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const overlaps = timelineView.findOverlappingEvents(events);

      expect(Array.isArray(overlaps)).toBe(true);
    });

    it('should detect when events do not overlap', () => {
      const events = [
        {
          type: 'kernel' as const,
          id: '1',
          name: 'kernel-1',
          startTime: 0,
          endTime: 5,
          duration: 5,
          metadata: {},
        },
        {
          type: 'kernel' as const,
          id: '2',
          name: 'kernel-2',
          startTime: 10,
          endTime: 15,
          duration: 5,
          metadata: {},
        },
      ];

      const overlaps = timelineView.findOverlappingEvents(events);

      expect(overlaps.length).toBe(0);
    });

    it('should detect when events overlap', () => {
      const events = [
        {
          type: 'kernel' as const,
          id: '1',
          name: 'kernel-1',
          startTime: 0,
          endTime: 10,
          duration: 10,
          metadata: {},
        },
        {
          type: 'kernel' as const,
          id: '2',
          name: 'kernel-2',
          startTime: 5,
          endTime: 15,
          duration: 10,
          metadata: {},
        },
      ];

      const overlaps = timelineView.findOverlappingEvents(events);

      expect(overlaps.length).toBeGreaterThan(0);
    });
  });

  describe('parallelism', () => {
    it('should calculate parallelism metrics', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);

      const parallelism = timelineView.calculateParallelism(events);

      expect(parallelism.maxConcurrentEvents).toBeGreaterThanOrEqual(0);
      expect(parallelism.avgConcurrentEvents).toBeGreaterThanOrEqual(0);
      expect(parallelism.totalParallelTime).toBeGreaterThanOrEqual(0);
      expect(parallelism.parallelismRatio).toBeGreaterThanOrEqual(0);
      expect(parallelism.parallelismRatio).toBeLessThanOrEqual(1);
    });

    it('should handle empty events', () => {
      const parallelism = timelineView.calculateParallelism([]);

      expect(parallelism.maxConcurrentEvents).toBe(0);
      expect(parallelism.avgConcurrentEvents).toBe(0);
      expect(parallelism.totalParallelTime).toBe(0);
      expect(parallelism.parallelismRatio).toBe(0);
    });
  });

  describe('export formats', () => {
    it('should export as JSON', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const json = timelineView.exportAsJSON(events);

      expect(json).toBeDefined();
      expect(json.startsWith('{')).toBe(true);

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export as HTML', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const html = timelineView.exportAsHTML(events);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
    });

    it('should export as CSV', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const csv = timelineView.exportAsCSV(events);

      expect(csv).toContain('ID,Type,Name,StartTime,EndTime,Duration,Color,Metadata');
      expect(csv.split('\n').length).toBeGreaterThan(1);
    });

    it('should accept custom HTML options', () => {
      const frames = createMockFrames();
      const events = timelineView.createTimeline(frames);
      const html = timelineView.exportAsHTML(events, {
        title: 'Custom Timeline',
        width: 800,
      });

      expect(html).toContain('Custom Timeline');
      expect(html).toContain('800');
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      timelineView.setConfig({ showKernels: false });

      expect(timelineView.getConfig().showKernels).toBe(false);
    });

    it('should get current configuration', () => {
      const config = timelineView.getConfig();

      expect(config).toBeDefined();
      expect(config.showKernels).toBeDefined();
      expect(config.showMemory).toBeDefined();
      expect(config.showTransfers).toBeDefined();
    });

    it('should use color scheme', () => {
      const view = new TimelineView({ colorScheme: 'dark' });
      const frames = createMockFrames();
      const events = view.createTimeline(frames);

      const kernelEvent = events.find((e) => e.type === 'kernel');
      expect(kernelEvent?.color).toBeDefined();
    });
  });

  describe('empty frames', () => {
    it('should handle empty frames', () => {
      const events = timelineView.createTimeline([]);

      expect(events.length).toBe(0);
    });

    it('should export empty events as HTML', () => {
      const html = timelineView.exportAsHTML([]);

      expect(html).toContain('No events to display');
    });
  });

  describe('edge cases', () => {
    it('should handle events with zero duration', () => {
      const events = [
        {
          type: 'kernel' as const,
          id: '1',
          name: 'instant-kernel',
          startTime: 10,
          endTime: 10,
          duration: 0,
          metadata: {},
        },
      ];

      const parallelism = timelineView.calculateParallelism(events);

      expect(parallelism.maxConcurrentEvents).toBeGreaterThanOrEqual(0);
    });

    it('should handle events with very long duration', () => {
      const frames = createMockFrames();
      frames[0].kernels[0].duration = 1_000_000_000_000; // Very long

      const events = timelineView.createTimeline(frames);

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle missing metadata', () => {
      const frames = createMockFrames();
      delete frames[0].kernels[0].dispatchSize;

      const events = timelineView.createTimeline(frames);

      expect(events.length).toBeGreaterThan(0);
    });
  });
});

describe('TimelineView with custom config', () => {
  it('should use vibrant color scheme', () => {
    const view = new TimelineView({ colorScheme: 'vibrant' });
    const frames: FrameProfile[] = [
      {
        frameNumber: 0,
        startTime: 0,
        endTime: 16.67,
        duration: 16.67,
        kernels: [
          {
            id: 'kernel-0',
            name: 'test-kernel',
            startTime: 1,
            endTime: 5,
            duration: 4_000_000,
            dispatchSize: [1, 1, 1],
          },
        ],
        allocations: [],
        transfers: [],
        metadata: {},
      },
    ];

    const events = view.createTimeline(frames);

    expect(events[0].color).toBeDefined();
  });
});
