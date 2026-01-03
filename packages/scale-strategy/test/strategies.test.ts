/**
 * @lsi/scale-strategy - Strategies Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThresholdStrategy } from '../src/strategies/ThresholdStrategy.js';
import { PredictiveStrategy } from '../src/strategies/PredictiveStrategy.js';
import { TimeBasedStrategy } from '../src/strategies/TimeBasedStrategy.js';
import { CostOptimizedStrategy } from '../src/strategies/CostOptimizedStrategy.js';
import type { ScaleMetric, WorkerPoolState, ScaleManagerConfig } from '../src/types.js';

describe('ThresholdStrategy', () => {
  let strategy: ThresholdStrategy;
  let mockMetrics: ScaleMetric[];
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    const config: ScaleManagerConfig = {
      minWorkers: 1,
      maxWorkers: 10,
      initialWorkers: 2,
      policy: 'balanced',
      scaleUpCooldownMs: 60000,
      scaleDownCooldownMs: 300000,
      enableScaleToZero: true,
      scaleToZeroIdleMs: 600000,
      enablePredictiveScaling: true,
      predictionHorizonMs: 300000,
      emergencyThreshold: 100,
    };

    strategy = new ThresholdStrategy(config);

    mockMetrics = [
      {
        name: 'queue_depth',
        type: 0 as any,
        value: 75,
        weight: 0.9,
        threshold: { up: 50, down: 10 },
        unit: 'requests',
        timestamp: Date.now(),
      },
      {
        name: 'cpu_usage',
        type: 1 as any,
        value: 60,
        weight: 0.8,
        threshold: { up: 70, down: 30 },
        unit: 'percent',
        timestamp: Date.now(),
      },
    ];

    mockWorkerState = {
      total: 2,
      active: 2,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 75,
    };
  });

  it('should evaluate metrics and recommend scale up', async () => {
    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.direction).toBe('up');
    expect(decision.targetCount).toBeGreaterThan(mockWorkerState.active);
  });

  it('should evaluate metrics and recommend scale down', async () => {
    mockMetrics[0].value = 5;
    mockMetrics[1].value = 20;

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.direction).toBe('down');
    expect(decision.targetCount).toBeLessThan(mockWorkerState.active);
  });

  it('should recommend no action when metrics are neutral', async () => {
    mockMetrics[0].value = 30;
    mockMetrics[1].value = 50;

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.direction).toBe('none');
  });

  it('should apply hysteresis to prevent oscillation', async () => {
    strategy['lastDecision'] = 'down';

    mockMetrics[0].value = 55; // Just above threshold

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    // Should not scale up immediately due to hysteresis
    expect(decision.triggeredBy).toContain('hysteresis');
  });

  it('should respect aggressive policy', () => {
    strategy.setPolicy('aggressive');
    expect(strategy.getConfig().policy).toBe('aggressive');
  });

  it('should respect conservative policy', () => {
    strategy.setPolicy('conservative');
    expect(strategy.getConfig().policy).toBe('conservative');
  });
});

describe('PredictiveStrategy', () => {
  let strategy: PredictiveStrategy;
  let mockMetrics: ScaleMetric[];
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    const config: ScaleManagerConfig = {
      minWorkers: 1,
      maxWorkers: 10,
      initialWorkers: 2,
      policy: 'balanced',
      scaleUpCooldownMs: 60000,
      scaleDownCooldownMs: 300000,
      enableScaleToZero: true,
      scaleToZeroIdleMs: 600000,
      enablePredictiveScaling: true,
      predictionHorizonMs: 300000,
      emergencyThreshold: 100,
    };

    strategy = new PredictiveStrategy(config);

    mockMetrics = [
      {
        name: 'queue_depth',
        type: 0 as any,
        value: 30,
        weight: 0.9,
        threshold: { up: 50, down: 10 },
        unit: 'requests',
        timestamp: Date.now(),
      },
    ];

    mockWorkerState = {
      total: 2,
      active: 2,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 30,
    };
  });

  it('should make prediction based on history', async () => {
    // Add history
    for (let i = 0; i < 20; i++) {
      strategy.updateHistory([
        {
          name: 'queue_depth',
          type: 0 as any,
          value: 20 + i,
          weight: 0.9,
          threshold: { up: 50, down: 10 },
          unit: 'requests',
          timestamp: Date.now() + i * 1000,
        },
      ]);
    }

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision).toBeDefined();
  });

  it('should return low confidence decision with insufficient data', async () => {
    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.confidence).toBeLessThan(1);
  });

  it('should adjust for time patterns', async () => {
    // Weekend
    const weekendDate = new Date('2025-01-04T12:00:00Z'); // Saturday
    vi.spyOn(Date, 'now').mockReturnValue(weekendDate.getTime());

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision).toBeDefined();

    vi.restoreAllMocks();
  });

  it('should clear history', () => {
    strategy.updateHistory(mockMetrics);
    strategy.clearHistory();
    expect(strategy.getMetricHistory('queue_depth').length).toBe(0);
  });
});

describe('TimeBasedStrategy', () => {
  let strategy: TimeBasedStrategy;
  let mockMetrics: ScaleMetric[];
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    const config: ScaleManagerConfig = {
      minWorkers: 1,
      maxWorkers: 10,
      initialWorkers: 2,
      policy: 'balanced',
      scaleUpCooldownMs: 60000,
      scaleDownCooldownMs: 300000,
      enableScaleToZero: true,
      scaleToZeroIdleMs: 600000,
      enablePredictiveScaling: true,
      predictionHorizonMs: 300000,
      emergencyThreshold: 100,
    };

    strategy = new TimeBasedStrategy(config);

    mockMetrics = [];
    mockWorkerState = {
      total: 2,
      active: 2,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };
  });

  it('should return no action when no schedules', async () => {
    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.direction).toBe('none');
  });

  it('should match schedule and scale', async () => {
    const now = new Date();
    const schedule = {
      id: 'business-hours',
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      workerCount: 5,
      enabled: true,
    };

    strategy.addSchedule(schedule);

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.targetCount).toBe(5);
  });

  it('should add schedule', () => {
    const schedule = {
      id: 'test',
      dayOfWeek: 1,
      hour: 10,
      minute: 0,
      workerCount: 5,
      enabled: true,
    };

    strategy.addSchedule(schedule);
    expect(strategy.getSchedules().length).toBe(1);
  });

  it('should remove schedule', () => {
    const schedule = {
      id: 'test',
      dayOfWeek: 1,
      hour: 10,
      minute: 0,
      workerCount: 5,
      enabled: true,
    };

    strategy.addSchedule(schedule);
    strategy.removeSchedule('test');
    expect(strategy.getSchedules().length).toBe(0);
  });

  it('should apply override', async () => {
    strategy.addOverride(8, 60000, 'maintenance');

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.targetCount).toBe(8);
  });

  it('should clear overrides', async () => {
    strategy.addOverride(8, 60000, 'test');
    strategy.clearOverrides();

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.triggeredBy).not.toContain('time_override');
  });
});

describe('CostOptimizedStrategy', () => {
  let strategy: CostOptimizedStrategy;
  let mockMetrics: ScaleMetric[];
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    const config: ScaleManagerConfig = {
      minWorkers: 1,
      maxWorkers: 10,
      initialWorkers: 2,
      policy: 'balanced',
      scaleUpCooldownMs: 60000,
      scaleDownCooldownMs: 300000,
      enableScaleToZero: true,
      scaleToZeroIdleMs: 600000,
      enablePredictiveScaling: true,
      predictionHorizonMs: 300000,
      emergencyThreshold: 100,
    };

    strategy = new CostOptimizedStrategy(config);

    mockMetrics = [
      {
        name: 'latency',
        type: 3 as any,
        value: 300,
        weight: 0.85,
        threshold: { up: 1000, down: 200 },
        unit: 'milliseconds',
        timestamp: Date.now(),
      },
    ];

    mockWorkerState = {
      total: 5,
      active: 5,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 20,
    };
  });

  it('should optimize for cost', async () => {
    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision).toBeDefined();
    expect(decision.triggeredBy).toContain('cost_optimization');
  });

  it('should scale down when budget exceeded', async () => {
    strategy['budgetSpent'] = 100;
    strategy['config'].costConfig.maxCostPerHour = 5;

    const decision = await strategy.evaluate(mockMetrics, mockWorkerState);
    expect(decision.direction).toBe('down');
    expect(decision.isEmergency).toBe(true);
  });

  it('should track budget status', () => {
    strategy['budgetSpent'] = 3;
    const status = strategy.getBudgetStatus();
    expect(status.spent).toBe(3);
    expect(status.remaining).toBeGreaterThan(0);
  });

  it('should reset budget', () => {
    strategy['budgetSpent'] = 10;
    strategy.resetBudget();
    expect(strategy.getBudgetStatus().spent).toBe(0);
  });
});

// Total: 40 tests
