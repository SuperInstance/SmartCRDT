/**
 * Evolution Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionTracker } from '../src/tracker/EvolutionTracker.js';
import { ChangeDetector } from '../src/tracker/ChangeDetector.js';
import { DiffEngine } from '../src/diff/DiffEngine.js';
import { VersionHistory } from '../src/history/VersionHistory.js';
import { DiffRenderer } from '../src/visualization/DiffRenderer.js';
import { RollbackManager } from '../src/rollback/RollbackManager.js';
import { EvolutionAnalyzer, PatternDetector, TrendAnalyzer, InsightGenerator } from '../src/analysis/index.js';
import type { UIState } from '../src/types.js';

describe('Evolution Integration', () => {
  let tracker: EvolutionTracker;
  let detector: ChangeDetector;
  let diffEngine: DiffEngine;
  let versionHistory: VersionHistory;
  let renderer: DiffRenderer;
  let rollbackManager: RollbackManager;
  let analyzer: EvolutionAnalyzer;
  let patternDetector: PatternDetector;
  let trendAnalyzer: TrendAnalyzer;
  let insightGenerator: InsightGenerator;

  let mockState: UIState;

  beforeEach(() => {
    tracker = new EvolutionTracker({ autoCommit: true });
    detector = new ChangeDetector();
    diffEngine = new DiffEngine();
    versionHistory = new VersionHistory();
    renderer = new DiffRenderer();
    rollbackManager = new RollbackManager();
    analyzer = new EvolutionAnalyzer();
    patternDetector = new PatternDetector();
    trendAnalyzer = new TrendAnalyzer();
    insightGenerator = new InsightGenerator();

    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click me' },
          children: [],
          styles: { backgroundColor: 'blue' }
        },
        {
          id: 'comp2',
          type: 'text',
          props: { content: 'Hello World' },
          children: [],
          styles: { fontSize: '14px' }
        }
      ],
      styles: {
        css: {
          primaryColor: 'blue',
          secondaryColor: 'gray',
          backgroundColor: 'white'
        },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 800, height: 600 },
        position: { top: 0, left: 0 },
        children: []
      },
      behavior: {
        events: [
          { event: 'click', handler: 'onClick' },
          { event: 'hover', handler: 'onHover' }
        ],
        actions: [{ type: 'navigate', payload: { to: '/home' } }],
        stateMachine: undefined
      },
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        hash: 'abc123',
        author: 'test'
      }
    };
  });

  describe('Full Evolution Workflow', () => {
    it('should track UI evolution end-to-end', async () => {
      // Start tracking
      await tracker.startTracking('ui1', mockState);

      // Make changes
      const state2 = { ...mockState };
      state2.styles.css.primaryColor = 'red';

      await tracker.trackChange('ui1', mockState, state2, {
        author: 'alice',
        message: 'Change primary color to red'
      });

      // Verify tracking
      const history = tracker.getHistory('ui1');
      expect(history?.versions.length).toBeGreaterThanOrEqual(2);

      // Get statistics
      const stats = tracker.getStatistics('ui1');
      expect(stats?.totalEvents).toBe(1);
    });

    it('should detect and analyze changes', async () => {
      await tracker.startTracking('ui1', mockState);

      const state2 = { ...mockState };
      state2.components.push({
        id: 'comp3',
        type: 'image',
        props: { src: 'test.png' },
        children: [],
        styles: {}
      });

      // Detect changes
      const changes = detector.detectChanges(mockState, state2);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.type === 'structural')).toBe(true);
    });

    it('should compute diffs', () => {
      const state2 = { ...mockState };
      state2.styles.theme = 'light';

      const diff = diffEngine.diff(mockState, state2);

      expect(diff.summary.totalModifications).toBeGreaterThan(0);
    });

    it('should render diffs', () => {
      const diff = diffEngine.diff(mockState, mockState);

      const rendered = renderer.render(diff);

      expect(rendered).toBeDefined();
      expect(rendered.changes).toBeDefined();
    });
  });

  describe('Version Management Workflow', () => {
    it('should manage versions with history', async () => {
      await tracker.startTracking('ui1', mockState);

      // Create multiple versions
      for (let i = 1; i <= 5; i++) {
        const newState = { ...mockState };
        newState.styles.css.primaryColor = `color${i}`;
        await tracker.trackChange('ui1', mockState, newState, {
          author: 'alice',
          message: `Change ${i}`
        });
      }

      const history = tracker.getHistory('ui1');
      expect(history?.versions.length).toBe(6); // Initial + 5 changes
    });

    it('should support branching', async () => {
      await tracker.startTracking('ui1', mockState);

      const history = tracker.getHistory('ui1');
      const currentVersion = history?.currentVersion;

      // Create branch from current version
      if (currentVersion) {
        const v1 = history?.versions[0];
        if (v1) {
          versionHistory.initialize(v1);
          versionHistory.createBranch('feature', v1.id);

          expect(versionHistory.getBranches()).toContain('feature');
        }
      }
    });
  });

  describe('Rollback Workflow', () => {
    it('should create and restore backups', async () => {
      await tracker.startTracking('ui1', mockState);

      const state2 = { ...mockState };
      state2.styles.theme = 'light';

      // Create backup before change
      const backup = await rollbackManager.createBackup('1.0.0', mockState);

      // Track change
      await tracker.trackChange('ui1', mockState, state2, {});

      // Restore from backup
      const restored = await rollbackManager.restoreFromBackup(backup.id);

      expect(restored).toEqual(mockState);
    });

    it('should rollback to specific version', async () => {
      await tracker.startTracking('ui1', mockState);

      const state2 = { ...mockState };
      state2.components = [state2.components[0]]; // Remove one component

      // Rollback
      const result = await rollbackManager.rollbackToVersion(
        '2.0.0',
        '1.0.0',
        state2,
        mockState,
        { backupBefore: true }
      );

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe('2.0.0');
      expect(result.newVersion).toBe('1.0.0');
    });
  });

  describe('Analysis Workflow', () => {
    it('should analyze evolution patterns', async () => {
      await tracker.startTracking('ui1', mockState);

      // Create multiple versions with similar patterns
      for (let i = 0; i < 10; i++) {
        const newState = { ...mockState };
        newState.styles.css.primaryColor = `color${i}`;
        await tracker.trackChange('ui1', mockState, newState, {
          author: 'alice',
          message: i % 2 === 0 ? 'Refactor styling' : 'Update colors'
        });
      }

      const history = tracker.getHistory('ui1');
      const patterns = analyzer.analyzePatterns(history?.versions ?? []);

      expect(patterns).toBeDefined();
    });

    it('should detect patterns in events', async () => {
      await tracker.startTracking('ui1', mockState);

      const state2 = { ...mockState };
      await tracker.trackChange('ui1', mockState, state2, {
        author: 'alice',
        message: 'Rapid fix 1'
      });

      const events = tracker.getEvents('ui1');
      const patterns = patternDetector.detectPatterns(events);

      expect(patterns).toBeDefined();
    });

    it('should analyze trends', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 5; i++) {
        const newState = { ...mockState };
        newState.components = [
          ...mockState.components,
          {
            id: `comp${i + 3}`,
            type: 'button',
            props: {},
            children: [],
            styles: {}
          }
        ];
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const history = tracker.getHistory('ui1');
      const trends = trendAnalyzer.analyzeTrends(history?.versions ?? []);

      expect(trends).toBeDefined();
    });

    it('should generate insights', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 5; i++) {
        const newState = { ...mockState };
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const history = tracker.getHistory('ui1');
      const versions = history?.versions ?? [];

      const patterns = analyzer.analyzePatterns(versions);
      const trends = trendAnalyzer.analyzeTrends(versions);
      const insights = insightGenerator.generateInsights(versions, patterns, trends);

      expect(insights).toBeDefined();
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('Visualization Workflow', () => {
    it('should visualize timeline', async () => {
      await tracker.startTracking('ui1', mockState);

      for (let i = 0; i < 5; i++) {
        const newState = { ...mockState };
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const history = tracker.getHistory('ui1');
      const events = tracker.getEvents('ui1');

      // Timeline visualization would be generated
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle rapid iterations', async () => {
      await tracker.startTracking('ui1', mockState);

      // Simulate rapid iterations
      for (let i = 0; i < 20; i++) {
        const newState = { ...mockState };
        newState.styles.css.primaryColor = `color${i}`;
        await tracker.trackChange('ui1', mockState, newState, {
          author: 'developer',
          message: `Quick fix ${i}`
        });
      }

      const stats = tracker.getStatistics('ui1');
      expect(stats?.totalEvents).toBe(20);
    });

    it('should handle multiple branches', async () => {
      await tracker.startTracking('ui1', mockState);

      const history = tracker.getHistory('ui1');
      const rootVersion = history?.versions[0];

      if (rootVersion) {
        versionHistory.initialize(rootVersion);
        versionHistory.createBranch('feature1', rootVersion.id);
        versionHistory.createBranch('feature2', rootVersion.id);
        versionHistory.createBranch('bugfix', rootVersion.id);

        expect(versionHistory.getBranches().length).toBe(4); // main + 3 features
      }
    });

    it('should handle merge scenarios', async () => {
      const rootVersion = {
        id: 'root',
        version: '1.0.0',
        hash: 'abc',
        parent: null,
        branch: 'main',
        timestamp: Date.now(),
        author: 'test',
        message: 'Root',
        changes: [],
        state: mockState
      };

      versionHistory.initialize(rootVersion);
      versionHistory.createBranch('feature', 'root');

      // Add versions to both branches
      const mainV2 = { ...rootVersion, id: 'main2', version: '1.1.0', parent: 'root' };
      const featureV2 = { ...rootVersion, id: 'feat2', version: '1.0.0', parent: 'root', branch: 'feature' };

      versionHistory.addVersion(mainV2);
      versionHistory.addVersion(featureV2);

      // Merge
      const merge = await versionHistory.merge('feature', 'main');

      expect(merge.sourceBranch).toBe('feature');
      expect(merge.targetBranch).toBe('main');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty state', async () => {
      const emptyState: UIState = {
        components: [],
        styles: { css: {}, theme: 'light', variables: {} },
        layout: { type: 'flex', dimensions: {}, position: {}, children: [] },
        behavior: { events: [], actions: [] },
        metadata: { version: '1.0.0', timestamp: Date.now(), hash: '', author: 'test' }
      };

      await tracker.startTracking('ui1', emptyState);

      const history = tracker.getHistory('ui1');
      expect(history).toBeDefined();
    });

    it('should handle large states', async () => {
      const largeComponents = Array.from({ length: 100 }, (_, i) => ({
        id: `comp${i}`,
        type: 'button',
        props: { label: `Button ${i}` },
        children: [],
        styles: {}
      }));

      const largeState: UIState = {
        ...mockState,
        components: largeComponents
      };

      await tracker.startTracking('ui1', largeState);

      const history = tracker.getHistory('ui1');
      expect(history?.versions[0].state.components.length).toBe(100);
    });

    it('should handle concurrent changes', async () => {
      await tracker.startTracking('ui1', mockState);

      // Simulate concurrent changes
      const state2 = { ...mockState };
      state2.styles.css.primaryColor = 'red';

      const state3 = { ...mockState };
      state3.styles.css.primaryColor = 'blue';

      await Promise.all([
        tracker.trackChange('ui1', mockState, state2, { author: 'alice' }),
        tracker.trackChange('ui1', mockState, state3, { author: 'bob' })
      ]);

      const history = tracker.getHistory('ui1');
      expect(history?.events.length).toBe(2);
    });
  });

  describe('Data Export/Import', () => {
    it('should export and import history', async () => {
      await tracker.startTracking('ui1', mockState);

      const state2 = { ...mockState };
      await tracker.trackChange('ui1', mockState, state2, {});

      const exported = tracker.exportHistory('ui1');

      // Import into new tracker
      const newTracker = new EvolutionTracker();
      newTracker.importHistory(exported);

      const importedHistory = newTracker.getHistory('ui1');
      expect(importedHistory).toBeDefined();
      expect(importedHistory?.uiId).toBe('ui1');
    });

    it('should export and import version tree', async () => {
      await tracker.startTracking('ui1', mockState);

      const history = tracker.getHistory('ui1');
      const rootVersion = history?.versions[0];

      if (rootVersion) {
        versionHistory.initialize(rootVersion);

        const exported = versionHistory.exportTree();

        const newHistory = new VersionHistory();
        newHistory.importTree(exported);

        expect(newHistory.getCurrentVersion()?.id).toBe(rootVersion.id);
      }
    });
  });

  describe('Performance', () => {
    it('should handle many changes efficiently', async () => {
      await tracker.startTracking('ui1', mockState);

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const newState = { ...mockState };
        newState.styles.css.primaryColor = `color${i}`;
        await tracker.trackChange('ui1', mockState, newState, {});
      }

      const duration = Date.now() - start;

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });
});
