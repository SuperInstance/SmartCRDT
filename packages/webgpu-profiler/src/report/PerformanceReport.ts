/**
 * PerformanceReport - Generate comprehensive profiling reports
 *
 * Creates detailed reports from profiling data with multiple export formats
 */

import type {
  ProfileReport,
  ComparisonReport,
  ExportFormat,
  ExportOptions,
  PerformanceMetric,
} from "../types.js";
import { TimelineView } from "../timeline/TimelineView.js";
import { BottleneckAnalyzer } from "../bottleneck/BottleneckAnalyzer.js";

/**
 * Report template
 */
interface ReportTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Sections to include */
  sections: ReportSection[];
}

/**
 * Report section
 */
type ReportSection =
  | "summary"
  | "kernel-details"
  | "memory-details"
  | "transfer-details"
  | "bottlenecks"
  | "optimizations"
  | "timeline"
  | "metrics";

/**
 * PerformanceReport - Generates profiling reports
 *
 * @example
 * ```typescript
 * const reporter = new PerformanceReport();
 *
 * const report = profiler.stopProfiling();
 * const html = reporter.exportAsHTML(report);
 * const json = reporter.exportAsJSON(report);
 * const comparison = reporter.compareReports(beforeReport, afterReport);
 * ```
 */
export class PerformanceReport {
  /** Timeline view generator */
  private timelineView: TimelineView;
  /** Bottleneck analyzer */
  private bottleneckAnalyzer: BottleneckAnalyzer;
  /** Default export options */
  private defaultExportOptions: ExportOptions = {
    format: "json",
    includeRawData: true,
    includeTimeline: true,
    includeBottlenecks: true,
    includeOptimizations: true,
  };

  /**
   * Create a new performance report generator
   */
  constructor() {
    this.timelineView = new TimelineView();
    this.bottleneckAnalyzer = new BottleneckAnalyzer();
  }

  /**
   * Generate a comprehensive report
   *
   * @param profileReport - Profile report data
   * @param options - Export options
   * @returns Formatted report
   */
  generateReport(
    profileReport: ProfileReport,
    options: Partial<ExportOptions> = {}
  ): string {
    const opts: ExportOptions = { ...this.defaultExportOptions, ...options };

    switch (opts.format) {
      case "json":
        return this.exportAsJSON(profileReport, opts);
      case "csv":
        return this.exportAsCSV(profileReport, opts);
      case "html":
        return this.exportAsHTML(profileReport, opts);
      case "markdown":
        return this.exportAsMarkdown(profileReport, opts);
      default:
        throw new Error(`Unsupported export format: ${opts.format}`);
    }
  }

  /**
   * Export report as JSON
   */
  exportAsJSON(
    profileReport: ProfileReport,
    options: Partial<ExportOptions> = {}
  ): string {
    const opts: ExportOptions = {
      format: "json",
      includeRawData: true,
      includeTimeline: true,
      includeBottlenecks: true,
      includeOptimizations: true,
      ...options,
    };
    const report: any = {
      id: profileReport.id,
      timestamp: profileReport.timestamp,
      sessionDuration: profileReport.sessionDuration,
      summary: {
        kernels: profileReport.kernelSummary,
        memory: profileReport.memorySummary,
        transfers: profileReport.transferSummary,
      },
    };

    if (options.includeBottlenecks) {
      const analysis = this.bottleneckAnalyzer.analyzeReport(profileReport);
      report.bottlenecks = analysis.bottlenecks;
      report.optimizations = analysis.optimizations;
      report.bottleneckScore = analysis.bottleneckScore;
    }

    if (options.includeTimeline) {
      const events = this.timelineView.createTimeline(
        profileReport.frames || []
      );
      report.timeline = events;
    }

    if (options.includeRawData) {
      report.metrics = profileReport.metrics;
      report.frames = profileReport.frames;
    }

    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as CSV
   */
  exportAsCSV(
    profileReport: ProfileReport,
    options: Partial<ExportOptions> = {}
  ): string {
    const opts: ExportOptions = {
      format: "csv",
      includeRawData: true,
      includeTimeline: false,
      includeBottlenecks: true,
      includeOptimizations: true,
      ...options,
    };
    const lines: string[] = [];

    // Summary section
    lines.push("# Summary");
    lines.push(
      `Session Duration,${profileReport.sessionDuration.toFixed(2)}ms`
    );
    lines.push(`Total Kernels,${profileReport.kernelSummary.totalKernels}`);
    lines.push(
      `Avg Kernel Duration,${(profileReport.kernelSummary.avgDuration / 1_000_000).toFixed(2)}ms`
    );
    lines.push(
      `Total Memory,${(profileReport.memorySummary.totalAllocated / 1024 / 1024).toFixed(2)}MB`
    );
    lines.push(
      `Peak Memory,${(profileReport.memorySummary.peakMemory / 1024 / 1024).toFixed(2)}MB`
    );
    lines.push(`Memory Leaks,${profileReport.memorySummary.leakCount}`);
    lines.push(
      `Total Transfers,${profileReport.transferSummary.totalTransfers}`
    );
    lines.push(
      `Avg Bandwidth,${profileReport.transferSummary.avgBandwidth.toFixed(2)}GB/s`
    );
    lines.push("");

    // Metrics section
    if (options.includeRawData) {
      lines.push("# Metrics");
      lines.push("Name,Type,Value,Unit,Min,Max,Avg,Sample Count");
      for (const metric of profileReport.metrics) {
        lines.push(
          `${metric.name},${metric.type},${metric.value.toFixed(4)},${metric.unit},${metric.min.toFixed(4)},${metric.max.toFixed(4)},${metric.avg.toFixed(4)},${metric.sampleCount}`
        );
      }
      lines.push("");
    }

    // Bottlenecks section
    if (opts.includeBottlenecks) {
      const analysis = this.bottleneckAnalyzer.analyzeReport(profileReport);
      lines.push("# Bottlenecks");
      lines.push("Category,Severity,Description,Impact,Affected Component");
      for (const bottleneck of analysis.bottlenecks) {
        lines.push(
          `${bottleneck.category},${bottleneck.severity},"${bottleneck.description}",${bottleneck.impact.toFixed(1)},"${bottleneck.affectedComponent.join("; ")}"`
        );
      }
      lines.push("");

      // Optimizations section
      lines.push("# Optimization Suggestions");
      lines.push("Title,Category,Expected Improvement,Effort,Priority");
      for (const opt of analysis.optimizations) {
        lines.push(
          `"${opt.title}",${opt.category},${opt.expectedImprovement},${opt.effort},${opt.priority}`
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Export report as HTML
   */
  exportAsHTML(
    profileReport: ProfileReport,
    options: Partial<ExportOptions> = {}
  ): string {
    const opts: ExportOptions = {
      format: "html",
      includeRawData: true,
      includeTimeline: false,
      includeBottlenecks: true,
      includeOptimizations: true,
      ...options,
    };
    const analysis = opts.includeBottlenecks
      ? this.bottleneckAnalyzer.analyzeReport(profileReport)
      : null;

    const lines: string[] = [
      "<!DOCTYPE html>",
      "<html>",
      "<head>",
      '  <meta charset="UTF-8">',
      "  <title>WebGPU Profiling Report</title>",
      "  <style>",
      '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }',
      "    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }",
      "    h1 { color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; }",
      "    h2 { color: #555; margin-top: 30px; }",
      "    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }",
      "    .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #4a90e2; }",
      "    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }",
      "    .metric-value { font-size: 24px; font-weight: bold; color: #333; }",
      "    table { width: 100%; border-collapse: collapse; margin: 15px 0; }",
      "    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }",
      "    th { background: #f8f9fa; font-weight: 600; }",
      "    .severity-critical { color: #dc3545; font-weight: bold; }",
      "    .severity-high { color: #fd7e14; font-weight: bold; }",
      "    .severity-medium { color: #ffc107; font-weight: bold; }",
      "    .severity-low { color: #28a745; }",
      "    .timestamp { color: #888; font-size: 12px; }",
      "  </style>",
      "</head>",
      "<body>",
      '  <div class="container">',
      "    <h1>WebGPU Profiling Report</h1>",
      '    <p class="timestamp">Generated: ' +
        new Date(profileReport.timestamp).toISOString() +
        "</p>",
      "    <p>Session Duration: " +
        profileReport.sessionDuration.toFixed(2) +
        " ms</p>",
      "",
      "    <h2>Summary</h2>",
      '    <div class="summary">',
      '      <div class="metric-card">',
      '        <div class="metric-label">Total Kernels</div>',
      '        <div class="metric-value">' +
        profileReport.kernelSummary.totalKernels +
        "</div>",
      "      </div>",
      '      <div class="metric-card">',
      '        <div class="metric-label">Avg Kernel Duration</div>',
      '        <div class="metric-value">' +
        (profileReport.kernelSummary.avgDuration / 1_000_000).toFixed(2) +
        " ms</div>",
      "      </div>",
      '      <div class="metric-card">',
      '        <div class="metric-label">Peak Memory</div>',
      '        <div class="metric-value">' +
        (profileReport.memorySummary.peakMemory / 1024 / 1024).toFixed(2) +
        " MB</div>",
      "      </div>",
      '      <div class="metric-card">',
      '        <div class="metric-label">Avg Bandwidth</div>',
      '        <div class="metric-value">' +
        profileReport.transferSummary.avgBandwidth.toFixed(2) +
        " GB/s</div>",
      "      </div>",
      "    </div>",
    ];

    // Bottlenecks section
    if (analysis && analysis.bottlenecks.length > 0) {
      lines.push("    <h2>Bottlenecks</h2>");
      lines.push("    <table>");
      lines.push(
        "      <thead><tr><th>Severity</th><th>Category</th><th>Description</th><th>Impact</th></tr></thead>"
      );
      lines.push("      <tbody>");
      for (const bottleneck of analysis.bottlenecks) {
        lines.push(
          "        <tr>" +
            '<td class="severity-' +
            bottleneck.severity +
            '">' +
            bottleneck.severity.toUpperCase() +
            "</td>" +
            "<td>" +
            bottleneck.category +
            "</td>" +
            "<td>" +
            this.escapeHtml(bottleneck.description) +
            "</td>" +
            "<td>" +
            bottleneck.impact.toFixed(1) +
            "%</td>" +
            "</tr>"
        );
      }
      lines.push("      </tbody>");
      lines.push("    </table>");
    }

    // Optimizations section
    if (analysis && analysis.optimizations.length > 0) {
      lines.push("    <h2>Optimization Suggestions</h2>");
      lines.push("    <table>");
      lines.push(
        "      <thead><tr><th>Title</th><th>Category</th><th>Expected Improvement</th><th>Effort</th></tr></thead>"
      );
      lines.push("      <tbody>");
      for (const opt of analysis.optimizations.slice(0, 10)) {
        lines.push(
          "        <tr>" +
            "<td>" +
            this.escapeHtml(opt.title) +
            "</td>" +
            "<td>" +
            opt.category +
            "</td>" +
            "<td>+" +
            opt.expectedImprovement +
            "%</td>" +
            "<td>" +
            opt.effort +
            "</td>" +
            "</tr>"
        );
      }
      lines.push("      </tbody>");
      lines.push("    </table>");
    }

    // Metrics table
    if (opts.includeRawData && profileReport.metrics.length > 0) {
      lines.push("    <h2>Metrics</h2>");
      lines.push("    <table>");
      lines.push(
        "      <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Unit</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>"
      );
      lines.push("      <tbody>");
      for (const metric of profileReport.metrics) {
        lines.push(
          "        <tr>" +
            "<td>" +
            metric.name +
            "</td>" +
            "<td>" +
            metric.type +
            "</td>" +
            "<td>" +
            metric.value.toFixed(4) +
            "</td>" +
            "<td>" +
            metric.unit +
            "</td>" +
            "<td>" +
            metric.avg.toFixed(4) +
            "</td>" +
            "<td>" +
            metric.min.toFixed(4) +
            "</td>" +
            "<td>" +
            metric.max.toFixed(4) +
            "</td>" +
            "</tr>"
        );
      }
      lines.push("      </tbody>");
      lines.push("    </table>");
    }

    lines.push("  </div>");
    lines.push("</body>");
    lines.push("</html>");

    return lines.join("\n");
  }

  /**
   * Export report as Markdown
   */
  exportAsMarkdown(
    profileReport: ProfileReport,
    options: Partial<ExportOptions> = {}
  ): string {
    const opts: ExportOptions = {
      format: "markdown",
      includeRawData: true,
      includeTimeline: false,
      includeBottlenecks: true,
      includeOptimizations: true,
      ...options,
    };
    const lines: string[] = [
      "# WebGPU Profiling Report",
      "",
      `**Generated:** ${new Date(profileReport.timestamp).toISOString()}`,
      `**Session ID:** ${profileReport.id}`,
      `**Duration:** ${profileReport.sessionDuration.toFixed(2)} ms`,
      "",
    ];

    // Summary section
    lines.push("## Summary");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(
      `| Total Kernels | ${profileReport.kernelSummary.totalKernels} |`
    );
    lines.push(
      `| Avg Kernel Duration | ${(profileReport.kernelSummary.avgDuration / 1_000_000).toFixed(2)} ms |`
    );
    lines.push(
      `| Peak Memory | ${(profileReport.memorySummary.peakMemory / 1024 / 1024).toFixed(2)} MB |`
    );
    lines.push(
      `| Current Memory | ${(profileReport.memorySummary.currentMemory / 1024 / 1024).toFixed(2)} MB |`
    );
    lines.push(`| Memory Leaks | ${profileReport.memorySummary.leakCount} |`);
    lines.push(
      `| Total Transfers | ${profileReport.transferSummary.totalTransfers} |`
    );
    lines.push(
      `| Avg Bandwidth | ${profileReport.transferSummary.avgBandwidth.toFixed(2)} GB/s |`
    );
    lines.push("");

    // Bottlenecks section
    if (opts.includeBottlenecks) {
      const analysis = this.bottleneckAnalyzer.analyzeReport(profileReport);

      if (analysis.bottlenecks.length > 0) {
        lines.push("## Bottlenecks");
        lines.push("");
        for (const bottleneck of analysis.bottlenecks) {
          lines.push(
            `### ${bottleneck.severity.toUpperCase()}: ${bottleneck.category}`
          );
          lines.push(bottleneck.description);
          lines.push(`- **Impact:** ${bottleneck.impact.toFixed(1)}%`);
          lines.push(
            `- **Affected:** ${bottleneck.affectedComponent.join(", ")}`
          );
          lines.push("");
        }
      }

      // Optimizations section
      if (analysis.optimizations.length > 0) {
        lines.push("## Optimization Suggestions");
        lines.push("");
        for (let i = 0; i < Math.min(analysis.optimizations.length, 10); i++) {
          const opt = analysis.optimizations[i];
          lines.push(
            `${i + 1}. **${opt.title}** (+${opt.expectedImprovement}% expected)`
          );
          lines.push(`   - ${opt.description}`);
          lines.push(
            `   - Category: ${opt.category}, Effort: ${opt.effort}, Priority: ${opt.priority}`
          );
          lines.push("");
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Compare two reports
   *
   * @param before - Before report
   * @param after - After report
   * @returns Comparison report
   */
  compareReports(
    before: ProfileReport,
    after: ProfileReport
  ): ComparisonReport {
    const comparisons: ComparisonReport["comparisons"] = [];

    // Compare kernel metrics
    comparisons.push({
      metric: "Total Kernels",
      before: before.kernelSummary.totalKernels,
      after: after.kernelSummary.totalKernels,
      change:
        after.kernelSummary.totalKernels - before.kernelSummary.totalKernels,
      changePercent:
        ((after.kernelSummary.totalKernels -
          before.kernelSummary.totalKernels) /
          before.kernelSummary.totalKernels) *
        100,
      improved:
        after.kernelSummary.totalKernels < before.kernelSummary.totalKernels,
    });

    comparisons.push({
      metric: "Avg Kernel Duration",
      before: before.kernelSummary.avgDuration / 1_000_000,
      after: after.kernelSummary.avgDuration / 1_000_000,
      change:
        (after.kernelSummary.avgDuration - before.kernelSummary.avgDuration) /
        1_000_000,
      changePercent:
        ((after.kernelSummary.avgDuration - before.kernelSummary.avgDuration) /
          before.kernelSummary.avgDuration) *
        100,
      improved:
        after.kernelSummary.avgDuration < before.kernelSummary.avgDuration,
    });

    // Compare memory metrics
    comparisons.push({
      metric: "Peak Memory",
      before: before.memorySummary.peakMemory / 1024 / 1024,
      after: after.memorySummary.peakMemory / 1024 / 1024,
      change:
        (after.memorySummary.peakMemory - before.memorySummary.peakMemory) /
        1024 /
        1024,
      changePercent:
        ((after.memorySummary.peakMemory - before.memorySummary.peakMemory) /
          before.memorySummary.peakMemory) *
        100,
      improved:
        after.memorySummary.peakMemory < before.memorySummary.peakMemory,
    });

    comparisons.push({
      metric: "Memory Leaks",
      before: before.memorySummary.leakCount,
      after: after.memorySummary.leakCount,
      change: after.memorySummary.leakCount - before.memorySummary.leakCount,
      changePercent:
        before.memorySummary.leakCount > 0
          ? ((after.memorySummary.leakCount - before.memorySummary.leakCount) /
              before.memorySummary.leakCount) *
            100
          : 0,
      improved: after.memorySummary.leakCount < before.memorySummary.leakCount,
    });

    // Compare transfer metrics
    comparisons.push({
      metric: "Avg Bandwidth",
      before: before.transferSummary.avgBandwidth,
      after: after.transferSummary.avgBandwidth,
      change:
        after.transferSummary.avgBandwidth -
        before.transferSummary.avgBandwidth,
      changePercent:
        ((after.transferSummary.avgBandwidth -
          before.transferSummary.avgBandwidth) /
          before.transferSummary.avgBandwidth) *
        100,
      improved:
        after.transferSummary.avgBandwidth >
        before.transferSummary.avgBandwidth,
    });

    // Calculate overall improvement
    const improvements = comparisons.filter(c => c.improved);
    const overallImprovement =
      improvements.length > 0
        ? improvements.reduce((sum, c) => sum + Math.abs(c.changePercent), 0) /
          comparisons.length
        : 0;

    // Generate key improvements and regressions
    const keyImprovements = comparisons
      .filter(c => c.improved && Math.abs(c.changePercent) > 5)
      .map(
        c =>
          `${c.metric}: ${c.change > 0 ? "+" : ""}${c.changePercent.toFixed(1)}%`
      );

    const regressions = comparisons
      .filter(c => !c.improved && Math.abs(c.changePercent) > 5)
      .map(
        c =>
          `${c.metric}: ${c.change > 0 ? "+" : ""}${c.changePercent.toFixed(1)}%`
      );

    return {
      before,
      after,
      comparisons,
      overallImprovement,
      keyImprovements,
      regressions,
    };
  }

  /**
   * Generate trend analysis from multiple reports
   *
   * @param reports - Array of profile reports (ordered by time)
   * @returns Trend analysis
   */
  analyzeTrends(reports: ProfileReport[]): {
    metricTrends: Map<string, number[]>;
    improvingMetrics: string[];
    degradingMetrics: string[];
  } {
    if (reports.length < 2) {
      return {
        metricTrends: new Map(),
        improvingMetrics: [],
        degradingMetrics: [],
      };
    }

    const metricTrends = new Map<string, number[]>();

    // Track key metrics over time
    const metrics = [
      {
        name: "avgKernelDuration",
        extract: (r: ProfileReport) => r.kernelSummary.avgDuration,
      },
      {
        name: "peakMemory",
        extract: (r: ProfileReport) => r.memorySummary.peakMemory,
      },
      {
        name: "avgBandwidth",
        extract: (r: ProfileReport) => r.transferSummary.avgBandwidth,
      },
    ];

    for (const metric of metrics) {
      const values = reports.map(metric.extract);
      metricTrends.set(metric.name, values);

      // Calculate trend (positive = improving)
      const first = values[0];
      const last = values[values.length - 1];
      const trend = (first - last) / first; // Negative change for duration/memory is good
    }

    // Determine improving/degrading metrics
    const improvingMetrics: string[] = [];
    const degradingMetrics: string[] = [];

    for (const [name, values] of metricTrends) {
      if (values.length < 2) continue;

      const first = values[0];
      const last = values[values.length - 1];
      const changePercent = ((last - first) / first) * 100;

      // For duration and memory, lower is better
      // For bandwidth, higher is better
      const isImproving =
        name === "avgBandwidth" ? changePercent > 0 : changePercent < 0;

      if (Math.abs(changePercent) > 5) {
        if (isImproving) {
          improvingMetrics.push(
            `${name}: ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%`
          );
        } else {
          degradingMetrics.push(
            `${name}: ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%`
          );
        }
      }
    }

    return {
      metricTrends,
      improvingMetrics,
      degradingMetrics,
    };
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
