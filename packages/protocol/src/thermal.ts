/**
 * @lsi/protocol - Thermal and Power Management Protocol Types
 *
 * Defines interfaces and types for thermal monitoring, power management,
 * and hardware-aware orchestration in the Aequor platform.
 */

// ============================================================================
// THERAL MONITORING TYPES
// ============================================================================

/**
 * Temperature reading from a hardware component
 */
export interface TemperatureReading {
  /** Temperature in Celsius */
  celsius: number;
  /** Temperature in Fahrenheit (computed) */
  fahrenheit: number;
  /** Timestamp of reading */
  timestamp: number;
  /** Component identifier */
  component: ThermalComponent;
  /** Critical threshold status */
  status: ThermalStatus;
}

/**
 * Hardware components that generate heat
 */
export enum ThermalComponent {
  CPU = "cpu",
  GPU = "gpu",
  MEMORY = "memory",
  SOC = "soc", // System on Chip
  STORAGE = "storage",
  MOTHERBOARD = "motherboard",
  PSU = "psu", // Power Supply Unit
}

/**
 * Thermal status based on temperature thresholds
 */
export enum ThermalStatus {
  NORMAL = "normal",
  WARM = "warm",
  HOT = "hot",
  CRITICAL = "critical",
  THROTTLING = "throttling",
}

/**
 * Thermal zone configuration for a component
 */
export interface ThermalZoneConfig {
  /** Component being monitored */
  component: ThermalComponent;
  /** Normal operating temperature (°C) */
  normalThreshold: number;
  /** Warm temperature threshold (°C) */
  warmThreshold: number;
  /** Hot temperature threshold (°C) */
  hotThreshold: number;
  /** Critical temperature threshold (°C) */
  criticalThreshold: number;
  /** Throttling temperature (°C) */
  throttlingThreshold: number;
  /** Temperature sampling interval (ms) */
  samplingInterval: number;
  /** Moving average window size */
  averageWindow: number;
}

/**
 * Thermal state across all components
 */
export interface ThermalState {
  /** Current temperature readings */
  readings: Map<ThermalComponent, TemperatureReading>;
  /** Average temperature across all components */
  averageTemperature: number;
  /** Maximum temperature */
  maxTemperature: number;
  /** Component with highest temperature */
  hottestComponent: ThermalComponent;
  /** Overall thermal status */
  status: ThermalStatus;
  /** Trend direction */
  trend: ThermalTrend;
  /** Predicted temperature in N seconds */
  predictedTemperature?: number;
}

/**
 * Temperature trend over time
 */
export enum ThermalTrend {
  COOLING = "cooling", // Temperature decreasing
  STABLE = "stable", // Temperature stable
  WARMING = "warming", // Temperature increasing
  SPIKING = "spiking", // Rapid temperature increase
}

// ============================================================================
// THROTTLING DETECTION TYPES
// ============================================================================

/**
 * Throttling event detected on hardware
 */
export interface ThrottlingEvent {
  /** Component being throttled */
  component: ThermalComponent;
  /** Type of throttling */
  type: ThrottlingType;
  /** Severity (0-1) */
  severity: number;
  /** Temperature at which throttling occurred */
  temperature: number;
  /** Timestamp of event */
  timestamp: number;
  /** Duration in milliseconds */
  duration: number;
  /** Performance impact (0-1, where 1 is total loss) */
  performanceImpact: number;
}

/**
 * Types of thermal throttling
 */
export enum ThrottlingType {
  THERMAL = "thermal", // CPU/GPU frequency reduced due to heat
  POWER = "power", // Power limit enforced
  PROCHOT = "prochot", // Intel PROCHOT signal triggered
  GPU_THROTTLING = "gpu_throttling", // GPU-specific throttling
  CURRENT_LIMIT = "current_limit", // Current limit enforced
}

/**
 * Throttling detection result
 */
export interface ThrottlingDetectionResult {
  /** Whether throttling is currently active */
  isThrottling: boolean;
  /** Active throttling events */
  activeEvents: ThrottlingEvent[];
  /** Historical throttling events */
  history: ThrottlingEvent[];
  /** Total throttling time in last hour */
  totalThrottleTime: number;
  /** Performance degradation due to throttling */
  performanceDegradation: number;
}

// ============================================================================
// POWER MANAGEMENT TYPES
// ============================================================================

/**
 * Power state for CPU/GPU
 */
export enum PowerState {
  P0 = "P0", // Maximum performance
  P1 = "P1", // High performance
  P2 = "P2", // Balanced
  P3 = "P3", // Power saving
  P4 = "P4", // Maximum power saving
}

/**
 * Power consumption reading
 */
export interface PowerReading {
  /** Component consuming power */
  component: ThermalComponent;
  /** Power consumption in Watts */
  watts: number;
  /** Current power state */
  powerState: PowerState;
  /** Timestamp of reading */
  timestamp: number;
}

/**
 * Power consumption state
 */
export interface PowerConsumptionState {
  /** Current power readings by component */
  readings: Map<ThermalComponent, PowerReading>;
  /** Total power consumption (Watts) */
  totalWatts: number;
  /** CPU power usage percentage */
  cpuPowerPercentage: number;
  /** GPU power usage percentage */
  gpuPowerPercentage: number;
  /** Current power state policy */
  currentPolicy: PowerPolicy;
}

/**
 * Power management policy
 */
export enum PowerPolicy {
  PERFORMANCE = "performance", // Maximum performance, ignore power
  BALANCED = "balanced", // Balance performance and power
  POWER_SAVING = "power_saving", // Minimize power consumption
  ADAPTIVE = "adaptive", // Dynamically adjust based on workload
  THERMAL_LIMITED = "thermal_limited", // Reduce power due to thermal constraints
}

/**
 * Power state transition request
 */
export interface PowerStateTransition {
  /** Target component */
  component: ThermalComponent;
  /** Current power state */
  fromState: PowerState;
  /** Target power state */
  toState: PowerState;
  /** Reason for transition */
  reason: PowerTransitionReason;
  /** Estimated performance impact (0-1) */
  performanceImpact: number;
  /** Estimated power savings (Watts) */
  powerSavings: number;
}

/**
 * Reasons for power state transitions
 */
export enum PowerTransitionReason {
  THERMAL = "thermal", // Reduce heat
  WORKLOAD = "workload", // Adapt to workload changes
  BATTERY = "battery", // Conserve battery
  MANUAL = "manual", // Manual override
  PREDICTIVE = "predictive", // Predictive adjustment
}

// ============================================================================
// PREDICTIVE THERMAL MODELING TYPES
// ============================================================================

/**
 * Predictive thermal model configuration
 */
export interface ThermalModelConfig {
  /** Prediction horizon (seconds) */
  predictionHorizon: number;
  /** Number of samples to use for training */
  trainingSamples: number;
  /** Model update interval (ms) */
  updateInterval: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Model type to use */
  modelType: ThermalModelType;
}

/**
 * Types of thermal prediction models
 */
export enum ThermalModelType {
  LINEAR_REGRESSION = "linear_regression",
  MOVING_AVERAGE = "moving_average",
  EXPONENTIAL_SMOOTHING = "exponential_smoothing",
  ARIMA = "arima",
  NEURAL_NETWORK = "neural_network",
}

/**
 * Thermal prediction result
 */
export interface ThermalPrediction {
  /** Component being predicted */
  component: ThermalComponent;
  /** Current temperature */
  currentTemperature: number;
  /** Predicted temperature */
  predictedTemperature: number;
  /** Prediction horizon (seconds) */
  horizon: number;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Timestamp of prediction */
  timestamp: number;
  /** Predicted thermal status */
  predictedStatus: ThermalStatus;
  /** Action recommended to prevent overheating */
  recommendedAction?: ThermalAction;
}

/**
 * Thermal action for mitigation
 */
export enum ThermalAction {
  NONE = "none",
  REDUCE_LOAD = "reduce_load", // Reduce computational load
  MIGRATE_WORKLOAD = "migrate_workload", // Move to cooler device
  THROTTLE_CPU = "throttle_cpu", // Reduce CPU frequency
  THROTTLE_GPU = "throttle_gpu", // Reduce GPU frequency
  INCREASE_FANS = "increase_fans", // Increase cooling
  PAUSE_COMPUTE = "pause_compute", // Pause non-critical compute
}

/**
 * Workload characteristics for thermal modeling
 */
export interface WorkloadCharacteristics {
  /** CPU utilization (0-1) */
  cpuUtilization: number;
  /** GPU utilization (0-1) */
  gpuUtilization: number;
  /** Memory utilization (0-1) */
  memoryUtilization: number;
  /** Power consumption (Watts) */
  powerConsumption: number;
  /** Type of workload */
  workloadType: ThermalWorkloadType;
  /** Estimated heat generation (Watts) */
  heatGeneration: number;
}

/**
 * Types of workloads for thermal modeling
 */
export enum ThermalWorkloadType {
  IDLE = "idle",
  LIGHT = "light", // Text processing, web browsing
  MEDIUM = "medium", // Document editing, light coding
  HEAVY_COMPUTE = "heavy_compute", // Compilation, data processing
  HEAVY_GPU = "heavy_gpu", // Gaming, 3D rendering
  AI_INFERENCE = "ai_inference", // Model inference
  AI_TRAINING = "ai_training", // Model training
  VIDEO_ENCODE = "video_encode", // Video encoding/decoding
}

// ============================================================================
// THERMAL MANAGEMENT CONFIGURATION
// ============================================================================

/**
 * Thermal management system configuration
 */
export interface ThermalManagementConfig {
  /** Thermal zones to monitor */
  thermalZones: ThermalZoneConfig[];
  /** Power management policy */
  powerPolicy: PowerPolicy;
  /** Predictive model configuration */
  predictionConfig: ThermalModelConfig;
  /** Whether to enable proactive throttling */
  enableProactiveThrottling: boolean;
  /** Threshold for proactive action (°C before critical) */
  proactiveThreshold: number;
  /** Maximum allowed throttling time per hour (ms) */
  maxThrottleTime: number;
  /** Cooling strategy */
  coolingStrategy: CoolingStrategy;
  /** Workload migration enabled */
  enableWorkloadMigration: boolean;
  /** Temperature logging enabled */
  enableLogging: boolean;
}

/**
 * Cooling strategy to employ
 */
export enum CoolingStrategy {
  PASSIVE = "passive", // Only passive cooling
  ACTIVE = "active", // Use fans actively
  AGGRESSIVE = "aggressive", // Maximize cooling
  HYBRID = "hybrid", // Balance passive and active
}

// ============================================================================
// THERMAL EVENTS AND NOTIFICATIONS
// ============================================================================

/**
 * Thermal event for notification
 */
export interface ThermalEvent {
  /** Event type */
  type: ThermalEventType;
  /** Component involved */
  component: ThermalComponent;
  /** Temperature at event */
  temperature: number;
  /** Event severity */
  severity: ThermalStatus;
  /** Timestamp */
  timestamp: number;
  /** Message describing the event */
  message: string;
  /** Recommended action */
  action?: ThermalAction;
}

/**
 * Types of thermal events
 */
export enum ThermalEventType {
  THRESHOLD_EXCEEDED = "threshold_exceeded",
  THROTTLING_DETECTED = "throttling_detected",
  THROTTLING_STOPPED = "throttling_stopped",
  PREDICTIVE_ALERT = "predictive_alert",
  COOLING_INITIATED = "cooling_initiated",
  WORKLOAD_MIGRATED = "workload_migrated",
  CRITICAL_TEMPERATURE = "critical_temperature",
}

/**
 * Thermal event listener callback
 */
export type ThermalEventListener = (event: ThermalEvent) => void;

// ============================================================================
// THERMAL CONSTRAINTS
// ============================================================================

/**
 * Thermal constraint for routing decisions
 */
export interface ThermalRoutingConstraint {
  /** Maximum allowed temperature (°C) */
  maxTemperature: number;
  /** Preferred temperature range */
  preferredRange: [number, number];
  /** Whether thermal management is active */
  isActive: boolean;
  /** Current thermal status */
  status: ThermalStatus;
  /** Performance penalty due to thermal conditions (0-1) */
  thermalPenalty: number;
}

/**
 * Thermal-aware routing decision
 */
export interface ThermalRoutingDecision {
  /** Whether to proceed with request */
  shouldProceed: boolean;
  /** Recommended power state */
  recommendedPowerState: PowerState;
  /** Estimated thermal impact */
  thermalImpact: {
    temperatureIncrease: number;
    powerConsumption: number;
    duration: number;
  };
  /** Reasoning for decision */
  reasoning: string;
}

// ============================================================================
// THERMAL TELEMETRY
// ============================================================================

/**
 * Historical thermal data point
 */
export interface ThermalDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Component temperatures */
  temperatures: Map<ThermalComponent, number>;
  /** Power consumption */
  powerConsumption: number;
  /** Workload characteristics */
  workload: WorkloadCharacteristics;
  /** Thermal status */
  status: ThermalStatus;
}

/**
 * Thermal statistics over a time window
 */
export interface ThermalStatistics {
  /** Time window start */
  windowStart: number;
  /** Time window end */
  windowEnd: number;
  /** Average temperature by component */
  averageTemperatures: Map<ThermalComponent, number>;
  /** Peak temperatures */
  peakTemperatures: Map<ThermalComponent, number>;
  /** Time spent in each thermal status */
  timeInStatus: Map<ThermalStatus, number>;
  /** Total throttling time */
  totalThrottleTime: number;
  /** Number of throttling events */
  throttleEventCount: number;
  /** Average power consumption */
  averagePowerConsumption: number;
  /** Peak power consumption */
  peakPowerConsumption: number;
}

// ============================================================================
// THERMAL MANAGEMENT INTERFACE
// ============================================================================

/**
 * Interface for thermal management system
 */
export interface IThermalManager {
  /**
   * Get current thermal state
   */
  getThermalState(): ThermalState;

  /**
   * Get thermal state for specific component
   */
  getComponentTemperature(component: ThermalComponent): Promise<TemperatureReading>;

  /**
   * Detect throttling
   */
  detectThrottling(): Promise<ThrottlingDetectionResult>;

  /**
   * Get current power state
   */
  getPowerState(): PowerConsumptionState;

  /**
   * Request power state transition
   */
  requestPowerState(
    component: ThermalComponent,
    toState: PowerState,
    reason: PowerTransitionReason
  ): Promise<PowerStateTransition>;

  /**
   * Predict future temperature
   */
  predictTemperature(
    component: ThermalComponent,
    horizon: number
  ): Promise<ThermalPrediction>;

  /**
   * Register event listener
   */
  on(event: ThermalEventType, listener: ThermalEventListener): void;

  /**
   * Unregister event listener
   */
  off(event: ThermalEventType, listener: ThermalEventListener): void;

  /**
   * Get thermal statistics
   */
  getStatistics(windowStart: number, windowEnd: number): ThermalStatistics;

  /**
   * Start thermal monitoring
   */
  start(): Promise<void>;

  /**
   * Stop thermal monitoring
   */
  stop(): Promise<void>;
}
