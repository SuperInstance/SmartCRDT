/**
 * Metrics analysis tools for LSI cost savings example
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface MetricsExport {
  cacheMetrics: any;
  queries: any[];
  exportDate: string;
}

export class MetricsAnalyzer {
  private metricsPath: string;

  constructor(metricsDir: string = './metrics') {
    this.metricsPath = join(metricsDir, 'metrics.json');
    this.ensureMetricsDir();
  }

  /**
   * Ensure metrics directory exists
   */
  private ensureMetricsDir(): void {
    const dir = this.metricsPath.substring(0, this.metricsPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load metrics from file
   */
  loadMetrics(): MetricsExport | null {
    try {
      if (!existsSync(this.metricsPath)) {
        return null;
      }

      const data = readFileSync(this.metricsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading metrics:', error);
      return null;
    }
  }

  /**
   * Save metrics to file
   */
  saveMetrics(metrics: MetricsExport): void {
    try {
      writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2));
      console.log(`✅ Metrics saved to ${this.metricsPath}`);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Analyze query patterns
   */
  analyzeQueryPatterns(queries: any[]): any {
    const patterns = {
      totalQueries: queries.length,
      avgResponseTime: 0,
      cacheHitRate: 0,
      mostCommonQueries: [] as Array<{ query: string; count: number }>,
      responseTimeDistribution: {
        fast: 0,      // < 100ms
        medium: 0,    // 100-500ms
        slow: 0       // > 500ms
      },
      similarityScores: {
        high: 0,      // > 0.8
        medium: 0,    // 0.5-0.8
        low: 0        // < 0.5
      }
    };

    // Calculate metrics
    let totalResponseTime = 0;
    let cacheHits = 0;

    queries.forEach(q => {
      totalResponseTime += q.responseTime;

      if (q.cacheHit) cacheHits++;

      // Response time distribution
      if (q.responseTime < 100) patterns.responseTimeDistribution.fast++;
      else if (q.responseTime <= 500) patterns.responseTimeDistribution.medium++;
      else patterns.responseTimeDistribution.slow++;

      // Similarity distribution
      if (q.similarityScore > 0.8) patterns.similarityScores.high++;
      else if (q.similarityScore >= 0.5) patterns.similarityScores.medium++;
      else patterns.similarityScores.low++;
    });

    patterns.avgResponseTime = queries.length > 0 ? totalResponseTime / queries.length : 0;
    patterns.cacheHitRate = queries.length > 0 ? (cacheHits / queries.length) * 100 : 0;

    // Find most common queries
    const queryCounts = queries.reduce((acc, q) => {
      acc[q.query] = (acc[q.query] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    patterns.mostCommonQueries = Object.entries(queryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));

    return patterns;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(metrics: MetricsExport): string {
    const patterns = this.analyzeQueryPatterns(metrics.queries);

    return `
# LSI Performance Report

Generated: ${new Date(metrics.exportDate).toLocaleString()}

## Cache Performance
- **Total Queries**: ${patterns.totalQueries}
- **Cache Hit Rate**: ${patterns.cacheHitRate.toFixed(1)}%
- **Average Response Time**: ${patterns.avgResponseTime.toFixed(0)}ms

## Response Time Distribution
- **Fast (<100ms)**: ${patterns.responseTimeDistribution.fast} queries (${(patterns.responseTimeDistribution.fast / patterns.totalQueries * 100).toFixed(1)}%)
- **Medium (100-500ms)**: ${patterns.responseTimeDistribution.medium} queries (${(patterns.responseTimeDistribution.medium / patterns.totalQueries * 100).toFixed(1)}%)
- **Slow (>500ms)**: ${patterns.responseTimeDistribution.slow} queries (${(patterns.responseTimeDistribution.slow / patterns.totalQueries * 100).toFixed(1)}%)

## Similarity Score Distribution
- **High (>0.8)**: ${patterns.similarityScores.high} queries
- **Medium (0.5-0.8)**: ${patterns.similarityScores.medium} queries
- **Low (<0.5)**: ${patterns.similarityScores.low} queries

## Most Common Queries
${patterns.mostCommonQueries.map((item, index) =>
  `${index + 1}. "${item.query}" (${item.count} times)`
).join('\n')}

## Cost Summary
- **Total Cost Saved**: $${metrics.cacheMetrics.totalCostSavings.toFixed(2)}
- **API Calls Saved**: ${metrics.cacheMetrics.apiCallsSaved}
- **Cost Reduction**: ${((metrics.cacheMetrics.totalCostSavings / metrics.cacheMetrics.totalCost) * 100).toFixed(1)}%
`;
  }

  /**
   * Export metrics as markdown
   */
  exportAsMarkdown(): void {
    const metrics = this.loadMetrics();
    if (!metrics) {
      console.log('No metrics found to export');
      return;
    }

    const report = this.generatePerformanceReport(metrics);
    const reportPath = this.metricsPath.replace('.json', '.md');

    writeFileSync(reportPath, report);
    console.log(`📄 Report exported to ${reportPath}`);
  }
}

// Usage example
if (require.main === module) {
  const analyzer = new MetricsAnalyzer();

  // Load and analyze
  const metrics = analyzer.loadMetrics();
  if (metrics) {
    console.log('📊 Analyzing metrics...');
    const patterns = analyzer.analyzeQueryPatterns(metrics.queries);
    console.log('Analysis complete:', patterns);

    // Export as markdown
    analyzer.exportAsMarkdown();
  } else {
    console.log('No metrics found. Run the demo first to generate metrics.');
  }
}