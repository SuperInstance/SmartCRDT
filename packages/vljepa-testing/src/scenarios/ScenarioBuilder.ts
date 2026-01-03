/**
 * ScenarioBuilder - Build and execute realistic test scenarios
 * Supports complex, multi-stage test scenarios with assertions.
 */

import type {
  TestScenario,
  TestStage,
  LoadConfig,
  Assertion,
  TestAction,
  TestRequest,
  ComparisonOperator,
  TrafficPattern,
} from "../types.js";

export interface ScenarioBuilderOptions {
  name: string;
  description?: string;
  tags?: string[];
}

export interface ScenarioExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  getMetrics(): Promise<{ cpu: number; memory: number; throughput: number }>;
  scaleUp(): Promise<void>;
  scaleDown(): Promise<void>;
}

export interface ScenarioResult {
  scenario: string;
  success: boolean;
  duration: number;
  stages: StageResult[];
  overallAssertionsPassed: boolean;
  failedAssertions: FailedAssertion[];
  timestamp: number;
}

export interface StageResult {
  stage: string;
  duration: number;
  assertionsPassed: boolean;
  failedAssertions: FailedAssertion[];
  metrics: StageMetrics;
}

export interface FailedAssertion {
  assertion: Assertion;
  actual: number;
  expected: number;
  stage: string;
}

export interface StageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  p95Latency: number;
  throughput: number;
  errorRate: number;
}

export class ScenarioBuilder {
  private stages: TestStage[] = [];
  private options: ScenarioBuilderOptions;

  constructor(options: ScenarioBuilderOptions) {
    this.options = {
      name: options.name,
      description: options.description,
      tags: options.tags ?? [],
    };
  }

  /**
   * Add a stage to the scenario
   */
  addStage(stage: TestStage): this {
    this.stages.push(stage);
    return this;
  }

  /**
   * Add a load stage
   */
  addLoadStage(config: {
    name: string;
    load: number;
    duration: number;
    pattern?: TrafficPattern;
    rampUp?: number;
    rampDown?: number;
    assertions?: Assertion[];
  }): this {
    const stage: TestStage = {
      name: config.name,
      load: {
        pattern: config.pattern ?? "constant",
        rate: config.load,
        users: config.load,
        duration: config.duration,
        rampUp: config.rampUp,
        rampDown: config.rampDown,
      },
      duration: config.duration,
      assertions: config.assertions ?? [],
    };

    return this.addStage(stage);
  }

  /**
   * Add a spike stage
   */
  addSpikeStage(config: {
    name: string;
    baselineLoad: number;
    spikeLoad: number;
    duration: number;
    spikeDuration?: number;
    assertions?: Assertion[];
  }): this {
    const stage: TestStage = {
      name: config.name,
      load: {
        pattern: "bursty",
        rate: config.spikeLoad,
        users: config.spikeLoad,
        duration: config.duration,
      },
      duration: config.duration,
      assertions: config.assertions ?? [],
      actions: config.spikeDuration
        ? [
            {
              type: "traffic_change",
              timestamp: config.spikeDuration,
              config: { load: config.baselineLoad },
              description: "Reduce to baseline after spike",
            },
          ]
        : undefined,
    };

    return this.addStage(stage);
  }

  /**
   * Add a scaling stage
   */
  addScalingStage(config: {
    name: string;
    scaleType: "up" | "down";
    duration: number;
    load?: number;
    assertions?: Assertion[];
  }): this {
    const stage: TestStage = {
      name: config.name,
      load: {
        pattern: "constant",
        rate: config.load ?? 10,
        users: config.load ?? 10,
        duration: config.duration,
      },
      duration: config.duration,
      assertions: config.assertions ?? [],
      actions: [
        {
          type: "scale",
          timestamp: 0,
          config: { direction: config.scaleType },
          description: `${config.scaleType === "up" ? "Scale up" : "Scale down"}`,
        },
      ],
    };

    return this.addStage(stage);
  }

  /**
   * Add a fault injection stage
   */
  addFaultStage(config: {
    name: string;
    faultType: "network_failure" | "high_latency" | "service_crash";
    duration: number;
    faultDuration?: number;
    load?: number;
    assertions?: Assertion[];
  }): this {
    const stage: TestStage = {
      name: config.name,
      load: {
        pattern: "constant",
        rate: config.load ?? 10,
        users: config.load ?? 10,
        duration: config.duration,
      },
      duration: config.duration,
      assertions: config.assertions ?? [],
      actions: [
        {
          type: "fault",
          timestamp: 0,
          config: {
            faultType: config.faultType,
            duration: config.faultDuration ?? 5000,
          },
          description: `Inject ${config.faultType} fault`,
        },
      ],
    };

    return this.addStage(stage);
  }

  /**
   * Add a gradual ramp stage
   */
  addRampStage(config: {
    name: string;
    fromLoad: number;
    toLoad: number;
    duration: number;
    assertions?: Assertion[];
  }): this {
    const stage: TestStage = {
      name: config.name,
      load: {
        pattern: "constant",
        rate: config.toLoad,
        users: config.toLoad,
        duration: config.duration,
        rampUp: config.duration,
      },
      duration: config.duration,
      assertions: config.assertions ?? [],
    };

    return this.addStage(stage);
  }

  /**
   * Build the scenario
   */
  build(): TestScenario {
    const totalDuration = this.stages.reduce(
      (sum, stage) => sum + stage.duration,
      0
    );

    return {
      name: this.options.name,
      description:
        this.options.description ??
        `Scenario with ${this.stages.length} stages`,
      stages: this.stages,
      duration: totalDuration,
      expectedBehavior: "All stages should complete without assertion failures",
      tags: this.options.tags,
    };
  }

  /**
   * Execute the scenario
   */
  async execute(
    scenario: TestScenario,
    executor: ScenarioExecutor
  ): Promise<ScenarioResult> {
    const startTime = Date.now();
    const stageResults: StageResult[] = [];
    let overallAssertionsPassed = true;
    const failedAssertions: FailedAssertion[] = [];

    for (const stage of scenario.stages) {
      const stageStart = Date.now();

      // Execute stage actions
      if (stage.actions) {
        for (const action of stage.actions) {
          await this.executeAction(action, executor);
        }
      }

      // Execute load for this stage
      const metrics = await this.executeStageLoad(stage, executor);

      // Verify assertions
      const assertionResults = this.verifyAssertions(stage.assertions, metrics);
      const failedInStage = assertionResults.filter(r => !r.passed);
      const stagePassed = failedInStage.length === 0;

      if (!stagePassed) {
        overallAssertionsPassed = false;
        failedAssertions.push(
          ...failedInStage.map(r => ({
            assertion: r.assertion,
            actual: r.actual,
            expected: r.assertion.threshold,
            stage: stage.name,
          }))
        );
      }

      stageResults.push({
        stage: stage.name,
        duration: Date.now() - stageStart,
        assertionsPassed: stagePassed,
        failedAssertions: failedInStage.map(r => ({
          assertion: r.assertion,
          actual: r.actual,
          expected: r.assertion.threshold,
          stage: stage.name,
        })),
        metrics,
      });
    }

    return {
      scenario: scenario.name,
      success: overallAssertionsPassed,
      duration: Date.now() - startTime,
      stages: stageResults,
      overallAssertionsPassed,
      failedAssertions,
      timestamp: startTime,
    };
  }

  /**
   * Execute a stage action
   */
  private async executeAction(
    action: TestAction,
    executor: ScenarioExecutor
  ): Promise<void> {
    switch (action.type) {
      case "scale":
        const direction = action.config.direction as "up" | "down";
        if (direction === "up") {
          await executor.scaleUp();
        } else {
          await executor.scaleDown();
        }
        break;
      case "fault":
        // Fault injection would be handled by specialized executor
        console.warn("Fault injection not implemented in basic executor");
        break;
      case "traffic_change":
        // Traffic changes are handled in executeStageLoad
        break;
      case "config_change":
        // Config changes would be applied to executor
        break;
    }
  }

  /**
   * Execute load for a stage
   */
  private async executeStageLoad(
    stage: TestStage,
    executor: ScenarioExecutor
  ): Promise<StageMetrics> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let successes = 0;
    let failures = 0;

    while (Date.now() - startTime < stage.duration) {
      const requestCount = Math.ceil(stage.load.rate / 10); // 10 batches per second
      const promises: Promise<void>[] = [];

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i);
            const start = performance.now();

            try {
              const result = await executor.execute(request);
              const latency = performance.now() - start;
              latencies.push(latency);

              if (result.success) {
                successes++;
              } else {
                failures++;
              }
            } catch {
              failures++;
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    const sorted = latencies.sort((a, b) => a - b);
    const total = successes + failures;

    return {
      totalRequests: total,
      successfulRequests: successes,
      failedRequests: failures,
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      throughput: successes / (stage.duration / 1000 || 1),
      errorRate: total > 0 ? failures / total : 0,
    };
  }

  /**
   * Verify stage assertions
   */
  private verifyAssertions(
    assertions: Assertion[],
    metrics: StageMetrics
  ): Array<{ assertion: Assertion; passed: boolean; actual: number }> {
    return assertions.map(assertion => {
      let actual = 0;

      switch (assertion.type) {
        case "latency":
          actual =
            assertion.metric === "avg"
              ? metrics.avgLatency
              : metrics.p95Latency;
          break;
        case "error_rate":
          actual = metrics.errorRate * 100; // Convert to percentage
          break;
        case "throughput":
          actual = metrics.throughput;
          break;
        case "resource":
          // Would need to get actual resource metrics
          actual = 0;
          break;
      }

      const passed = this.compare(
        actual,
        assertion.threshold,
        assertion.operator
      );

      return { assertion, passed, actual };
    });
  }

  /**
   * Compare values based on operator
   */
  private compare(
    actual: number,
    threshold: number,
    operator: ComparisonOperator
  ): boolean {
    switch (operator) {
      case "lt":
        return actual < threshold;
      case "lte":
        return actual <= threshold;
      case "gt":
        return actual > threshold;
      case "gte":
        return actual >= threshold;
      case "eq":
        return actual === threshold;
      case "ne":
        return actual !== threshold;
      default:
        return false;
    }
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `scenario-req-${Date.now()}-${id}`,
      type: "scenario_test",
      payload: { scenario: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a common scenario: normal day
   */
  static createNormalDayScenario(): TestScenario {
    return new ScenarioBuilder({
      name: "Normal Day",
      description: "Typical daily traffic pattern",
      tags: ["normal", "daily"],
    })
      .addRampStage({
        name: "Morning Ramp Up",
        fromLoad: 10,
        toLoad: 50,
        duration: 7200000, // 2 hours
        assertions: [
          { type: "latency", metric: "p95", threshold: 500, operator: "lt" },
          { type: "error_rate", metric: "rate", threshold: 1, operator: "lt" },
        ],
      })
      .addLoadStage({
        name: "Peak Hours",
        load: 100,
        duration: 14400000, // 4 hours
        assertions: [
          { type: "latency", metric: "p95", threshold: 1000, operator: "lt" },
          { type: "error_rate", metric: "rate", threshold: 2, operator: "lt" },
        ],
      })
      .addRampStage({
        name: "Evening Ramp Down",
        fromLoad: 100,
        toLoad: 20,
        duration: 10800000, // 3 hours
        assertions: [
          { type: "latency", metric: "p95", threshold: 300, operator: "lt" },
        ],
      })
      .build();
  }

  /**
   * Create a common scenario: flash crowd
   */
  static createFlashCrowdScenario(): TestScenario {
    return new ScenarioBuilder({
      name: "Flash Crowd",
      description: "Sudden viral traffic spike",
      tags: ["stress", "spike"],
    })
      .addLoadStage({
        name: "Baseline",
        load: 10,
        duration: 60000, // 1 minute
        assertions: [
          { type: "latency", metric: "p95", threshold: 200, operator: "lt" },
        ],
      })
      .addSpikeStage({
        name: "Viral Spike",
        baselineLoad: 10,
        spikeLoad: 500,
        duration: 300000, // 5 minutes
        spikeDuration: 60000, // 1 minute spike
        assertions: [
          { type: "error_rate", metric: "rate", threshold: 50, operator: "lt" }, // Allow 50% errors during spike
        ],
      })
      .addLoadStage({
        name: "Recovery",
        load: 10,
        duration: 120000, // 2 minutes
        assertions: [
          { type: "latency", metric: "p95", threshold: 300, operator: "lt" },
          { type: "error_rate", metric: "rate", threshold: 5, operator: "lt" },
        ],
      })
      .build();
  }

  /**
   * Create a common scenario: gradual growth
   */
  static createGradualGrowthScenario(): TestScenario {
    return new ScenarioBuilder({
      name: "Gradual Growth",
      description: "Organic traffic growth over time",
      tags: ["growth", "scaling"],
    })
      .addLoadStage({
        name: "Initial",
        load: 10,
        duration: 300000, // 5 minutes
        assertions: [
          { type: "latency", metric: "p95", threshold: 200, operator: "lt" },
        ],
      })
      .addLoadStage({
        name: "Growth Phase 1",
        load: 25,
        duration: 300000, // 5 minutes
        assertions: [
          { type: "latency", metric: "p95", threshold: 300, operator: "lt" },
        ],
      })
      .addLoadStage({
        name: "Growth Phase 2",
        load: 50,
        duration: 300000, // 5 minutes
        assertions: [
          { type: "latency", metric: "p95", threshold: 500, operator: "lt" },
        ],
      })
      .addLoadStage({
        name: "Steady State",
        load: 100,
        duration: 600000, // 10 minutes
        assertions: [
          { type: "latency", metric: "p95", threshold: 1000, operator: "lt" },
          { type: "throughput", metric: "rps", threshold: 90, operator: "gte" },
        ],
      })
      .build();
  }
}
