/**
 * DiffRenderer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffRenderer } from '../src/visualization/DiffRenderer.js';
import type { DiffResult } from '../src/types.js';

describe('DiffRenderer', () => {
  let renderer: DiffRenderer;
  let mockDiff: DiffResult;

  beforeEach(() => {
    renderer = new DiffRenderer({
      format: 'side_by_side',
      highlightColor: '#ffff00',
      showContext: true,
      animation: false
    });

    mockDiff = {
      additions: [
        { path: 'components.newButton', content: { type: 'button' } }
      ],
      deletions: [
        { path: 'components.oldButton', content: { type: 'button' } }
      ],
      modifications: [
        {
          path: 'styles.theme',
          before: 'dark',
          after: 'light'
        }
      ],
      moves: [],
      summary: {
        totalAdditions: 1,
        totalDeletions: 1,
        totalModifications: 1,
        totalMoves: 0,
        severity: 'major'
      }
    };
  });

  describe('initialization', () => {
    it('should create renderer with default config', () => {
      const defaultRenderer = new DiffRenderer();
      expect(defaultRenderer).toBeDefined();
    });

    it('should create renderer with custom config', () => {
      const customRenderer = new DiffRenderer({
        format: 'unified',
        highlightColor: '#ff0000',
        animation: true
      });
      expect(customRenderer).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render diff result', () => {
      const rendered = renderer.render(mockDiff);

      expect(rendered).toBeDefined();
      expect(rendered.format).toBe('side_by_side');
      expect(rendered.before).toBeDefined();
      expect(rendered.after).toBeDefined();
      expect(rendered.changes).toBeDefined();
      expect(rendered.summary).toBeDefined();
    });

    it('should use custom config', () => {
      const rendered = renderer.render(mockDiff, {
        format: 'unified',
        showContext: false
      });

      expect(rendered.format).toBe('unified');
    });

    it('should highlight changes', () => {
      const rendered = renderer.render(mockDiff);

      expect(rendered.changes.length).toBeGreaterThan(0);
      expect(rendered.changes.every(c => c.className)).toBe(true);
    });

    it('should include summary', () => {
      const rendered = renderer.render(mockDiff);

      expect(rendered.summary.totalAdditions).toBe(1);
      expect(rendered.summary.totalDeletions).toBe(1);
      expect(rendered.summary.totalModifications).toBe(1);
    });
  });

  describe('renderSideBySide', () => {
    it('should render side-by-side diff', () => {
      const rendered = renderer.renderSideBySide(mockDiff);

      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe('string');
      expect(rendered).toContain('BEFORE');
      expect(rendered).toContain('AFTER');
    });

    it('should show additions', () => {
      const rendered = renderer.renderSideBySide(mockDiff);

      expect(rendered).toContain('Additions:');
    });

    it('should show deletions', () => {
      const rendered = renderer.renderSideBySide(mockDiff);

      expect(rendered).toContain('Deletions:');
    });

    it('should show modifications', () => {
      const rendered = renderer.renderSideBySide(mockDiff);

      expect(rendered).toContain('MODIFICATIONS');
    });
  });

  describe('renderUnified', () => {
    it('should render unified diff', () => {
      const rendered = renderer.renderUnified(mockDiff);

      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe('string');
    });

    it('should use diff markers', () => {
      const rendered = renderer.renderUnified(mockDiff);

      expect(rendered).toContain('+'); // Addition marker
      expect(rendered).toContain('-'); // Deletion marker
      expect(rendered).toContain('~'); // Modification marker
    });
  });

  describe('renderOverlay', () => {
    it('should render overlay diff', () => {
      const rendered = renderer.renderOverlay(mockDiff);

      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe('string');
      expect(rendered).toContain('DIFF OVERLAY');
    });

    it('should show change types', () => {
      const rendered = renderer.renderOverlay(mockDiff);

      expect(rendered).toContain('[ADD]');
      expect(rendered).toContain('[DELETE]');
      expect(rendered).toContain('[MODIFY]');
    });
  });

  describe('renderAnimated', () => {
    it('should render animated diff', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated).toBeDefined();
      expect(animated.frames).toBeDefined();
      expect(animated.duration).toBeDefined();
    });

    it('should create initial frame', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.frames[0].type).toBe('initial');
    });

    it('should create deletion frame', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.frames.some(f => f.type === 'deletion')).toBe(true);
    });

    it('should create addition frame', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.frames.some(f => f.type === 'addition')).toBe(true);
    });

    it('should create modification frame', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.frames.some(f => f.type === 'modification')).toBe(true);
    });

    it('should create final frame', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.frames[animated.frames.length - 1].type).toBe('final');
    });

    it('should calculate duration', () => {
      const animated = renderer.renderAnimated(mockDiff);

      expect(animated.duration).toBeGreaterThan(0);
    });
  });

  describe('renderHTML', () => {
    it('should render HTML diff', () => {
      const html = renderer.renderHTML(mockDiff);

      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('<div');
    });

    it('should include CSS classes', () => {
      const html = renderer.renderHTML(mockDiff);

      expect(html).toContain('diff-addition');
      expect(html).toContain('diff-deletion');
      expect(html).toContain('diff-modification');
    });

    it('should escape HTML', () => {
      const html = renderer.renderHTML(mockDiff);

      expect(html).not.toContain('<script>');
    });
  });

  describe('renderJSON', () => {
    it('should render JSON diff', () => {
      const json = renderer.renderJSON(mockDiff);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
    });

    it('should be valid JSON', () => {
      const json = renderer.renderJSON(mockDiff);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all diff data', () => {
      const json = renderer.renderJSON(mockDiff);
      const parsed = JSON.parse(json);

      expect(parsed.additions).toBeDefined();
      expect(parsed.deletions).toBeDefined();
      expect(parsed.modifications).toBeDefined();
    });
  });

  describe('renderSummary', () => {
    it('should render diff summary', () => {
      const summary = renderer.renderSummary(mockDiff);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('DIFF SUMMARY');
    });

    it('should include counts', () => {
      const summary = renderer.renderSummary(mockDiff);

      expect(summary).toContain('Additions: 1');
      expect(summary).toContain('Deletions: 1');
      expect(summary).toContain('Modifications: 1');
    });

    it('should include severity', () => {
      const summary = renderer.renderSummary(mockDiff);

      expect(summary).toContain('Severity: major');
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff', () => {
      const emptyDiff: DiffResult = {
        additions: [],
        deletions: [],
        modifications: [],
        moves: [],
        summary: {
          totalAdditions: 0,
          totalDeletions: 0,
          totalModifications: 0,
          totalMoves: 0,
          severity: 'minor'
        }
      };

      const rendered = renderer.render(emptyDiff);

      expect(rendered.changes).toHaveLength(0);
    });

    it('should handle large diffs', () => {
      const largeDiff: DiffResult = {
        additions: Array(100).fill(null).map((_, i) => ({
          path: `path${i}`,
          content: {}
        })),
        deletions: [],
        modifications: [],
        moves: [],
        summary: {
          totalAdditions: 100,
          totalDeletions: 0,
          totalModifications: 0,
          totalMoves: 0,
          severity: 'major'
        }
      };

      const rendered = renderer.render(largeDiff);

      expect(rendered.changes.length).toBe(100);
    });
  });
});
