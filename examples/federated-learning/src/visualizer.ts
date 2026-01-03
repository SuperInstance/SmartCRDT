/**
 * @fileoverview Visualization utilities for federated learning demo
 *
 * Generates ASCII-based visualizations for:
 * - Training curves (accuracy and loss over rounds)
 * - Client participation heatmap
 * - Model convergence visualization
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Round metrics for visualization
 */
export interface RoundMetrics {
  round: number;
  avgLoss: number;
  avgAccuracy: number;
  globalLoss: number;
  globalAccuracy: number;
  selectedClients: string[];
}

/**
 * Visualization config
 */
export interface VisualizationConfig {
  /** Width of the chart (characters) */
  width: number;
  /** Height of the chart (characters) */
  height: number;
  /** Whether to show grid lines */
  showGrid: boolean;
}

// ============================================================================
// ASCII Chart Generator
// ============================================================================

/**
 * Generate ASCII line chart
 */
export class AsciiChart {
  private config: VisualizationConfig;

  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      width: config.width ?? 50,
      height: config.height ?? 15,
      showGrid: config.showGrid ?? true,
    };
  }

  /**
   * Create a line chart from data points
   */
  lineChart(
    data: number[],
    labels: string[] = [],
    title: string = '',
    yLabel: string = '',
    xLabel: string = ''
  ): string {
    if (data.length === 0) return 'No data to display';

    const { width, height } = this.config;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const lines: string[] = [];

    // Add title
    if (title) {
      lines.push(title);
      lines.push('='.repeat(title.length));
    }

    // Add Y-axis label
    if (yLabel) {
      lines.push(`${yLabel}:`);
    }

    // Create chart rows (top to bottom)
    for (let row = height; row >= 0; row--) {
      const yValue = min + (row / height) * range;
      const line: string[] = [];

      // Y-axis value
      line.push(this.formatValue(yValue).padStart(8));
      line.push(' │');

      // Plot points
      for (let col = 0; col < width; col++) {
        const dataIndex = Math.floor((col / width) * (data.length - 1));
        const value = data[dataIndex];
        const valueRow = Math.round(((value - min) / range) * height);

        if (valueRow === row) {
          line.push('█');
        } else if (valueRow > row) {
          line.push('▀');
        } else {
          line.push('░');
        }
      }

      lines.push(line.join(''));
    }

    // X-axis
    const xAxis: string[] = ['         └'];
    for (let col = 0; col < width; col += Math.max(1, Math.floor(width / 10))) {
      const dataIndex = Math.floor((col / width) * (labels.length - 1));
      const label = labels[dataIndex] || '';
      xAxis.push('─'.repeat(Math.max(1, Math.floor(width / 10) - label.length)));
      xAxis.push(label);
    }
    lines.push(xAxis.join('').substring(0, width + 10));

    // X-axis label
    if (xLabel) {
      lines.push(`         ${xLabel}`);
    }

    // Add legend
    lines.push('');
    lines.push(`Min: ${this.formatValue(min)}  Max: ${this.formatValue(max)}  Range: ${this.formatValue(range)}`);

    return lines.join('\n');
  }

  /**
   * Create a multi-line chart
   */
  multiLineChart(
    series: { data: number[]; label: string; symbol: string }[],
    title: string = ''
  ): string {
    if (series.length === 0) return 'No data to display';

    const { width, height } = this.config;

    // Find global min/max
    const allData = series.flatMap((s) => s.data);
    const min = Math.min(...allData);
    const max = Math.max(...allData);
    const range = max - min || 1;

    const lines: string[] = [];

    // Add title
    if (title) {
      lines.push(title);
      lines.push('='.repeat(title.length));
    }

    // Create legend
    lines.push('Legend: ' + series.map((s) => `${s.symbol} ${s.label}`).join('  '));
    lines.push('');

    // Create chart rows
    for (let row = height; row >= 0; row--) {
      const yValue = min + (row / height) * range;
      const line: string[] = [];

      // Y-axis value
      line.push(this.formatValue(yValue).padStart(8));
      line.push(' │');

      // Plot points for all series
      for (let col = 0; col < width; col++) {
        const cell: string[] = [];

        for (const s of series) {
          const dataIndex = Math.floor((col / width) * (s.data.length - 1));
          const value = s.data[dataIndex];
          const valueRow = Math.round(((value - min) / range) * height);

          if (valueRow === row) {
            cell.push(s.symbol);
          }
        }

        line.push(cell.length > 0 ? cell[0] : '░');
      }

      lines.push(line.join(''));
    }

    // X-axis
    lines.push('         └' + '─'.repeat(width));

    // Add stats
    lines.push('');
    for (const s of series) {
      const avg = s.data.reduce((sum, v) => sum + v, 0) / s.data.length;
      lines.push(`${s.symbol} ${s.label}: avg=${this.formatValue(avg)}, min=${this.formatValue(Math.min(...s.data))}, max=${this.formatValue(Math.max(...s.data))}`);
    }

    return lines.join('\n');
  }

  /**
   * Create a bar chart
   */
  barChart(
    data: { label: string; value: number }[],
    title: string = '',
    maxWidth: number = 40
  ): string {
    if (data.length === 0) return 'No data to display';

    const maxValue = Math.max(...data.map((d) => d.value));
    const lines: string[] = [];

    if (title) {
      lines.push(title);
      lines.push('='.repeat(title.length));
      lines.push('');
    }

    for (const item of data) {
      const barLength = Math.round((item.value / maxValue) * maxWidth);
      const bar = '█'.repeat(barLength) + '░'.repeat(maxWidth - barLength);
      lines.push(`${item.label.padEnd(15)} │${bar}│ ${this.formatValue(item.value)}`);
    }

    return lines.join('\n');
  }

  /**
   * Create a client participation heatmap
   */
  participationHeatmap(
    rounds: RoundMetrics[],
    clientIds: string[],
    title: string = 'Client Participation'
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(title);
      lines.push('='.repeat(title.length));
      lines.push('');
    }

    // Header
    lines.push('Round     ' + clientIds.map((id) => id.padStart(8)).join(''));
    lines.push(''.padEnd(8 + clientIds.length * 8, '─'));

    // Rows
    for (const round of rounds) {
      const row = [`Round ${round.round.toString().padStart(3)}`];

      for (const clientId of clientIds) {
        const participated = round.selectedClients.includes(clientId);
        row.push(participated ? '  ████  ' : '  ░░░░  ');
      }

      lines.push(row.join(''));
    }

    return lines.join('\n');
  }

  /**
   * Format a number value
   */
  private formatValue(value: number): string {
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    } else if (Math.abs(value) >= 10) {
      return value.toFixed(2);
    } else {
      return value.toFixed(4);
    }
  }
}

// ============================================================================
// Training Metrics Visualization
// ============================================================================

/**
 * Visualize training metrics over rounds
 */
export function visualizeTrainingMetrics(rounds: RoundMetrics[]): string {
  const chart = new AsciiChart({ width: 50, height: 12 });

  const output: string[] = [];

  // Accuracy chart
  output.push(chart.lineChart(
    rounds.map((r) => r.globalAccuracy * 100),
    rounds.map((r) => `R${r.round}`),
    'Global Model Accuracy (%)',
    'Accuracy',
    'Round'
  ));

  output.push('');
  output.push('');

  // Loss chart
  output.push(chart.lineChart(
    rounds.map((r) => r.globalLoss),
    rounds.map((r) => `R${r.round}`),
    'Global Model Loss',
    'Loss',
    'Round'
  ));

  return output.join('\n');
}

/**
 * Visualize client participation
 */
export function visualizeClientParticipation(rounds: RoundMetrics[]): string {
  // Get all unique client IDs
  const clientIds = Array.from(
    new Set(rounds.flatMap((r) => r.selectedClients))
  ).sort();

  const chart = new AsciiChart();
  return chart.participationHeatmap(rounds, clientIds);
}

/**
 * Visualize comparison between methods
 */
export function visualizeComparison(
  federated: number,
  centralized: number,
  local: number
): string {
  const chart = new AsciiChart();

  return chart.barChart(
    [
      { label: 'Federated', value: federated * 100 },
      { label: 'Centralized', value: centralized * 100 },
      { label: 'Local (avg)', value: local * 100 },
    ],
    'Method Comparison - Accuracy (%)',
    40
  );
}

/**
 * Create a summary dashboard
 */
export function createDashboard(
  rounds: RoundMetrics[],
  federatedAccuracy: number,
  centralizedAccuracy: number,
  localAccuracy: number,
  config: {
    totalRounds: number;
    totalClients: number;
    totalSamples: number;
  }
): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════════════════════════╗');
  lines.push('║          Federated Learning Dashboard                    ║');
  lines.push('╚════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Configuration summary
  lines.push('Configuration:');
  lines.push(`  Total Rounds:      ${config.totalRounds}`);
  lines.push(`  Total Clients:     ${config.totalClients}`);
  lines.push(`  Total Samples:     ${config.totalSamples}`);
  lines.push('');

  // Final results
  const lastRound = rounds[rounds.length - 1];
  lines.push('Final Results:');
  lines.push(`  Global Accuracy:   ${(lastRound.globalAccuracy * 100).toFixed(2)}%`);
  lines.push(`  Global Loss:       ${lastRound.globalLoss.toFixed(4)}`);
  lines.push('');

  // Comparison
  lines.push('Method Comparison:');
  lines.push(`  Federated:         ${(federatedAccuracy * 100).toFixed(2)}%`);
  lines.push(`  Centralized:       ${(centralizedAccuracy * 100).toFixed(2)}%`);
  lines.push(`  Local (avg):       ${(localAccuracy * 100).toFixed(2)}%`);
  lines.push('');

  // Performance gap
  const gap = centralizedAccuracy - federatedAccuracy;
  lines.push(`Performance Gap:    ${(gap * 100).toFixed(2)}%`);
  lines.push(`Federated achieves ${((federatedAccuracy / centralizedAccuracy) * 100).toFixed(1)}% of centralized performance`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// ASCII Progress Bar
// ============================================================================

/**
 * Create a multi-line progress visualization
 */
export function createMultiProgress(
  items: { label: string; progress: number; width?: number }[]
): string {
  const lines: string[] = [];

  for (const item of items) {
    const width = item.width ?? 30;
    const filled = Math.round((item.progress / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    lines.push(`${item.label.padEnd(20)} [${bar}] ${item.progress.toFixed(0)}%`);
  }

  return lines.join('\n');
}
