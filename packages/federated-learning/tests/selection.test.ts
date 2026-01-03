/**
 * @fileoverview Tests for client selection strategies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClientStateManager,
  RandomUniformSelector,
  RandomStratifiedSelector,
  ImportanceQualitySelector,
  ImportanceAdaptiveSelector,
  FairnessDiverseSelector,
  SelectionStrategy,
  createDefaultContext,
  createClientState,
  SelectorFactory,
  type ClientId,
  type SelectionContext,
} from '../src/selection';

describe('ClientStateManager', () => {
  let manager: ClientStateManager;

  beforeEach(() => {
    manager = new ClientStateManager();
  });

  describe('client registration', () => {
    it('should register a new client', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      expect(manager.getTotalClientCount()).toBe(1);
      expect(manager.getClient('client-1')).toEqual(client);
    });

    it('should update existing client on re-registration', () => {
      const client1 = createClientState('client-1', 1000);
      manager.registerClient(client1);

      const client2 = createClientState('client-1', 1500, {
        systemLoad: 0.8,
      });
      manager.registerClient(client2);

      expect(manager.getClient('client-1')?.dataDistribution.sampleCount).toBe(
        1500
      );
    });
  });

  describe('availability updates', () => {
    it('should update client availability', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      manager.updateAvailability('client-1', false);
      expect(manager.getClient('client-1')?.isAvailable).toBe(false);

      manager.updateAvailability('client-1', true);
      expect(manager.getClient('client-1')?.isAvailable).toBe(true);
    });

    it('should only return available clients', () => {
      const client1 = createClientState('client-1', 1000);
      const client2 = createClientState('client-2', 1000, { isAvailable: false });

      manager.registerClient(client1);
      manager.registerClient(client2);

      expect(manager.getAvailableClients()).toHaveLength(1);
      expect(manager.getAvailableClientCount()).toBe(1);
    });
  });

  describe('participation history updates', () => {
    it('should track total selections', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      manager.updateParticipation('client-1', 1, 0.9);
      manager.updateParticipation('client-1', 2, 0.85);

      expect(manager.getClient('client-1')?.history.totalSelections).toBe(2);
      expect(manager.getClient('client-1')?.history.totalContributions).toBe(2);
    });

    it('should track consecutive selections', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      manager.updateParticipation('client-1', 1, 0.9);
      expect(
        manager.getClient('client-1')?.history.consecutiveSelections
      ).toBe(1);

      manager.updateParticipation('client-1', 2, 0.9);
      expect(
        manager.getClient('client-1')?.history.consecutiveSelections
      ).toBe(2);

      manager.updateParticipation('client-1', 4, 0.9); // Gap in rounds
      expect(
        manager.getClient('client-1')?.history.consecutiveSelections
      ).toBe(1);
    });

    it('should update average contribution quality with EMA', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      const initialQuality =
        manager.getClient('client-1')?.history.avgContributionQuality ?? 0;

      manager.updateParticipation('client-1', 1, 0.5);
      const afterFirst =
        manager.getClient('client-1')?.history.avgContributionQuality ?? 0;

      // EMA should move towards 0.5
      expect(afterFirst).toBeLessThan(initialQuality);
      expect(afterFirst).toBeGreaterThan(0.5);

      manager.updateParticipation('client-1', 2, 1.0);
      const afterSecond =
        manager.getClient('client-1')?.history.avgContributionQuality ?? 0;

      // EMA should move towards 1.0
      expect(afterSecond).toBeGreaterThan(afterFirst);
    });
  });

  describe('system metrics updates', () => {
    it('should update system metrics', () => {
      const client = createClientState('client-1', 1000);
      manager.registerClient(client);

      manager.updateSystemMetrics('client-1', {
        systemLoad: 0.9,
        networkBandwidth: 100,
        computeCapability: 0.5,
        batteryLevel: 0.3,
      });

      const updated = manager.getClient('client-1');
      expect(updated?.systemLoad).toBe(0.9);
      expect(updated?.networkBandwidth).toBe(100);
      expect(updated?.computeCapability).toBe(0.5);
      expect(updated?.batteryLevel).toBe(0.3);
    });
  });

  describe('domain and group filtering', () => {
    beforeEach(() => {
      manager.registerClient(
        createClientState('client-1', 1000, {
          dataDistribution: { domain: 'healthcare', group: 'group-a' },
        })
      );
      manager.registerClient(
        createClientState('client-2', 1000, {
          dataDistribution: { domain: 'finance', group: 'group-b' },
        })
      );
      manager.registerClient(
        createClientState('client-3', 1000, {
          dataDistribution: { domain: 'healthcare', group: 'group-b' },
        })
      );
    });

    it('should filter clients by domain', () => {
      const healthcareClients = manager.getClientsByDomain('healthcare');
      expect(healthcareClients).toHaveLength(2);
      expect(healthcareClients.map((c) => c.id)).toContain('client-1');
      expect(healthcareClients.map((c) => c.id)).toContain('client-3');
    });

    it('should filter clients by group', () => {
      const groupBClients = manager.getClientsByGroup('group-b');
      expect(groupBClients).toHaveLength(2);
      expect(groupBClients.map((c) => c.id)).toContain('client-2');
      expect(groupBClients.map((c) => c.id)).toContain('client-3');
    });
  });

  describe('stale client removal', () => {
    it('should remove clients not updated recently', () => {
      const oldClient = createClientState('client-1', 1000);
      // Manually set old timestamp
      oldClient.lastUpdate = new Date(Date.now() - 10000); // 10 seconds ago

      const newClient = createClientState('client-2', 1000);
      manager.registerClient(oldClient);
      manager.registerClient(newClient);

      const removed = manager.removeStaleClients(5000); // 5 second threshold

      expect(removed).toContain('client-1');
      expect(removed).not.toContain('client-2');
      expect(manager.getTotalClientCount()).toBe(1);
    });
  });
});

describe('RandomUniformSelector', () => {
  let manager: ClientStateManager;
  let context: SelectionContext;

  beforeEach(() => {
    manager = new ClientStateManager();
    for (let i = 1; i <= 20; i++) {
      manager.registerClient(createClientState(`client-${i}`, 1000));
    }
    context = createDefaultContext(1, 10);
    context.strategy = SelectionStrategy.RANDOM_UNIFORM;
  });

  it('should select correct number of clients', () => {
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).toHaveLength(10);
  });

  it('should respect availability', () => {
    manager.updateAvailability('client-1', false);
    manager.updateAvailability('client-2', false);

    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).not.toContain('client-1');
    expect(result.selectedClients).not.toContain('client-2');
  });

  it('should respect max consecutive selections', () => {
    // Mark some clients as having max consecutive selections
    for (let i = 1; i <= 5; i++) {
      const client = manager.getClient(`client-${i}`)!;
      client.history.consecutiveSelections = 3;
    }

    context.maxConsecutiveSelections = 3;
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    // These clients should not be selected
    expect(result.selectedClients).not.toContain('client-1');
    expect(result.selectedClients).not.toContain('client-5');
  });

  it('should calculate fairness metrics', () => {
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.fairnessMetrics.giniCoefficient).toBeGreaterThanOrEqual(0);
    expect(result.fairnessMetrics.giniCoefficient).toBeLessThanOrEqual(1);
    expect(result.fairnessMetrics.diversityScore).toBeGreaterThanOrEqual(0);
  });
});

describe('RandomStratifiedSelector', () => {
  let manager: ClientStateManager;
  let context: SelectionContext;

  beforeEach(() => {
    manager = new ClientStateManager();

    // Create clients across different domains
    for (let i = 1; i <= 10; i++) {
      manager.registerClient(
        createClientState(`healthcare-${i}`, 1000, {
          dataDistribution: { domain: 'healthcare', group: 'group-a' },
        })
      );
    }
    for (let i = 1; i <= 10; i++) {
      manager.registerClient(
        createClientState(`finance-${i}`, 1000, {
          dataDistribution: { domain: 'finance', group: 'group-b' },
        })
      );
    }

    context = createDefaultContext(1, 10);
    context.strategy = SelectionStrategy.RANDOM_STRATIFIED;
  });

  it('should select from multiple domains', () => {
    const selector = new RandomStratifiedSelector(manager);
    const result = selector.select(context);

    expect(result.stratificationStats).toBeDefined();
    expect(result.stratificationStats!.domainDistribution.size).toBeGreaterThan(1);
  });

  it('should provide stratification statistics', () => {
    const selector = new RandomStratifiedSelector(manager);
    const result = selector.select(context);

    const stats = result.stratificationStats!;
    expect(stats.domainDistribution.has('healthcare')).toBe(true);
    expect(stats.domainDistribution.has('finance')).toBe(true);
    expect(stats.groupDistribution.has('group-a')).toBe(true);
    expect(stats.groupDistribution.has('group-b')).toBe(true);
  });
});

describe('ImportanceQualitySelector', () => {
  let manager: ClientStateManager;
  let context: SelectionContext;

  beforeEach(() => {
    manager = new ClientStateManager();

    // Create clients with varying quality scores
    for (let i = 1; i <= 10; i++) {
      const quality = 0.5 + (i / 10) * 0.5; // 0.55 to 1.0
      manager.registerClient(
        createClientState(`client-${i}`, 1000, {
          dataDistribution: { qualityScore: quality },
        })
      );
    }

    context = createDefaultContext(1, 5);
    context.strategy = SelectionStrategy.IMPORTANCE_QUALITY;
  });

  it('should prefer higher quality clients', () => {
    const selector = new ImportanceQualitySelector(manager);
    const result = selector.select(context);

    // Higher quality clients should have higher selection scores
    const highQualityClient = 'client-10';
    const lowQualityClient = 'client-1';

    expect(result.selectionScores.get(highQualityClient)).toBeGreaterThan(
      result.selectionScores.get(lowQualityClient) ?? 0
    );
  });

  it('should select correct number of clients', () => {
    const selector = new ImportanceQualitySelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).toHaveLength(5);
  });
});

describe('ImportanceAdaptiveSelector', () => {
  let manager: ClientStateManager;
  let context: SelectionContext;

  beforeEach(() => {
    manager = new ClientStateManager();

    // Create clients with varying history
    for (let i = 1; i <= 10; i++) {
      const client = createClientState(`client-${i}`, 1000, {
        dataDistribution: { qualityScore: 0.8 },
      });

      // Vary participation history
      client.history.totalSelections = i * 2;
      client.history.consecutiveSelections = Math.min(i, 3);

      manager.registerClient(client);
    }

    context = createDefaultContext(1, 5);
    context.strategy = SelectionStrategy.IMPORTANCE_ADAPTIVE;
  });

  it('should penalize over-selected clients', () => {
    const selector = new ImportanceAdaptiveSelector(manager);
    const result = selector.select(context);

    // Clients with more selections should have lower adaptive scores
    // (all else being equal)
    const overSelected = 'client-10';
    const underSelected = 'client-1';

    expect(result.selectionScores.get(underSelected)).toBeGreaterThan(
      result.selectionScores.get(overSelected) ?? 0
    );
  });
});

describe('FairnessDiverseSelector', () => {
  let manager: ClientStateManager;
  let context: SelectionContext;

  beforeEach(() => {
    manager = new ClientStateManager();

    // Create imbalanced groups
    for (let i = 1; i <= 15; i++) {
      manager.registerClient(
        createClientState(`majority-${i}`, 1000, {
          dataDistribution: { group: 'majority', qualityScore: 0.9 },
        })
      );
    }
    for (let i = 1; i <= 5; i++) {
      manager.registerClient(
        createClientState(`minority-${i}`, 1000, {
          dataDistribution: { group: 'minority', qualityScore: 0.7 },
        })
      );
    }

    context = createDefaultContext(1, 10);
    context.strategy = SelectionStrategy.FAIRNESS_DIVERSE;
  });

  it('should ensure representation from all groups', () => {
    const selector = new FairnessDiverseSelector(manager);
    const result = selector.select(context);

    // Should have at least some minority clients selected
    const hasMinority = result.selectedClients.some((id) =>
      id.startsWith('minority')
    );
    expect(hasMinority).toBe(true);
  });

  it('should improve fairness metrics', () => {
    const selector = new FairnessDiverseSelector(manager);
    const result = selector.select(context);

    expect(result.fairnessMetrics.representationError.size).toBeGreaterThan(0);
  });
});

describe('SelectorFactory', () => {
  let manager: ClientStateManager;

  beforeEach(() => {
    manager = new ClientStateManager();
    for (let i = 1; i <= 10; i++) {
      manager.registerClient(createClientState(`client-${i}`, 1000));
    }
  });

  it('should create correct selector type', () => {
    const context = createDefaultContext(1, 5);

    const strategies = [
      SelectionStrategy.RANDOM_UNIFORM,
      SelectionStrategy.RANDOM_STRATIFIED,
      SelectionStrategy.IMPORTANCE_QUALITY,
      SelectionStrategy.IMPORTANCE_ADAPTIVE,
      SelectionStrategy.FAIRNESS_DIVERSE,
    ];

    for (const strategy of strategies) {
      context.strategy = strategy;
      const selector = SelectorFactory.create(strategy, manager);
      const result = selector.select(context);

      expect(result.selectedClients.length).toBeGreaterThan(0);
      expect(result.selectedClients.length).toBeLessThanOrEqual(5);
    }
  });

  it('should throw error for unknown strategy', () => {
    expect(() => {
      SelectorFactory.create('unknown' as SelectionStrategy, manager);
    }).toThrow();
  });
});

describe('fairness metrics calculation', () => {
  it('should calculate Gini coefficient correctly', () => {
    const manager = new ClientStateManager();

    // Create clients with varying selection history
    for (let i = 1; i <= 10; i++) {
      const client = createClientState(`client-${i}`, 1000);
      client.history.totalSelections = i; // Uneven distribution
      manager.registerClient(client);
    }

    const context = createDefaultContext(1, 5);
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    // Gini should be > 0 for unequal selection
    expect(result.fairnessMetrics.giniCoefficient).toBeGreaterThan(0);
  });

  it('should calculate diversity score', () => {
    const manager = new ClientStateManager();

    // Create diverse clients
    for (let i = 1; i <= 3; i++) {
      manager.registerClient(
        createClientState(`client-${i}`, 1000, {
          dataDistribution: { group: `group-${i}` },
        })
      );
    }

    const context = createDefaultContext(1, 3);
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    // Diversity should be > 0 when multiple groups are present
    expect(result.fairnessMetrics.diversityScore).toBeGreaterThan(0);
  });
});

describe('edge cases', () => {
  it('should handle no available clients', () => {
    const manager = new ClientStateManager();
    const context = createDefaultContext(1, 5);

    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).toHaveLength(0);
  });

  it('should handle fewer clients than target', () => {
    const manager = new ClientStateManager();
    manager.registerClient(createClientState('client-1', 1000));
    manager.registerClient(createClientState('client-2', 1000));

    const context = createDefaultContext(1, 10);
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients.length).toBeLessThanOrEqual(2);
  });

  it('should handle clients with low battery', () => {
    const manager = new ClientStateManager();
    manager.registerClient(
      createClientState('client-low-battery', 1000, { batteryLevel: 0.1 })
    );
    manager.registerClient(
      createClientState('client-ok-battery', 1000, { batteryLevel: 0.8 })
    );

    const context = createDefaultContext(1, 5);
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).not.toContain('client-low-battery');
    expect(result.selectedClients).toContain('client-ok-battery');
  });

  it('should handle overloaded clients', () => {
    const manager = new ClientStateManager();
    manager.registerClient(
      createClientState('client-overloaded', 1000, { systemLoad: 0.95 })
    );
    manager.registerClient(
      createClientState('client-normal', 1000, { systemLoad: 0.3 })
    );

    const context = createDefaultContext(1, 5);
    const selector = new RandomUniformSelector(manager);
    const result = selector.select(context);

    expect(result.selectedClients).not.toContain('client-overloaded');
    expect(result.selectedClients).toContain('client-normal');
  });
});

describe('concurrent selection scenarios', () => {
  it('should handle multiple rounds of selection', () => {
    const manager = new ClientStateManager();

    for (let i = 1; i <= 20; i++) {
      manager.registerClient(createClientState(`client-${i}`, 1000));
    }

    const selector = new RandomUniformSelector(manager);
    const allSelected = new Set<ClientId>();

    for (let round = 1; round <= 5; round++) {
      const context = createDefaultContext(round, 10);
      const result = selector.select(context);

      // Update participation
      for (const clientId of result.selectedClients) {
        manager.updateParticipation(clientId, round, 0.8);
        allSelected.add(clientId);
      }
    }

    // Should have selected some variety across rounds
    expect(allSelected.size).toBeGreaterThan(10);
  });
});
