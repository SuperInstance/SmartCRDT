/**
 * @lsi/performance-tests
 *
 * Load Test: Complex Queries (50 QPS target)
 *
 * Tests complex query processing:
 * - High complexity queries (> 0.7)
 * - Multi-hop reasoning
 * - Cloud model escalation
 * - Target: 50 QPS with P95 < 500ms
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const latencyTrend = new Trend('latency');
const cloudEscalationRate = new Rate('cloud_escalations');
const complexityScore = new Trend('complexity_score');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 50 QPS over 2 minutes
    { duration: '1m', target: 25 },
    { duration: '1m', target: 50 },

    // Sustain 50 QPS for 5 minutes
    { duration: '5m', target: 50 },

    // Spike to 100 QPS for 1 minute
    { duration: '1m', target: 100 },

    // Back to 50 QPS
    { duration: '1m', target: 50 },

    // Ramp down
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // Higher tolerance for complex queries
    http_req_failed: ['rate<0.02'], // < 2% error rate
    errors: ['rate<0.02'],
  },
};

// Complex query templates
const COMPLEX_QUERIES = [
  {
    query: 'Analyze the economic impact of climate change on agricultural productivity in Sub-Saharan Africa over the next two decades, considering both mitigation and adaptation strategies.',
    complexity: 0.85,
  },
  {
    query: 'Compare and contrast the philosophical approaches to ethics in Kantian deontology, Utilitarian consequentialism, and Aristotelian virtue ethics, providing specific examples for each.',
    complexity: 0.82,
  },
  {
    query: 'Explain the quantum mechanical principles behind superposition and entanglement, then discuss how these phenomena are utilized in quantum computing algorithms such as Shor\'s algorithm.',
    complexity: 0.88,
  },
  {
    query: 'Evaluate the effectiveness of different monetary policy tools used by central banks during economic recessions, with specific case studies from the 2008 financial crisis and the COVID-19 pandemic.',
    complexity: 0.80,
  },
  {
    query: 'Analyze the security implications of implementing homomorphic encryption in cloud computing environments, including performance trade-offs and potential attack vectors.',
    complexity: 0.86,
  },
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  const queryData = COMPLEX_QUERIES[Math.floor(Math.random() * COMPLEX_QUERIES.length)];

  const payload = JSON.stringify({
    query: queryData.query,
    complexity: queryData.complexity,
    cache: false, // Complex queries often not cached
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '30s', // Longer timeout for complex queries
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/v1/query`, payload, params);
  const endTime = Date.now();

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has response': (r) => r.json('result') !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has reasoning': (r) => r.json('reasoning') !== undefined,
    'used cloud model': (r) => r.json('model') !== undefined && r.json('model').includes('cloud'),
  });

  // Record metrics
  errorRate.add(!success);
  latencyTrend.add(response.timings.duration);
  cloudEscalationRate.add(response.json('model')?.includes('cloud') || false);
  complexityScore.add(queryData.complexity);

  // Think time proportional to query complexity
  sleep(Math.random() * 0.5 + 0.3); // 300-800ms
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'complex-queries-summary.json': JSON.stringify(data, null, 2),
    'complex-queries-summary.html': htmlReport(data),
  };
}
