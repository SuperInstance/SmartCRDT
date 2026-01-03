/**
 * SLAReporter - Report SLA compliance and violations
 * Tracks service level agreements and generates compliance reports.
 */

import type {
  SLAConfig,
  SLAReport,
  SLAMetrics,
  SLAViolation,
  SLASummary,
  SLALatencyMetrics,
  PerformanceMetrics,
  LatencyMetrics,
} from "../types.js";

export interface SLAReporterOptions {
  config: SLAConfig;
  windowSize: number; // Time window for SLA calculation (ms)
  reportingInterval: number; // How often to report (ms)
}

export interface MetricSample {
  timestamp: number;
  latency: number;
  success: boolean;
  cpu?: number;
  memory?: number;
}

export class SLAReporter {
  private config: SLAConfig;
  private samples: MetricSample[] = [];
  private violations: SLAViolation[] = [];
  private windowSize: number;
  private reportingInterval: number;
  private lastReportTime = 0;

  constructor(options: SLAReporterOptions) {
    this.config = options.config;
    this.windowSize = options.windowSize;
    this.reportingInterval = options.reportingInterval;
  }

  /**
   * Record a metric sample
   */
  recordSample(sample: MetricSample): void {
    this.samples.push(sample);
    this.cleanupOldSamples();

    // Check for SLA violations
    this.checkForViolations(sample);
  }

  /**
   * Remove samples outside the time window
   */
  private cleanupOldSamples(): void {
    const now = Date.now();
    const cutoff = now - this.windowSize;

    this.samples = this.samples.filter(s => s.timestamp > cutoff);
  }

  /**
   * Check for SLA violations
   */
  private checkForViolations(sample: MetricSample): void {
    // Check latency SLA
    if (sample.latency > this.config.latency.p99) {
      this.addViolation({
        metric: "latency_p99",
        threshold: this.config.latency.p99,
        actual: sample.latency,
        severity: this.getLatencySeverity(sample.latency),
        duration: 0,
        timestamp: sample.timestamp,
      });
    }

    // Check for errors (affects availability)
    if (!sample.success) {
      this.addViolation({
        metric: "availability",
        threshold: this.config.availability,
        actual: 0,
        severity: "critical",
        duration: 0,
        timestamp: sample.timestamp,
      });
    }
  }

  /**
   * Add a violation
   */
  private addViolation(violation: SLAViolation): void {
    // Check if this is a continuation of an existing violation
    const lastViolation = this.violations[this.violations.length - 1];

    if (
      lastViolation &&
      lastViolation.metric === violation.metric &&
      !lastViolation.resolved &&
      violation.timestamp - lastViolation.timestamp < 60000
    ) {
      // Extend existing violation
      lastViolation.duration = violation.timestamp - lastViolation.timestamp;
    } else {
      // New violation
      this.violations.push(violation);
    }
  }

  /**
   * Get latency violation severity
   */
  private getLatencySeverity(latency: number): "minor" | "major" | "critical" {
    if (latency < this.config.latency.p95 * 2) {
      return "minor";
    } else if (latency < this.config.latency.p99 * 2) {
      return "major";
    } else {
      return "critical";
    }
  }

  /**
   * Generate SLA report
   */
  generateReport(): SLAReport {
    const metrics = this.calculateMetrics();
    const summary = this.calculateSummary(metrics);
    const compliant = this.isCompliant(metrics, summary);
    const score = this.calculateSLAScore(metrics, summary);
    const recommendations = this.generateRecommendations(metrics, summary);

    return {
      compliant,
      score,
      metrics,
      violations: this.getActiveViolations(),
      recommendations,
      summary,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate SLA metrics from samples
   */
  private calculateMetrics(): SLAMetrics {
    if (this.samples.length === 0) {
      return this.getEmptyMetrics();
    }

    const latencies = this.samples.map(s => s.latency).sort((a, b) => a - b);
    const successes = this.samples.filter(s => s.success).length;

    const latency = this.calculateLatencyMetrics(latencies);
    const availability = successes / this.samples.length;
    const throughput = this.calculateThroughput();
    const errorRate = 1 - availability;

    return {
      latency,
      availability,
      throughput,
      errorRate,
      compliance: {
        latency_p50: latency.p50 <= this.config.latency.p50,
        latency_p95: latency.p95 <= this.config.latency.p95,
        latency_p99: latency.p99 <= this.config.latency.p99,
        availability: availability >= this.config.availability,
        throughput: throughput >= this.config.throughput,
        error_rate: errorRate <= this.config.errorRate,
      },
    };
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatencyMetrics(
    sortedLatencies: number[]
  ): SLALatencyMetrics {
    const len = sortedLatencies.length;

    return {
      p50: sortedLatencies[Math.floor(len * 0.5)] ?? 0,
      p95: sortedLatencies[Math.floor(len * 0.95)] ?? 0,
      p99: sortedLatencies[Math.floor(len * 0.99)] ?? 0,
      compliant: sortedLatencies[len - 1] <= this.config.latency.p99,
    };
  }

  /**
   * Calculate throughput
   */
  private calculateThroughput(): number {
    if (this.samples.length < 2) return 0;

    const timeSpan =
      this.samples[this.samples.length - 1].timestamp -
      this.samples[0].timestamp;

    return timeSpan > 0 ? (this.samples.length / timeSpan) * 1000 : 0;
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): SLAMetrics {
    return {
      latency: {
        p50: 0,
        p95: 0,
        p99: 0,
        compliant: true,
      },
      availability: 1,
      throughput: 0,
      errorRate: 0,
      compliance: {
        latency_p50: true,
        latency_p95: true,
        latency_p99: true,
        availability: true,
        throughput: true,
        error_rate: true,
      },
    };
  }

  /**
   * Calculate summary
   */
  private calculateSummary(metrics: SLAMetrics): SLASummary {
    const complianceEntries = Object.entries(metrics.compliance);
    const totalMetrics = complianceEntries.length;
    const passingMetrics = complianceEntries.filter(
      ([, value]) => value
    ).length;
    const failingMetrics = totalMetrics - passingMetrics;
    const overallCompliance = passingMetrics / totalMetrics;

    const worstViolation = this.getWorstViolation();

    return {
      totalMetrics,
      passingMetrics,
      failingMetrics,
      overallCompliance,
      worstViolation,
    };
  }

  /**
   * Get worst violation
   */
  private getWorstViolation(): SLAViolation | null {
    const activeViolations = this.getActiveViolations();

    if (activeViolations.length === 0) return null;

    // Prioritize by severity
    const severityOrder = { critical: 3, major: 2, minor: 1 };

    return activeViolations.reduce((worst, violation) => {
      const worstSeverity =
        severityOrder[worst.severity as keyof typeof severityOrder] ?? 0;
      const violationSeverity =
        severityOrder[violation.severity as keyof typeof severityOrder] ?? 0;

      return violationSeverity > worstSeverity ? violation : worst;
    });
  }

  /**
   * Get active violations
   */
  private getActiveViolations(): SLAViolation[] {
    const now = Date.now();

    return this.violations.filter(
      v => !v.resolved || (v.resolvedAt && now - v.resolvedAt < 300000)
    );
  }

  /**
   * Check if compliant
   */
  private isCompliant(metrics: SLAMetrics, summary: SLASummary): boolean {
    // Compliant if all metrics pass
    return summary.failingMetrics === 0;
  }

  /**
   * Calculate SLA score (0-100)
   */
  private calculateSLAScore(metrics: SLAMetrics, summary: SLASummary): number {
    // Base score from compliance percentage
    let score = summary.overallCompliance * 100;

    // Deduct for critical violations
    const criticalViolations = this.violations.filter(
      v => v.severity === "critical" && !v.resolved
    ).length;

    score -= criticalViolations * 10;

    // Deduct for major violations
    const majorViolations = this.violations.filter(
      v => v.severity === "major" && !v.resolved
    ).length;

    score -= majorViolations * 5;

    // Deduct for minor violations
    const minorViolations = this.violations.filter(
      v => v.severity === "minor" && !v.resolved
    ).length;

    score -= minorViolations * 2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    metrics: SLAMetrics,
    summary: SLASummary
  ): string[] {
    const recommendations: string[] = [];

    if (summary.overallCompliance === 1) {
      recommendations.push("EXCELLENT: All SLA metrics are within targets.");
      return recommendations;
    }

    // Latency recommendations
    if (!metrics.compliance.latency_p99) {
      recommendations.push(
        `P99 LATENCY: Current ${metrics.latency.p99.toFixed(0)}ms exceeds target ${this.config.latency.p99}ms`
      );
      recommendations.push("- Consider implementing caching");
      recommendations.push("- Optimize database queries");
      recommendations.push("- Review N+1 query problems");
    }

    if (!metrics.compliance.latency_p95) {
      recommendations.push(
        `P95 LATENCY: Current ${metrics.latency.p95.toFixed(0)}ms exceeds target ${this.config.latency.p95}ms`
      );
    }

    // Availability recommendations
    if (!metrics.compliance.availability) {
      recommendations.push(
        `AVAILABILITY: Current ${(metrics.availability * 100).toFixed(2)}% below target ${(this.config.availability * 100).toFixed(2)}%`
      );
      recommendations.push("- Review error handling");
      recommendations.push("- Implement retry logic with exponential backoff");
      recommendations.push("- Add health checks and circuit breakers");
    }

    // Throughput recommendations
    if (!metrics.compliance.throughput) {
      recommendations.push(
        `THROUGHPUT: Current ${metrics.throughput.toFixed(1)} req/s below target ${this.config.throughput} req/s`
      );
      recommendations.push("- Scale horizontally");
      recommendations.push("- Optimize request processing");
      recommendations.push("- Review bottlenecks");
    }

    // Error rate recommendations
    if (!metrics.compliance.error_rate) {
      recommendations.push(
        `ERROR RATE: Current ${(metrics.errorRate * 100).toFixed(2)}% exceeds target ${(this.config.errorRate * 100).toFixed(2)}%`
      );
      recommendations.push("- Review error logs");
      recommendations.push("- Fix common error paths");
      recommendations.push("- Improve input validation");
    }

    return recommendations;
  }

  /**
   * Update SLA config
   */
  updateConfig(config: Partial<SLAConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset reporter state
   */
  reset(): void {
    this.samples = [];
    this.violations = [];
    this.lastReportTime = 0;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): SLAMetrics {
    return this.calculateMetrics();
  }

  /**
   * Get all violations
   */
  getViolations(): SLAViolation[] {
    return [...this.violations];
  }
}
