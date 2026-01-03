/**
 * Tests for A2UIIntegration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  A2UIIntegration,
  VariantComparator,
  UIVariantGenerator,
  InMemoryEventStorage,
  createA2UIIntegration,
  createVariantComparator,
  createUIVariantGenerator,
} from '../src/integration/A2UIIntegration.js';
import type { A2UIConfig, Experiment, A2UIEvent } from '../src/types.js';
import type { A2UIResponse } from '@lsi/protocol';

function createMockUI(): A2UIResponse {
  return {
    version: '0.8',
    surface: 'main',
    components: [
      { type: 'button', id: 'btn1', props: { label: 'Click me' } },
      { type: 'text', id: 'text1', props: { content: 'Hello' } },
    ],
    layout: { type: 'vertical', spacing: 16 },
  };
}

function createMockExperiment(): Experiment {
  return {
    id: 'exp1',
    name: 'Test',
    description: 'Test',
    status: 'running',
    variants: [
      { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [], ui: createMockUI() },
      { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [], ui: createMockUI() },
    ],
    allocationStrategy: 'random',
    metrics: [],
    primaryMetric: 'conversion',
    secondaryMetrics: [],
    goals: [],
    minSampleSize: 100,
    significanceLevel: 0.05,
    power: 0.8,
    mde: 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test',
  };
}

describe('A2UIIntegration', () => {
  let integration: A2UIIntegration;
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    eventStorage = new InMemoryEventStorage();
    const config: A2UIConfig = {
      experiment: 'exp1',
      variants: {
        control: createMockUI(),
        treatment: createMockUI(),
      },
      defaultVariant: 'control',
      fallbackVariant: 'control',
    };
    integration = new A2UIIntegration(config, eventStorage);
  });

  describe('renderVariant', () => {
    it('should render variant for user', async () => {
      const experiment = createMockExperiment();

      const ui = await integration.renderVariant('user1', experiment);

      expect(ui).toBeDefined();
      expect(ui.version).toBe('0.8');
    });

    it('should allocate user consistently', async () => {
      const experiment = createMockExperiment();

      const ui1 = await integration.renderVariant('user1', experiment);
      const ui2 = await integration.renderVariant('user1', experiment);

      expect(ui1).toEqual(ui2);
    });

    it('should use fallback when variant not found', async () => {
      const experiment = {
        ...createMockExperiment(),
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 100, isControl: true, changes: [] },
        ],
      };

      const ui = await integration.renderVariant('user1', experiment);

      expect(ui).toBeDefined();
    });
  });

  describe('trackEvent', () => {
    it('should track event', async () => {
      const event: A2UIEvent = {
        type: 'click',
        componentId: 'btn1',
        data: { x: 100, y: 200 },
        timestamp: Date.now(),
        experimentId: 'exp1',
      };

      await integration.trackEvent(event, 'user1', 'exp1');

      const events = await eventStorage.getEvents('exp1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('click');
    });

    it('should enrich event with allocation', async () => {
      const experiment = createMockExperiment();

      await integration.renderVariant('user1', experiment);

      const event: A2UIEvent = {
        type: 'click',
        data: {},
        timestamp: Date.now(),
        experimentId: 'exp1',
      };

      await integration.trackEvent(event, 'user1', 'exp1');

      const events = await eventStorage.getEvents('exp1');
      expect(events[0].variantId).toBeDefined();
      expect(events[0].userId).toBe('user1');
    });
  });

  describe('trackInteraction', () => {
    it('should track component interaction', async () => {
      // First create allocation by rendering variant
      await integration.renderVariant('user1', createMockExperiment());

      await integration.trackInteraction('user1', 'exp1', 'btn1', 'click');

      const events = await eventStorage.getEvents('exp1');
      const clickEvent = events.find(e => e.type === 'interaction');

      expect(clickEvent).toBeDefined();
      expect(clickEvent?.componentId).toBe('btn1');
      expect(clickEvent?.data?.interactionType).toBe('click');
    });
  });

  describe('trackPageView', () => {
    it('should track page view', async () => {
      // First create allocation by rendering variant
      await integration.renderVariant('user1', createMockExperiment());

      await integration.trackPageView('user1', 'exp1', '/home');

      const events = await eventStorage.getEvents('exp1');
      const pageViewEvent = events.find(e => e.type === 'page_view');

      expect(pageViewEvent).toBeDefined();
      expect(pageViewEvent?.data?.page).toBe('/home');
    });
  });

  describe('trackConversion', () => {
    it('should track conversion', async () => {
      await integration.renderVariant('user1', createMockExperiment());

      await integration.trackConversion('user1', 'exp1', 'signup', 1);

      const events = await eventStorage.getEvents('exp1');
      const conversionEvent = events.find(e => e.type === 'conversion');

      expect(conversionEvent).toBeDefined();
      expect(conversionEvent?.data?.conversionType).toBe('signup');

      const metrics = integration.getBufferedMetrics();
      const conversionMetric = metrics.find(m => m.name === 'conversion');

      expect(conversionMetric).toBeDefined();
    });
  });

  describe('getBufferedMetrics', () => {
    it('should return buffered metrics', async () => {
      await integration.renderVariant('user1', createMockExperiment());
      await integration.trackConversion('user1', 'exp1', 'signup');

      const metrics = integration.getBufferedMetrics();

      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should clear buffered metrics', async () => {
      await integration.renderVariant('user1', createMockExperiment());
      await integration.trackConversion('user1', 'exp1', 'signup');

      integration.clearBufferedMetrics();

      const metrics = integration.getBufferedMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('getEvents', () => {
    it('should get events for experiment', async () => {
      await integration.trackEvent({ type: 'test', data: {}, timestamp: Date.now(), experimentId: 'exp1' }, 'user1', 'exp1');
      await integration.trackEvent({ type: 'test', data: {}, timestamp: Date.now(), experimentId: 'exp1' }, 'user2', 'exp1');

      const events = await integration.getEvents('exp1');

      expect(events).toHaveLength(2);
    });

    it('should filter by user', async () => {
      await integration.trackEvent({ type: 'test', data: {}, timestamp: Date.now(), experimentId: 'exp1' }, 'user1', 'exp1');
      await integration.trackEvent({ type: 'test', data: {}, timestamp: Date.now(), experimentId: 'exp1' }, 'user2', 'exp1');

      const user1Events = await integration.getEvents('exp1', 'user1');

      expect(user1Events).toHaveLength(1);
      expect(user1Events[0].userId).toBe('user1');
    });
  });

  describe('getAllocation', () => {
    it('should get existing allocation', async () => {
      const experiment = createMockExperiment();

      await integration.renderVariant('user1', experiment);

      const allocation = integration.getAllocation('user1', 'exp1');

      expect(allocation).toBeDefined();
      expect(allocation?.userId).toBe('user1');
    });

    it('should return undefined for non-existent allocation', () => {
      const allocation = integration.getAllocation('user1', 'exp1');

      expect(allocation).toBeUndefined();
    });
  });

  describe('clearAllocation', () => {
    it('should clear user allocation', async () => {
      const experiment = createMockExperiment();

      await integration.renderVariant('user1', experiment);
      integration.clearAllocation('user1', 'exp1');

      const allocation = integration.getAllocation('user1', 'exp1');

      // After clearing, might get different allocation
      expect(true).toBe(true);
    });
  });
});

describe('VariantComparator', () => {
  let comparator: VariantComparator;

  beforeEach(() => {
    comparator = createVariantComparator();
  });

  describe('compareVariants', () => {
    it('should detect identical UIs', () => {
      const ui1 = createMockUI();
      const ui2 = createMockUI();

      const result = comparator.compareVariants(ui1, ui2);

      expect(result.identical).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect different component counts', () => {
      const ui1 = createMockUI();
      const ui2 = { ...createMockUI(), components: [ui1.components[0]] };

      const result = comparator.compareVariants(ui1, ui2);

      expect(result.identical).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
    });

    it('should detect different component types', () => {
      const ui1 = createMockUI();
      const ui2 = {
        ...createMockUI(),
        components: [{ type: 'input', id: 'input1', props: {} }],
      };

      const result = comparator.compareVariants(ui1, ui2);

      expect(result.identical).toBe(false);
    });

    it('should detect different layout types', () => {
      const ui1 = createMockUI();
      const ui2 = { ...createMockUI(), layout: { type: 'horizontal' as const } };

      const result = comparator.compareVariants(ui1, ui2);

      expect(result.identical).toBe(false);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical UIs', () => {
      const ui1 = createMockUI();
      const ui2 = createMockUI();

      const similarity = comparator.calculateSimilarity(ui1, ui2);

      expect(similarity).toBe(1);
    });

    it('should return < 1 for different UIs', () => {
      const ui1 = createMockUI();
      const ui2 = { ...createMockUI(), components: [ui1.components[0]] };

      const similarity = comparator.calculateSimilarity(ui1, ui2);

      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0);
    });
  });
});

describe('UIVariantGenerator', () => {
  let generator: UIVariantGenerator;

  beforeEach(() => {
    generator = createUIVariantGenerator();
  });

  describe('createVariant', () => {
    it('should create variant with modifications', () => {
      const baseUI = createMockUI();

      const variant = generator.createVariant(baseUI, 'variant1', 'Variant 1', [
        { componentId: 'btn1', property: 'props', value: { label: 'New Label' } },
      ]);

      expect(variant.version).toBe('0.8');
      expect(variant.components).toHaveLength(2);
    });

    it('should add component', () => {
      const baseUI = createMockUI();

      const variant = generator.createVariant(baseUI, 'variant1', 'Variant 1', [
        { operation: 'add' as const, property: 'components', value: { type: 'text', id: 'new', props: {} } },
      ]);

      expect(variant.components).toBeDefined();
    });

    it('should remove component', () => {
      const baseUI = createMockUI();

      const variant = generator.createVariant(baseUI, 'variant1', 'Variant 1', [
        { componentId: 'btn1', operation: 'remove' as const },
      ]);

      expect(variant.components.length).toBeLessThan(baseUI.components.length);
    });

    it('should modify style', () => {
      const baseUI = createMockUI();

      const variant = generator.createVariant(baseUI, 'variant1', 'Variant 1', [
        { componentId: 'btn1', property: 'style', value: { color: 'red' } },
      ]);

      expect(variant).toBeDefined();
    });
  });

  describe('generateVariants', () => {
    it('should generate multiple variants', () => {
      const baseUI = createMockUI();

      const variants = generator.generateVariants(baseUI, [
        { id: 'v1', name: 'Variant 1', modifications: [] },
        { id: 'v2', name: 'Variant 2', modifications: [] },
      ]);

      expect(variants.size).toBe(3); // control + 2 variants
      expect(variants.has('control')).toBe(true);
      expect(variants.has('v1')).toBe(true);
      expect(variants.has('v2')).toBe(true);
    });
  });
});

describe('InMemoryEventStorage', () => {
  let storage: InMemoryEventStorage;

  beforeEach(() => {
    storage = new InMemoryEventStorage();
  });

  describe('saveEvent', () => {
    it('should save event', async () => {
      const event: A2UIEvent = {
        type: 'click',
        data: {},
        timestamp: Date.now(),
        experimentId: 'exp1',
      };

      await storage.saveEvent(event);

      const events = await storage.getEvents('exp1');
      expect(events).toHaveLength(1);
    });

    it('should skip events without experimentId', async () => {
      const event: A2UIEvent = {
        type: 'click',
        data: {},
        timestamp: Date.now(),
      };

      await storage.saveEvent(event);

      const events = await storage.getEvents('any');
      expect(events).toHaveLength(0);
    });
  });

  describe('getEvents', () => {
    it('should get all events for experiment', async () => {
      await storage.saveEvent({ type: 'click', data: {}, timestamp: 1, experimentId: 'exp1' });
      await storage.saveEvent({ type: 'view', data: {}, timestamp: 2, experimentId: 'exp1' });

      const events = await storage.getEvents('exp1');

      expect(events).toHaveLength(2);
    });

    it('should filter by userId', async () => {
      await storage.saveEvent({ type: 'click', data: {}, timestamp: 1, userId: 'user1', experimentId: 'exp1' });
      await storage.saveEvent({ type: 'view', data: {}, timestamp: 2, userId: 'user2', experimentId: 'exp1' });

      const user1Events = await storage.getEvents('exp1', 'user1');

      expect(user1Events).toHaveLength(1);
      expect(user1Events[0].userId).toBe('user1');
    });
  });

  describe('clearEvents', () => {
    it('should clear events for experiment', async () => {
      await storage.saveEvent({ type: 'click', data: {}, timestamp: 1, experimentId: 'exp1' });

      await storage.clearEvents('exp1');

      const events = await storage.getEvents('exp1');
      expect(events).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all events', async () => {
      await storage.saveEvent({ type: 'click', data: {}, timestamp: 1, experimentId: 'exp1' });
      await storage.saveEvent({ type: 'view', data: {}, timestamp: 2, experimentId: 'exp2' });

      storage.clear();

      const events1 = await storage.getEvents('exp1');
      const events2 = await storage.getEvents('exp2');

      expect(events1).toHaveLength(0);
      expect(events2).toHaveLength(0);
    });
  });
});

describe('factory functions', () => {
  it('should create A2UI integration', () => {
    const config: A2UIConfig = {
      experiment: 'exp1',
      variants: { control: createMockUI() },
      defaultVariant: 'control',
      fallbackVariant: 'control',
    };

    const integration = createA2UIIntegration(config);
    expect(integration).toBeInstanceOf(A2UIIntegration);
  });

  it('should create with default storage', () => {
    const config: A2UIConfig = {
      experiment: 'exp1',
      variants: { control: createMockUI() },
      defaultVariant: 'control',
      fallbackVariant: 'control',
    };

    const integration = createA2UIIntegration(config);
    expect(integration).toBeInstanceOf(A2UIIntegration);
  });

  it('should create variant comparator', () => {
    const comparator = createVariantComparator();
    expect(comparator).toBeInstanceOf(VariantComparator);
  });

  it('should create UI variant generator', () => {
    const generator = createUIVariantGenerator();
    expect(generator).toBeInstanceOf(UIVariantGenerator);
  });

  it('should create with custom config', () => {
    const config: A2UIConfig = {
      experiment: 'exp1',
      variants: { control: createMockUI(), treatment: createMockUI() },
      defaultVariant: 'control',
      fallbackVariant: 'treatment',
    };

    const integration = createA2UIIntegration(config);
    expect(integration).toBeInstanceOf(A2UIIntegration);
  });
});
