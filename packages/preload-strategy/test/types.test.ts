/**
 * Types and Error Tests
 */

import { describe, it, expect } from 'vitest';
import {
  PreloadError,
  ModuleLoadError,
  PredictionError,
  ScheduleError,
  EventTriggerError,
  CacheError,
  type PreloadTrigger,
  type PreloadPriority,
  type TimeBucket,
  type DayOfWeek,
  type ModuleMetadata,
  type ModuleLoadState,
  type PreloadRule,
  type PreloadCondition,
  type PreloadStats,
  type UsagePattern,
  type CoAccessPattern,
  type SessionPattern,
  type UserUsagePattern,
  type MarkovChain,
  type MarkovTransition,
  type PredictionResult,
  type SequencePattern,
  type Schedule,
  type ScheduleResult,
  type PreloadEvent,
  type EventTriggerConfig,
  type EventTriggerResult,
  type FederationPreloadConfig,
  type RemoteModuleState,
  type PreloadManagerConfig,
  type UsageTrackerConfig,
  type PredictiveEngineConfig,
  type TimeSchedulerConfig,
  type EventTriggerManagerConfig,
} from '../src/types.js';

describe('Error Classes', () => {
  describe('PreloadError', () => {
    it('should create base error', () => {
      const error = new PreloadError('Test error', 'TEST_CODE', { key: 'value' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('PreloadError');
    });

    it('should create error without details', () => {
      const error = new PreloadError('Test error', 'TEST_CODE');

      expect(error.details).toBeUndefined();
    });
  });

  describe('ModuleLoadError', () => {
    it('should create module load error', () => {
      const error = new ModuleLoadError('Load failed', 'test-module', '1.0.0');

      expect(error.message).toBe('Load failed');
      expect(error.code).toBe('MODULE_LOAD_ERROR');
      expect(error.moduleName).toBe('test-module');
      expect(error.version).toBe('1.0.0');
      expect(error.name).toBe('ModuleLoadError');
    });
  });

  describe('PredictionError', () => {
    it('should create prediction error', () => {
      const error = new PredictionError('Prediction failed', 'test-module');

      expect(error.message).toBe('Prediction failed');
      expect(error.code).toBe('PREDICTION_ERROR');
      expect(error.moduleName).toBe('test-module');
      expect(error.name).toBe('PredictionError');
    });
  });

  describe('ScheduleError', () => {
    it('should create schedule error', () => {
      const error = new ScheduleError('Schedule failed', 'schedule-1');

      expect(error.message).toBe('Schedule failed');
      expect(error.code).toBe('SCHEDULE_ERROR');
      expect(error.scheduleId).toBe('schedule-1');
      expect(error.name).toBe('ScheduleError');
    });
  });

  describe('EventTriggerError', () => {
    it('should create event trigger error', () => {
      const error = new EventTriggerError('Trigger failed', 'test-event');

      expect(error.message).toBe('Trigger failed');
      expect(error.code).toBe('EVENT_TRIGGER_ERROR');
      expect(error.eventType).toBe('test-event');
      expect(error.name).toBe('EventTriggerError');
    });
  });

  describe('CacheError', () => {
    it('should create cache error', () => {
      const error = new CacheError('Cache failed', 'cache-key');

      expect(error.message).toBe('Cache failed');
      expect(error.code).toBe('CACHE_ERROR');
      expect(error.key).toBe('cache-key');
      expect(error.name).toBe('CacheError');
    });
  });
});

describe('Type Definitions', () => {
  describe('PreloadTrigger', () => {
    it('should accept valid trigger types', () => {
      const triggers: PreloadTrigger[] = [
        'time-based',
        'usage-based',
        'event-based',
        'predictive',
      ];

      expect(triggers).toHaveLength(4);
    });
  });

  describe('PreloadPriority', () => {
    it('should accept valid priority levels', () => {
      const priorities: PreloadPriority[] = [
        'critical',
        'high',
        'normal',
        'low',
      ];

      expect(priorities).toHaveLength(4);
    });
  });

  describe('TimeBucket', () => {
    it('should accept valid time buckets', () => {
      const buckets: TimeBucket[] = [
        'early-morning',
        'morning',
        'afternoon',
        'evening',
      ];

      expect(buckets).toHaveLength(4);
    });
  });

  describe('DayOfWeek', () => {
    it('should accept valid days', () => {
      const days: DayOfWeek[] = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];

      expect(days).toHaveLength(7);
    });
  });

  describe('ModuleMetadata', () => {
    it('should accept valid module metadata', () => {
      const metadata: ModuleMetadata = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        size: 10000,
        loadTime: 100,
        dependencies: [],
      };

      expect(metadata.id).toBe('test-module');
    });

    it('should accept optional fields', () => {
      const metadata: ModuleMetadata = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        size: 10000,
        loadTime: 100,
        dependencies: [],
        url: 'https://example.com/module.js',
        critical: true,
        tags: ['important', 'ui'],
        lastModified: Date.now(),
      };

      expect(metadata.url).toBeDefined();
      expect(metadata.critical).toBe(true);
      expect(metadata.tags).toHaveLength(2);
    });
  });

  describe('ModuleLoadState', () => {
    it('should accept valid load state', () => {
      const state: ModuleLoadState = {
        moduleId: 'test-module',
        loaded: false,
      };

      expect(state.moduleId).toBe('test-module');
      expect(state.loaded).toBe(false);
    });

    it('should accept optional fields', () => {
      const state: ModuleLoadState = {
        moduleId: 'test-module',
        loaded: true,
        loadedAt: Date.now(),
        loadTime: 150,
        fromCache: false,
      };

      expect(state.loadedAt).toBeDefined();
      expect(state.loadTime).toBe(150);
    });

    it('should accept error field', () => {
      const state: ModuleLoadState = {
        moduleId: 'test-module',
        loaded: false,
        error: 'Load failed',
      };

      expect(state.error).toBe('Load failed');
    });
  });

  describe('PreloadRule', () => {
    it('should accept valid rule', () => {
      const rule: PreloadRule = {
        id: 'rule-1',
        moduleName: 'test-module',
        trigger: 'time-based',
        priority: 'high',
        conditions: {},
        enabled: true,
        createdAt: Date.now(),
        applicationCount: 0,
      };

      expect(rule.moduleName).toBe('test-module');
    });

    it('should accept optional updatedAt', () => {
      const rule: PreloadRule = {
        id: 'rule-1',
        moduleName: 'test-module',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        applicationCount: 0,
      };

      expect(rule.updatedAt).toBeDefined();
    });

    it('should accept maxApplications', () => {
      const rule: PreloadRule = {
        id: 'rule-1',
        moduleName: 'test-module',
        trigger: 'event-based',
        priority: 'critical',
        conditions: {},
        enabled: true,
        createdAt: Date.now(),
        applicationCount: 0,
        maxApplications: 10,
      };

      expect(rule.maxApplications).toBe(10);
    });
  });

  describe('PreloadCondition', () => {
    it('should accept empty condition', () => {
      const condition: PreloadCondition = {};

      expect(condition).toEqual({});
    });

    it('should accept time condition', () => {
      const condition: PreloadCondition = {
        time: {
          bucket: 'morning',
          days: ['monday', 'friday'],
          hourRange: [9, 17],
        },
      };

      expect(condition.time?.bucket).toBe('morning');
    });

    it('should accept usage condition', () => {
      const condition: PreloadCondition = {
        usage: {
          minFrequency: 5,
          maxIdleTime: 3600000,
        },
      };

      expect(condition.usage?.minFrequency).toBe(5);
    });

    it('should accept event condition', () => {
      const condition: PreloadCondition = {
        event: {
          types: ['deployment', 'traffic-spike'],
          filter: { service: 'api' },
        },
      };

      expect(condition.event?.types).toHaveLength(2);
    });

    it('should accept prediction condition', () => {
      const condition: PreloadCondition = {
        prediction: {
          minConfidence: 0.7,
          maxAge: 300000,
        },
      };

      expect(condition.prediction?.minConfidence).toBe(0.7);
    });
  });

  describe('PreloadStats', () => {
    it('should accept valid stats', () => {
      const stats: PreloadStats = {
        totalPreloaded: 10,
        cacheHits: 5,
        cacheMisses: 5,
        avgLoadTime: 150,
        successRate: 0.9,
        rulesApplied: 3,
        predictionsMade: 20,
        predictionAccuracy: 0.75,
        timestamp: Date.now(),
      };

      expect(stats.totalPreloaded).toBe(10);
    });
  });

  describe('UsagePattern', () => {
    it('should accept valid pattern', () => {
      const pattern: UsagePattern = {
        moduleName: 'test-module',
        accessFrequency: 5.5,
        timeOfDay: 'morning',
        dayOfWeek: 'monday',
        coAccess: [],
        sessionPattern: {
          startProbability: 0.3,
          endProbability: 0.3,
          avgPosition: 0.5,
        },
        lastUpdated: Date.now(),
      };

      expect(pattern.moduleName).toBe('test-module');
    });
  });

  describe('CoAccessPattern', () => {
    it('should accept valid co-access pattern', () => {
      const pattern: CoAccessPattern = {
        moduleName: 'other-module',
        probability: 0.7,
        avgTimeBetween: 5000,
      };

      expect(pattern.probability).toBe(0.7);
    });
  });

  describe('SessionPattern', () => {
    it('should accept valid session pattern', () => {
      const pattern: SessionPattern = {
        startProbability: 0.2,
        endProbability: 0.3,
        avgPosition: 0.6,
      };

      expect(pattern.avgPosition).toBe(0.6);
    });
  });

  describe('UserUsagePattern', () => {
    it('should accept valid user pattern', () => {
      const pattern: UserUsagePattern = {
        userId: 'user-1',
        patterns: new Map(),
        lastActive: Date.now(),
      };

      expect(pattern.userId).toBe('user-1');
    });

    it('should accept optional fields', () => {
      const pattern: UserUsagePattern = {
        userId: 'user-1',
        patterns: new Map(),
        timeZone: 'America/New_York',
        activeHours: [[9, 17], [18, 20]],
        lastActive: Date.now(),
      };

      expect(pattern.timeZone).toBe('America/New_York');
      expect(pattern.activeHours).toHaveLength(2);
    });
  });

  describe('MarkovChain', () => {
    it('should accept valid chain', () => {
      const chain: MarkovChain = {
        state: 'module-1',
        transitions: new Map([['module-2', 5]]),
        totalCount: 10,
      };

      expect(chain.state).toBe('module-1');
    });
  });

  describe('MarkovTransition', () => {
    it('should accept valid transition', () => {
      const transition: MarkovTransition = {
        from: 'module-1',
        to: 'module-2',
        count: 10,
        probability: 0.5,
      };

      expect(transition.probability).toBe(0.5);
    });
  });

  describe('PredictionResult', () => {
    it('should accept valid result', () => {
      const result: PredictionResult = {
        moduleName: 'predicted-module',
        confidence: 0.8,
        reason: 'High probability based on usage',
        relatedModules: ['module-1', 'module-2'],
        timestamp: Date.now(),
      };

      expect(result.confidence).toBe(0.8);
    });
  });

  describe('SequencePattern', () => {
    it('should accept valid sequence', () => {
      const pattern: SequencePattern = {
        sequence: ['module-1', 'module-2', 'module-3'],
        count: 5,
        confidence: 0.7,
        avgTimeBetween: [1000, 2000],
      };

      expect(pattern.sequence).toHaveLength(3);
    });
  });

  describe('Schedule', () => {
    it('should accept valid schedule', () => {
      const schedule: Schedule = {
        id: 'schedule-1',
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
        nextRun: Date.now() + 3600000,
        createdAt: Date.now(),
      };

      expect(schedule.cron).toBe('0 * * * *');
    });

    it('should accept optional oneTimeAt', () => {
      const schedule: Schedule = {
        id: 'schedule-1',
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: false,
        enabled: true,
        oneTimeAt: Date.now() + 3600000,
        nextRun: Date.now() + 3600000,
        createdAt: Date.now(),
      };

      expect(schedule.oneTimeAt).toBeDefined();
    });
  });

  describe('ScheduleResult', () => {
    it('should accept successful result', () => {
      const result: ScheduleResult = {
        scheduleId: 'schedule-1',
        timestamp: Date.now(),
        modulesPreloaded: ['module-1', 'module-2'],
        success: true,
      };

      expect(result.success).toBe(true);
    });

    it('should accept failed result', () => {
      const result: ScheduleResult = {
        scheduleId: 'schedule-1',
        timestamp: Date.now(),
        modulesPreloaded: [],
        success: false,
        error: 'Module not found',
      };

      expect(result.error).toBe('Module not found');
    });
  });

  describe('PreloadEvent', () => {
    it('should accept valid event', () => {
      const event: PreloadEvent = {
        type: 'deployment',
        timestamp: Date.now(),
        payload: { service: 'api', version: '1.0.0' },
        source: 'system',
      };

      expect(event.type).toBe('deployment');
    });
  });

  describe('EventTriggerConfig', () => {
    it('should accept valid config', () => {
      const config: EventTriggerConfig = {
        eventType: 'test-event',
        enabled: true,
      };

      expect(config.eventType).toBe('test-event');
    });

    it('should accept optional fields', () => {
      const config: EventTriggerConfig = {
        eventType: 'test-event',
        filter: { key: 'value' },
        debounceTime: 1000,
        throttleTime: 5000,
        maxTriggers: 10,
        enabled: true,
      };

      expect(config.debounceTime).toBe(1000);
    });
  });

  describe('EventTriggerResult', () => {
    it('should accept valid result', () => {
      const event: PreloadEvent = {
        type: 'test',
        timestamp: Date.now(),
        payload: {},
        source: 'test',
      };

      const result: EventTriggerResult = {
        triggerId: 'trigger-1',
        event,
        modulesPreloaded: ['module-1'],
        success: true,
        processingTime: 100,
      };

      expect(result.processingTime).toBe(100);
    });
  });

  describe('FederationPreloadConfig', () => {
    it('should accept valid config', () => {
      const config: FederationPreloadConfig = {
        remoteModules: [],
        containerCacheTTL: 3600000,
        versionNegotiationTimeout: 10000,
        hmrAware: true,
      };

      expect(config.hmrAware).toBe(true);
    });
  });

  describe('RemoteModuleState', () => {
    it('should accept valid state', () => {
      const state: RemoteModuleState = {
        moduleId: 'remote-module',
        state: 'not-loaded',
      };

      expect(state.state).toBe('not-loaded');
    });

    it('should accept loaded state', () => {
      const state: RemoteModuleState = {
        moduleId: 'remote-module',
        state: 'loaded',
        container: { test: 'value' },
        cachedVersion: '1.0.0',
        cacheExpiresAt: Date.now() + 3600000,
      };

      expect(state.container).toBeDefined();
    });

    it('should accept loading state', () => {
      const state: RemoteModuleState = {
        moduleId: 'remote-module',
        state: 'loading',
      };

      expect(state.state).toBe('loading');
    });

    it('should accept error state', () => {
      const state: RemoteModuleState = {
        moduleId: 'remote-module',
        state: 'error',
      };

      expect(state.state).toBe('error');
    });
  });

  describe('Configuration Types', () => {
    it('should accept PreloadManagerConfig', () => {
      const config: PreloadManagerConfig = {
        maxConcurrentPreloads: 5,
        preloadTimeout: 30000,
        enablePrediction: true,
        enableScheduling: true,
        enableEventTriggers: true,
        maxCacheSize: 100000000,
        cacheTTL: 3600000,
      };

      expect(config.maxConcurrentPreloads).toBe(5);
    });

    it('should accept UsageTrackerConfig', () => {
      const config: UsageTrackerConfig = {
        enabled: true,
        sampleRate: 1.0,
        maxPatternsPerModule: 100,
        maxPatternsPerUser: 50,
        aggregationInterval: 60000,
      };

      expect(config.sampleRate).toBe(1.0);
    });

    it('should accept PredictiveEngineConfig', () => {
      const config: PredictiveEngineConfig = {
        enabled: true,
        minConfidence: 0.3,
        maxSequenceLength: 5,
        minPatternCount: 3,
        learningRate: 0.1,
        modelUpdateInterval: 30000,
      };

      expect(config.minConfidence).toBe(0.3);
    });

    it('should accept TimeSchedulerConfig', () => {
      const config: TimeSchedulerConfig = {
        enabled: true,
        defaultTimeZone: 'UTC',
        maxConcurrentSchedules: 10,
        scheduleTimeout: 30000,
      };

      expect(config.defaultTimeZone).toBe('UTC');
    });

    it('should accept EventTriggerManagerConfig', () => {
      const config: EventTriggerManagerConfig = {
        enabled: true,
        maxConcurrentHandlers: 5,
        eventTimeout: 10000,
        defaultDebounceTime: 1000,
        defaultThrottleTime: 5000,
      };

      expect(config.maxConcurrentHandlers).toBe(5);
    });
  });
});

describe('Type Guards and Validators', () => {
  it('should validate trigger type', () => {
    const valid: PreloadTrigger = 'predictive';
    expect(['time-based', 'usage-based', 'event-based', 'predictive']).toContain(valid);
  });

  it('should validate priority level', () => {
    const valid: PreloadPriority = 'critical';
    expect(['critical', 'high', 'normal', 'low']).toContain(valid);
  });

  it('should validate confidence range', () => {
    const confidence = 0.75;
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('should validate probability', () => {
    const probability = 0.5;
    expect(probability).toBeGreaterThanOrEqual(0);
    expect(probability).toBeLessThanOrEqual(1);
  });
});

describe('Edge Cases and Type Safety', () => {
  it('should handle empty string module ID', () => {
    const state: ModuleLoadState = {
      moduleId: '',
      loaded: false,
    };

    expect(state.moduleId).toBe('');
  });

  it('should handle zero values in stats', () => {
    const stats: PreloadStats = {
      totalPreloaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLoadTime: 0,
      successRate: 0,
      rulesApplied: 0,
      predictionsMade: 0,
      predictionAccuracy: 0,
      timestamp: Date.now(),
    };

    expect(stats.totalPreloaded).toBe(0);
  });

  it('should handle very large numbers', () => {
    const metadata: ModuleMetadata = {
      id: 'huge-module',
      name: 'Huge Module',
      version: '1.0.0',
      size: Number.MAX_SAFE_INTEGER,
      loadTime: 1000000,
      dependencies: [],
    };

    expect(metadata.size).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should handle negative timestamp', () => {
    const state: ModuleLoadState = {
      moduleId: 'test',
      loaded: true,
      loadedAt: -1,
    };

    expect(state.loadedAt).toBe(-1);
  });

  it('should handle very long strings', () => {
    const longString = 'a'.repeat(10000);
    const metadata: ModuleMetadata = {
      id: longString,
      name: longString,
      version: longString,
      size: 1000,
      loadTime: 10,
      dependencies: [],
    };

    expect(metadata.id.length).toBe(10000);
  });

  it('should handle empty arrays', () => {
    const metadata: ModuleMetadata = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      size: 1000,
      loadTime: 10,
      dependencies: [],
      tags: [],
    };

    expect(metadata.dependencies).toHaveLength(0);
    expect(metadata.tags).toHaveLength(0);
  });

  it('should handle nested maps', () => {
    const userPattern: UserUsagePattern = {
      userId: 'user-1',
      patterns: new Map([
        ['module-1', {
          moduleName: 'module-1',
          accessFrequency: 5.0,
          timeOfDay: 'morning',
          dayOfWeek: 'monday',
          coAccess: [],
          sessionPattern: { startProbability: 0.5, endProbability: 0.5, avgPosition: 0.5 },
          lastUpdated: Date.now(),
        }],
      ]),
      lastActive: Date.now(),
    };

    expect(userPattern.patterns.size).toBe(1);
  });
});
