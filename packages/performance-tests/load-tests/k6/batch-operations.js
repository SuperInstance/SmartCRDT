/**
 * @lsi/performance-tests
 *
 * Load Test: Batch Operations
 *
 * Tests batch query processing:
 * - Multiple queries in single request
 * - Parallel processing
 * - Batch optimization
 * - Target: 10 batches/sec with 100 queries per batch
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const batchLatency = new Trend('batch_latency');
const queryPerSecond = new Trend('queries_per_second');
const batchEfficiency = new Trend('batch_efficiency');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 5 concurrent users
    { duration: '2m', target: 5 },

    // Sustain for 10 minutes
    { duration: '10m', target: 5 },

    // Spike to 10 concurrent users
    { duration: '2m', target: 10 },

    // Ramp down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Higher for batches
    http_req_failed: ['rate<0.01'],
  },
};

const BATCH_SIZES = [10, 25, 50, 100];

const QUERY_TEMPLATES = [
  'What is {topic}?',
  'Explain {concept}',
  'Compare {A} and {B}',
  'Analyze {subject}',
  'Define {term}',
];

const TOPICS = [
  'machine learning', 'blockchain', 'climate change', 'quantum computing',
  'neural networks', 'cryptography', 'bioinformatics', 'robotics',
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function generateBatch(size) {
  const queries = [];
  for (let i = 0; i < size; i++) {
    const template = QUERY_TEMPLATES[Math.floor(Math.random() * QUERY_TEMPLATES.length)];
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const query = template
      .replace('{topic}', topic)
      .replace('{concept}', topic)
      .replace('{subject}', topic)
      .replace('{term}', topic)
      .replace('{A}', TOPICS[Math.floor(Math.random() * TOPICS.length)])
      .replace('{B}', TOPICS[Math.floor(Math.random() * TOPICS.length)]);

    queries.push({ query, id: `q-${i}` });
  }
  return queries;
}

export default function() {
  const batchSize = BATCH_SIZES[Math.floor(Math.random() * BATCH_SIZES.length)];
  const queries = generateBatch(batchSize);

  const payload = JSON.stringify({
    queries,
    options: {
      parallel: true,
      optimize: true,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '60s',
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/v1/batch`, payload, params);
  const endTime = Date.now();
  const duration = endTime - startTime;

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has results': (r) => {
      const json = r.json();
      return json && json.results && Array.isArray(json.results) && json.results.length === batchSize;
    },
    'all queries succeeded': (r) => {
      const results = r.json('results');
      return results && results.every((r) => r.status === 'success');
    },
    'batch efficiency > 0.5': (r) => {
      const timePerQuery = duration / batchSize;
      const sequentialTime = 100 * batchSize; // Assume 100ms per query sequentially
      return timePerQuery < sequentialTime * 0.5; // At least 2x speedup
    },
  });

  // Record metrics
  errorRate.add(!success);
  batchLatency.add(duration);
  queryPerSecond.add((batchSize / duration) * 1000);

  // Calculate batch efficiency (speedup over sequential)
  const sequentialTime = 100 * batchSize;
  const efficiency = sequentialTime / duration;
  batchEfficiency.add(efficiency);

  sleep(Math.random() * 1 + 0.5); // 500-1500ms between batches
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'batch-operations-summary.json': JSON.stringify(data, null, 2),
    'batch-operations-summary.html': htmlReport(data),
  };
}
