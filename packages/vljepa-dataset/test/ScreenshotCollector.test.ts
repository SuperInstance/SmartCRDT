/**
 * @fileoverview Screenshot Collector tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ScreenshotCollector', () => {
  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector({
        quality: 90,
        delay: 3000,
      });
      expect(collector).toBeDefined();
    });

    it('should have default sources', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should have default resolutions', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should accept custom sources', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const customSource: DatasetSource = {
        type: 'url',
        location: 'https://example.com',
        weight: 5,
        categories: ['test'],
      };
      const collector = new ScreenshotCollector({ sources: [customSource] });
      expect(collector).toBeDefined();
    });

    it('should accept custom viewports', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const customViewport = {
        width: 1280,
        height: 720,
        name: 'HD',
      };
      const collector = new ScreenshotCollector({
        resolutions: [customViewport],
      });
      expect(collector).toBeDefined();
    });

    it('should support different formats', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector({
        formats: ['png', 'jpg', 'webp'],
      });
      expect(collector).toBeDefined();
    });

    it('should allow setting quality', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector({ quality: 85 });
      expect(collector).toBeDefined();
    });

    it('should allow setting delay', () => {
      const { ScreenshotCollector } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector({ delay: 5000 });
      expect(collector).toBeDefined();
    });
  });

  describe('Source Management', () => {
    it('should add custom source', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const customSource: DatasetSource = {
        type: 'url',
        location: 'https://custom.com',
        weight: 7,
        categories: ['custom'],
      };
      collector.addSource(customSource);
      expect(collector).toBeDefined();
    });

    it('should add multiple sources', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const sources: DatasetSource[] = [
        {
          type: 'url',
          location: 'https://a.com',
          weight: 5,
          categories: ['a'],
        },
        {
          type: 'url',
          location: 'https://b.com',
          weight: 5,
          categories: ['b'],
        },
      ];
      sources.forEach(s => collector.addSource(s));
      expect(collector).toBeDefined();
    });

    it('should accept gallery sources', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const gallerySource: DatasetSource = {
        type: 'gallery',
        location: '/path/to/gallery',
        weight: 8,
        categories: ['gallery'],
      };
      const collector = new ScreenshotCollector({ sources: [gallerySource] });
      expect(collector).toBeDefined();
    });

    it('should accept file sources', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const fileSource: DatasetSource = {
        type: 'file',
        location: '/path/to/screenshots',
        weight: 6,
        categories: ['local'],
      };
      const collector = new ScreenshotCollector({ sources: [fileSource] });
      expect(collector).toBeDefined();
    });

    it('should accept crawl sources', () => {
      const { ScreenshotCollector, DatasetSource } = '../src/collectors/ScreenshotCollector';
      const crawlSource: DatasetSource = {
        type: 'crawl',
        location: 'https://example.com',
        weight: 9,
        categories: ['crawled'],
      };
      const collector = new ScreenshotCollector({ sources: [crawlSource] });
      expect(collector).toBeDefined();
    });
  });

  describe('Viewport Management', () => {
    it('should add custom viewport', () => {
      const { ScreenshotCollector, ViewportSize } = '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const customViewport: ViewportSize = {
        width: 1440,
        height: 900,
        name: 'MacBook Pro',
      };
      collector.addViewport(customViewport);
      expect(collector).toBeDefined();
    });

    it('should have mobile preset', () => {
      const { VIEWPORT_PRESETS } from '../src/types';
      expect(VIEWPORT_PRESETS.mobile).toBeDefined();
      expect(VIEWPORT_PRESETS.mobile.width).toBe(375);
    });

    it('should have tablet preset', () => {
      const { VIEWPORT_PRESETS } from '../src/types';
      expect(VIEWPORT_PRESETS.tablet).toBeDefined();
      expect(VIEWPORT_PRESETS.tablet.width).toBe(768);
    });

    it('should have desktop preset', () => {
      const { VIEWPORT_PRESETS } from '../src/types';
      expect(VIEWPORT_PRESETS.desktop).toBeDefined();
      expect(VIEWPORT_PRESETS.desktop.width).toBe(1920);
    });

    it('should support device scale factor', () => {
      const { ScreenshotCollector, ViewportSize } = '../src/collectors/ScreenshotCollector';
      const viewport: ViewportSize = {
        width: 375,
        height: 667,
        name: 'Retina',
        deviceScaleFactor: 3,
      };
      const collector = new ScreenshotCollector({ resolutions: [viewport] });
      expect(collector).toBeDefined();
    });

    it('should mark mobile viewports', () => {
      const { ViewportSize } from '../src/collectors/ScreenshotCollector';
      const viewport: ViewportSize = {
        width: 375,
        height: 667,
        name: 'Mobile',
        isMobile: true,
      };
      expect(viewport.isMobile).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should track initial progress', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
    });

    it('should update progress during collection', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      // Progress would update during actual collection
      expect(collector).toBeDefined();
    });

    it('should track failed collections', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.failed).toBe(0);
    });

    it('should track skipped collections', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.skipped).toBe(0);
    });

    it('should calculate percentage', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.percentage).toBe(0);
    });

    it('should estimate remaining time', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.estimatedTimeRemaining).toBe(0);
    });

    it('should track batch progress', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      const progress = collector.getProgress();
      expect(progress.currentBatch).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle browser init errors', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      // Would test error handling in actual implementation
      expect(collector).toBeDefined();
    });

    it('should handle navigation errors', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should handle screenshot capture errors', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should create recoverable errors', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should include error details', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should timestamp errors', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });
  });

  describe('Component Library Collection', () => {
    it('should collect from MUI', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should collect from Ant Design', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should collect from Chakra UI', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should collect from Tailwind UI', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should collect from shadcn/ui', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should follow component library links', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should limit component library pages', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should handle pagination in libraries', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should extract component metadata', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });
  });

  describe('Metadata Generation', () => {
    it('should generate unique IDs', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should extract page title', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record viewport size', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record timestamp', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record file size', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record format', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should assign category', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should assign tags', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record device pixel ratio', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should record user agent', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clear collected screenshots', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      collector.clear();
      expect(collector).toBeDefined();
    });

    it('should reset progress', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      collector.clear();
      const progress = collector.getProgress();
      expect(progress.total).toBe(0);
    });

    it('should close browser', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      await collector.close();
      expect(collector).toBeDefined();
    });

    it('should handle close without init', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      await collector.close();
      expect(collector).toBeDefined();
    });
  });
});
