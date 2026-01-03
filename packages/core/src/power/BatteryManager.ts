/**
 * BatteryManager - Battery monitoring and optimization
 *
 * Monitors battery status, predicts remaining time, and optimizes power consumption
 * to extend battery life while maintaining acceptable performance.
 *
 * Platform Support:
 * - Linux: Uses /sys/class/power_supply/
 * - Windows: Uses WMI or GetSystemPowerStatus
 * - macOS: Uses IOKit or pmset
 *
 * @module power
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

/**
 * Battery status information
 */
export interface BatteryStatus {
  level: number; // 0-100 percentage
  is_charging: boolean;
  time_remaining: Duration;
  charge_rate: number; // watts (positive when charging)
  discharge_rate: number; // watts (positive when discharging)
  health: number; // 0-100 percentage
  cycles: number;
  voltage: number; // volts
  temperature: number; // celsius
}

/**
 * Duration type
 */
export interface Duration {
  value: number;
  unit: "seconds" | "minutes" | "hours" | "years";
}

/**
 * Battery health information
 */
export interface BatteryHealth {
  design_capacity: number; // mWh or mAh
  current_capacity: number; // mWh or mAh
  health_percentage: number; // 0-100
  cycle_count: number;
  condition: "normal" | "service" | "replace" | "critical";
  estimated_life_remaining: Duration; // time until battery needs replacement
}

/**
 * Battery prediction for future time
 */
export interface BatteryPrediction {
  time_until_empty: Duration;
  time_until_full: Duration;
  predicted_power_curve: PowerDataPoint[];
  confidence: number; // 0-1
  warning_threshold: number; // percentage
}

/**
 * Power data point for predictions
 */
export interface PowerDataPoint {
  timestamp: number;
  level: number; // battery percentage
  power: number; // watts
}

/**
 * Power management strategy
 */
export type PowerStrategy =
  | "max_performance"
  | "balanced"
  | "power_saver"
  | "max_battery"
  | "adaptive";

/**
 * Power source type
 */
export type PowerSource = "battery" | "ac" | "usb" | "wireless";

/**
 * Battery manager configuration
 */
export interface BatteryManagerConfig {
  update_interval?: number; // milliseconds
  low_battery_threshold?: number; // percentage
  critical_battery_threshold?: number; // percentage
  enable_predictions?: boolean;
  history_size?: number;
}

/**
 * Battery status change event
 */
export interface BatteryStatusEvent {
  old_status: BatteryStatus;
  new_status: BatteryStatus;
  change: "level" | "charging_state" | "health" | "power_source";
}

/**
 * BatteryManager - Main battery management class
 *
 * @example
 * ```typescript
 * const manager = new BatteryManager();
 * await manager.initialize();
 *
 * // Check if on battery
 * if (manager.is_on_battery()) {
 *   // Optimize for battery life
 *   await manager.optimize_for_battery_life();
 * }
 *
 * // Get battery status
 * const status = manager.get_battery_status();
 * console.log(`Battery: ${status.level}%`);
 * ```
 */
export class BatteryManager extends EventEmitter {
  private config: BatteryManagerConfig;
  private platform: NodeJS.Platform;
  private initialized: boolean = false;
  private currentStatus: BatteryStatus;
  private powerHistory: PowerDataPoint[] = [];
  private updateTimer?: NodeJS.Timeout;
  private powerSource: PowerSource = "ac";
  private previousStatus?: BatteryStatus;

  constructor(config: BatteryManagerConfig = {}) {
    super();
    this.config = {
      update_interval: config.update_interval || 5000,
      low_battery_threshold: config.low_battery_threshold || 20,
      critical_battery_threshold: config.critical_battery_threshold || 10,
      enable_predictions: config.enable_predictions !== false,
      history_size: config.history_size || 720, // 1 hour at 5s intervals
    };
    this.platform = process.platform;
    this.currentStatus = this.get_default_battery_status();
  }

  /**
   * Initialize the battery manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Read initial battery status
    this.currentStatus = await this.read_battery_status();
    this.powerSource = await this.detect_power_source();

    // Start monitoring
    this.start_monitoring();

    this.initialized = true;
    this.emit("initialized");
  }

  /**
   * Get current battery status
   */
  get_battery_status(): BatteryStatus {
    return { ...this.currentStatus };
  }

  /**
   * Get battery health information
   */
  async get_battery_health(): Promise<BatteryHealth> {
    if (this.platform === "linux") {
      return this.get_linux_battery_health();
    } else if (this.platform === "win32") {
      return this.get_windows_battery_health();
    } else if (this.platform === "darwin") {
      return this.get_macos_battery_health();
    }

    return this.get_default_battery_health();
  }

  /**
   * Get battery health on Linux
   */
  private async get_linux_battery_health(): Promise<BatteryHealth> {
    try {
      const basePath = "/sys/class/power_supply";

      // Find battery
      const devices = await fs.readdir(basePath);
      const battery = devices.find(d => d.toLowerCase().includes("bat"));

      if (!battery) {
        return this.get_default_battery_health();
      }

      const batteryPath = `${basePath}/${battery}`;

      // Read capacity and cycle count
      const [capacity, designCapacity, cycleCount] = await Promise.all([
        this.read_sysfs_file(`${batteryPath}/capacity`),
        this.read_sysfs_file(`${batteryPath}/energy_full_design`),
        this.read_sysfs_file(`${batteryPath}/cycle_count`),
      ]);

      const currentCap = parseInt(capacity) || 100;
      const designCap = parseInt(designCapacity) || 100;
      const cycles = parseInt(cycleCount) || 0;

      const healthPercentage = (currentCap / designCap) * 100;

      return {
        design_capacity: designCap,
        current_capacity: currentCap,
        health_percentage: Math.round(healthPercentage),
        cycle_count: cycles,
        condition: this.determine_condition(healthPercentage, cycles),
        estimated_life_remaining: this.estimate_battery_life(cycles),
      };
    } catch (error) {
      console.error("Could not read Linux battery health:", error);
      return this.get_default_battery_health();
    }
  }

  /**
   * Get battery health on Windows
   */
  private async get_windows_battery_health(): Promise<BatteryHealth> {
    try {
      const { stdout } = await execAsync(
        "wmic path Win32_Battery get DesignCapacity,FullChargedCapacity,CycleCount /value"
      );

      const lines = stdout.split("\n");
      const getVal = (key: string) => {
        const line = lines.find(l => l.includes(key));
        return line ? parseInt(line.split("=")[1]) : 0;
      };

      const designCapacity = getVal("DesignCapacity") || 50000;
      const currentCapacity = getVal("FullChargedCapacity") || designCapacity;
      const cycles = getVal("CycleCount") || 0;

      const healthPercentage = (currentCapacity / designCapacity) * 100;

      return {
        design_capacity: designCapacity,
        current_capacity: currentCapacity,
        health_percentage: Math.round(healthPercentage),
        cycle_count: cycles,
        condition: this.determine_condition(healthPercentage, cycles),
        estimated_life_remaining: this.estimate_battery_life(cycles),
      };
    } catch (error) {
      console.error("Could not read Windows battery health:", error);
      return this.get_default_battery_health();
    }
  }

  /**
   * Get battery health on macOS
   */
  private async get_macos_battery_health(): Promise<BatteryHealth> {
    try {
      const { stdout } = await execAsync(
        'system_profiler SPPowerDataType | grep -i "cycle count\\|maximum\\|condition"'
      );

      const cycleMatch = stdout.match(/Cycle Count.*?(\d+)/);
      const conditionMatch = stdout.match(/Condition.*?(\w+)/);
      const maxMatch = stdout.match(/Maximum Capacity.*?(\d+)/);

      const cycles = cycleMatch ? parseInt(cycleMatch[1]) : 0;
      const healthPercentage = maxMatch ? parseInt(maxMatch[1]) : 100;
      const condition = (
        conditionMatch ? conditionMatch[1].toLowerCase() : "normal"
      ) as "normal" | "service" | "replace" | "critical";

      return {
        design_capacity: 50000, // Assume ~50Wh design capacity
        current_capacity: Math.round((healthPercentage / 100) * 50000),
        health_percentage: healthPercentage,
        cycle_count: cycles,
        condition,
        estimated_life_remaining: this.estimate_battery_life(cycles),
      };
    } catch (error) {
      console.error("Could not read macOS battery health:", error);
      return this.get_default_battery_health();
    }
  }

  /**
   * Get default battery health values
   */
  private get_default_battery_health(): BatteryHealth {
    return {
      design_capacity: 50000,
      current_capacity: 50000,
      health_percentage: 100,
      cycle_count: 0,
      condition: "normal",
      estimated_life_remaining: { value: 5, unit: "years" },
    };
  }

  /**
   * Determine battery condition from health percentage and cycles
   */
  private determine_condition(
    health: number,
    cycles: number
  ): "normal" | "service" | "replace" | "critical" {
    if (health < 50 || cycles > 1000) return "critical";
    if (health < 70 || cycles > 800) return "replace";
    if (health < 85 || cycles > 500) return "service";
    return "normal";
  }

  /**
   * Estimate remaining battery life in years
   */
  private estimate_battery_life(cycles: number): Duration {
    // Assume 1000 cycles is the design life
    const remainingCycles = Math.max(0, 1000 - cycles);
    // Assume 1 cycle per day average
    const remainingDays = remainingCycles;
    const remainingYears = remainingDays / 365;

    return {
      value: Math.round(remainingYears * 10) / 10,
      unit: "years",
    };
  }

  /**
   * Get battery prediction for a duration
   */
  async get_battery_prediction(duration: Duration): Promise<BatteryPrediction> {
    const durationMs =
      duration.unit === "seconds"
        ? duration.value * 1000
        : duration.unit === "minutes"
          ? duration.value * 60000
          : duration.value * 3600000;

    const now = Date.now();
    const future = now + durationMs;

    // Use recent history to predict
    const recentHistory = this.powerHistory.slice(-100);

    if (recentHistory.length < 10) {
      // Not enough data
      return {
        time_until_empty: this.currentStatus.time_remaining,
        time_until_full: { value: 0, unit: "minutes" },
        predicted_power_curve: [],
        confidence: 0,
        warning_threshold: this.config.low_battery_threshold!,
      };
    }

    // Calculate average discharge rate
    let totalDischarge = 0;
    let totalTime = 0;

    for (let i = 1; i < recentHistory.length; i++) {
      const prev = recentHistory[i - 1];
      const curr = recentHistory[i];
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
      const levelDiff = prev.level - curr.level;

      if (timeDiff > 0) {
        totalDischarge += levelDiff / timeDiff; // % per second
        totalTime += timeDiff;
      }
    }

    const avgDischargeRate = totalDischarge / recentHistory.length; // % per second

    // Predict time until empty
    const secondsUntilEmpty =
      avgDischargeRate > 0
        ? this.currentStatus.level / avgDischargeRate
        : Infinity;

    // Predict time until full
    const secondsUntilFull = this.currentStatus.is_charging
      ? (100 - this.currentStatus.level) / Math.abs(avgDischargeRate)
      : 0;

    // Generate power curve
    const predictedCurve: PowerDataPoint[] = [];
    const steps = 60;
    const stepDuration = durationMs / steps;

    for (let i = 0; i <= steps; i++) {
      const predictedLevel =
        this.currentStatus.level -
        avgDischargeRate * ((stepDuration * i) / 1000);
      predictedCurve.push({
        timestamp: now + stepDuration * i,
        level: Math.max(0, predictedLevel),
        power: this.currentStatus.discharge_rate,
      });
    }

    // Calculate confidence based on data quality
    const variance = this.calculate_variance(recentHistory);
    const confidence = Math.max(0, 1 - variance / 50);

    return {
      time_until_empty: {
        value: Math.round(secondsUntilEmpty / 60),
        unit: "minutes",
      },
      time_until_full: {
        value: Math.round(secondsUntilFull / 60),
        unit: "minutes",
      },
      predicted_power_curve: predictedCurve,
      confidence: Math.round(confidence * 100) / 100,
      warning_threshold: this.config.low_battery_threshold!,
    };
  }

  /**
   * Calculate variance in battery drain rate
   */
  private calculate_variance(history: PowerDataPoint[]): number {
    if (history.length < 2) return 0;

    let totalDrain = 0;
    const drains: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const drain = history[i - 1].level - history[i].level;
      drains.push(drain);
      totalDrain += drain;
    }

    const avg = totalDrain / drains.length;
    let variance = 0;

    for (const drain of drains) {
      variance += Math.pow(drain - avg, 2);
    }

    return variance / drains.length;
  }

  /**
   * Optimize settings for maximum battery life
   */
  async optimize_for_battery_life(): Promise<void> {
    // This would integrate with PowerStateController
    // For now, emit an event that can be acted upon
    this.emit("optimize_battery_life", {
      strategy: "max_battery",
      reason: "battery_optimization_requested",
    });
  }

  /**
   * Optimize settings for maximum performance
   */
  async optimize_for_performance(): Promise<void> {
    this.emit("optimize_performance", {
      strategy: "max_performance",
      reason: "performance_optimization_requested",
    });
  }

  /**
   * Set power limit in watts
   */
  async set_power_limit(limit: number): Promise<void> {
    this.emit("power_limit_set", {
      limit,
      unit: "watts",
    });
  }

  /**
   * Check if currently running on battery
   */
  is_on_battery(): boolean {
    return this.powerSource === "battery";
  }

  /**
   * Get estimated time remaining
   */
  get_time_remaining(): Duration {
    return this.currentStatus.time_remaining;
  }

  /**
   * Get estimated charge time
   */
  get_charge_time(): Duration {
    if (!this.currentStatus.is_charging) {
      return { value: 0, unit: "minutes" };
    }

    const chargeRate = this.currentStatus.charge_rate;
    const remaining = 100 - this.currentStatus.level;

    if (chargeRate <= 0) {
      return { value: 0, unit: "minutes" };
    }

    // Estimate charge time based on rate
    const batteryCapacity = 50000; // 50 Wh typical
    const remainingEnergy = (remaining / 100) * batteryCapacity;
    const chargeTimeHours = remainingEnergy / chargeRate;
    const chargeTimeMinutes = Math.round(chargeTimeHours * 60);

    return {
      value: chargeTimeMinutes,
      unit: "minutes",
    };
  }

  /**
   * Select appropriate power strategy based on battery level
   */
  select_power_strategy(): PowerStrategy {
    const level = this.currentStatus.level;

    if (this.currentStatus.is_charging) {
      // When charging, we can use more power
      if (level > 80) return "max_performance";
      return "balanced";
    }

    // On battery, be more conservative
    if (level > 60) return "balanced";
    if (level > 30) return "power_saver";
    if (level > 15) return "max_battery";
    return "max_battery"; // Critical level
  }

  /**
   * Adjust settings based on battery level
   */
  async adjust_for_battery_level(): Promise<void> {
    const strategy = this.select_power_strategy();
    const level = this.currentStatus.level;

    // Emit strategy change event
    this.emit("strategy_changed", {
      strategy,
      battery_level: level,
      is_charging: this.currentStatus.is_charging,
    });

    // Emit warnings if needed
    if (level <= this.config.critical_battery_threshold!) {
      this.emit("battery_critical", this.currentStatus);
    } else if (level <= this.config.low_battery_threshold!) {
      this.emit("battery_low", this.currentStatus);
    }
  }

  /**
   * Show precharge warning
   */
  precharge_warning(): void {
    const timeRemaining = this.get_time_remaining();

    if (this.currentStatus.is_charging) {
      return; // No warning needed when charging
    }

    if (timeRemaining.value < 30 && timeRemaining.unit === "minutes") {
      this.emit("precharge_warning", {
        message: `Low battery: ${this.currentStatus.level}%`,
        time_remaining: timeRemaining,
        recommendation: "Connect to power source",
      });
    }
  }

  /**
   * Read battery status from system
   */
  private async read_battery_status(): Promise<BatteryStatus> {
    if (this.platform === "linux") {
      return this.read_linux_battery_status();
    } else if (this.platform === "win32") {
      return this.read_windows_battery_status();
    } else if (this.platform === "darwin") {
      return this.read_macos_battery_status();
    }

    return this.get_default_battery_status();
  }

  /**
   * Read battery status on Linux
   */
  private async read_linux_battery_status(): Promise<BatteryStatus> {
    try {
      const basePath = "/sys/class/power_supply";
      const devices = await fs.readdir(basePath);
      const battery = devices.find(d => d.toLowerCase().includes("bat"));

      if (!battery) {
        return this.get_default_battery_status();
      }

      const batteryPath = `${basePath}/${battery}`;

      const [capacity, status, currentNow, voltageNow] = await Promise.all([
        this.read_sysfs_file(`${batteryPath}/capacity`),
        this.read_sysfs_file(`${batteryPath}/status`),
        this.read_sysfs_file(`${batteryPath}/current_now`).catch(() => "0"),
        this.read_sysfs_file(`${batteryPath}/voltage_now`).catch(() => "0"),
      ]);

      const level = parseInt(capacity) || 100;
      const isCharging = status?.trim() === "Charging";
      const current = parseInt(currentNow) / 1000; // mA
      const voltage = parseInt(voltageNow) / 1000000; // V

      const power = Math.abs(current * voltage); // watts
      const dischargeRate = isCharging ? 0 : power;
      const chargeRate = isCharging ? power : 0;

      // Estimate time remaining
      const batteryCapacity = 50000; // 50 Wh typical
      const energyRemaining = (level / 100) * batteryCapacity;
      const hoursRemaining =
        dischargeRate > 0 ? energyRemaining / dischargeRate : 0;

      return {
        level,
        is_charging: isCharging,
        time_remaining: {
          value: Math.round(hoursRemaining * 60),
          unit: "minutes",
        },
        charge_rate: chargeRate,
        discharge_rate: dischargeRate,
        health: 100, // Would read from separate file
        cycles: 0,
        voltage,
        temperature: 25, // Would read from thermal sensor
      };
    } catch (error) {
      console.error("Could not read Linux battery status:", error);
      return this.get_default_battery_status();
    }
  }

  /**
   * Read battery status on Windows
   */
  private async read_windows_battery_status(): Promise<BatteryStatus> {
    try {
      const { stdout } = await execAsync(
        "wmic path Win32_Battery get EstimatedChargeRemaining,BatteryStatus,DesignVoltage,EstimatedRunTime /value"
      );

      const lines = stdout.split("\n");
      const getVal = (key: string) => {
        const line = lines.find(l => l.includes(key));
        return line ? parseInt(line.split("=")[1]) : 0;
      };

      const level = getVal("EstimatedChargeRemaining") || 100;
      const status = getVal("BatteryStatus"); // 2 = on AC, 1 = on battery
      const voltage = (getVal("DesignVoltage") || 11100) / 1000;
      const runTime = getVal("EstimatedRunTime"); // minutes

      const isCharging = status === 2;

      return {
        level,
        is_charging: isCharging,
        time_remaining: {
          value: runTime || 0,
          unit: "minutes",
        },
        charge_rate: isCharging ? 10 : 0,
        discharge_rate: isCharging ? 0 : 15,
        health: 100,
        cycles: 0,
        voltage,
        temperature: 25,
      };
    } catch (error) {
      console.error("Could not read Windows battery status:", error);
      return this.get_default_battery_status();
    }
  }

  /**
   * Read battery status on macOS
   */
  private async read_macos_battery_status(): Promise<BatteryStatus> {
    try {
      const { stdout } = await execAsync("pmset -g batt");

      const match = stdout.match(/(\d+)%.*?(charged|charging|discharging)/i);
      if (!match) {
        return this.get_default_battery_status();
      }

      const level = parseInt(match[1]);
      const state = match[2].toLowerCase();
      const isCharging = state === "charging" || state === "charged";

      // Try to get time remaining
      const timeMatch = stdout.match(/(\d+):(\d+)/);
      let timeRemaining = { value: 0, unit: "minutes" as const };
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        timeRemaining = {
          value: hours * 60 + minutes,
          unit: "minutes",
        };
      }

      return {
        level,
        is_charging: isCharging,
        time_remaining: timeRemaining,
        charge_rate: isCharging ? 15 : 0,
        discharge_rate: isCharging ? 0 : 10,
        health: 100,
        cycles: 0,
        voltage: 11.4,
        temperature: 25,
      };
    } catch (error) {
      console.error("Could not read macOS battery status:", error);
      return this.get_default_battery_status();
    }
  }

  /**
   * Get default battery status
   */
  private get_default_battery_status(): BatteryStatus {
    return {
      level: 100,
      is_charging: true,
      time_remaining: { value: 0, unit: "minutes" },
      charge_rate: 0,
      discharge_rate: 0,
      health: 100,
      cycles: 0,
      voltage: 12.0,
      temperature: 25,
    };
  }

  /**
   * Detect current power source
   */
  private async detect_power_source(): Promise<PowerSource> {
    if (this.platform === "linux") {
      try {
        const onlinePath = "/sys/class/power_supply/AC/online";
        const online = await this.read_sysfs_file(onlinePath);
        return online === "1" ? "ac" : "battery";
      } catch {
        return "battery";
      }
    } else if (this.platform === "darwin") {
      try {
        const { stdout } = await execAsync("pmset -g ps");
        return stdout.includes("AC Power") ? "ac" : "battery";
      } catch {
        return "battery";
      }
    } else if (this.platform === "win32") {
      try {
        const { stdout } = await execAsync("powercfg /getactivescheme");
        // Windows doesn't make this as straightforward
        return "ac";
      } catch {
        return "battery";
      }
    }

    return "ac";
  }

  /**
   * Helper to read sysfs file
   */
  private async read_sysfs_file(path: string): Promise<string> {
    try {
      const content = await fs.readFile(path, "utf-8");
      return content.trim();
    } catch {
      return "";
    }
  }

  /**
   * Start monitoring battery status
   */
  private start_monitoring(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(async () => {
      this.previousStatus = { ...this.currentStatus };
      this.currentStatus = await this.read_battery_status();

      // Add to history
      this.powerHistory.push({
        timestamp: Date.now(),
        level: this.currentStatus.level,
        power: this.currentStatus.discharge_rate,
      });

      // Trim history
      if (this.powerHistory.length > this.config.history_size!) {
        this.powerHistory.shift();
      }

      // Check for changes
      this.detect_changes();

      // Emit update
      this.emit("status_update", this.currentStatus);

      // Auto-adjust based on battery level
      await this.adjust_for_battery_level();
    }, this.config.update_interval);
  }

  /**
   * Detect and emit changes in battery status
   */
  private detect_changes(): void {
    if (!this.previousStatus) return;

    const oldStatus = this.previousStatus;
    const newStatus = this.currentStatus;

    // Check for level changes
    if (oldStatus.level !== newStatus.level) {
      const event: BatteryStatusEvent = {
        old_status: oldStatus,
        new_status: newStatus,
        change: "level",
      };
      this.emit("level_changed", event);
    }

    // Check for charging state changes
    if (oldStatus.is_charging !== newStatus.is_charging) {
      const newSource = newStatus.is_charging ? "ac" : "battery";
      this.powerSource = newSource;

      const event: BatteryStatusEvent = {
        old_status: oldStatus,
        new_status: newStatus,
        change: "charging_state",
      };
      this.emit("charging_state_changed", event);
      this.emit("power_source_changed", newSource);
    }
  }

  /**
   * Stop monitoring
   */
  stop_monitoring(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.stop_monitoring();
    this.removeAllListeners();
    this.initialized = false;
  }

  /**
   * Check if initialized
   */
  is_initialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current power source
   */
  get_power_source(): PowerSource {
    return this.powerSource;
  }

  /**
   * Get power history
   */
  get_power_history(): PowerDataPoint[] {
    return [...this.powerHistory];
  }
}
