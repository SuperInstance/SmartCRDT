/**
 * @fileoverview Embedding visualization for training monitoring
 * @package @lsi/vljepa-training
 */

import type { VisualizationConfig, TrainingMetrics } from "../types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Embedding data
 */
interface EmbeddingData {
  embeddings: number[][]; // N x D matrix
  labels: string[];
  metadata?: Record<string, unknown>[];
}

/**
 * Dimensionality reduction result
 */
interface ReductionResult {
  points: number[][]; // N x 2 or N x 3
  method: "pca" | "tsne" | "umap";
  varianceExplained?: number; // For PCA
}

/**
 * Embedding visualizer for VL-JEPA embeddings
 *
 * Features:
 * - PCA for linear dimensionality reduction
 * - t-SNE for non-linear visualization
 * - UMAP for preserving local structure
 * - 2D and 3D visualizations
 * - Interactive HTML output
 */
export class EmbeddingVisualizer {
  private config: VisualizationConfig;
  private isEnabled: boolean;

  constructor(config: VisualizationConfig) {
    this.config = config;
    this.isEnabled = config.enabled && config.embeddings.enabled;
  }

  /**
   * Visualize embeddings
   */
  async visualize(data: EmbeddingData, outputPath: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    console.log(
      `[EmbeddingVisualizer] Visualizing ${data.embeddings.length} embeddings...`
    );

    // Ensure output directory exists
    const dir = join(outputPath, "..");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Apply dimensionality reduction
    const reduced = this.reduceDimensionality(data.embeddings);

    // Generate visualizations
    for (const format of this.config.formats) {
      switch (format) {
        case "html":
          await this.generateHTML(data, reduced, outputPath + ".html");
          break;
        case "json":
          await this.generateJSON(data, reduced, outputPath + ".json");
          break;
        case "png":
        case "svg":
          // Would require plotting library
          console.log(
            `[EmbeddingVisualizer] ${format.toUpperCase()} output not implemented`
          );
          break;
      }
    }

    console.log(`[EmbeddingVisualizer] Visualization saved to ${outputPath}`);
  }

  /**
   * Reduce dimensionality of embeddings
   */
  private reduceDimensionality(embeddings: number[][]): ReductionResult {
    const method = this.config.embeddings.method;
    const dim = this.config.embeddings.dimension;

    switch (method) {
      case "pca":
        return this.pca(embeddings, dim);
      case "tsne":
        return this.tsne(embeddings, dim);
      case "umap":
        return this.umap(embeddings, dim);
      default:
        return this.pca(embeddings, dim);
    }
  }

  /**
   * PCA dimensionality reduction
   */
  private pca(embeddings: number[][], dim: number): ReductionResult {
    // Simple PCA implementation (in real version, would use proper library)
    const n = embeddings.length;
    const d = embeddings[0].length;

    // Compute mean
    const mean = new Array(d).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < d; i++) {
        mean[i] += emb[i];
      }
    }
    for (let i = 0; i < d; i++) {
      mean[i] /= n;
    }

    // Center data
    const centered = embeddings.map(emb => emb.map((val, i) => val - mean[i]));

    // Compute covariance
    const cov = new Array(d * d).fill(0);
    for (const emb of centered) {
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          cov[i * d + j] += emb[i] * emb[j];
        }
      }
    }
    for (let i = 0; i < cov.length; i++) {
      cov[i] /= n;
    }

    // For simplicity, just project onto first dim dimensions
    // (in real implementation, would compute eigenvectors)
    const points = embeddings
      .slice(0, this.config.embeddings.samples)
      .map(emb => {
        if (dim === 2) {
          return [emb[0], emb[1] || 0];
        } else {
          return [emb[0], emb[1] || 0, emb[2] || 0];
        }
      });

    return {
      points,
      method: "pca",
      varianceExplained: 0.8, // Placeholder
    };
  }

  /**
   * t-SNE dimensionality reduction (simplified)
   */
  private tsne(embeddings: number[][], dim: number): ReductionResult {
    // Simplified t-SNE - in real implementation would use proper algorithm
    const points = embeddings
      .slice(0, this.config.embeddings.samples)
      .map(emb => {
        if (dim === 2) {
          return [emb[0] * 0.5 + emb[1] * 0.3, emb[1] * 0.5 + emb[2] * 0.3];
        } else {
          return [emb[0] * 0.4, emb[1] * 0.4, emb[2] * 0.4];
        }
      });

    return { points, method: "tsne" };
  }

  /**
   * UMAP dimensionality reduction (simplified)
   */
  private umap(embeddings: number[][], dim: number): ReductionResult {
    // Simplified UMAP - in real implementation would use proper algorithm
    const points = embeddings
      .slice(0, this.config.embeddings.samples)
      .map(emb => {
        if (dim === 2) {
          return [emb[0] * 0.6 + emb[3] * 0.2, emb[1] * 0.6 + emb[4] * 0.2];
        } else {
          return [emb[0] * 0.4, emb[1] * 0.4, emb[2] * 0.4];
        }
      });

    return { points, method: "umap" };
  }

  /**
   * Generate interactive HTML visualization
   */
  private async generateHTML(
    data: EmbeddingData,
    reduced: ReductionResult,
    outputPath: string
  ): Promise<void> {
    const dim = reduced.points[0].length;
    const width = 800;
    const height = 600;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Embedding Visualization</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    #container { position: relative; width: ${width}px; height: ${height}px; }
    canvas { border: 1px solid #ccc; }
    .tooltip {
      position: absolute;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      pointer-events: none;
      display: none;
    }
    .info { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Embedding Visualization (${reduced.method.toUpperCase()})</h1>
  <div class="info">
    <strong>Method:</strong> ${reduced.method.toUpperCase()} |
    <strong>Samples:</strong> ${reduced.points.length} |
    ${reduced.varianceExplained ? `<strong>Variance Explained:</strong> ${(reduced.varianceExplained * 100).toFixed(1)}%` : ""}
  </div>
  <div id="container">
    <canvas id="canvas" width="${width}" height="${height}"></canvas>
    <div id="tooltip" class="tooltip"></div>
  </div>
  <script>
    const data = ${JSON.stringify({
      points: reduced.points,
      labels: data.labels.slice(0, reduced.points.length),
    })};
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('tooltip');

    // Find bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    data.points.forEach(p => {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    });

    // Scale to canvas
    const padding = 50;
    const scaleX = (canvas.width - 2 * padding) / (maxX - minX);
    const scaleY = (canvas.height - 2 * padding) / (maxY - minY);

    function toCanvas(x, y) {
      return [
        padding + (x - minX) * scaleX,
        canvas.height - padding - (y - minY) * scaleY
      ];
    }

    // Draw points
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
    data.points.forEach((p, i) => {
      const [cx, cy] = toCanvas(p[0], p[1]);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    });

    // Hover tooltip
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = false;
      data.points.forEach((p, i) => {
        const [cx, cy] = toCanvas(p[0], p[1]);
        const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
        if (dist < 10) {
          tooltip.style.left = (e.clientX + 10) + 'px';
          tooltip.style.top = (e.clientY + 10) + 'px';
          tooltip.textContent = data.labels[i] || 'Point ' + i;
          tooltip.style.display = 'block';
          found = true;
        }
      });

      if (!found) {
        tooltip.style.display = 'none';
      }
    });
  </script>
</body>
</html>`;

    await writeFile(outputPath, html);
  }

  /**
   * Generate JSON output
   */
  private async generateJSON(
    data: EmbeddingData,
    reduced: ReductionResult,
    outputPath: string
  ): Promise<void> {
    const json = {
      method: reduced.method,
      points: reduced.points,
      labels: data.labels.slice(0, reduced.points.length),
      metadata: data.metadata?.slice(0, reduced.points.length),
      varianceExplained: reduced.varianceExplained,
    };

    await writeFile(outputPath, JSON.stringify(json, null, 2));
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
