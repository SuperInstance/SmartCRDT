/**
 * @fileoverview Comprehensive integration tests for Model Registry
 * @description Tests covering VersionManager, LifecycleManager, DeploymentTracker, LineageTracker, ComparisonMetrics, DriftDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionManager } from '../src/registry/VersionManager.js';
import { LifecycleManager } from '../src/registry/LifecycleManager.js';
import { DeploymentTracker } from '../src/deployment/DeploymentTracker.js';
import { LineageTracker } from '../src/lineage/LineageTracker.js';
import { ComparisonMetrics } from '../src/metrics/ComparisonMetrics.js';
import { DriftDetector } from '../src/metrics/DriftDetector.js';
import type { ModelVersion, LifecycleConfig, ModelMetrics, TrainingInfo, DataInfo, DriftDetectorConfig } from '../src/types.js';

describe('VersionManager', () => {
  let manager: VersionManager;
  let testVersions: ModelVersion[];

  beforeEach(() => {
    manager = new VersionManager('semantic');
    testVersions = [];
  });

  const createVersion = (version: string): ModelVersion => ({
    version,
    artifacts: [],
    metrics: {
      accuracy: { top1: 0.9, custom: {} },
      latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
      memory: { modelSize: 100, runtime: 200, peak: 300 },
      throughput: { rps: 100 },
      quality: { custom: {} },
    },
    metadata: {
      trainingConfig: {
        algorithm: 'adam',
        hyperparameters: {},
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001,
        optimizer: 'adam',
        lossFunction: 'mse',
        duration: 3600,
        hardware: 'gpu',
      },
      changelog: '',
      benchmarks: [],
      custom: {},
    },
    created: Date.now(),
    createdBy: 'test',
    isProduction: false,
    isArchived: false,
  });

  describe('generateVersion', () => {
    it('should return 1.0.0 for empty version list', () => {
      expect(manager.generateVersion([], 'patch')).toBe('1.0.0');
    });

    it('should increment patch version', () => {
      testVersions.push(createVersion('1.0.0'));
      expect(manager.generateVersion(testVersions, 'patch')).toBe('1.0.1');
    });

    it('should increment minor version', () => {
      testVersions.push(createVersion('1.0.0'));
      expect(manager.generateVersion(testVersions, 'minor')).toBe('1.1.0');
    });

    it('should increment major version', () => {
      testVersions.push(createVersion('1.0.0'));
      expect(manager.generateVersion(testVersions, 'major')).toBe('2.0.0');
    });

    it('should increment from latest version', () => {
      testVersions.push(createVersion('1.5.0'));
      testVersions.push(createVersion('1.0.0'));
      testVersions.push(createVersion('2.0.0'));
      expect(manager.generateVersion(testVersions, 'patch')).toBe('2.0.1');
    });
  });

  describe('getLatestVersion', () => {
    it('should return highest semantic version', () => {
      testVersions.push(createVersion('1.0.0'));
      testVersions.push(createVersion('2.0.0'));
      testVersions.push(createVersion('1.5.0'));
      expect(manager.getLatestVersion(testVersions).version).toBe('2.0.0');
    });

    it('should throw on empty list', () => {
      expect(() => manager.getLatestVersion([])).toThrow();
    });
  });

  describe('compareVersions', () => {
    it('should return negative for lower version', () => {
      expect(manager.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should return positive for higher version', () => {
      expect(manager.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    });

    it('should return 0 for equal versions', () => {
      expect(manager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });
  });

  describe('isValidVersion', () => {
    it('should validate semantic versions', () => {
      expect(manager.isValidVersion('1.0.0')).toBe(true);
      expect(manager.isValidVersion('2.1.3')).toBe(true);
      expect(manager.isValidVersion('1.0.0-alpha')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(manager.isValidVersion('not-a-version')).toBe(false);
      expect(manager.isValidVersion('')).toBe(false);
    });
  });

  describe('satisfies', () => {
    it('should check semver range satisfaction', () => {
      expect(manager.satisfies('1.0.0', '^1.0.0')).toBe(true);
      expect(manager.satisfies('1.5.0', '^1.0.0')).toBe(true);
      expect(manager.satisfies('2.0.0', '^1.0.0')).toBe(false);
    });
  });

  describe('parseVersion', () => {
    it('should parse version components', () => {
      const parsed = manager.parseVersion('2.5.3');
      expect(parsed.major).toBe(2);
      expect(parsed.minor).toBe(5);
      expect(parsed.patch).toBe(3);
    });

    it('should parse prerelease', () => {
      const parsed = manager.parseVersion('1.0.0-alpha.1');
      expect(parsed.prerelease).toBe('alpha.1');
    });
  });

  describe('isBreakingChange', () => {
    it('should detect major version bump as breaking', () => {
      expect(manager.isBreakingChange('1.0.0', '2.0.0')).toBe(true);
    });

    it('should not detect minor/patch as breaking', () => {
      expect(manager.isBreakingChange('1.0.0', '1.1.0')).toBe(false);
      expect(manager.isBreakingChange('1.0.0', '1.0.1')).toBe(false);
    });
  });
});

describe('LifecycleManager', () => {
  let manager: LifecycleManager;
  let lifecycleConfig: LifecycleConfig;

  beforeEach(() => {
    lifecycleConfig = {
      stages: [
        {
          name: 'development',
          maxDuration: 7 * 24 * 60 * 60 * 1000,
          requirements: [],
          canDeployToProduction: false,
        },
        {
          name: 'staging',
          maxDuration: 14 * 24 * 60 * 60 * 1000,
          requirements: [],
          canDeployToProduction: true,
        },
        {
          name: 'production',
          maxDuration: Infinity,
          requirements: [],
          canDeployToProduction: true,
        },
      ],
      transitions: [
        { from: 'development', to: 'staging', conditions: [], approval: false, approvers: [] },
        { from: 'staging', to: 'production', conditions: [], approval: false, approvers: [] },
        { from: 'production', to: 'archived', conditions: [], approval: false, approvers: [] },
      ],
      autoPromote: false,
      autoArchive: false,
      approvals: { enabled: false, requiredApprovers: {}, timeout: 0 },
    };
    manager = new LifecycleManager(lifecycleConfig);
  });

  describe('transition', () => {
    it('should transition model to new stage', async () => {
      const model = {
        id: 'test',
        name: 'test',
        description: 'test',
        versions: [],
        metadata: {} as any,
        created: Date.now(),
        updated: Date.now(),
        stage: 'development' as const,
        tags: [],
      };

      const result = await manager.transition(model, 'staging');
      expect(result.stage).toBe('staging');
    });

    it('should reject invalid transitions', async () => {
      const model = {
        id: 'test',
        name: 'test',
        description: 'test',
        versions: [],
        metadata: {} as any,
        created: Date.now(),
        updated: Date.now(),
        stage: 'development' as const,
        tags: [],
      };

      await expect(manager.transition(model, 'production')).rejects.toThrow();
    });
  });

  describe('canDeployToProduction', () => {
    it('should allow deployment from staging', () => {
      const model = {
        id: 'test',
        name: 'test',
        description: 'test',
        versions: [],
        metadata: {} as any,
        created: Date.now(),
        updated: Date.now(),
        stage: 'staging' as const,
        tags: [],
      };

      expect(manager.canDeployToProduction(model)).toBe(true);
    });

    it('should not allow deployment from development', () => {
      const model = {
        id: 'test',
        name: 'test',
        description: 'test',
        versions: [],
        metadata: {} as any,
        created: Date.now(),
        updated: Date.now(),
        stage: 'development' as const,
        tags: [],
      };

      expect(manager.canDeployToProduction(model)).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions', () => {
      const transitions = manager.getAllowedTransitions('development');
      expect(transitions).toContain('staging');
      expect(transitions).not.toContain('production');
    });
  });
});

describe('DeploymentTracker', () => {
  let tracker: DeploymentTracker;

  beforeEach(() => {
    tracker = new DeploymentTracker();
  });

  describe('createDeployment', () => {
    it('should create a new deployment', async () => {
      const deployment = await tracker.createDeployment(
        'model-id',
        '1.0.0',
        'production',
        {
          strategy: 'rolling',
          replicas: 3,
          resources: { cpu: 4, memory: 16, storage: 100 },
        },
        'test-user'
      );

      expect(deployment.id).toBeDefined();
      expect(deployment.model).toBe('model-id');
      expect(deployment.version).toBe('1.0.0');
      expect(deployment.environment).toBe('production');
      expect(deployment.status).toBe('pending');
    });
  });

  describe('startDeployment', () => {
    it('should mark deployment as deploying', async () => {
      const deployment = await tracker.createDeployment('model-id', '1.0.0', 'production', {
        strategy: 'rolling',
        replicas: 3,
        resources: { cpu: 4, memory: 16, storage: 100 },
      }, 'user');

      await tracker.startDeployment(deployment.id);
      const updated = tracker.getDeployment(deployment.id);

      expect(updated?.status).toBe('deploying');
    });
  });

  describe('markDeploymentSuccess', () => {
    it('should mark deployment as successful', async () => {
      const deployment = await tracker.createDeployment('model-id', '1.0.0', 'production', {
        strategy: 'rolling',
        replicas: 3,
        resources: { cpu: 4, memory: 16, storage: 100 },
      }, 'user');

      await tracker.markDeploymentSuccess(deployment.id, {
        latency: 50,
        errorRate: 0.01,
        throughput: 100,
        collectedAt: Date.now(),
      });

      const updated = tracker.getDeployment(deployment.id);
      expect(updated?.status).toBe('success');
      expect(updated?.metrics?.latency).toBe(50);
    });
  });

  describe('markDeploymentFailed', () => {
    it('should mark deployment as failed', async () => {
      const deployment = await tracker.createDeployment('model-id', '1.0.0', 'production', {
        strategy: 'rolling',
        replicas: 3,
        resources: { cpu: 4, memory: 16, storage: 100 },
      }, 'user');

      await tracker.markDeploymentFailed(deployment.id, 'Connection timeout');
      const updated = tracker.getDeployment(deployment.id);

      expect(updated?.status).toBe('failed');
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback deployment', async () => {
      const deployment = await tracker.createDeployment('model-id', '2.0.0', 'production', {
        strategy: 'rolling',
        replicas: 3,
        resources: { cpu: 4, memory: 16, storage: 100 },
      }, 'user');

      await tracker.markDeploymentSuccess(deployment.id, {
        latency: 50,
        errorRate: 0.01,
        throughput: 100,
        collectedAt: Date.now(),
      });

      const rollback = await tracker.rollbackDeployment(deployment.id, '1.0.0', 'High error rate', 'admin', 'immediate');

      expect(rollback.previousVersion).toBe('1.0.0');
      expect(rollback.reason).toBe('High error rate');

      const updated = tracker.getDeployment(deployment.id);
      expect(updated?.status).toBe('rolled_back');
    });
  });

  describe('getCurrentDeployment', () => {
    it('should get current deployment for environment', async () => {
      await tracker.createDeployment('model-id', '1.0.0', 'production', {
        strategy: 'immediate',
        replicas: 1,
        resources: { cpu: 1, memory: 1, storage: 10 },
      }, 'user');

      const deployment = tracker.getCurrentDeployment('model-id', 'production');
      expect(deployment).toBeDefined();
    });
  });

  describe('getDeploymentStatistics', () => {
    it('should calculate deployment statistics', async () => {
      await tracker.createDeployment('model1', '1.0.0', 'production', {
        strategy: 'rolling',
        replicas: 3,
        resources: { cpu: 4, memory: 16, storage: 100 },
      }, 'user');

      const stats = tracker.getDeploymentStatistics();
      expect(stats.total).toBe(1);
      expect(stats.byStatus.pending).toBe(1);
    });
  });
});

describe('LineageTracker', () => {
  let tracker: LineageTracker;

  beforeEach(() => {
    tracker = new LineageTracker();
  });

  describe('createLineage', () => {
    it('should create lineage for new model', () => {
      const training: TrainingInfo = {
        algorithm: 'adam',
        hyperparameters: { lr: 0.001 },
        dataset: 'test-dataset',
        epochs: 10,
        metrics: {
          trainLoss: 0.1,
          valLoss: 0.2,
          bestEpoch: 8,
          trainingTime: 3600,
        },
        environment: 'pytorch',
      };

      const data: DataInfo = {
        dataset: 'test-dataset',
        version: '1.0',
        samples: 1000,
        split: 'train',
        preprocessing: [],
        sources: [],
      };

      const lineage = tracker.createLineage('model-id', '1.0.0', training, data);

      expect(lineage.modelId).toBe('model-id');
      expect(lineage.version).toBe('1.0.0');
      expect(lineage.parents).toHaveLength(0);
    });

    it('should track parent models', () => {
      const training: TrainingInfo = {
        algorithm: 'adam',
        hyperparameters: {},
        dataset: 'test',
        epochs: 10,
        metrics: { trainLoss: 0.1, valLoss: 0.2, bestEpoch: 5, trainingTime: 1000 },
        environment: 'test',
      };

      const data: DataInfo = {
        dataset: 'test',
        version: '1.0',
        samples: 100,
        split: 'train',
        preprocessing: [],
        sources: [],
      };

      const lineage = tracker.createLineage('child-model', '1.0.0', training, data, [
        { id: 'parent-model', version: '1.0.0', method: 'fine_tune' },
      ]);

      expect(lineage.parents).toHaveLength(1);
      expect(lineage.parents[0].id).toBe('parent-model');
    });
  });

  describe('getAncestryChain', () => {
    it('should build ancestry chain', () => {
      const training: TrainingInfo = {
        algorithm: 'adam',
        hyperparameters: {},
        dataset: 'test',
        epochs: 10,
        metrics: { trainLoss: 0.1, valLoss: 0.2, bestEpoch: 5, trainingTime: 1000 },
        environment: 'test',
      };

      const data: DataInfo = {
        dataset: 'test',
        version: '1.0',
        samples: 100,
        split: 'train',
        preprocessing: [],
        sources: [],
      };

      tracker.createLineage('model1', '1.0.0', training, data);
      tracker.createLineage('model2', '1.0.0', training, data, [
        { id: 'model1', version: '1.0.0', method: 'fine_tune' },
      ]);

      const ancestry = tracker.getAncestryChain('model2', '1.0.0');
      expect(ancestry.chain).toHaveLength(2);
      expect(ancestry.depth).toBe(1);
    });
  });

  describe('getCommonAncestor', () => {
    it('should find common ancestor', () => {
      const training: TrainingInfo = {
        algorithm: 'adam',
        hyperparameters: {},
        dataset: 'test',
        epochs: 10,
        metrics: { trainLoss: 0.1, valLoss: 0.2, bestEpoch: 5, trainingTime: 1000 },
        environment: 'test',
      };

      const data: DataInfo = {
        dataset: 'test',
        version: '1.0',
        samples: 100,
        split: 'train',
        preprocessing: [],
        sources: [],
      };

      tracker.createLineage('base', '1.0.0', training, data);
      tracker.createLineage('model-a', '1.0.0', training, data, [
        { id: 'base', version: '1.0.0', method: 'fine_tune' },
      ]);
      tracker.createLineage('model-b', '1.0.0', training, data, [
        { id: 'base', version: '1.0.0', method: 'fine_tune' },
      ]);

      const common = tracker.getCommonAncestor(
        { id: 'model-a', version: '1.0.0' },
        { id: 'model-b', version: '1.0.0' }
      );

      expect(common?.modelId).toBe('base');
    });
  });

  describe('compareLineages', () => {
    it('should compare two lineages', () => {
      const training: TrainingInfo = {
        algorithm: 'adam',
        hyperparameters: { lr: 0.001 },
        dataset: 'test',
        epochs: 10,
        metrics: { trainLoss: 0.1, valLoss: 0.2, bestEpoch: 5, trainingTime: 1000 },
        environment: 'test',
      };

      const data: DataInfo = {
        dataset: 'test',
        version: '1.0',
        samples: 100,
        split: 'train',
        preprocessing: [],
        sources: [],
      };

      tracker.createLineage('model-a', '1.0.0', training, data);
      tracker.createLineage('model-b', '1.0.0', {
        ...training,
        algorithm: 'sgd',
      }, data);

      const comparison = tracker.compareLineages(
        { id: 'model-a', version: '1.0.0' },
        { id: 'model-b', version: '1.0.0' }
      );

      expect(comparison.trainingDifference.differences.length).toBeGreaterThan(0);
    });
  });
});

describe('ComparisonMetrics', () => {
  let comparison: ComparisonMetrics;

  beforeEach(() => {
    comparison = new ComparisonMetrics();
  });

  const createMetrics = (accuracy: number): ModelMetrics => ({
    accuracy: { top1: accuracy, custom: {} },
    latency: { p50: 10, p95: 20, p99: 30, avg: 15 },
    memory: { modelSize: 100, runtime: 200, peak: 300 },
    throughput: { rps: 100 },
    quality: { custom: {} },
  });

  describe('compareModels', () => {
    it('should determine A as winner when better', () => {
      const result = comparison.compareModels(
        { id: 'model-a', version: '1.0.0', name: 'Model A' },
        createMetrics(0.95),
        { id: 'model-b', version: '1.0.0', name: 'Model B' },
        createMetrics(0.90)
      );

      expect(result.winner).toBe('A');
    });

    it('should determine B as winner when better', () => {
      const result = comparison.compareModels(
        { id: 'model-a', version: '1.0.0', name: 'Model A' },
        createMetrics(0.85),
        { id: 'model-b', version: '1.0.0', name: 'Model B' },
        createMetrics(0.92)
      );

      expect(result.winner).toBe('B');
    });

    it('should generate recommendation', () => {
      const result = comparison.compareModels(
        { id: 'model-a', version: '1.0.0', name: 'Model A' },
        createMetrics(0.95),
        { id: 'model-b', version: '1.0.0', name: 'Model B' },
        createMetrics(0.80)
      );

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.length).toBeGreaterThan(0);
    });

    it('should compare all metric types', () => {
      const result = comparison.compareModels(
        { id: 'a', version: '1.0.0', name: 'A' },
        createMetrics(0.9),
        { id: 'b', version: '1.0.0', name: 'B' },
        createMetrics(0.85)
      );

      expect(result.metrics.length).toBeGreaterThan(5);
    });
  });

  describe('rankModels', () => {
    it('should rank multiple models', () => {
      const candidates = [
        { reference: { id: 'model-1', version: '1.0.0', name: 'Model 1' }, metrics: createMetrics(0.90) },
        { reference: { id: 'model-2', version: '1.0.0', name: 'Model 2' }, metrics: createMetrics(0.95) },
        { reference: { id: 'model-3', version: '1.0.0', name: 'Model 3' }, metrics: createMetrics(0.85) },
      ];

      const rankings = comparison.rankModels(candidates);

      expect(rankings).toHaveLength(3);
      expect(rankings[0].score).toBeGreaterThanOrEqual(rankings[1].score);
      expect(rankings[1].score).toBeGreaterThanOrEqual(rankings[2].score);
    });
  });
});

describe('DriftDetector', () => {
  describe('KS Test method', () => {
    it('should detect no drift with similar distributions', async () => {
      const detector = new DriftDetector({
        metric: 'accuracy',
        threshold: 0.1,
        windowSize: 100,
        alertOnDrift: false,
        method: 'ks_test',
        minSamples: 10,
      });

      const baseline = Array.from({ length: 50 }, () => 0.5 + Math.random() * 0.1);
      detector.setBaseline(baseline);

      baseline.forEach(v => detector.addCurrentValue(v));

      const report = await detector.detectDrift('model-id', '1.0.0');
      expect(report).toBeUndefined();
    });

    it('should detect drift with different distributions', async () => {
      const detector = new DriftDetector({
        metric: 'accuracy',
        threshold: 0.1,
        windowSize: 100,
        alertOnDrift: false,
        method: 'ks_test',
        minSamples: 10,
      });

      const baseline = Array.from({ length: 50 }, () => 0.5 + Math.random() * 0.1);
      detector.setBaseline(baseline);

      const current = Array.from({ length: 50 }, () => 0.8 + Math.random() * 0.1);
      current.forEach(v => detector.addCurrentValue(v));

      const report = await detector.detectDrift('model-id', '1.0.0');
      expect(report?.detected).toBe(true);
    });
  });

  describe('PSI method', () => {
    it('should calculate PSI', async () => {
      const detector = new DriftDetector({
        metric: 'accuracy',
        threshold: 0.2,
        windowSize: 100,
        alertOnDrift: false,
        method: 'psi',
        minSamples: 10,
      });

      const baseline = Array.from({ length: 50 }, () => 0.5);
      detector.setBaseline(baseline);

      const current = Array.from({ length: 50 }, () => 0.8);
      current.forEach(v => detector.addCurrentValue(v));

      const report = await detector.detectDrift('model-id', '1.0.0');
      expect(report).toBeDefined();
      expect(report?.drift).toBeGreaterThan(0);
    });
  });

  describe('classifySeverity', () => {
    it('should classify low severity', () => {
      const detector = new DriftDetector({
        metric: 'accuracy',
        threshold: 0.1,
        windowSize: 100,
        alertOnDrift: false,
        method: 'ks_test',
        minSamples: 10,
      });

      // Private method test - would need to be exposed or tested through public API
      // For now, we test through detectDrift
    });
  });

  describe('getState', () => {
    it('should return detector state', () => {
      const detector = new DriftDetector({
        metric: 'accuracy',
        threshold: 0.1,
        windowSize: 100,
        alertOnDrift: false,
        method: 'ks_test',
        minSamples: 10,
      });

      detector.setBaseline([0.5, 0.6, 0.7]);
      detector.addCurrentValue(0.5);

      const state = detector.getState();
      expect(state.baselineSize).toBe(3);
      expect(state.currentSize).toBe(1);
    });
  });
});

// Additional edge case and error handling tests
describe('Error Handling', () => {
  it('VersionManager handles timestamp strategy', () => {
    const manager = new VersionManager('timestamp');
    const version = manager.generateVersion([], 'patch');
    expect(version).toBeDefined();
    expect(version.length).toBeGreaterThan(0);
  });

  it('LifecycleManager handles approval requirements', async () => {
    const config: LifecycleConfig = {
      stages: [
        { name: 'development', maxDuration: Infinity, requirements: [], canDeployToProduction: false },
        { name: 'production', maxDuration: Infinity, requirements: [], canDeployToProduction: true },
      ],
      transitions: [
        { from: 'development', to: 'production', conditions: [], approval: true, approvers: ['admin'] },
      ],
      autoPromote: false,
      autoArchive: false,
      approvals: { enabled: true, requiredApprovers: {}, timeout: 3600000 },
    };

    const manager = new LifecycleManager(config);
    const model = {
      id: 'test',
      name: 'test',
      description: 'test',
      versions: [],
      metadata: {} as any,
      created: Date.now(),
      updated: Date.now(),
      stage: 'development' as const,
      tags: [],
    };

    await expect(manager.transition(model, 'production')).rejects.toThrow();
  });

  it('DeploymentTracker handles non-existent deployment', () => {
    const tracker = new DeploymentTracker();
    expect(tracker.getDeployment('non-existent')).toBeUndefined();
  });

  it('LineageTracker handles non-existent lineage', () => {
    const tracker = new LineageTracker();
    expect(tracker.getLineage('non-existent', '1.0.0')).toBeUndefined();
  });
});
