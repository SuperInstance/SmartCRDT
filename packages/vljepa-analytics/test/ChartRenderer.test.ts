/**
 * ChartRenderer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChartRenderer } from '../src/visualizations/ChartRenderer.js';
import type { ChartConfig, ChartData } from '../src/types.js';

describe('ChartRenderer', () => {
  let renderer: ChartRenderer;

  beforeEach(() => {
    renderer = new ChartRenderer();
  });

  describe('line charts', () => {
    it('should render line chart', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [
            {
              label: 'Series 1',
              data: [10, 20, 30, 40],
              backgroundColor: '#ff0000',
              borderColor: '#ff0000',
            },
          ],
        },
        options: {
          responsive: true,
          interactive: true,
        },
        elementId: 'chart-1',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('line');
      expect(result.element).toBe('chart-1');
      expect(result.renderTime).toBeGreaterThanOrEqual(0);
    });

    it('should cache rendered chart', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Test', data: [1, 2, 3] }],
        },
        options: {},
        elementId: 'cached-chart',
      };

      renderer.render(config);
      const cached = renderer.getCached('cached-chart');

      expect(cached).toBeDefined();
      expect(cached?.type).toBe('line');
    });
  });

  describe('bar charts', () => {
    it('should render bar chart', () => {
      const config: ChartConfig = {
        type: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Values', data: [10, 20, 30] }],
        },
        options: {},
        elementId: 'bar-chart',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('bar');
      expect(result.element).toBe('bar-chart');
    });
  });

  describe('pie charts', () => {
    it('should render pie chart', () => {
      const config: ChartConfig = {
        type: 'pie',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Values', data: [30, 50, 20] }],
        },
        options: {},
        elementId: 'pie-chart',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('pie');
      expect(result.element).toBe('pie-chart');
    });
  });

  describe('heatmaps', () => {
    it('should render heatmap', () => {
      const config: ChartConfig = {
        type: 'heatmap',
        data: {
          datasets: [
            {
              label: 'Heat',
              data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
            },
          ],
        },
        options: {},
        elementId: 'heatmap',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('heatmap');
    });
  });

  describe('funnels', () => {
    it('should render funnel', () => {
      const config: ChartConfig = {
        type: 'funnel',
        data: {
          labels: ['Step 1', 'Step 2', 'Step 3'],
          datasets: [{ label: 'Funnel', data: [1000, 500, 100] }],
        },
        options: {},
        elementId: 'funnel',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('funnel');
    });
  });

  describe('sankey diagrams', () => {
    it('should render sankey diagram', () => {
      const config: ChartConfig = {
        type: 'sankey',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Flow', data: [] }],
        },
        options: {},
        elementId: 'sankey',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('sankey');
    });
  });

  describe('scatter charts', () => {
    it('should render scatter chart', () => {
      const config: ChartConfig = {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Scatter',
              data: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 },
              ],
            },
          ],
        },
        options: {},
        elementId: 'scatter',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('scatter');
    });
  });

  describe('area charts', () => {
    it('should render area chart', () => {
      const config: ChartConfig = {
        type: 'area',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Area', data: [10, 20, 15] }],
        },
        options: {},
        elementId: 'area',
      };

      const result = renderer.render(config);

      expect(result.type).toBe('area');
    });
  });

  describe('cache management', () => {
    it('should clear cache entry', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: ['A', 'B'],
          datasets: [{ label: 'Test', data: [1, 2] }],
        },
        options: {},
        elementId: 'clear-test',
      };

      renderer.render(config);
      renderer.clearCacheEntry('clear-test');

      const cached = renderer.getCached('clear-test');
      expect(cached).toBeUndefined();
    });

    it('should clear all cache', () => {
      const config1: ChartConfig = {
        type: 'line',
        data: { labels: ['A'], datasets: [{ label: 'Test', data: [1] }] },
        options: {},
        elementId: 'chart-1',
      };

      const config2: ChartConfig = {
        type: 'bar',
        data: { labels: ['A'], datasets: [{ label: 'Test', data: [1] }] },
        options: {},
        elementId: 'chart-2',
      };

      renderer.render(config1);
      renderer.render(config2);
      renderer.clearCache();

      expect(renderer.getCached('chart-1')).toBeUndefined();
      expect(renderer.getCached('chart-2')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: [],
          datasets: [],
        },
        options: {},
        elementId: 'empty',
      };

      const result = renderer.render(config);
      expect(result).toBeDefined();
    });

    it('should handle large datasets', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => i);
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: largeData.map(String),
          datasets: [{ label: 'Large', data: largeData }],
        },
        options: {},
        elementId: 'large',
      };

      const result = renderer.render(config);
      expect(result.renderTime).toBeLessThan(1000); // Should be fast
    });

    it('should handle missing element ID', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: ['A'],
          datasets: [{ label: 'Test', data: [1] }],
        },
        options: {},
        elementId: '',
      };

      const result = renderer.render(config);
      expect(result).toBeDefined();
    });
  });

  describe('chart options', () => {
    it('should apply responsive option', () => {
      const config: ChartConfig = {
        type: 'line',
        data: {
          labels: ['A'],
          datasets: [{ label: 'Test', data: [1] }],
        },
        options: { responsive: true },
        elementId: 'resp-test',
      };

      const result = renderer.render(config);
      expect(result.data).toBeDefined();
    });

    it('should apply interactive option', () => {
      const config: ChartConfig = {
        type: 'bar',
        data: {
          labels: ['A'],
          datasets: [{ label: 'Test', data: [1] }],
        },
        options: { interactive: true },
        elementId: 'int-test',
      };

      const result = renderer.render(config);
      expect(result.data).toBeDefined();
    });
  });
});
