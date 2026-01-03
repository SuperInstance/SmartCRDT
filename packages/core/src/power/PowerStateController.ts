/**
 * PowerStateController - Fine-grained CPU power state management
 *
 * Manages CPU power states including C-states (idle states), P-states (performance states),
 * dynamic voltage/frequency scaling (DVFS), and power consumption monitoring.
 *
 * Platform Support:
 * - Linux: Uses /sys/devices/system/cpu/ for direct access
 * - Windows: Uses WMI or powercfg (requires admin)
 * - macOS: Uses sysctl and power management APIs
 *
 * @module power
 */

import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * CPU C-state (idle state)
 * Deeper C-states save more power but have longer wake latencies
 */
export type CState = "C0" | "C1" | "C1E" | "C3" | "C6" | "C7" | "C8";

/**
 * CPU P-state (performance state)
 * Lower numbers = higher performance = more power
 */
export type PState = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

/**
 * CPU frequency governor
 */
export type Governor =
  | "performance" // Always max frequency
  | "powersave" // Always min frequency
  | "ondemand" // Dynamic based on load
  | "conservative" // Gradual changes
  | "schedutil" // Scheduler-based (recommended)
  | "userspace"; // Manual control

/**
 * Complete power state description
 */
export interface PowerState {
  name: string;
  c_state: CState;
  p_state: PState;
  frequency: number;
  voltage: number;
  power_consumption: number; // watts
}

/**
 * CPU frequency information
 */
export interface CpuFrequencies {
  min: number; // kHz
  max: number; // kHz
  current: number; // kHz
  governor: Governor;
}

/**
 * C-state usage statistics
 */
export interface CStateUsage {
  state: CState;
  time: number; // milliseconds
  percentage: number;
  latency: number; // microseconds to wake
  power: number; // watts saved
}

/**
 * Power consumption data
 */
export interface PowerConsumption {
  cpu: number; // watts
  gpu: number; // watts
  dram: number; // watts
  total: number; // watts
  timestamp: number;
}

/**
 * Power data point for history
 */
export interface PowerDataPoint {
  timestamp: number;
  power: number; // watts
  frequency: number; // kHz
  temperature: number; // celsius
}

/**
 * Duration type (seconds or milliseconds)
 */
export interface Duration {
  value: number;
  unit: "seconds" | "milliseconds";
}

/**
 * Estimated power cost for an operation
 */
export interface PowerCost {
  energy: number; // joules
  power: number; // watts
  time: number; // milliseconds
  battery_impact: number; // percentage points
}

/**
 * Predefined power profiles
 */
export type PowerProfile =
  | "max_performance"
  | "high_performance"
  | "balanced"
  | "power_saver"
  | "max_battery";

/**
 * Custom power profile configuration
 */
export interface CustomProfileConfig {
  name: string;
  governor: Governor;
  min_frequency?: number;
  max_frequency?: number;
  allowed_c_states: CState[];
  performance_preference: number; // 0-1, higher = more performance
}

/**
 * Power state controller configuration
 */
export interface PowerStateConfig {
  platform?: "linux" | "windows" | "darwin" | "auto";
  update_interval?: number; // milliseconds
  enable_c_states?: boolean;
  enable_p_states?: boolean;
  privileged?: boolean; // whether we have elevated privileges
  history_size?: number; // number of data points to keep
}

/**
 * Platform detection result
 */
interface PlatformInfo {
  platform: NodeJS.Platform;
  has_sysfs: boolean;
  has_privileges: boolean;
  cpu_count: number;
}

/**
 * PowerStateController - Main power state management class
 *
 * @example
 * ```typescript
 * const controller = new PowerStateController();
 * await controller.initialize();
 *
 * // Get current state
 * const state = controller.get_current_power_state();
 *
 * // Set performance mode
 * await controller.set_governor('performance');
 *
 * // Get power consumption
 * const power = controller.get_power_consumption();
 * ```
 */
export class PowerStateController extends EventEmitter {
  private config: PowerStateConfig;
  private platform: PlatformInfo;
  private initialized: boolean = false;
  private powerHistory: PowerDataPoint[] = [];
  private updateTimer?: NodeJS.Timeout;
  private currentState: PowerState;
  private availableStates: PowerState[] = [];

  constructor(config: PowerStateConfig = {}) {
    super();
    this.config = {
      platform: config.platform || "auto",
      update_interval: config.update_interval || 1000,
      enable_c_states: config.enable_c_states !== false,
      enable_p_states: config.enable_p_states !== false,
      privileged: config.privileged || false,
      history_size: config.history_size || 3600,
    };
    this.platform = this.detect_platform();
    this.currentState = this.default_power_state();
  }

  /**
   * Initialize the power state controller
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Detect platform and capabilities
    await this.detect_capabilities();

    // Read current power state
    this.currentState = await this.read_current_state();

    // Build available power states
    this.availableStates = await this.build_available_states();

    // Start monitoring
    this.start_monitoring();

    this.initialized = true;
    this.emit("initialized");
  }

  /**
   * Detect the current platform
   */
  private detect_platform(): PlatformInfo {
    const platform = process.platform;
    const has_sysfs = platform === "linux";
    const cpu_count = require("os").cpus().length;

    return {
      platform,
      has_sysfs,
      has_privileges: this.config.privileged || false,
      cpu_count,
    };
  }

  /**
   * Detect platform capabilities (privileged access, etc.)
   */
  private async detect_capabilities(): Promise<void> {
    try {
      if (this.platform.platform === "linux") {
        // Try to read sysfs to check privileges
        await fs.access("/sys/devices/system/cpu/cpufreq", fs.constants.R_OK);
        this.platform.has_privileges = true;
      } else if (this.platform.platform === "win32") {
        // Check for admin privileges on Windows
        try {
          await execAsync("powercfg /list");
          this.platform.has_privileges = true;
        } catch {
          this.platform.has_privileges = false;
        }
      }
    } catch (error) {
      this.platform.has_privileges = false;
    }
  }

  /**
   * Get the current power state
   */
  get_current_power_state(): PowerState {
    return { ...this.currentState };
  }

  /**
   * Set a specific power state
   */
  async set_power_state(state: PowerState): Promise<void> {
    if (!this.platform.has_privileges) {
      throw new Error("Insufficient privileges to set power state");
    }

    if (this.platform.platform === "linux") {
      await this.set_linux_power_state(state);
    } else if (this.platform.platform === "win32") {
      await this.set_windows_power_state(state);
    } else if (this.platform.platform === "darwin") {
      await this.set_macos_power_state(state);
    }

    this.currentState = state;
    this.emit("power_state_changed", state);
  }

  /**
   * Set power state on Linux via sysfs
   */
  private async set_linux_power_state(state: PowerState): Promise<void> {
    const cpuCount = this.platform.cpu_count;

    // Set governor
    for (let cpu = 0; cpu < cpuCount; cpu++) {
      const governorPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_governor`;
      try {
        await fs.writeFile(governorPath, state.c_state);
      } catch (error) {
        // Some CPUs might not support this
        console.warn(`Could not set governor for CPU ${cpu}:`, error);
      }
    }

    // Set frequency if specified
    if (state.frequency > 0) {
      for (let cpu = 0; cpu < cpuCount; cpu++) {
        const freqPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_setspeed`;
        try {
          await fs.writeFile(freqPath, state.frequency.toString());
        } catch (error) {
          console.warn(`Could not set frequency for CPU ${cpu}:`, error);
        }
      }
    }
  }

  /**
   * Set power state on Windows via powercfg
   */
  private async set_windows_power_state(state: PowerState): Promise<void> {
    // Windows power management is less granular
    // Use powercfg to set power plan
    try {
      if (state.frequency > 2000000) {
        await execAsync(
          "powercfg /setactive 8c5e7fda-e8bf-45a6-a6cc-4b3c3f300d00"
        ); // High performance
      } else if (state.frequency < 1000000) {
        await execAsync(
          "powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a"
        ); // Power saver
      } else {
        await execAsync(
          "powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e"
        ); // Balanced
      }
    } catch (error) {
      console.error("Could not set Windows power state:", error);
    }
  }

  /**
   * Set power state on macOS
   */
  private async set_macos_power_state(state: PowerState): Promise<void> {
    // macOS power management via pmset
    try {
      if (state.frequency > 2000000) {
        await execAsync("pmset -c高性能"); // High performance (if available)
      } else {
        await execAsync("pmset -c自动");
      }
    } catch (error) {
      console.error("Could not set macOS power state:", error);
    }
  }

  /**
   * Get available power states
   */
  get_available_power_states(): PowerState[] {
    return [...this.availableStates];
  }

  /**
   * Get CPU frequency information
   */
  async get_cpu_frequencies(): Promise<CpuFrequencies> {
    if (this.platform.platform === "linux") {
      return this.get_linux_cpu_frequencies();
    } else if (this.platform.platform === "win32") {
      return this.get_windows_cpu_frequencies();
    } else if (this.platform.platform === "darwin") {
      return this.get_macos_cpu_frequencies();
    }

    // Fallback: use os.cpus()
    const cpus = require("os").cpus();
    return {
      min: 800000,
      max: cpus[0]?.speed * 1000 || 3000000,
      current: cpus[0]?.speed * 1000 || 2000000,
      governor: "ondemand",
    };
  }

  /**
   * Get CPU frequencies on Linux
   */
  private async get_linux_cpu_frequencies(): Promise<CpuFrequencies> {
    try {
      const cpu0 = "/sys/devices/system/cpu/cpu0/cpufreq";

      const [min, max, current, governor] = await Promise.all([
        fs.readFile(`${cpu0}/scaling_min_freq`, "utf-8").catch(() => undefined),
        fs.readFile(`${cpu0}/scaling_max_freq`, "utf-8").catch(() => undefined),
        fs.readFile(`${cpu0}/scaling_cur_freq`, "utf-8").catch(() => undefined),
        fs.readFile(`${cpu0}/scaling_governor`, "utf-8").catch(() => undefined),
      ]);

      // Validate all values were read successfully
      if (!min || !max || !current || !governor) {
        throw new Error("Could not read all CPU frequency values");
      }

      return {
        min: parseInt(min.trim()),
        max: parseInt(max.trim()),
        current: parseInt(current.trim()),
        governor: governor.trim() as Governor,
      };
    } catch (error) {
      console.error("Could not read Linux CPU frequencies:", error);
      return this.get_default_frequencies();
    }
  }

  /**
   * Get CPU frequencies on Windows
   */
  private async get_windows_cpu_frequencies(): Promise<CpuFrequencies> {
    try {
      const { stdout } = await execAsync(
        "wmic cpu get CurrentClockSpeed,MaxClockSpeed /value"
      );
      const lines = stdout.split("\n");
      const current =
        parseInt(
          lines.find(l => l.includes("CurrentClockSpeed"))?.split("=")[1] ||
            "2000"
        ) * 1000;
      const max =
        parseInt(
          lines.find(l => l.includes("MaxClockSpeed"))?.split("=")[1] || "3000"
        ) * 1000;

      return {
        min: Math.round(max * 0.3),
        max,
        current,
        governor: "ondemand",
      };
    } catch (error) {
      return this.get_default_frequencies();
    }
  }

  /**
   * Get CPU frequencies on macOS
   */
  private async get_macos_cpu_frequencies(): Promise<CpuFrequencies> {
    try {
      const { stdout } = await execAsync("sysctl -n hw.cpufrequency");
      const current = parseInt(stdout.trim());
      return {
        min: Math.round(current * 0.6),
        max: current,
        current,
        governor: "ondemand",
      };
    } catch (error) {
      return this.get_default_frequencies();
    }
  }

  /**
   * Get default frequency values
   */
  private get_default_frequencies(): CpuFrequencies {
    const cpus = require("os").cpus();
    const speed = (cpus[0]?.speed || 2000) * 1000;
    return {
      min: Math.round(speed * 0.4),
      max: speed,
      current: speed,
      governor: "ondemand",
    };
  }

  /**
   * Set CPU frequency for a specific core
   */
  async set_cpu_frequency(cpu: number, frequency: number): Promise<void> {
    if (!this.platform.has_privileges) {
      throw new Error("Insufficient privileges to set CPU frequency");
    }

    if (this.platform.platform === "linux") {
      const freqPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_setspeed`;
      await fs.writeFile(freqPath, frequency.toString());
    } else {
      throw new Error(
        "Per-CPU frequency control not supported on this platform"
      );
    }
  }

  /**
   * Set the CPU frequency governor
   */
  async set_governor(governor: Governor): Promise<void> {
    if (!this.platform.has_privileges) {
      throw new Error("Insufficient privileges to set governor");
    }

    const cpuCount = this.platform.cpu_count;

    if (this.platform.platform === "linux") {
      for (let cpu = 0; cpu < cpuCount; cpu++) {
        const governorPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_governor`;
        try {
          await fs.writeFile(governorPath, governor);
        } catch (error) {
          console.warn(`Could not set governor for CPU ${cpu}:`, error);
        }
      }
    } else if (this.platform.platform === "win32") {
      // Map governor to Windows power plans
      const plans = {
        performance: "8c5e7fda-e8bf-45a6-a6cc-4b3c3f300d00",
        powersave: "a1841308-3541-4fab-bc81-f71556f20b4a",
        balanced: "381b4222-f694-41f0-9685-ff5bb260df2e",
      };

      const planId = plans[governor] || plans.balanced;
      await execAsync(`powercfg /setactive ${planId}`);
    }

    this.emit("governor_changed", governor);
  }

  /**
   * Get the current governor
   */
  get_governor(): Governor {
    const freqs = this.get_cpu_frequencies();
    // Sync method returns cached value
    return this.currentState.c_state as Governor;
  }

  /**
   * Enable a specific C-state
   */
  async enable_c_state(state: CState): Promise<void> {
    if (!this.config.enable_c_states) {
      return;
    }

    if (this.platform.platform === "linux") {
      // C-state control is complex and platform-specific
      // This is a simplified implementation
      try {
        const cpuCount = this.platform.cpu_count;
        for (let cpu = 0; cpu < cpuCount; cpu++) {
          // Enable deeper C-states for power saving
          // Note: Actual implementation varies by CPU vendor
        }
      } catch (error) {
        console.error("Could not enable C-state:", error);
      }
    }

    this.emit("c_state_enabled", state);
  }

  /**
   * Disable a specific C-state
   */
  async disable_c_state(state: CState): Promise<void> {
    if (this.platform.platform === "linux") {
      try {
        // Disable the specified C-state
        // Note: This is often done via kernel parameters or BIOS
      } catch (error) {
        console.error("Could not disable C-state:", error);
      }
    }

    this.emit("c_state_disabled", state);
  }

  /**
   * Get C-state usage statistics
   */
  async get_c_state_usage(): Promise<CStateUsage[]> {
    if (this.platform.platform !== "linux") {
      return this.get_default_c_states();
    }

    try {
      const usage: CStateUsage[] = [];

      // Read C-state stats from sysfs
      const cpu0Path = "/sys/devices/system/cpu/cpu0/cpuidle";
      const states = await fs.readdir(cpu0Path);

      for (const stateDir of states) {
        if (stateDir.startsWith("state")) {
          const statePath = path.join(cpu0Path, stateDir);
          const name = await fs.readFile(path.join(statePath, "name"), "utf-8");
          const time = await fs.readFile(path.join(statePath, "time"), "utf-8");
          const latency = await fs.readFile(
            path.join(statePath, "latency"),
            "utf-8"
          );

          usage.push({
            state: name.trim().toUpperCase() as CState,
            time: parseInt(time.trim()),
            percentage: 0, // Calculate relative to total time
            latency: parseInt(latency.trim()),
            power: this.estimate_c_state_power(name.trim() as CState),
          });
        }
      }

      return usage;
    } catch (error) {
      console.error("Could not read C-state usage:", error);
      return this.get_default_c_states();
    }
  }

  /**
   * Get default C-state information
   */
  private get_default_c_states(): CStateUsage[] {
    return [
      { state: "C0", time: 0, percentage: 100, latency: 0, power: 0 },
      { state: "C1", time: 0, percentage: 0, latency: 1, power: 0.1 },
      { state: "C6", time: 0, percentage: 0, latency: 100, power: 1.5 },
    ];
  }

  /**
   * Estimate power savings for a C-state
   */
  private estimate_c_state_power(state: CState): number {
    const powerSavings: Record<CState, number> = {
      C0: 0,
      C1: 0.1,
      C1E: 0.2,
      C3: 0.5,
      C6: 1.5,
      C7: 2.0,
      C8: 2.5,
    };
    return powerSavings[state] || 0;
  }

  /**
   * Get current power consumption
   */
  get_power_consumption(): PowerConsumption {
    // Estimate based on CPU frequency and usage
    const basePower = 15; // Base CPU power in watts
    const frequencyMultiplier = this.currentState.frequency / 3000000; // Normalize to 3GHz
    const cpuPower = basePower * frequencyMultiplier;

    return {
      cpu: cpuPower,
      gpu: 0, // Not implemented yet
      dram: 5, // Typical DRAM power
      total: cpuPower + 5,
      timestamp: Date.now(),
    };
  }

  /**
   * Get power history
   */
  get_power_history(duration: Duration): PowerDataPoint[] {
    const now = Date.now();
    const durationMs =
      duration.unit === "seconds" ? duration.value * 1000 : duration.value;

    const cutoff = now - durationMs;
    return this.powerHistory.filter(point => point.timestamp >= cutoff);
  }

  /**
   * Estimate power cost for an operation
   */
  estimate_power_cost(operation: string): PowerCost {
    // Define power costs for common operations
    const operationCosts: Record<string, { power: number; time: number }> = {
      embedding: { power: 20, time: 100 },
      inference_small: { power: 15, time: 500 },
      inference_medium: { power: 25, time: 2000 },
      inference_large: { power: 40, time: 5000 },
      cache_lookup: { power: 5, time: 10 },
      cache_insert: { power: 8, time: 50 },
    };

    const cost = operationCosts[operation] || { power: 10, time: 1000 };
    const energy = (cost.power * cost.time) / 1000; // joules

    return {
      energy,
      power: cost.power,
      time: cost.time,
      battery_impact: this.calculate_battery_impact(energy),
    };
  }

  /**
   * Calculate battery impact as percentage
   */
  private calculate_battery_impact(energyJoules: number): number {
    // Assume typical laptop battery capacity of 50 Wh = 180,000 J
    const batteryCapacity = 180000;
    return (energyJoules / batteryCapacity) * 100;
  }

  /**
   * Apply a predefined power profile
   */
  async apply_power_profile(profile: PowerProfile): Promise<void> {
    const profiles: Record<PowerProfile, CustomProfileConfig> = {
      max_performance: {
        name: "Max Performance",
        governor: "performance",
        allowed_c_states: ["C0"],
        performance_preference: 1.0,
      },
      high_performance: {
        name: "High Performance",
        governor: "schedutil",
        min_frequency: 2000000,
        allowed_c_states: ["C0", "C1"],
        performance_preference: 0.8,
      },
      balanced: {
        name: "Balanced",
        governor: "schedutil",
        allowed_c_states: ["C0", "C1", "C3"],
        performance_preference: 0.5,
      },
      power_saver: {
        name: "Power Saver",
        governor: "powersave",
        allowed_c_states: ["C0", "C1", "C3", "C6"],
        performance_preference: 0.2,
      },
      max_battery: {
        name: "Max Battery",
        governor: "powersave",
        max_frequency: 1200000,
        allowed_c_states: ["C0", "C1", "C3", "C6", "C7"],
        performance_preference: 0.0,
      },
    };

    const config = profiles[profile];
    await this.apply_custom_profile(config);
  }

  /**
   * Apply a custom power profile
   */
  async apply_custom_profile(config: CustomProfileConfig): Promise<void> {
    // Set governor
    await this.set_governor(config.governor);

    // Set frequency limits if specified
    if (
      config.min_frequency !== undefined ||
      config.max_frequency !== undefined
    ) {
      const freqs = await this.get_cpu_frequencies();
      const min = config.min_frequency || freqs.min;
      const max = config.max_frequency || freqs.max;

      if (this.platform.platform === "linux" && this.platform.has_privileges) {
        const cpuCount = this.platform.cpu_count;
        for (let cpu = 0; cpu < cpuCount; cpu++) {
          const minPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_min_freq`;
          const maxPath = `/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_max_freq`;
          try {
            await fs.writeFile(minPath, min.toString());
            await fs.writeFile(maxPath, max.toString());
          } catch (error) {
            console.warn(
              `Could not set frequency limits for CPU ${cpu}:`,
              error
            );
          }
        }
      }
    }

    // Configure C-states
    for (const state of config.allowed_c_states) {
      await this.enable_c_state(state);
    }

    this.emit("profile_applied", config);
  }

  /**
   * Create a custom power profile
   */
  create_custom_profile(config: CustomProfileConfig): PowerProfile {
    // Map custom config to one of the predefined profiles
    if (config.performance_preference >= 0.9) {
      return "max_performance";
    } else if (config.performance_preference >= 0.7) {
      return "high_performance";
    } else if (config.performance_preference >= 0.3) {
      return "balanced";
    } else if (config.performance_preference >= 0.1) {
      return "power_saver";
    } else {
      return "max_battery";
    }
  }

  /**
   * Read current power state from system
   */
  private async read_current_state(): Promise<PowerState> {
    const freqs = await this.get_cpu_frequencies();

    return {
      name: "current",
      c_state: "C0",
      p_state: this.frequency_to_p_state(freqs.current),
      frequency: freqs.current,
      voltage: this.estimate_voltage(freqs.current),
      power_consumption: this.estimate_power_consumption(freqs.current),
    };
  }

  /**
   * Build list of available power states
   */
  private async build_available_states(): Promise<PowerState[]> {
    const freqs = await this.get_cpu_frequencies();
    const states: PowerState[] = [];

    // Generate states for different frequency levels
    const frequencies = [
      freqs.max, // P0
      freqs.max * 0.85, // P1
      freqs.max * 0.7, // P2
      freqs.max * 0.55, // P3
      freqs.max * 0.4, // P4
      freqs.min, // P5
    ];

    for (let i = 0; i < frequencies.length; i++) {
      states.push({
        name: `P${i}`,
        c_state: "C0",
        p_state: `P${i}` as PState,
        frequency: Math.round(frequencies[i]),
        voltage: this.estimate_voltage(frequencies[i]),
        power_consumption: this.estimate_power_consumption(frequencies[i]),
      });
    }

    return states;
  }

  /**
   * Map frequency to P-state
   */
  private frequency_to_p_state(frequency: number): PState {
    const ratio = frequency / 3000000; // Normalize to 3GHz
    if (ratio > 0.85) return "P0";
    if (ratio > 0.7) return "P1";
    if (ratio > 0.55) return "P2";
    if (ratio > 0.4) return "P3";
    if (ratio > 0.25) return "P4";
    return "P5";
  }

  /**
   * Estimate voltage for a given frequency
   */
  private estimate_voltage(frequency: number): number {
    // V = Vmin + (Vmax - Vmin) * (f - fmin) / (fmax - fmin)
    const vmin = 0.7;
    const vmax = 1.3;
    const fmin = 800000;
    const fmax = 3000000;
    const ratio = Math.max(0, Math.min(1, (frequency - fmin) / (fmax - fmin)));
    return vmin + (vmax - vmin) * ratio;
  }

  /**
   * Estimate power consumption for a given frequency
   */
  private estimate_power_consumption(frequency: number): number {
    // P = C * V^2 * f
    // Simplified: P scales roughly with V^2 * f
    const voltage = this.estimate_voltage(frequency);
    const frequencyGHz = frequency / 1e9;
    return 10 * voltage * voltage * frequencyGHz; // Base 10W at nominal
  }

  /**
   * Get default power state
   */
  private default_power_state(): PowerState {
    return {
      name: "default",
      c_state: "C0",
      p_state: "P2",
      frequency: 2000000,
      voltage: 1.0,
      power_consumption: 15,
    };
  }

  /**
   * Start monitoring power consumption
   */
  private start_monitoring(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(async () => {
      const power = this.get_power_consumption();
      const freqs = await this.get_cpu_frequencies();

      const dataPoint: PowerDataPoint = {
        timestamp: Date.now(),
        power: power.total,
        frequency: freqs.current,
        temperature: 0, // Would be read from thermal system
      };

      this.powerHistory.push(dataPoint);

      // Trim history
      if (this.powerHistory.length > this.config.history_size!) {
        this.powerHistory.shift();
      }

      this.emit("power_update", dataPoint);
    }, this.config.update_interval);
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
   * Cleanup resources
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
   * Check if we have elevated privileges
   */
  has_privileges(): boolean {
    return this.platform.has_privileges;
  }

  /**
   * Get platform information
   */
  get_platform_info(): PlatformInfo {
    return { ...this.platform };
  }
}
