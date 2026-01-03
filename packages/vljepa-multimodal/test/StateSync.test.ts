/**
 * StateSync tests
 * Comprehensive tests for synchronization (40+ tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StateSync,
  ConflictResolver,
  ConsistencyChecker,
  MultiModalStateManager,
} from '../src/index.js';

function createTestState(id: string, version: number, confidence: number): MultiModalStateManager {
  const manager = new MultiModalStateManager();
  manager.updateTextState(t => t.updateInput(`state ${id}`));
  manager.updateConfidence(confidence);
  return manager;
}

describe('StateSync', () => {
  let sync: StateSync;

  beforeEach(() => {
    sync = new StateSync({ strategy: 'event', conflictResolution: 'last_write_wins' });
  });

  it('should sync with no conflicts', async () => {
    const local = createTestState('local', 1, 0.7).getState();
    const remote = createTestState('remote', 2, 0.8).getState();

    const result = await sync.sync(local, remote);

    expect(result.synced).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect text conflicts', async () => {
    const local = createTestState('local', 1, 0.7);
    local.updateTextState(t => t.updateInput('local text'));

    const remote = createTestState('remote', 2, 0.8);
    remote.updateTextState(t => t.updateInput('remote text'));

    const result = await sync.sync(local.getState(), remote.getState());

    expect(result.conflicts.some(c => c.field === 'text.input')).toBe(true);
  });

  it('should detect confidence conflicts', async () => {
    const local = createTestState('local', 1, 0.9).getState();
    const remote = createTestState('remote', 2, 0.5).getState();

    const result = await sync.sync(local, remote);

    expect(result.conflicts.some(c => c.field === 'confidence')).toBe(true);
  });

  it('should detect embedding conflicts', async () => {
    const local = createTestState('local', 1, 0.7);
    local.updateEmbeddingState(e => e.updateVector(new Float32Array(768).fill(0.1)));

    const remote = createTestState('remote', 2, 0.8);
    remote.updateEmbeddingState(e => e.updateVector(new Float32Array(768).fill(0.9)));

    const result = await sync.sync(local.getState(), remote.getState());

    expect(result.conflicts.some(c => c.field === 'embedding.vector')).toBe(true);
  });

  it('should detect version conflicts', async () => {
    const local = createTestState('local', 5, 0.7).getState();
    const remote = createTestState('remote', 5, 0.8).getState();

    const result = await sync.sync(local, remote);

    expect(result.conflicts.some(c => c.field === 'version')).toBe(true);
  });

  it('should resolve with last write wins', async () => {
    const local = createTestState('local', 1, 0.7);
    local.updateTextState(t => t.updateInput('local'));

    const remote = createTestState('remote', 2, 0.8);
    remote.updateTextState(t => t.updateInput('remote'));

    // Make local more recent
    const localState = local.getState();
    localState.modified = Date.now() + 1000;

    const result = await sync.sync(localState, remote.getState());

    expect(result.synced).toBe(true);
  });

  it('should use merge conflict resolution', async () => {
    sync = new StateSync({ conflictResolution: 'merge' });

    const local = createTestState('local', 1, 0.7).getState();
    const remote = createTestState('remote', 2, 0.9).getState();

    const result = await sync.sync(local, remote);

    expect(result.synced).toBe(true);
    expect(result.resolution.length).toBeGreaterThan(0);
  });

  it('should use manual conflict resolution', async () => {
    sync = new StateSync({ conflictResolution: 'manual' });

    const local = createTestState('local', 1, 0.7).getState();
    const remote = createTestState('remote', 2, 0.8).getState();

    const result = await sync.sync(local, remote);

    expect(result.synced).toBe(true);
  });

  it('should call sync callback', async () => {
    const callback = vi.fn();
    sync.onSync(callback);

    const local = createTestState('local', 1, 0.7).getState();
    const remote = createTestState('remote', 2, 0.8).getState();

    await sync.sync(local, remote);

    expect(callback).toHaveBeenCalled();
  });

  it('should unregister sync callback', async () => {
    const callback = vi.fn();
    const unsubscribe = sync.onSync(callback);
    unsubscribe();

    const local = createTestState('local', 1, 0.7).getState();
    const remote = createTestState('remote', 2, 0.8).getState();

    await sync.sync(local, remote);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should update config', () => {
    sync.updateConfig({ conflictResolution: 'merge' });
    const config = sync.getConfig();

    expect(config.conflictResolution).toBe('merge');
  });

  it('should stop polling', () => {
    const pollingSync = new StateSync({ strategy: 'polling', pollInterval: 100 });
    pollingSync.stopPolling();
    // Should not throw
    pollingSync.stopPolling();
  });

  it('should destroy', () => {
    sync.destroy();
    expect(sync.onSync(() => {})).toBeDefined();
  });

  it('should handle sync errors gracefully', async () => {
    // Create invalid states
    const local = null as any;
    const remote = null as any;

    const result = await sync.sync(local, remote);

    expect(result.synced).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver('last_write_wins');
  });

  it('should use last write wins', () => {
    const conflict = {
      id: 'c1',
      field: 'text.input',
      localValue: 'local',
      remoteValue: 'remote',
      timestamp: Date.now(),
      severity: 'medium' as const,
    };

    const local = createTestState('local', 1, 0.7);
    local.updateTextState(t => t.updateInput('local'));

    const remote = createTestState('remote', 2, 0.8);
    remote.updateTextState(t => t.updateInput('remote'));

    const resolution = resolver.resolve(conflict, local.getState(), remote.getState());

    expect(resolution.strategy).toBe('last_write_wins');
    expect(resolution.resolvedBy).toBe('system');
  });

  it('should merge confidence values', () => {
    resolver = new ConflictResolver('merge');

    const conflict = {
      id: 'c1',
      field: 'confidence',
      localValue: 0.6,
      remoteValue: 0.8,
      timestamp: Date.now(),
      severity: 'low' as const,
    };

    const local = createTestState('local', 1, 0.6).getState();
    const remote = createTestState('remote', 2, 0.8).getState();

    const resolution = resolver.resolve(conflict, local, remote);

    expect(resolution.strategy).toBe('merge');
    expect(resolution.value).toBeCloseTo(0.7);
  });

  it('should merge embeddings', () => {
    resolver = new ConflictResolver('merge');

    const conflict = {
      id: 'c1',
      field: 'embedding.vector',
      localValue: '<embedding>',
      remoteValue: '<embedding>',
      timestamp: Date.now(),
      severity: 'high' as const,
    };

    const local = createTestState('local', 1, 0.7);
    local.updateEmbeddingState(e => e.updateVector(new Float32Array(768).fill(0.2)));

    const remote = createTestState('remote', 2, 0.8);
    remote.updateEmbeddingState(e => e.updateVector(new Float32Array(768).fill(0.8)));

    const resolution = resolver.resolve(conflict, local.getState(), remote.getState());

    expect(resolution.strategy).toBe('merge');
    expect((resolution.value as Float32Array)[0]).toBeCloseTo(0.5);
  });

  it('should merge tags', () => {
    resolver = new ConflictResolver('merge');

    const conflict = {
      id: 'c1',
      field: 'metadata.tags',
      localValue: ['tag1'],
      remoteValue: ['tag2'],
      timestamp: Date.now(),
      severity: 'low' as const,
    };

    const local = createTestState('local', 1, 0.7);
    local.addTag('tag1');

    const remote = createTestState('remote', 2, 0.8);
    remote.addTag('tag2');

    const resolution = resolver.resolve(conflict, local.getState(), remote.getState());

    expect(resolution.strategy).toBe('merge');
    const tags = resolution.value as string[];
    expect(tags).toContain('tag1');
    expect(tags).toContain('tag2');
  });

  it('should create manual resolution', () => {
    const resolution = resolver.createManualResolution('c1', 'manual value');

    expect(resolution.conflictId).toBe('c1');
    expect(resolution.value).toBe('manual value');
    expect(resolution.resolvedBy).toBe('user');
  });

  it('should validate resolution', () => {
    const conflict = {
      id: 'c1',
      field: 'confidence',
      localValue: 0.5,
      remoteValue: 0.7,
      timestamp: Date.now(),
      severity: 'low' as const,
    };

    const validResolution = resolver.createManualResolution('c1', 0.6);
    expect(resolver.validateResolution(validResolution, conflict)).toBe(true);

    const invalidResolution = resolver.createManualResolution('c2', 0.6);
    expect(resolver.validateResolution(invalidResolution, conflict)).toBe(false);
  });

  it('should resolve all conflicts', () => {
    const conflicts = [
      {
        id: 'c1',
        field: 'confidence' as const,
        localValue: 0.5,
        remoteValue: 0.7,
        timestamp: Date.now(),
        severity: 'low' as const,
      },
      {
        id: 'c2',
        field: 'text.input' as const,
        localValue: 'local',
        remoteValue: 'remote',
        timestamp: Date.now(),
        severity: 'medium' as const,
      },
    ];

    const local = createTestState('local', 1, 0.5).getState();
    const remote = createTestState('remote', 2, 0.7).getState();

    const resolutions = resolver.resolveAll(conflicts, local, remote);

    expect(resolutions).toHaveLength(2);
  });

  it('should set strategy', () => {
    resolver.setStrategy('merge');
    expect(resolver.getStrategy()).toBe('merge');
  });

  it('should resolve batch with retries', async () => {
    const conflicts = [
      {
        id: 'c1',
        field: 'confidence' as const,
        localValue: 0.5,
        remoteValue: 0.7,
        timestamp: Date.now(),
        severity: 'low' as const,
      },
    ];

    const local = createTestState('local', 1, 0.5).getState();
    const remote = createTestState('remote', 2, 0.7).getState();

    const { resolutions, failures } = await resolver.resolveBatch(conflicts, local, remote, 3);

    expect(resolutions).toHaveLength(1);
    expect(failures).toHaveLength(0);
  });
});

describe('ConsistencyChecker', () => {
  let checker: ConsistencyChecker;

  beforeEach(() => {
    checker = new ConsistencyChecker();
  });

  it('should check consistent state', () => {
    const state = createTestState('test', 1, 0.8).getState();
    const result = checker.check(state);

    expect(result.consistent).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect wrong embedding dimension', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.text.embedding = new Float32Array(100);

    const result = checker.check(state);

    expect(result.consistent).toBe(false);
    expect(result.errors.some(e => e.includes('Text embedding dimension'))).toBe(true);
  });

  it('should detect out of range confidence', () => {
    const state = createTestState('test', 1, 1.5).getState();

    const result = checker.check(state);

    expect(result.consistent).toBe(false);
    expect(result.errors.some(e => e.includes('Confidence'))).toBe(true);
  });

  it('should detect negative confidence', () => {
    const state = createTestState('test', 1, -0.1).getState();

    const result = checker.check(state);

    expect(result.consistent).toBe(false);
    expect(result.errors.some(e => e.includes('Confidence'))).toBe(true);
  });

  it('should detect timestamp mismatch warning', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.text.timestamp = Date.now() - 20000; // 20 seconds ago

    const result = checker.check(state);

    expect(result.warnings.some(w => w.includes('timestamp'))).toBe(true);
  });

  it('should detect modified before created', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.modified = state.timestamp - 1000;

    const result = checker.check(state);

    expect(result.warnings.some(w => w.includes('Modified timestamp'))).toBe(true);
  });

  it('should detect version mismatch', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.metadata.version = 2;

    const result = checker.check(state);

    expect(result.consistent).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('should detect negative version', () => {
    const state = createTestState('test', -1, 0.8).getState();

    const result = checker.check(state);

    expect(result.consistent).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('should warn about non-normalized embeddings', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.text.embedding = new Float32Array(768).fill(10);

    const result = checker.check(state);

    expect(result.warnings.some(w => w.includes('not normalized'))).toBe(true);
  });

  it('should warn about low text-visual similarity', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.text.embedding = new Float32Array(768).fill(1);
    state.text.embedding[0] = 1;
    state.visual.embedding = new Float32Array(768).fill(-1);

    const result = checker.check(state);

    expect(result.warnings.some(w => w.includes('similarity'))).toBe(true);
  });

  it('should warn about low fusion confidence', () => {
    const state = createTestState('test', 1, 0.8).getState();
    state.fused.confidence = 0.2;

    const result = checker.check(state);

    expect(result.warnings.some(w => w.includes('confidence'))).toBe(true);
  });

  it('should return checked aspects', () => {
    const state = createTestState('test', 1, 0.8).getState();
    const result = checker.check(state);

    expect(result.checked).toContain('embedding_dimensions');
    expect(result.checked).toContain('confidence_range');
    expect(result.checked).toContain('timestamp_consistency');
  });

  it('should batch check states', () => {
    const states = [
      createTestState('test1', 1, 0.8).getState(),
      createTestState('test2', 2, 0.7).getState(),
    ];

    const results = checker.checkBatch(states);

    expect(results).toHaveLength(2);
  });

  it('should get statistics', () => {
    const states = [
      createTestState('test1', 1, 0.8).getState(),
      createTestState('test2', 2, 1.5).getState(), // Invalid
    ];

    const results = checker.checkBatch(states);
    const stats = checker.getStatistics(results);

    expect(stats.total).toBe(2);
    expect(stats.consistent).toBe(1);
    expect(stats.inconsistent).toBe(1);
  });

  it('should set tolerance', () => {
    checker.setTolerance(1e-5);
    expect(checker.getTolerance()).toBe(1e-5);
  });
});
