/**
 * PowerAwareDispatcher - Battery-aware request routing and model selection
 *
 * Intelligently routes AI requests to appropriate models while considering
 * power consumption, battery status, and performance requirements.
 *
 * Strategies:
 * - Max Performance: Use fastest resources regardless of power
 * - Balanced: Balance performance and power efficiency
 * - Power Saver: Prefer efficient models and cloud offloading
 * - Max Battery: Minimize local computation, maximize cloud usage
 * - Adaptive: Dynamically adjust based on conditions
 *
 * @module power
 */

import { EventEmitter } from "events";
import { PowerStateController, PowerCost } from "./PowerStateController.js";
import { BatteryManager, PowerStrategy } from "./BatteryManager.js";

/**
 * Request type
 */
export type RequestType =
  | "embedding"
  | "inference"
  | "generation"
  | "ranscription"
  | "classification";

/**
 * Request complexity
 */
export type Complexity = "simple" | "medium" | "complex";

/**
 * Urgency level
 */
export type UrgencyLevel = "low" | "normal" | "high" | "critical";

/**
 * Dispatch request
 */
export interface DispatchRequest {
  id: string;
  type: RequestType;
  complexity: Complexity;
  payload: any;
  timeout?: number;
  max_latency?: number;
  max_power?: number;
  priority?: number;
}

/**
 * Model selection
 */
export interface ModelSelection {
  model: string;
  location: "local" | "cloud";
  estimated_latency: number;
  estimated_power: number;
  confidence: number;
}

/**
 * Dispatch decision
 */
export interface DispatchDecision {
  request_id: string;
  model: string;
  location: "local" | "cloud";
  power_state: PowerState;
  estimated_latency: number;
  estimated_power_cost: number;
  battery_impact: BatteryImpact;
  reasoning: string[];
  urgency: UrgencyLevel;
  strategy: PowerStrategy;
}

/**
 * Power state (simplified from PowerStateController)
 */
export interface PowerState {
  name: string;
  frequency: number;
  power_consumption: number;
}

/**
 * Battery impact
 */
export interface BatteryImpact {
  energy_consumed: number; // joules
  battery_drain: number; // percentage
  time_impact: Duration;
}

/**
 * Duration
 */
export interface Duration {
  value: number;
  unit: "milliseconds" | "seconds" | "minutes";
}

/**
 * Constraints
 */
export interface Constraints {
  max_latency?: number;
  max_power?: number;
  min_confidence?: number;
  allow_cloud?: boolean;
  prefer_local?: boolean;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  decision: DispatchDecision;
  score: number;
  alternatives: DispatchDecision[];
  pareto_front: boolean;
}

/**
 * Power-aware dispatcher configuration
 */
export interface PowerAwareDispatcherConfig {
  default_strategy?: PowerStrategy;
  cloud_fallback?: boolean;
  cache_power_costs?: boolean;
  update_costs_interval?: number;
}

/**
 * Model power profile
 */
interface ModelPowerProfile {
  name: string;
  location: "local" | "cloud";
  base_power: number; // watts
  base_latency: number; // ms
  complexity_multiplier: number;
  confidence: number;
}

/**
 * PowerAwareDispatcher - Main dispatch class
 *
 * @example
 * ```typescript
 * const powerController = new PowerStateController();
 * const batteryManager = new BatteryManager();
 * const dispatcher = new PowerAwareDispatcher(powerController, batteryManager);
 *
 * await dispatcher.initialize();
 *
 * const request: DispatchRequest = {
 *   id: 'req-1',
 *   type: 'inference',
 *   complexity: 'medium',
 *   payload: { query: 'Hello world' },
 * };
 *
 * const decision = dispatcher.dispatch(request);
 * console.log(`Routing to ${decision.model} (${decision.location})`);
 * ```
 */
export class PowerAwareDispatcher extends EventEmitter {
  private powerController: PowerStateController;
  private batteryManager: BatteryManager;
  private config: PowerAwareDispatcherConfig;
  private initialized: boolean = false;
  private currentStrategy: PowerStrategy;
  private currentUrgency: UrgencyLevel = "normal";
  private modelProfiles: Map<string, ModelPowerProfile> = new Map();
  private powerCostCache: Map<string, PowerCost> = new Map();
  private dispatchHistory: DispatchDecision[] = [];

  constructor(
    powerController: PowerStateController,
    batteryManager: BatteryManager,
    config: PowerAwareDispatcherConfig = {}
  ) {
    super();
    this.powerController = powerController;
    this.batteryManager = batteryManager;
    this.config = {
      default_strategy: config.default_strategy || "adaptive",
      cloud_fallback: config.cloud_fallback !== false,
      cache_power_costs: config.cache_power_costs !== false,
      update_costs_interval: config.update_costs_interval || 60000,
    };
    this.currentStrategy = this.config.default_strategy!;
    this.initialize_model_profiles();
  }

  /**
   * Initialize the dispatcher
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Wait for dependencies to be ready
    await Promise.all([
      this.powerController.initialize(),
      this.batteryManager.initialize(),
    ]);

    // Listen to battery events
    this.batteryManager.on("battery_low", status => {
      this.emit("battery_low", status);
      if (this.currentStrategy === "adaptive") {
        this.adjust_strategy_for_battery(status.level);
      }
    });

    this.batteryManager.on("battery_critical", status => {
      this.emit("battery_critical", status);
      if (this.currentStrategy === "adaptive") {
        this.currentStrategy = "max_battery";
        this.emit("strategy_changed", "max_battery", "battery_critical");
      }
    });

    this.batteryManager.on("power_source_changed", source => {
      this.emit("power_source_changed", source);
      if (this.currentStrategy === "adaptive") {
        this.adjust_strategy_for_power_source(source);
      }
    });

    this.initialized = true;
    this.emit("initialized");
  }

  /**
   * Initialize model power profiles
   */
  private initialize_model_profiles(): void {
    // Local models
    this.modelProfiles.set("llama-7b-local", {
      name: "llama-7b-local",
      location: "local",
      base_power: 15,
      base_latency: 800,
      complexity_multiplier: 1.5,
      confidence: 0.85,
    });

    this.modelProfiles.set("mistral-7b-local", {
      name: "mistral-7b-local",
      location: "local",
      base_power: 18,
      base_latency: 600,
      complexity_multiplier: 1.3,
      confidence: 0.88,
    });

    this.modelProfiles.set("gemma-2b-local", {
      name: "gemma-2b-local",
      location: "local",
      base_power: 5,
      base_latency: 200,
      complexity_multiplier: 1.2,
      confidence: 0.75,
    });

    this.modelProfiles.set("embeddings-local", {
      name: "embeddings-local",
      location: "local",
      base_power: 8,
      base_latency: 50,
      complexity_multiplier: 1.1,
      confidence: 0.95,
    });

    // Cloud models
    this.modelProfiles.set("gpt-4-turbo", {
      name: "gpt-4-turbo",
      location: "cloud",
      base_power: 0, // Local power for network
      base_latency: 2000,
      complexity_multiplier: 1.0,
      confidence: 0.97,
    });

    this.modelProfiles.set("gpt-3.5-turbo", {
      name: "gpt-3.5-turbo",
      location: "cloud",
      base_power: 0,
      base_latency: 1000,
      complexity_multiplier: 1.0,
      confidence: 0.92,
    });

    this.modelProfiles.set("claude-3-haiku", {
      name: "claude-3-haiku",
      location: "cloud",
      base_power: 0,
      base_latency: 800,
      complexity_multiplier: 1.0,
      confidence: 0.9,
    });
  }

  /**
   * Dispatch a single request
   */
  dispatch(request: DispatchRequest): DispatchDecision {
    if (!this.initialized) {
      throw new Error(
        "PowerAwareDispatcher not initialized. Call initialize() first."
      );
    }

    const strategy = this.get_effective_strategy();
    const batteryLevel = this.batteryManager.get_battery_status().level;
    const isOnBattery = this.batteryManager.is_on_battery();

    // Get suitable models for this request
    const candidates = this.get_candidate_models(request);

    // Score each candidate
    const scored = candidates.map(candidate => ({
      candidate,
      score: this.score_model(
        candidate,
        request,
        strategy,
        batteryLevel,
        isOnBattery
      ),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Select best model
    const selected = scored[0].candidate;
    const decision = this.create_decision(request, selected, strategy);

    // Cache power cost
    if (this.config.cache_power_costs) {
      const cacheKey = this.get_cost_cache_key(request);
      this.powerCostCache.set(cacheKey, {
        energy: decision.battery_impact.energy_consumed,
        power: decision.estimated_power_cost,
        time: decision.estimated_latency,
        battery_impact: decision.battery_impact.battery_drain,
      });
    }

    // Add to history
    this.dispatchHistory.push(decision);
    if (this.dispatchHistory.length > 1000) {
      this.dispatchHistory.shift();
    }

    this.emit("dispatch", decision);
    return decision;
  }

  /**
   * Dispatch multiple requests
   */
  dispatch_batch(requests: DispatchRequest[]): DispatchDecision[] {
    return requests.map(req => this.dispatch(req));
  }

  /**
   * Get candidate models for a request
   */
  private get_candidate_models(request: DispatchRequest): ModelPowerProfile[] {
    const candidates: ModelPowerProfile[] = [];

    for (const profile of this.modelProfiles.values()) {
      // Filter by request type
      if (request.type === "embedding" && !profile.name.includes("embed")) {
        continue;
      }

      // Check if cloud is allowed
      if (profile.location === "cloud" && request.max_power === 0) {
        continue; // Don't use cloud if power budget is very strict
      }

      candidates.push(profile);
    }

    return candidates;
  }

  /**
   * Score a model for a request
   */
  private score_model(
    model: ModelPowerProfile,
    request: DispatchRequest,
    strategy: PowerStrategy,
    batteryLevel: number,
    isOnBattery: boolean
  ): number {
    let score = 0;

    // Base score from model confidence
    score += model.confidence * 30;

    // Latency score (lower is better)
    const latencyScore = Math.max(0, 100 - model.base_latency / 100);
    score += latencyScore * 20;

    // Power score (lower is better)
    const powerScore = Math.max(0, 100 - model.base_power / 2);
    score += powerScore * 20;

    // Strategy-specific scoring
    switch (strategy) {
      case "max_performance":
        // Prefer fast, high-confidence models
        score += model.confidence * 20;
        score += (model.base_power / 50) * 10; // More power is OK
        if (model.location === "local") score += 15; // Prefer local for speed
        break;

      case "balanced":
        // Balance all factors
        score += latencyScore * 10;
        score += powerScore * 10;
        score += model.confidence * 10;
        break;

      case "power_saver":
        // Prefer low power
        score += (100 - model.base_power) * 25;
        if (model.location === "cloud") score += 10; // Offload is good
        break;

      case "max_battery":
        // Minimize local power
        score += (100 - model.base_power) * 30;
        if (model.location === "cloud") score += 20; // Prefer offload
        score -= model.base_latency / 100; // Don't care about latency
        break;

      case "adaptive":
        // Adapt based on conditions
        if (isOnBattery) {
          if (batteryLevel < 20) {
            // Low battery: maximize efficiency
            score += (100 - model.base_power) * 25;
            if (model.location === "cloud") score += 15;
          } else if (batteryLevel < 50) {
            // Medium battery: balanced
            score += powerScore * 15;
            score += latencyScore * 10;
          } else {
            // High battery: can use more power
            score += model.confidence * 15;
            score += latencyScore * 15;
          }
        } else {
          // On AC: maximize performance
          score += model.confidence * 20;
          score += latencyScore * 15;
          if (model.location === "local") score += 10;
        }
        break;
    }

    // Urgency adjustment
    if (this.currentUrgency === "critical" || this.currentUrgency === "high") {
      // For urgent requests, prioritize speed and confidence
      score += model.confidence * 15;
      score += latencyScore * 15;
      if (model.location === "local") score += 10;
    } else if (this.currentUrgency === "low") {
      // For low urgency, prioritize efficiency
      score += powerScore * 15;
      if (model.location === "cloud") score += 5;
    }

    // Complexity adjustment
    const complexityMultiplier = this.get_complexity_multiplier(
      request.complexity
    );
    if (request.complexity === "complex") {
      // Complex queries need better models
      score += model.confidence * 10;
    }

    return score;
  }

  /**
   * Get complexity multiplier
   */
  private get_complexity_multiplier(complexity: Complexity): number {
    switch (complexity) {
      case "simple":
        return 0.5;
      case "medium":
        return 1.0;
      case "complex":
        return 2.0;
    }
  }

  /**
   * Create dispatch decision
   */
  private create_decision(
    request: DispatchRequest,
    model: ModelPowerProfile,
    strategy: PowerStrategy
  ): DispatchDecision {
    const powerState = this.powerController.get_current_power_state();
    const batteryStatus = this.batteryManager.get_battery_status();

    // Calculate latency
    const baseLatency = model.base_latency;
    const complexityMultiplier = this.get_complexity_multiplier(
      request.complexity
    );
    const estimatedLatency = baseLatency * complexityMultiplier;

    // Calculate power cost
    const powerCost = this.estimate_power_cost(model.name, request);

    return {
      request_id: request.id,
      model: model.name,
      location: model.location,
      power_state: {
        name: powerState.name,
        frequency: powerState.frequency,
        power_consumption: powerState.power_consumption,
      },
      estimated_latency: estimatedLatency,
      estimated_power_cost: powerCost.power,
      battery_impact: {
        energy_consumed: powerCost.energy,
        battery_drain: powerCost.battery_impact,
        time_impact: {
          value: Math.round(powerCost.time),
          unit: "milliseconds",
        },
      },
      reasoning: this.generate_reasoning(
        model,
        request,
        strategy,
        batteryStatus
      ),
      urgency: this.currentUrgency,
      strategy,
    };
  }

  /**
   * Generate reasoning for decision
   */
  private generate_reasoning(
    model: ModelPowerProfile,
    request: DispatchRequest,
    strategy: PowerStrategy,
    batteryStatus: any
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Model: ${model.name} (${model.location})`);
    reasoning.push(`Strategy: ${strategy}`);
    reasoning.push(
      `Battery: ${batteryStatus.level}% (${batteryStatus.is_charging ? "charging" : "discharging"})`
    );
    reasoning.push(`Complexity: ${request.complexity}`);
    reasoning.push(`Urgency: ${this.currentUrgency}`);

    if (model.location === "cloud") {
      reasoning.push("Selected cloud model to reduce local power consumption");
    } else {
      reasoning.push(
        "Selected local model for lower latency and no cloud costs"
      );
    }

    if (strategy === "max_battery" || strategy === "power_saver") {
      reasoning.push("Power-saving strategy prioritizes efficiency over speed");
    } else if (strategy === "max_performance") {
      reasoning.push("Performance strategy prioritizes speed and quality");
    }

    return reasoning;
  }

  /**
   * Select model for a given power budget
   */
  select_model_for_power(
    request: DispatchRequest,
    powerBudget: number
  ): ModelSelection {
    const candidates = this.get_candidate_models(request);
    const batteryLevel = this.batteryManager.get_battery_status().level;

    // Filter by power budget
    const viable = candidates.filter(c => c.base_power <= powerBudget);

    if (viable.length === 0) {
      // No model fits budget, use cloud
      const cloudModel = candidates.find(c => c.location === "cloud");
      if (cloudModel) {
        return {
          model: cloudModel.name,
          location: "cloud",
          estimated_latency:
            cloudModel.base_latency *
            this.get_complexity_multiplier(request.complexity),
          estimated_power: 0,
          confidence: cloudModel.confidence,
        };
      }
    }

    // Select best viable model
    const scored = viable.map(c => ({
      model: c,
      score: this.score_model(
        c,
        request,
        this.currentStrategy,
        batteryLevel,
        this.batteryManager.is_on_battery()
      ),
    }));

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0].model;

    return {
      model: selected.name,
      location: selected.location,
      estimated_latency:
        selected.base_latency *
        this.get_complexity_multiplier(request.complexity),
      estimated_power: selected.base_power,
      confidence: selected.confidence,
    };
  }

  /**
   * Estimate power cost for a model and request
   */
  estimate_power_cost(model: string, request: DispatchRequest): PowerCost {
    const cacheKey = this.get_cost_cache_key(request);
    const cached = this.powerCostCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const profile = this.modelProfiles.get(model);
    if (!profile) {
      return {
        energy: 0,
        power: 0,
        time: 0,
        battery_impact: 0,
      };
    }

    const complexityMultiplier = this.get_complexity_multiplier(
      request.complexity
    );
    const power = profile.base_power * complexityMultiplier;
    const time = profile.base_latency * complexityMultiplier;
    const energy = (power * time) / 1000; // joules

    // Estimate battery impact
    const batteryCapacity = 180000; // 50 Wh in joules
    const batteryImpact = (energy / batteryCapacity) * 100;

    return {
      energy,
      power,
      time,
      battery_impact: batteryImpact,
    };
  }

  /**
   * Optimize power vs performance tradeoff
   */
  optimize_power_performance(
    request: DispatchRequest,
    constraints: Constraints
  ): OptimizationResult {
    const candidates = this.get_candidate_models(request);
    const batteryLevel = this.batteryManager.get_battery_status().level;
    const isOnBattery = this.batteryManager.is_on_battery();

    // Score all candidates
    const scored = candidates.map(candidate => {
      const score = this.score_model(
        candidate,
        request,
        this.currentStrategy,
        batteryLevel,
        isOnBattery
      );
      const power = this.estimate_power_cost(candidate.name, request);
      const latency =
        candidate.base_latency *
        this.get_complexity_multiplier(request.complexity);

      return {
        candidate,
        score,
        power: power.power,
        latency,
        confidence: candidate.confidence,
      };
    });

    // Check constraints
    const viable = scored.filter(s => {
      if (constraints.max_latency && s.latency > constraints.max_latency)
        return false;
      if (constraints.max_power && s.power > constraints.max_power)
        return false;
      if (
        constraints.min_confidence &&
        s.confidence < constraints.min_confidence
      )
        return false;
      if (!constraints.allow_cloud && s.candidate.location === "cloud")
        return false;
      return true;
    });

    // If no viable models, relax constraints
    const finalCandidates = viable.length > 0 ? viable : scored;

    // Sort by score
    finalCandidates.sort((a, b) => b.score - a.score);

    const selected = finalCandidates[0];
    const decision = this.create_decision(
      request,
      selected.candidate,
      this.currentStrategy
    );

    // Check if on Pareto front (no other candidate is better in both dimensions)
    const paretoFront = this.is_pareto_optimal(selected, finalCandidates);

    // Generate alternatives
    const alternatives = finalCandidates
      .slice(1, 4)
      .map(c =>
        this.create_decision(request, c.candidate, this.currentStrategy)
      );

    return {
      decision,
      score: selected.score,
      alternatives,
      pareto_front: paretoFront,
    };
  }

  /**
   * Check if a solution is Pareto optimal
   */
  private is_pareto_optimal(selected: any, candidates: any[]): boolean {
    for (const other of candidates) {
      if (other === selected) continue;

      // Check if other dominates selected (better in both power and latency)
      if (other.power < selected.power && other.latency < selected.latency) {
        return false;
      }
    }
    return true;
  }

  /**
   * Find optimal power state for target performance
   */
  find_optimal_power_state(targetPerformance: number): PowerState {
    const availableStates = this.powerController.get_available_power_states();

    // Find state that meets performance with minimum power
    for (const state of availableStates) {
      if (state.frequency >= targetPerformance) {
        return state;
      }
    }

    // If no state meets target, return max
    return availableStates[0];
  }

  /**
   * Set urgency level
   */
  set_urgency(level: UrgencyLevel): void {
    this.currentUrgency = level;
    this.emit("urgency_changed", level);
  }

  /**
   * Get current urgency level
   */
  get_urgency(): UrgencyLevel {
    return this.currentUrgency;
  }

  /**
   * Adjust dispatch decision based on urgency
   */
  adjust_for_urgency(request: DispatchRequest): DispatchDecision {
    const previousUrgency = this.currentUrgency;

    // Set urgency based on request
    if (request.priority && request.priority > 0.8) {
      this.currentUrgency = "critical";
    } else if (request.priority && request.priority > 0.5) {
      this.currentUrgency = "high";
    } else if (request.priority && request.priority < 0.2) {
      this.currentUrgency = "low";
    }

    const decision = this.dispatch(request);

    // Restore previous urgency
    this.currentUrgency = previousUrgency;

    return decision;
  }

  /**
   * Set power strategy
   */
  set_power_strategy(strategy: PowerStrategy): void {
    this.currentStrategy = strategy;
    this.emit("strategy_changed", strategy, "manual");
  }

  /**
   * Get current power strategy
   */
  get_power_strategy(): PowerStrategy {
    return this.currentStrategy;
  }

  /**
   * Get effective strategy (considering adaptive mode)
   */
  private get_effective_strategy(): PowerStrategy {
    if (this.currentStrategy !== "adaptive") {
      return this.currentStrategy;
    }

    // Auto-determine strategy based on conditions
    const batteryStatus = this.batteryManager.get_battery_status();
    const isOnBattery = this.batteryManager.is_on_battery();

    if (!isOnBattery) {
      return "max_performance";
    }

    if (batteryStatus.level < 20) {
      return "max_battery";
    } else if (batteryStatus.level < 50) {
      return "power_saver";
    } else {
      return "balanced";
    }
  }

  /**
   * Adjust strategy based on battery level
   */
  private adjust_strategy_for_battery(level: number): void {
    if (level < 20) {
      this.currentStrategy = "max_battery";
    } else if (level < 50) {
      this.currentStrategy = "power_saver";
    } else {
      this.currentStrategy = "balanced";
    }
    this.emit("strategy_changed", this.currentStrategy, "battery_level");
  }

  /**
   * Adjust strategy based on power source
   */
  private adjust_strategy_for_power_source(source: string): void {
    if (source === "ac") {
      this.currentStrategy = "max_performance";
    } else {
      this.currentStrategy = "balanced";
    }
    this.emit("strategy_changed", this.currentStrategy, "power_source");
  }

  /**
   * Get cache key for power costs
   */
  private get_cost_cache_key(request: DispatchRequest): string {
    return `${request.type}-${request.complexity}`;
  }

  /**
   * Get dispatch statistics
   */
  get_statistics(): {
    total_dispatches: number;
    local_percentage: number;
    cloud_percentage: number;
    average_latency: number;
    average_power: number;
    by_strategy: Record<PowerStrategy, number>;
  } {
    const total = this.dispatchHistory.length;
    if (total === 0) {
      return {
        total_dispatches: 0,
        local_percentage: 0,
        cloud_percentage: 0,
        average_latency: 0,
        average_power: 0,
        by_strategy: {} as any,
      };
    }

    const local = this.dispatchHistory.filter(
      d => d.location === "local"
    ).length;
    const avgLatency =
      this.dispatchHistory.reduce((sum, d) => sum + d.estimated_latency, 0) /
      total;
    const avgPower =
      this.dispatchHistory.reduce((sum, d) => sum + d.estimated_power_cost, 0) /
      total;

    const byStrategy: Record<string, number> = {};
    for (const decision of this.dispatchHistory) {
      byStrategy[decision.strategy] = (byStrategy[decision.strategy] || 0) + 1;
    }

    return {
      total_dispatches: total,
      local_percentage: (local / total) * 100,
      cloud_percentage: ((total - local) / total) * 100,
      average_latency: avgLatency,
      average_power: avgPower,
      by_strategy: byStrategy as any,
    };
  }

  /**
   * Clear dispatch history
   */
  clear_history(): void {
    this.dispatchHistory = [];
    this.powerCostCache.clear();
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.removeAllListeners();
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  is_initialized(): boolean {
    return this.initialized;
  }
}
