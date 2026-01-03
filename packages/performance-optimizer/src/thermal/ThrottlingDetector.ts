/**
 * ThrottlingDetector - Detect and analyze thermal throttling events
 *
 * Provides:
 * - Real-time throttling detection
 * - Performance impact analysis
 * - Throttling event history
 * - Automatic mitigation recommendations
 */

import { EventEmitter } from "events";
import type {
  ThrottlingEvent,
  ThrottlingType,
  ThrottlingDetectionResult,
  ThermalComponent,
  TemperatureReading,
  ThermalAction,
} from "@lsi/protocol";

/**
 * Throttling detection configuration
 */
export interface ThrottlingDetectorConfig {
  /** Performance baseline samples to collect */
  baselineSamples: number;
  /** Threshold for performance degradation detection (0-1) */
  performanceThreshold: number;
  /** Minimum duration for throttling event (ms) */
  minEventDuration: number;
  /** Maximum history size */
  maxHistorySize: number;
}

/**
 * Performance measurement for throttling detection
 */
interface PerformanceMeasurement {
  timestamp: number;
  component: ThermalComponent;
  operationsPerSecond: number;
  latency: number;
  temperature: number;
  frequency?: number; // Current CPU/GPU frequency
}

/**
 * Baseline performance for comparison
 */
interface PerformanceBaseline {
  component: ThermalComponent;
  avgOpsPerSecond: number;
  avgLatency: number;
  avgFrequency: number;
  temperature: number;
  sampleCount: number;
}

/**
 * ThrottlingDetector class
 */
export class ThrottlingDetector extends EventEmitter {
  private config: ThrottlingDetectorConfig;
  private activeEvents: Map<ThermalComponent, ThrottlingEvent>;
  private eventHistory: ThrottlingEvent[];
  private performanceBaseline: Map<ThermalComponent, PerformanceBaseline>;
  private recentMeasurements: Map<ThermalComponent, PerformanceMeasurement[]>;
  private isRunning: boolean;

  constructor(config: ThrottlingDetectorConfig = {}) {
    super();

    this.config = {
      baselineSamples: config.baselineSamples || 100,
      performanceThreshold: config.performanceThreshold || 0.15, // 15% degradation
      minEventDuration: config.minEventDuration || 1000, // 1 second minimum
      maxHistorySize: config.maxHistorySize || 1000,
    };

    this.activeEvents = new Map();
    this.eventHistory = [];
    this.performanceBaseline = new Map();
    this.recentMeasurements = new Map();
    this.isRunning = false;
  }

  /**
   * Start throttling detection
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.emit("detection:started");
  }

  /**
   * Stop throttling detection
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Close any active events
    const now = Date.now();
    for (const [component, event] of this.activeEvents) {
      if (event.duration === 0) {
        // Still active, close it
        event.duration = now - event.timestamp;
        this.activeEvents.delete(component);
        this.emit("throttling:stopped", event);
      }
    }

    this.emit("detection:stopped");
  }

  /**
   * Detect throttling based on temperature and performance
   */
  async detectThrottling(): Promise<ThrottlingDetectionResult> {
    const now = Date.now();
    const detectedEvents: ThrottlingEvent[] = [];

    // Check each component for throttling
    for (const [component, baseline] of this.performanceBaseline) {
      const measurements = this.recentMeasurements.get(component);
      if (!measurements || measurements.length === 0) {
        continue;
      }

      const latestMeasurement = measurements[measurements.length - 1];

      // Detect thermal throttling
      const thermalEvent = this.detectThermalThrottling(
        component,
        latestMeasurement,
        baseline
      );
      if (thermalEvent) {
        detectedEvents.push(thermalEvent);
      }

      // Detect power throttling
      const powerEvent = this.detectPowerThrottling(
        component,
        latestMeasurement,
        baseline
      );
      if (powerEvent) {
        detectedEvents.push(powerEvent);
      }

      // Detect PROCHOT
      const prochotEvent = this.detectPROCHOT(component, latestMeasurement);
      if (prochotEvent) {
        detectedEvents.push(prochotEvent);
      }
    }

    // Update active events
    for (const event of detectedEvents) {
      const existing = this.activeEvents.get(event.component);
      if (!existing) {
        // New throttling event
        this.activeEvents.set(event.component, event);
        this.eventHistory.push(event);
        this.emit("throttling:detected", event);

        // Trim history
        if (this.eventHistory.length > this.config.maxHistorySize) {
          this.eventHistory.shift();
        }
      }
    }

    // Check for stopped throttling
    for (const [component, event] of this.activeEvents) {
      const stillThrottling = detectedEvents.some(
        (e) => e.component === component && e.type === event.type
      );

      if (!stillThrottling) {
        event.duration = now - event.timestamp;
        this.activeEvents.delete(component);
        this.emit("throttling:stopped", event);
      }
    }

    return this.buildDetectionResult();
  }

  /**
   * Record performance measurement
   */
  recordPerformance(measurement: PerformanceMeasurement): void {
    const measurements = this.recentMeasurements.get(measurement.component) || [];
    measurements.push(measurement);

    // Keep only recent measurements (last 100)
    if (measurements.length > 100) {
      measurements.shift();
    }

    this.recentMeasurements.set(measurement.component, measurements);

    // Update baseline if we don't have one yet
    if (!this.performanceBaseline.has(measurement.component)) {
      this.updateBaseline(measurement.component);
    }
  }

  /**
   * Record temperature reading
   */
  recordTemperature(reading: TemperatureReading): void {
    // Check for critical temperature that indicates throttling
    if (reading.status === "throttling" || reading.status === "critical") {
      const component = reading.component;
      const existing = this.activeEvents.get(component);

      if (!existing) {
        const event: ThrottlingEvent = {
          component,
          type: ThrottlingType.THERMAL,
          severity: this.calculateSeverity(reading.celsius),
          temperature: reading.celsius,
          timestamp: reading.timestamp,
          duration: 0,
          performanceImpact: this.estimateImpact(reading.celsius),
        };

        this.activeEvents.set(component, event);
        this.eventHistory.push(event);
        this.emit("throttling:detected", event);
      }
    }
  }

  /**
   * Get throttling history
   */
  getHistory(): ThrottlingEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.emit("history:cleared");
  }

  /**
   * Get active throttling events
   */
  getActiveEvents(): ThrottlingEvent[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Get recommended action for active throttling
   */
  getRecommendedAction(): ThermalAction {
    const active = this.getActiveEvents();
    if (active.length === 0) {
      return ThermalAction.NONE;
    }

    const maxSeverity = Math.max(...active.map((e) => e.severity));
    const maxImpact = Math.max(...active.map((e) => e.performanceImpact));

    if (maxSeverity > 0.8 || maxImpact > 0.5) {
      // Severe throttling - need aggressive action
      if (active.some((e) => e.component === ThermalComponent.GPU)) {
        return ThermalAction.THROTTLE_GPU;
      }
      return ThermalAction.PAUSE_COMPUTE;
    } else if (maxSeverity > 0.5 || maxImpact > 0.2) {
      // Moderate throttling
      return ThermalAction.REDUCE_LOAD;
    } else {
      // Mild throttling
      return ThermalAction.INCREASE_FANS;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Detect thermal throttling based on performance degradation
   */
  private detectThermalThrottling(
    component: ThermalComponent,
    measurement: PerformanceMeasurement,
    baseline: PerformanceBaseline
  ): ThrottlingEvent | null {
    const performanceDegradation =
      1 - measurement.operationsPerSecond / baseline.avgOpsPerSecond;
    const latencyIncrease = measurement.latency / baseline.avgLatency - 1;

    // Check if performance is degraded and temperature is high
    const isDegraded =
      performanceDegradation > this.config.performanceThreshold ||
      latencyIncrease > this.config.performanceThreshold;

    const isHot = measurement.temperature > baseline.temperature + 10;

    if (isDegraded && isHot) {
      return {
        component,
        type: ThrottlingType.THERMAL,
        severity: Math.max(performanceDegradation, latencyIncrease),
        temperature: measurement.temperature,
        timestamp: measurement.timestamp,
        duration: 0,
        performanceImpact: performanceDegradation,
      };
    }

    return null;
  }

  /**
   * Detect power throttling
   */
  private detectPowerThrottling(
    component: ThermalComponent,
    measurement: PerformanceMeasurement,
    baseline: PerformanceBaseline
  ): ThrottlingEvent | null {
    if (!measurement.frequency) {
      return null;
    }

    const frequencyReduction =
      1 - measurement.frequency / baseline.avgFrequency;

    if (frequencyReduction > 0.1) {
      // Frequency reduced by more than 10%
      return {
        component,
        type: ThrottlingType.POWER,
        severity: frequencyReduction,
        temperature: measurement.temperature,
        timestamp: measurement.timestamp,
        duration: 0,
        performanceImpact: frequencyReduction,
      };
    }

    return null;
  }

  /**
   * Detect PROCHOT signal
   */
  private detectPROCHOT(
    component: ThermalComponent,
    measurement: PerformanceMeasurement
  ): ThrottlingEvent | null {
    // PROCHOT typically triggers at ~100°C
    if (measurement.temperature >= 100) {
      return {
        component,
        type: ThrottlingType.PROCHOT,
        severity: 1.0,
        temperature: measurement.temperature,
        timestamp: measurement.timestamp,
        duration: 0,
        performanceImpact: 0.5, // Significant impact
      };
    }

    return null;
  }

  /**
   * Calculate severity based on temperature
   */
  private calculateSeverity(temperature: number): number {
    if (temperature >= 100) return 1.0;
    if (temperature >= 95) return 0.9;
    if (temperature >= 90) return 0.7;
    if (temperature >= 85) return 0.5;
    if (temperature >= 80) return 0.3;
    return 0.1;
  }

  /**
   * Estimate performance impact based on temperature
   */
  private estimateImpact(temperature: number): number {
    // Rough estimate: every 10°C above 70°C causes ~10% performance loss
    if (temperature <= 70) return 0;
    return Math.min(1, (temperature - 70) / 30);
  }

  /**
   * Update performance baseline for a component
   */
  private updateBaseline(component: ThermalComponent): void {
    const measurements = this.recentMeasurements.get(component);
    if (!measurements || measurements.length < this.config.baselineSamples) {
      return;
    }

    const samples = measurements.slice(-this.config.baselineSamples);

    const avgOpsPerSecond =
      samples.reduce((sum, m) => sum + m.operationsPerSecond, 0) / samples.length;
    const avgLatency =
      samples.reduce((sum, m) => sum + m.latency, 0) / samples.length;
    const avgFrequency = samples
      .filter((m) => m.frequency !== undefined)
      .reduce((sum, m) => sum + (m.frequency || 0), 0) /
      samples.filter((m) => m.frequency !== undefined).length;
    const avgTemperature =
      samples.reduce((sum, m) => sum + m.temperature, 0) / samples.length;

    this.performanceBaseline.set(component, {
      component,
      avgOpsPerSecond,
      avgLatency,
      avgFrequency,
      temperature: avgTemperature,
      sampleCount: samples.length,
    });

    this.emit("baseline:updated", { component, baseline: this.performanceBaseline.get(component) });
  }

  /**
   * Build throttling detection result
   */
  private buildDetectionResult(): ThrottlingDetectionResult {
    const activeEvents = Array.from(this.activeEvents.values());
    const history = [...this.eventHistory];

    const totalThrottleTime = history.reduce((sum, event) => sum + event.duration, 0);
    const performanceDegradation =
      activeEvents.length > 0
        ? Math.max(...activeEvents.map((e) => e.performanceImpact))
        : 0;

    return {
      isThrottling: activeEvents.length > 0,
      activeEvents,
      history,
      totalThrottleTime,
      performanceDegradation,
    };
  }
}
