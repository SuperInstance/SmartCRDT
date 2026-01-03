/**
 * DashboardGenerator - Generate analytics dashboards and reports
 *
 * Creates JSON, HTML, and markdown reports for cache analytics.
 * Also handles Prometheus and Graphite metric exports.
 *
 * Features:
 * - JSON report generation
 * - HTML dashboard generation
 * - Markdown report generation
 * - CSV export
 * - Prometheus text format export
 * - Graphite plaintext format export
 */

import type {
  DashboardData,
  CacheAnalyticsReport,
  ReportFormat,
  ReportConfig,
  PrometheusExport,
  GraphiteExport,
  MetricsExportConfig,
  CacheMetricsSnapshot,
  Anomaly,
  AnomalySeverity,
  OptimizationRecommendation,
  RecommendationPriority,
} from "@lsi/protocol";

/**
 * DashboardGenerator - Multi-format cache analytics reports
 */
export class DashboardGenerator {
  /**
   * Generate dashboard data
   */
  generateDashboard(
    metrics: CacheMetricsSnapshot,
    anomalies: Anomaly[],
    recommendations: OptimizationRecommendation[],
    efficiencyScore: number,
    history: { timestamp: number; hitRate: number }[]
  ): DashboardData {
    // Identify top issues
    const topIssues = this.identifyTopIssues(anomalies, recommendations);

    return {
      metrics,
      recentAnomalies: anomalies.slice(0, 10),
      recommendations: recommendations.slice(0, 10),
      efficiencyScore: {
        overall: efficiencyScore,
        grade: this.calculateGrade(efficiencyScore),
        components: {
          hitRateScore: metrics.hitRate.overall * 100,
          memoryScore: (1 - metrics.memory.usagePercent) * 100,
          latencyScore: Math.max(0, 100 - metrics.latency.p95 / 10),
          evictionScore: Math.max(0, 100 - metrics.entries.evictionRate * 5),
          patternScore: metrics.patterns.repetitionRate * 100,
        },
        trend: metrics.hitRate.trend,
        percentile: efficiencyScore * 100,
        baselineComparison: {
          baseline: 75,
          current: efficiencyScore,
          delta: efficiencyScore - 75,
          deltaPercent: ((efficiencyScore - 75) / 75) * 100,
        },
        calculatedAt: Date.now(),
      },
      history: {
        points: history.map((h) => ({
          timestamp: h.timestamp,
          hitRate: h.hitRate,
          size: metrics.size,
          memoryUsage: metrics.memory.currentUsage,
          latency: metrics.latency.p95,
        })),
        window: "24h",
        count: history.length,
      },
      topIssues,
      generatedAt: Date.now(),
      refreshInterval: 5000,
    };
  }

  /**
   * Generate report in specified format
   */
  generateReport(
    dashboard: DashboardData,
    config: ReportConfig
  ): CacheAnalyticsReport {
    let data: unknown;

    switch (config.format) {
      case "json":
        data = this.generateJSONReport(dashboard, config);
        break;
      case "html":
        data = this.generateHTMLReport(dashboard, config);
        break;
      case "markdown":
        data = this.generateMarkdownReport(dashboard, config);
        break;
      case "csv":
        data = this.generateCSVReport(dashboard, config);
        break;
    }

    return {
      data,
      format: config.format,
      generatedAt: Date.now(),
      timeRange: {
        start: Date.now() - 24 * 60 * 60 * 1000,
        end: Date.now(),
      },
      metadata: {
        cacheId: dashboard.metrics.cacheId,
        metricsSnapshots: dashboard.history.count,
        anomaliesDetected: dashboard.recentAnomalies.length,
        recommendationsGenerated: dashboard.recommendations.length,
      },
    };
  }

  /**
   * Generate JSON report
   */
  private generateJSONReport(dashboard: DashboardData, config: ReportConfig): string {
    const report: Record<string, unknown> = {
      generatedAt: new Date(dashboard.generatedAt).toISOString(),
      cacheId: dashboard.metrics.cacheId,
      metrics: dashboard.metrics,
    };

    if (config.includeEfficiencyScore) {
      report.efficiencyScore = dashboard.efficiencyScore;
    }

    if (config.includeAnomalies) {
      const max = config.maxAnomalies ?? dashboard.recentAnomalies.length;
      report.anomalies = dashboard.recentAnomalies.slice(0, max);
    }

    if (config.includeRecommendations) {
      const max = config.maxRecommendations ?? dashboard.recommendations.length;
      report.recommendations = dashboard.recommendations.slice(0, max);
    }

    if (config.includeHistory) {
      report.history = dashboard.history.points;
    }

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(dashboard: DashboardData, config: ReportConfig): string {
    const m = dashboard.metrics;
    const eff = dashboard.efficiencyScore;
    const anomalies = config.maxAnomalies
      ? dashboard.recentAnomalies.slice(0, config.maxAnomalies)
      : dashboard.recentAnomalies;
    const recs = config.maxRecommendations
      ? dashboard.recommendations.slice(0, config.maxRecommendations)
      : dashboard.recommendations;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cache Analytics Dashboard - ${m.cacheId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1, h2, h3 { color: #f8fafc; margin-bottom: 1rem; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #334155;
        }
        .score-card {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            padding: 2rem;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 2rem;
        }
        .score-value { font-size: 4rem; font-weight: bold; }
        .score-grade { font-size: 2rem; margin-left: 1rem; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .card {
            background: #1e293b;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #334155;
        }
        .card h3 { color: #94a3b8; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .metric { font-size: 2rem; font-weight: bold; margin: 0.5rem 0; }
        .metric-sub { color: #94a3b8; font-size: 0.875rem; }
        .trend-up { color: #22c55e; }
        .trend-down { color: #ef4444; }
        .trend-stable { color: #94a3b8; }
        .anomaly {
            background: #7f1d1d;
            border-left: 4px solid #ef4444;
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 4px;
        }
        .anomaly.high { background: #7c2d12; border-color: #f97316; }
        .anomaly.medium { background: #78350f; border-color: #eab308; }
        .recommendation {
            background: #14532d;
            border-left: 4px solid #22c55e;
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 4px;
        }
        .priority { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
        .priority.urgent { background: #dc2626; }
        .priority.high { background: #ea580c; }
        .priority.medium { background: #ca8a04; }
        .priority.low { background: #6b7280; }
        .timestamp { color: #64748b; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>Cache Analytics Dashboard</h1>
                <p class="timestamp">Generated: ${new Date(dashboard.generatedAt).toLocaleString()}</p>
            </div>
            <div class="score-card">
                <div>
                    <span class="score-value">${eff.overall.toFixed(1)}</span>
                    <span class="score-grade">${eff.grade}</span>
                </div>
                <div>Efficiency Score</div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>Hit Rate</h3>
                <div class="metric">${(m.hitRate.overall * 100).toFixed(1)}%</div>
                <div class="metric-sub trend-${m.hitRate.trend}">
                    ${m.hitRate.trend === "improving" ? "↑" : m.hitRate.trend === "declining" ? "↓" : "→"}
                    ${m.hitRate.trend}
                </div>
            </div>
            <div class="card">
                <h3>P95 Latency</h3>
                <div class="metric">${m.latency.p95.toFixed(1)}ms</div>
                <div class="metric-sub">P99: ${m.latency.p99.toFixed(1)}ms</div>
            </div>
            <div class="card">
                <h3>Memory Usage</h3>
                <div class="metric">${(m.memory.currentUsage / 1024 / 1024).toFixed(1)} MB</div>
                <div class="metric-sub trend-${m.memory.trend}">${m.memory.trend}</div>
            </div>
            <div class="card">
                <h3>Cache Size</h3>
                <div class="metric">${m.size} / ${m.maxSize}</div>
                <div class="metric-sub">${((m.size / m.maxSize) * 100).toFixed(1)}% full</div>
            </div>
            <div class="card">
                <h3>Evictions</h3>
                <div class="metric">${m.entries.evictionRate.toFixed(1)}/s</div>
                <div class="metric-sub">Total: ${m.entries.evictions}</div>
            </div>
            <div class="card">
                <h3>Avg Similarity</h3>
                <div class="metric">${m.similarity.average.toFixed(3)}</div>
                <div class="metric-sub">Threshold: ${m.threshold.toFixed(3)}</div>
            </div>
        </div>

        ${anomalies.length > 0 ? `
        <h2>Active Anomalies (${anomalies.length})</h2>
        <div class="grid">
            ${anomalies.map(a => `
                <div class="anomaly ${a.severity}">
                    <strong>${a.type}</strong>
                    <span class="priority ${a.severity}">${a.severity.toUpperCase()}</span>
                    <p>${a.description}</p>
                    <small class="timestamp">${new Date(a.detectedAt).toLocaleString()}</small>
                </div>
            `).join("")}
        </div>
        ` : ""}

        ${recs.length > 0 ? `
        <h2>Optimization Recommendations (${recs.length})</h2>
        <div class="grid">
            ${recs.map(r => `
                <div class="recommendation">
                    <span class="priority ${r.priority}">${r.priority.toUpperCase()}</span>
                    <strong>${r.title}</strong>
                    <p>${r.description}</p>
                    <small>Effort: ${r.effort} | Risk: ${(r.risk * 100).toFixed(0)}%</small>
                </div>
            `).join("")}
        </div>
        ` : ""}

        <div class="card">
            <h3>Top Issues</h3>
            <ul>
                ${dashboard.topIssues.map(issue => `
                    <li><strong>${issue.severity}:</strong> ${issue.impact}</li>
                `).join("")}
            </ul>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(dashboard: DashboardData, config: ReportConfig): string {
    const m = dashboard.metrics;
    const eff = dashboard.efficiencyScore;

    let md = `# Cache Analytics Report\n\n`;
    md += `**Cache ID:** ${m.cacheId}  \n`;
    md += `**Generated:** ${new Date(dashboard.generatedAt).toLocaleString()}  \n\n`;

    md += `## Efficiency Score\n\n`;
    md += `**${eff.overall.toFixed(1)}/100** (Grade: ${eff.grade})  \n`;
    md += `Trend: ${eff.trend}  \n\n`;

    md += `## Key Metrics\n\n`;
    md += `| Metric | Value | Trend |\n`;
    md += `|--------|-------|-------|\n`;
    md += `| Hit Rate | ${(m.hitRate.overall * 100).toFixed(1)}% | ${m.hitRate.trend} |\n`;
    md += `| P95 Latency | ${m.latency.p95.toFixed(1)}ms | - |\n`;
    md += `| P99 Latency | ${m.latency.p99.toFixed(1)}ms | - |\n`;
    md += `| Memory Usage | ${(m.memory.currentUsage / 1024 / 1024).toFixed(1)} MB | ${m.memory.trend} |\n`;
    md += `| Cache Size | ${m.size}/${m.maxSize} | - |\n`;
    md += `| Eviction Rate | ${m.entries.evictionRate.toFixed(1)}/s | - |\n`;
    md += `| Avg Similarity | ${m.similarity.average.toFixed(3)} | - |\n\n`;

    if (config.includeAnomalies && dashboard.recentAnomalies.length > 0) {
      const max = config.maxAnomalies ?? dashboard.recentAnomalies.length;
      const anomalies = dashboard.recentAnomalies.slice(0, max);
      md += `## Active Anomalies (${anomalies.length})\n\n`;
      for (const a of anomalies) {
        md += `### ${a.type} (${a.severity})\n`;
        md += `${a.description}  \n`;
        md += `**Current:** ${a.currentValue.toFixed(3)}  \n`;
        md += `**Expected:** ${a.expectedValue.toFixed(3)}  \n`;
        md += `**Deviation:** ${(a.deviationPercent * 100).toFixed(1)}%  \n\n`;
      }
    }

    if (config.includeRecommendations && dashboard.recommendations.length > 0) {
      const max = config.maxRecommendations ?? dashboard.recommendations.length;
      const recs = dashboard.recommendations.slice(0, max);
      md += `## Optimization Recommendations (${recs.length})\n\n`;
      for (const r of recs) {
        md += `### ${r.title} [${r.priority.toUpperCase()}]\n`;
        md += `${r.description}  \n`;
        md += `**Action:** ${r.action}  \n`;
        md += `**Effort:** ${r.effort} | **Risk:** ${(r.risk * 100).toFixed(0)}% | **Confidence:** ${(r.confidence * 100).toFixed(0)}%  \n\n`;
      }
    }

    md += `## Top Issues\n\n`;
    for (const issue of dashboard.topIssues) {
      md += `- **[${issue.severity.toUpperCase()}]** ${issue.impact}\n`;
    }

    return md;
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(dashboard: DashboardData, config: ReportConfig): string {
    const m = dashboard.metrics;
    let csv = "timestamp,cache_id,hit_rate,p50_latency,p95_latency,p99_latency,memory_usage,cache_size,evictions\n";
    csv += `${dashboard.generatedAt},${m.cacheId},${m.hitRate.overall},${m.latency.p50},${m.latency.p95},${m.latency.p99},${m.memory.currentUsage},${m.size},${m.entries.evictions}\n`;
    return csv;
  }

  /**
   * Export metrics to Prometheus format
   */
  exportToPrometheus(
    metrics: CacheMetricsSnapshot,
    config: MetricsExportConfig
  ): PrometheusExport {
    const prefix = config.metricPrefix || "cache_analytics";
    const labels = config.includeLabels
      ? `{cache_id="${metrics.cacheId}"}`
      : "";

    const promMetrics: Array<{ name: string; type: string; value: number; labels?: string; help?: string }> = [
      {
        name: `${prefix}_hit_rate`,
        type: "gauge",
        value: metrics.hitRate.overall,
        labels,
        help: "Cache hit rate (0-1)",
      },
      {
        name: `${prefix}_p50_latency_ms`,
        type: "gauge",
        value: metrics.latency.p50,
        labels,
        help: "P50 latency in milliseconds",
      },
      {
        name: `${prefix}_p95_latency_ms`,
        type: "gauge",
        value: metrics.latency.p95,
        labels,
        help: "P95 latency in milliseconds",
      },
      {
        name: `${prefix}_p99_latency_ms`,
        type: "gauge",
        value: metrics.latency.p99,
        labels,
        help: "P99 latency in milliseconds",
      },
      {
        name: `${prefix}_memory_usage_bytes`,
        type: "gauge",
        value: metrics.memory.currentUsage,
        labels,
        help: "Current memory usage in bytes",
      },
      {
        name: `${prefix}_cache_size`,
        type: "gauge",
        value: metrics.size,
        labels,
        help: "Current number of cache entries",
      },
      {
        name: `${prefix}_evictions_total`,
        type: "counter",
        value: metrics.entries.evictions,
        labels,
        help: "Total number of cache evictions",
      },
      {
        name: `${prefix}_eviction_rate`,
        type: "gauge",
        value: metrics.entries.evictionRate,
        labels,
        help: "Current eviction rate (evictions per second)",
      },
    ];

    // Generate Prometheus text format
    let textFormat = "";
    for (const metric of promMetrics) {
      if (metric.help) {
        textFormat += `# HELP ${metric.name} ${metric.help}\n`;
      }
      textFormat += `# TYPE ${metric.name} ${metric.type}\n`;
      textFormat += `${metric.name}${metric.labels || ""} ${metric.value}\n\n`;
    }

    return {
      textFormat,
      metrics: promMetrics.map((m) => ({
        name: m.name,
        type: m.type as any,
        value: m.value,
        labels: (config.includeLabels && labels ? { cache_id: metrics.cacheId } : {}) as Record<string, string>,
        help: m.help,
      })),
      exportedAt: Date.now(),
    };
  }

  /**
   * Export metrics to Graphite format
   */
  exportToGraphite(
    metrics: CacheMetricsSnapshot,
    config: MetricsExportConfig
  ): GraphiteExport {
    const prefix = config.metricPrefix || "cache_analytics";
    const now = Math.floor(Date.now() / 1000);

    const graphiteMetrics = [
      {
        path: `${prefix}.hit_rate`,
        value: metrics.hitRate.overall,
        timestamp: now,
      },
      {
        path: `${prefix}.latency.p50`,
        value: metrics.latency.p50,
        timestamp: now,
      },
      {
        path: `${prefix}.latency.p95`,
        value: metrics.latency.p95,
        timestamp: now,
      },
      {
        path: `${prefix}.latency.p99`,
        value: metrics.latency.p99,
        timestamp: now,
      },
      {
        path: `${prefix}.memory.usage_bytes`,
        value: metrics.memory.currentUsage,
        timestamp: now,
      },
      {
        path: `${prefix}.cache.size`,
        value: metrics.size,
        timestamp: now,
      },
      {
        path: `${prefix}.cache.evictions`,
        value: metrics.entries.evictions,
        timestamp: now,
      },
      {
        path: `${prefix}.cache.eviction_rate`,
        value: metrics.entries.evictionRate,
        timestamp: now,
      },
    ];

    // Generate Graphite plaintext format
    const plaintextFormat = graphiteMetrics
      .map((m) => `${m.path} ${m.value} ${m.timestamp}`)
      .join("\n");

    return {
      plaintextFormat,
      metrics: graphiteMetrics,
      exportedAt: Date.now(),
    };
  }

  /**
   * Identify top issues from anomalies and recommendations
   */
  private identifyTopIssues(
    anomalies: Anomaly[],
    recommendations: OptimizationRecommendation[]
  ): Array<{ issue: string; severity: AnomalySeverity | RecommendationPriority; impact: string }> {
    const issues: Array<{ issue: string; severity: AnomalySeverity | RecommendationPriority; impact: string }> = [];

    // Add critical anomalies
    for (const a of anomalies.filter((a) => a.severity === "critical")) {
      issues.push({
        issue: a.type,
        severity: a.severity,
        impact: a.description,
      });
    }

    // Add urgent recommendations
    for (const r of recommendations.filter((r) => r.priority === "urgent")) {
      issues.push({
        issue: r.category,
        severity: r.priority,
        impact: r.title,
      });
    }

    // Limit to top 5
    return issues.slice(0, 5);
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }
}
