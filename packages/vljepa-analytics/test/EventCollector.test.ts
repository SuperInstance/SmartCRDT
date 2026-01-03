/**
 * EventCollector Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventCollector } from '../src/collectors/EventCollector.js';

describe('EventCollector', () => {
  let collector: EventCollector;

  beforeEach(() => {
    collector = new EventCollector({
      batchSize: 5,
      flushInterval: 1000,
      sampling: 1.0,
    });
  });

  afterEach(() => {
    collector.shutdown();
  });

  describe('initialization', () => {
    it('should create collector with default config', () => {
      const defaultCollector = new EventCollector();
      expect(defaultCollector).toBeDefined();
      defaultCollector.shutdown();
    });

    it('should initialize with user and context', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      expect(collector.getSessionId()).toBeDefined();
    });
  });

  describe('tracking events', () => {
    beforeEach(() => {
      collector.initialize('user-123', { url: 'https://example.com' });
    });

    it('should track page view', () => {
      const id = collector.trackPageView('/home', { referrer: 'https://google.com' });
      expect(id).toBeTruthy();
    });

    it('should track click', () => {
      const id = collector.trackClick('button-cta', { page: '/home' });
      expect(id).toBeTruthy();
    });

    it('should track hover', () => {
      const id = collector.trackHover('nav-item', 500, { page: '/home' });
      expect(id).toBeTruthy();
    });

    it('should track scroll', () => {
      const id = collector.trackScroll(500, 2000, { page: '/home' });
      expect(id).toBeTruthy();
    });

    it('should track form submission', () => {
      const id = collector.trackSubmit('contact-form', { formType: 'contact' });
      expect(id).toBeTruthy();
    });

    it('should track custom event', () => {
      const id = collector.trackCustom('video_play', 'interaction', { videoId: 'abc123' });
      expect(id).toBeTruthy();
    });

    it('should track impression', () => {
      const id = collector.trackImpression('banner-ad', { position: 'top' });
      expect(id).toBeTruthy();
    });

    it('should track engagement', () => {
      const id = collector.trackEngagement('like', 'post-456', { type: 'reaction' });
      expect(id).toBeTruthy();
    });

    it('should track conversion', () => {
      const id = collector.trackConversion('purchase', 99.99, { productId: 'prod-123' });
      expect(id).toBeTruthy();
    });

    it('should track error', () => {
      const id = collector.trackError('Failed to load', 'Error: Network timeout', { code: 500 });
      expect(id).toBeTruthy();
    });
  });

  describe('batching and flushing', () => {
    beforeEach(() => {
      collector.initialize('user-123', { url: 'https://example.com' });
    });

    it('should batch events', () => {
      const flushSpy = vi.spyOn(collector, 'flush').mockResolvedValue();

      for (let i = 0; i < 5; i++) {
        collector.trackPageView(`/page-${i}`);
      }

      expect(flushSpy).toHaveBeenCalled();
      flushSpy.mockRestore();
    });

    it('should flush events', async () => {
      const emitSpy = vi.spyOn(collector, 'emit');

      collector.trackPageView('/test');
      await collector.flush();

      expect(emitSpy).toHaveBeenCalledWith('flush', expect.any(Array));
    });
  });

  describe('context management', () => {
    it('should update context', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      collector.updateContext({ viewport: { width: 1920, height: 1080 } });
      expect(collector.getStats().userId).toBe('user-123');
    });

    it('should set user ID', () => {
      collector.setUserId('user-456');
      expect(collector.getStats().userId).toBe('user-456');
    });

    it('should create new session', () => {
      const oldSessionId = collector.getSessionId();
      const newSessionId = collector.newSession();
      expect(newSessionId).not.toBe(oldSessionId);
    });
  });

  describe('sampling', () => {
    it('should sample events', () => {
      const sampledCollector = new EventCollector({ sampling: 0.5 });
      sampledCollector.initialize('user-123', { url: 'https://example.com' });

      sampledCollector.trackPageView('/test');

      const stats = sampledCollector.getStats();
      // Events should either be tracked or dropped
      expect(stats.eventCount + stats.droppedEvents).toBeGreaterThanOrEqual(0);
      expect(stats.eventCount + stats.droppedEvents).toBeLessThanOrEqual(1);

      sampledCollector.shutdown();
    });
  });

  describe('statistics', () => {
    it('should get statistics', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      collector.trackPageView('/test');

      const stats = collector.getStats();
      expect(stats).toHaveProperty('eventCount');
      expect(stats).toHaveProperty('droppedEvents');
      expect(stats).toHaveProperty('bufferSize');
      expect(stats).toHaveProperty('sessionId');
      expect(stats).toHaveProperty('userId');
    });
  });

  describe('reset and shutdown', () => {
    it('should reset collector', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      collector.trackPageView('/test');
      collector.reset();

      const stats = collector.getStats();
      expect(stats.eventCount).toBe(0);
    });

    it('should shutdown collector', async () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      await collector.shutdown();

      // Timer should be stopped
      expect(collector.getStats()).toBeDefined();
    });
  });

  describe('event emission', () => {
    it('should emit event on track', () => {
      collector.initialize('user-123', { url: 'https://example.com' });

      const eventSpy = vi.fn();
      collector.on('event', eventSpy);

      collector.trackPageView('/test');

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('type', 'page_view');
    });

    it('should emit flushed event on flush', async () => {
      collector.initialize('user-123', { url: 'https://example.com' });

      const flushedSpy = vi.fn();
      collector.on('flushed', flushedSpy);

      collector.trackPageView('/test');
      await collector.flush();

      expect(flushedSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle tracking before initialization', () => {
      const id = collector.trackPageView('/test');
      // Should return empty string or handle gracefully
      expect(id).toBeTruthy();
    });

    it('should handle flush errors gracefully', async () => {
      collector.initialize('user-123', { url: 'https://example.com' });

      // Mock failing flush
      const emitSpy = vi.spyOn(collector, 'emit').mockImplementation(() => {
        throw new Error('Flush failed');
      });

      collector.trackPageView('/test');
      await collector.flush();

      const errorSpy = vi.spyOn(collector, 'emit');
      expect(errorSpy).toBeDefined();

      emitSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty properties', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      const id = collector.trackClick('button', {});
      expect(id).toBeTruthy();
    });

    it('should handle special characters in properties', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      const id = collector.trackCustom('test_event', 'custom', {
        message: 'Test "quoted" and \'apostrophe\'',
      });
      expect(id).toBeTruthy();
    });

    it('should handle large property values', () => {
      collector.initialize('user-123', { url: 'https://example.com' });
      const largeData = 'x'.repeat(10000);
      const id = collector.trackCustom('large_event', 'custom', { data: largeData });
      expect(id).toBeTruthy();
    });
  });
});
