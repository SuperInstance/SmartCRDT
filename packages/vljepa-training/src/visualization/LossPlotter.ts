/**
 * @fileoverview Loss curve visualization for training monitoring
 * @package @lsi/vljepa-training
 */

import type { VisualizationConfig, TrainingMetrics } from "../types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Loss curve data
 */
interface LossCurveData {
  epochs: number[];
  trainingLoss: number[];
  validationLoss: number[];
  smoothWindow?: number;
}

/**
 * Loss plotter for training curves
 *
 * Features:
 * - Training and validation loss curves
 * - Moving average smoothing
 * - Multiple loss components
 * - HTML interactive output
 */
export class LossPlotter {
  private config: VisualizationConfig;
  private isEnabled: boolean;

  constructor(config: VisualizationConfig) {
    this.config = config;
    this.isEnabled = config.enabled && config.lossCurves.enabled;
  }

  /**
   * Plot loss curves
   */
  async plot(data: LossCurveData, outputPath: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    console.log(`[LossPlotter] Plotting loss curves...`);

    // Ensure output directory exists
    const dir = join(outputPath, "..");
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Apply smoothing if configured
    const smoothWindow = data.smoothWindow ?? this.config.lossCurves.smoothing;

    const smoothedData =
      smoothWindow > 0 ? this.smooth(data, smoothWindow) : data;

    // Generate visualizations
    for (const format of this.config.formats) {
      switch (format) {
        case "html":
          await this.generateHTML(smoothedData, outputPath + ".html");
          break;
        case "json":
          await this.generateJSON(smoothedData, outputPath + ".json");
          break;
        case "png":
        case "svg":
          console.log(
            `[LossPlotter] ${format.toUpperCase()} output not implemented`
          );
          break;
      }
    }

    console.log(`[LossPlotter] Plot saved to ${outputPath}`);
  }

  /**
   * Plot loss curves from training metrics
   */
  async plotFromMetrics(
    metrics: TrainingMetrics[],
    outputPath: string
  ): Promise<void> {
    const data: LossCurveData = {
      epochs: metrics.map(m => m.epoch),
      trainingLoss: metrics.map(m => m.loss.training),
      validationLoss: metrics.map(m => m.loss.validation),
    };

    await this.plot(data, outputPath);
  }

  /**
   * Apply moving average smoothing
   */
  private smooth(data: LossCurveData, window: number): LossCurveData {
    const smoothOne = (arr: number[]) => {
      const result: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - Math.floor(window / 2));
        const end = Math.min(arr.length, i + Math.floor(window / 2) + 1);
        const slice = arr.slice(start, end);
        result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
      }
      return result;
    };

    return {
      epochs: data.epochs,
      trainingLoss: smoothOne(data.trainingLoss),
      validationLoss: smoothOne(data.validationLoss),
      smoothWindow: window,
    };
  }

  /**
   * Generate interactive HTML plot
   */
  private async generateHTML(
    data: LossCurveData,
    outputPath: string
  ): Promise<void> {
    const [width, height] = this.config.lossCurves.figsize;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Loss Curves</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { position: relative; width: ${width}px; height: ${height}px; }
    canvas { border: 1px solid #ccc; }
    .legend { margin: 10px 0; }
    .legend-item { display: inline-block; margin: 0 10px; }
    .legend-color { display: inline-block; width: 20px; height: 3px; vertical-align: middle; margin-right: 5px; }
    .stats { margin: 20px 0; }
    .stats-table { border-collapse: collapse; }
    .stats-table td, .stats-table th { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .tooltip {
      position: absolute;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      pointer-events: none;
      display: none;
      z-index: 10;
    }
  </style>
</head>
<body>
  <h1>Loss Curves${data.smoothWindow ? ` (smoothed, window=${data.smoothWindow})` : ""}</h1>
  <div class="legend">
    <div class="legend-item">
      <span class="legend-color" style="background-color: #1f77b4;"></span>
      Training Loss
    </div>
    <div class="legend-item">
      <span class="legend-color" style="background-color: #ff7f0e;"></span>
      Validation Loss
    </div>
  </div>
  <div class="container">
    <canvas id="canvas" width="${width}" height="${height}"></canvas>
    <div id="tooltip" class="tooltip"></div>
  </div>
  <div class="stats" id="stats"></div>
  <script>
    const data = ${JSON.stringify(data)};
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('tooltip');
    const statsDiv = document.getElementById('stats');

    // Find bounds
    const allLoss = [...data.trainingLoss, ...data.validationLoss];
    const minY = Math.min(...allLoss) * 0.95;
    const maxY = Math.max(...allLoss) * 1.05;
    const maxX = Math.max(...data.epochs);

    // Scale to canvas
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    function toCanvas(x, y) {
      return [
        padding.left + (x / maxX) * plotWidth,
        canvas.height - padding.bottom - ((y - minY) / (maxY - minY)) * plotHeight
      ];
    }

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.stroke();

    // Draw y-axis labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = minY + (maxY - minY) * (i / 5);
      const [cx, cy] = toCanvas(0, y);
      ctx.fillText(y.toFixed(4), padding.left - 10, cy + 4);

      // Grid line
      ctx.strokeStyle = '#eee';
      ctx.beginPath();
      ctx.moveTo(padding.left, cy);
      ctx.lineTo(canvas.width - padding.right, cy);
      ctx.stroke();
    }

    // Draw x-axis labels
    ctx.textAlign = 'center';
    const xSteps = 10;
    for (let i = 0; i <= xSteps; i++) {
      const x = (maxX / xSteps) * i;
      const [cx, cy] = toCanvas(x, 0);
      ctx.fillText(x.toString(), cx, canvas.height - padding.bottom + 20);
    }

    // Draw training loss
    ctx.strokeStyle = '#1f77b4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.epochs.length; i++) {
      const [cx, cy] = toCanvas(data.epochs[i], data.trainingLoss[i]);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();

    // Draw validation loss
    ctx.strokeStyle = '#ff7f0e';
    ctx.beginPath();
    for (let i = 0; i < data.epochs.length; i++) {
      const [cx, cy] = toCanvas(data.epochs[i], data.validationLoss[i]);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();

    // Find nearest point on hover
    const points = data.epochs.map((epoch, i) => ({
      x: epoch,
      trainY: data.trainingLoss[i],
      valY: data.validationLoss[i],
      canvasX: toCanvas(epoch, 0)[0],
    }));

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      let nearest = null;
      let minDist = Infinity;

      for (const p of points) {
        const dist = Math.abs(mouseX - p.canvasX);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }

      if (nearest && minDist < 50) {
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY + 10) + 'px';
        tooltip.innerHTML =
          'Epoch: ' + nearest.x + '<br>' +
          'Train: ' + nearest.trainY.toFixed(4) + '<br>' +
          'Val: ' + nearest.valY.toFixed(4);
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    // Compute and display statistics
    const stats = computeStats(data.trainingLoss, data.validationLoss);
    statsDiv.innerHTML =
      '<h2>Statistics</h2>' +
      '<table class="stats-table">' +
      '<tr><th>Metric</th><th>Training</th><th>Validation</th></tr>' +
      '<tr><td>Final Loss</td><td>' + stats.trainFinal.toFixed(4) + '</td><td>' + stats.valFinal.toFixed(4) + '</td></tr>' +
      '<tr><td>Best Loss</td><td>' + stats.trainBest.toFixed(4) + '</td><td>' + stats.valBest.toFixed(4) + '</td></tr>' +
      '<tr><td>Mean Loss</td><td>' + stats.trainMean.toFixed(4) + '</td><td>' + stats.valMean.toFixed(4) + '</td></tr>' +
      '<tr><td>Std Loss</td><td>' + stats.trainStd.toFixed(4) + '</td><td>' + stats.valStd.toFixed(4) + '</td></tr>' +
      '</table>';

    function computeStats(train, val) {
      const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
      const std = arr => {
        const m = mean(arr);
        return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
      };

      return {
        trainFinal: train[train.length - 1],
        valFinal: val[val.length - 1],
        trainBest: Math.min(...train),
        valBest: Math.min(...val),
        trainMean: mean(train),
        valMean: mean(val),
        trainStd: std(train),
        valStd: std(val),
      };
    }
  </script>
</body>
</html>`;

    await writeFile(outputPath, html);
  }

  /**
   * Generate JSON output
   */
  private async generateJSON(
    data: LossCurveData,
    outputPath: string
  ): Promise<void> {
    const json = {
      epochs: data.epochs,
      training: {
        loss: data.trainingLoss,
        final: data.trainingLoss[data.trainingLoss.length - 1],
        best: Math.min(...data.trainingLoss),
        mean:
          data.trainingLoss.reduce((a, b) => a + b, 0) /
          data.trainingLoss.length,
      },
      validation: {
        loss: data.validationLoss,
        final: data.validationLoss[data.validationLoss.length - 1],
        best: Math.min(...data.validationLoss),
        mean:
          data.validationLoss.reduce((a, b) => a + b, 0) /
          data.validationLoss.length,
      },
      smoothWindow: data.smoothWindow,
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
