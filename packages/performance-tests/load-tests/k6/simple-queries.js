/**
 * @lsi/performance-tests
 *
 * Load Test: Simple Queries (100 QPS target)
 *
 * Tests high-volume simple query processing:
 * - Low complexity queries (< 0.5)
 * - Cacheable responses
 * - Fast local model inference
 * - Target: 100 QPS with P95 < 100ms
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const latencyTrend = new Trend('latency');
const cacheHitRate = new Rate('cache_hits');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 100 QPS over 2 minutes
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },

    // Sustain 100 QPS for 5 minutes
    { duration: '5m', target: 100 },

    // Ramp down
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<500'], // SLA requirements
    http_req_failed: ['rate<0.01'], // < 1% error rate
    errors: ['rate<0.01'],
  },
};

// Simple query templates
const SIMPLE_QUERIES = [
  'What is the capital of France?',
  'Calculate 2 + 2',
  'Who wrote Romeo and Juliet?',
  'What is the boiling point of water?',
  'Define photosynthesis',
  'When did World War II end?',
  'What is the largest planet in our solar system?',
  'Who painted the Mona Lisa?',
  'What is the speed of light?',
  'What is the formula for kinetic energy?',
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  const query = SIMPLE_QUERIES[Math.floor(Math.random() * SIMPLE_QUERIES.length)];

  const payload = JSON.stringify({
    query,
    complexity: 0.3, // Low complexity
    cache: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '10s',
  };

  const response = http.post(`${BASE_URL}/api/v1/query`, payload, params);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has response': (r) => r.json('result') !== undefined,
    'response time < 100ms': (r) => r.timings.duration < 100,
    'cache hit': (r) => r.json('cached') === true,
  });

  // Record metrics
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  cacheHitRate.add(response.json('cached') === true);

  // Small think time between requests
  sleep(Math.random() * 0.1 + 0.05); // 50-150ms
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'simple-queries-summary.json': JSON.stringify(data, null, 2),
    'simple-queries-summary.html': htmlReport(data),
  };
}
