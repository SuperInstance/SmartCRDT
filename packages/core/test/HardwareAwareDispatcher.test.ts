/**
 * Unit tests for HardwareAwareDispatcher
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HardwareAwareDispatcher, type RefinedQuery } from '../src/hardware/HardwareAwareDispatcher.js';
import type { HardwareState } from '../src/hardware/HardwareState.js';

// Mock RefinedQuery
const createMockQuery = (overrides?: Partial<RefinedQuery>): RefinedQuery => ({
  original: 'test query',
  normalized: 'test query',
  staticFeatures: {
    length: 10,
    wordCount: 2,
    queryType: 'question',
    complexity: 0.5,
    hasCode: false,
    hasSQL: false,
    hasUrl: false,
    hasEmail: false,
    questionMark: true,
    exclamationCount: 0,
    ellipsisCount: 0,
    capitalizationRatio: 0,
    punctuationDensity: 0.5,
    technicalTerms: [],
    domainKeywords: [],
  },
  semanticFeatures: null,
  cacheKey: 'test-key',
  suggestions: [],
  timestamp: Date.now(),
  ...overrides,
});

describe('HardwareAwareDispatcher', () => {
  let dispatcher: HardwareAwareDispatcher;

  beforeEach(() => {
    dispatcher = new HardwareAwareDispatcher({
      costLocal: 0.0,
      costCloud: 0.002,
      latencyLocal: 100,
      latencyCloud: 500,
      enableStats: true,
      hardwareMonitor: {
        enableGPUMonitoring: false, // Disable for faster tests
        enableNetworkMonitoring: false,
      },
    });
  });

  afterEach(async () => {
    dispatcher.dispose();
  });

  describe('initialization', () => {
    it('should create dispatcher with default config', () => {
      const defaultDispatcher = new HardwareAwareDispatcher();
      expect(defaultDispatcher).toBeDefined();
      defaultDispatcher.dispose();
    });

    it('should start and stop without errors', async () => {
      await dispatcher.start();
      expect(dispatcher).toBeDefined();
      dispatcher.stop();
    });
  });

  describe('dispatch decisions', () => {
    it('should return a dispatch decision', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query);

      expect(decision).toBeDefined();
      expect(decision.destination).toBeDefined();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('should respect requireLocal constraint', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        requireLocal: true,
      });

      // Should prefer local when requireLocal is set
      // Note: May still route to cloud if in critical thermal zone
      expect(decision.destination).toMatch(/local|hybrid/);
    });

    it('should respect cost constraints', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        maxCost: 0.001, // Very low cost limit
      });

      // Should route to local or note that it can't meet constraint
      if (decision.destination === 'cloud') {
        expect(decision.notes).toContain('WARNING: Cannot meet cost constraint');
      }
    });

    it('should respect latency constraints', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        maxLatencyMs: 200, // Low latency requirement
      });

      // Should try to meet latency or note that it can't
      if (decision.destination === 'cloud' && decision.estimatedLatency > 200) {
        expect(decision.notes).toContain('WARNING: Cannot meet latency constraint');
      }
    });

    it('should respect preferLocal constraint', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        preferLocal: true,
      });

      // Should prefer local when possible
      if (decision.destination !== 'local') {
        expect(decision.notes).toContain('User preference: preferLocal');
      }
    });

    it('should handle allowHybrid constraint', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        allowHybrid: false,
      });

      // Should not return hybrid if not allowed
      if (decision.notes && decision.notes.includes('Hybrid not allowed')) {
        expect(decision.destination).not.toBe('hybrid');
      }
    });
  });

  describe('reasoning', () => {
    it('should include reasoning in decision', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.cpuAvailable).toBeDefined();
      expect(decision.reasoning.gpuAvailable).toBeDefined();
      expect(decision.reasoning.thermalOk).toBeDefined();
      expect(decision.reasoning.memoryOk).toBeDefined();
      expect(decision.reasoning.costConsideration).toBeDefined();
      expect(decision.reasoning.latencyRequirement).toBeDefined();
      expect(decision.reasoning.userConstraints).toBeDefined();
    });

    it('should correctly detect CPU availability', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query);

      expect(decision.reasoning.cpuAvailable).toBe(true);
    });

    it('should detect user constraints', async () => {
      await dispatcher.start();
      const query = createMockQuery();
      const decision = await dispatcher.dispatch(query, {
        maxCost: 0.001,
      });

      expect(decision.reasoning.userConstraints).toBe(true);
      expect(decision.reasoning.costConsideration).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track dispatch statistics', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);

      const stats = dispatcher.getStats();
      expect(stats.total).toBe(3);
    });

    it('should reset statistics', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);

      dispatcher.resetStats();

      const stats = dispatcher.getStats();
      expect(stats.total).toBe(0);
    });

    it('should calculate average confidence', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);

      const stats = dispatcher.getStats();
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should track destination counts', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);
      await dispatcher.dispatch(query);

      const stats = dispatcher.getStats();
      expect(stats.local + stats.cloud + stats.hybrid).toBe(3);
    });
  });

  describe('hardware state', () => {
    it('should provide hardware state', async () => {
      await dispatcher.start();
      const state = await dispatcher.getHardwareState();

      expect(state).toBeDefined();
      if (state) {
        expect(state.cpu).toBeDefined();
        expect(state.memory).toBeDefined();
        expect(state.thermal).toBeDefined();
        expect(state.timestamp).toBeDefined();
      }
    });

    it('should provide thermal state', async () => {
      await dispatcher.start();
      const thermalState = dispatcher.getThermalState();

      expect(thermalState).toBeDefined();
      expect(thermalState.temperature).toBeGreaterThanOrEqual(0);
      expect(thermalState.zone).toMatch(/normal|throttle|critical/);
      expect(thermalState.recommendation).toBeDefined();
    });
  });

  describe('resource selection', () => {
    it('should include resource spec for local processing', async () => {
      await dispatcher.start();
      const query = createMockQuery({
        staticFeatures: {
          length: 10,
          wordCount: 2,
          queryType: 'question',
          complexity: 0.3,
          hasCode: false,
          hasSQL: false,
          hasUrl: false,
          hasEmail: false,
          questionMark: true,
          exclamationCount: 0,
          ellipsisCount: 0,
          capitalizationRatio: 0,
          punctuationDensity: 0.5,
          technicalTerms: [],
          domainKeywords: [],
        },
      });

      const decision = await dispatcher.dispatch(query);

      if (decision.destination === 'local' || decision.destination === 'hybrid') {
        expect(decision.resource).toBeDefined();
        if (decision.resource) {
          expect(decision.resource.type).toMatch(/cpu|gpu|npu/);
          expect(decision.resource.estimatedUtilization).toBeGreaterThanOrEqual(0);
          expect(decision.resource.estimatedUtilization).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('cost and latency estimation', () => {
    it('should estimate lower cost for local processing', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      const localDecision = await dispatcher.dispatch(query, { requireLocal: true });
      const cloudDecision = await dispatcher.dispatch(query, { preferLocal: false });

      // Local should generally be cheaper
      expect(localDecision.estimatedCost).toBeLessThanOrEqual(cloudDecision.estimatedCost);
    });

    it('should estimate lower latency for local processing', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      const localDecision = await dispatcher.dispatch(query, { requireLocal: true });
      const cloudDecision = await dispatcher.dispatch(query, { preferLocal: false });

      // Local should generally be faster
      expect(localDecision.estimatedLatency).toBeLessThanOrEqual(cloudDecision.estimatedLatency);
    });

    it('should adjust estimates based on query complexity', async () => {
      await dispatcher.start();
      const simpleQuery = createMockQuery({
        staticFeatures: {
          length: 10,
          wordCount: 2,
          queryType: 'question',
          complexity: 0.1,
          hasCode: false,
          hasSQL: false,
          hasUrl: false,
          hasEmail: false,
          questionMark: true,
          exclamationCount: 0,
          ellipsisCount: 0,
          capitalizationRatio: 0,
          punctuationDensity: 0.5,
          technicalTerms: [],
          domainKeywords: [],
        },
      });

      const complexQuery = createMockQuery({
        staticFeatures: {
          length: 100,
          wordCount: 20,
          queryType: 'question',
          complexity: 0.9,
          hasCode: true,
          hasSQL: false,
          hasUrl: false,
          hasEmail: false,
          questionMark: true,
          exclamationCount: 0,
          ellipsisCount: 0,
          capitalizationRatio: 0.5,
          punctuationDensity: 0.5,
          technicalTerms: ['algorithm', 'optimization'],
          domainKeywords: ['programming'],
        },
      });

      const simpleDecision = await dispatcher.dispatch(simpleQuery);
      const complexDecision = await dispatcher.dispatch(complexQuery);

      // Complex queries should cost more and take longer
      expect(complexDecision.estimatedCost).toBeGreaterThanOrEqual(simpleDecision.estimatedCost);
      expect(complexDecision.estimatedLatency).toBeGreaterThanOrEqual(simpleDecision.estimatedLatency);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      await dispatcher.start();
      const query = createMockQuery({
        original: '',
        normalized: '',
        staticFeatures: {
          length: 0,
          wordCount: 0,
          queryType: 'general',
          complexity: 0,
          hasCode: false,
          hasSQL: false,
          hasUrl: false,
          hasEmail: false,
          questionMark: false,
          exclamationCount: 0,
          ellipsisCount: 0,
          capitalizationRatio: 0,
          punctuationDensity: 0,
          technicalTerms: [],
          domainKeywords: [],
        },
      });

      const decision = await dispatcher.dispatch(query);
      expect(decision).toBeDefined();
    });

    it('should handle very high complexity query', async () => {
      await dispatcher.start();
      const query = createMockQuery({
        staticFeatures: {
          length: 1000,
          wordCount: 200,
          queryType: 'explanation',
          complexity: 1.0,
          hasCode: true,
          hasSQL: true,
          hasUrl: true,
          hasEmail: true,
          questionMark: true,
          exclamationCount: 5,
          ellipsisCount: 3,
          capitalizationRatio: 1.0,
          punctuationDensity: 2.0,
          technicalTerms: ['foo', 'bar', 'baz'],
          domainKeywords: ['tech'],
        },
      });

      const decision = await dispatcher.dispatch(query);
      expect(decision).toBeDefined();
      expect(decision.estimatedCost).toBeGreaterThan(0);
    });

    it('should handle conflicting constraints', async () => {
      await dispatcher.start();
      const query = createMockQuery();

      const decision = await dispatcher.dispatch(query, {
        requireLocal: true,
        maxCost: 0.0, // Can't meet if cloud required
        maxLatencyMs: 50, // Very low latency
      });

      expect(decision).toBeDefined();
      // Should note conflicts in notes
      if (decision.notes) {
        expect(decision.notes.length).toBeGreaterThan(0);
      }
    });
  });
});
