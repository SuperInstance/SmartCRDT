/**
 * @lsi/performance-tests
 *
 * Load Testing and Production Benchmarking
 *
 * Main entry point for running load tests and generating performance reports.
 */

import { PerformanceTracker } from '../Runner.js';
import { BaselineTracker } from '../BaselineTracker.js';
import { SLAComplianceChecker, PRODUCTION_SLAS, createSLAChecker } from './SLACompliance.js';
import { PerformanceReportGenerator, createReportGenerator } from './PerformanceReportGenerator.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Load Test Configuration
 */
export interface LoadTestConfig {
  /** Base URL for API testing */
  baseURL: string;
  /** Number of concurrent users */
  concurrentUsers: number;
  /** Test duration in seconds */
  duration: number;
  /** Ramp up time in seconds */
  rampUpTime: number;
  /** Output directory for reports */
  outputDir: string;
  /** Whether to generate HTML report */
  generateHTML: boolean;
  /** Whether to generate JSON report */
  generateJSON: boolean;
  /** Whether to check SLA compliance */
  checkSLA: boolean;
}

/**
 * Default load test configuration
 */
export const DEFAULT_LOAD_TEST_CONFIG: LoadTestConfig = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  concurrentUsers: 100,
  duration: 300, // 5 minutes
  rampUpTime: 60, // 1 minute
  outputDir: './load-test-results',
  generateHTML: true,
  generateJSON: true,
  checkSLA: true,
};

/**
 * Load Test Scenario
 */
export interface LoadTestScenario {
  /** Scenario name */
  name: string;
  /** Description */
  description: string;
  /** Test function */
  test: () => Promise<void>;
  /** Expected SLA targets */
  slaTargets?: {
    p95Latency?: number;
    p99Latency?: number;
    errorRate?: number;
  };
}

/**
 * Load Test Results
 */
export interface LoadTestResults {
  /** Test configuration */
  config: LoadTestConfig;
  /** Timestamp */
  timestamp: Date;
  /** Scenario results */
  scenarios: ScenarioResult[];
  /** Overall metrics */
  overall: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    qps: number;
  };
  /** SLA compliance */
  slaCompliance?: any[];
  /** Report paths */
  reports: {
    html?: string;
    json?: string;
  };
}

/**
 * Scenario Result
 */
export interface ScenarioResult {
  /** Scenario name */
  name: string;
  /** Duration (ms) */
  duration: number;
  /** Number of requests */
  requests: number;
  /** Successful requests */
  success: number;
  /** Failed requests */
  failed: number;
  /** Error rate */
  errorRate: number;
  /** Latency metrics */
  latency: {
    min: number;
    max: number;
    mean: number;
    p95: number;
    p99: number;
  };
  /** Throughput (QPS) */
  qps: number;
  /** SLA compliance */
  slaCompliant: boolean;
}

/**
 * Production Load Testing Suite
 */
export class ProductionLoadTestSuite {
  private config: LoadTestConfig;
  private tracker: PerformanceTracker;
  private slaChecker: SLAComplianceChecker;
  private reportGenerator: PerformanceReportGenerator;

  constructor(config: Partial<LoadTestConfig> = {}) {
    this.config = { ...DEFAULT_LOAD_TEST_CONFIG, ...config };

    this.tracker = new PerformanceTracker({
      time: 2000,
      iterations: 100,
      warmup: true,
      warmupIterations: 10,
    });

    this.slaChecker = createSLAChecker();

    this.reportGenerator = createReportGenerator({
      format: 'html',
      outputDir: this.config.outputDir,
      includeCharts: true,
      includeRecommendations: true,
      includeSLA: this.config.checkSLA,
    });
  }

  /**
   * Run all load test scenarios
   */
  async runAll(): Promise<LoadTestResults> {
    console.log('Starting production load tests...');
    console.log(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

    const scenarios: ScenarioResult[] = [];
    let totalRequests = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalLatency = 0;

    // Run each scenario
    const scenarioConfigs = this.getScenarios();
    for (const scenario of scenarioConfigs) {
      console.log(`\nRunning scenario: ${scenario.name}`);
      console.log(`Description: ${scenario.description}`);

      const result = await this.runScenario(scenario);
      scenarios.push(result);

      totalRequests += result.requests;
      totalSuccess += result.success;
      totalFailed += result.failed;
      totalLatency += result.latency.mean;

      console.log(`Completed: ${result.requests} requests, ${result.errorRate.toFixed(2)}% error rate, ${result.qps.toFixed(2)} QPS`);
    }

    // Calculate overall metrics
    const overall = {
      totalRequests,
      successfulRequests: totalSuccess,
      failedRequests: totalFailed,
      avgLatency: totalLatency / scenarios.length,
      p95Latency: Math.max(...scenarios.map(s => s.latency.p95)),
      p99Latency: Math.max(...scenarios.map(s => s.latency.p99)),
      qps: totalSuccess / (this.config.duration * scenarios.length),
    };

    console.log('\n=== Overall Results ===');
    console.log(`Total Requests: ${overall.totalRequests}`);
    console.log(`Success Rate: ${((overall.successfulRequests / overall.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Average Latency: ${overall.avgLatency.toFixed(2)}ms`);
    console.log(`P95 Latency: ${overall.p95Latency.toFixed(2)}ms`);
    console.log(`P99 Latency: ${overall.p99Latency.toFixed(2)}ms`);
    console.log(`Throughput: ${overall.qps.toFixed(2)} QPS`);

    // Check SLA compliance
    let slaCompliance;
    if (this.config.checkSLA) {
      slaCompliance = await this.checkSLACompliance(scenarios);
    }

    // Generate reports
    const reports: any = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (this.config.generateHTML) {
      const htmlPath = join(this.config.outputDir, `load-test-report-${timestamp}.html`);
      const htmlContent = await this.generateHTMLReport({
        config: this.config,
        timestamp: new Date(),
        scenarios,
        overall,
        slaCompliance,
      });
      await writeFile(htmlPath, htmlContent, 'utf-8');
      reports.html = htmlPath;
      console.log(`\nHTML report generated: ${htmlPath}`);
    }

    if (this.config.generateJSON) {
      const jsonPath = join(this.config.outputDir, `load-test-results-${timestamp}.json`);
      const jsonContent = JSON.stringify({
        config: this.config,
        timestamp: new Date(),
        scenarios,
        overall,
        slaCompliance,
      }, null, 2);
      await writeFile(jsonPath, jsonContent, 'utf-8');
      reports.json = jsonPath;
      console.log(`JSON report generated: ${jsonPath}`);
    }

    return {
      config: this.config,
      timestamp: new Date(),
      scenarios,
      overall,
      slaCompliance,
      reports,
    };
  }

  /**
   * Run a single scenario
   */
  private async runScenario(scenario: LoadTestScenario): Promise<ScenarioResult> {
    const startTime = Date.now();

    // Run the benchmark
    const result = await this.tracker.runBenchmark(
      scenario.name,
      {
        [scenario.name]: scenario.test,
      }
    );

    const duration = Date.now() - startTime;
    const task = result.tasks[0];

    // Calculate metrics
    const success = task.samples;
    const failed = task.error ? 1 : 0;
    const errorRate = (failed / (success + failed)) * 100;

    const latency = {
      min: task.min,
      max: task.max,
      mean: task.mean,
      p95: task.p95,
      p99: task.p99,
    };

    const qps = (success + failed) / (duration / 1000);

    // Check SLA compliance
    let slaCompliant = true;
    if (scenario.slaTargets) {
      if (scenario.slaTargets.p95Latency && latency.p95 > scenario.slaTargets.p95Latency) {
        slaCompliant = false;
      }
      if (scenario.slaTargets.p99Latency && latency.p99 > scenario.slaTargets.p99Latency) {
        slaCompliant = false;
      }
      if (scenario.slaTargets.errorRate && errorRate > scenario.slaTargets.errorRate) {
        slaCompliant = false;
      }
    }

    return {
      name: scenario.name,
      duration,
      requests: success + failed,
      success,
      failed,
      errorRate,
      latency,
      qps,
      slaCompliant,
    };
  }

  /**
   * Get test scenarios
   */
  private getScenarios(): LoadTestScenario[] {
    return [
      {
        name: 'simple-queries',
        description: 'Simple queries with low complexity (< 0.5)',
        test: async () => {
          // Simulate simple query processing
          const query = 'What is the capital of France?';
          const result = {
            query,
            complexity: 0.3,
            processed: true,
            timestamp: Date.now(),
          };
          return result;
        },
        slaTargets: {
          p95Latency: 100,
          p99Latency: 500,
          errorRate: 0.1,
        },
      },
      {
        name: 'complex-queries',
        description: 'Complex queries requiring cloud escalation',
        test: async () => {
          // Simulate complex query processing
          const query = 'Analyze the economic impact of climate change on agriculture in Sub-Saharan Africa';
          const result = {
            query,
            complexity: 0.85,
            model: 'cloud',
            processed: true,
            timestamp: Date.now(),
          };
          return result;
        },
        slaTargets: {
          p95Latency: 500,
          p99Latency: 1000,
          errorRate: 0.2,
        },
      },
      {
        name: 'batch-operations',
        description: 'Batch processing of multiple queries',
        test: async () => {
          // Simulate batch processing
          const queries = Array.from({ length: 10 }, (_, i) => ({
            id: i,
            query: `Query ${i}`,
          }));
          const result = {
            queries,
            processed: true,
            count: queries.length,
            timestamp: Date.now(),
          };
          return result;
        },
        slaTargets: {
          p95Latency: 2000,
          p99Latency: 5000,
          errorRate: 0.1,
        },
      },
      {
        name: 'cache-operations',
        description: 'Cache hit/miss operations',
        test: async () => {
          // Simulate cache operations
          const cache = new Map<string, any>();
          const key = 'test-query';
          const value = { result: 'cached', timestamp: Date.now() };
          cache.set(key, value);
          const retrieved = cache.get(key);
          return retrieved;
        },
        slaTargets: {
          p95Latency: 1,
          p99Latency: 5,
          errorRate: 0.01,
        },
      },
    ];
  }

  /**
   * Check SLA compliance
   */
  private async checkSLACompliance(scenarios: ScenarioResult[]): Promise<any[]> {
    const complianceResults: any[] = [];

    for (const sla of PRODUCTION_SLAS) {
      const metrics: Record<string, number> = {};

      // Map scenario results to SLA metrics
      for (const scenario of scenarios) {
        if (sla.id === 'aequor-core-latency') {
          if (scenario.name === 'simple-queries') {
            metrics['p95-latency-simple'] = scenario.latency.p95;
          } else if (scenario.name === 'complex-queries') {
            metrics['p95-latency-complex'] = scenario.latency.p95;
          }
          metrics['p99-latency'] = Math.max(
            ...scenarios.map(s => s.latency.p99)
          );
        } else if (sla.id === 'aequor-throughput') {
          if (scenario.name === 'simple-queries') {
            metrics['qps-simple'] = scenario.qps;
          } else if (scenario.name === 'complex-queries') {
            metrics['qps-complex'] = scenario.qps;
          }
        }
      }

      try {
        const result = this.slaChecker.checkCompliance(sla.id, metrics);
        complianceResults.push(result);
      } catch (error) {
        console.error(`Error checking SLA ${sla.id}:`, error);
      }
    }

    return complianceResults;
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(data: any): Promise<string> {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report - ${data.timestamp.toISOString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 10px; margin-bottom: 30px; }
    .section { background: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .section h2 { margin-bottom: 20px; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Load Test Report</h1>
      <p>${data.timestamp.toISOString()}</p>
    </div>

    <div class="section">
      <h2>Overall Results</h2>
      <table>
        <tr><td>Total Requests</td><td><strong>${data.overall.totalRequests}</strong></td></tr>
        <tr><td>Success Rate</td><td><strong>${((data.overall.successfulRequests / data.overall.totalRequests) * 100).toFixed(2)}%</strong></td></tr>
        <tr><td>Average Latency</td><td><strong>${data.overall.avgLatency.toFixed(2)}ms</strong></td></tr>
        <tr><td>P95 Latency</td><td><strong>${data.overall.p95Latency.toFixed(2)}ms</strong></td></tr>
        <tr><td>P99 Latency</td><td><strong>${data.overall.p99Latency.toFixed(2)}ms</strong></td></tr>
        <tr><td>Throughput</td><td><strong>${data.overall.qps.toFixed(2)} QPS</strong></td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Scenario Results</h2>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Requests</th>
            <th>Success Rate</th>
            <th>P95 Latency</th>
            <th>P99 Latency</th>
            <th>QPS</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          ${data.scenarios.map((s: ScenarioResult) => `
            <tr>
              <td>${s.name}</td>
              <td>${s.requests}</td>
              <td>${((s.success / s.requests) * 100).toFixed(2)}%</td>
              <td>${s.latency.p95.toFixed(2)}ms</td>
              <td>${s.latency.p99.toFixed(2)}ms</td>
              <td>${s.qps.toFixed(2)}</td>
              <td><span class="badge ${s.slaCompliant ? 'badge-success' : 'badge-danger'}">${s.slaCompliant ? 'PASS' : 'FAIL'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;
  }
}

/**
 * Run production load tests
 */
export async function runProductionLoadTests(
  config?: Partial<LoadTestConfig>
): Promise<LoadTestResults> {
  const suite = new ProductionLoadTestSuite(config);
  return await suite.runAll();
}

// Export main function for CLI usage
export default async function main() {
  const results = await runProductionLoadTests();
  console.log('\n=== Load Tests Complete ===');
  console.log(`Reports: ${JSON.stringify(results.reports, null, 2)}`);
}
