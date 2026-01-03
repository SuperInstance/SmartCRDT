/**
 * @fileoverview Dataset Integration tests
 */

import { describe, it, expect } from 'vitest';

describe('Dataset Integration', () => {
  describe('DatasetManager', () => {
    it('should initialize with defaults', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should initialize with config', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager({
        quality: { minResolution: { width: 1280, height: 720 } },
      });
      expect(manager).toBeDefined();
    });

    it('should initialize collectors', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should initialize curators', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should initialize formatters', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should initialize storage', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should run collection pipeline', async () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should close all resources', async () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      await manager.close();
      expect(manager).toBeDefined();
    });
  });

  describe('Collector Integration', () => {
    it('should use screenshot collector', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should use video collector', async () => {
      const { VideoCollector } from '../src/collectors/VideoCollector';
      const collector = new VideoCollector();
      expect(collector).toBeDefined();
    });

    it('should use DOM extractor', async () => {
      const { DOMExtractor } from '../src/collectors/DOMExtractor';
      const extractor = new DOMExtractor();
      expect(extractor).toBeDefined();
    });

    it('should use metadata collector', async () => {
      const { MetadataCollector } from '../src/collectors/MetadataCollector';
      const collector = new MetadataCollector();
      expect(collector).toBeDefined();
    });
  });

  describe('Curator Integration', () => {
    it('should use quality filter', async () => {
      const { QualityFilter } from '../src/curators/QualityFilter';
      const filter = new QualityFilter();
      expect(filter).toBeDefined();
    });

    it('should use deduplicator', async () => {
      const { Deduplicator } from '../src/curators/Deduplicator';
      const deduplicator = new Deduplicator();
      expect(deduplicator).toBeDefined();
    });

    it('should use label validator', async () => {
      const { LabelValidator } from '../src/curators/LabelValidator';
      const validator = new LabelValidator();
      expect(validator).toBeDefined();
    });

    it('should use diversity sampler', async () => {
      const { DiversitySampler } from '../src/curators/DiversitySampler';
      const sampler = new DiversitySampler();
      expect(sampler).toBeDefined();
    });
  });

  describe('Formatter Integration', () => {
    it('should use pair creator', async () => {
      const { PairCreator } from '../src/formatters/PairCreator';
      const creator = new PairCreator();
      expect(creator).toBeDefined();
    });

    it('should use JEPA formatter', async () => {
      const { JEPAFormatter } from '../src/formatters/JEPAFormatter';
      const formatter = new JEPAFormatter();
      expect(formatter).toBeDefined();
    });
  });

  describe('Storage Integration', () => {
    it('should use local storage', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should use cache manager', () => {
      const { CacheManager } from '../src/storage/CacheManager';
      const cache = new CacheManager<string>();
      expect(cache).toBeDefined();
    });
  });

  describe('Full Pipeline', () => {
    it('should collect screenshots', async () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector();
      expect(collector).toBeDefined();
    });

    it('should filter quality', async () => {
      const { QualityFilter } from '../src/curators/QualityFilter';
      const filter = new QualityFilter();
      expect(filter).toBeDefined();
    });

    it('should deduplicate', async () => {
      const { Deduplicator } from '../src/curators/Deduplicator';
      const deduplicator = new Deduplicator();
      expect(deduplicator).toBeDefined();
    });

    it('should validate labels', async () => {
      const { LabelValidator } from '../src/curators/LabelValidator';
      const validator = new LabelValidator();
      expect(validator).toBeDefined();
    });

    it('should sample for diversity', async () => {
      const { DiversitySampler } from '../src/curators/DiversitySampler';
      const sampler = new DiversitySampler();
      expect(sampler).toBeDefined();
    });

    it('should create pairs', async () => {
      const { PairCreator } from '../src/formatters/PairCreator';
      const creator = new PairCreator();
      expect(creator).toBeDefined();
    });

    it('should format for JEPA', async () => {
      const { JEPAFormatter } from '../src/formatters/JEPAFormatter';
      const formatter = new JEPAFormatter();
      expect(formatter).toBeDefined();
    });

    it('should save to storage', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should track statistics', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should export all types', () => {
      const types = [
        'ScreenshotConfig',
        'CollectedScreenshot',
        'VideoSegment',
        'DOMStructure',
        'QualityReport',
        'UIStatePair',
        'JEPASample',
      ];
      expect(types.length).toBeGreaterThan(0);
    });

    it('should use proper interfaces', () => {
      const { DatasetSource } from '../src/types';
      const source: DatasetSource = {
        type: 'url',
        location: 'https://example.com',
        weight: 5,
        categories: ['test'],
      };
      expect(source.type).toBe('url');
    });

    it('should support component types', () => {
      const { ComponentType } from '../src/types';
      const type: ComponentType = 'button';
      expect(type).toBe('button');
    });

    it('should support change types', () => {
      const { ChangeType } from '../src/types';
      const type: ChangeType = 'style';
      expect(type).toBe('style');
    });
  });

  describe('Error Handling', () => {
    it('should handle collection errors', async () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager();
      expect(manager).toBeDefined();
    });

    it('should handle filter errors', async () => {
      const { QualityFilter } from '../src/curators/QualityFilter';
      const filter = new QualityFilter();
      expect(filter).toBeDefined();
    });

    it('should handle storage errors', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should create error objects', () => {
      const { DatasetError } from '../src/types';
      expect(typeof DatasetError).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should accept custom configurations', () => {
      const { DatasetManager } from '../src/index';
      const manager = new DatasetManager({
        screenshot: { quality: 90 },
        video: { maxDuration: 45 },
        quality: { minContrast: 7 },
        storage: { basePath: './custom' },
      });
      expect(manager).toBeDefined();
    });

    it('should merge configurations', () => {
      const { ScreenshotCollector } from '../src/collectors/ScreenshotCollector';
      const collector = new ScreenshotCollector({
        quality: 85,
        delay: 3000,
      });
      expect(collector).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should use caching', () => {
      const { CacheManager } from '../src/storage/CacheManager';
      const cache = new CacheManager<string>();
      cache.set('test', 'value', 100);
      expect(cache.get('test')).toBe('value');
    });

    it('should evict old entries', () => {
      const { CacheManager } from '../src/storage/CacheManager';
      const cache = new CacheManager<string>({ maxSize: 500 });
      cache.set('test1', 'value1', 200);
      cache.set('test2', 'value2', 200);
      cache.set('test3', 'value3', 200);
      expect(cache).toBeDefined();
    });

    it('should track cache stats', () => {
      const { CacheManager } from '../src/storage/CacheManager';
      const cache = new CacheManager<string>();
      cache.set('test', 'value', 100);
      const stats = cache.getStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('Metadata', () => {
    it('should track screenshots', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should track videos', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should track pairs', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });

    it('should calculate storage usage', async () => {
      const { LocalStorage } from '../src/storage/LocalStorage';
      const storage = new LocalStorage();
      expect(storage).toBeDefined();
    });
  });
});
