/**
 * HardwareAwareDispatcher - Intelligent dispatch based on hardware state
 *
 * This module makes routing decisions based on real-time hardware capabilities,
 * thermal state, and user constraints.
 */

import { HardwareMonitor } from "./HardwareMonitor.js";
import { ThermalManager } from "./ThermalManager.js";
import {
  ThermalIntegration,
  createThermalIntegration,
} from "./ThermalIntegration.js";
import type {
  HardwareState,
  HardwareCapabilities,
  ResourceType,
} from "./HardwareState.js";
import { assessCapabilities } from "./HardwareState.js";

/**
 * Refined query interface (simplified version from @lsi/cascade)
 * In production, this would import from @lsi/cascade/src/types
 */
export interface RefinedQuery {
  /** Original query */
  original: string;
  /** Normalized query */
  normalized: string;
  /** Static features */
  staticFeatures: {
    length: number;
    wordCount: number;
    queryType: string;
    complexity: number;
    hasCode: boolean;
    hasSQL: boolean;
    hasUrl: boolean;
    hasEmail: boolean;
    questionMark: boolean;
    exclamationCount: number;
    ellipsisCount: number;
    capitalizationRatio: number;
    punctuationDensity: number;
    technicalTerms: string[];
    domainKeywords: string[];
  };
  /** Semantic features */
  semanticFeatures: {
    embedding: number[];
    embeddingDim: number;
    similarQueries: Array<{ query: string; similarity: number }>;
    cluster: string | null;
    semanticComplexity: number;
  } | null;
  /** Cache key */
  cacheKey: string;
  /** Suggestions */
  suggestions: unknown[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Dispatch decision destination
 */
export type DispatchDestination = "local" | "cloud" | "hybrid";

/**
 * Resource specification for local processing
 */
export interface ResourceSpec {
  /** Resource type */
  type: ResourceType;
  /** Device ID (for multi-GPU systems) */
  deviceId?: string;
  /** Estimated utilization (0-1) */
  estimatedUtilization: number;
}

/**
 * Dispatch decision
 */
export interface DispatchDecision {
  /** Where to send the query */
  destination: DispatchDestination;

  /** Which local resource to use (if local/hybrid) */
  resource?: ResourceSpec;

  /** Why this decision was made */
  reasoning: {
    cpuAvailable: boolean;
    gpuAvailable: boolean;
    thermalOk: boolean;
    memoryOk: boolean;
    costConsideration: boolean;
    latencyRequirement: boolean;
    userConstraints: boolean;
  };

  /** Confidence in this decision (0-1) */
  confidence: number;

  /** Estimated latency for this decision (ms) */
  estimatedLatency: number;

  /** Estimated cost for this decision (USD) */
  estimatedCost: number;

  /** Additional notes */
  notes?: string[];
}

/**
 * Dispatch constraints
 */
export interface DispatchConstraints {
  /** Maximum acceptable latency (ms) */
  maxLatencyMs?: number;

  /** Maximum acceptable cost (USD) */
  maxCost?: number;

  /** Must stay local */
  requireLocal?: boolean;

  /** Must use GPU */
  requireGPU?: boolean;

  /** Thermal threshold (°C) */
  thermalThreshold?: number;

  /** Memory threshold (0-1) */
  memoryThreshold?: number;

  /** Prefer local processing */
  preferLocal?: boolean;

  /** Allow hybrid processing */
  allowHybrid?: boolean;
}

/**
 * Dispatch statistics
 */
export interface DispatchStats {
  /** Total dispatches */
  total: number;
  /** Local dispatches */
  local: number;
  /** Cloud dispatches */
  cloud: number;
  /** Hybrid dispatches */
  hybrid: number;
  /** Average confidence */
  averageConfidence: number;
  /** Average latency */
  averageLatency: number;
  /** Average cost */
  averageCost: number;
}

/**
 * Dispatcher configuration
 */
export interface DispatcherConfig {
  /** Hardware monitor configuration */
  hardwareMonitor?: {
    updateInterval?: number;
    thermalThresholds?: {
      normal: number;
      throttle: number;
      critical: number;
    };
    memoryThreshold?: number;
    cpuThreshold?: number;
    enableGPUMonitoring?: boolean;
    enableNetworkMonitoring?: boolean;
  };

  /** Thermal manager configuration */
  thermalManager?: {
    policy?: {
      normalThreshold?: number;
      throttleThreshold?: number;
      criticalThreshold?: number;
    };
    enableAutoActions?: boolean;
  };

  /** Default constraints */
  defaultConstraints?: DispatchConstraints;

  /** Enable statistics tracking */
  enableStats?: boolean;

  /** Cost per local request (USD) */
  costLocal?: number;

  /** Cost per cloud request (USD) */
  costCloud?: number;

  /** Estimated local latency (ms) */
  latencyLocal?: number;

  /** Estimated cloud latency (ms) */
  latencyCloud?: number;
}

/**
 * Default dispatcher configuration
 */
export const DEFAULT_DISPATCHER_CONFIG: DispatcherConfig = {
  costLocal: 0.0,
  costCloud: 0.002,
  latencyLocal: 100,
  latencyCloud: 500,
  enableStats: true,
};

/**
 * HardwareAwareDispatcher - Main dispatcher class
 */
export class HardwareAwareDispatcher {
  private hardwareMonitor: HardwareMonitor;
  private thermalManager: ThermalManager;
  private thermalIntegration: ThermalIntegration;
  private config: DispatcherConfig;
  private stats: DispatchStats;
  private started: boolean = false;

  constructor(config: DispatcherConfig = {}) {
    this.config = {
      ...DEFAULT_DISPATCHER_CONFIG,
      ...config,
    };

    // Initialize hardware monitor
    this.hardwareMonitor = new HardwareMonitor(this.config.hardwareMonitor);

    // Initialize thermal manager
    this.thermalManager = new ThermalManager({
      ...this.config.thermalManager,
      enableAutoActions: false, // We'll handle actions manually
    });

    // Initialize thermal integration
    this.thermalIntegration = createThermalIntegration(this.thermalManager);

    // Initialize stats
    this.stats = {
      total: 0,
      local: 0,
      cloud: 0,
      hybrid: 0,
      averageConfidence: 0,
      averageLatency: 0,
      averageCost: 0,
    };
  }

  /**
   * Start the dispatcher
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.hardwareMonitor.start();
    this.started = true;
  }

  /**
   * Stop the dispatcher
   */
  stop(): void {
    if (!this.started) {
      return;
    }

    this.hardwareMonitor.stop();
    this.thermalManager.dispose();
    this.thermalIntegration.dispose();
    this.started = false;
  }

  /**
   * Main dispatch decision method
   */
  async dispatch(
    query: RefinedQuery,
    constraints?: DispatchConstraints
  ): Promise<DispatchDecision> {
    // Merge with default constraints
    const mergedConstraints: DispatchConstraints = {
      ...this.config.defaultConstraints,
      ...constraints,
    };

    // Get current hardware state
    const hardwareState = await this.hardwareMonitor.captureState();

    // Get thermal recommendation
    const thermalRecommendation = await this.thermalIntegration.recommend(
      hardwareState.thermal
    );

    // Check if local processing is feasible
    const canProcessLocal = this.canProcessLocally(
      query,
      hardwareState,
      mergedConstraints
    );

    // Select best local resource
    const resource = canProcessLocal
      ? this.selectLocalResource(query, hardwareState, mergedConstraints)
      : undefined;

    // Make dispatch decision
    const decision = this.makeDispatchDecision(
      query,
      hardwareState,
      thermalRecommendation,
      canProcessLocal,
      resource,
      mergedConstraints
    );

    // Update statistics
    if (this.config.enableStats) {
      this.updateStats(decision);
    }

    return decision;
  }

  /**
   * Check if local processing is feasible
   */
  private canProcessLocally(
    query: RefinedQuery,
    state: HardwareState,
    constraints: DispatchConstraints
  ): boolean {
    // Check thermal state
    if (!this.isThermalOk(state, constraints)) {
      return false;
    }

    // Check memory
    if (!this.isMemoryOk(state, constraints)) {
      return false;
    }

    // Check user constraints
    if (constraints.requireLocal) {
      // If user requires local, we must try unless critical
      return state.thermal.zone !== "critical";
    }

    // Check GPU requirement
    if (constraints.requireGPU && (!state.gpu || !state.gpu.available)) {
      return false;
    }

    return state.canProcessLocal;
  }

  /**
   * Select best local resource
   */
  private selectLocalResource(
    query: RefinedQuery,
    state: HardwareState,
    constraints: DispatchConstraints
  ): ResourceSpec | undefined {
    const capabilities = assessCapabilities(state);

    if (!capabilities.recommendedResource) {
      return undefined;
    }

    const resourceType = capabilities.recommendedResource;

    // Build resource spec
    const spec: ResourceSpec = {
      type: resourceType,
      estimatedUtilization: this.estimateResourceUtilization(
        resourceType,
        query,
        state
      ),
    };

    // Add device ID for GPU
    if (resourceType === "gpu" && state.gpu?.deviceId) {
      spec.deviceId = state.gpu.deviceId;
    }

    return spec;
  }

  /**
   * Make dispatch decision based on all factors
   */
  private makeDispatchDecision(
    query: RefinedQuery,
    state: HardwareState,
    thermalRec: Awaited<ReturnType<typeof this.thermalIntegration.recommend>>,
    canProcessLocal: boolean,
    resource: ResourceSpec | undefined,
    constraints: DispatchConstraints
  ): DispatchDecision {
    // Start with thermal recommendation
    let destination: DispatchDestination = "cloud";
    const notes: string[] = [];

    // Apply thermal recommendation
    switch (thermalRec.action.type) {
      case "local":
        destination = "local";
        break;
      case "cloud":
        destination = "cloud";
        notes.push(`Thermal: ${thermalRec.action.reason}`);
        break;
      case "hybrid":
        destination = "hybrid";
        notes.push(`Thermal: ${thermalRec.action.reason}`);
        break;
      case "queue":
        // Treat queue as cloud for now
        destination = "cloud";
        notes.push(`Thermal: ${thermalRec.action.reason}`);
        break;
    }

    // Override if can't process locally
    if (!canProcessLocal && destination !== "cloud") {
      destination = "cloud";
      notes.push("Local processing not feasible");
    }

    // Check user constraints
    if (constraints.requireLocal && destination === "cloud") {
      if (state.thermal.zone === "critical") {
        notes.push("WARNING: User required local but in critical thermal zone");
      } else {
        destination = "local";
        notes.push("User override: requireLocal");
      }
    }

    // Check cost constraints
    if (constraints.maxCost !== undefined) {
      const cloudCost = this.config.costCloud ?? 0.002;
      if (destination !== "local" && cloudCost > constraints.maxCost) {
        if (canProcessLocal) {
          destination = "local";
          notes.push("Cost constraint: routing to local");
        } else {
          notes.push("WARNING: Cannot meet cost constraint");
        }
      }
    }

    // Check latency constraints
    if (constraints.maxLatencyMs !== undefined) {
      const cloudLatency = this.config.latencyCloud ?? 500;
      const localLatency = this.config.latencyLocal ?? 100;

      if (destination === "cloud" && cloudLatency > constraints.maxLatencyMs) {
        if (canProcessLocal && localLatency <= constraints.maxLatencyMs) {
          destination = "local";
          notes.push("Latency constraint: routing to local");
        } else {
          notes.push("WARNING: Cannot meet latency constraint");
        }
      }
    }

    // Apply preferLocal
    if (constraints.preferLocal && canProcessLocal && destination === "cloud") {
      destination = "local";
      notes.push("User preference: preferLocal");
    }

    // Check allowHybrid
    if (destination === "hybrid" && !constraints.allowHybrid) {
      destination = canProcessLocal ? "local" : "cloud";
      notes.push("Hybrid not allowed, falling back");
    }

    // Calculate confidence
    const confidence = this.calculateDecisionConfidence(
      destination,
      state,
      thermalRec
    );

    // Estimate latency and cost
    const estimatedLatency = this.estimateLatency(destination, query);
    const estimatedCost = this.estimateCost(destination, query);

    // Build reasoning
    const reasoning = {
      cpuAvailable: state.cpu.availableCores > 0,
      gpuAvailable: state.gpu?.available ?? false,
      thermalOk: state.thermal.zone !== "critical",
      memoryOk: state.memory.usageRatio < (constraints.memoryThreshold ?? 0.9),
      costConsideration: constraints.maxCost !== undefined,
      latencyRequirement: constraints.maxLatencyMs !== undefined,
      userConstraints: Object.keys(constraints).length > 0,
    };

    return {
      destination,
      resource,
      reasoning,
      confidence,
      estimatedLatency,
      estimatedCost,
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  /**
   * Calculate confidence in dispatch decision
   */
  private calculateDecisionConfidence(
    destination: DispatchDestination,
    state: HardwareState,
    thermalRec: Awaited<ReturnType<typeof this.thermalIntegration.recommend>>
  ): number {
    let confidence = thermalRec.confidence;

    // Adjust based on destination
    switch (destination) {
      case "local":
        confidence *= state.confidence;
        break;
      case "cloud":
        confidence *= 0.9; // Cloud is generally reliable
        break;
      case "hybrid":
        confidence *= 0.8; // Hybrid is more complex
        break;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Estimate resource utilization
   */
  private estimateResourceUtilization(
    resourceType: ResourceType,
    query: RefinedQuery,
    state: HardwareState
  ): number {
    // Base utilization on query complexity
    const baseUtilization = query.staticFeatures.complexity * 0.5 + 0.3;

    // Adjust for current load
    switch (resourceType) {
      case "cpu":
        return Math.min(1, baseUtilization + state.cpu.usage * 0.3);
      case "gpu":
        if (!state.gpu) return baseUtilization;
        return Math.min(1, baseUtilization + state.gpu.usage * 0.3);
      case "npu":
        return baseUtilization; // TODO: NPU utilization
    }
  }

  /**
   * Check if thermal state is OK
   */
  private isThermalOk(
    state: HardwareState,
    constraints: DispatchConstraints
  ): boolean {
    const threshold = constraints.thermalThreshold ?? 95;
    return state.thermal.cpu < threshold;
  }

  /**
   * Check if memory is OK
   */
  private isMemoryOk(
    state: HardwareState,
    constraints: DispatchConstraints
  ): boolean {
    const threshold = constraints.memoryThreshold ?? 0.9;
    return state.memory.usageRatio < threshold;
  }

  /**
   * Estimate latency for a destination
   */
  private estimateLatency(
    destination: DispatchDestination,
    query: RefinedQuery
  ): number {
    const baseLatency =
      destination === "local"
        ? (this.config.latencyLocal ?? 100)
        : destination === "cloud"
          ? (this.config.latencyCloud ?? 500)
          : (this.config.latencyLocal ?? 100) * 0.5 +
            (this.config.latencyCloud ?? 500) * 0.5;

    // Adjust for query complexity
    return baseLatency * (1 + query.staticFeatures.complexity);
  }

  /**
   * Estimate cost for a destination
   */
  private estimateCost(
    destination: DispatchDestination,
    query: RefinedQuery
  ): number {
    const baseCost =
      destination === "local"
        ? (this.config.costLocal ?? 0)
        : destination === "cloud"
          ? (this.config.costCloud ?? 0.002)
          : (this.config.costLocal ?? 0) * 0.5 +
            (this.config.costCloud ?? 0.002) * 0.5;

    // Adjust for query complexity
    return baseCost * (1 + query.staticFeatures.complexity * 0.5);
  }

  /**
   * Update dispatch statistics
   */
  private updateStats(decision: DispatchDecision): void {
    this.stats.total++;

    switch (decision.destination) {
      case "local":
        this.stats.local++;
        break;
      case "cloud":
        this.stats.cloud++;
        break;
      case "hybrid":
        this.stats.hybrid++;
        break;
    }

    // Update averages
    this.stats.averageConfidence =
      (this.stats.averageConfidence * (this.stats.total - 1) +
        decision.confidence) /
      this.stats.total;

    this.stats.averageLatency =
      (this.stats.averageLatency * (this.stats.total - 1) +
        decision.estimatedLatency) /
      this.stats.total;

    this.stats.averageCost =
      (this.stats.averageCost * (this.stats.total - 1) +
        decision.estimatedCost) /
      this.stats.total;
  }

  /**
   * Get dispatch statistics
   */
  getStats(): DispatchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      total: 0,
      local: 0,
      cloud: 0,
      hybrid: 0,
      averageConfidence: 0,
      averageLatency: 0,
      averageCost: 0,
    };
  }

  /**
   * Get current hardware state
   */
  async getHardwareState(): Promise<HardwareState | null> {
    return this.hardwareMonitor.getState();
  }

  /**
   * Get current thermal state
   */
  getThermalState() {
    return this.thermalIntegration.getCurrentState();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.hardwareMonitor.dispose();
  }
}

/**
 * Create a hardware-aware dispatcher with default configuration
 */
export function createHardwareAwareDispatcher(
  config?: DispatcherConfig
): HardwareAwareDispatcher {
  return new HardwareAwareDispatcher(config);
}
