/**
 * EvolutionTracker Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionTracker } from '../src/tracker/EvolutionTracker.js';
import type { UIState, EvolutionEvent } from '../src/types.js';

describe('EvolutionTracker', () => {
  let tracker: EvolutionTracker;
  let mockState: UIState;

  beforeEach(() => {
    tracker = new EvolutionTracker({ autoCommit: true, maxHistorySize: 1000 });
    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click me' },
          children: [],
          styles: { backgroundColor: 'blue' }
        }
      ],
      styles: {
        css: { color: 'white' },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 100, height: 50 },
        position: {},
        children: []
      },
      behavior: {
        events: [{ event: 'click', handler: 'onClick' }],
        actions: [],
        stateMachine: undefined
      },
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        hash: 'abc123',
        author: 'test'
      }
    };
  });

  describe('initialization', () => {
    it('should create tracker with default config', () => {
      const defaultTracker = new EvolutionTracker();
      expect(defaultTracker).toBeDefined();
    });

    it('should create tracker with custom config', () => {
      const customTracker = new EvolutionTracker({
        autoCommit: false,
        maxHistorySize: 500
      });
      expect(customTracker).toBeDefined();
    });
  });

  describe('startTracking', () => {
    it('should start tracking a UI', async () => {
      await tracker.startTracking('ui1', mockState);
      const history = tracker.getHistory('ui1');

      expect(history).toBeDefined();
      expect(history?.uiId).toBe('ui1');
      expect(history?.versions).toHaveLength(1);
    });

    it('should create initial version', async () => {
      await tracker.startTracking('ui1', mockState);
      const history = tracker.getHistory('ui1');

      expect(history?.versions[0].version).toBe('1.0.0');
      expect(history?.versions[0].message).toBe('Initial commit');
    });

    it('should throw error when tracking already tracked UI', async () => {
      await tracker.startTracking('ui1', mockState);

      await expect(tracker.startTracking('ui1', mockState)).rejects.toThrow();
    });
  });

  describe('stopTracking', () => {
    it('should stop tracking a UI', async () => {
      await tracker.startTracking('ui1', mockState);
      await tracker.stopTracking('ui1');

      const history = tracker.getHistory('ui1');
      expect(history).toBeUndefined();
    });

    it('should throw error when stopping non-tracked UI', async () => {
      await expect(tracker.stopTracking('ui1')).rejects.toThrow();
    });
  });

  describe('trackChange', () => {
    it('should track UI change', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      newState.styles.css.color = 'red';

      const eventId = await tracker.trackChange('ui1', mockState, newState, {
        author: 'test',
        message: 'Changed color'
      });

      expect(eventId).toBeTruthy();
      expect(eventId).toMatch(/^evt_/);
    });

    it('should create new version on change', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      newState.styles.css.color = 'red';

      await tracker.trackChange('ui1', mockState, newState, {
        author: 'test',
        message: 'Changed color'
      });

      const history = tracker.getHistory('ui1');
      expect(history?.versions).toHaveLength(2);
    });

    it('should queue events when autoCommit is false', async () => {
      const manualTracker = new EvolutionTracker({ autoCommit: false });
      await manualTracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      newState.styles.css.color = 'red';

      await manualTracker.trackChange('ui1', mockState, newState, {
        author: 'test',
        message: 'Changed color'
      });

      const history = manualTracker.getHistory('ui1');
      expect(history?.events).toHaveLength(0); // Not committed yet
    });

    it('should throw error for non-tracked UI', async () => {
      await expect(
        tracker.trackChange('ui1', mockState, mockState, {})
      ).rejects.toThrow();
    });
  });

  describe('getHistory', () => {
    it('should return history for tracked UI', async () => {
      await tracker.startTracking('ui1', mockState);
      const history = tracker.getHistory('ui1');

      expect(history).toBeDefined();
      expect(history?.uiId).toBe('ui1');
    });

    it('should return undefined for non-tracked UI', () => {
      const history = tracker.getHistory('ui1');
      expect(history).toBeUndefined();
    });
  });

  describe('getEvents', () => {
    it('should return all events by default', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      await tracker.trackChange('ui1', mockState, newState, {
        author: 'test',
        message: 'Change 1'
      });

      const events = tracker.getEvents('ui1');
      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter events by type', async () => {
      await tracker.startTracking('ui1', mockState);
      const newState = { ...mockState };
      await tracker.trackChange('ui1', mockState, newState, {});

      const events = tracker.getEvents('ui1', { type: 'modify' });
      expect(events.every(e => e.type === 'modify')).toBe(true);
    });

    it('should filter events by author', async () => {
      await tracker.startTracking('ui1', mockState);
      const newState = { ...mockState };
      await tracker.trackChange('ui1', mockState, newState, { author: 'alice' });

      const events = tracker.getEvents('ui1', { author: 'alice' });
      expect(events.every(e => e.author === 'alice')).toBe(true);
    });

    it('should filter events by time range', async () => {
      const now = Date.now();
      await tracker.startTracking('ui1', mockState);
      const newState = { ...mockState };
      await tracker.trackChange('ui1', mockState, newState, {});

      const events = tracker.getEvents('ui1', {
        startTime: now - 1000,
        endTime: now + 1000
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should limit events', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 10; i++) {
        const newState = { ...mockState };
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const events = tracker.getEvents('ui1', { limit: 5 });
      expect(events.length).toBe(5);
    });

    it('should sort events ascending', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 3; i++) {
        const newState = { ...mockState };
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const events = tracker.getEvents('ui1', { order: 'asc' });
      expect(events[0].timestamp).toBeLessThanOrEqual(events[1].timestamp);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for tracked UI', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      await tracker.trackChange('ui1', mockState, newState, {
        author: 'alice',
        message: 'Change'
      });

      const stats = tracker.getStatistics('ui1');

      expect(stats).toBeDefined();
      expect(stats?.totalEvents).toBeGreaterThan(0);
      expect(stats?.totalVersions).toBe(2);
    });

    it('should return undefined for non-tracked UI', () => {
      const stats = tracker.getStatistics('ui1');
      expect(stats).toBeUndefined();
    });

    it('should group events by type', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 5; i++) {
        const newState = { ...mockState };
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const stats = tracker.getStatistics('ui1');
      expect(stats?.eventsByType).toBeDefined();
    });

    it('should group events by author', async () => {
      await tracker.startTracking('ui1', mockState);

      await tracker.trackChange('ui1', mockState, mockState, { author: 'alice' });
      await tracker.trackChange('ui1', mockState, mockState, { author: 'bob' });

      const stats = tracker.getStatistics('ui1');
      expect(stats?.eventsByAuthor).toHaveProperty('alice');
      expect(stats?.eventsByAuthor).toHaveProperty('bob');
    });
  });

  describe('exportHistory', () => {
    it('should export history as JSON', async () => {
      await tracker.startTracking('ui1', mockState);

      const exported = tracker.exportHistory('ui1');
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('uiId', 'ui1');
      expect(parsed).toHaveProperty('versions');
    });

    it('should throw error for non-tracked UI', () => {
      expect(() => tracker.exportHistory('ui1')).toThrow();
    });
  });

  describe('importHistory', () => {
    it('should import history from JSON', async () => {
      await tracker.startTracking('ui1', mockState);
      const exported = tracker.exportHistory('ui1');

      await tracker.stopTracking('ui1');
      tracker.importHistory(exported);

      const history = tracker.getHistory('ui1');
      expect(history).toBeDefined();
    });
  });

  describe('commitEvent', () => {
    it('should commit event to history', async () => {
      await tracker.startTracking('ui1', mockState);

      const event: EvolutionEvent = {
        id: 'evt_test',
        type: 'modify',
        timestamp: Date.now(),
        author: 'test',
        uiBefore: mockState,
        uiAfter: mockState,
        codeDiff: { additions: 0, deletions: 0, hunks: [] },
        metadata: {
          commit: 'abc123',
          branch: 'main',
          message: 'Test',
          tags: [],
          automated: false
        }
      };

      await tracker.commitEvent('ui1', event);

      const history = tracker.getHistory('ui1');
      expect(history?.events).toHaveLength(1);
    });
  });

  describe('flushQueue', () => {
    it('should flush queued events', async () => {
      const manualTracker = new EvolutionTracker({ autoCommit: false });
      await manualTracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      await manualTracker.trackChange('ui1', mockState, newState, {});

      await manualTracker.flushQueue('ui1');

      const history = manualTracker.getHistory('ui1');
      expect(history?.events.length).toBeGreaterThan(0);
    });
  });

  describe('version numbering', () => {
    it('should increment patch version for minor changes', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      newState.styles.css.color = 'red';

      await tracker.trackChange('ui1', mockState, newState, {});

      const history = tracker.getHistory('ui1');
      expect(history?.versions[1].version).toBe('1.0.1');
    });

    it('should increment minor version for major changes', async () => {
      await tracker.startTracking('ui1', mockState);

      const newState = { ...mockState };
      newState.layout.type = 'grid';

      await tracker.trackChange('ui1', mockState, newState, {});

      const history = tracker.getHistory('ui1');
      expect(history?.versions[1].version).toBe('1.1.0');
    });
  });

  describe('hash generation', () => {
    it('should generate consistent hashes for same state', async () => {
      await tracker.startTracking('ui1', mockState);

      const history = tracker.getHistory('ui1');
      const hash1 = history?.versions[0].hash;

      const hash2 = tracker['hashState'](mockState);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different states', async () => {
      const hash1 = tracker['hashState'](mockState);

      const newState = { ...mockState };
      newState.styles.css.color = 'red';
      const hash2 = tracker['hashState'](newState);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('history size limits', () => {
    it('should enforce max history size', async () => {
      const smallTracker = new EvolutionTracker({ maxHistorySize: 5 });
      await smallTracker.startTracking('ui1', mockState);

      for (let i = 0; i < 10; i++) {
        const newState = { ...mockState };
        await smallTracker.trackChange('ui1', mockState, newState, {});
      }

      const history = smallTracker.getHistory('ui1');
      expect(history?.events.length).toBeLessThanOrEqual(5);
      expect(history?.versions.length).toBeLessThanOrEqual(6); // Initial + 5 changes
    });
  });
});
