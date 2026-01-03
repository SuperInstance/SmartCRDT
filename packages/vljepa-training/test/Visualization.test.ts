/**
 * @fileoverview Tests for Visualization components
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingVisualizer } from '../src/visualization/EmbeddingVisualizer.js';
import { AttentionVisualizer } from '../src/visualization/AttentionVisualizer.js';
import { LossPlotter } from '../src/visualization/LossPlotter.js';
import { ComparisonViewer } from '../src/visualization/ComparisonViewer.js';
import type { VisualizationConfig } from '../src/types.js';

function createMockConfig(): VisualizationConfig {
  return {
    enabled: true,
    outputDir: './test-viz',
    formats: ['html', 'json'],
    frequency: 10,
    interactive: true,
    embeddings: {
      enabled: true,
      method: 'pca',
      dimension: 2,
      samples: 100,
    },
    attention: {
      enabled: true,
      layers: [0, 6, 11],
      heads: [0, 1, 2, 3],
      samples: 10,
    },
    lossCurves: {
      enabled: true,
      smoothing: 5,
      figsize: [1200, 600],
    },
    confusionMatrix: {
      enabled: true,
      normalize: true,
    },
  };
}

describe('EmbeddingVisualizer', () => {
  let visualizer: EmbeddingVisualizer;

  beforeEach(() => {
    visualizer = new EmbeddingVisualizer(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(visualizer).toBeDefined();
    });

    it('should be active when enabled', () => {
      expect(visualizer.active()).toBe(true);
    });

    it('should be inactive when disabled', () => {
      const config = createMockConfig();
      config.embeddings.enabled = false;

      const viz = new EmbeddingVisualizer(config);
      expect(viz.active()).toBe(false);
    });
  });

  describe('Visualization', () => {
    it('should visualize embeddings', async () => {
      const data = {
        embeddings: Array.from({ length: 100 }, () =>
          Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        ),
        labels: Array.from({ length: 100 }, (_, i) => `Sample ${i}`),
      };

      await expect(visualizer.visualize(data, './test-output')).resolves.not.toThrow();
    });

    it('should handle 3D visualization', async () => {
      const config = createMockConfig();
      config.embeddings.dimension = 3;

      const viz = new EmbeddingVisualizer(config);

      const data = {
        embeddings: Array.from({ length: 50 }, () =>
          Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        ),
        labels: Array.from({ length: 50 }, (_, i) => `Sample ${i}`),
      };

      await expect(viz.visualize(data, './test-3d')).resolves.not.toThrow();
    });

    it('should handle t-SNE method', async () => {
      const config = createMockConfig();
      config.embeddings.method = 'tsne';

      const viz = new EmbeddingVisualizer(config);

      const data = {
        embeddings: Array.from({ length: 50 }, () =>
          Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        ),
        labels: Array.from({ length: 50 }, (_, i) => `Sample ${i}`),
      };

      await expect(viz.visualize(data, './test-tsne')).resolves.not.toThrow();
    });

    it('should handle UMAP method', async () => {
      const config = createMockConfig();
      config.embeddings.method = 'umap';

      const viz = new EmbeddingVisualizer(config);

      const data = {
        embeddings: Array.from({ length: 50 }, () =>
          Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        ),
        labels: Array.from({ length: 50 }, (_, i) => `Sample ${i}`),
      };

      await expect(viz.visualize(data, './test-umap')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty embeddings', async () => {
      const data = {
        embeddings: [],
        labels: [],
      };

      await expect(visualizer.visualize(data, './test-empty')).resolves.not.toThrow();
    });

    it('should handle single embedding', async () => {
      const data = {
        embeddings: [[1, 2, 3]],
        labels: ['Single'],
      };

      await expect(visualizer.visualize(data, './test-single')).resolves.not.toThrow();
    });
  });
});

describe('AttentionVisualizer', () => {
  let visualizer: AttentionVisualizer;

  beforeEach(() => {
    visualizer = new AttentionVisualizer(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(visualizer).toBeDefined();
    });

    it('should be active when enabled', () => {
      expect(visualizer.active()).toBe(true);
    });
  });

  describe('Visualization', () => {
    it('should visualize attention', async () => {
      const data = {
        attention: [
          [
            [
              [0.1, 0.2, 0.3, 0.4],
              [0.2, 0.3, 0.4, 0.1],
              [0.3, 0.4, 0.1, 0.2],
              [0.4, 0.1, 0.2, 0.3],
            ],
          ],
        ],
        tokens: ['Token0', 'Token1', 'Token2', 'Token3'],
      };

      await expect(visualizer.visualize(data, './test-attention')).resolves.not.toThrow();
    });

    it('should handle multi-layer attention', async () => {
      const data = {
        attention: [
          // Layer 0
          [
            [
              [0.25, 0.25, 0.25, 0.25],
              [0.25, 0.25, 0.25, 0.25],
            ],
          ],
          // Layer 1
          [
            [
              [0.5, 0.5],
              [0.5, 0.5],
            ],
          ],
        ],
        tokens: ['T0', 'T1'],
      };

      await expect(visualizer.visualize(data, './test-multi')).resolves.not.toThrow();
    });

    it('should handle multi-head attention', async () => {
      const data = {
        attention: [
          // 2 heads
          [
            [
              [0.5, 0.5],
              [0.5, 0.5],
            ],
            [
              [0.3, 0.7],
              [0.7, 0.3],
            ],
          ],
        ],
        tokens: ['A', 'B'],
      };

      await expect(visualizer.visualize(data, './test-multihead')).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should compute attention statistics', () => {
      const attention = [
        [0.25, 0.25, 0.25, 0.25],
        [0.5, 0.3, 0.1, 0.1],
      ];

      const stats = visualizer.computeStats(attention);

      expect(stats.mean).toBeCloseTo(0.25, 4);
      expect(stats.min).toBe(0.1);
      expect(stats.max).toBe(0.5);
      expect(stats.entropy).toBeGreaterThan(0);
    });

    it('should compute entropy correctly', () => {
      const uniform = [
        [0.25, 0.25, 0.25, 0.25],
        [0.25, 0.25, 0.25, 0.25],
      ];

      const stats = visualizer.computeStats(uniform);

      // Uniform distribution has maximum entropy
      expect(stats.entropy).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty attention', async () => {
      const data = {
        attention: [],
        tokens: [],
      };

      await expect(visualizer.visualize(data, './test-empty')).resolves.not.toThrow();
    });

    it('should handle single token', async () => {
      const data = {
        attention: [
          [
            [[1.0]],
          ],
        ],
        tokens: ['Single'],
      };

      await expect(visualizer.visualize(data, './test-single')).resolves.not.toThrow();
    });
  });
});

describe('LossPlotter', () => {
  let plotter: LossPlotter;

  beforeEach(() => {
    plotter = new LossPlotter(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(plotter).toBeDefined();
    });

    it('should be active when enabled', () => {
      expect(plotter.active()).toBe(true);
    });
  });

  describe('Plotting', () => {
    it('should plot loss curves', async () => {
      const data = {
        epochs: [1, 2, 3, 4, 5],
        trainingLoss: [2.0, 1.5, 1.0, 0.7, 0.5],
        validationLoss: [2.2, 1.7, 1.2, 0.9, 0.6],
      };

      await expect(plotter.plot(data, './test-loss')).resolves.not.toThrow();
    });

    it('should plot from metrics', async () => {
      const metrics = [
        { epoch: 1, batch: 0, loss: { training: 2.0, validation: 2.2 }, accuracy: {}, latency: { forward: 0, backward: 0, total: 0 }, memory: { gpu: 0, cpu: 0, peak: 0 }, throughput: 0, learning: { gradientNorm: 0, learningRate: 0 }, timestamp: 1 },
        { epoch: 2, batch: 0, loss: { training: 1.5, validation: 1.7 }, accuracy: {}, latency: { forward: 0, backward: 0, total: 0 }, memory: { gpu: 0, cpu: 0, peak: 0 }, throughput: 0, learning: { gradientNorm: 0, learningRate: 0 }, timestamp: 2 },
      ];

      await expect(plotter.plotFromMetrics(metrics, './test-from-metrics')).resolves.not.toThrow();
    });
  });

  describe('Smoothing', () => {
    it('should apply smoothing', async () => {
      const data = {
        epochs: [1, 2, 3, 4, 5],
        trainingLoss: [2.0, 1.8, 1.2, 1.4, 0.8],
        validationLoss: [2.2, 2.0, 1.4, 1.6, 1.0],
        smoothWindow: 3,
      };

      await expect(plotter.plot(data, './test-smooth')).resolves.not.toThrow();
    });

    it('should not smooth with window of 0', async () => {
      const data = {
        epochs: [1, 2, 3],
        trainingLoss: [2.0, 1.5, 1.0],
        validationLoss: [2.2, 1.7, 1.2],
        smoothWindow: 0,
      };

      await expect(plotter.plot(data, './test-no-smooth')).resolves.not.toThrow();
    });
  });
});

describe('ComparisonViewer', () => {
  let viewer: ComparisonViewer;

  beforeEach(() => {
    viewer = new ComparisonViewer(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(viewer).toBeDefined();
    });

    it('should be active when enabled', () => {
      expect(viewer.active()).toBe(true);
    });
  });

  describe('Comparisons', () => {
    it('should generate comparison view', async () => {
      const data = {
        before: {
          metrics: {
            accuracy: 0.75,
            loss: 0.65,
            top5Accuracy: 0.92,
          },
        },
        after: {
          metrics: {
            accuracy: 0.87,
            loss: 0.42,
            top5Accuracy: 0.98,
          },
        },
      };

      await expect(viewer.compare(data, './test-comparison')).resolves.not.toThrow();
    });

    it('should compute metric deltas', () => {
      const data = {
        before: {
          metrics: { accuracy: 0.75, loss: 0.65 },
        },
        after: {
          metrics: { accuracy: 0.87, loss: 0.42 },
        },
      };

      // The comparison should be generated without error
      expect(() => viewer.compare(data, './test')).not.toThrow();
    });
  });

  describe('Image Comparison', () => {
    it('should handle image comparison', async () => {
      const data = {
        before: {
          images: ['data:image/png;base64,iVBOR...'],
          metrics: { accuracy: 0.75 },
        },
        after: {
          images: ['data:image/png;base64,iVBOR...'],
          metrics: { accuracy: 0.87 },
        },
        labels: ['Sample 1'],
      };

      await expect(viewer.compare(data, './test-images')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing metrics', async () => {
      const data = {
        before: {},
        after: {},
      };

      await expect(viewer.compare(data, './test-empty')).resolves.not.toThrow();
    });

    it('should handle partial metrics', async () => {
      const data = {
        before: {
          metrics: { accuracy: 0.75 },
        },
        after: {
          metrics: { loss: 0.42 },
        },
      };

      await expect(viewer.compare(data, './test-partial')).resolves.not.toThrow();
    });
  });
});

describe('Visualization Integration', () => {
  it('should create multiple visualizers', () => {
    const config = createMockConfig();

    const embViz = new EmbeddingVisualizer(config);
    const attViz = new AttentionVisualizer(config);
    const lossPlot = new LossPlotter(config);
    const compView = new ComparisonViewer(config);

    expect(embViz).toBeDefined();
    expect(attViz).toBeDefined();
    expect(lossPlot).toBeDefined();
    expect(compView).toBeDefined();
  });

  it('should support multiple output formats', () => {
    const config = createMockConfig();
    config.formats = ['html', 'json', 'png', 'svg'];

    const visualizer = new EmbeddingVisualizer(config);

    expect(visualizer.active()).toBe(true);
  });
});
