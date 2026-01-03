/**
 * @lsi/performance-tests
 *
 * SLA Compliance Framework
 *
 * Comprehensive Service Level Agreement monitoring and compliance checking.
 */

import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * SLA Definition
 */
export interface SLADefinition {
  /** SLA identifier */
  id: string;
  /** SLA name */
  name: string;
  /** Description */
  description: string;
  /** Metrics to track */
  metrics: SLAMetric[];
  /** Compliance targets */
  targets: SLATargets;
  /** Penalties for violations */
  penalties?: SLAPenalty[];
}

/**
 * SLA Metric
 */
export interface SLAMetric {
  /** Metric identifier */
  id: string;
  /** Metric name */
  name: string;
  /** Metric type */
  type: 'latency' | 'throughput' | 'availability' | 'error_rate' | 'resource';
  /** Unit of measurement */
  unit: string;
  /** Measurement method */
  method: 'p50' | 'p95' | 'p99' | 'avg' | 'max' | 'min';
  /** Weight in overall SLA score (0-1) */
  weight: number;
}

/**
 * SLA Targets
 */
export interface SLATargets {
  /** Latency targets (milliseconds) */
  latency?: {
    p50?: number;
    p95?: number;
    p99?: number;
    max?: number;
  };
  /** Throughput targets (queries per second) */
  throughput?: {
    min?: number;
    avg?: number;
    peak?: number;
  };
  /** Availability target (0-1) */
  availability?: number;
  /** Error rate target (0-1) */
  errorRate?: number;
  /** Resource usage targets */
  resources?: {
    maxMemoryMB?: number;
    maxCPUPercent?: number;
    maxDiskGB?: number;
  };
}

/**
 * SLA Penalty
 */
export interface SLAPenalty {
  /** Severity level */
  level: 'warning' | 'minor' | 'major' | 'critical';
  /** Violation threshold (%) */
  threshold: number;
  /** Penalty description */
  description: string;
  /** Credit amount (if applicable) */
  credit?: number;
}

/**
 * SLA Compliance Result
 */
export interface SLAComplianceResult {
  /** SLA being checked */
  slaId: string;
  /** Timestamp of check */
  timestamp: Date;
  /** Overall compliance percentage */
  compliancePercent: number;
  /** Whether SLA is met */
  isCompliant: boolean;
  /** Individual metric results */
  metrics: MetricComplianceResult[];
  /** Violations detected */
  violations: SLAViolation[];
  /** Recommendations */
  recommendations: string[];
  /** Summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Metric Compliance Result
 */
export interface MetricComplianceResult {
  /** Metric identifier */
  metricId: string;
  /** Actual value */
  actual: number;
  /** Target value */
  target: number;
  /** Whether metric passed */
  passed: boolean;
  /** Compliance percentage */
  compliancePercent: number;
  /** Deviation from target */
  deviation: number;
  /** Severity of failure */
  severity?: 'pass' | 'warning' | 'fail' | 'critical';
}

/**
 * SLA Violation
 */
export interface SLAViolation {
  /** Metric that violated */
  metricId: string;
  /** Severity */
  severity: 'warning' | 'minor' | 'major' | 'critical';
  /** Actual value */
  actual: number;
  /** Target value */
  target: number;
  /** Deviation percentage */
  deviationPercent: number;
  /** Recommended action */
  action: string;
}

/**
 * Production SLA Definitions
 */
export const PRODUCTION_SLAS: SLADefinition[] = [
  {
    id: 'aequor-core-latency',
    name: 'Aequor Core Latency SLA',
    description: 'Guarantees maximum response times for query processing',
    metrics: [
      {
        id: 'p95-latency-simple',
        name: 'P95 Latency (Simple Queries)',
        type: 'latency',
        unit: 'ms',
        method: 'p95',
        weight: 0.3,
      },
      {
        id: 'p95-latency-complex',
        name: 'P95 Latency (Complex Queries)',
        type: 'latency',
        unit: 'ms',
        method: 'p95',
        weight: 0.3,
      },
      {
        id: 'p99-latency',
        name: 'P99 Latency (All Queries)',
        type: 'latency',
        unit: 'ms',
        method: 'p99',
        weight: 0.4,
      },
    ],
    targets: {
      latency: {
        p95: 100,  // 100ms
        p99: 500,  // 500ms
        max: 5000, // 5s absolute maximum
      },
    },
    penalties: [
      {
        level: 'warning',
        threshold: 10,
        description: 'P95 latency exceeds 110ms (10% over target)',
      },
      {
        level: 'minor',
        threshold: 25,
        description: 'P95 latency exceeds 125ms (25% over target)',
        credit: 5,
      },
      {
        level: 'major',
        threshold: 50,
        description: 'P95 latency exceeds 150ms (50% over target)',
        credit: 10,
      },
      {
        level: 'critical',
        threshold: 100,
        description: 'P95 latency exceeds 200ms (100% over target)',
        credit: 25,
      },
    ],
  },
  {
    id: 'aequor-throughput',
    name: 'Aequor Throughput SLA',
    description: 'Guarantees minimum query processing capacity',
    metrics: [
      {
        id: 'qps-simple',
        name: 'Queries Per Second (Simple)',
        type: 'throughput',
        unit: 'qps',
        method: 'avg',
        weight: 0.6,
      },
      {
        id: 'qps-complex',
        name: 'Queries Per Second (Complex)',
        type: 'throughput',
        unit: 'qps',
        method: 'avg',
        weight: 0.4,
      },
    ],
    targets: {
      throughput: {
        min: 100,    // Minimum 100 QPS
        avg: 500,    // Average 500 QPS
        peak: 1000,  // Peak 1000 QPS
      },
    },
    penalties: [
      {
        level: 'warning',
        threshold: 10,
        description: 'Throughput below 90 QPS (10% under target)',
      },
      {
        level: 'minor',
        threshold: 25,
        description: 'Throughput below 75 QPS (25% under target)',
        credit: 5,
      },
      {
        level: 'major',
        threshold: 50,
        description: 'Throughput below 50 QPS (50% under target)',
        credit: 15,
      },
    ],
  },
  {
    id: 'aequor-availability',
    name: 'Aequor Availability SLA',
    description: 'Guarantees system uptime and accessibility',
    metrics: [
      {
        id: 'uptime',
        name: 'System Uptime',
        type: 'availability',
        unit: '%',
        method: 'avg',
        weight: 0.7,
      },
      {
        id: 'success-rate',
        name: 'Request Success Rate',
        type: 'error_rate',
        unit: '%',
        method: 'avg',
        weight: 0.3,
      },
    ],
    targets: {
      availability: 0.999,  // 99.9% uptime
      errorRate: 0.001,     // 0.1% error rate
    },
    penalties: [
      {
        level: 'minor',
        threshold: 0.1,
        description: 'Availability below 99.8% (0.1% downtime)',
        credit: 5,
      },
      {
        level: 'major',
        threshold: 0.5,
        description: 'Availability below 99.5% (0.5% downtime)',
        credit: 10,
      },
      {
        level: 'critical',
        threshold: 1.0,
        description: 'Availability below 99.0% (1.0% downtime)',
        credit: 25,
      },
    ],
  },
  {
    id: 'aequor-resources',
    name: 'Aequor Resource Usage SLA',
    description: 'Guarantees efficient resource utilization',
    metrics: [
      {
        id: 'memory-usage',
        name: 'Memory Usage',
        type: 'resource',
        unit: 'MB',
        method: 'max',
        weight: 0.5,
      },
      {
        id: 'cpu-usage',
        name: 'CPU Usage',
        type: 'resource',
        unit: '%',
        method: 'avg',
        weight: 0.3,
      },
      {
        id: 'cache-hit-rate',
        name: 'Cache Hit Rate',
        type: 'resource',
        unit: '%',
        method: 'avg',
        weight: 0.2,
      },
    ],
    targets: {
      resources: {
        maxMemoryMB: 2048,
        maxCPUPercent: 80,
      },
    },
    penalties: [
      {
        level: 'warning',
        threshold: 10,
        description: 'Memory usage exceeds 2250MB (10% over target)',
      },
      {
        level: 'minor',
        threshold: 25,
        description: 'Memory usage exceeds 2560MB (25% over target)',
      },
    ],
  },
];

/**
 * SLA Compliance Checker
 */
export class SLAComplianceChecker {
  private slas: Map<string, SLADefinition>;

  constructor(slas: SLADefinition[] = PRODUCTION_SLAS) {
    this.slas = new Map(slas.map(sla => [sla.id, sla]));
  }

  /**
   * Check SLA compliance for given metrics
   */
  checkCompliance(
    slaId: string,
    actualMetrics: Record<string, number>
  ): SLAComplianceResult {
    const sla = this.slas.get(slaId);
    if (!sla) {
      throw new Error(`SLA not found: ${slaId}`);
    }

    const timestamp = new Date();
    const metricResults: MetricComplianceResult[] = [];
    const violations: SLAViolation[] = [];
    let totalWeight = 0;
    let complianceScore = 0;

    // Check each metric
    for (const metric of sla.metrics) {
      const actual = actualMetrics[metric.id];
      if (actual === undefined) {
        console.warn(`Missing metric value: ${metric.id}`);
        continue;
      }

      // Get target value
      let target: number;
      switch (metric.type) {
        case 'latency':
          target = sla.targets.latency?.[metric.method] || 0;
          break;
        case 'throughput':
          target = sla.targets.throughput?.[metric.method === 'avg' ? 'avg' : 'min'] || 0;
          break;
        case 'availability':
        case 'error_rate':
          target = sla.targets.availability || 0.999;
          break;
        case 'resource':
          if (metric.id === 'cache-hit-rate') {
            target = 0.80; // 80% cache hit rate
          } else {
            target = sla.targets.resources?.maxMemoryMB || 2048;
          }
          break;
        default:
          target = 0;
      }

      // Calculate compliance
      const isLowerBetter = metric.type === 'latency' || metric.type === 'error_rate';
      const passed = isLowerBetter ? actual <= target : actual >= target;

      const deviation = isLowerBetter
        ? ((actual - target) / target) * 100
        : ((target - actual) / target) * 100;

      const compliancePercent = passed ? 100 : Math.max(0, 100 - Math.abs(deviation));

      // Determine severity
      let severity: 'pass' | 'warning' | 'fail' | 'critical';
      if (passed) {
        severity = 'pass';
      } else if (Math.abs(deviation) < 10) {
        severity = 'warning';
      } else if (Math.abs(deviation) < 25) {
        severity = 'fail';
      } else {
        severity = 'critical';
      }

      metricResults.push({
        metricId: metric.id,
        actual,
        target,
        passed,
        compliancePercent,
        deviation,
        severity,
      });

      // Add to overall score
      totalWeight += metric.weight;
      complianceScore += compliancePercent * metric.weight;

      // Track violations
      if (!passed) {
        const violationLevel = severity === 'critical' ? 'critical' :
                              severity === 'fail' ? 'major' :
                              severity === 'warning' ? 'minor' : 'warning';

        violations.push({
          metricId: metric.id,
          severity: violationLevel,
          actual,
          target,
          deviationPercent: deviation,
          action: this.getRecommendation(metric, actual, target),
        });
      }
    }

    // Calculate overall compliance
    const overallCompliance = totalWeight > 0 ? complianceScore / totalWeight : 0;
    const isCompliant = overallCompliance >= 90; // 90% threshold

    // Generate recommendations
    const recommendations = this.generateRecommendations(metricResults, violations);

    return {
      slaId,
      timestamp,
      compliancePercent: overallCompliance,
      isCompliant,
      metrics: metricResults,
      violations,
      recommendations,
      summary: {
        total: metricResults.length,
        passed: metricResults.filter(m => m.passed).length,
        failed: metricResults.filter(m => !m.passed).length,
        warnings: metricResults.filter(m => m.severity === 'warning').length,
      },
    };
  }

  /**
   * Check multiple SLAs
   */
  checkMultipleSLAs(
    metricsBySLA: Record<string, Record<string, number>>
  ): SLAComplianceResult[] {
    const results: SLAComplianceResult[] = [];

    for (const [slaId, metrics] of Object.entries(metricsBySLA)) {
      try {
        const result = this.checkCompliance(slaId, metrics);
        results.push(result);
      } catch (error) {
        console.error(`Error checking SLA ${slaId}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    results: SLAComplianceResult[],
    format: 'json' | 'markdown' = 'markdown'
  ): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // Markdown format
    const lines: string[] = [];

    lines.push('# SLA Compliance Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**SLAs Checked:** ${results.length}`);
    lines.push('');

    // Summary
    const compliantCount = results.filter(r => r.isCompliant).length;
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Status | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Compliant | ${compliantCount} |`);
    lines.push(`| Non-Compliant | ${results.length - compliantCount} |`);
    lines.push('');

    // Detailed results
    for (const result of results) {
      lines.push(`## ${result.slaId}`);
      lines.push('');

      const status = result.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT';
      lines.push(`**Status:** ${status}`);
      lines.push(`**Compliance:** ${result.compliancePercent.toFixed(2)}%`);
      lines.push('');

      // Metrics table
      lines.push('### Metrics');
      lines.push('');
      lines.push('| Metric | Actual | Target | Status | Deviation |');
      lines.push('|--------|--------|--------|--------|-----------|');

      for (const metric of result.metrics) {
        const status = metric.passed ? 'PASS' : `${metric.severity.toUpperCase()}`;
        const deviation = metric.deviation >= 0 ? `+${metric.deviation.toFixed(1)}%` : `${metric.deviation.toFixed(1)}%`;
        lines.push(`| ${metric.metricId} | ${metric.actual.toFixed(2)} | ${metric.target.toFixed(2)} | ${status} | ${deviation} |`);
      }

      lines.push('');

      // Violations
      if (result.violations.length > 0) {
        lines.push('### Violations');
        lines.push('');

        for (const violation of result.violations) {
          lines.push(`**${violation.metricId}** (${violation.severity.toUpperCase()})`);
          lines.push(`- Actual: ${violation.actual.toFixed(2)}`);
          lines.push(`- Target: ${violation.target.toFixed(2)}`);
          lines.push(`- Deviation: ${violation.deviationPercent.toFixed(1)}%`);
          lines.push(`- Action: ${violation.action}`);
          lines.push('');
        }
      }

      // Recommendations
      if (result.recommendations.length > 0) {
        lines.push('### Recommendations');
        lines.push('');
        for (const rec of result.recommendations) {
          lines.push(`- ${rec}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Save compliance report to file
   */
  async saveReport(
    results: SLAComplianceResult[],
    filepath: string,
    format: 'json' | 'markdown' = 'markdown'
  ): Promise<void> {
    const report = await this.generateComplianceReport(results, format);
    await writeFile(filepath, report, 'utf-8');
  }

  /**
   * Get recommendation for metric violation
   */
  private getRecommendation(metric: SLAMetric, actual: number, target: number): string {
    const deviations = ((actual - target) / target) * 100;

    if (metric.type === 'latency') {
      if (deviations > 100) {
        return 'URGENT: Latency critical. Review all system components, implement request queuing.';
      } else if (deviations > 50) {
        return 'Major latency degradation. Profile hot paths, optimize database queries.';
      } else if (deviations > 25) {
        return 'Moderate latency increase. Investigate bottlenecks, consider caching.';
      } else {
        return 'Minor latency increase. Monitor closely, optimize if trend continues.';
      }
    } else if (metric.type === 'throughput') {
      return 'Scale horizontally, add more instances, optimize query processing.';
    } else if (metric.type === 'availability') {
      return 'Review error logs, improve failover mechanisms, add redundancy.';
    } else if (metric.type === 'resource') {
      if (metric.id === 'memory-usage') {
        return 'Memory leak suspected. Profile memory usage, optimize data structures.';
      } else if (metric.id === 'cpu-usage') {
        return 'CPU saturation. Optimize algorithms, consider better hardware.';
      } else if (metric.id === 'cache-hit-rate') {
        return 'Cache effectiveness low. Review cache strategy, increase cache size.';
      }
    }

    return 'Review metric and implement optimizations.';
  }

  /**
   * Generate recommendations from results
   */
  private generateRecommendations(
    metrics: MetricComplianceResult[],
    violations: SLAViolation[]
  ): string[] {
    const recommendations: string[] = [];

    // Priority recommendations from violations
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push(`URGENT: ${criticalViolations.length} critical violations require immediate attention.`);
    }

    const majorViolations = violations.filter(v => v.severity === 'major');
    if (majorViolations.length > 0) {
      recommendations.push(`HIGH: ${majorViolations.length} major violations should be addressed promptly.`);
    }

    // Add specific recommendations from violations
    for (const violation of violations) {
      if (violation.severity === 'critical' || violation.severity === 'major') {
        recommendations.push(violation.action);
      }
    }

    // General recommendations
    const failedMetrics = metrics.filter(m => !m.passed);
    if (failedMetrics.length > 0) {
      recommendations.push(`${failedMetrics.length} metrics failed targets. Review performance optimization strategy.`);
    }

    const warningMetrics = metrics.filter(m => m.severity === 'warning');
    if (warningMetrics.length > 0) {
      recommendations.push(`${warningMetrics.length} metrics are approaching limits. Monitor closely.`);
    }

    return recommendations;
  }
}

/**
 * Create SLA compliance checker with default SLAs
 */
export function createSLAChecker(): SLAComplianceChecker {
  return new SLAComplianceChecker(PRODUCTION_SLAS);
}
