/**
 * HardwareRouter - Intelligent hardware-aware routing
 *
 * Routes operations to optimal hardware based on:
 * - Hardware capabilities
 * - Operation type
 * - Routing constraints (latency, cost, privacy)
 * - Current thermal state
 * - Memory availability
 *
 * @example
 * ```typescript
 * const router = new HardwareRouter(detector, profiler);
 * const decision = await router.route(OperationType.ML_INFERENCE);
 * console.log('Route to:', decision.target);
 * ```
 */

import type {
  HardwareRoutingDecision,
  HardwareRoutingConstraints,
  HardwareProfile,
  HardwareTarget,
  IHardwareRouter,
  HardwareRouterConfig,
  IHardwareDetector,
  ICapabilityProfiler,
} from "@lsi/protocol";
import {
  OperationType,
  RoutingPriority,
} from "@lsi/protocol";

/**
 * Routing statistics
 */
interface RoutingStatistics {
  totalRoutes: number;
  routesByTarget: Record<string, number>;
  routesByOperation: Record<string, number>;
  totalLatency: number;
  cloudFallbacks: number;
}

/**
 * HardwareRouter implementation
 */
export class HardwareRouter implements IHardwareRouter {
  private config: Required<HardwareRouterConfig>;
  private detector: IHardwareDetector;
  private profiler: ICapabilityProfiler;
  private statistics: RoutingStatistics;

  constructor(
    detector: IHardwareDetector,
    profiler: ICapabilityProfiler,
    config: HardwareRouterConfig = {}
  ) {
    this.config = {
      defaultToCloud: config.defaultToCloud ?? false,
      cloudProvider: config.cloudProvider ?? "openai",
      maxFallbackAttempts: config.maxFallbackAttempts ?? 3,
      routingStrategy: config.routingStrategy ?? "balanced",
    };

    this.detector = detector;
    this.profiler = profiler;
    this.statistics = {
      totalRoutes: 0,
      routesByTarget: {},
      routesByOperation: {},
      totalLatency: 0,
      cloudFallbacks: 0,
    };
  }

  /**
   * Route operation to optimal hardware
   */
  async route(
    operation: OperationType,
    constraints?: HardwareRoutingConstraints
  ): Promise<HardwareRoutingDecision> {
    return this.routeWithPriority(operation, RoutingPriority.NORMAL, constraints);
  }

  /**
   * Route with explicit priority
   */
  async routeWithPriority(
    operation: OperationType,
    priority: RoutingPriority,
    constraints?: HardwareRoutingConstraints
  ): Promise<HardwareRoutingDecision> {
    const startTime = Date.now();

    // Get current hardware profile
    const detectionResult = await this.detector.detect();

    if (!detectionResult.success || !detectionResult.profile) {
      // Fallback to cloud if detection fails
      return this.createCloudFallbackDecision("Hardware detection failed");
    }

    const profile = detectionResult.profile;

    // Check if constraints require cloud
    if (constraints?.requireLocal) {
      return this.routeLocal(operation, profile, constraints, priority);
    }

    // Check thermal constraints
    if (constraints?.thermalLimit) {
      const thermalThreshold = this.getThermalThresholdValue(constraints.thermalLimit);
      const currentThermal = this.getThermalThresholdValue(profile.thermal.state);

      if (currentThermal > thermalThreshold) {
        // Thermal limit exceeded, prefer cloud or reduce load
        if (constraints.preferLocal) {
          return this.routeLocalReduced(operation, profile, constraints);
        }
        return this.createCloudFallbackDecision("Thermal limit exceeded");
      }
    }

    // Check memory requirements
    if (constraints?.memoryRequirementMB) {
      if (profile.memory.availableMB < constraints.memoryRequirementMB) {
        if (constraints.requireLocal) {
          return this.createErrorDecision(
            "Insufficient memory for local execution",
            constraints
          );
        }
        return this.createCloudFallbackDecision("Insufficient memory");
      }
    }

    // Check VRAM requirements
    if (constraints?.vramRequirementMB) {
      if (profile.gpu.availableVRAMMB < constraints.vramRequirementMB) {
        if (constraints.requireLocal) {
          return this.createErrorDecision(
            "Insufficient VRAM for local execution",
            constraints
          );
        }
        return this.createCloudFallbackDecision("Insufficient VRAM");
      }
    }

    // Get hardware recommendations
    const recommendations = this.profiler.getRecommendedHardware(operation, profile);

    // Apply routing strategy
    const selectedTarget = this.applyRoutingStrategy(
      recommendations,
      operation,
      profile,
      constraints,
      priority
    );

    // Score the decision
    const score = this.profiler.scoreOperation(operation, profile);
    const confidence = this.calculateConfidence(score, profile, operation);

    // Create routing decision
    const decision = this.createRoutingDecision(
      selectedTarget,
      operation,
      profile,
      confidence,
      constraints,
      recommendations
    );

    // Update statistics
    this.updateStatistics(selectedTarget, operation, Date.now() - startTime);

    return decision;
  }

  /**
   * Get current routing statistics
   */
  getStatistics() {
    return {
      totalRoutes: this.statistics.totalRoutes,
      routesByTarget: { ...this.statistics.routesByTarget },
      routesByOperation: { ...this.statistics.routesByOperation },
      averageLatency:
        this.statistics.totalRoutes > 0
          ? this.statistics.totalLatency / this.statistics.totalRoutes
          : 0,
      cloudFallbackRate:
        this.statistics.totalRoutes > 0
          ? this.statistics.cloudFallbacks / this.statistics.totalRoutes
          : 0,
    };
  }

  /**
   * Clear routing statistics
   */
  clearStatistics(): void {
    this.statistics = {
      totalRoutes: 0,
      routesByTarget: {},
      routesByOperation: {},
      totalLatency: 0,
      cloudFallbacks: 0,
    };
  }

  // ==========================================================================
  // PRIVATE ROUTING METHODS
  // ==========================================================================

  private routeLocal(
    operation: OperationType,
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints,
    priority: RoutingPriority
  ): HardwareRoutingDecision {
    const recommendations = this.profiler.getRecommendedHardware(operation, profile);

    // Filter to only local targets
    const localTargets = recommendations.filter(t => t !== "cloud");

    if (localTargets.length === 0) {
      return this.createErrorDecision("No suitable local hardware available", constraints);
    }

    // Select best local target
    const selectedTarget = this.selectBestTarget(localTargets, operation, profile, priority);

    const score = this.profiler.scoreOperation(operation, profile);
    const confidence = this.calculateConfidence(score, profile, operation);

    return this.createRoutingDecision(
      selectedTarget,
      operation,
      profile,
      confidence,
      constraints,
      localTargets
    );
  }

  private routeLocalReduced(
    operation: OperationType,
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints
  ): HardwareRoutingDecision {
    // Reduce load by using CPU instead of GPU
    const reasoning = [
      "Thermal limit exceeded - reducing load",
      "Using CPU to minimize thermal impact",
    ];

    return {
      target: "cpu",
      confidence: 0.6,
      reasoning,
      estimatedLatency: this.estimateLatency(operation, "cpu", profile),
      estimatedCost: 0,
      fallbackTargets: ["cloud"],
      useCloud: false,
    };
  }

  private applyRoutingStrategy(
    recommendations: HardwareTarget[],
    operation: OperationType,
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints | undefined,
    priority: RoutingPriority
  ): HardwareTarget {
    const strategy = this.config.routingStrategy;

    switch (strategy) {
      case "capability-first":
        return this.selectCapabilityFirst(recommendations, operation, profile);

      case "cost-first":
        return this.selectCostFirst(recommendations, profile, constraints);

      case "latency-first":
        return this.selectLatencyFirst(recommendations, operation, profile, priority);

      case "balanced":
        return this.selectBalanced(recommendations, operation, profile, constraints);

      default:
        return recommendations[0];
    }
  }

  private selectCapabilityFirst(
    recommendations: HardwareTarget[],
    operation: OperationType,
    profile: HardwareProfile
  ): HardwareTarget {
    // Select the most capable hardware
    const scores = recommendations.map(target => ({
      target,
      score: this.getTargetCapabilityScore(target, operation, profile),
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores[0].target;
  }

  private selectCostFirst(
    recommendations: HardwareTarget[],
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints | undefined
  ): HardwareTarget {
    // Always prefer local (free) over cloud (paid)
    const localTargets = recommendations.filter(t => t !== "cloud");

    if (localTargets.length > 0) {
      // Select least expensive local option (usually CPU is cheapest)
      return localTargets[localTargets.length - 1];
    }

    return "cloud";
  }

  private selectLatencyFirst(
    recommendations: HardwareTarget[],
    operation: OperationType,
    profile: HardwareProfile,
    priority: RoutingPriority
  ): HardwareTarget {
    // For critical priority, prefer fastest
    if (priority === RoutingPriority.CRITICAL) {
      // GPU is usually fastest
      const gpuTargets = recommendations.filter(t => t.startsWith("gpu-"));
      if (gpuTargets.length > 0) {
        return gpuTargets[0];
      }
    }

    // For normal priority, balance speed and overhead
    const latencies = recommendations.map(target => ({
      target,
      latency: this.estimateLatency(operation, target, profile),
    }));

    latencies.sort((a, b) => a.latency - b.latency);
    return latencies[0].target;
  }

  private selectBalanced(
    recommendations: HardwareTarget[],
    operation: OperationType,
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints | undefined
  ): HardwareTarget {
    // Balance capability, cost, and latency
    const scores = recommendations.map(target => {
      const capabilityScore = this.getTargetCapabilityScore(target, operation, profile);
      const costScore = target === "cloud" ? 0 : 100;
      const latencyScore = 100 - this.estimateLatency(operation, target, profile);

      const balancedScore =
        capabilityScore * 0.5 + costScore * 0.3 + latencyScore * 0.2;

      return { target, score: balancedScore };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores[0].target;
  }

  private selectBestTarget(
    targets: HardwareTarget[],
    operation: OperationType,
    profile: HardwareProfile,
    priority: RoutingPriority
  ): HardwareTarget {
    if (priority === RoutingPriority.CRITICAL) {
      // Prefer GPU for critical operations
      const gpuTargets = targets.filter(t => t.startsWith("gpu-"));
      if (gpuTargets.length > 0) {
        return gpuTargets[0];
      }
    }

    // Otherwise, select based on capability
    return targets[0];
  }

  private getTargetCapabilityScore(
    target: HardwareTarget,
    operation: OperationType,
    profile: HardwareProfile
  ): number {
    switch (target) {
      case "gpu-cuda":
      case "gpu-metal":
      case "gpu-webgpu":
        return profile.capabilities.gpuScore;

      case "npu":
        return profile.capabilities.npuScore;

      case "cpu-simd":
        return profile.capabilities.cpuScore * 1.2;

      case "cpu":
        return profile.capabilities.cpuScore;

      case "cloud":
        return 100; // Cloud has unlimited capability

      default:
        return 50;
    }
  }

  private calculateConfidence(
    score: number,
    profile: HardwareProfile,
    operation: OperationType
  ): number {
    let confidence = score / 100;

    // Reduce confidence if thermally constrained
    if (profile.thermal.state === "high") {
      confidence *= 0.8;
    } else if (profile.thermal.state === "critical") {
      confidence *= 0.6;
    }

    // Reduce confidence if memory pressure is high
    if (profile.memory.usagePercent > 85) {
      confidence *= 0.7;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private estimateLatency(
    operation: OperationType,
    target: HardwareTarget,
    profile: HardwareProfile
  ): number {
    // Base latency estimates (in milliseconds)
    const baseLatency: Record<HardwareTarget, number> = {
      "gpu-cuda": 50,
      "gpu-metal": 60,
      "gpu-webgpu": 70,
      "npu": 40,
      "cpu-simd": 100,
      "cpu": 150,
      "cloud": 300,
    };

    let latency = baseLatency[target] || 100;

    // Adjust based on operation type
    switch (operation) {
      case OperationType.SIMPLE_QUERY:
        latency *= 0.5;
        break;
      case OperationType.ML_TRAINING:
        latency *= 10;
        break;
      case OperationType.VIDEO_PROCESSING:
        latency *= 5;
        break;
    }

    // Adjust based on hardware capability
    if (target === "cpu" || target === "cpu-simd") {
      // Slower on weaker CPUs
      const cpuFactor = profile.cpu.logicalCores / 16; // Normalize to 16 cores
      latency *= Math.max(0.5, 1 / cpuFactor);
    }

    return Math.round(latency);
  }

  private createRoutingDecision(
    target: HardwareTarget,
    operation: OperationType,
    profile: HardwareProfile,
    confidence: number,
    constraints: HardwareRoutingConstraints | undefined,
    recommendations: HardwareTarget[]
  ): HardwareRoutingDecision {
    const reasoning = this.generateReasoning(
      target,
      operation,
      profile,
      constraints
    );

    const fallbackTargets = recommendations.filter(t => t !== target);

    return {
      target,
      confidence,
      reasoning,
      estimatedLatency: this.estimateLatency(operation, target, profile),
      estimatedCost: target === "cloud" ? this.estimateCloudCost(operation) : 0,
      fallbackTargets,
      useCloud: target === "cloud",
    };
  }

  private generateReasoning(
    target: HardwareTarget,
    operation: OperationType,
    profile: HardwareProfile,
    constraints: HardwareRoutingConstraints | undefined
  ): string[] {
    const reasons: string[] = [];

    // Operation-specific reasoning
    switch (operation) {
      case OperationType.ML_INFERENCE:
        if (target === "npu") {
          reasons.push("NPU is optimal for ML inference");
        } else if (target.startsWith("gpu-")) {
          reasons.push("GPU acceleration recommended for ML inference");
        } else {
          reasons.push("CPU fallback for ML inference (slower but functional)");
        }
        break;

      case OperationType.ML_TRAINING:
        if (target.startsWith("gpu-")) {
          reasons.push("GPU required for efficient ML training");
        } else if (target === "cloud") {
          reasons.push("Insufficient local GPU for training, using cloud");
        }
        break;

      case OperationType.VECTOR_OPS:
      case OperationType.MATRIX_OPS:
        if (target.startsWith("gpu-")) {
          reasons.push("GPU acceleration for parallel computation");
        } else if (target === "cpu-simd") {
          reasons.push("SIMD-optimized CPU for vector/matrix operations");
        }
        break;

      default:
        if (target === "cpu" || target === "cpu-simd") {
          reasons.push("CPU is sufficient for this operation");
        }
        break;
    }

    // Hardware-specific reasoning
    if (profile.gpu.available && target === "cpu") {
      reasons.push("Preferring CPU to reduce thermal load");
    }

    if (profile.thermal.state === "high" || profile.thermal.state === "critical") {
      reasons.push("Thermal considerations applied to routing");
    }

    if (profile.memory.usagePercent > 85) {
      reasons.push("High memory usage - avoiding memory-intensive paths");
    }

    // Constraint-specific reasoning
    if (constraints?.preferLocal) {
      reasons.push("Local execution preferred (user configuration)");
    }

    if (constraints?.requireLocal) {
      reasons.push("Local execution required (privacy/compliance)");
    }

    if (constraints?.maxLatency) {
      const latency = this.estimateLatency(operation, target, profile);
      if (latency > constraints.maxLatency) {
        reasons.push("Latency constraint may be exceeded");
      }
    }

    return reasons;
  }

  private estimateCloudCost(operation: OperationType): number {
    // Rough cost estimates in USD (adjust based on actual cloud pricing)
    const costs: Record<OperationType, number> = {
      [OperationType.SIMPLE_QUERY]: 0.0001,
      [OperationType.COMPLEX_REASONING]: 0.001,
      [OperationType.ML_INFERENCE]: 0.002,
      [OperationType.ML_TRAINING]: 0.1, // Training is expensive
      [OperationType.VECTOR_OPS]: 0.0005,
      [OperationType.MATRIX_OPS]: 0.001,
      [OperationType.VIDEO_PROCESSING]: 0.01,
      [OperationType.EMBEDDING_GEN]: 0.0002,
      [OperationType.EMBEDDING_SEARCH]: 0.0001,
      [OperationType.GENERAL_COMPUTE]: 0.0005,
    };

    return costs[operation] || 0.001;
  }

  private createCloudFallbackDecision(reason: string): HardwareRoutingDecision {
    this.statistics.cloudFallbacks++;

    return {
      target: "cloud",
      confidence: 0.7,
      reasoning: [reason, "Cloud fallback due to local hardware limitations"],
      estimatedLatency: 300,
      estimatedCost: 0.001,
      fallbackTargets: [],
      useCloud: true,
    };
  }

  private createErrorDecision(
    error: string,
    constraints: HardwareRoutingConstraints | undefined
  ): HardwareRoutingDecision {
    return {
      target: "cpu", // Last resort
      confidence: 0.1,
      reasoning: [error, "Attempting execution despite constraints"],
      estimatedLatency: 1000,
      estimatedCost: 0,
      fallbackTargets: ["cloud"],
      useCloud: !constraints?.requireLocal,
    };
  }

  private updateStatistics(
    target: HardwareTarget,
    operation: OperationType,
    latency: number
  ): void {
    this.statistics.totalRoutes++;
    this.statistics.totalLatency += latency;

    // Track by target
    this.statistics.routesByTarget[target] =
      (this.statistics.routesByTarget[target] || 0) + 1;

    // Track by operation
    this.statistics.routesByOperation[operation] =
      (this.statistics.routesByOperation[operation] || 0) + 1;
  }

  private getThermalThresholdValue(state: string): number {
    const values: Record<string, number> = {
      normal: 0,
      elevated: 1,
      high: 2,
      critical: 3,
      unknown: 0,
    };
    return values[state] ?? 0;
  }
}
