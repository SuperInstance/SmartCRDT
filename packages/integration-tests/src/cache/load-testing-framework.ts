/**
 * Load Testing Framework for Semantic Cache
 *
 * Provides comprehensive load testing capabilities:
 * - Configurable QPS (queries per second)
 * - Concurrent user simulation
 * - Sustained load testing
 * - Ramp-up/load ramp patterns
 * - Real-time monitoring
 * - Performance metrics collection
 *
 * @packageDocumentation
 */

import { SemanticCache } from "@lsi/cascade";
import type { RefinedQuery, QueryType } from "@lsi/cascade";

// ============================================================================
// Type Definitions
// ============================================================================

export interface LoadTestConfig {
  /** Number of concurrent users to simulate */
  concurrentUsers: number;
  /** Queries per second target */
  qps: number;
  /** Total duration of test (seconds) */
  duration: number;
  /** Ratio of unique to repeated queries (0-1) */
  uniqueQueryRatio: number;
  /** Query types to test */
  queryTypes: QueryType[];
  /** Whether to warm cache before test */
  warmCache: boolean;
  /** Cache size */
  cacheSize: number;
  /** Similarity threshold */
  similarityThreshold: number;
}

export interface LoadTestMetrics {
  /** Total queries executed */
  totalQueries: number;
  /** Successful queries */
  successfulQueries: number;
  /** Failed queries */
  failedQueries: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Overall hit rate */
  hitRate: number;
  /** Latency percentiles (ms) */
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  /** Throughput (queries per second) */
  throughput: number;
  /** Error rate */
  errorRate: number;
  /** Per-user metrics */
  perUserMetrics: Array<{
    userId: number;
    queries: number;
    avgLatency: number;
    hitRate: number;
  }>;
}

export interface LoadTestResult {
  config: LoadTestConfig;
  metrics: LoadTestMetrics;
  duration: number;
  passed: boolean;
  timestamp: number;
}

export interface RealTimeMetrics {
  timestamp: number;
  qps: number;
  avgLatency: number;
  hitRate: number;
  activeUsers: number;
}

// ============================================================================
// Query Generation
// ============================================================================

const QUERY_TEMPLATES = {
  code: [
    "How do I implement {concept} in {language}?",
    "Write a function to {action}",
    "What's the difference between {a} and {b}?",
    "How to use {feature} in {language}?",
    "Create a generic type for {concept}",
    "Implement {dataStructure} in {language}",
    "How to type {component}?",
    "What is a {concept}?",
    "How do I use {feature}?",
    "Explain {concept} in {language}"
  ],
  explanation: [
    "Explain how {concept} works",
    "What is the difference between {a} and {b}?",
    "How does {concept} {action}?",
    "What is {concept}?",
    "Explain the concept of {concept}",
    "What is {concept}?",
    "How do {entities} work?",
    "Explain {concept} {modifier}",
    "What is the purpose of {concept}?",
    "How does {concept} affect {outcome}?"
  ],
  question: [
    "What is the {attribute} of {subject}?",
    "How many {items} are in {collection}?",
    "Who {action} {object}?",
    "What is the {attribute} of {subject}?",
    "When was {event}?",
    "What is the {superlative} {subject}?",
    "Who {action} the {object}?",
    "What is the {property} of {subject}?",
    "What is {concept}?",
    "Who was the {role} to {action}?"
  ],
  debug: [
    "Why is my {component} not {action}?",
    "How to fix {error} in {language}?",
    "Debug {component} not {action}",
    "Why is my {resource} {state}?",
    "How to find {issue} in {context}?",
    "Fix {error} in {situation}",
    "Why is my {component} {state}?",
    "Debug {component} not {action}",
    "How to fix {error}?",
    "Why is my {test} {state}?"
  ],
  comparison: [
    "What is the difference between {a} and {b}?",
    "Compare {a} vs {b}",
    "{a} vs {b} differences",
    "REST vs GraphQL comparison",
    "{a} vs {b}",
    "{a} vs {b} comparison",
    "{a} vs {b} vs {c}",
    "{approach1} vs {approach2}",
    "{technology1} vs {technology2} differences",
    "{strategy1} vs {strategy2}"
  ]
};

const VOCABULARY = {
  concept: ["binary search", "sorting", "recursion", "async/await", "generics", "interfaces", "classes", "promises", "closures", "decorators"],
  language: ["TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#", "Swift", "Kotlin"],
  action: ["sort data", "search array", "parse JSON", "make requests", "handle errors", "validate input", "transform data", "filter results", "aggregate data", "join tables"],
  feature: ["async/await", "generics", "decorators", "interfaces", "types", "modules", "classes", "namespaces", "mixins", "traits"],
  a: ["let", "const", "var", "interface", "type", "class", "enum", "abstract", "static", "public"],
  b: ["let", "const", "var", "interface", "type", "class", "enum", "abstract", "static", "private"],
  dataStructure: ["linked list", "tree", "graph", "hash map", "stack", "queue", "heap", "trie", "set", "array"],
  component: ["code", "function", "class", "module", "api", "test", "component", "service", "hook", "middleware"],
  subject: ["France", "solar system", "Romeo and Juliet", "water", "World War II", "Pacific Ocean", "telephone", "light", "photosynthesis", "moon"],
  attribute: ["capital", "size", "author", "boiling point", "end date", "area", "inventor", "speed", "process", "first visitor"],
  items: ["planets", "states", "countries", "elements", "colors", "continents", "oceans", "mountains", "rivers", "lakes"],
  collection: ["solar system", "periodic table", "alphabet", "unicode", "ASCII", "world", "universe", "galaxy", "library", "database"],
  object: ["Romeo and Juliet", "telephone", "light bulb", "airplane", "telephone", "penicillin", "printing press", "steam engine", "computer", "internet"],
  event: ["World War II", "moon landing", "invention", "discovery", "revolution", "war", "treaty", "election", "olympics", "conference"],
  superlative: ["largest", "smallest", "fastest", "slowest", "highest", "lowest", "oldest", "newest", "best", "worst"],
  error: ["TypeError", "ReferenceError", "SyntaxError", "NetworkError", "AsyncError", "Promise rejection", "null reference", "undefined", "overflow", "underflow"],
  situation: ["production", "development", "testing", "staging", "browser", "server", "mobile", "desktop", "CI/CD", "deployment"],
  resource: ["code", "server", "database", "API", "cache", "memory", "disk", "network", "CPU", "GPU"],
  state: ["working", "failing", "slow", "crashing", "hanging", "leaking", "blocked", "timeout", "overflow", "underflow"],
  issue: ["memory leaks", "performance", "bugs", "errors", "bottlenecks", "race conditions", "deadlocks", "exceptions", "failures", "timeouts"],
  context: ["Node.js", "browser", "React", "Angular", "Vue", "server", "client", "database", "API", "microservice"],
  test: ["unit test", "integration test", "e2e test", "performance test", "load test", "security test", "acceptance test", "smoke test", "regression test", "mutation test"],
  entities: ["neural networks", "models", "algorithms", "classifiers", "regressors", "transformers", "encoders", "decoders", "agents", "environments"],
  modifier: ["in detail", "simply", "with examples", "step by step", "for beginners", "in practice", "from scratch", "in depth", "in production", "at scale"],
  outcome: ["performance", "accuracy", "speed", "quality", "reliability", "scalability", "efficiency", "security", "usability", "maintainability"],
  role: ["person", "team", "company", "country", "organization", "group", "individual", "leader", "pioneer", "inventor"]
};

/**
 * Generate a query from template
 */
function generateQueryFromTemplate(template: string, type: QueryType): string {
  let query = template;

  // Replace placeholders
  const placeholders = query.match(/\{(\w+)\}/g);
  if (placeholders) {
    for (const placeholder of placeholders) {
      const key = placeholder.slice(1, -1) as keyof typeof VOCABULARY;
      const options = VOCABULARY[key] || VOCABULARY.concept;
      const value = options[Math.floor(Math.random() * options.length)];
      query = query.replace(placeholder, value);
    }
  }

  return query;
}

/**
 * Generate query set for load testing
 */
export function generateLoadTestQueries(
  count: number,
  uniqueRatio: number,
  queryTypes: QueryType[]
): string[] {
  const uniqueCount = Math.floor(count * uniqueRatio);
  const repeatCount = count - uniqueCount;
  const queries: string[] = [];

  // Generate unique queries
  for (let i = 0; i < uniqueCount; i++) {
    const type = queryTypes[i % queryTypes.length];
    const templates = QUERY_TEMPLATES[type] || QUERY_TEMPLATES.question;
    const template = templates[i % templates.length];
    const query = generateQueryFromTemplate(template, type);
    queries.push(query);
  }

  // Generate repeated queries
  for (let i = 0; i < repeatCount; i++) {
    const randomIndex = Math.floor(Math.random() * uniqueCount);
    queries.push(queries[randomIndex]);
  }

  // Shuffle
  return queries.sort(() => Math.random() - 0.5);
}

/**
 * Generate synthetic embedding (simulates OpenAI)
 */
function generateEmbedding(seed: string): number[] {
  const dimensions = 1536;
  const embedding: number[] = [];
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  for (let i = 0; i < dimensions; i++) {
    const value = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
    embedding.push(value);
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

/**
 * Create refined query from string
 */
function createRefinedQuery(query: string, queryType: QueryType): RefinedQuery {
  return {
    cacheKey: `query:${queryType}:${query}`,
    original: query,
    semanticFeatures: {
      embedding: generateEmbedding(query),
      complexity: 0.5,
      confidence: 0.9,
      keywords: []
    },
    staticFeatures: {
      queryType,
      length: query.length,
      wordCount: query.split(" ").length,
      hasCode: false,
      hasNumbers: /\d/.test(query)
    }
  };
}

// ============================================================================
// Load Testing Framework
// ============================================================================

/**
 * Load Test Runner
 */
export class LoadTestRunner {
  private realTimeMetrics: RealTimeMetrics[] = [];
  private metricsInterval: NodeJS.Timeout | null = null;

  /**
   * Run a single load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`           LOAD TEST: ${config.concurrentUsers} users @ ${config.qps} QPS`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    // Create cache
    const cache = new SemanticCache({
      maxSize: config.cacheSize,
      similarityThreshold: config.similarityThreshold,
      enableHNSW: true,
      enableQueryTypeThresholds: true
    });

    // Generate queries
    const totalQueries = config.qps * config.duration;
    const queriesPerUser = Math.ceil(totalQueries / config.concurrentUsers);
    const queries = generateLoadTestQueries(
      queriesPerUser * config.concurrentUsers,
      config.uniqueQueryRatio,
      config.queryTypes
    );

    // Warm cache if requested
    if (config.warmCache) {
      console.log("Warming cache...");
      const warmQueries = queries.slice(0, Math.floor(queries.length * 0.3));
      for (const query of warmQueries) {
        const type = config.queryTypes[Math.floor(Math.random() * config.queryTypes.length)];
        const refinedQuery = createRefinedQuery(query, type);
        await cache.set(refinedQuery, `Response: ${query}`);
      }
      console.log(`Cache warmed with ${warmQueries.length} entries\n`);
    }

    // Start real-time monitoring
    this.startRealTimeMonitoring(cache, config);

    // Run load test
    const startTime = Date.now();
    const results = await this.executeLoad(cache, queries, config);
    const duration = Date.now() - startTime;

    // Stop monitoring
    this.stopRealTimeMonitoring();

    // Calculate metrics
    const metrics = this.calculateMetrics(results, duration);

    const result: LoadTestResult = {
      config,
      metrics,
      duration,
      passed: this.evaluatePass(metrics, config),
      timestamp: Date.now()
    };

    // Print results
    this.printResults(result);

    return result;
  }

  /**
   * Execute load test with concurrent users
   */
  private async executeLoad(
    cache: SemanticCache,
    queries: string[],
    config: LoadTestConfig
  ): Promise<Array<{ latency: number; hit: boolean; error: boolean }>> {
    const queriesPerUser = Math.ceil(queries.length / config.concurrentUsers);
    const intervalMs = 1000 / config.qps;

    const userPromises = Array.from({ length: config.concurrentUsers }, async (userIndex) => {
      const start = userIndex * queriesPerUser;
      const end = Math.min(start + queriesPerUser, queries.length);
      const userQueries = queries.slice(start, end);
      const results: Array<{ latency: number; hit: boolean; error: boolean }> = [];

      for (const query of userQueries) {
        try {
          const queryStart = Date.now();
          const type = config.queryTypes[userIndex % config.queryTypes.length];
          const refinedQuery = createRefinedQuery(query, type);
          const result = await cache.get(refinedQuery);
          const latency = Date.now() - queryStart;

          results.push({
            latency,
            hit: result.found,
            error: false
          });

          // Set on miss
          if (!result.found) {
            await cache.set(refinedQuery, `Response: ${query}`);
          }

          // Rate limiting
          if (intervalMs > 0) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        } catch (error) {
          results.push({
            latency: 0,
            hit: false,
            error: true
          });
        }
      }

      return results;
    });

    const allResults = await Promise.all(userPromises);
    return allResults.flat();
  }

  /**
   * Calculate metrics from results
   */
  private calculateMetrics(
    results: Array<{ latency: number; hit: boolean; error: boolean }>,
    duration: number
  ): LoadTestMetrics {
    const totalQueries = results.length;
    const successfulQueries = results.filter(r => !r.error).length;
    const failedQueries = results.filter(r => r.error).length;
    const cacheHits = results.filter(r => r.hit).length;
    const cacheMisses = results.filter(r => !r.hit).length;

    const latencies = results.map(r => r.latency).filter(l => l > 0);
    const sorted = [...latencies].sort((a, b) => a - b);

    const latency = {
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0
    };

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      cacheHits,
      cacheMisses,
      hitRate: cacheHits / (cacheHits + cacheMisses) || 0,
      latency,
      throughput: (totalQueries / duration) * 1000,
      errorRate: failedQueries / totalQueries,
      perUserMetrics: []
    };
  }

  /**
   * Evaluate if test passed
   */
  private evaluatePass(metrics: LoadTestMetrics, config: LoadTestConfig): boolean {
    // Performance targets
    const hitRateTarget = 0.7; // 70% hit rate minimum
    const p95LatencyTarget = 50; // P95 < 50ms
    const errorRateTarget = 0.01; // < 1% error rate
    const throughputTarget = config.qps * 0.9; // 90% of target QPS

    return (
      metrics.hitRate >= hitRateTarget &&
      metrics.latency.p95 <= p95LatencyTarget &&
      metrics.errorRate <= errorRateTarget &&
      metrics.throughput >= throughputTarget
    );
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(cache: SemanticCache, config: LoadTestConfig): void {
    this.metricsInterval = setInterval(() => {
      const stats = cache.getStats();
      this.realTimeMetrics.push({
        timestamp: Date.now(),
        qps: config.qps,
        avgLatency: 0, // Would need to track this
        hitRate: stats.hitRate,
        activeUsers: config.concurrentUsers
      });
    }, 1000);
  }

  /**
   * Stop real-time monitoring
   */
  private stopRealTimeMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Print test results
   */
  private printResults(result: LoadTestResult): void {
    const { metrics, config, duration, passed } = result;

    console.log(`\n${passed ? "✅ PASSED" : "❌ FAILED"} - Duration: ${(duration / 1000).toFixed(2)}s\n`);
    console.log("Performance Metrics:");
    console.log(`  Total Queries:      ${metrics.totalQueries.toLocaleString()}`);
    console.log(`  Successful:         ${metrics.successfulQueries.toLocaleString()}`);
    console.log(`  Failed:             ${metrics.failedQueries.toLocaleString()}`);
    console.log(`  Hit Rate:           ${(metrics.hitRate * 100).toFixed(1)}%`);
    console.log(`  Throughput:         ${metrics.throughput.toFixed(0)} QPS`);
    console.log(`  Error Rate:         ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log("\nLatency (ms):");
    console.log(`  P50:                ${metrics.latency.p50.toFixed(2)}`);
    console.log(`  P95:                ${metrics.latency.p95.toFixed(2)}`);
    console.log(`  P99:                ${metrics.latency.p99.toFixed(2)}`);
    console.log(`  Average:            ${metrics.latency.avg.toFixed(2)}`);
    console.log(`  Min:                ${metrics.latency.min.toFixed(2)}`);
    console.log(`  Max:                ${metrics.latency.max.toFixed(2)}`);
    console.log("\n═══════════════════════════════════════════════════════════\n");
  }
}

// ============================================================================
// Predefined Load Test Scenarios
// ============================================================================

export const LOAD_TEST_SCENARIOS = {
  lowLoad: {
    concurrentUsers: 1,
    qps: 10,
    duration: 10,
    uniqueQueryRatio: 0.5,
    queryTypes: ["code", "explanation", "question"],
    warmCache: true,
    cacheSize: 1000,
    similarityThreshold: 0.85
  } as LoadTestConfig,

  mediumLoad: {
    concurrentUsers: 10,
    qps: 100,
    duration: 30,
    uniqueQueryRatio: 0.6,
    queryTypes: ["code", "explanation", "question", "debug"],
    warmCache: true,
    cacheSize: 5000,
    similarityThreshold: 0.85
  } as LoadTestConfig,

  highLoad: {
    concurrentUsers: 50,
    qps: 1000,
    duration: 60,
    uniqueQueryRatio: 0.7,
    queryTypes: ["code", "explanation", "question", "debug", "comparison"],
    warmCache: true,
    cacheSize: 10000,
    similarityThreshold: 0.85
  } as LoadTestConfig,

  stressTest: {
    concurrentUsers: 100,
    qps: 5000,
    duration: 120,
    uniqueQueryRatio: 0.8,
    queryTypes: ["code", "explanation", "question", "debug", "comparison"],
    warmCache: false,
    cacheSize: 50000,
    similarityThreshold: 0.85
  } as LoadTestConfig
};

/**
 * Run a predefined load test scenario
 */
export async function runLoadTestScenario(
  scenario: keyof typeof LOAD_TEST_SCENARIOS
): Promise<LoadTestResult> {
  const runner = new LoadTestRunner();
  const config = LOAD_TEST_SCENARIOS[scenario];
  return runner.runLoadTest(config);
}

/**
 * Run all load test scenarios
 */
export async function runAllLoadTests(): Promise<LoadTestResult[]> {
  const results: LoadTestResult[] = [];

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║        SEMANTIC CACHE LOAD TEST SUITE                    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  for (const scenario of Object.keys(LOAD_TEST_SCENARIOS) as Array<keyof typeof LOAD_TEST_SCENARIOS>) {
    console.log(`\n▶ Running scenario: ${scenario.toUpperCase()}`);
    const result = await runLoadTestScenario(scenario);
    results.push(result);
  }

  // Print summary
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                  LOAD TEST SUMMARY                        ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  for (const result of results) {
    const scenario = Object.keys(LOAD_TEST_SCENARIOS).find(
      key => LOAD_TEST_SCENARIOS[key as keyof typeof LOAD_TEST_SCENARIOS] === result.config
    );
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${scenario?.padEnd(15)} - Hit Rate: ${(result.metrics.hitRate * 100).toFixed(1)}%, P95: ${result.metrics.latency.p95.toFixed(2)}ms, Throughput: ${result.metrics.throughput.toFixed(0)} QPS`);
  }

  console.log("\n");

  return results;
}
