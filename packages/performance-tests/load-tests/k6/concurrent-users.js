/**
 * @lsi/performance-tests
 *
 * Load Test: Concurrent Users (10, 100, 1000)
 *
 * Tests system behavior under realistic concurrent load:
 * - Simulates real user behavior
 * - Mix of simple and complex queries
 * - Cache warmup and hit patterns
 * - Session management
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const userThinkTime = new Trend('think_time');
const sessionDuration = new Trend('session_duration');
const queriesPerSession = new Counter('queries_per_session');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: 10 concurrent users (baseline)
    low_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      gracefulStop: '30s',
      startTime: '0s',
    },

    // Scenario 2: 100 concurrent users (moderate load)
    moderate_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '10m',
      gracefulStop: '30s',
      startTime: '5m',
    },

    // Scenario 3: 1000 concurrent users (stress test)
    high_load: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '3m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '1m',
      startTime: '15m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const QUERY_MIX = {
  simple: [
    'What is the capital of France?',
    'Calculate 15 + 27',
    'Who wrote Hamlet?',
    'What is the square root of 144?',
    'Define gravity',
  ],
  medium: [
    'Explain the process of photosynthesis in plants',
    'Compare democracy and authoritarianism',
    'What are the main causes of climate change?',
    'Analyze the themes in Romeo and Juliet',
    'Explain how blockchain technology works',
  ],
  complex: [
    'Analyze the impact of artificial intelligence on the future of work, considering both economic and social dimensions',
    'Compare and contrast different approaches to solving climate change, evaluating their effectiveness and feasibility',
    'Explain the relationship between quantum mechanics and general relativity, and why unifying them is challenging',
  ],
};

const QUERY_DISTRIBUTION = {
  simple: 0.6,    // 60% simple queries
  medium: 0.3,    // 30% medium queries
  complex: 0.1,   // 10% complex queries
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function selectQuery() {
  const rand = Math.random();
  let category;

  if (rand < QUERY_DISTRIBUTION.simple) {
    category = 'simple';
  } else if (rand < QUERY_DISTRIBUTION.simple + QUERY_DISTRIBUTION.medium) {
    category = 'medium';
  } else {
    category = 'complex';
  }

  const queries = QUERY_MIX[category];
  return {
    query: queries[Math.floor(Math.random() * queries.length)],
    category,
  };
}

export default function() {
  const sessionStart = Date.now();
  let queryCount = 0;

  // Simulate user session: 10-30 queries with think time
  const targetQueries = Math.floor(Math.random() * 20) + 10;

  while (queryCount < targetQueries) {
    const { query, category } = selectQuery();

    const payload = JSON.stringify({
      query,
      session_id: `user-${__VU}-session-${__ITER}`,
      category,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: category === 'complex' ? '30s' : '10s',
    };

    const response = http.post(`${BASE_URL}/api/v1/query`, payload, params);

    // Check response
    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'has response': (r) => r.json('result') !== undefined,
    });

    errorRate.add(!success);

    queryCount++;
    queriesPerSession.add(1);

    // Realistic think time between queries
    const thinkTime = Math.random() * 2 + 1; // 1-3 seconds
    userThinkTime.add(thinkTime);
    sleep(thinkTime);

    // 10% chance to end session early
    if (Math.random() < 0.1) {
      break;
    }
  }

  const sessionDuration_ms = Date.now() - sessionStart;
  sessionDuration.add(sessionDuration_ms / 1000); // Convert to seconds
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'concurrent-users-summary.json': JSON.stringify(data, null, 2),
    'concurrent-users-summary.html': htmlReport(data),
  };
}
