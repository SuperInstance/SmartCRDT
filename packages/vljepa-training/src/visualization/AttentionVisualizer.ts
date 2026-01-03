/**
 * @fileoverview Attention visualization for transformer models
 * @package @lsi/vljepa-training
 */

import type { VisualizationConfig } from "../types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Attention map data
 */
interface AttentionData {
  attention: number[][][]; // [layers, heads, seq_len, seq_len]
  tokens: string[];
  layerNames?: string[];
}

/**
 * Attention visualizer for transformer attention patterns
 *
 * Features:
 * - Visualize attention weights per layer and head
 * - Multi-head attention visualization
 * - Attention flow visualization
 * - HTML interactive output
 */
export class AttentionVisualizer {
  private config: VisualizationConfig;
  private isEnabled: boolean;

  constructor(config: VisualizationConfig) {
    this.config = config;
    this.isEnabled = config.enabled && config.attention.enabled;
  }

  /**
   * Visualize attention maps
   */
  async visualize(data: AttentionData, outputPath: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    console.log(`[AttentionVisualizer] Visualizing attention patterns...`);

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
        case "png":
        case "svg":
          console.log(
            `[AttentionVisualizer] ${format.toUpperCase()} output not implemented`
          );
          break;
      }
    }

    console.log(`[AttentionVisualizer] Visualization saved to ${outputPath}`);
  }

  /**
   * Generate interactive HTML visualization
   */
  private async generateHTML(
    data: AttentionData,
    outputPath: string
  ): Promise<void> {
    const numLayers = data.attention.length;
    const numHeads = data.attention[0].length;
    const seqLen = data.tokens.length;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Attention Visualization</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .controls { margin: 20px 0; }
    select, button { margin: 0 5px; padding: 5px 10px; }
    #container { display: flex; gap: 20px; }
    #attentionMap { flex: 1; }
    #info { flex: 1; min-width: 300px; }
    .cell {
      display: inline-block;
      width: 20px;
      height: 20px;
      margin: 1px;
      border: 1px solid #ccc;
    }
    .tokens { display: flex; flex-direction: column; }
    .token { padding: 5px; border-bottom: 1px solid #eee; }
    .legend { margin: 10px 0; }
    .legend-color { display: inline-block; width: 20px; height: 20px; vertical-align: middle; }
  </style>
</head>
<body>
  <h1>Attention Visualization</h1>
  <div class="controls">
    <label>Layer: <select id="layerSelect">
      ${Array.from(
        { length: numLayers },
        (_, i) => `<option value="${i}">Layer ${i + 1}</option>`
      ).join("")}
    </select></label>
    <label>Head: <select id="headSelect">
      ${Array.from(
        { length: numHeads },
        (_, i) => `<option value="${i}">Head ${i + 1}</option>`
      ).join("")}
    </select></label>
  </div>
  <div id="container">
    <div id="attentionMap"></div>
    <div id="info">
      <h3>Selected Token</h3>
      <div id="selectedToken">-</div>
      <h3>Attention Distribution</h3>
      <div id="attentionDist"></div>
    </div>
  </div>
  <script>
    const data = ${JSON.stringify({
      attention: data.attention,
      tokens: data.tokens,
    })};

    const layerSelect = document.getElementById('layerSelect');
    const headSelect = document.getElementById('headSelect');
    const container = document.getElementById('attentionMap');

    function renderAttention() {
      const layer = parseInt(layerSelect.value);
      const head = parseInt(headSelect.value);
      const attention = data.attention[layer][head];

      let html = '<table style="border-collapse: collapse;">';
      html += '<tr><th></th>';
      data.tokens.forEach(token => {
        html += '<th style="font-size: 10px; max-width: 50px;">' + token + '</th>';
      });
      html += '</tr>';

      for (let i = 0; i < attention.length; i++) {
        html += '<tr>';
        html += '<td style="font-weight: bold;">' + data.tokens[i] + '</td>';
        for (let j = 0; j < attention[i].length; j++) {
          const value = attention[i][j];
          const color = getColor(value);
          html += '<td style="background-color: ' + color + '; width: 30px; height: 30px;" ' +
                   'data-i="' + i + '" data-j="' + j + '" data-value="' + value.toFixed(4) + '"></td>';
        }
        html += '</tr>';
      }
      html += '</table>';

      container.innerHTML = html;

      // Add click handlers
      container.querySelectorAll('td[data-i]').forEach(cell => {
        cell.addEventListener('click', (e) => {
          const i = parseInt(e.target.dataset.i);
          const j = parseInt(e.target.dataset.j);
          showInfo(i, j, attention);
        });
      });
    }

    function getColor(value) {
      // Blue to red colormap
      const r = Math.floor(255 * value);
      const b = Math.floor(255 * (1 - value));
      return 'rgba(' + r + ', 0, ' + b + ', 0.8)';
    }

    function showInfo(i, j, attention) {
      document.getElementById('selectedToken').textContent =
        'Query: ' + data.tokens[i] + ' -> Key: ' + data.tokens[j];

      let distHtml = '<ul>';
      for (let k = 0; k < attention[i].length; k++) {
        if (attention[i][k] > 0.05) {
          distHtml += '<li>' + data.tokens[k] + ': ' + (attention[i][k] * 100).toFixed(1) + '%</li>';
        }
      }
      distHtml += '</ul>';
      document.getElementById('attentionDist').innerHTML = distHtml;
    }

    layerSelect.addEventListener('change', renderAttention);
    headSelect.addEventListener('change', renderAttention);

    renderAttention();
  </script>
</body>
</html>`;

    await writeFile(outputPath, html);
  }

  /**
   * Generate JSON output
   */
  private async generateJSON(
    data: AttentionData,
    outputPath: string
  ): Promise<void> {
    const json = {
      tokens: data.tokens,
      layerNames: data.layerNames,
      attention: data.attention,
      summary: {
        numLayers: data.attention.length,
        numHeads: data.attention[0].length,
        seqLen: data.tokens.length,
      },
    };

    await writeFile(outputPath, JSON.stringify(json, null, 2));
  }

  /**
   * Compute attention statistics
   */
  computeStats(attention: number[][]): {
    mean: number;
    std: number;
    min: number;
    max: number;
    entropy: number;
  } {
    const flat = attention.flat();
    const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
    const variance =
      flat.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / flat.length;

    // Entropy (average entropy per query)
    let entropy = 0;
    for (const row of attention) {
      const rowEntropy = row.reduce(
        (acc, val) => acc - val * Math.log(val + 1e-10),
        0
      );
      entropy += rowEntropy;
    }
    entropy /= attention.length;

    return {
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...flat),
      max: Math.max(...flat),
      entropy,
    };
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
