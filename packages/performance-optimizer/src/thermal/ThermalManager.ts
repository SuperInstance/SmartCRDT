/**
 * ThermalManager - Integrated thermal and power management system
 *
 * Combines:
 * - ThermalMonitor for temperature tracking
 * - ThrottlingDetector for performance analysis
 * - PowerManager for DVFS control
 * - PredictiveThermalModel for proactive management
 *
 * Provides unified thermal management interface.
 */

import { EventEmitter } from "events";
import { ThermalMonitor } from "./ThermalMonitor.js";
import { ThrottlingDetector } from "./ThrottlingDetector.js";
import { PowerManager } from "./PowerManager.js";
import { PredictiveThermalModel } from "./PredictiveThermalModel.js";
import type {
  IThermalManager,
  ThermalManagementConfig,
  ThermalState,
  PowerState,
  PowerState as PowerStateType,
  PowerStateTransition,
  PowerTransitionReason,
  ThermalPrediction,
  ThermalEvent,
  ThermalEventType,
  ThermalComponent,
  ThrottlingDetectionResult,
  ThermalStatistics,
  PowerPolicy,
  ThermalAction,
  WorkloadType,
} from "@lsi/protocol";

/**
 * ThermalManager - Main thermal management system
 */
export class ThermalManager extends EventEmitter implements IThermalManager {
  private config: ThermalManagementConfig;
  private monitor: ThermalMonitor;
  private detector: ThrottlingDetector;
  private powerManager: PowerManager;
  private predictiveModel: PredictiveThermalModel;
  private isRunning: boolean;
  private eventListeners: Map<ThermalEventType, Set<Function>>;
  private proactiveActions: Map<ThermalComponent, ThermalAction>;

  constructor(config: ThermalManagementConfig) {
    super();

    this.config = config;
    this.isRunning = false;
    this.eventListeners = new Map();
    this.proactiveActions = new Map();

    // Initialize subsystems
    this.monitor = new ThermalMonitor({
      thermalZones: config.thermalZones,
    });

    this.detector = new ThrottlingDetector({
      baselineSamples: 100,
      performanceThreshold: 0.15,
    });

    this.powerManager = new PowerManager({
      defaultPolicy: config.powerPolicy,
      enableAutoTransition: config.enableProactiveThrottling,
      thermalThreshold: config.proactiveThreshold,
    });

    this.predictiveModel = new PredictiveThermalModel(config.predictionConfig);

    // Wire up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Get current thermal state
   */
  getThermalState(): ThermalState {
    return this.monitor.getThermalState();
  }

  /**
   * Get thermal state for specific component
   */
  async getComponentTemperature(component: ThermalComponent): Promise<{
    celsius: number;
    fahrenheit: number;
    timestamp: number;
    component: ThermalComponent;
    status: import("/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.js").ThermalStatus;
  }> {
    return this.monitor.getComponentTemperature(component);
  }

  /**
   * Detect throttling
   */
  async detectThrottling(): Promise<ThrottlingDetectionResult> {
    return this.detector.detectThrottling();
  }

  /**
   * Get current power state
   */
  getPowerState(): PowerStateType {
    return this.powerManager.getPowerState();
  }

  /**
   * Request power state transition
   */
  async requestPowerState(
    component: ThermalComponent,
    toState: import("/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.js").PowerState,
    reason: PowerTransitionReason
  ): Promise<PowerStateTransition> {
    return this.powerManager.requestPowerState(component, toState, reason);
  }

  /**
   * Predict future temperature
   */
  async predictTemperature(
    component: ThermalComponent,
    horizon: number
  ): Promise<ThermalPrediction> {
    return this.predictiveModel.predictTemperature(component, horizon);
  }

  /**
   * Register event listener
   */
  on(event: ThermalEventType, listener: (event: ThermalEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unregister event listener
   */
  off(event: ThermalEventType, listener: (event: ThermalEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Get thermal statistics
   */
  getStatistics(windowStart: number, windowEnd: number): ThermalStatistics {
    const historicalData = this.monitor.getHistoricalData();
    const filteredData = historicalData.filter(
      (d) => d.timestamp >= windowStart && d.timestamp <= windowEnd
    );

    if (filteredData.length === 0) {
      return this.createEmptyStatistics(windowStart, windowEnd);
    }

    // Calculate statistics
    const averageTemperatures = new Map<ThermalComponent, number>();
    const peakTemperatures = new Map<ThermalComponent, number>();
    const timeInStatus = new Map<
      import("/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.js").ThermalStatus,
      number
    >();
    let totalThrottleTime = 0;
    let throttleEventCount = 0;
    let totalPowerConsumption = 0;
    let peakPowerConsumption = 0;

    // Initialize maps
    for (const component of [ThermalComponent.CPU, ThermalComponent.GPU, ThermalComponent.MEMORY]) {
      const temps: number[] = [];
      filteredData.forEach((data) => {
        const temp = data.temperatures.get(component);
        if (temp !== undefined) {
          temps.push(temp);
        }
      });

      if (temps.length > 0) {
        averageTemperatures.set(
          component,
          temps.reduce((sum, t) => sum + t, 0) / temps.length
        );
        peakTemperatures.set(component, Math.max(...temps));
      }
    }

    // Count time in each status
    const statusCounts = new Map<
      import("/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.js").ThermalStatus,
      number
    >();
    filteredData.forEach((data) => {
      statusCounts.set(data.status, (statusCounts.get(data.status) || 0) + 1);
      totalPowerConsumption += data.powerConsumption;
      peakPowerConsumption = Math.max(peakPowerConsumption, data.powerConsumption);
    });

    for (const [status, count] of statusCounts) {
      timeInStatus.set(status, count * 60000); // Assume 1-minute intervals
    }

    // Get throttling statistics
    const throttleHistory = this.detector.getHistory();
    const windowThrottling = throttleHistory.filter(
      (e) => e.timestamp >= windowStart && e.timestamp <= windowEnd
    );
    totalThrottleTime = windowThrottling.reduce((sum, e) => sum + e.duration, 0);
    throttleEventCount = windowThrottling.length;

    return {
      windowStart,
      windowEnd,
      averageTemperatures,
      peakTemperatures,
      timeInStatus,
      totalThrottleTime,
      throttleEventCount,
      averagePowerConsumption: totalPowerConsumption / filteredData.length,
      peakPowerConsumption,
    };
  }

  /**
   * Start thermal management
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start all subsystems
    await this.monitor.start();
    await this.detector.start();
    await this.powerManager.start();

    // Start proactive management loop
    if (this.config.enableProactiveThrottling) {
      this.startProactiveManagement();
    }

    this.emit("thermal:started");
  }

  /**
   * Stop thermal management
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop all subsystems
    await this.monitor.stop();
    await this.detector.stop();
    await this.powerManager.stop();

    this.emit("thermal:stopped");
  }

  /**
   * Set power policy
   */
  setPowerPolicy(policy: PowerPolicy): void {
    this.powerManager.setPowerPolicy(policy);
  }

  /**
   * Get thermal event history
   */
  getEventHistory(): ThermalEvent[] {
    const events: ThermalEvent[] = [];

    // Collect events from all sources
    const state = this.getThermalState();
    const throttling = this.detector.getActiveEvents();

    // Add temperature status events
    for (const [component, reading] of state.readings) {
      if (reading.status !== "normal") {
        events.push({
          type: ThermalEventType.THRESHOLD_EXCEEDED,
          component,
          temperature: reading.celsius,
          severity: reading.status,
          timestamp: reading.timestamp,
          message: `Component ${component} is ${reading.status}`,
        });
      }
    }

    // Add throttling events
    for (const throttle of throttling) {
      events.push({
        type: ThermalEventType.THROTTLING_DETECTED,
        component: throttle.component,
        temperature: throttle.temperature,
        severity: throttle.severity > 0.7 ? "critical" : "hot",
        timestamp: throttle.timestamp,
        message: `Throttling detected: ${throttle.type}`,
        action: this.detector.getRecommendedAction(),
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Setup event forwarding between subsystems
   */
  private setupEventForwarding(): void {
    // Monitor events
    this.monitor.on("temperature:updated", ({ component, reading }) => {
      this.detector.recordTemperature(reading);
      this.emit("temperature:updated", { component, reading });

      // Check for status changes
      if (reading.status !== "normal") {
        this.handleThermalEvent(component, reading);
      }
    });

    this.monitor.on("status:changed", ({ component, oldStatus, newStatus }) => {
      this.emit("status:changed", { component, oldStatus, newStatus });

      // Apply power adjustments
      if (this.config.enableProactiveThrottling) {
        this.powerManager.applyThermalConstraints(component, reading.celsius, newStatus);
      }
    });

    // Detector events
    this.detector.on("throttling:detected", (event) => {
      this.emit("throttling:detected", event);

      if (this.config.enableProactiveThrottling) {
        this.handleThrottlingEvent(event);
      }
    });

    this.detector.on("throttling:stopped", (event) => {
      this.emit("throttling:stopped", event);
    });

    // Power manager events
    this.powerManager.on("power:transition", (transition) => {
      this.emit("power:transition", transition);
    });

    this.powerManager.on("policy:changed", ({ oldPolicy, newPolicy }) => {
      this.emit("policy:changed", { oldPolicy, newPolicy });
    });

    // Predictive model events
    this.predictiveModel.on("prediction:generated", (prediction) => {
      this.emit("prediction:generated", prediction);

      if (this.config.enableProactiveThrottling && prediction.recommendedAction) {
        this.handlePredictiveAction(prediction);
      }
    });
  }

  /**
   * Handle thermal event
   */
  private handleThermalEvent(
    component: ThermalComponent,
    reading: {
      celsius: number;
      status: import("/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.js").ThermalStatus;
    }
  ): void {
    const event: ThermalEvent = {
      type: ThermalEventType.THRESHOLD_EXCEEDED,
      component,
      temperature: reading.celsius,
      severity: reading.status,
      timestamp: Date.now(),
      message: `Component ${component} temperature: ${reading.celsius}°C (${reading.status})`,
    };

    this.notifyListeners(event);
  }

  /**
   * Handle throttling event
   */
  private handleThrottlingEvent(event: {
    component: ThermalComponent;
    temperature: number;
    severity: number;
  }): void {
    const action = this.detector.getRecommendedAction();

    const thermalEvent: ThermalEvent = {
      type: ThermalEventType.THROTTLING_DETECTED,
      component: event.component,
      temperature: event.temperature,
      severity: event.severity > 0.7 ? "critical" : "hot",
      timestamp: Date.now(),
      message: `Throttling detected on ${event.component} at ${event.temperature}°C`,
      action,
    };

    this.notifyListeners(thermalEvent);
  }

  /**
   * Handle predictive action
   */
  private handlePredictiveAction(prediction: {
    component: ThermalComponent;
    predictedTemperature: number;
    recommendedAction: ThermalAction;
  }): void {
    if (prediction.recommendedAction === ThermalAction.NONE) {
      return;
    }

    const event: ThermalEvent = {
      type: ThermalEventType.PREDICTIVE_ALERT,
      component: prediction.component,
      temperature: prediction.predictedTemperature,
      severity: "warm",
      timestamp: Date.now(),
      message: `Predicted temperature ${prediction.predictedTemperature}°C for ${prediction.component}`,
      action: prediction.recommendedAction,
    };

    this.notifyListeners(event);

    // Execute proactive action
    this.executeProactiveAction(prediction.component, prediction.recommendedAction);
  }

  /**
   * Execute proactive thermal action
   */
  private executeProactiveAction(component: ThermalComponent, action: ThermalAction): void {
    switch (action) {
      case ThermalAction.REDUCE_LOAD:
        // Signal workload manager to reduce load
        this.emit("action:reduce_load", { component });
        break;

      case ThermalAction.THROTTLE_CPU:
        this.powerManager
          .requestPowerState(component, "P3" as any, PowerTransitionReason.PREDICTIVE)
          .catch((err) => this.emit("error", err));
        break;

      case ThermalAction.THROTTLE_GPU:
        this.powerManager
          .requestPowerState(component, "P3" as any, PowerTransitionReason.PREDICTIVE)
          .catch((err) => this.emit("error", err));
        break;

      case ThermalAction.PAUSE_COMPUTE:
        this.emit("action:pause_compute", { component });
        break;

      case ThermalAction.INCREASE_FANS:
        this.emit("action:increase_cooling", { component });
        break;
    }
  }

  /**
   * Start proactive management loop
   */
  private startProactiveManagement(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }

      // Generate predictions for all components
      for (const component of this.config.thermalZones.map((z) => z.component)) {
        try {
          const prediction = await this.predictTemperature(component, 60);
          if (prediction.recommendedAction && prediction.recommendedAction !== ThermalAction.NONE) {
            this.executeProactiveAction(component, prediction.recommendedAction);
          }
        } catch (err) {
          // Prediction failed, continue
        }
      }
    }, this.config.predictionConfig.updateInterval);
  }

  /**
   * Notify event listeners
   */
  private notifyListeners(event: ThermalEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          this.emit("error", err);
        }
      }
    }
  }

  /**
   * Create empty statistics
   */
  private createEmptyStatistics(windowStart: number, windowEnd: number): ThermalStatistics {
    return {
      windowStart,
      windowEnd,
      averageTemperatures: new Map(),
      peakTemperatures: new Map(),
      timeInStatus: new Map(),
      totalThrottleTime: 0,
      throttleEventCount: 0,
      averagePowerConsumption: 0,
      peakPowerConsumption: 0,
    };
  }
}
