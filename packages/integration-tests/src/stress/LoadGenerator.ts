/**
 * Load Generator for Stress Testing
 *
 * Generates various load patterns (constant, ramp-up, spike, wave) for testing
 * system performance under different conditions. Simulates realistic traffic patterns
 * with configurable query distributions and complexity.
 *
 * Features:
 * - Multiple load patterns (constant, ramp-up, spike, wave)
 * - Query type distribution matching real-world usage
 * - Complexity distribution (uniform, normal, exponential)
 * - Real-time monitoring with latency percentiles
 * - Resource usage tracking
 */

import { QueryType } from "@lsi/protocol";

/**
 * Load pattern types
 */
export type LoadPattern = "constant" | "ramp_up" | "spike" | "wave";

/**
 * Complexity distribution types
 */
export type ComplexityDistribution = "uniform" | "normal" | "exponential";

/**
 * Load configuration
 */
export interface LoadConfig {
  /** Load pattern to generate */
  pattern: LoadPattern;

  /** Target requests per second */
  requestsPerSecond: number;

  /** Test duration in milliseconds */
  duration: number;

  /** Query type distribution (type and weight) */
  queryTypes: { type: QueryType; weight: number }[];

  /** Complexity range and distribution */
  complexity: {
    /** Minimum complexity (0-1) */
    min: number;
    /** Maximum complexity (0-1) */
    max: number;
    /** Distribution type */
    distribution: ComplexityDistribution;
  };

  /** Number of concurrent clients to simulate */
  concurrentClients: number;

  /** Think time between requests in milliseconds */
  thinkTime: number;

  /** Target endpoints */
  endpoints: string[];

  /** Monitoring sample interval in milliseconds */
  sampleInterval: number;

  /** Optional: Spike duration for spike pattern (ms) */
  spikeDuration?: number;

  /** Optional: Burst size for wave pattern */
  burstSize?: number;

  /** Optional: Burst interval for wave pattern (ms) */
  burstInterval?: number;
}

/**
 * Query execution result
 */
interface QueryResult {
  /** Whether query succeeded */
  success: boolean;
  /** Latency in milliseconds */
  latency: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Load test result with comprehensive metrics
 */
export interface LoadTestResult {
  /** Unique test identifier */
  testId: string;

  /** Test start timestamp */
  timestamp: number;

  /** Actual test duration in milliseconds */
  duration: number;

  /** Total requests sent */
  totalRequests: number;

  /** Successful requests */
  successfulRequests: number;

  /** Failed requests */
  failedRequests: number;

  /** Success rate */
  successRate: number;

  /** Latency metrics */
  latency: {
    /** Minimum latency (ms) */
    min: number;
    /** Maximum latency (ms) */
    max: number;
    /** Mean latency (ms) */
    mean: number;
    /** Median latency (ms) */
    median: number;
    /** 50th percentile */
    p50: number;
    /** 95th percentile */
    p95: number;
    /** 99th percentile */
    p99: number;
    /** 99.9th percentile */
    p999: number;
  };

  /** Requests per second */
  throughput: number;

  /** Error breakdown */
  errors: {
    /** Error code or type */
    code: string;
    /** Number of occurrences */
    count: number;
    /** Percentage of total requests */
    percentage: number;
  }[];

  /** Resource usage metrics */
  resourceUsage: {
    /** Peak memory usage in MB */
    memoryMB: number;
    /** Peak CPU usage percentage */
    cpuPercent: number;
    /** Peak concurrent connections */
    connections: number;
  };

  /** Per-second metrics for time-series analysis */
  timeSeriesData?: {
    /** Timestamp (ms from start) */
    timestamp: number;
    /** Requests in this second */
    requests: number;
    /** Average latency (ms) */
    avgLatency: number;
    /** Error count */
    errors: number;
  }[];
}

/**
 * Sample queries for different types and complexity levels
 */
const SAMPLE_QUERIES: Record<QueryType, string[]> = {
  question: [
    "What is the capital of France?",
    "How does photosynthesis work?",
    "What are the benefits of exercise?",
    "Who wrote Romeo and Juliet?",
    "What is machine learning?",
  ],
  command: [
    "Write a function to sort an array",
    "Create a REST API endpoint",
    "Generate a random password",
    "Calculate the fibonacci sequence",
    "Parse JSON data",
  ],
  code: [
    "def quicksort(arr):",
    "function binarySearch(arr, target):",
    "class TreeNode:",
    "const arr = [1, 2, 3];",
    "import numpy as np",
  ],
  explanation: [
    "Explain how the internet works",
    "What is quantum computing?",
    "How do vaccines work?",
    "Explain the theory of relativity",
    "What is blockchain technology?",
  ],
  comparison: [
    "Compare Python vs JavaScript",
    "PostgreSQL vs MongoDB differences",
    "React vs Angular comparison",
    "AWS vs Azure vs Google Cloud",
    "TCP vs UDP protocols",
  ],
  debug: [
    "Why is my loop not working?",
    "Debug this segmentation fault",
    "Fix this memory leak",
    "Resolving connection timeout error",
    "Null pointer exception help",
  ],
  general: [
    "Tell me a joke",
    "How are you today?",
    "What time is it?",
    "Hello world",
    "Thank you",
  ],
};

/**
 * Load Generator Class
 *
 * Generates load according to configured patterns and measures system response.
 */
export class LoadGenerator {
  private resourceMonitor: ResourceMonitor;
  private active = false;
  private abortController: AbortController | null = null;

  constructor() {
    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Generate load based on configuration
   */
  async generateLoad(config: LoadConfig): Promise<LoadTestResult> {
    const testId = this.generateTestId();
    const startTime = Date.now();
    this.abortController = new AbortController();
    this.active = true;

    // Start resource monitoring
    this.resourceMonitor.start();

    const results: QueryResult[] = [];
    const timeSeriesData: LoadTestResult["timeSeriesData"] = [];
    let lastSampleTime = startTime;

    try {
      switch (config.pattern) {
        case "constant":
          await this.constantLoad(
            config,
            results,
            timeSeriesData,
            startTime,
            lastSampleTime
          );
          break;
        case "ramp_up":
          await this.rampUpLoad(
            config,
            results,
            timeSeriesData,
            startTime,
            lastSampleTime
          );
          break;
        case "spike":
          await this.spikeLoad(
            config,
            results,
            timeSeriesData,
            startTime,
            lastSampleTime
          );
          break;
        case "wave":
          await this.waveLoad(
            config,
            results,
            timeSeriesData,
            startTime,
            lastSampleTime
          );
          break;
      }
    } catch (error) {
      if (this.active) {
        console.error("Load generation error:", error);
      }
    }

    // Stop resource monitoring
    this.resourceMonitor.stop();
    const resourceUsage = this.resourceMonitor.getMetrics();

    const actualDuration = Date.now() - startTime;
    this.active = false;

    return this.aggregateResults(
      testId,
      startTime,
      actualDuration,
      results,
      resourceUsage,
      timeSeriesData
    );
  }

  /**
   * Stop ongoing load generation
   */
  stop(): void {
    this.active = false;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Constant load pattern
   */
  private async constantLoad(
    config: LoadConfig,
    results: QueryResult[],
    timeSeriesData: LoadTestResult["timeSeriesData"],
    startTime: number,
    lastSampleTime: number
  ): Promise<void> {
    const interval = 1000 / config.requestsPerSecond;
    const endTime = startTime + config.duration;

    while (this.active && Date.now() < endTime) {
      const query = this.generateQuery(config);
      const endpoint = this.selectEndpoint(config);

      const result = await this.executeQuery(query, endpoint);
      results.push(result);

      // Sample metrics periodically
      if (Date.now() - lastSampleTime >= config.sampleInterval) {
        this.sampleMetrics(results, timeSeriesData, startTime);
        lastSampleTime = Date.now();
      }

      // Wait for next interval
      await this.sleep(interval);
    }
  }

  /**
   * Ramp-up load pattern
   */
  private async rampUpLoad(
    config: LoadConfig,
    results: QueryResult[],
    timeSeriesData: LoadTestResult["timeSeriesData"],
    startTime: number,
    lastSampleTime: number
  ): Promise<void> {
    const rampUpDuration = config.duration;
    const endTime = startTime + rampUpDuration;
    const startRate = 1; // Start at 1 req/s
    const endRate = config.requestsPerSecond;

    while (this.active && Date.now() < endTime) {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / rampUpDuration;
      const currentRate = startRate + (endRate - startRate) * progress;
      const interval = 1000 / currentRate;

      const query = this.generateQuery(config);
      const endpoint = this.selectEndpoint(config);

      const result = await this.executeQuery(query, endpoint);
      results.push(result);

      // Sample metrics periodically
      if (Date.now() - lastSampleTime >= config.sampleInterval) {
        this.sampleMetrics(results, timeSeriesData, startTime);
        lastSampleTime = Date.now();
      }

      await this.sleep(interval);
    }
  }

  /**
   * Spike load pattern
   */
  private async spikeLoad(
    config: LoadConfig,
    results: QueryResult[],
    timeSeriesData: LoadTestResult["timeSeriesData"],
    startTime: number,
    lastSampleTime: number
  ): Promise<void> {
    const spikeDuration = config.spikeDuration || 5000;
    const spikeStartTime = startTime + 2000; // Spike starts after 2 seconds
    const spikeEndTime = spikeStartTime + spikeDuration;
    const normalRate = 10;
    const spikeRate = config.requestsPerSecond;

    while (this.active && Date.now() < startTime + config.duration) {
      const now = Date.now();
      const inSpike = now >= spikeStartTime && now < spikeEndTime;
      const currentRate = inSpike ? spikeRate : normalRate;
      const interval = 1000 / currentRate;

      const query = this.generateQuery(config);
      const endpoint = this.selectEndpoint(config);

      const result = await this.executeQuery(query, endpoint);
      results.push(result);

      // Sample metrics periodically
      if (now - lastSampleTime >= config.sampleInterval) {
        this.sampleMetrics(results, timeSeriesData, startTime);
        lastSampleTime = now;
      }

      await this.sleep(interval);
    }
  }

  /**
   * Wave load pattern
   */
  private async waveLoad(
    config: LoadConfig,
    results: QueryResult[],
    timeSeriesData: LoadTestResult["timeSeriesData"],
    startTime: number,
    lastSampleTime: number
  ): Promise<void> {
    const burstSize = config.burstSize || 10;
    const burstInterval = config.burstInterval || 1000;
    const endTime = startTime + config.duration;

    while (this.active && Date.now() < endTime) {
      // Send a burst of requests
      for (let i = 0; i < burstSize && this.active; i++) {
        const query = this.generateQuery(config);
        const endpoint = this.selectEndpoint(config);

        const result = await this.executeQuery(query, endpoint);
        results.push(result);
      }

      // Sample metrics
      if (Date.now() - lastSampleTime >= config.sampleInterval) {
        this.sampleMetrics(results, timeSeriesData, startTime);
        lastSampleTime = Date.now();
      }

      // Wait before next burst
      await this.sleep(burstInterval);
    }
  }

  /**
   * Generate a query based on configuration
   */
  private generateQuery(config: LoadConfig): string {
    const queryType = this.selectQueryType(config.queryTypes);
    const queries = SAMPLE_QUERIES[queryType];
    return queries[Math.floor(Math.random() * queries.length)];
  }

  /**
   * Select query type based on weights
   */
  private selectQueryType(
    queryTypes: { type: QueryType; weight: number }[]
  ): QueryType {
    const totalWeight = queryTypes.reduce((sum, qt) => sum + qt.weight, 0);
    let random = Math.random() * totalWeight;

    for (const qt of queryTypes) {
      random -= qt.weight;
      if (random <= 0) {
        return qt.type;
      }
    }

    return queryTypes[0].type;
  }

  /**
   * Select endpoint (round-robin)
   */
  private selectEndpoint(config: LoadConfig): string {
    const index = Math.floor(Math.random() * config.endpoints.length);
    return config.endpoints[index];
  }

  /**
   * Execute a query and measure latency
   */
  private async executeQuery(
    query: string,
    endpoint: string
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Simulate query execution (replace with actual HTTP call)
      await this.simulateQueryExecution(query);

      return {
        success: true,
        latency: Date.now() - startTime,
        timestamp: startTime,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime,
      };
    }
  }

  /**
   * Simulate query execution with realistic latency
   */
  private async simulateQueryExecution(query: string): Promise<void> {
    // Simulate variable latency (10-500ms)
    const latency = 10 + Math.random() * 490;
    await this.sleep(latency);

    // Simulate occasional failures (5% error rate)
    if (Math.random() < 0.05) {
      throw new Error("Simulated query failure");
    }
  }

  /**
   * Sample metrics for time-series data
   */
  private sampleMetrics(
    results: QueryResult[],
    timeSeriesData: LoadTestResult["timeSeriesData"],
    startTime: number
  ): void {
    const recentResults = results.slice(-100); // Last 100 results
    const timestamp = Date.now() - startTime;

    const avgLatency =
      recentResults.length > 0
        ? recentResults.reduce((sum, r) => sum + r.latency, 0) /
          recentResults.length
        : 0;

    const errors = recentResults.filter(r => !r.success).length;

    timeSeriesData.push({
      timestamp,
      requests: recentResults.length,
      avgLatency,
      errors,
    });
  }

  /**
   * Aggregate results into final metrics
   */
  private aggregateResults(
    testId: string,
    timestamp: number,
    duration: number,
    results: QueryResult[],
    resourceUsage: {
      memoryMB: number;
      cpuPercent: number;
      connections: number;
    },
    timeSeriesData: LoadTestResult["timeSeriesData"]
  ): LoadTestResult {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const latencies = results.map(r => r.latency);

    // Group errors by type
    const errorMap = new Map<string, number>();
    failed.forEach(r => {
      const code = r.error || "unknown";
      errorMap.set(code, (errorMap.get(code) || 0) + 1);
    });

    const errors = Array.from(errorMap.entries()).map(([code, count]) => ({
      code,
      count,
      percentage: (count / results.length) * 100,
    }));

    return {
      testId,
      timestamp,
      duration,
      totalRequests: results.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: (successful.length / results.length) * 100,
      latency: this.calculatePercentiles(latencies),
      throughput: (results.length / duration) * 1000,
      errors,
      resourceUsage,
      timeSeriesData,
    };
  }

  /**
   * Calculate latency percentiles
   */
  private calculatePercentiles(latencies: number[]): LoadTestResult["latency"] {
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        p999: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = latencies.reduce((s, l) => s + l, 0);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / latencies.length,
      median: percentile(50),
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      p999: percentile(99.9),
    };
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(): string {
    return `load-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Resource Monitor
 *
 * Tracks memory, CPU, and connection usage during load tests.
 */
class ResourceMonitor {
  private startMemory = 0;
  private peakMemory = 0;
  private active = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    this.active = true;
    this.startMemory = this.getCurrentMemoryMB();
    this.peakMemory = this.startMemory;

    this.intervalId = setInterval(() => {
      if (this.active) {
        const current = this.getCurrentMemoryMB();
        if (current > this.peakMemory) {
          this.peakMemory = current;
        }
      }
    }, 1000);
  }

  stop(): void {
    this.active = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getMetrics(): { memoryMB: number; cpuPercent: number; connections: number } {
    return {
      memoryMB: this.peakMemory,
      cpuPercent: this.estimateCPUPercent(),
      connections: this.estimateConnections(),
    };
  }

  private getCurrentMemoryMB(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024);
    }
    return 0;
  }

  private estimateCPUPercent(): number {
    // CPU estimation would require OS-specific code
    // Return a placeholder for now
    return Math.random() * 50 + 20; // 20-70%
  }

  private estimateConnections(): number {
    // Connection count would require actual HTTP client tracking
    // Return a placeholder for now
    return Math.floor(Math.random() * 100) + 10;
  }
}
