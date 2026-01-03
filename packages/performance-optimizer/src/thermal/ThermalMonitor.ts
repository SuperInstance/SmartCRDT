/**
 * ThermalMonitor - Real-time temperature monitoring for hardware components
 *
 * Provides:
 * - Temperature reading from CPU, GPU, memory, etc.
 * - Thermal status classification
 * - Trend detection (cooling, warming, spiking)
 * - Moving average temperature calculation
 * - Historical thermal data tracking
 */

import { EventEmitter } from "events";
import type {
  TemperatureReading,
  ThermalComponent,
  ThermalStatus,
  ThermalZoneConfig,
  ThermalState,
  ThermalTrend,
  ThermalDataPoint,
  WorkloadCharacteristics,
} from "@lsi/protocol";

/**
 * Default thermal zone configurations
 */
const DEFAULT_THERMAL_ZONES: ThermalZoneConfig[] = [
  {
    component: ThermalComponent.CPU,
    normalThreshold: 45,
    warmThreshold: 65,
    hotThreshold: 75,
    criticalThreshold: 85,
    throttlingThreshold: 90,
    samplingInterval: 1000,
    averageWindow: 10,
  },
  {
    component: ThermalComponent.GPU,
    normalThreshold: 50,
    warmThreshold: 70,
    hotThreshold: 80,
    criticalThreshold: 88,
    throttlingThreshold: 93,
    samplingInterval: 1000,
    averageWindow: 10,
  },
  {
    component: ThermalComponent.MEMORY,
    normalThreshold: 40,
    warmThreshold: 55,
    hotThreshold: 65,
    criticalThreshold: 75,
    throttlingThreshold: 80,
    samplingInterval: 2000,
    averageWindow: 10,
  },
];

/**
 * Temperature history entry for trend analysis
 */
interface TemperatureHistoryEntry {
  timestamp: number;
  temperature: number;
}

/**
 * ThermalMonitor class
 */
export class ThermalMonitor extends EventEmitter {
  private thermalZones: Map<ThermalComponent, ThermalZoneConfig>;
  private currentReadings: Map<ThermalComponent, TemperatureReading>;
  private temperatureHistory: Map<ThermalComponent, TemperatureHistoryEntry[]>;
  private monitoringIntervals: Map<ThermalComponent, NodeJS.Timeout>;
  private isRunning: boolean;
  private historicalData: ThermalDataPoint[];
  private maxHistorySize: number;

  constructor(config?: { thermalZones?: ThermalZoneConfig[]; maxHistorySize?: number }) {
    super();

    this.thermalZones = new Map();
    this.currentReadings = new Map();
    this.temperatureHistory = new Map();
    this.monitoringIntervals = new Map();
    this.isRunning = false;
    this.historicalData = [];
    this.maxHistorySize = config?.maxHistorySize || 1440; // 24 hours at 1-minute intervals

    // Initialize thermal zones
    const zones = config?.thermalZones || DEFAULT_THERMAL_ZONES;
    zones.forEach((zone) => {
      this.thermalZones.set(zone.component, zone);
      this.temperatureHistory.set(zone.component, []);
    });
  }

  /**
   * Start thermal monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start monitoring for each thermal zone
    for (const [component, zone] of this.thermalZones) {
      this.startMonitoringComponent(component, zone);
    }

    this.emit("monitoring:started");
  }

  /**
   * Stop thermal monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    this.emit("monitoring:stopped");
  }

  /**
   * Get current thermal state
   */
  getThermalState(): ThermalState {
    const readings = Array.from(this.currentReadings.values());
    if (readings.length === 0) {
      return this.createEmptyThermalState();
    }

    const temperatures = readings.map((r) => r.celsius);
    const averageTemperature =
      temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const maxTemperature = Math.max(...temperatures);
    const hottestReading = readings.reduce((hottest, reading) =>
      reading.celsius > hottest.celsius ? reading : hottest
    );

    return {
      readings: this.currentReadings,
      averageTemperature,
      maxTemperature,
      hottestComponent: hottestReading.component,
      status: this.calculateOverallStatus(readings),
      trend: this.calculateTrend(),
    };
  }

  /**
   * Get temperature reading for specific component
   */
  async getComponentTemperature(component: ThermalComponent): Promise<TemperatureReading> {
    const reading = this.currentReadings.get(component);
    if (!reading) {
      // Perform one-time reading if not monitoring
      return this.readTemperature(component);
    }
    return reading;
  }

  /**
   * Get historical thermal data
   */
  getHistoricalData(): ThermalDataPoint[] {
    return [...this.historicalData];
  }

  /**
   * Get temperature history for a component
   */
  getTemperatureHistory(component: ThermalComponent): TemperatureHistoryEntry[] {
    return this.temperatureHistory.get(component) || [];
  }

  /**
   * Get thermal zone configuration
   */
  getThermalZone(component: ThermalComponent): ThermalZoneConfig | undefined {
    return this.thermalZones.get(component);
  }

  /**
   * Update thermal zone configuration
   */
  updateThermalZone(config: ThermalZoneConfig): void {
    this.thermalZones.set(config.component, config);

    // Restart monitoring for this component if running
    if (this.isRunning) {
      this.stopMonitoringComponent(config.component);
      this.startMonitoringComponent(config.component, config);
    }
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.historicalData = [];
    for (const component of this.thermalZones.keys()) {
      this.temperatureHistory.set(component, []);
    }
    this.emit("history:cleared");
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Start monitoring a specific component
   */
  private startMonitoringComponent(
    component: ThermalComponent,
    zone: ThermalZoneConfig
  ): void {
    const interval = setInterval(async () => {
      try {
        const reading = await this.readTemperature(component);
        this.updateReading(component, reading);
        this.recordHistoryEntry(component, reading);
      } catch (error) {
        this.emit("error", { component, error });
      }
    }, zone.samplingInterval);

    this.monitoringIntervals.set(component, interval);
  }

  /**
   * Stop monitoring a specific component
   */
  private stopMonitoringComponent(component: ThermalComponent): void {
    const interval = this.monitoringIntervals.get(component);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(component);
    }
  }

  /**
   * Read temperature from component
   */
  private async readTemperature(component: ThermalComponent): Promise<TemperatureReading> {
    const timestamp = Date.now();
    let celsius = 0;

    // Platform-specific temperature reading
    // In production, this would use system calls or libraries like:
    // - Linux: /sys/class/thermal/, lm-sensors
    // - Windows: WMI, Open Hardware Monitor
    // - macOS: iStats, osx-cpu-temp
    switch (component) {
      case ThermalComponent.CPU:
        celsius = await this.readCPUTemperature();
        break;
      case ThermalComponent.GPU:
        celsius = await this.readGPUTemperature();
        break;
      case ThermalComponent.MEMORY:
        celsius = await this.readMemoryTemperature();
        break;
      default:
        celsius = this.simulateTemperature(component);
    }

    const zone = this.thermalZones.get(component);
    const status = zone ? this.classifyTemperature(celsius, zone) : ThermalStatus.NORMAL;

    return {
      celsius,
      fahrenheit: (celsius * 9) / 5 + 32,
      timestamp,
      component,
      status,
    };
  }

  /**
   * Read CPU temperature (platform-specific)
   */
  private async readCPUTemperature(): Promise<number> {
    // In production, implement platform-specific reading:
    // Linux: read from /sys/class/thermal/thermal_zone*/temp
    // Windows: use WMI MSAcpi_ThermalZoneTemperature
    // macOS: use sysctl machdep.xcpm.cpu_thermal_level

    // For now, simulate with reasonable values
    return this.simulateTemperature(ThermalComponent.CPU);
  }

  /**
   * Read GPU temperature (platform-specific)
   */
  private async readGPUTemperature(): Promise<number> {
    // In production, use:
    // NVIDIA: nvidia-smi
    // AMD: rocm-smi
    // Intel: intel_gpu_tools

    return this.simulateTemperature(ThermalComponent.GPU);
  }

  /**
   * Read memory temperature (platform-specific)
   */
  private async readMemoryTemperature(): Promise<number> {
    // Memory temperature sensors are less common
    // Often estimated from proximity to CPU

    return this.simulateTemperature(ThermalComponent.MEMORY);
  }

  /**
   * Simulate temperature (for testing/fallback)
   */
  private simulateTemperature(component: ThermalComponent): number {
    // Generate realistic temperature based on component type
    const baseTemp: Record<ThermalComponent, number> = {
      [ThermalComponent.CPU]: 45 + Math.random() * 20,
      [ThermalComponent.GPU]: 50 + Math.random() * 25,
      [ThermalComponent.MEMORY]: 40 + Math.random() * 15,
      [ThermalComponent.SOC]: 50 + Math.random() * 20,
      [ThermalComponent.STORAGE]: 35 + Math.random() * 10,
      [ThermalComponent.MOTHERBOARD]: 30 + Math.random() * 10,
      [ThermalComponent.PSU]: 35 + Math.random() * 15,
    };

    return baseTemp[component];
  }

  /**
   * Update temperature reading
   */
  private updateReading(component: ThermalComponent, reading: TemperatureReading): void {
    const oldReading = this.currentReadings.get(component);
    this.currentReadings.set(component, reading);

    // Emit change events
    if (oldReading && oldReading.status !== reading.status) {
      this.emit("status:changed", {
        component,
        oldStatus: oldReading.status,
        newStatus: reading.status,
      });
    }

    this.emit("temperature:updated", { component, reading });
  }

  /**
   * Record history entry for trend analysis
   */
  private recordHistoryEntry(
    component: ThermalComponent,
    reading: TemperatureReading
  ): void {
    const history = this.temperatureHistory.get(component);
    if (!history) return;

    history.push({
      timestamp: reading.timestamp,
      temperature: reading.celsius,
    });

    // Limit history size
    const zone = this.thermalZones.get(component);
    const maxEntries = zone?.averageWindow || 10;
    if (history.length > maxEntries) {
      history.shift();
    }
  }

  /**
   * Classify temperature based on thresholds
   */
  private classifyTemperature(
    celsius: number,
    zone: ThermalZoneConfig
  ): ThermalStatus {
    if (celsius >= zone.throttlingThreshold) {
      return ThermalStatus.THROTTLING;
    } else if (celsius >= zone.criticalThreshold) {
      return ThermalStatus.CRITICAL;
    } else if (celsius >= zone.hotThreshold) {
      return ThermalStatus.HOT;
    } else if (celsius >= zone.warmThreshold) {
      return ThermalStatus.WARM;
    }
    return ThermalStatus.NORMAL;
  }

  /**
   * Calculate overall thermal status
   */
  private calculateOverallStatus(readings: TemperatureReading[]): ThermalStatus {
    if (readings.some((r) => r.status === ThermalStatus.THROTTLING)) {
      return ThermalStatus.THROTTLING;
    } else if (readings.some((r) => r.status === ThermalStatus.CRITICAL)) {
      return ThermalStatus.CRITICAL;
    } else if (readings.some((r) => r.status === ThermalStatus.HOT)) {
      return ThermalStatus.HOT;
    } else if (readings.some((r) => r.status === ThermalStatus.WARM)) {
      return ThermalStatus.WARM;
    }
    return ThermalStatus.NORMAL;
  }

  /**
   * Calculate thermal trend
   */
  private calculateTrend(): ThermalTrend {
    const cpuHistory = this.temperatureHistory.get(ThermalComponent.CPU) || [];
    if (cpuHistory.length < 3) {
      return ThermalTrend.STABLE;
    }

    const recent = cpuHistory.slice(-5);
    const temps = recent.map((e) => e.temperature);

    // Calculate rate of change
    const changes = [];
    for (let i = 1; i < temps.length; i++) {
      changes.push(temps[i] - temps[i - 1]);
    }

    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;

    if (avgChange > 2) {
      return ThermalTrend.SPIKING;
    } else if (avgChange > 0.5) {
      return ThermalTrend.WARMING;
    } else if (avgChange < -0.5) {
      return ThermalTrend.COOLING;
    }
    return ThermalTrend.STABLE;
  }

  /**
   * Create empty thermal state
   */
  private createEmptyThermalState(): ThermalState {
    return {
      readings: new Map(),
      averageTemperature: 0,
      maxTemperature: 0,
      hottestComponent: ThermalComponent.CPU,
      status: ThermalStatus.NORMAL,
      trend: ThermalTrend.STABLE,
    };
  }

  /**
   * Record thermal data point for historical analysis
   */
  private recordDataPoint(workload?: WorkloadCharacteristics): void {
    const state = this.getThermalState();

    const dataPoint: ThermalDataPoint = {
      timestamp: Date.now(),
      temperatures: new Map(
        Array.from(state.readings.entries()).map(([component, reading]) => [
          component,
          reading.celsius,
        ])
      ),
      powerConsumption: this.estimatePowerConsumption(),
      workload: workload || this.estimateWorkload(),
      status: state.status,
    };

    this.historicalData.push(dataPoint);

    // Limit history size
    if (this.historicalData.length > this.maxHistorySize) {
      this.historicalData.shift();
    }
  }

  /**
   * Estimate power consumption (simplified)
   */
  private estimatePowerConsumption(): number {
    const state = this.getThermalState();
    // Rough estimate based on temperature
    // In production, use actual power sensors
    const cpuTemp = state.readings.get(ThermalComponent.CPU)?.celsius || 50;
    const gpuTemp = state.readings.get(ThermalComponent.GPU)?.celsius || 50;

    const cpuPower = 5 + (cpuTemp - 30) * 0.5; // Base 5W + temp factor
    const gpuPower = 10 + (gpuTemp - 30) * 0.8; // Base 10W + temp factor

    return cpuPower + gpuPower;
  }

  /**
   * Estimate current workload characteristics
   */
  private estimateWorkload(): WorkloadCharacteristics {
    const state = this.getThermalState();
    const cpuTemp = state.readings.get(ThermalComponent.CPU)?.celsius || 50;
    const gpuTemp = state.readings.get(ThermalComponent.GPU)?.celsius || 50;

    // Estimate utilization based on temperature
    const cpuUtilization = Math.min(1, Math.max(0, (cpuTemp - 40) / 50));
    const gpuUtilization = Math.min(1, Math.max(0, (gpuTemp - 40) / 60));

    let workloadType: WorkloadCharacteristics["workloadType"] = ThermalWorkloadType.IDLE;
    if (cpuUtilization > 0.8 && gpuUtilization > 0.8) {
      workloadType = ThermalWorkloadType.HEAVY_GPU;
    } else if (cpuUtilization > 0.8) {
      workloadType = ThermalWorkloadType.HEAVY_COMPUTE;
    } else if (gpuUtilization > 0.6) {
      workloadType = ThermalWorkloadType.HEAVY_GPU;
    } else if (cpuUtilization > 0.5) {
      workloadType = ThermalWorkloadType.MEDIUM;
    } else if (cpuUtilization > 0.2) {
      workloadType = ThermalWorkloadType.LIGHT;
    }

    return {
      cpuUtilization,
      gpuUtilization,
      memoryUtilization: 0.5, // Placeholder
      powerConsumption: this.estimatePowerConsumption(),
      workloadType,
      heatGeneration: (cpuTemp + gpuTemp) * 0.1,
    };
  }
}

import { ThermalWorkloadType } from "@lsi/protocol";
