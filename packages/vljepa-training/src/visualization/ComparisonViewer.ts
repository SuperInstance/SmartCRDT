/**
 * @fileoverview Before/after comparison viewer for model outputs
 * @package @lsi/vljepa-training
 */

import type { VisualizationConfig } from "../types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Comparison data
 */
interface ComparisonData {
  before: {
    images?: string[]; // Base64 or URLs
    embeddings?: number[][];
    predictions?: unknown[];
    metrics?: Record<string, number>;
  };
  after: {
    images?: string[];
    embeddings?: number[][];
    predictions?: unknown[];
    metrics?: Record<string, number>;
  };
  labels?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Comparison viewer for model improvements
 *
 * Features:
 * - Side-by-side image comparison
 * - Before/after metrics comparison
 * - Embedding space comparison
 * - Interactive HTML output
 */
export class ComparisonViewer {
  private config: VisualizationConfig;
  private isEnabled: boolean;

  constructor(config: VisualizationConfig) {
    this.config = config;
    this.isEnabled = config.enabled;
  }

  /**
   * Generate comparison view
   */
  async compare(data: ComparisonData, outputPath: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    console.log(`[ComparisonViewer] Generating comparison view...`);

    // Ensure output directory exists
    const dir = join(outputPath, "..");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Generate visualizations
    for (const format of this.config.formats) {
      switch (format) {
        case "html":
          await this.generateHTML(data, outputPath + ".html");
          break;
        case "json":
          await this.generateJSON(data, outputPath + ".json");
          break;
        default:
          console.log(
            `[ComparisonViewer] ${format.toUpperCase()} output not implemented`
          );
      }
    }

    console.log(`[ComparisonViewer] Comparison saved to ${outputPath}`);
  }

  /**
   * Generate interactive HTML comparison
   */
  private async generateHTML(
    data: ComparisonData,
    outputPath: string
  ): Promise<void> {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Before/After Comparison</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; }
    h1 { text-align: center; }
    .comparison { display: flex; gap: 20px; margin: 20px 0; }
    .side { flex: 1; }
    .side h2 { text-align: center; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    .before h2 { color: #d62728; }
    .after h2 { color: #2ca02c; }
    .metrics { margin: 20px 0; }
    .metrics-table { width: 100%; border-collapse: collapse; }
    .metrics-table th, .metrics-table td {
      border: 1px solid #ddd; padding: 10px; text-align: center;
    }
    .metrics-table th { background: #f0f0f0; }
    .better { color: green; font-weight: bold; }
    .worse { color: red; font-weight: bold; }
    .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .image-item { text-align: center; }
    .image-item img { max-width: 100%; height: auto; border: 1px solid #ddd; }
    .image-item label { display: block; margin-top: 5px; font-size: 12px; }
    .delta { font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Model Comparison: Before vs After Training</h1>

    ${this.generateMetricsSection(data)}

    ${data.before.images && data.after.images ? this.generateImageSection(data) : ""}

    ${this.generateImprovementSummary(data)}
  </div>
</body>
</html>`;

    await writeFile(outputPath, html);
  }

  /**
   * Generate metrics section
   */
  private generateMetricsSection(data: ComparisonData): string {
    if (!data.before.metrics || !data.after.metrics) {
      return "";
    }

    const metrics = new Set([
      ...Object.keys(data.before.metrics),
      ...Object.keys(data.after.metrics),
    ]);

    let rows = "";
    for (const metric of metrics) {
      const before = data.before.metrics![metric] || 0;
      const after = data.after.metrics![metric] || 0;
      const delta = after - before;
      const deltaPercent =
        before !== 0 ? ((delta / before) * 100).toFixed(1) : "N/A";

      let className = "";
      if (delta > 0) {
        className = "better";
      } else if (delta < 0) {
        className = "worse";
      }

      rows += `<tr>
        <td>${metric}</td>
        <td>${before.toFixed(4)}</td>
        <td>${after.toFixed(4)}</td>
        <td class="${className}">${delta > 0 ? "+" : ""}${delta.toFixed(4)}</td>
        <td class="${className}">${delta !== 0 ? deltaPercent + "%" : "-"}</td>
      </tr>`;
    }

    return `<div class="metrics">
      <h2>Metrics Comparison</h2>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Before</th>
            <th>After</th>
            <th>Delta</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }

  /**
   * Generate image comparison section
   */
  private generateImageSection(data: ComparisonData): string {
    const beforeImages = data.before.images || [];
    const afterImages = data.after.images || [];
    const labels = data.labels || [];
    const numPairs = Math.max(beforeImages.length, afterImages.length);

    let beforeGrid = "";
    let afterGrid = "";

    for (let i = 0; i < numPairs; i++) {
      const label = labels[i] || `Sample ${i + 1}`;

      if (beforeImages[i]) {
        beforeGrid += `<div class="image-item">
          <img src="${beforeImages[i]}" alt="Before ${i}">
          <label>${label}</label>
        </div>`;
      }

      if (afterImages[i]) {
        afterGrid += `<div class="image-item">
          <img src="${afterImages[i]}" alt="After ${i}">
          <label>${label}</label>
        </div>`;
      }
    }

    return `<div class="comparison">
      <div class="side before">
        <h2>Before Training</h2>
        <div class="image-grid">${beforeGrid}</div>
      </div>
      <div class="side after">
        <h2>After Training</h2>
        <div class="image-grid">${afterGrid}</div>
      </div>
    </div>`;
  }

  /**
   * Generate improvement summary
   */
  private generateImprovementSummary(data: ComparisonData): string {
    if (!data.before.metrics || !data.after.metrics) {
      return "";
    }

    let improvements = 0;
    let regressions = 0;
    let noChange = 0;

    for (const metric of Object.keys(data.before.metrics)) {
      const before = data.before.metrics[metric] || 0;
      const after = data.after.metrics[metric] || 0;
      const delta = after - before;

      if (delta > 0.0001) {
        improvements++;
      } else if (delta < -0.0001) {
        regressions++;
      } else {
        noChange++;
      }
    }

    return `<div class="metrics">
      <h2>Summary</h2>
      <ul>
        <li><strong>Improved:</strong> ${improvements} metrics</li>
        <li><strong>Regressed:</strong> ${regressions} metrics</li>
        <li><strong>No Change:</strong> ${noChange} metrics</li>
      </ul>
    </div>`;
  }

  /**
   * Generate JSON output
   */
  private async generateJSON(
    data: ComparisonData,
    outputPath: string
  ): Promise<void> {
    const comparison = {
      before: data.before,
      after: data.after,
      labels: data.labels,
      metadata: data.metadata,
      deltas: this.computeDeltas(data),
    };

    await writeFile(outputPath, JSON.stringify(comparison, null, 2));
  }

  /**
   * Compute metric deltas
   */
  private computeDeltas(data: ComparisonData): Record<
    string,
    {
      before: number;
      after: number;
      delta: number;
      percentChange: number;
    }
  > {
    const deltas: Record<
      string,
      {
        before: number;
        after: number;
        delta: number;
        percentChange: number;
      }
    > = {};

    if (!data.before.metrics || !data.after.metrics) {
      return deltas;
    }

    for (const metric of Object.keys(data.before.metrics)) {
      const before = data.before.metrics[metric] || 0;
      const after = data.after.metrics[metric] || 0;
      const delta = after - before;
      const percentChange = before !== 0 ? (delta / before) * 100 : 0;

      deltas[metric] = {
        before,
        after,
        delta,
        percentChange,
      };
    }

    return deltas;
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
