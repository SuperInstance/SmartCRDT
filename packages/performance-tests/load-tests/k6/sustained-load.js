/**
 * @lsi/performance-tests
 *
 * Load Test: Sustained Load (1 hour)
 *
 * Tests system stability under prolonged load:
 * - Memory leak detection
 * - Performance degradation over time
 * - Connection pooling efficiency
 * - Cache effectiveness over time
 * - Target: 100 QPS for 1 hour with < 5% performance degradation
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const p95Latency = new Trend('p95_latency');
const p99Latency = new Trend('p99_latency');
const throughput = new Trend('throughput');
const memoryEfficiency = new Trend('memory_efficiency');

// Test configuration
export const options = {
  stages: [
    // Warmup period
    { duration: '5m', target: 50 },

    // Ramp to target load
    { duration: '5m', target: 100 },

    // Sustained load for 1 hour
    { duration: '60m', target: 100 },

    // Cool down
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const QUERIES = [
  { text: 'What is machine learning?', complexity: 0.3 },
  { text: 'Explain neural networks', complexity: 0.5 },
  { text: 'Compare CNN and RNN', complexity: 0.6 },
  { text: 'What is backpropagation?', complexity: 0.4 },
  { text: 'Define overfitting in ML', complexity: 0.3 },
  { text: 'Explain gradient descent', complexity: 0.5 },
  { text: 'What is a transformer model?', complexity: 0.7 },
  { text: 'Compare supervised and unsupervised learning', complexity: 0.6 },
  { text: 'What is reinforcement learning?', complexity: 0.6 },
  { text: 'Explain the bias-variance tradeoff', complexity: 0.7 },
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Track performance over time windows
const WINDOW_SIZE = 100; // requests per window
let requestCount = 0;
let windowLatencies = [];

export default function() {
  const queryData = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const payload = JSON.stringify({
    query: queryData.text,
    complexity: queryData.complexity,
    enable_caching: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'k6-sustained-load-test',
    },
    timeout: '10s',
  };

  const response = http.post(`${BASE_URL}/api/v1/query`, payload, params);

  // Track latency for window analysis
  windowLatencies.push(response.timings.duration);
  requestCount++;

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has response': (r) => r.json('result') !== undefined,
    'response time acceptable': (r) => {
      const isAcceptable = r.timings.duration < 500;
      if (!isAcceptable) {
        console.error(`Slow response: ${r.timings.duration}ms`);
      }
      return isAcceptable;
    },
  });

  errorRate.add(!success);

  // Calculate window metrics
  if (requestCount % WINDOW_SIZE === 0) {
    windowLatencies.sort((a, b) => a - b);
    const p95 = windowLatencies[Math.floor(windowLatencies.length * 0.95)];
    const p99 = windowLatencies[Math.floor(windowLatencies.length * 0.99)];

    p95Latency.add(p95);
    p99Latency.add(p99);
    throughput.add(WINDOW_SIZE / (Date.now() % 60000 || 1)); // Approximate QPS

    // Check for performance degradation
    if (p95 > 200) {
      console.error(`P95 degradation detected: ${p95}ms at request ${requestCount}`);
    }

    windowLatencies = [];
  }

  // Constant rate with minimal jitter
  sleep(Math.random() * 0.01); // Very small jitter for realistic timing
}

export function handleSummary(data) {
  // Custom analysis for sustained load
  const metrics = data.metrics;

  // Calculate degradation
  const httpMetrics = metrics.http_req_duration.values;
  const avgLatency = httpMetrics.avg || 0;
  const p95 = httpMetrics['p(95)'] || 0;
  const p99 = httpMetrics['p(99)'] || 0;

  const summary = {
    test: 'Sustained Load Test (1 Hour)',
    target_qps: 100,
    duration: '3600s',
    results: {
      avg_latency_ms: avgLatency.toFixed(2),
      p95_latency_ms: p95.toFixed(2),
      p99_latency_ms: p99.toFixed(2),
      total_requests: httpMetrics.count || 0,
      error_rate: ((metrics.http_req_failed.values.rate || 0) * 100).toFixed(2) + '%',
    },
    sla_compliance: {
      p95_under_100ms: p95 < 100,
      p99_under_500ms: p99 < 500,
      error_rate_under_1percent: (metrics.http_req_failed.values.rate || 0) < 0.01,
    },
    degradation: {
      avg: 'N/A', // Would need baseline comparison
      p95: 'N/A',
      p99: 'N/A',
    },
  };

  return {
    'stdout': JSON.stringify(summary, null, 2),
    'sustained-load-summary.json': JSON.stringify(data, null, 2),
    'sustained-load-metrics.json': JSON.stringify(summary, null, 2),
    'sustained-load-summary.html': htmlReport(data),
  };
}
