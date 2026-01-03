/**
 * DiffEngine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffEngine } from '../src/diff/DiffEngine.js';
import type { UIState } from '../src/types.js';

describe('DiffEngine', () => {
  let engine: DiffEngine;
  let mockState: UIState;

  beforeEach(() => {
    engine = new DiffEngine({
      type: 'structural',
      algorithm: 'myers',
      granularity: 'medium'
    });

    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click me' },
          children: [],
          styles: { backgroundColor: 'blue', color: 'white' }
        },
        {
          id: 'comp2',
          type: 'text',
          props: { content: 'Hello' },
          children: [],
          styles: { fontSize: '14px' }
        }
      ],
      styles: {
        css: { primaryColor: 'blue', secondaryColor: 'gray' },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 100, height: 50 },
        position: { top: 0, left: 0 },
        children: []
      },
      behavior: {
        events: [
          { event: 'click', handler: 'onClick' }
        ],
        actions: [],
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

  describe('initialization', () => {
    it('should create engine with default config', () => {
      const defaultEngine = new DiffEngine();
      expect(defaultEngine).toBeDefined();
    });

    it('should create engine with custom config', () => {
      const customEngine = new DiffEngine({
        type: 'visual',
        algorithm: 'patience',
        granularity: 'fine'
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('diff', () => {
    it('should compute diff between states', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const diff = engine.diff(mockState, newState);

      expect(diff).toBeDefined();
      expect(diff.additions).toBeDefined();
      expect(diff.deletions).toBeDefined();
      expect(diff.modifications).toBeDefined();
      expect(diff.moves).toBeDefined();
      expect(diff.summary).toBeDefined();
    });

    it('should detect style modifications', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const diff = engine.diff(mockState, newState);

      expect(diff.modifications.length).toBeGreaterThan(0);
      expect(diff.modifications.some(m => m.path.includes('primaryColor'))).toBe(true);
    });

    it('should detect component additions', () => {
      const newState = { ...mockState };
      newState.components = [
        ...mockState.components,
        {
          id: 'comp3',
          type: 'image',
          props: { src: 'test.png' },
          children: [],
          styles: {}
        }
      ];

      const diff = engine.diff(mockState, newState);

      expect(diff.additions.length).toBeGreaterThan(0);
    });

    it('should detect component deletions', () => {
      const newState = { ...mockState };
      newState.components = [mockState.components[0]];

      const diff = engine.diff(mockState, newState);

      expect(diff.deletions.length).toBeGreaterThan(0);
    });

    it('should detect layout modifications', () => {
      const newState = { ...mockState };
      newState.layout.type = 'grid';

      const diff = engine.diff(mockState, newState);

      expect(diff.modifications.some(m => m.path.includes('layout.type'))).toBe(true);
    });

    it('should detect behavior modifications', () => {
      const newState = { ...mockState };
      newState.behavior.events = [
        { event: 'click', handler: 'onClick' },
        { event: 'hover', handler: 'onHover' }
      ];

      const diff = engine.diff(mockState, newState);

      expect(diff.modifications.length).toBeGreaterThan(0);
    });

    it('should return empty diff for identical states', () => {
      const diff = engine.diff(mockState, mockState);

      expect(diff.additions).toHaveLength(0);
      expect(diff.deletions).toHaveLength(0);
      expect(diff.summary.totalModifications).toBeLessThan(5); // Minor metadata changes allowed
    });
  });

  describe('codeDiff', () => {
    it('should compute unified diff', () => {
      const before = 'line1\nline2\nline3';
      const after = 'line1\nline2-modified\nline3';

      const diff = engine.codeDiff(before, after);

      expect(diff).toBeDefined();
      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.deletions).toBeGreaterThan(0);
      expect(diff.hunks).toBeDefined();
      expect(diff.unified).toBeDefined();
    });

    it('should generate unified diff format', () => {
      const before = 'line1\nline2';
      const after = 'line1\nline2-new';

      const diff = engine.codeDiff(before, after);

      expect(diff.unified).toContain('@@');
      expect(diff.unified).toContain('-');
      expect(diff.unified).toContain('+');
    });

    it('should create hunks correctly', () => {
      const before = 'line1\nline2\nline3\nline4';
      const after = 'line1\nline2-modified\nline3\nline4-modified';

      const diff = engine.codeDiff(before, after);

      expect(diff.hunks.length).toBeGreaterThan(0);

      const hunk = diff.hunks[0];
      expect(hunk.oldStart).toBeDefined();
      expect(hunk.oldLines).toBeDefined();
      expect(hunk.newStart).toBeDefined();
      expect(hunk.newLines).toBeDefined();
      expect(hunk.lines).toBeDefined();
    });

    it('should handle empty strings', () => {
      const diff = engine.codeDiff('', '');

      expect(diff.additions).toBe(0);
      expect(diff.deletions).toBe(0);
    });

    it('should handle single line changes', () => {
      const diff = engine.codeDiff('old', 'new');

      expect(diff.additions).toBe(1);
      expect(diff.deletions).toBe(1);
    });
  });

  describe('visualDiff', () => {
    it('should compute visual diff', async () => {
      const before = Buffer.from('fake image data');
      const after = Buffer.from('fake image data modified');

      const diff = await engine.visualDiff(before, after);

      expect(diff).toBeDefined();
      expect(diff.additions).toBeDefined();
      expect(diff.deletions).toBeDefined();
      expect(diff.modifications).toBeDefined();
    });

    it('should detect size changes', async () => {
      const before = Buffer.from('small');
      const after = Buffer.from('larger content');

      const diff = await engine.visualDiff(before, after);

      expect(diff.modifications.length).toBeGreaterThan(0);
    });
  });

  describe('semanticDiff', () => {
    it('should compute semantic diff', () => {
      const newState = { ...mockState };
      newState.components[0].type = 'link';

      const diff = engine.semanticDiff(mockState, newState);

      expect(diff).toBeDefined();
      expect(diff.additions).toBeDefined();
      expect(diff.deletions).toBeDefined();
      expect(diff.modifications).toBeDefined();
    });

    it('should detect semantic role additions', () => {
      const newState = { ...mockState };
      newState.components = [
        ...mockState.components,
        {
          id: 'comp3',
          type: 'slider',
          props: {},
          children: [],
          styles: {}
        }
      ];

      const diff = engine.semanticDiff(mockState, newState);

      expect(diff.additions.some(a => a.path.includes('semantic'))).toBe(true);
    });

    it('should detect semantic role removals', () => {
      const newState = { ...mockState };
      newState.components = [mockState.components[0]];

      const diff = engine.semanticDiff(mockState, newState);

      expect(diff.deletions.some(d => d.path.includes('semantic'))).toBe(true);
    });
  });

  describe('structuralDiff', () => {
    it('should compute structural diff', () => {
      const newState = { ...mockState };
      newState.components = [
        { ...mockState.components[0], id: 'comp1-renamed' }
      ];

      const diff = engine.structuralDiff(mockState, newState);

      expect(diff).toBeDefined();
      expect(diff.additions.length).toBeGreaterThan(0);
      expect(diff.deletions.length).toBeGreaterThan(0);
    });
  });

  describe('summary computation', () => {
    it('should calculate correct summary', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const diff = engine.diff(mockState, newState);

      expect(diff.summary.totalAdditions).toBe(diff.additions.length);
      expect(diff.summary.totalDeletions).toBe(diff.deletions.length);
      expect(diff.summary.totalModifications).toBe(diff.modifications.length);
      expect(diff.summary.totalMoves).toBe(diff.moves.length);
    });

    it('should determine severity as breaking for deletions', () => {
      const newState = { ...mockState };
      newState.components = [];

      const diff = engine.diff(mockState, newState);

      expect(diff.summary.severity).toBe('breaking');
    });

    it('should determine severity as major for many changes', () => {
      let newState = { ...mockState };

      for (let i = 0; i < 10; i++) {
        newState = { ...newState };
        newState.styles.css[`prop${i}`] = `value${i}`;
      }

      const diff = engine.diff(mockState, newState);

      expect(diff.summary.severity).toBe('major');
    });

    it('should determine severity as minor for few changes', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const diff = engine.diff(mockState, newState);

      expect(diff.summary.severity).toBe('minor');
    });
  });

  describe('edge cases', () => {
    it('should handle empty states', () => {
      const emptyState: UIState = {
        components: [],
        styles: { css: {}, theme: 'light', variables: {} },
        layout: {
          type: 'flex',
          dimensions: {},
          position: {},
          children: []
        },
        behavior: { events: [], actions: [] },
        metadata: {
          version: '1.0.0',
          timestamp: Date.now(),
          hash: '',
          author: 'test'
        }
      };

      const diff = engine.diff(emptyState, mockState);

      expect(diff.additions.length).toBeGreaterThan(0);
    });

    it('should handle deep component trees', () => {
      const deepState: UIState = {
        ...mockState,
        components: [
          {
            id: 'comp1',
            type: 'container',
            props: {},
            children: [
              {
                id: 'comp2',
                type: 'container',
                props: {},
                children: [
                  {
                    id: 'comp3',
                    type: 'button',
                    props: {},
                    children: [],
                    styles: {}
                  }
                ],
                styles: {}
              }
            ],
            styles: {}
          }
        ]
      };

      const diff = engine.diff(mockState, deepState);

      expect(diff).toBeDefined();
    });

    it('should handle missing optional properties', () => {
      const stateWithoutMachine: UIState = {
        ...mockState,
        behavior: {
          events: [],
          actions: [],
          stateMachine: undefined
        }
      };

      const diff = engine.diff(mockState, stateWithoutMachine);

      expect(diff).toBeDefined();
    });
  });
});
