/**
 * @lsi/webgpu-multi - Device Manager
 *
 * Manages GPU device enumeration, selection, and lifecycle.
 */

import type {
  GPUDevice,
  DeviceSelection,
  GPUDeviceInfo,
  GPUSelectionCriteria,
} from "./types.js";

/**
 * Device Manager for multi-GPU operations
 */
export class DeviceManager {
  private devices: Map<string, GPUDevice> = new Map();
  private adapters: Map<string, GPUAdapter> = new Map();
  private navigatorGPU: GPU | null = null;

  constructor() {
    // Check for WebGPU support
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      this.navigatorGPU = navigator.gpu as GPU;
    }
  }

  /**
   * Check if WebGPU is available
   */
  isWebGPUAvailable(): boolean {
    return this.navigatorGPU !== null;
  }

  /**
   * Enumerate all available GPU adapters
   */
  async enumerateAdapters(): Promise<GPUAdapter[]> {
    if (!this.navigatorGPU) {
      throw new Error("WebGPU is not available");
    }

    const adapters: GPUAdapter[] = [];

    // Request all adapters (powerPreference doesn't matter when requesting all)
    try {
      // WebGPU doesn't have a direct "enumerate all" API
      // We need to request with different preferences
      const lowPower = await this.navigatorGPU.requestAdapter({
        powerPreference: "low-power",
      });
      const highPerformance = await this.navigatorGPU.requestAdapter({
        powerPreference: "high-performance",
      });

      // Deduplicate adapters
      const seen = new Set<string>();
      for (const adapter of [lowPower, highPerformance]) {
        if (adapter) {
          const info = await adapter.requestAdapterInfo();
          const key = `${info.vendor}-${info.architecture}`;
          if (!seen.has(key)) {
            seen.add(key);
            adapters.push(adapter);
            this.adapters.set(key, adapter);
          }
        }
      }
    } catch (error) {
      console.error("Error enumerating adapters:", error);
    }

    return adapters;
  }

  /**
   * Select a device based on criteria
   */
  async selectDevice(
    criteria: DeviceSelection = "auto",
    selectionCriteria?: GPUSelectionCriteria
  ): Promise<GPUDevice | null> {
    const adapters = await this.enumerateAdapters();
    if (adapters.length === 0) {
      return null;
    }

    // Filter by criteria
    let filteredAdapters = adapters;

    if (selectionCriteria?.requiredFeatures) {
      filteredAdapters = filteredAdapters.filter(adapter => {
        const features = adapter.features;
        return selectionCriteria.requiredFeatures!.every(feature =>
          features.has(feature)
        );
      });
    }

    // Score adapters
    const scoredAdapters = await Promise.all(
      filteredAdapters.map(async adapter => {
        const score = await this.scoreAdapter(
          adapter,
          criteria,
          selectionCriteria
        );
        return { adapter, score };
      })
    );

    // Sort by score descending
    scoredAdapters.sort((a, b) => b.score - a.score);

    // Create device from best adapter
    const bestAdapter = scoredAdapters[0]?.adapter;
    if (!bestAdapter) {
      return null;
    }

    return this.createDevice(bestAdapter);
  }

  /**
   * Create devices for all available adapters
   */
  async createAllDevices(): Promise<GPUDevice[]> {
    const adapters = await this.enumerateAdapters();
    const devices: GPUDevice[] = [];

    for (const adapter of adapters) {
      try {
        const device = await this.createDevice(adapter);
        if (device) {
          devices.push(device);
        }
      } catch (error) {
        console.error("Error creating device:", error);
      }
    }

    return devices;
  }

  /**
   * Create a device from an adapter
   */
  async createDevice(
    adapter: GPUAdapter,
    descriptor?: GPUDeviceDescriptor
  ): Promise<GPUDevice | null> {
    try {
      const device = await adapter.requestDevice(descriptor);

      // Wrap device with metadata
      const adapterInfo = await adapter.requestAdapterInfo();
      const limits = adapter.limits;
      const features = Array.from(adapter.features);

      const wrappedDevice: GPUDevice = {
        device_id: this.generateDeviceId(adapterInfo),
        adapter,
        device,
        queue: device.queue,
        features,
        limits,
        type: this.classifyAdapterType(adapterInfo),
        vendor: adapterInfo.vendor || "unknown",
        architecture: adapterInfo.architecture || "unknown",
        memorySize: this.estimateMemorySize(adapterInfo),
        busy: false,
        utilization: 0,
      };

      this.devices.set(wrappedDevice.device_id, wrappedDevice);

      return wrappedDevice;
    } catch (error) {
      console.error("Error creating device:", error);
      return null;
    }
  }

  /**
   * Get detailed information about a device
   */
  async getDeviceInfo(device: GPUDevice): Promise<GPUDeviceInfo> {
    const adapterInfo = await device.adapter.requestAdapterInfo();

    return {
      deviceId: device.device_id,
      adapterInfo,
      features: device.features,
      limits: device.limits,
      type: device.type,
      memorySize: device.memorySize,
      vendor: device.vendor,
      architecture: device.architecture,
      driver: adapterInfo.description || "",
    };
  }

  /**
   * Get the best available device
   */
  async getBestDevice(): Promise<GPUDevice | null> {
    const devices = Array.from(this.devices.values());
    if (devices.length === 0) {
      const created = await this.createAllDevices();
      if (created.length === 0) return null;
      return created[0];
    }

    // Score all devices
    const scored = await Promise.all(
      devices.map(async device => ({
        device,
        score: await this.scoreDevice(device),
      }))
    );

    scored.sort((a, b) => b.score - a.score);
    return scored[0].device;
  }

  /**
   * Get a device by ID
   */
  getDevice(deviceId: string): GPUDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all managed devices
   */
  getAllDevices(): GPUDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Update device utilization
   */
  updateDeviceUtilization(deviceId: string, utilization: number): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.utilization = Math.max(0, Math.min(1, utilization));
      device.busy = utilization > 0.9;
    }
  }

  /**
   * Update device temperature
   */
  updateDeviceTemperature(deviceId: string, temperature: number): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.temperature = temperature;
    }
  }

  /**
   * Update device power usage
   */
  updateDevicePowerUsage(deviceId: string, power: number): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.powerUsage = power;
    }
  }

  /**
   * Destroy a device and release resources
   */
  destroyDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.device.destroy();
      this.devices.delete(deviceId);
    }
  }

  /**
   * Destroy all devices
   */
  destroyAllDevices(): void {
    for (const deviceId of this.devices.keys()) {
      this.destroyDevice(deviceId);
    }
  }

  /**
   * Score an adapter based on criteria
   */
  private async scoreAdapter(
    adapter: GPUAdapter,
    selection: DeviceSelection,
    criteria?: GPUSelectionCriteria
  ): Promise<number> {
    let score = 0;
    const info = await adapter.requestAdapterInfo();

    // Type preference
    const adapterType = this.classifyAdapterType(info);
    switch (selection) {
      case "discrete":
        score += adapterType === "discrete" ? 100 : 0;
        break;
      case "integrated":
        score += adapterType === "integrated" ? 100 : 0;
        break;
      case "cpu":
        score += adapterType === "cpu" ? 100 : 0;
        break;
      case "auto":
      default:
        // Prefer discrete > integrated > cpu
        if (adapterType === "discrete") score += 50;
        else if (adapterType === "integrated") score += 25;
        break;
    }

    // Features
    if (criteria?.preferredFeatures) {
      const featureCount = criteria.preferredFeatures.filter(feature =>
        adapter.features.has(feature)
      ).length;
      score += (featureCount / criteria.preferredFeatures.length) * 30;
    }

    // Memory
    const memorySize = this.estimateMemorySize(info);
    if (criteria?.minMemory && memorySize >= criteria.minMemory) {
      score += 20;
    }

    // Base score for having features
    score += adapter.features.size * 2;

    return score;
  }

  /**
   * Score a device
   */
  private async scoreDevice(device: GPUDevice): Promise<number> {
    let score = 0;

    // Prefer discrete GPUs
    if (device.type === "discrete") score += 50;
    else if (device.type === "integrated") score += 25;

    // Memory size
    score += Math.log10(device.memorySize + 1) * 10;

    // Feature count
    score += device.features.length * 2;

    // Penalize high utilization
    score -= device.utilization * 20;

    // Penalize busy devices
    if (device.busy) score -= 30;

    // Penalize high temperature
    if (device.temperature && device.temperature > 80) {
      score -= (device.temperature - 80) * 2;
    }

    return Math.max(0, score);
  }

  /**
   * Classify adapter type
   */
  private classifyAdapterType(
    info: GPUAdapterInfo
  ): "integrated" | "discrete" | "cpu" | "unknown" {
    const vendor = info.vendor?.toLowerCase() || "";
    const desc = info.description?.toLowerCase() || "";

    // Check for integrated indicators
    if (desc.includes("integrated") || vendor.includes("intel")) {
      return "integrated";
    }

    // Check for discrete indicators
    if (
      desc.includes("discrete") ||
      desc.includes("dedicated") ||
      vendor.includes("nvidia") ||
      vendor.includes("amd")
    ) {
      return "discrete";
    }

    // Check for software/CPU
    if (
      desc.includes("software") ||
      desc.includes("cpu") ||
      desc.includes("swiftshader")
    ) {
      return "cpu";
    }

    return "unknown";
  }

  /**
   * Estimate memory size from adapter info
   */
  private estimateMemorySize(info: GPUAdapterInfo): number {
    const desc = info.description?.toLowerCase() || "";

    // Try to extract memory size from description
    const memoryMatch = desc.match(/(\d+)\s*(gb|gib|mb|mib)/);
    if (memoryMatch) {
      const size = parseInt(memoryMatch[1]);
      const unit = memoryMatch[2].toLowerCase();
      if (unit.startsWith("g")) {
        return size * 1024 * 1024 * 1024;
      } else {
        return size * 1024 * 1024;
      }
    }

    // Default estimates
    if (
      desc.includes("rtx") ||
      desc.includes("radeon") ||
      desc.includes("geforce")
    ) {
      return 8 * 1024 * 1024 * 1024; // 8GB default for discrete
    }
    if (desc.includes("intel")) {
      return 1 * 1024 * 1024 * 1024; // 1GB default for integrated
    }

    return 4 * 1024 * 1024 * 1024; // 4GB default
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(info: GPUAdapterInfo): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${info.vendor}-${info.architecture}-${timestamp}-${random}`.replace(
      /\s+/g,
      "-"
    );
  }
}

/**
 * Default device manager instance
 */
export const defaultDeviceManager = new DeviceManager();
