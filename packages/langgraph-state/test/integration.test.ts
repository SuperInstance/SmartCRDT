/**
 * @lsi/langgraph-state - Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LangGraphStateManager,
  CoAgentsStateSynchronizer,
  VLJEPAStateManager,
  A2UIStateManager,
  IntegratedStateManager,
  createLangGraphStateManager,
  createCoAgentsStateSynchronizer,
  createVLJEPAStateManager,
  createA2UIStateManager,
  createIntegratedStateManager,
  AdvancedStateManager
} from '../src/integration.js';

describe('LangGraphStateManager', () => {
  let manager: LangGraphStateManager<{ foo: string }>;

  beforeEach(() => {
    manager = createLangGraphStateManager({ foo: 'bar' });
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('getState', () => {
    it('should get current state', () => {
      const state = manager.getState();
      expect(state).toEqual({ foo: 'bar' });
    });
  });

  describe('update', () => {
    it('should update state with reducer', async () => {
      await manager.update(async (state) => ({ ...state, foo: 'baz' }));
      expect(manager.getState().foo).toBe('baz');
    });
  });

  describe('createChannel', () => {
    it('should create state channel', () => {
      const channel = manager.createChannel('foo');
      expect(channel.name).toBe('foo');
      expect(channel.value).toBe('bar');
    });
  });

  describe('createAnnotation', () => {
    it('should create state annotation', () => {
      const annotation = manager.createAnnotation();
      expect(annotation.channels).toBeDefined();
      expect(annotation.channels.foo).toBeDefined();
    });
  });

  describe('snapshots', () => {
    it('should create snapshot', async () => {
      const id = await manager.createSnapshot('test');
      expect(id).toBeTruthy();
    });

    it('should restore snapshot', async () => {
      const id = await manager.createSnapshot('test');
      await manager.update(async (s) => ({ ...s, foo: 'changed' }));
      await manager.restoreSnapshot(id);
      expect(manager.getState().foo).toBe('bar');
    });
  });

  describe('onChange', () => {
    it('should subscribe to changes', async () => {
      let changed = false;
      manager.onChange(() => { changed = true; });
      await manager.update(async (s) => ({ ...s, foo: 'baz' }));
      expect(changed).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should get history', async () => {
      await manager.update(async (s) => ({ ...s, foo: 'baz' }));
      const history = manager.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });
});

describe('CoAgentsStateSynchronizer', () => {
  let stateManager: AdvancedStateManager;
  let sync: CoAgentsStateSynchronizer;
  let coAgentsState: Record<string, unknown>;

  beforeEach(() => {
    stateManager = new AdvancedStateManager({});
    sync = createCoAgentsStateSynchronizer(stateManager);
    coAgentsState = {};
  });

  afterEach(async () => {
    sync.destroy();
    await stateManager.destroy();
  });

  describe('sync', () => {
    it('should sync state to CoAgents', async () => {
      await stateManager.setState('global', 'foo', 'bar', 'merge');
      await sync.sync(coAgentsState);
      expect(coAgentsState.foo).toBe('bar');
    });

    it('should sync from CoAgents', async () => {
      coAgentsState.foo = 'bar';
      await sync.syncFrom(coAgentsState);
      const state = stateManager.getState('global', 'foo');
      expect(state).toBe('bar');
    });
  });

  describe('start/stop', () => {
    it('should start syncing', () => {
      sync.start(coAgentsState);
      expect((sync as any).syncIntervals.size).toBe(1);
    });

    it('should stop syncing', () => {
      sync.start(coAgentsState);
      sync.stop();
      expect((sync as any).syncIntervals.size).toBe(0);
    });
  });
});

describe('VLJEPAStateManager', () => {
  let stateManager: AdvancedStateManager;
  let vljepa: VLJEPAStateManager;

  beforeEach(() => {
    stateManager = new AdvancedStateManager({});
    vljepa = createVLJEPAStateManager(stateManager);
  });

  afterEach(async () => {
    await stateManager.destroy();
  });

  describe('setEmbedding', () => {
    it('should set embedding', async () => {
      await vljepa.setEmbedding([1, 2, 3], 1);
      const embedding = vljepa.getEmbedding();
      expect(embedding?.embedding).toEqual([1, 2, 3]);
    });
  });

  describe('setGoalEmbedding', () => {
    it('should set goal embedding', async () => {
      await vljepa.setEmbedding([1, 2, 3], 1);
      await vljepa.setGoalEmbedding([4, 5, 6]);
      const embedding = vljepa.getEmbedding();
      expect(embedding?.goalEmbedding).toEqual([4, 5, 6]);
    });
  });

  describe('setUIFrameEmbedding', () => {
    it('should set UI frame embedding', async () => {
      await vljepa.setEmbedding([1, 2, 3], 1);
      await vljepa.setUIFrameEmbedding([7, 8, 9]);
      const embedding = vljepa.getEmbedding();
      expect(embedding?.uiFrameEmbedding).toEqual([7, 8, 9]);
    });
  });

  describe('setUserIntentEmbedding', () => {
    it('should set user intent embedding', async () => {
      await vljepa.setEmbedding([1, 2, 3], 1);
      await vljepa.setUserIntentEmbedding([10, 11, 12]);
      const embedding = vljepa.getEmbedding();
      expect(embedding?.userIntentEmbedding).toEqual([10, 11, 12]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity', () => {
      const a = [1, 2, 3];
      const b = [2, 4, 6];
      const similarity = vljepa.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle different vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = vljepa.cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });

  describe('findMostSimilar', () => {
    it('should find most similar embedding', async () => {
      await vljepa.setEmbedding([1, 2, 3], 1);
      const result = vljepa.findMostSimilar([1, 2, 3]);
      expect(result).toBeDefined();
    });
  });
});

describe('A2UIStateManager', () => {
  let stateManager: AdvancedStateManager;
  let a2ui: A2UIStateManager;

  beforeEach(() => {
    stateManager = new AdvancedStateManager({});
    a2ui = createA2UIStateManager(stateManager);
  });

  afterEach(async () => {
    await stateManager.destroy();
  });

  describe('registerComponent', () => {
    it('should register component', async () => {
      const component = {
        id: 'test-comp',
        type: 'button',
        props: { label: 'Click' },
        state: { clicked: false }
      };
      await a2ui.registerComponent(component);
      const retrieved = a2ui.getComponent('test-comp');
      expect(retrieved).toEqual(component);
    });
  });

  describe('updateComponentProps', () => {
    it('should update component props', async () => {
      const component = {
        id: 'test-comp',
        type: 'button',
        props: { label: 'Click' },
        state: {}
      };
      await a2ui.registerComponent(component);
      await a2ui.updateComponentProps('test-comp', { label: 'Updated' });
      const retrieved = a2ui.getComponent('test-comp');
      expect(retrieved?.props.label).toBe('Updated');
    });
  });

  describe('updateComponentState', () => {
    it('should update component state', async () => {
      const component = {
        id: 'test-comp',
        type: 'button',
        props: {},
        state: { clicked: false }
      };
      await a2ui.registerComponent(component);
      await a2ui.updateComponentState('test-comp', { clicked: true });
      const retrieved = a2ui.getComponent('test-comp');
      expect(retrieved?.state.clicked).toBe(true);
    });
  });

  describe('getAllComponents', () => {
    it('should get all components', async () => {
      await a2ui.registerComponent({
        id: 'comp1',
        type: 'button',
        props: {},
        state: {}
      });
      await a2ui.registerComponent({
        id: 'comp2',
        type: 'input',
        props: {},
        state: {}
      });
      const components = a2ui.getAllComponents();
      expect(components).toHaveLength(2);
    });
  });

  describe('removeComponent', () => {
    it('should remove component', async () => {
      await a2ui.registerComponent({
        id: 'test-comp',
        type: 'button',
        props: {},
        state: {}
      });
      await a2ui.removeComponent('test-comp');
      const component = a2ui.getComponent('test-comp');
      expect(component).toBeUndefined();
    });
  });

  describe('setComponentLayout', () => {
    it('should set component layout', async () => {
      const component = {
        id: 'test-comp',
        type: 'button',
        props: {},
        state: {}
      };
      await a2ui.registerComponent(component);
      const layout = { x: 10, y: 20, width: 100, height: 50 };
      await a2ui.setComponentLayout('test-comp', layout);
      const retrieved = a2ui.getComponent('test-comp');
      expect(retrieved?.layout).toEqual(layout);
    });
  });

  describe('batchUpdateComponents', () => {
    it('should batch update components', async () => {
      await a2ui.registerComponent({
        id: 'comp1',
        type: 'button',
        props: { label: 'A' },
        state: {}
      });
      await a2ui.registerComponent({
        id: 'comp2',
        type: 'button',
        props: { label: 'B' },
        state: {}
      });
      await a2ui.batchUpdateComponents([
        { componentId: 'comp1', props: { label: 'Updated A' } },
        { componentId: 'comp2', props: { label: 'Updated B' } }
      ]);
      const comp1 = a2ui.getComponent('comp1');
      const comp2 = a2ui.getComponent('comp2');
      expect(comp1?.props.label).toBe('Updated A');
      expect(comp2?.props.label).toBe('Updated B');
    });
  });

  describe('snapshots', () => {
    it('should create UI snapshot', async () => {
      await a2ui.registerComponent({
        id: 'test-comp',
        type: 'button',
        props: {},
        state: {}
      });
      const id = await a2ui.createUISnapshot('test');
      expect(id).toBeTruthy();
    });

    it('should restore UI snapshot', async () => {
      await a2ui.registerComponent({
        id: 'test-comp',
        type: 'button',
        props: { label: 'A' },
        state: {}
      });
      const id = await a2ui.createUISnapshot('test');
      await a2ui.updateComponentProps('test-comp', { label: 'B' });
      await a2ui.restoreUISnapshot(id);
      const component = a2ui.getComponent('test-comp');
      expect(component?.props.label).toBe('A');
    });
  });

  describe('getUIHistory', () => {
    it('should get UI history', async () => {
      await a2ui.registerComponent({
        id: 'test-comp',
        type: 'button',
        props: {},
        state: {}
      });
      await a2ui.updateComponentProps('test-comp', { label: 'Updated' });
      const history = a2ui.getUIHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });
});

describe('IntegratedStateManager', () => {
  let manager: IntegratedStateManager;

  beforeEach(() => {
    manager = createIntegratedStateManager({ foo: 'bar' });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('initialization', () => {
    it('should create all integrations', () => {
      expect(manager.langgraph).toBeDefined();
      expect(manager.coagents).toBeDefined();
      expect(manager.vljepa).toBeDefined();
      expect(manager.a2ui).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize all integrations', async () => {
      const coAgentsState = { sync: 'test' };
      await manager.initialize(coAgentsState);
      expect((manager.coagents as any).syncIntervals.size).toBe(1);
    });
  });

  describe('getUnifiedState', () => {
    it('should get unified state', () => {
      const state = manager.getUnifiedState();
      expect(state).toBeDefined();
      expect(state.langgraph).toBeDefined();
      expect(state.vljepa).toBeDefined();
      expect(state.a2ui).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all integrations', async () => {
      const coAgentsState = {};
      await manager.initialize(coAgentsState);
      await manager.shutdown();
      expect((manager.coagents as any).syncIntervals.size).toBe(0);
    });
  });
});

describe('Factory Functions', () => {
  it('should create LangGraph state manager', () => {
    const manager = createLangGraphStateManager({ foo: 'bar' });
    expect(manager).toBeInstanceOf(LangGraphStateManager);
  });

  it('should create CoAgents synchronizer', () => {
    const stateManager = new AdvancedStateManager({});
    const sync = createCoAgentsStateSynchronizer(stateManager);
    expect(sync).toBeInstanceOf(CoAgentsStateSynchronizer);
  });

  it('should create VL-JEPA manager', () => {
    const stateManager = new AdvancedStateManager({});
    const vljepa = createVLJEPAStateManager(stateManager);
    expect(vljepa).toBeInstanceOf(VLJEPAStateManager);
  });

  it('should create A2UI manager', () => {
    const stateManager = new AdvancedStateManager({});
    const a2ui = createA2UIStateManager(stateManager);
    expect(a2ui).toBeInstanceOf(A2UIStateManager);
  });

  it('should create integrated manager', () => {
    const manager = createIntegratedStateManager();
    expect(manager).toBeInstanceOf(IntegratedStateManager);
  });
});
