/**
 * Comprehensive Report Generator for Performance Profiling
 *
 * Generates detailed performance reports in multiple formats:
 * - JSON: Structured data for programmatic analysis
 * - HTML: Interactive visual report for humans
 * - Markdown: Documentation-friendly format
 *
 * @module @lsi/performance-optimizer/profiler/ReportGenerator
 */

import type {
  ProfilingReport,
  ProfilingSession,
  CpuProfilingReport,
  MemoryProfilingReport,
  LatencyTrackingReport,
  ThroughputReport,
  PerformanceSummary,
  OptimizationRecommendation,
  ProfilingOptions,
} from "@lsi/protocol";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Report generator options
 */
export interface ReportGeneratorOptions {
  /** Report format */
  format: "json" | "html" | "markdown";
  /** Include flame graph */
  includeFlameGraph: boolean;
  /** Include hot paths */
  includeHotPaths: boolean;
  /** Include recommendations */
  includeRecommendations: boolean;
  /** Report title */
  title?: string;
  /** Output directory */
  outputDir?: string;
}

/**
 * Comprehensive report generator
 */
export class ReportGenerator {
  private options: ReportGeneratorOptions;

  constructor(options: Partial<ReportGeneratorOptions> = {}) {
    this.options = {
      format: options.format || "html",
      includeFlameGraph: options.includeFlameGraph ?? true,
      includeHotPaths: options.includeHotPaths ?? true,
      includeRecommendations: options.includeRecommendations ?? true,
      title: options.title || "Performance Profiling Report",
      outputDir: options.outputDir,
    };
  }

  /**
   * Generate complete profiling report
   */
  generateReport(
    session: ProfilingSession,
    cpuReport?: CpuProfilingReport,
    memoryReport?: MemoryProfilingReport,
    latencyReports?: Map<string, LatencyTrackingReport>,
    throughputReports?: Map<string, ThroughputReport>
  ): ProfilingReport {
    // Generate performance summary
    const summary = this.generateSummary(
      cpuReport,
      memoryReport,
      latencyReports,
      throughputReports
    );

    // Generate recommendations
    const recommendations = this.options.includeRecommendations
      ? this.generateRecommendations(
          cpuReport,
          memoryReport,
          latencyReports,
          throughputReports
        )
      : [];

    // Calculate overall performance score
    const performanceScore = this.calculatePerformanceScore(summary);

    const report: ProfilingReport = {
      metadata: {
        reportId: this.generateReportId(),
        sessionId: session.sessionId,
        timestamp: Date.now(),
        duration: session.endTime || Date.now() - session.startTime,
        reportFormat: this.options.format,
      },
      session,
      cpuReport,
      memoryReport,
      latencyReports,
      throughputReports,
      performanceScore,
      summary,
      recommendations,
    };

    return report;
  }

  /**
   * Generate report in specified format
   */
  async generateFormattedReport(report: ProfilingReport): Promise<string> {
    switch (this.options.format) {
      case "json":
        return this.generateJsonReport(report);
      case "html":
        return this.generateHtmlReport(report);
      case "markdown":
        return this.generateMarkdownReport(report);
      default:
        throw new Error(`Unsupported format: ${this.options.format}`);
    }
  }

  /**
   * Save report to file
   */
  async saveReport(report: ProfilingReport, filename?: string): Promise<string> {
    const content = await this.generateFormattedReport(report);

    let outputPath: string;
    if (filename) {
      outputPath = filename;
    } else {
      const timestamp = new Date(report.metadata.timestamp).toISOString().replace(/[:.]/g, "-");
      const ext = this.getFileExtension();
      outputPath = `${this.options.outputDir || "."}/profiling-report-${timestamp}.${ext}`;
    }

    // Ensure directory exists
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write file
    writeFileSync(outputPath, content, "utf-8");

    return outputPath;
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(report: ProfilingReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: ProfilingReport): string {
    const title = this.options.title || "Performance Profiling Report";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
    }
    .header h1 { margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 0.9em; }
    .content { padding: 40px; }
    .section {
      margin-bottom: 40px;
      padding: 30px;
      background: #f9f9f9;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .section h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.8em;
    }
    .score-display {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .score-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3em;
      font-weight: bold;
      color: white;
    }
    .score-excellent { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .score-good { background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); }
    .score-fair { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); }
    .score-poor { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .score-critical { background: linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%); }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }
    .metric-label {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .hot-paths-list {
      list-style: none;
      margin: 20px 0;
    }
    .hot-path-item {
      background: white;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #f45c43;
    }
    .hot-path-name {
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: 5px;
    }
    .hot-path-stats {
      display: flex;
      gap: 20px;
      color: #666;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .recommendation-card {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 6px;
      border-left: 4px solid #f7971e;
    }
    .recommendation-priority {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .priority-high { background: #fee; color: #c33; }
    .priority-medium { background: #ffc; color: #960; }
    .priority-low { background: #efe; color: #393; }
    .flame-graph {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      overflow-x: auto;
    }
    .flame-node {
      display: inline-block;
      padding: 4px 8px;
      margin: 2px;
      border-radius: 3px;
      font-size: 0.8em;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .flame-node:hover {
      transform: scale(1.05);
      z-index: 10;
      position: relative;
    }
    .memory-timeline {
      height: 200px;
      background: white;
      border-radius: 8px;
      margin: 20px 0;
      position: relative;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .table th,
    .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .table th {
      background: #667eea;
      color: white;
      font-weight: 600;
    }
    .table tbody tr:hover {
      background: #f5f5f5;
    }
    .tag {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 600;
      margin-right: 5px;
    }
    .tag-cpu { background: #e3f2fd; color: #1976d2; }
    .tag-memory { background: #f3e5f5; color: #7b1fa2; }
    .tag-latency { background: #fff3e0; color: #f57c00; }
    .tag-throughput { background: #e8f5e9; color: #388e3c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <div class="meta">
        Session ID: ${report.metadata.sessionId}<br>
        Generated: ${new Date(report.metadata.timestamp).toLocaleString()}<br>
        Duration: ${this.formatDuration(report.metadata.duration)}
      </div>
    </div>

    <div class="content">
      ${this.generateHtmlScoreSection(report.performanceScore, report.summary)}

      ${report.cpuReport ? this.generateHtmlCpuSection(report.cpuReport) : ""}

      ${report.memoryReport ? this.generateHtmlMemorySection(report.memoryReport) : ""}

      ${report.latencyReports && report.latencyReports.size > 0
        ? this.generateHtmlLatencySection(report.latencyReports)
        : ""}

      ${report.throughputReports && report.throughputReports.size > 0
        ? this.generateHtmlThroughputSection(report.throughputReports)
        : ""}

      ${report.recommendations.length > 0
        ? this.generateHtmlRecommendationsSection(report.recommendations)
        : ""}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML score section
   */
  private generateHtmlScoreSection(
    score: number,
    summary: PerformanceSummary
  ): string {
    const scoreClass = this.getScoreClass(score);
    const healthStatus = summary.healthStatus.toUpperCase();

    return `
      <div class="section">
        <h2>Performance Overview</h2>
        <div class="score-display">
          <div class="score-circle ${scoreClass}">
            ${Math.round(score)}
          </div>
          <div style="font-size: 1.5em; margin-bottom: 10px;">${healthStatus}</div>
          <div style="color: #666;">Overall Performance Score</div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">CPU Usage</div>
            <div class="metric-value">${summary.keyMetrics.cpuUsage.toFixed(1)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Memory Usage</div>
            <div class="metric-value">${summary.keyMetrics.memoryUsage.toFixed(1)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Avg Latency</div>
            <div class="metric-value">${summary.keyMetrics.avgLatency.toFixed(1)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Throughput</div>
            <div class="metric-value">${summary.keyMetrics.throughput.toFixed(1)} ops/s</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Error Rate</div>
            <div class="metric-value">${(summary.keyMetrics.errorRate * 100).toFixed(2)}%</div>
          </div>
        </div>

        ${summary.topBottlenecks.length > 0 ? `
          <h3 style="margin-top: 30px; color: #667eea;">Top Bottlenecks</h3>
          <ul class="hot-paths-list">
            ${summary.topBottlenecks.map(
              (bottleneck) => `
              <li class="hot-path-item">
                <div class="hot-path-name">${bottleneck.type}</div>
                <div>${bottleneck.description}</div>
                <div class="hot-path-stats">
                  <span>Impact: ${(bottleneck.impact * 100).toFixed(1)}%</span>
                </div>
              </li>
            `
            ).join("")}
          </ul>
        ` : ""}
      </div>
    `;
  }

  /**
   * Generate HTML CPU section
   */
  private generateHtmlCpuSection(report: CpuProfilingReport): string {
    return `
      <div class="section">
        <h2>CPU Profiling</h2>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Average CPU</div>
            <div class="metric-value">${report.averageCpuUsage.toFixed(1)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Peak CPU</div>
            <div class="metric-value">${report.peakCpuUsage.toFixed(1)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Duration</div>
            <div class="metric-value">${this.formatDuration(report.totalDuration)}</div>
          </div>
        </div>

        ${this.options.includeHotPaths && report.hotPaths.length > 0 ? `
          <h3 style="margin-top: 30px; color: #667eea;">Hot Paths</h3>
          <ul class="hot-paths-list">
            ${report.hotPaths.slice(0, 10).map(
              (hotPath) => `
              <li class="hot-path-item">
                <div class="hot-path-name">${hotPath.functionName}</div>
                <div>${hotPath.file}:${hotPath.line}</div>
                <div class="hot-path-stats">
                  <span>Total: ${hotPath.totalTime.toFixed(2)}ms</span>
                  <span>${hotPath.percentage.toFixed(1)}%</span>
                  <span>Calls: ${hotPath.callCount}</span>
                </div>
              </li>
            `
            ).join("")}
          </ul>
        ` : ""}
      </div>
    `;
  }

  /**
   * Generate HTML memory section
   */
  private generateHtmlMemorySection(report: MemoryProfilingReport): string {
    return `
      <div class="section">
        <h2>Memory Profiling</h2>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Initial</div>
            <div class="metric-value">${report.initialSnapshot.heapUsed.toFixed(1)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Final</div>
            <div class="metric-value">${report.finalSnapshot.heapUsed.toFixed(1)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Growth</div>
            <div class="metric-value">${report.memoryGrowth.toFixed(1)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Peak</div>
            <div class="metric-value">${report.peakMemory.toFixed(1)} MB</div>
          </div>
        </div>

        ${report.leakDetection.suspected ? `
          <div style="margin-top: 20px; padding: 15px; background: #fee; border-radius: 6px; border-left: 4px solid #c33;">
            <strong>Memory Leak Detected!</strong><br>
            Leak rate: ${report.leakDetection.leakRate.toFixed(2)} MB/minute<br>
            Confidence: ${(report.leakDetection.confidence * 100).toFixed(0)}%
          </div>
        ` : ""}
      </div>
    `;
  }

  /**
   * Generate HTML latency section
   */
  private generateHtmlLatencySection(
    reports: Map<string, LatencyTrackingReport>
  ): string {
    const reportsArray = Array.from(reports.entries());

    return `
      <div class="section">
        <h2>Latency Analysis</h2>

        ${reportsArray.map(([operation, report]) => `
          <h3 style="margin-top: 20px;">${operation}</h3>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">P50</div>
              <div class="metric-value">${report.percentiles.p50.toFixed(1)} ms</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">P95</div>
              <div class="metric-value">${report.percentiles.p95.toFixed(1)} ms</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">P99</div>
              <div class="metric-value">${report.percentiles.p99.toFixed(1)} ms</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Avg</div>
              <div class="metric-value">${report.percentiles.average.toFixed(1)} ms</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /**
   * Generate HTML throughput section
   */
  private generateHtmlThroughputSection(
    reports: Map<string, ThroughputReport>
  ): string {
    const reportsArray = Array.from(reports.entries());

    return `
      <div class="section">
        <h2>Throughput Analysis</h2>

        ${reportsArray.map(([operation, report]) => `
          <h3 style="margin-top: 20px;">${operation}</h3>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Average</div>
              <div class="metric-value">${report.statistics.averageThroughput.toFixed(1)} ops/s</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Peak</div>
              <div class="metric-value">${report.statistics.peakThroughput.toFixed(1)} ops/s</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Success Rate</div>
              <div class="metric-value">${(report.statistics.successRate * 100).toFixed(1)}%</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /**
   * Generate HTML recommendations section
   */
  private generateHtmlRecommendationsSection(
    recommendations: OptimizationRecommendation[]
  ): string {
    return `
      <div class="section">
        <h2>Optimization Recommendations</h2>

        ${recommendations.map((rec) => {
          const priorityClass =
            rec.priority >= 8 ? "priority-high" :
            rec.priority >= 5 ? "priority-medium" : "priority-low";

          return `
            <div class="recommendation-card">
              <span class="recommendation-priority ${priorityClass}">
                Priority: ${rec.priority}/10
              </span>
              <h3 style="margin: 10px 0;">${rec.title}</h3>
              <p>${rec.description}</p>
              <p style="margin-top: 10px; color: #666;">
                <strong>Expected Impact:</strong> +${rec.expectedImpact.performanceGain.toFixed(1)}%
                (Confidence: ${(rec.expectedImpact.confidence * 100).toFixed(0)}%)
              </p>
              ${rec.codeExample ? `
                <pre style="margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 4px; overflow-x: auto;"><code>${this.escapeHtml(rec.codeExample)}</code></pre>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(report: ProfilingReport): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${this.options.title || "Performance Profiling Report"}`);
    lines.push("");
    lines.push("**Session ID:** " + report.metadata.sessionId);
    lines.push("**Generated:** " + new Date(report.metadata.timestamp).toLocaleString());
    lines.push("**Duration:** " + this.formatDuration(report.metadata.duration));
    lines.push("");

    // Performance Score
    lines.push("## Performance Overview");
    lines.push("");
    lines.push(`**Overall Score:** ${Math.round(report.performanceScore)}/100`);
    lines.push(`**Health Status:** ${report.summary.healthStatus.toUpperCase()}`);
    lines.push("");
    lines.push("### Key Metrics");
    lines.push("");
    lines.push(`- **CPU Usage:** ${report.summary.keyMetrics.cpuUsage.toFixed(1)}%`);
    lines.push(`- **Memory Usage:** ${report.summary.keyMetrics.memoryUsage.toFixed(1)} MB`);
    lines.push(`- **Avg Latency:** ${report.summary.keyMetrics.avgLatency.toFixed(1)} ms`);
    lines.push(`- **Throughput:** ${report.summary.keyMetrics.throughput.toFixed(1)} ops/s`);
    lines.push(`- **Error Rate:** ${(report.summary.keyMetrics.errorRate * 100).toFixed(2)}%`);
    lines.push("");

    // CPU Report
    if (report.cpuReport) {
      lines.push("## CPU Profiling");
      lines.push("");
      lines.push(`- **Average CPU:** ${report.cpuReport.averageCpuUsage.toFixed(1)}%`);
      lines.push(`- **Peak CPU:** ${report.cpuReport.peakCpuUsage.toFixed(1)}%`);
      lines.push("");

      if (this.options.includeHotPaths && report.cpuReport.hotPaths.length > 0) {
        lines.push("### Hot Paths");
        lines.push("");
        report.cpuReport.hotPaths.slice(0, 10).forEach((hotPath) => {
          lines.push(`#### ${hotPath.functionName}`);
          lines.push(`- **File:** ${hotPath.file}:${hotPath.line}`);
          lines.push(`- **Total Time:** ${hotPath.totalTime.toFixed(2)}ms (${hotPath.percentage.toFixed(1)}%)`);
          lines.push(`- **Calls:** ${hotPath.callCount}`);
          lines.push(`- **Avg/Call:** ${hotPath.avgTimePerCall.toFixed(3)}ms`);
          lines.push("");
        });
      }
    }

    // Memory Report
    if (report.memoryReport) {
      lines.push("## Memory Profiling");
      lines.push("");
      lines.push(`- **Initial:** ${report.memoryReport.initialSnapshot.heapUsed.toFixed(1)} MB`);
      lines.push(`- **Final:** ${report.memoryReport.finalSnapshot.heapUsed.toFixed(1)} MB`);
      lines.push(`- **Growth:** ${report.memoryReport.memoryGrowth.toFixed(1)} MB`);
      lines.push(`- **Peak:** ${report.memoryReport.peakMemory.toFixed(1)} MB`);
      lines.push("");

      if (report.memoryReport.leakDetection.suspected) {
        lines.push("### Memory Leak Detected!");
        lines.push("");
        lines.push(`- **Leak Rate:** ${report.memoryReport.leakDetection.leakRate.toFixed(2)} MB/minute`);
        lines.push(`- **Confidence:** ${(report.memoryReport.leakDetection.confidence * 100).toFixed(0)}%`);
        lines.push("");
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push("## Optimization Recommendations");
      lines.push("");

      report.recommendations.forEach((rec, index) => {
        lines.push(`### ${index + 1}. ${rec.title}`);
        lines.push("");
        lines.push(`**Priority:** ${rec.priority}/10`);
        lines.push(`**Type:** ${rec.type}`);
        lines.push("");
        lines.push(rec.description);
        lines.push("");
        lines.push(`**Expected Impact:** +${rec.expectedImpact.performanceGain.toFixed(1)}%`);
        lines.push(`**Confidence:** ${(rec.expectedImpact.confidence * 100).toFixed(0)}%`);
        lines.push(`**Difficulty:** ${rec.difficulty}/10`);
        lines.push(`**Estimated Time:** ${rec.estimatedTime}`);
        lines.push("");

        if (rec.codeExample) {
          lines.push("```typescript");
          lines.push(rec.codeExample);
          lines.push("```");
          lines.push("");
        }
      });
    }

    return lines.join("\n");
  }

  /**
   * Generate performance summary
   */
  private generateSummary(
    cpuReport?: CpuProfilingReport,
    memoryReport?: MemoryProfilingReport,
    latencyReports?: Map<string, LatencyTrackingReport>,
    throughputReports?: Map<string, ThroughputReport>
  ): PerformanceSummary {
    // Calculate key metrics
    const cpuUsage = cpuReport?.averageCpuUsage || 0;
    const memoryUsage = memoryReport?.finalSnapshot.heapUsed || 0;
    const avgLatency = this.calculateAverageLatency(latencyReports);
    const throughput = this.calculateAverageThroughput(throughputReports);
    const errorRate = this.calculateAverageErrorRate(latencyReports);

    // Determine health status
    const healthStatus = this.determineHealthStatus({
      cpuUsage,
      memoryUsage,
      avgLatency,
      throughput,
      errorRate,
    });

    // Identify bottlenecks
    const topBottlenecks = this.identifyBottlenecks(
      cpuReport,
      memoryReport,
      latencyReports,
      throughputReports
    );

    // Analyze trends
    const trends = {
      cpu: "stable",
      memory: "stable",
      latency: "stable",
      throughput: "stable",
    };

    return {
      healthStatus,
      keyMetrics: {
        cpuUsage,
        memoryUsage,
        avgLatency,
        throughput,
        errorRate,
      },
      topBottlenecks,
      trends,
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(summary: PerformanceSummary): number {
    let score = 100;

    // CPU penalty (0-30 points)
    if (summary.keyMetrics.cpuUsage > 80) {
      score -= 30;
    } else if (summary.keyMetrics.cpuUsage > 60) {
      score -= 15;
    } else if (summary.keyMetrics.cpuUsage > 40) {
      score -= 5;
    }

    // Memory penalty (0-20 points)
    if (summary.keyMetrics.memoryUsage > 1000) {
      score -= 20;
    } else if (summary.keyMetrics.memoryUsage > 500) {
      score -= 10;
    }

    // Latency penalty (0-25 points)
    if (summary.keyMetrics.avgLatency > 1000) {
      score -= 25;
    } else if (summary.keyMetrics.avgLatency > 500) {
      score -= 15;
    } else if (summary.keyMetrics.avgLatency > 100) {
      score -= 5;
    }

    // Error rate penalty (0-25 points)
    if (summary.keyMetrics.errorRate > 0.05) {
      score -= 25;
    } else if (summary.keyMetrics.errorRate > 0.01) {
      score -= 10;
    } else if (summary.keyMetrics.errorRate > 0.001) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    cpuReport?: CpuProfilingReport,
    memoryReport?: MemoryProfilingReport,
    latencyReports?: Map<string, LatencyTrackingReport>,
    throughputReports?: Map<string, ThroughputReport>
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    let id = 1;

    // CPU recommendations
    if (cpuReport) {
      if (cpuReport.averageCpuUsage > 70) {
        recommendations.push({
          id: `rec-${id++}`,
          type: "cpu",
          priority: 8,
          title: "High CPU Usage Detected",
          description: `Average CPU usage is ${cpuReport.averageCpuUsage.toFixed(1)}%, which is above recommended threshold.`,
          expectedImpact: {
            performanceGain: 20,
            confidence: 0.8,
          },
          difficulty: 6,
          estimatedTime: "2-4 hours",
          codeExample: undefined,
          relatedMetrics: ["cpuUsage"],
          affectedComponents: [],
        });
      }

      // Hot path recommendations
      cpuReport.hotPaths.slice(0, 3).forEach((hotPath) => {
        recommendations.push({
          id: `rec-${id++}`,
          type: "cpu",
          priority: Math.min(10, Math.round(hotPath.percentage / 10)),
          title: `Optimize Hot Function: ${hotPath.functionName}`,
          description: `Function ${hotPath.functionName} accounts for ${hotPath.percentage.toFixed(1)}% of total execution time.`,
          expectedImpact: {
            performanceGain: hotPath.optimizationPotential * 30,
            confidence: hotPath.impactScore,
          },
          difficulty: 7,
          estimatedTime: "4-8 hours",
          codeExample: `// Consider optimizing ${hotPath.functionName}\n// Location: ${hotPath.file}:${hotPath.line}\n// Current: ${hotPath.totalTime.toFixed(2)}ms total`,
          relatedMetrics: ["cpuUsage", "latency"],
          affectedComponents: [hotPath.file],
        });
      });
    }

    // Memory recommendations
    if (memoryReport) {
      if (memoryReport.leakDetection.suspected) {
        recommendations.push({
          id: `rec-${id++}`,
          type: "memory",
          priority: 9,
          title: "Memory Leak Detected",
          description: `Memory leak detected at rate of ${memoryReport.leakDetection.leakRate.toFixed(2)} MB/minute.`,
          expectedImpact: {
            performanceGain: 15,
            confidence: memoryReport.leakDetection.confidence,
          },
          difficulty: 8,
          estimatedTime: "4-12 hours",
          codeExample: undefined,
          relatedMetrics: ["memoryUsage"],
          affectedComponents: memoryReport.leakDetection.leakLocations.map(
            (loc) => loc.file
          ),
        });
      }

      memoryReport.suggestions.forEach((suggestion) => {
        recommendations.push({
          id: `rec-${id++}`,
          type: "memory",
          priority:
            suggestion.severity === "high" ? 8 :
            suggestion.severity === "medium" ? 5 : 3,
          title: `Memory Optimization: ${suggestion.type}`,
          description: suggestion.description,
          expectedImpact: {
            performanceGain: 10,
            confidence: 0.6,
          },
          difficulty: 5,
          estimatedTime: "2-6 hours",
          codeExample: suggestion.recommendation,
          relatedMetrics: ["memoryUsage"],
          affectedComponents: suggestion.location ? [suggestion.location.file] : [],
        });
      });
    }

    // Sort by priority descending
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations.slice(0, 20); // Top 20 recommendations
  }

  // Helper methods

  private calculateAverageLatency(
    reports?: Map<string, LatencyTrackingReport>
  ): number {
    if (!reports || reports.size === 0) return 0;

    const values = Array.from(reports.values()).map(
      (r) => r.percentiles.average
    );
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateAverageThroughput(
    reports?: Map<string, ThroughputReport>
  ): number {
    if (!reports || reports.size === 0) return 0;

    const values = Array.from(reports.values()).map(
      (r) => r.statistics.averageThroughput
    );
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateAverageErrorRate(
    reports?: Map<string, LatencyTrackingReport>
  ): number {
    if (!reports || reports.size === 0) return 0;

    return 1 - Array.from(reports.values()).reduce((sum, r) => sum + r.successRate, 0) / reports.size;
  }

  private determineHealthStatus(metrics: {
    cpuUsage: number;
    memoryUsage: number;
    avgLatency: number;
    throughput: number;
    errorRate: number;
  }): PerformanceSummary["healthStatus"] {
    if (
      metrics.errorRate > 0.05 ||
      metrics.cpuUsage > 90 ||
      metrics.avgLatency > 2000
    ) {
      return "critical";
    }
    if (
      metrics.errorRate > 0.01 ||
      metrics.cpuUsage > 80 ||
      metrics.avgLatency > 1000
    ) {
      return "poor";
    }
    if (
      metrics.cpuUsage > 60 ||
      metrics.avgLatency > 500 ||
      metrics.memoryUsage > 500
    ) {
      return "fair";
    }
    if (
      metrics.cpuUsage > 40 ||
      metrics.avgLatency > 100
    ) {
      return "good";
    }
    return "excellent";
  }

  private identifyBottlenecks(
    cpuReport?: CpuProfilingReport,
    memoryReport?: MemoryProfilingReport,
    latencyReports?: Map<string, LatencyTrackingReport>,
    throughputReports?: Map<string, ThroughputReport>
  ): Array<{
    type: string;
    description: string;
    impact: number;
  }> {
    const bottlenecks = [];

    if (cpuReport && cpuReport.averageCpuUsage > 50) {
      bottlenecks.push({
        type: "CPU",
        description: `High CPU usage (${cpuReport.averageCpuUsage.toFixed(1)}%)`,
        impact: cpuReport.averageCpuUsage / 100,
      });
    }

    if (memoryReport && memoryReport.leakDetection.suspected) {
      bottlenecks.push({
        type: "Memory",
        description: "Memory leak detected",
        impact: memoryReport.leakDetection.confidence,
      });
    }

    if (latencyReports) {
      for (const [operation, report] of latencyReports) {
        if (report.percentiles.p95 > 500) {
          bottlenecks.push({
            type: "Latency",
            description: `High latency in ${operation} (P95: ${report.percentiles.p95.toFixed(1)}ms)`,
            impact: Math.min(1, report.percentiles.p95 / 1000),
          });
        }
      }
    }

    // Sort by impact
    bottlenecks.sort((a, b) => b.impact - a.impact);

    return bottlenecks.slice(0, 5);
  }

  private getScoreClass(score: number): string {
    if (score >= 90) return "score-excellent";
    if (score >= 70) return "score-good";
    if (score >= 50) return "score-fair";
    if (score >= 30) return "score-poor";
    return "score-critical";
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  private getFileExtension(): string {
    switch (this.options.format) {
      case "json":
        return "json";
      case "html":
        return "html";
      case "markdown":
        return "md";
      default:
        return "txt";
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
