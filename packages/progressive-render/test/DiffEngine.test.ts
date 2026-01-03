/**
 * DiffEngine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiffEngine } from '../src/DiffEngine.js';
import type { A2UIComponent, PatchType } from '../src/types.js';

describe('DiffEngine', () => {
  let engine: DiffEngine;

  beforeEach(() => {
    engine = new DiffEngine();
  });

  describe('Component Diffing', () => {
    it('should detect added components', () => {
      const oldTree: A2UIComponent[] = [];
      const newTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Hello' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.additions).toBe(1);
      expect(result.removals).toBe(0);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].patch_type).toBe('add');
    });

    it('should detect removed components', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Hello' }
        }
      ];
      const newTree: A2UIComponent[] = [];

      const result = engine.diff(oldTree, newTree);

      expect(result.removals).toBe(1);
      expect(result.additions).toBe(0);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].patch_type).toBe('remove');
    });

    it('should detect replaced components', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'comp-1',
          props: { text: 'Old' }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'button',
          id: 'comp-1',
          props: { label: 'Button' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.replacements).toBe(1);
      expect(result.updates[0].patch_type).toBe('replace');
    });

    it('should detect property updates', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Old text' }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'New text' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.updates).toBeGreaterThan(0);
      expect(result.updates[0].patch_type).toBe('update');
      expect(result.updates[0].data.type).toBe('update');
    });

    it('should detect moved components', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'First' }
        },
        {
          type: 'text',
          id: 'text-2',
          props: { text: 'Second' }
        },
        {
          type: 'text',
          id: 'text-3',
          props: { text: 'Third' }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-2',
          props: { text: 'Second' }
        },
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'First' }
        },
        {
          type: 'text',
          id: 'text-3',
          props: { text: 'Third' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.moves).toBeGreaterThan(0);
    });

    it('should handle nested components', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'container',
          id: 'container-1',
          props: {},
          children: [
            {
              type: 'text',
              id: 'text-1',
              props: { text: 'Child 1' }
            },
            {
              type: 'text',
              id: 'text-2',
              props: { text: 'Child 2' }
            }
          ]
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'container',
          id: 'container-1',
          props: {},
          children: [
            {
              type: 'text',
              id: 'text-1',
              props: { text: 'Child 1 updated' }
            },
            {
              type: 'text',
              id: 'text-2',
              props: { text: 'Child 2' }
            },
            {
              type: 'text',
              id: 'text-3',
              props: { text: 'Child 3' }
            }
          ]
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.total_changes).toBeGreaterThan(0);
      expect(result.additions).toBe(1); // text-3 added
    });
  });

  describe('Layout Diffing', () => {
    it('should detect layout changes', () => {
      const oldLayout = {
        type: 'vertical' as const,
        spacing: 16
      };

      const newLayout = {
        type: 'horizontal' as const,
        spacing: 24
      };

      const update = engine.diffLayout(oldLayout, newLayout);

      expect(update.patch_type).toBe('replace');
      expect(update.component_id).toBe('layout');
    });
  });

  describe('Reconciliation', () => {
    it('should generate reconciliation result', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Old' }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'New' }
        },
        {
          type: 'button',
          id: 'button-1',
          props: { label: 'Click' }
        }
      ];

      const result = engine.reconcile(oldTree, newTree);

      expect(result.success).toBe(true);
      expect(result.updates).toBeDefined();
      expect(result.mount).toBeDefined();
      expect(result.time).toBeGreaterThan(0);
    });

    it('should identify components to unmount', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'To remove' }
        }
      ];
      const newTree: A2UIComponent[] = [];

      const result = engine.reconcile(oldTree, newTree);

      expect(result.unmount).toContain('text-1');
    });

    it('should identify components to mount', () => {
      const oldTree: A2UIComponent[] = [];
      const newTree: A2UIComponent[] = [
        {
          type: 'button',
          id: 'button-1',
          props: { label: 'New Button' }
        }
      ];

      const result = engine.reconcile(oldTree, newTree);

      expect(result.mount).toHaveLength(1);
      expect(result.mount[0].id).toBe('button-1');
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate high similarity for identical trees', () => {
      const tree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Same' }
        }
      ];

      const result = engine.diff(tree, tree);

      expect(result.similarity).toBe(1);
    });

    it('should calculate low similarity for completely different trees', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Old' }
        },
        {
          type: 'text',
          id: 'text-2',
          props: { text: 'Old 2' }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'button',
          id: 'button-1',
          props: { label: 'New' }
        },
        {
          type: 'button',
          id: 'button-2',
          props: { label: 'New 2' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.similarity).toBeLessThan(0.5);
    });
  });

  describe('Deep Equality', () => {
    it('should detect equal primitives', () => {
      const engine = new DiffEngine();
      // Access private method for testing
      const diffEqual = (engine as any).deepEqual.bind(engine);

      expect(diffEqual('test', 'test')).toBe(true);
      expect(diffEqual(123, 123)).toBe(true);
      expect(diffEqual(true, true)).toBe(true);
    });

    it('should detect unequal primitives', () => {
      const diffEqual = (engine as any).deepEqual.bind(engine);

      expect(diffEqual('test', 'other')).toBe(false);
      expect(diffEqual(123, 456)).toBe(false);
      expect(diffEqual(true, false)).toBe(false);
    });

    it('should detect equal arrays', () => {
      const diffEqual = (engine as any).deepEqual.bind(engine);

      const arr = [1, 2, { a: 'b' }];
      expect(diffEqual(arr, [1, 2, { a: 'b' }])).toBe(true);
    });

    it('should detect unequal arrays', () => {
      const diffEqual = (engine as any).deepEqual.bind(engine);

      expect(diffEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(diffEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should detect equal objects', () => {
      const diffEqual = (engine as any).deepEqual.bind(engine);

      const obj = { a: 1, b: { c: 2 } };
      expect(diffEqual(obj, { a: 1, b: { c: 2 } })).toBe(true);
    });

    it('should detect unequal objects', () => {
      const diffEqual = (engine as any).deepEqual.bind(engine);

      expect(diffEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(diffEqual({ a: 1 }, { b: 1 })).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should compute diff quickly for small trees', () => {
      const oldTree: A2UIComponent[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'text',
        id: `text-${i}`,
        props: { text: `Text ${i}` }
      }));

      const newTree: A2UIComponent[] = oldTree.map(c => ({
        ...c,
        props: { text: `Updated ${c.props.text}` }
      }));

      const result = engine.diff(oldTree, newTree);

      expect(result.compute_time).toBeLessThan(100); // Should be very fast
      expect(result.total_changes).toBe(10);
    });

    it('should compute diff efficiently for larger trees', () => {
      const oldTree: A2UIComponent[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'text',
        id: `text-${i}`,
        props: { text: `Text ${i}` }
      }));

      const newTree: A2UIComponent[] = [...oldTree,
        {
          type: 'button',
          id: 'button-new',
          props: { label: 'New Button' }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      expect(result.compute_time).toBeLessThan(500); // Should still be fast
      expect(result.additions).toBe(1);
    });
  });

  describe('Diff Options', () => {
    it('should respect move_threshold option', () => {
      const engineWithOptions = new DiffEngine({
        compute_moves: true,
        move_threshold: 5
      });

      const oldTree: A2UIComponent[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'text',
        id: `text-${i}`,
        props: { text: `Text ${i}` }
      }));

      const newTree: A2UIComponent[] = [...oldTree].reverse();

      const result = engineWithOptions.diff(oldTree, newTree);

      // Should detect moves when position changes exceed threshold
      expect(result.moves).toBeGreaterThan(0);
    });

    it('should respect similarity_threshold option', () => {
      const engineWithOptions = new DiffEngine({
        similarity_threshold: 0.9
      });

      const tree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Same' }
        }
      ];

      const result = engineWithOptions.diff(tree, tree);

      expect(result.similarity).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trees', () => {
      const result = engine.diff([], []);

      expect(result.total_changes).toBe(0);
      expect(result.similarity).toBe(1);
    });

    it('should handle null/undefined props', () => {
      const oldTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Test', extra: null }
        }
      ];
      const newTree: A2UIComponent[] = [
        {
          type: 'text',
          id: 'text-1',
          props: { text: 'Test', extra: undefined }
        }
      ];

      const result = engine.diff(oldTree, newTree);

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle deeply nested structures', () => {
      const deepChild: A2UIComponent = {
        type: 'text',
        id: 'deep-text',
        props: { text: 'Deep' }
      };

      const nestedTree: A2UIComponent[] = [
        {
          type: 'container',
          id: 'level-1',
          props: {},
          children: [
            {
              type: 'container',
              id: 'level-2',
              props: {},
              children: [
                {
                  type: 'container',
                  id: 'level-3',
                  props: {},
                  children: [deepChild]
                }
              ]
            }
          ]
        }
      ];

      const result = engine.diff(nestedTree, nestedTree);

      expect(result.similarity).toBe(1);
    });
  });
});
