/**
 * @lsi/performance-tests
 *
 * Performance Report Generator
 *
 * Generates comprehensive performance reports for production validation.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { BenchmarkResult, BenchmarkStats } from '../Runner.js';
import type { SLAComplianceResult } from './SLACompliance.js';

/**
 * Performance Report Configuration
 */
export interface ReportConfig {
  /** Report title */
  title?: string;
  /** Report format */
  format: 'html' | 'markdown' | 'json';
  /** Include charts */
  includeCharts?: boolean;
  /** Include recommendations */
  includeRecommendations?: boolean;
  /** Include SLA compliance */
  includeSLA?: boolean;
  /** Output directory */
  outputDir: string;
}

/**
 * Performance Report Data
 */
export interface PerformanceReportData {
  /** Report metadata */
  meta: {
    title: string;
    generatedAt: Date;
    version: string;
    environment: string;
  };
  /** Benchmark results */
  benchmarks: BenchmarkResult[];
  /** SLA compliance results */
  slaCompliance?: SLAComplianceResult[];
  /** Comparison with baseline */
  baselineComparison?: BaselineComparison;
  /** Performance trends */
  trends?: PerformanceTrend[];
  /** Recommendations */
  recommendations: string[];
  /** Overall score */
  overallScore: number;
  /** Status */
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Baseline Comparison
 */
export interface BaselineComparison {
  baselineDate: Date;
  improvements: number;
  regressions: number;
  neutral: number;
  significantChanges: MetricChange[];
}

/**
 * Metric Change
 */
export interface MetricChange {
  metric: string;
  before: number;
  after: number;
  changePercent: number;
  significance: 'improvement' | 'regression' | 'neutral';
  severity: 'minor' | 'moderate' | 'major';
}

/**
 * Performance Trend
 */
export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  confidence: number;
  dataPoints: Array<{ date: Date; value: number }>;
}

/**
 * Performance Report Generator
 */
export class PerformanceReportGenerator {
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    this.config = config;
  }

  /**
   * Generate performance report
   */
  async generateReport(
    benchmarks: BenchmarkResult[],
    slaCompliance?: SLAComplianceResult[],
    baselineComparison?: BaselineComparison
  ): Promise<string> {
    // Calculate overall score
    const overallScore = this.calculateOverallScore(benchmarks, slaCompliance);
    const status = this.getStatus(overallScore);

    const reportData: PerformanceReportData = {
      meta: {
        title: this.config.title || 'Performance Report',
        generatedAt: new Date(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
      },
      benchmarks,
      slaCompliance,
      baselineComparison,
      recommendations: this.generateRecommendations(benchmarks, slaCompliance),
      overallScore,
      status,
    };

    // Generate report based on format
    switch (this.config.format) {
      case 'html':
        return await this.generateHTMLReport(reportData);
      case 'markdown':
        return this.generateMarkdownReport(reportData);
      case 'json':
        return JSON.stringify(reportData, null, 2);
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(data: PerformanceReportData): Promise<string> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.meta.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 0.9em; }
    .score-card {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .score-value {
      font-size: 72px;
      font-weight: bold;
      color: ${this.getScoreColor(data.overallScore)};
    }
    .score-status {
      font-size: 24px;
      color: #666;
      margin-top: 10px;
      text-transform: capitalize;
    }
    .section {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin-bottom: 20px;
      color: #667eea;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
    }
    .metric-pass { color: #28a745; }
    .metric-fail { color: #dc3545; }
    .metric-warning { color: #ffc107; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .recommendations {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
    }
    .recommendations ul {
      margin-left: 20px;
    }
    .recommendations li {
      margin: 10px 0;
    }
    .chart-container {
      height: 300px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.meta.title}</h1>
      <div class="meta">
        Generated: ${data.meta.generatedAt.toISOString()}<br>
        Version: ${data.meta.version} | Environment: ${data.meta.environment}
      </div>
    </div>

    <div class="score-card">
      <div class="score-value">${data.overallScore.toFixed(1)}%</div>
      <div class="score-status">${data.status}</div>
    </div>

    ${this.config.includeSLA && data.slaCompliance ? this.generateSLASection(data.slaCompliance) : ''}

    ${this.generateBenchmarksSection(data.benchmarks)}

    ${data.baselineComparison ? this.generateBaselineSection(data.baselineComparison) : ''}

    ${this.config.includeRecommendations ? this.generateRecommendationsSection(data.recommendations) : ''}
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(data: PerformanceReportData): string {
    const lines: string[] = [];

    lines.push(`# ${data.meta.title}`);
    lines.push('');
    lines.push(`**Generated:** ${data.meta.generatedAt.toISOString()}`);
    lines.push(`**Version:** ${data.meta.version}`);
    lines.push(`**Environment:** ${data.meta.environment}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Score card
    lines.push('## Overall Performance Score');
    lines.push('');
    lines.push(`### ${data.overallScore.toFixed(1)}% - ${data.status.toUpperCase()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // SLA Compliance
    if (this.config.includeSLA && data.slaCompliance) {
      lines.push(this.generateSLAMarkdown(data.slaCompliance));
    }

    // Benchmarks
    lines.push(this.generateBenchmarksMarkdown(data.benchmarks));

    // Baseline comparison
    if (data.baselineComparison) {
      lines.push(this.generateBaselineMarkdown(data.baselineComparison));
    }

    // Recommendations
    if (this.config.includeRecommendations) {
      lines.push(this.generateRecommendationsMarkdown(data.recommendations));
    }

    return lines.join('\n');
  }

  /**
   * Generate SLA section (HTML)
   */
  private generateSLASection(slaCompliance: SLAComplianceResult[]): string {
    const compliantCount = slaCompliance.filter(s => s.isCompliant).length;

    return `
    <div class="section">
      <h2>SLA Compliance</h2>
      <p><strong>${compliantCount}</strong> of <strong>${slaCompliance.length}</strong> SLAs met</p>
      <table>
        <thead>
          <tr>
            <th>SLA</th>
            <th>Compliance</th>
            <th>Status</th>
            <th>Violations</th>
          </tr>
        </thead>
        <tbody>
          ${slaCompliance.map(sla => `
            <tr>
              <td>${sla.slaId}</td>
              <td>${sla.compliancePercent.toFixed(1)}%</td>
              <td><span class="badge ${sla.isCompliant ? 'badge-success' : 'badge-danger'}">${sla.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}</span></td>
              <td>${sla.violations.length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }

  /**
   * Generate benchmarks section (HTML)
   */
  private generateBenchmarksSection(benchmarks: BenchmarkResult[]): string {
    return `
    <div class="section">
      <h2>Benchmark Results</h2>
      ${benchmarks.map(bench => `
        <h3>${bench.name}</h3>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Mean (ms)</th>
              <th>P95 (ms)</th>
              <th>P99 (ms)</th>
              <th>Ops/sec</th>
            </tr>
          </thead>
          <tbody>
            ${bench.tasks.map(task => `
              <tr>
                <td>${task.name}</td>
                <td>${task.mean.toFixed(4)}</td>
                <td>${task.p95.toFixed(4)}</td>
                <td>${task.p99.toFixed(4)}</td>
                <td>${task.hz.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `).join('')}
    </div>
    `;
  }

  /**
   * Generate baseline section (HTML)
   */
  private generateBaselineSection(comparison: BaselineComparison): string {
    return `
    <div class="section">
      <h2>Baseline Comparison</h2>
      <p>Baseline from: ${comparison.baselineDate.toISOString()}</p>
      <ul>
        <li>Improvements: <strong class="metric-pass">${comparison.improvements}</strong></li>
        <li>Regressions: <strong class="metric-fail">${comparison.regressions}</strong></li>
        <li>Neutral: <strong>${comparison.neutral}</strong></li>
      </ul>
      ${comparison.significantChanges.length > 0 ? `
        <h3>Significant Changes</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Before</th>
              <th>After</th>
              <th>Change</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            ${comparison.significantChanges.map(change => `
              <tr>
                <td>${change.metric}</td>
                <td>${change.before.toFixed(4)}</td>
                <td>${change.after.toFixed(4)}</td>
                <td class="${change.significance === 'improvement' ? 'metric-pass' : change.significance === 'regression' ? 'metric-fail' : ''}">
                  ${change.changePercent >= 0 ? '+' : ''}${change.changePercent.toFixed(1)}%
                </td>
                <td><span class="badge badge-${change.severity === 'major' ? 'danger' : 'warning'}">${change.severity}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
    `;
  }

  /**
   * Generate recommendations section (HTML)
   */
  private generateRecommendationsSection(recommendations: string[]): string {
    return `
    <div class="section">
      <h2>Recommendations</h2>
      <div class="recommendations">
        <ul>
          ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    </div>
    `;
  }

  /**
   * Generate SLA section (Markdown)
   */
  private generateSLAMarkdown(slaCompliance: SLAComplianceResult[]): string {
    const lines: string[] = [];

    lines.push('## SLA Compliance');
    lines.push('');

    const compliantCount = slaCompliance.filter(s => s.isCompliant).length;
    lines.push(`**${compliantCount}** of **${slaCompliance.length}** SLAs met`);
    lines.push('');

    lines.push('| SLA | Compliance | Status | Violations |');
    lines.push('|-----|------------|--------|------------|');

    for (const sla of slaCompliance) {
      const status = sla.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT';
      lines.push(`| ${sla.slaId} | ${sla.compliancePercent.toFixed(1)}% | ${status} | ${sla.violations.length} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate benchmarks section (Markdown)
   */
  private generateBenchmarksMarkdown(benchmarks: BenchmarkResult[]): string {
    const lines: string[] = [];

    lines.push('## Benchmark Results');
    lines.push('');

    for (const bench of benchmarks) {
      lines.push(`### ${bench.name}`);
      lines.push('');
      lines.push('| Task | Mean (ms) | P95 (ms) | P99 (ms) | Ops/sec |');
      lines.push('|------|-----------|----------|----------|---------|');

      for (const task of bench.tasks) {
        lines.push(`| ${task.name} | ${task.mean.toFixed(4)} | ${task.p95.toFixed(4)} | ${task.p99.toFixed(4)} | ${task.hz.toFixed(2)} |`);
      }

      lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate baseline section (Markdown)
   */
  private generateBaselineMarkdown(comparison: BaselineComparison): string {
    const lines: string[] = [];

    lines.push('## Baseline Comparison');
    lines.push('');
    lines.push(`Baseline from: ${comparison.baselineDate.toISOString()}`);
    lines.push('');
    lines.push(`- **Improvements:** ${comparison.improvements}`);
    lines.push(`- **Regressions:** ${comparison.regressions}`);
    lines.push(`- **Neutral:** ${comparison.neutral}`);
    lines.push('');

    if (comparison.significantChanges.length > 0) {
      lines.push('### Significant Changes');
      lines.push('');
      lines.push('| Metric | Before | After | Change | Impact |');
      lines.push('|--------|--------|-------|--------|--------|');

      for (const change of comparison.significantChanges) {
        const changeStr = change.changePercent >= 0 ? `+${change.changePercent.toFixed(1)}%` : `${change.changePercent.toFixed(1)}%`;
        lines.push(`| ${change.metric} | ${change.before.toFixed(4)} | ${change.after.toFixed(4)} | ${changeStr} | ${change.severity} |`);
      }

      lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate recommendations section (Markdown)
   */
  private generateRecommendationsMarkdown(recommendations: string[]): string {
    const lines: string[] = [];

    lines.push('## Recommendations');
    lines.push('');

    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    benchmarks: BenchmarkResult[],
    slaCompliance?: SLAComplianceResult[]
  ): number {
    let score = 100;

    // Deduct for SLA violations
    if (slaCompliance) {
      for (const sla of slaCompliance) {
        const deduction = 100 - sla.compliancePercent;
        score -= deduction * 0.5; // Weight SLA at 50%
      }
    }

    // Deduct for benchmark failures
    for (const bench of benchmarks) {
      for (const task of bench.tasks) {
        // If P95 is > 2x target, deduct points
        if (task.p95 > 200) {
          score -= 5;
        }
        if (task.p99 > 500) {
          score -= 3;
        }
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get status from score
   */
  private getStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Get score color
   */
  private getScoreColor(score: number): string {
    if (score >= 90) return '#28a745';
    if (score >= 75) return '#ffc107';
    if (score >= 60) return '#fd7e14';
    return '#dc3545';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    benchmarks: BenchmarkResult[],
    slaCompliance?: SLAComplianceResult[]
  ): string[] {
    const recommendations: string[] = [];

    // SLA-based recommendations
    if (slaCompliance) {
      for (const sla of slaCompliance) {
        if (!sla.isCompliant) {
          recommendations.push(...sla.recommendations);
        }
      }
    }

    // Benchmark-based recommendations
    for (const bench of benchmarks) {
      for (const task of bench.tasks) {
        if (task.p95 > 200) {
          recommendations.push(`Optimize ${task.name}: P95 latency (${task.p95.toFixed(2)}ms) exceeds 200ms`);
        }
        if (task.p99 > 500) {
          recommendations.push(`Investigate ${task.name}: P99 latency (${task.p99.toFixed(2)}ms) exceeds 500ms`);
        }
      }
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  async saveReport(content: string, filename: string): Promise<string> {
    const filepath = join(this.config.outputDir, filename);

    // Ensure directory exists
    if (!existsSync(this.config.outputDir)) {
      await mkdir(this.config.outputDir, { recursive: true });
    }

    await writeFile(filepath, content, 'utf-8');
    return filepath;
  }
}

/**
 * Create performance report generator
 */
export function createReportGenerator(config: ReportConfig): PerformanceReportGenerator {
  return new PerformanceReportGenerator(config);
}
