/**
 * @lsi/performance-tests
 *
 * Load Test: Stress Test (Breaking Point)
 *
 * Tests system limits and failure modes:
 * - Gradual ramp until failure
 * - Identify breaking point
 * - Test graceful degradation
 * - Measure recovery time
 * - Target: Find maximum sustainable QPS
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const latencyTrend = new Trend('latency');
const timeoutRate = new Rate('timeouts');
const successRate = new Rate('successes');
const systemLoad = new Trend('system_load');

// Test configuration
export const options = {
  stages: [
    // Start low
    { duration: '2m', target: 50 },

    // Ramp up aggressively
    { duration: '2m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },

    // Push to breaking point
    { duration: '2m', target: 5000 },

    // Hold at breaking point
    { duration: '5m', target: 5000 },

    // Recovery test - sudden drop
    { duration: '1m', target: 100 },

    // Ramp down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // Relaxed thresholds - we're testing to failure
    http_req_duration: ['p(95)<5000'], // Allow 5s at extreme load
  },
  noConnectionReuse: false, // Enable connection pooling
  userAgent: 'k6-stress-test',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const QUERIES = [
  'What is the capital of France?',
  'Explain quantum computing',
  'Calculate the derivative of x^2',
  'Compare Python and JavaScript',
  'What is machine learning?',
];

// Track breaking point
let breakingPoint = null;
let lastSuccessRate = 1.0;

export default function() {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const payload = JSON.stringify({
    query,
    stress_test: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '30s', // Longer timeout for stress conditions
  };

  const response = http.post(`${BASE_URL}/api/v1/query`, payload, params);

  // Check for various failure modes
  const isTimeout = response.timings.duration >= 30000;
  const isError = response.status >= 400 || response.status === 0;
  const isSlow = response.timings.duration > 5000;

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'not timeout': (r) => r.timings.duration < 30000,
    'not too slow': (r) => r.timings.duration < 10000,
    'has response': (r) => r.status === 200 ? (r.json('result') !== undefined) : true,
  });

  // Record metrics
  errorRate.add(!success);
  timeoutRate.add(isTimeout);
  successRate.add(success && !isSlow);
  latencyTrend.add(response.timings.duration);

  // Track breaking point (success rate drops below 50%)
  const currentVUs = __VU;
  const currentSuccessRate = success && !isSlow ? 1 : 0;

  if (lastSuccessRate >= 0.5 && currentSuccessRate < 0.5 && !breakingPoint) {
    breakingPoint = currentVUs;
    console.error(`BREAKING POINT DETECTED at ${currentVUs} VUs`);
  }

  lastSuccessRate = lastSuccessRate * 0.99 + currentSuccessRate * 0.01; // Moving average

  // Minimal sleep to maximize load
  sleep(0.01);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const httpMetrics = metrics.http_req_duration.values;
  const errorRate = metrics.http_req_failed.values.rate || 0;

  const summary = {
    test: 'Stress Test (Breaking Point Analysis)',
    breaking_point: {
      vus: breakingPoint || 'Not reached',
      qps: breakingPoint ? breakingPoint * 2 : 'N/A', // Approximate
    },
    performance_at_peak: {
      avg_latency_ms: (httpMetrics.avg || 0).toFixed(2),
      p95_latency_ms: (httpMetrics['p(95)'] || 0).toFixed(2),
      p99_latency_ms: (httpMetrics['p(99)'] || 0).toFixed(2),
      max_latency_ms: (httpMetrics.max || 0).toFixed(2),
    },
    failure_modes: {
      timeout_rate: (metrics.timeouts?.values.rate || 0).toFixed(4),
      error_rate: (errorRate * 100).toFixed(2) + '%',
      total_requests: httpMetrics.count || 0,
      failed_requests: metrics.http_req_failed.values.pass || 0,
    },
    recommendations: [],
  };

  // Generate recommendations
  if (errorRate > 0.1) {
    summary.recommendations.push('High error rate detected - consider scaling infrastructure');
  }

  if ((httpMetrics['p(95)'] || 0) > 1000) {
    summary.recommendations.push('P95 latency > 1s at peak - optimize hot paths');
  }

  if ((httpMetrics['p(99)'] || 0) > 5000) {
    summary.recommendations.push('P99 latency > 5s at peak - implement better queuing');
  }

  if (!breakingPoint) {
    summary.recommendations.push('Breaking point not reached - consider higher load testing');
  }

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'stress-test-summary.json': JSON.stringify(data, null, 2),
    'stress-test-report.json': JSON.stringify(summary, null, 2),
    'stress-test-summary.html': htmlReport(data),
  };
}
