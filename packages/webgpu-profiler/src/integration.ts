/**
 * Integration - Browser DevTools and framework integration
 *
 * Integrates the WebGPU profiler with browser DevTools, VL-JEPA, and other frameworks
 */

import type {
  ProfileReport,
  GPUInfo,
  ProfiledGPUDevice,
  GPUDevice,
  GPUAdapter,
} from "./types.js";
import { GPUProfiler } from "./profiler/GPUProfiler.js";
import { KernelProfiler } from "./kernel/KernelProfiler.js";
import { MemoryProfiler } from "./memory/MemoryProfiler.js";
import { TransferProfiler } from "./transfer/TransferProfiler.js";
import { UtilizationMonitor } from "./utilization/UtilizationMonitor.js";
import { BottleneckAnalyzer } from "./bottleneck/BottleneckAnalyzer.js";
import { TimelineView } from "./timeline/TimelineView.js";
import { PerformanceReport } from "./report/PerformanceReport.js";

// Global browser types
declare global {
  interface Window {
    __webgpuProfiler?: DevToolsIntegration;
    __webgpuAutoProfile?: boolean;
    __webgpuProfilerInstance?: ProfilerSuite;
    __WebGPUProfiler?: any;
  }

  interface Navigator {
    gpu?: any;
  }

  const document: {
    createElement: (tag: string) => any;
    body: any;
  };
}

/**
 * Profiler suite - Combined profiler with all components
 */
export class ProfilerSuite {
  /** Main GPU profiler */
  readonly gpu: GPUProfiler;
  /** Kernel profiler */
  readonly kernel: KernelProfiler;
  /** Memory profiler */
  readonly memory: MemoryProfiler;
  /** Transfer profiler */
  readonly transfer: TransferProfiler;
  /** Utilization monitor */
  readonly utilization: UtilizationMonitor;
  /** Bottleneck analyzer */
  readonly analyzer: BottleneckAnalyzer;
  /** Timeline view */
  readonly timeline: TimelineView;
  /** Report generator */
  readonly reporter: PerformanceReport;

  /**
   * Create a new profiler suite
   *
   * @param device - WebGPU device to profile
   */
  constructor(device: GPUDevice) {
    this.gpu = new GPUProfiler(device);
    this.kernel = new KernelProfiler();
    this.memory = new MemoryProfiler();
    this.transfer = new TransferProfiler();
    this.utilization = new UtilizationMonitor();
    this.analyzer = new BottleneckAnalyzer();
    this.timeline = new TimelineView();
    this.reporter = new PerformanceReport();
  }

  /**
   * Start all profilers
   */
  startAll(): void {
    this.gpu.startProfiling();
    this.utilization.startSampling();
  }

  /**
   * Stop all profilers and generate report
   */
  stopAll(): ProfileReport {
    this.utilization.stopSampling();
    return this.gpu.stopProfiling();
  }

  /**
   * Reset all profilers
   */
  resetAll(): void {
    this.gpu.reset();
    this.kernel.clear();
    this.memory.clear();
    this.transfer.clear();
    this.utilization.clear();
  }
}

/**
 * Browser DevTools integration
 */
export class DevToolsIntegration {
  /** Profiler suite */
  private profiler?: ProfilerSuite;
  /** DevTools panel */
  private panel?: any;
  /** Is DevTools enabled */
  private enabled = false;

  /**
   * Initialize DevTools integration
   */
  async initialize(): Promise<void> {
    const globalAny = globalThis as any;
    if (typeof globalAny.window === "undefined") return;

    // Check if we're in a browser with WebGPU support
    const nav = globalAny.navigator;
    if (!nav || !nav.gpu) {
      console.warn("WebGPU not supported, DevTools integration disabled");
      return;
    }

    this.enabled = true;

    // Add WebGPU panel to DevTools
    this.createDevToolsPanel();

    // Listen for device creation
    this.instrumentDeviceCreation();
  }

  /**
   * Create DevTools panel
   */
  private createDevToolsPanel(): void {
    // This would integrate with browser DevTools
    // For now, we'll provide a console-based interface
    const w = globalThis as any;
    if (w.window) {
      w.window.__webgpuProfiler = this;
    }
  }

  /**
   * Instrument WebGPU device creation
   */
  private instrumentDeviceCreation(): void {
    const globalAny = globalThis as any;
    if (typeof globalAny.window === "undefined") return;

    // Access GPUAdapter through globalThis
    const GPUAdapterAny = globalAny.GPUAdapter;
    if (!GPUAdapterAny || !GPUAdapterAny.prototype) return;

    const originalRequestDevice = GPUAdapterAny.prototype.requestDevice;

    const self = this;
    GPUAdapterAny.prototype.requestDevice = async function (
      this: any,
      ...args: any[]
    ) {
      const device = await originalRequestDevice.apply(this, args);

      // Auto-attach profiler if enabled
      const w = globalThis as any;
      if (w.window && w.window.__webgpuAutoProfile) {
        const profiler = new ProfilerSuite(device);
        w.window.__webgpuProfilerInstance = profiler;
        profiler.startAll();
      }

      return device;
    };
  }

  /**
   * Attach profiler to a device
   *
   * @param device - WebGPU device
   * @returns Profiler suite
   */
  attachProfiler(device: GPUDevice): ProfilerSuite {
    this.profiler = new ProfilerSuite(device);
    this.profiler.startAll();
    return this.profiler;
  }

  /**
   * Get current profiler instance
   */
  getProfiler(): ProfilerSuite | undefined {
    return this.profiler;
  }

  /**
   * Enable auto-profiling
   */
  enableAutoProfiling(): void {
    const w = globalThis as any;
    if (w.window) {
      w.window.__webgpuAutoProfile = true;
    }
  }

  /**
   * Disable auto-profiling
   */
  disableAutoProfiling(): void {
    const w = globalThis as any;
    if (w.window) {
      w.window.__webgpuAutoProfile = false;
    }
  }

  /**
   * Get profiling summary for DevTools
   */
  getDevToolsSummary(): {
    isActive: boolean;
    stats: ReturnType<GPUProfiler["getStats"]>;
    metrics: any;
  } | null {
    if (!this.profiler) return null;

    return {
      isActive: this.profiler.gpu.isProfiling(),
      stats: this.profiler.gpu.getStats(),
      metrics: {},
    };
  }

  /**
   * Generate and download report
   *
   * @param format - Export format
   */
  async downloadReport(
    format: "json" | "html" | "csv" = "json"
  ): Promise<void> {
    if (!this.profiler) {
      throw new Error("No active profiler");
    }

    const report = this.profiler.stopAll();
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "json":
        content = this.profiler.reporter.exportAsJSON(report);
        filename = `webgpu-profile-${Date.now()}.json`;
        mimeType = "application/json";
        break;
      case "html":
        content = this.profiler.reporter.exportAsHTML(report);
        filename = `webgpu-profile-${Date.now()}.html`;
        mimeType = "text/html";
        break;
      case "csv":
        content = this.profiler.reporter.exportAsCSV(report);
        filename = `webgpu-profile-${Date.now()}.csv`;
        mimeType = "text/csv";
        break;
    }

    // Download file
    const doc = (globalThis as any).document;
    if (doc) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Check if integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * VL-JEPA profiling integration
 *
 * Extends profiling to support VL-JEPA model inference
 */
export class VLJEPAProfiling {
  /** Profiler suite */
  private profiler?: ProfilerSuite;
  /** VL-JEPA specific metrics */
  private jepaMetrics = new Map<string, number[]>();

  /**
   * Attach to profiler suite
   *
   * @param suite - Profiler suite
   */
  attach(suite: ProfilerSuite): void {
    this.profiler = suite;
  }

  /**
   * Record X-Encoder execution
   *
   * @param duration - Duration in milliseconds
   * @param inputSize - Input size in bytes
   */
  recordXEncoder(duration: number, inputSize: number): void {
    this.profiler?.kernel.beginKernel("x-encoder", [1, 1, 1], [1, 1, 1]);
    this.profiler?.kernel.endKernel("x-encoder");

    this.recordMetric("x-encoder-duration", duration);
    this.recordMetric("x-encoder-throughput", inputSize / duration);
  }

  /**
   * Record Y-Encoder execution
   *
   * @param duration - Duration in milliseconds
   * @param tokenCount - Token count
   */
  recordYEncoder(duration: number, tokenCount: number): void {
    this.profiler?.kernel.beginKernel("y-encoder", [1, 1, 1], [1, 1, 1]);
    this.profiler?.kernel.endKernel("y-encoder");

    this.recordMetric("y-encoder-duration", duration);
    this.recordMetric("y-encoder-tokens-per-ms", tokenCount / duration);
  }

  /**
   * Record Predictor execution
   *
   * @param duration - Duration in milliseconds
   */
  recordPredictor(duration: number): void {
    this.profiler?.kernel.beginKernel("predictor", [1, 1, 1], [1, 1, 1]);
    this.profiler?.kernel.endKernel("predictor");

    this.recordMetric("predictor-duration", duration);
  }

  /**
   * Record complete VL-JEPA inference
   *
   * @param totalDuration - Total duration in milliseconds
   */
  recordInference(totalDuration: number): void {
    this.recordMetric("jepa-total-duration", totalDuration);
    this.recordMetric("jepa-fps", 1000 / totalDuration);
  }

  /**
   * Record a metric
   */
  private recordMetric(name: string, value: number): void {
    if (!this.jepaMetrics.has(name)) {
      this.jepaMetrics.set(name, []);
    }
    this.jepaMetrics.get(name)!.push(value);
  }

  /**
   * Get VL-JEPA specific metrics
   */
  getJEPAMetrics(): Map<string, { avg: number; min: number; max: number }> {
    const result = new Map();

    for (const [name, values] of this.jepaMetrics) {
      if (values.length === 0) continue;

      result.set(name, {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      });
    }

    return result;
  }

  /**
   * Check if inference is real-time capable (>30 FPS)
   */
  isRealTimeCapable(): boolean {
    const durations = this.jepaMetrics.get("jepa-total-duration");
    if (!durations || durations.length === 0) return false;

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    return avgDuration < 33.33; // < 33.33ms = >30 FPS
  }

  /**
   * Get FPS statistics
   */
  getFPSStats(): { avg: number; min: number; max: number } {
    const durations = this.jepaMetrics.get("jepa-total-duration");
    if (!durations || durations.length === 0) {
      return { avg: 0, min: 0, max: 0 };
    }

    const fpsValues = durations.map(d => 1000 / d);

    return {
      avg: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
      min: Math.min(...fpsValues),
      max: Math.max(...fpsValues),
    };
  }
}

/**
 * Create global DevTools integration
 */
export function createDevToolsIntegration(): DevToolsIntegration {
  return new DevToolsIntegration();
}

/**
 * Create VL-JEPA profiling integration
 */
export function createVLJEPAProfiling(): VLJEPAProfiling {
  return new VLJEPAProfiling();
}

/**
 * Auto-initialize DevTools in browser
 */
const globalWindow = globalThis as any;
if (globalWindow.window) {
  const devTools = createDevToolsIntegration();
  devTools.initialize().catch(console.error);

  // Expose global API
  globalWindow.window.__WebGPUProfiler = {
    createDevToolsIntegration,
    createVLJEPAProfiling,
    ProfilerSuite,
    DevToolsIntegration,
    VLJEPAProfiling,
  };
}
