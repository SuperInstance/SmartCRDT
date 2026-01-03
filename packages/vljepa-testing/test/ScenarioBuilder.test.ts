/**
 * ScenarioBuilder Tests
 * Tests for scenario building and execution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScenarioBuilder } from '../src/index.js';

describe('ScenarioBuilder', () => {
  let mockExecutor: any;

  beforeEach(() => {
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      getMetrics: vi.fn().mockResolvedValue({
        cpu: 50,
        memory: 100_000_000,
        throughput: 100
      }),
      scaleUp: vi.fn().mockResolvedValue(undefined),
      scaleDown: vi.fn().mockResolvedValue(undefined)
    };
  });

  describe('Initialization', () => {
    it('should create builder with options', () => {
      const builder = new ScenarioBuilder({
        name: 'test_scenario',
        description: 'Test scenario',
        tags: ['test', 'unit']
      });

      expect(builder).toBeInstanceOf(ScenarioBuilder);
    });

    it('should build scenario', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder.build();

      expect(scenario).toBeDefined();
      expect(scenario.name).toBe('test');
      expect(scenario.stages).toBeDefined();
    });
  });

  describe('Adding Stages', () => {
    it('should add load stage', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Load Stage',
          load: 100,
          duration: 5000,
          assertions: [
            { type: 'latency', metric: 'p95', threshold: 500, operator: 'lt' }
          ]
        })
        .build();

      expect(scenario.stages.length).toBe(1);
      expect(scenario.stages[0].name).toBe('Load Stage');
    });

    it('should add spike stage', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addSpikeStage({
          name: 'Spike Stage',
          baselineLoad: 10,
          spikeLoad: 100,
          duration: 5000
        })
        .build();

      expect(scenario.stages.length).toBe(1);
      expect(scenario.stages[0].load.pattern).toBe('bursty');
    });

    it('should add scaling stage', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addScalingStage({
          name: 'Scale Up',
          scaleType: 'up',
          duration: 5000
        })
        .build();

      expect(scenario.stages.length).toBe(1);
      expect(scenario.stages[0].actions).toBeDefined();
      expect(scenario.stages[0].actions![0].type).toBe('scale');
    });

    it('should add fault stage', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addFaultStage({
          name: 'Fault Injection',
          faultType: 'network_failure',
          duration: 5000
        })
        .build();

      expect(scenario.stages.length).toBe(1);
      expect(scenario.stages[0].actions).toBeDefined();
      expect(scenario.stages[0].actions![0].type).toBe('fault');
    });

    it('should add ramp stage', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addRampStage({
          name: 'Ramp Stage',
          fromLoad: 10,
          toLoad: 100,
          duration: 5000
        })
        .build();

      expect(scenario.stages.length).toBe(1);
      expect(scenario.stages[0].load.rampUp).toBeDefined();
    });

    it('should add multiple stages', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({ name: 'Stage 1', load: 10, duration: 1000 })
        .addLoadStage({ name: 'Stage 2', load: 50, duration: 1000 })
        .addLoadStage({ name: 'Stage 3', load: 100, duration: 1000 })
        .build();

      expect(scenario.stages.length).toBe(3);
    });
  });

  describe('Scenario Execution', () => {
    it('should execute simple scenario', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Simple',
          load: 10,
          duration: 1000
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.success).toBeDefined();
      expect(result.stages.length).toBe(1);
    });

    it('should verify assertions', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'With Assertions',
          load: 10,
          duration: 1000,
          assertions: [
            { type: 'latency', metric: 'p95', threshold: 1000, operator: 'lt' }
          ]
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].assertionsPassed).toBeDefined();
    });

    it('should track stage metrics', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Metrics',
          load: 10,
          duration: 1000
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].metrics).toBeDefined();
      expect(result.stages[0].metrics.totalRequests).toBeGreaterThan(0);
    });

    it('should execute multi-stage scenario', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({ name: 'Stage 1', load: 10, duration: 500 })
        .addLoadStage({ name: 'Stage 2', load: 20, duration: 500 })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages.length).toBe(2);
      expect(result.overallAssertionsPassed).toBeDefined();
    });

    it('should handle failed assertions', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: true,
        latency: 2000 // Will exceed threshold
      });

      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Fail',
          load: 10,
          duration: 500,
          assertions: [
            { type: 'latency', metric: 'p95', threshold: 500, operator: 'lt' }
          ]
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.failedAssertions.length).toBeGreaterThan(0);
      expect(result.overallAssertionsPassed).toBe(false);
    });
  });

  describe('Assertions', () => {
    it('should verify latency assertion with lt operator', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: true,
        latency: 100
      });

      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Test',
          load: 10,
          duration: 500,
          assertions: [
            { type: 'latency', metric: 'p95', threshold: 500, operator: 'lt' }
          ]
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].assertionsPassed).toBe(true);
    });

    it('should verify error rate assertion', async () => {
      mockExecutor.execute
        .mockResolvedValueOnce({ success: true, latency: 100 })
        .mockResolvedValueOnce({ success: false, latency: 100, error: 'Error' })
        .mockResolvedValueOnce({ success: true, latency: 100 });

      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Test',
          load: 10,
          duration: 500,
          assertions: [
            { type: 'error_rate', metric: 'rate', threshold: 50, operator: 'lt' }
          ]
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].assertionsPassed).toBe(true);
    });

    it('should verify throughput assertion', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Test',
          load: 10,
          duration: 500,
          assertions: [
            { type: 'throughput', metric: 'rps', threshold: 5, operator: 'gte' }
          ]
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].assertionsPassed).toBeDefined();
    });

    it('should support all comparison operators', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: true,
        latency: 100
      });

      const operators = ['lt', 'lte', 'gt', 'gte', 'eq', 'ne'] as const;

      for (const op of operators) {
        const builder = new ScenarioBuilder({ name: `test_${op}` });
        const scenario = builder
          .addLoadStage({
            name: 'Test',
            load: 5,
            duration: 200,
            assertions: [
              { type: 'latency', metric: 'p95', threshold: 100, operator: op }
            ]
          })
          .build();

        const result = await builder.execute(scenario, mockExecutor);

        expect(result.stages[0].assertionsPassed).toBeDefined();
      }
    });
  });

  describe('Predefined Scenarios', () => {
    it('should create normal day scenario', () => {
      const scenario = ScenarioBuilder.createNormalDayScenario();

      expect(scenario.name).toBe('Normal Day');
      expect(scenario.stages.length).toBe(3);
      expect(scenario.tags).toContain('normal');
    });

    it('should create flash crowd scenario', () => {
      const scenario = ScenarioBuilder.createFlashCrowdScenario();

      expect(scenario.name).toBe('Flash Crowd');
      expect(scenario.stages.length).toBe(3);
      expect(scenario.tags).toContain('stress');
    });

    it('should create gradual growth scenario', () => {
      const scenario = ScenarioBuilder.createGradualGrowthScenario();

      expect(scenario.name).toBe('Gradual Growth');
      expect(scenario.stages.length).toBe(4);
      expect(scenario.tags).toContain('growth');
    });
  });

  describe('Actions', () => {
    it('should execute scale action', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addScalingStage({
          name: 'Scale',
          scaleType: 'up',
          duration: 500
        })
        .build();

      await builder.execute(scenario, mockExecutor);

      expect(mockExecutor.scaleUp).toHaveBeenCalled();
    });

    it('should handle traffic change actions', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addSpikeStage({
          name: 'Spike',
          baselineLoad: 10,
          spikeLoad: 100,
          duration: 1000,
          spikeDuration: 500
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].actions).toBeDefined();
      expect(result.stages[0].actions![0].type).toBe('traffic_change');
    });
  });

  describe('Stage Metrics', () => {
    it('should calculate error rate correctly', async () => {
      mockExecutor.execute
        .mockResolvedValueOnce({ success: true, latency: 100 })
        .mockResolvedValueOnce({ success: false, latency: 100 })
        .mockResolvedValue({ success: true, latency: 100 });

      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Test',
          load: 10,
          duration: 500
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].metrics.errorRate).toBeGreaterThan(0);
    });

    it('should calculate throughput', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Test',
          load: 10,
          duration: 500
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.stages[0].metrics.throughput).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scenario', () => {
      const builder = new ScenarioBuilder({ name: 'empty' });
      const scenario = builder.build();

      expect(scenario.stages.length).toBe(0);
      expect(scenario.duration).toBe(0);
    });

    it('should handle scenario with no assertions', async () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'No Assertions',
          load: 10,
          duration: 500
        })
        .build();

      const result = await builder.execute(scenario, mockExecutor);

      expect(result.overallAssertionsPassed).toBe(true);
    });

    it('should calculate total duration correctly', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({ name: 'Stage 1', load: 10, duration: 1000 })
        .addLoadStage({ name: 'Stage 2', load: 10, duration: 2000 })
        .addLoadStage({ name: 'Stage 3', load: 10, duration: 1500 })
        .build();

      expect(scenario.duration).toBe(4500);
    });
  });
});
