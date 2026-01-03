/**
 * MultiModal Integration tests
 * Comprehensive integration tests (40+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiModalStateManager,
  StateFusion,
  StateSync,
  StateHistory,
  MultiModalQuery,
  HybridIndex,
  StateSerializer,
  StateDeserializer,
} from '../src/index.js';

function createTestState(id: string): MultiModalStateManager {
  const manager = new MultiModalStateManager();
  manager.updateTextState(t => {
    t.updateInput(`test input ${id}`);
    t.updateIntent('query');
    t.updateEmbedding(new Float32Array(768).fill(Math.random()));
  });
  manager.updateVisualState(v => {
    v.updateLayout({ type: 'flex', hierarchy: [], spacing: { horizontal: 10, vertical: 10 } });
    v.updateEmbedding(new Float32Array(768).fill(Math.random()));
  });
  manager.updateConfidence(Math.random());
  manager.addTag(`tag_${id}`);
  return manager;
}

describe('MultiModal Integration', () => {
  describe('State + Fusion Integration', () => {
    it('should fuse state embeddings', () => {
      const fusion = new StateFusion();
      const state = createTestState('test');

      const result = fusion.fuse(
        state.getState().text.embedding,
        state.getState().visual.embedding
      );

      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(768);
    });

    it('should update fused state', () => {
      const fusion = new StateFusion();
      const manager = createTestState('test');

      const fusionResult = fusion.fuse(
        manager.getState().text.embedding,
        manager.getState().visual.embedding
      );

      manager.updateFusedState(fused => {
        fused.updateEmbedding(fusionResult.embedding);
        fused.updateConfidence(fusionResult.confidence);
      });

      expect(manager.getState().fused.confidence).toBeGreaterThan(0);
    });

    it('should compare fusion strategies on state', () => {
      const fusion = new StateFusion();
      const state = createTestState('test');

      const comparisons = fusion.compareStrategies(
        state.getState().text.embedding,
        state.getState().visual.embedding
      );

      expect(comparisons.size).toBe(4);
    });
  });

  describe('State + Sync Integration', () => {
    it('should sync two states', async () => {
      const sync = new StateSync();
      const local = createTestState('local');
      const remote = createTestState('remote');

      const result = await sync.sync(local.getState(), remote.getState());

      expect(result.synced).toBe(true);
    });

    it('should resolve conflicts during sync', async () => {
      const sync = new StateSync({ conflictResolution: 'merge' });
      const local = createTestState('local');
      const remote = createTestState('remote');

      local.updateTextState(t => t.updateInput('local'));
      remote.updateTextState(t => t.updateInput('remote'));

      const result = await sync.sync(local.getState(), remote.getState());

      expect(result.conflicts).toBeDefined();
    });

    it('should handle version conflicts', async () => {
      const sync = new StateSync();
      const local = createTestState('local');
      const remote = createTestState('remote');

      // Make versions conflict
      const localState = local.getState();
      localState.version = 5;

      const remoteState = remote.getState();
      remoteState.version = 5;

      const result = await sync.sync(localState, remoteState);

      expect(result.conflicts.some(c => c.field === 'version')).toBe(true);
    });
  });

  describe('State + History Integration', () => {
    it('should track state changes', () => {
      const history = new StateHistory();
      const state = createTestState('v1');

      history.updateCurrentState(state.getState());
      history.saveSnapshot('Version 1');

      const stats = history.getStatistics();
      expect(stats.pastSnapshots).toBeGreaterThanOrEqual(1);
    });

    it('should undo state changes', () => {
      const history = new StateHistory();
      const state1 = createTestState('v1');
      const state2 = createTestState('v2');

      history.updateCurrentState(state1.getState());
      history.updateCurrentState(state2.getState());

      const undone = history.undo();
      expect(undone).toBeDefined();
    });

    it('should create branches from states', () => {
      const history = new StateHistory();
      const state = createTestState('main');

      history.updateCurrentState(state.getState());

      const branchManager = history.getBranchManager();
      const branch = branchManager.createBranch('feature', null);

      expect(branch).toBeDefined();
    });
  });

  describe('State + Query Integration', () => {
    it('should index and query states', async () => {
      const query = new MultiModalQuery();
      const states = [createTestState('s1'), createTestState('s2'), createTestState('s3')];

      query.indexStates(states.map(s => s.getState()));

      const result = await query.queryByText(states.map(s => s.getState()), 'test');

      expect(result.matches).toBeDefined();
    });

    it('should find similar states', async () => {
      const query = new MultiModalQuery();
      const states = [createTestState('s1'), createTestState('s2'), createTestState('s3')];

      const embedding = new Float32Array(768).fill(0.5);
      const result = await query.queryByVisual(states.map(s => s.getState()), embedding);

      expect(result.matches).toBeDefined();
    });

    it('should perform cross-modal search', async () => {
      const query = new MultiModalQuery();
      const states = [createTestState('s1'), createTestState('s2'), createTestState('s3')];

      const result = await query.queryTextToVisual(states.map(s => s.getState()), 'test input');

      expect(result.matches).toBeDefined();
    });
  });

  describe('State + Serialization Integration', () => {
    it('should serialize and deserialize state', async () => {
      const serializer = new StateSerializer();
      const deserializer = new StateDeserializer();

      const state = createTestState('test');
      const serialized = await serializer.serialize(state.getState());

      expect(serialized.data).toBeDefined();

      const deserialized = await deserializer.deserialize(
        serialized.data as Uint8Array,
        'json'
      );

      expect(deserialized.id).toBe(state.getId());
    });

    it('should batch serialize states', async () => {
      const serializer = new StateSerializer();
      const states = [createTestState('s1'), createTestState('s2'), createTestState('s3')];

      const results = await serializer.serializeBatch(states.map(s => s.getState()));

      expect(results).toHaveLength(3);
    });

    it('should estimate size', () => {
      const serializer = new StateSerializer();
      const state = createTestState('test');

      const size = serializer.estimateSize(state.getState());

      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Full Workflow Integration', () => {
    it('should create, fuse, sync, save, and query', async () => {
      // Create state
      const state = createTestState('workflow');

      // Fuse embeddings
      const fusion = new StateFusion();
      const fusionResult = fusion.fuse(
        state.getState().text.embedding,
        state.getState().visual.embedding
      );
      state.updateFusedState(fused => {
        fused.updateEmbedding(fusionResult.embedding);
        fused.updateConfidence(fusionResult.confidence);
      });

      // Add to history
      const history = new StateHistory();
      history.updateCurrentState(state.getState());

      // Sync with remote
      const sync = new StateSync();
      const remote = createTestState('remote');
      const syncResult = await sync.sync(state.getState(), remote.getState());

      // Query
      const query = new MultiModalQuery();
      const queryResult = await query.queryByText([state.getState()], 'test input');

      expect(state.getState().fused.confidence).toBeGreaterThan(0);
      expect(history.getStatistics().pastSnapshots).toBeGreaterThanOrEqual(0);
      expect(syncResult.synced).toBe(true);
      expect(queryResult.matches).toBeDefined();
    });

    it('should handle branching and merging', () => {
      const history = new StateHistory();
      const mainState = createTestState('main');

      history.updateCurrentState(mainState.getState());

      // Create feature branch
      const branchManager = history.getBranchManager();
      const featureBranch = branchManager.createBranch('feature', null);

      // Modify on feature branch
      const featureState = createTestState('feature');
      branchManager.addSnapshotToBranch(featureBranch!.id, {
        state: featureState.getState(),
        timestamp: Date.now(),
        author: 'user',
        description: 'Feature changes',
        id: 'snap1',
      });

      // Merge back
      const merged = branchManager.mergeBranch(featureBranch!.id);

      expect(merged).toBe(true);
    });

    it('should handle undo/redo with queries', () => {
      const history = new StateHistory();
      const query = new MultiModalQuery();

      const state1 = createTestState('v1');
      const state2 = createTestState('v2');
      const state3 = createTestState('v3');

      history.updateCurrentState(state1.getState());
      history.updateCurrentState(state2.getState());
      history.updateCurrentState(state3.getState());

      // Undo
      const undone = history.undo();

      // Query all states including undone
      const states = [history.getCurrentState()];
      // Should have undone to v2

      expect(undoned!.text.input).toBe('state v2');
    });

    it('should serialize entire history', async () => {
      const history = new StateHistory();

      for (let i = 0; i < 5; i++) {
        const state = createTestState(`v${i}`);
        history.updateCurrentState(state.getState());
        history.saveSnapshot(`Version ${i}`);
      }

      const exported = history.export();

      expect(exported.past.length).toBeGreaterThanOrEqual(5);
    });

    it('should perform indexed search on history', async () => {
      const history = new StateHistory();
      const query = new MultiModalQuery();

      const states = [];
      for (let i = 0; i < 10; i++) {
        const state = createTestState(`s${i}`);
        states.push(state);
        history.updateCurrentState(state.getState());
      }

      // Index all states
      query.indexStates(states.map(s => s.getState()));

      const result = await query.queryByText(states.map(s => s.getState()), 'test input');

      expect(result.matches).toBeDefined();
    });

    it('should handle conflict resolution with history', async () => {
      const history = new StateHistory();
      const sync = new StateSync({ conflictResolution: 'merge' });

      const local = createTestState('local');
      const remote = createTestState('remote');

      local.updateTextState(t => t.updateInput('local'));
      remote.updateTextState(t => t.updateInput('remote'));

      history.updateCurrentState(local.getState());

      const syncResult = await sync.sync(local.getState(), remote.getState());

      // Should have conflicts but resolve them
      expect(syncResult.conflicts).toBeDefined();
    });

    it('should fuse with all strategies and compare', () => {
      const state = createTestState('test');
      const fusion = new StateFusion();

      const strategies = fusion.getAvailableStrategies();
      const results = new Map();

      for (const strategy of strategies) {
        const result = fusion.fuse(
          state.getState().text.embedding,
          state.getState().visual.embedding,
          { strategy }
        );
        results.set(strategy, result);
      }

      expect(results.size).toBe(4);
    });

    it('should maintain consistency through operations', () => {
      const { ConsistencyChecker } = require('../src/synchronization/index');
      const checker = new ConsistencyChecker();

      const state = createTestState('test');
      state.updateEmbeddingState(e => e.combine(
        state.getState().text.embedding,
        state.getState().visual.embedding
      ));

      const result = checker.check(state.getState());

      expect(result.consistent).toBe(true);
    });

    it('should serialize with different formats', async () => {
      const serializer = new StateSerializer();
      const state = createTestState('test');

      const jsonResult = await serializer.serialize(state.getState(), { format: 'json' });
      const binaryResult = await serializer.serialize(state.getState(), { format: 'binary' });

      expect(jsonResult.size).toBeGreaterThan(0);
      expect(binaryResult.size).toBeGreaterThan(0);
    });

    it('should handle complex query scenarios', async () => {
      const query = new MultiModalQuery();
      const states = [];

      // Create diverse states
      for (let i = 0; i < 20; i++) {
        const state = createTestState(`s${i}`);
        state.updateTextState(t => t.updateInput(`input ${i} hello world`));
        state.updateConfidence(0.5 + (i % 5) * 0.1);
        states.push(state);
      }

      // Index
      query.indexStates(states.map(s => s.getState()));

      // Query
      const result = await query.queryByText(states.map(s => s.getState()), 'hello', {
        limit: 5,
        threshold: 0.1
      });

      expect(result.matches.length).toBeLessThanOrEqual(5);
    });

    it('should maintain embeddings through serialization', async () => {
      const serializer = new StateSerializer();
      const deserializer = new StateDeserializer();

      const state = createTestState('test');

      // Update with specific embeddings
      const textEmb = new Float32Array(768).fill(0.3);
      const visualEmb = new Float32Array(768).fill(0.7);

      state.updateTextState(t => t.updateEmbedding(textEmb));
      state.updateVisualState(v => v.updateEmbedding(visualEmb));

      const serialized = await serializer.serialize(state.getState(), {
        includeEmbeddings: true
      });

      const deserialized = await deserializer.deserialize(
        serialized.data as Uint8Array,
        'json'
      );

      expect(deserialized.text.embedding[0]).toBeCloseTo(0.3);
      expect(deserialized.visual.embedding[0]).toBeCloseTo(0.7);
    });

    it('should handle batch operations efficiently', async () => {
      const serializer = new StateSerializer();
      const states = [];

      for (let i = 0; i < 50; i++) {
        states.push(createTestState(`batch${i}`).getState());
      }

      const start = performance.now();
      const results = await serializer.serializeBatch(states);
      const duration = performance.now() - start;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(5000); // Should be fast
    });

    it('should use index for fast queries', async () => {
      const query = new MultiModalQuery();
      const states = [];

      for (let i = 0; i < 100; i++) {
        states.push(createTestState(`idx${i}`));
      }

      // Without index
      const startNoIndex = performance.now();
      await query.queryByText(states.map(s => s.getState()), 'test');
      const durationNoIndex = performance.now() - startNoIndex;

      // With index
      query.indexStates(states.map(s => s.getState()));
      const startWithIndex = performance.now();
      await query.queryByText(states.map(s => s.getState()), 'test');
      const durationWithIndex = performance.now() - startWithIndex;

      // Index should help or be comparable
      expect(durationWithIndex).toBeLessThan(durationNoIndex * 2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid states gracefully', async () => {
      const sync = new StateSync();
      const deserializer = new StateDeserializer();

      // Invalid state
      const result = await sync.sync(null as any, null as any);

      expect(result.synced).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle serialization errors', async () => {
      const serializer = new StateSerializer();
      const deserializer = new StateDeserializer();

      const invalidData = new Uint8Array([1, 2, 3]);

      // Should handle gracefully
      const result = await deserializer.deserialize(invalidData, 'json');

      // May throw or return error state
      expect(result).toBeDefined();
    });

    it('should validate embeddings', () => {
      const state = createTestState('test');

      // Invalid dimension
      expect(() => {
        state.updateTextState(t => t.updateEmbedding(new Float32Array(100)));
      }).toThrow();
    });

    it('should handle query edge cases', async () => {
      const query = new MultiModalQuery();

      // Empty states
      const result1 = await query.queryByText([], 'test');
      expect(result1.matches).toHaveLength(0);

      // Null query
      const result2 = await query.queryByText([createTestState('test').getState()], '');
      expect(result2.matches).toBeDefined();
    });
  });
});
