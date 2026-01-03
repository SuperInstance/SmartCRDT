/**
 * PowerManager - Dynamic voltage and frequency scaling (DVFS) management
 *
 * Provides:
 * - Power state management (P-states)
 * - Power consumption monitoring
 * - Adaptive power policy
 * - Workload-aware power optimization
 */

import { EventEmitter } from "events";
import type {
  PowerState,
  PowerReading,
  PowerState as PowerStateType,
  PowerPolicy,
  PowerStateTransition,
  PowerTransitionReason,
  ThermalComponent,
  ThermalStatus,
  WorkloadCharacteristics,
} from "@lsi/protocol";

/**
 * Power state configuration
 */
export interface PowerStateConfig {
  /** Component being managed */
  component: ThermalComponent;
  /** Current power state */
  currentState: PowerState;
  /** Minimum allowed power state */
  minState: PowerState;
  /** Maximum allowed power state */
  maxState: PowerState;
  /** Transition latency (ms) */
  transitionLatency: number;
  /** Power consumption by state (Watts) */
  powerByState: Map<PowerState, number>;
  /** Performance factor by state (0-1) */
  performanceByState: Map<PowerState, number>;
}

/**
 * Power manager configuration
 */
export interface PowerManagerConfig {
  /** Default power policy */
  defaultPolicy: PowerPolicy;
  /** Whether to enable automatic power transitions */
  enableAutoTransition: boolean;
  /** Temperature threshold for power reduction (°C) */
  thermalThreshold: number;
  /** Battery threshold for power saving (%) */
  batteryThreshold: number;
  /** Update interval (ms) */
  updateInterval: number;
}

/**
 * Power manager state
 */
export interface PowerManagerState {
  /** Power states by component */
  componentStates: Map<ThermalComponent, PowerStateConfig>;
  /** Current power readings */
  currentReadings: Map<ThermalComponent, PowerReading>;
  /** Current policy */
  currentPolicy: PowerPolicy;
  /** Total power consumption */
  totalPowerConsumption: number;
  /** Is running */
  isRunning: boolean;
}

/**
 * PowerManager class
 */
export class PowerManager extends EventEmitter {
  private config: PowerManagerConfig;
  private state: PowerManagerState;
  private updateInterval?: NodeJS.Timeout;

  constructor(config: PowerManagerConfig = {}) {
    super();

    this.config = {
      defaultPolicy: config.defaultPolicy || PowerPolicy.BALANCED,
      enableAutoTransition: config.enableAutoTransition ?? true,
      thermalThreshold: config.thermalThreshold || 75,
      batteryThreshold: config.batteryThreshold || 20,
      updateInterval: config.updateInterval || 5000,
    };

    this.state = {
      componentStates: new Map(),
      currentReadings: new Map(),
      currentPolicy: this.config.defaultPolicy,
      totalPowerConsumption: 0,
      isRunning: false,
    };

    this.initializeDefaultStates();
  }

  /**
   * Start power management
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;

    if (this.config.enableAutoTransition) {
      this.updateInterval = setInterval(() => {
        this.evaluatePowerTransitions();
      }, this.config.updateInterval);
    }

    this.emit("power:started");
  }

  /**
   * Stop power management
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      return;
    }

    this.state.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.emit("power:stopped");
  }

  /**
   * Get current power state
   */
  getPowerState(): PowerConsumptionState {
    const readings = Array.from(this.state.currentReadings.values());

    return {
      readings: this.state.currentReadings,
      totalWatts: this.state.totalPowerConsumption,
      cpuPowerPercentage: this.calculatePowerPercentage(ThermalComponent.CPU),
      gpuPowerPercentage: this.calculatePowerPercentage(ThermalComponent.GPU),
      currentPolicy: this.state.currentPolicy,
    };
  }

  /**
   * Request power state transition
   */
  async requestPowerState(
    component: ThermalComponent,
    toState: PowerState,
    reason: PowerTransitionReason
  ): Promise<PowerStateTransition> {
    const componentState = this.state.componentStates.get(component);
    if (!componentState) {
      throw new Error(`No power state configuration for component: ${component}`);
    }

    const fromState = componentState.currentState;

    // Validate transition
    if (toState === fromState) {
      return this.createTransition(component, fromState, toState, reason, 0, 0);
    }

    const stateOrder = [PowerState.P0, PowerState.P1, PowerState.P2, PowerState.P3, PowerState.P4];
    const fromIndex = stateOrder.indexOf(fromState);
    const toIndex = stateOrder.indexOf(toState);

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Invalid power state`);
    }

    // Check bounds
    const minIndex = stateOrder.indexOf(componentState.minState);
    const maxIndex = stateOrder.indexOf(componentState.maxState);

    if (toIndex < minIndex || toIndex > maxIndex) {
      throw new Error(
        `Requested state ${toState} is outside allowed range [${componentState.minState}, ${componentState.maxState}]`
      );
    }

    // Perform transition
    componentState.currentState = toState;

    const performanceImpact =
      componentState.performanceByState.get(toState)! -
      componentState.performanceByState.get(fromState)!;

    const powerSavings =
      componentState.powerByState.get(fromState)! -
      componentState.powerByState.get(toState)!;

    // Update readings
    const newReading = this.createPowerReading(component, toState);
    this.state.currentReadings.set(component, newReading);
    this.updateTotalPower();

    const transition = this.createTransition(
      component,
      fromState,
      toState,
      reason,
      performanceImpact,
      powerSavings
    );

    this.emit("power:transition", transition);

    return transition;
  }

  /**
   * Set power policy
   */
  setPowerPolicy(policy: PowerPolicy): void {
    const oldPolicy = this.state.currentPolicy;
    this.state.currentPolicy = policy;

    this.emit("policy:changed", { oldPolicy, newPolicy: policy });

    // Apply policy immediately
    if (this.state.isRunning) {
      this.applyPowerPolicy(policy);
    }
  }

  /**
   * Record power reading
   */
  recordPowerReading(reading: PowerReading): void {
    this.state.currentReadings.set(reading.component, reading);
    this.updateTotalPower();

    this.emit("power:reading", reading);
  }

  /**
   * Get power state configuration
   */
  getComponentState(component: ThermalComponent): PowerStateConfig | undefined {
    return this.state.componentStates.get(component);
  }

  /**
   * Update component power state configuration
   */
  updateComponentState(config: PowerStateConfig): void {
    this.state.componentStates.set(config.component, config);
    this.emit("config:updated", config);
  }

  /**
   * Apply thermal constraints to power states
   */
  applyThermalConstraints(
    component: ThermalComponent,
    temperature: number,
    status: ThermalStatus
  ): void {
    const componentState = this.state.componentStates.get(component);
    if (!componentState) {
      return;
    }

    let targetState = componentState.currentState;

    // Reduce power state based on thermal status
    switch (status) {
      case ThermalStatus.CRITICAL:
      case ThermalStatus.THROTTLING:
        targetState = PowerState.P4; // Maximum power saving
        break;
      case ThermalStatus.HOT:
        targetState = PowerState.P3;
        break;
      case ThermalStatus.WARM:
        targetState = PowerState.P2;
        break;
      default:
        // Normal - don't change
        return;
    }

    if (targetState !== componentState.currentState) {
      this.requestPowerState(component, targetState, PowerTransitionReason.THERMAL);
    }
  }

  /**
   * Optimize power for workload
   */
  optimizeForWorkload(workload: WorkloadCharacteristics): void {
    if (this.state.currentPolicy === PowerPolicy.PERFORMANCE) {
      // Maximize performance
      this.setMaxPerformance();
    } else if (this.state.currentPolicy === PowerPolicy.POWER_SAVING) {
      // Minimize power
      this.setMinPower();
    } else if (this.state.currentPolicy === PowerPolicy.BALANCED) {
      // Balance based on workload
      this.balanceForWorkload(workload);
    } else if (this.state.currentPolicy === PowerPolicy.ADAPTIVE) {
      // Adaptively adjust
      this.adaptToWorkload(workload);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Initialize default power states
   */
  private initializeDefaultStates(): void {
    // CPU power states
    this.state.componentStates.set(ThermalComponent.CPU, {
      component: ThermalComponent.CPU,
      currentState: PowerState.P2,
      minState: PowerState.P4,
      maxState: PowerState.P0,
      transitionLatency: 10,
      powerByState: new Map([
        [PowerState.P0, 65], // 65W at max performance
        [PowerState.P1, 45],
        [PowerState.P2, 25],
        [PowerState.P3, 15],
        [PowerState.P4, 5], // 5W at minimum
      ]),
      performanceByState: new Map([
        [PowerState.P0, 1.0],
        [PowerState.P1, 0.85],
        [PowerState.P2, 0.65],
        [PowerState.P3, 0.45],
        [PowerState.P4, 0.25],
      ]),
    });

    // GPU power states
    this.state.componentStates.set(ThermalComponent.GPU, {
      component: ThermalComponent.GPU,
      currentState: PowerState.P2,
      minState: PowerState.P4,
      maxState: PowerState.P0,
      transitionLatency: 50,
      powerByState: new Map([
        [PowerState.P0, 200], // 200W at max performance
        [PowerState.P1, 150],
        [PowerState.P2, 100],
        [PowerState.P3, 50],
        [PowerState.P4, 10], // 10W at minimum
      ]),
      performanceByState: new Map([
        [PowerState.P0, 1.0],
        [PowerState.P1, 0.85],
        [PowerState.P2, 0.65],
        [PowerState.P3, 0.40],
        [PowerState.P4, 0.15],
      ]),
    });

    // Initialize power readings
    for (const [component, state] of this.state.componentStates) {
      const reading = this.createPowerReading(component, state.currentState);
      this.state.currentReadings.set(component, reading);
    }

    this.updateTotalPower();
  }

  /**
   * Create power reading
   */
  private createPowerReading(
    component: ThermalComponent,
    powerState: PowerState
  ): PowerReading {
    const componentState = this.state.componentStates.get(component);
    const watts = componentState?.powerByState.get(powerState) || 0;

    return {
      component,
      watts,
      powerState,
      timestamp: Date.now(),
    };
  }

  /**
   * Update total power consumption
   */
  private updateTotalPower(): void {
    let total = 0;
    for (const reading of this.state.currentReadings.values()) {
      total += reading.watts;
    }
    this.state.totalPowerConsumption = total;
  }

  /**
   * Calculate power percentage for component
   */
  private calculatePowerPercentage(component: ThermalComponent): number {
    const componentState = this.state.componentStates.get(component);
    const reading = this.state.currentReadings.get(component);

    if (!componentState || !reading) {
      return 0;
    }

    const maxPower = componentState.powerByState.get(componentState.maxState) || 1;
    return reading.watts / maxPower;
  }

  /**
   * Create power state transition
   */
  private createTransition(
    component: ThermalComponent,
    fromState: PowerState,
    toState: PowerState,
    reason: PowerTransitionReason,
    performanceImpact: number,
    powerSavings: number
  ): PowerStateTransition {
    return {
      component,
      fromState,
      toState,
      reason,
      performanceImpact,
      powerSavings,
    };
  }

  /**
   * Evaluate and perform automatic power transitions
   */
  private evaluatePowerTransitions(): void {
    // This would be implemented with actual thermal and workload data
    // For now, it's a placeholder for the auto-transition logic

    switch (this.state.currentPolicy) {
      case PowerPolicy.ADAPTIVE:
        // Evaluate current conditions and adjust
        break;
      case PowerPolicy.THERMAL_LIMITED:
        // Reduce power across the board
        this.applyThermalLimiting();
        break;
      default:
        // No automatic transitions
        break;
    }
  }

  /**
   * Apply power policy
   */
  private applyPowerPolicy(policy: PowerPolicy): void {
    switch (policy) {
      case PowerPolicy.PERFORMANCE:
        this.setMaxPerformance();
        break;
      case PowerPolicy.POWER_SAVING:
        this.setMinPower();
        break;
      case PowerPolicy.BALANCED:
        this.setBalanced();
        break;
      case PowerPolicy.THERMAL_LIMITED:
        this.applyThermalLimiting();
        break;
    }
  }

  /**
   * Set maximum performance
   */
  private setMaxPerformance(): void {
    for (const [component, state] of this.state.componentStates) {
      if (state.currentState !== state.maxState) {
        this.requestPowerState(component, state.maxState, PowerTransitionReason.MANUAL);
      }
    }
  }

  /**
   * Set minimum power
   */
  private setMinPower(): void {
    for (const [component, state] of this.state.componentStates) {
      if (state.currentState !== state.minState) {
        this.requestPowerState(component, state.minState, PowerTransitionReason.MANUAL);
      }
    }
  }

  /**
   * Set balanced power
   */
  private setBalanced(): void {
    for (const [component, state] of this.state.componentStates) {
      const balanced = PowerState.P2;
      if (state.currentState !== balanced) {
        this.requestPowerState(component, balanced, PowerTransitionReason.MANUAL);
      }
    }
  }

  /**
   * Apply thermal limiting
   */
  private applyThermalLimiting(): void {
    for (const [component, state] of this.state.componentStates) {
      const limited = PowerState.P3;
      if (state.currentState !== limited) {
        this.requestPowerState(component, limited, PowerTransitionReason.THERMAL);
      }
    }
  }

  /**
   * Balance for workload
   */
  private balanceForWorkload(workload: WorkloadCharacteristics): void {
    const cpuState = this.state.componentStates.get(ThermalComponent.CPU);
    const gpuState = this.state.componentStates.get(ThermalComponent.GPU);

    if (cpuState) {
      let targetCpuState = PowerState.P2; // Balanced

      if (workload.cpuUtilization > 0.8) {
        targetCpuState = PowerState.P0; // Max performance
      } else if (workload.cpuUtilization > 0.5) {
        targetCpuState = PowerState.P1; // High performance
      } else if (workload.cpuUtilization < 0.2) {
        targetCpuState = PowerState.P3; // Power saving
      }

      if (cpuState.currentState !== targetCpuState) {
        this.requestPowerState(
          ThermalComponent.CPU,
          targetCpuState,
          PowerTransitionReason.WORKLOAD
        );
      }
    }

    if (gpuState) {
      let targetGpuState = PowerState.P2; // Balanced

      if (workload.gpuUtilization > 0.8) {
        targetGpuState = PowerState.P0; // Max performance
      } else if (workload.gpuUtilization > 0.5) {
        targetGpuState = PowerState.P1; // High performance
      } else if (workload.gpuUtilization < 0.2) {
        targetGpuState = PowerState.P4; // Min power
      }

      if (gpuState.currentState !== targetGpuState) {
        this.requestPowerState(
          ThermalComponent.GPU,
          targetGpuState,
          PowerTransitionReason.WORKLOAD
        );
      }
    }
  }

  /**
   * Adaptively adjust to workload
   */
  private adaptToWorkload(workload: WorkloadCharacteristics): void {
    // Similar to balance, but more sophisticated
    // Could use machine learning for prediction
    this.balanceForWorkload(workload);
  }
}
