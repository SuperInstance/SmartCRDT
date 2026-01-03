/**
 * Tests for LearningEngine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LearningEngine, createLearningEngine } from './LearningEngine.js';
import type { LearningConfig, RoutingDecision, QueryOutcome } from './types.js';
import { promises as fs } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';

describe('LearningEngine', () => {
  const testDataDir = join(process.cwd(), 'test-data-learning');
  let engine: LearningEngine;

  beforeEach(async () => {
    // Create test data directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    if (engine) {
      await engine.shutdown();
    }
    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();

      const profile = engine.getProfile();
      expect(profile).not.toBeNull();
      expect(profile?.installationId).toBeDefined();
      expect(profile?.hardware).toBeDefined();
    });

    it('should load existing profile', async () => {
      // Create first instance
      engine = new LearningEngine(testDataDir);
      await engine.initialize();

      const installationId = engine.getProfile()?.installationId;

      // Create second instance with same data dir
      await engine.shutdown();
      const engine2 = new LearningEngine(testDataDir);
      await engine2.initialize();

      expect(engine2.getProfile()?.installationId).toBe(installationId);

      await engine2.shutdown();
    });
  });

  describe('query recording', () => {
    beforeEach(async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();
    });

    it('should record query successfully', async () => {
      const route: RoutingDecision = {
        destination: 'local',
        complexity: 0.5,
        confidence: 0.8,
        reason: 'Test',
      };

      const outcome: QueryOutcome = {
        latency: 100,
        success: true,
        cached: false,
        model: 'test-model',
      };

      await engine.recordQuery('test query', route, outcome);

      const stats = await engine.getStatistics();
      expect(stats.queriesInPeriod).toBeGreaterThan(0);
    });

    it('should record multiple queries', async () => {
      const route: RoutingDecision = {
        destination: 'local',
        complexity: 0.5,
        confidence: 0.8,
        reason: 'Test',
      };

      const outcome: QueryOutcome = {
        latency: 100,
        success: true,
        cached: false,
        model: 'test-model',
      };

      for (let i = 0; i < 10; i++) {
        await engine.recordQuery(`query ${i}`, route, outcome);
      }

      const stats = await engine.getStatistics();
      expect(stats.queriesInPeriod).toBe(10);
    });
  });

  describe('routing recommendations', () => {
    beforeEach(async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();
    });

    it('should return recommendation for simple query', () => {
      const recommendation = engine.getRoutingRecommendation({
        text: 'hello',
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.destination).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
    });

    it('should return recommendation for complex query', () => {
      const recommendation = engine.getRoutingRecommendation({
        text: 'Explain the theory of quantum entanglement and its implications for modern cryptography',
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.destination).toBeDefined();
    });

    it('should return recommendation with explicit complexity', () => {
      const recommendation = engine.getRoutingRecommendation({
        text: 'test',
        complexity: 0.2,
      });

      expect(recommendation).toBeDefined();
    });
  });

  describe('hardware configuration', () => {
    beforeEach(async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();
    });

    it('should return hardware config', () => {
      const config = engine.getHardwareConfig();

      expect(config).toBeDefined();
      expect(config.maxConcurrentQueries).toBeGreaterThan(0);
      expect(config.cacheSize).toBeGreaterThan(0);
      expect(config.parallelism).toBeGreaterThan(0);
      expect(config.memoryLimit).toBeGreaterThan(0);
    });

    it('should adapt to available memory', () => {
      const config = engine.getHardwareConfig();

      expect(config.maxConcurrentQueries).toBeGreaterThan(0);
      expect(config.memoryLimit).toBeLessThanOrEqual(
        config.cacheSize * 10
      );
    });
  });

  describe('user preferences', () => {
    beforeEach(async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();
    });

    it('should get default preferences', () => {
      const prefs = engine.getPreferences();

      expect(prefs.privacy).toBe(0.5);
      expect(prefs.cost).toBe(0.5);
      expect(prefs.speed).toBe(0.5);
      expect(prefs.quality).toBe(0.5);
    });

    it('should update preferences', async () => {
      await engine.updatePreferences({
        privacy: 0.9,
        cost: 0.7,
      });

      const prefs = engine.getPreferences();
      expect(prefs.privacy).toBe(0.9);
      expect(prefs.cost).toBe(0.7);
      expect(prefs.speed).toBe(0.5); // Unchanged
      expect(prefs.quality).toBe(0.5); // Unchanged
    });
  });

  describe('data management', () => {
    beforeEach(async () => {
      engine = new LearningEngine(testDataDir);
      await engine.initialize();
    });

    it('should get statistics', async () => {
      const stats = await engine.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalQueries).toBeGreaterThanOrEqual(0);
      expect(stats.profileAge).toBeGreaterThanOrEqual(0);
    });

    it('should export data', async () => {
      const data = await engine.exportData();

      expect(data).toBeDefined();
      expect(data.profile).not.toBeNull();
      expect(data.telemetry).toBeDefined();
      expect(Array.isArray(data.telemetry)).toBe(true);
    });

    it('should clear data', async () => {
      // Record some data
      const route: RoutingDecision = {
        destination: 'local',
        complexity: 0.5,
        confidence: 0.8,
        reason: 'Test',
      };

      const outcome: QueryOutcome = {
        latency: 100,
        success: true,
        cached: false,
      };

      await engine.recordQuery('test', route, outcome);

      // Clear data
      await engine.clearData();

      const stats = await engine.getStatistics();
      expect(stats.totalQueries).toBe(0);
    });
  });

  describe('learning disabled', () => {
    it('should not record queries when disabled', async () => {
      engine = new LearningEngine(testDataDir, { enabled: false });
      await engine.initialize();

      const route: RoutingDecision = {
        destination: 'local',
        complexity: 0.5,
        confidence: 0.8,
        reason: 'Test',
      };

      const outcome: QueryOutcome = {
        latency: 100,
        success: true,
        cached: false,
      };

      await engine.recordQuery('test', route, outcome);

      const stats = await engine.getStatistics();
      expect(stats.queriesInPeriod).toBe(0);
    });
  });
});

describe('createLearningEngine', () => {
  it('should create and initialize engine', async () => {
    const testDataDir = join(process.cwd(), 'test-data-learning-create');
    await fs.mkdir(testDataDir, { recursive: true });

    try {
      const engine = await createLearningEngine(testDataDir);

      expect(engine).toBeInstanceOf(LearningEngine);
      expect(engine.getProfile()).not.toBeNull();

      await engine.shutdown();
    } finally {
      await rm(testDataDir, { recursive: true, force: true });
    }
  });
});
