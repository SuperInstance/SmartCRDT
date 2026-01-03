/**
 * Integration tests for WebGPU Profiler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProfilerSuite,
  DevToolsIntegration,
  VLJEPAProfiling,
  createDevToolsIntegration,
  createVLJEPAProfiling,
} from '../src/integration.js';
import type { ProfileReport } from '../src/types.js';

// Mock GPUDevice
const createMockDevice = (): GPUDevice => {
  return {
    queue: {
      submit: vi.fn(),
    },
    lost: false,
    destroy: vi.fn(),
    createBuffer: vi.fn(),
    createTexture: vi.fn(),
    createSampler: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createPipelineLayout: vi.fn(),
    createBindGroup: vi.fn(),
    createShaderModule: vi.fn(),
    createComputePipeline: vi.fn(),
    createRenderPipeline: vi.fn(),
    createRenderBundleEncoder: vi.fn(),
    createQuerySet: vi.fn(),
    importExternalTexture: vi.fn(),
  } as unknown as GPUDevice;
};

describe('ProfilerSuite', () => {
  let suite: ProfilerSuite;
  let mockDevice: GPUDevice;

  beforeEach(() => {
    mockDevice = createMockDevice();
    suite = new ProfilerSuite(mockDevice);
  });

  describe('constructor', () => {
    it('should create suite with all profilers', () => {
      expect(suite.gpu).toBeDefined();
      expect(suite.kernel).toBeDefined();
      expect(suite.memory).toBeDefined();
      expect(suite.transfer).toBeDefined();
      expect(suite.utilization).toBeDefined();
      expect(suite.analyzer).toBeDefined();
      expect(suite.timeline).toBeDefined();
      expect(suite.reporter).toBeDefined();
    });
  });

  describe('startAll and stopAll', () => {
    it('should start all profilers', () => {
      suite.startAll();

      expect(suite.gpu.isProfiling()).toBe(true);
      expect(suite.utilization.isActive()).toBe(true);
    });

    it('should stop all profilers and generate report', () => {
      suite.startAll();

      suite.gpu.beginFrame();
      suite.gpu.recordKernelDispatch('test-kernel', [16, 16, 1]);
      suite.gpu.completeKernel('test-kernel');
      suite.gpu.endFrame();

      const report = suite.stopAll();

      expect(report).toBeDefined();
      expect(suite.gpu.isProfiling()).toBe(false);
      expect(suite.utilization.isActive()).toBe(false);
    });

    it('should generate complete report', () => {
      suite.startAll();

      suite.gpu.beginFrame();
      suite.gpu.recordKernelDispatch('kernel1', [32, 32, 1]);
      suite.gpu.completeKernel('kernel1');
      suite.gpu.recordMemoryAllocation(1024, 'buffer');
      suite.gpu.endFrame();

      const report = suite.stopAll();

      expect(report.id).toBeDefined();
      expect(report.kernelSummary.totalKernels).toBeGreaterThan(0);
      expect(report.memorySummary.allocationCount).toBeGreaterThan(0);
    });
  });

  describe('resetAll', () => {
    it('should reset all profilers', () => {
      suite.startAll();
      suite.gpu.beginFrame();
      suite.resetAll();

      expect(suite.gpu.isProfiling()).toBe(false);
      expect(suite.utilization.isActive()).toBe(false);
    });
  });
});

describe('DevToolsIntegration', () => {
  let integration: DevToolsIntegration;

  beforeEach(() => {
    integration = createDevToolsIntegration();
  });

  describe('initialization', () => {
    it('should create integration', () => {
      expect(integration).toBeDefined();
    });

    it('should initialize in browser environment', async () => {
      // Mock browser environment
      if (typeof navigator !== 'undefined') {
        (navigator as any).gpu = true;
      }

      await integration.initialize();

      expect(integration.isEnabled()).toBeDefined();
    });
  });

  describe('profiler attachment', () => {
    it('should attach profiler to device', () => {
      const mockDevice = createMockDevice();
      const suite = integration.attachProfiler(mockDevice);

      expect(suite).toBeDefined();
      expect(suite.gpu.isProfiling()).toBe(true);
    });

    it('should get current profiler', () => {
      const mockDevice = createMockDevice();

      expect(integration.getProfiler()).toBeUndefined();

      integration.attachProfiler(mockDevice);

      expect(integration.getProfiler()).toBeDefined();
    });
  });

  describe('auto-profiling', () => {
    it('should enable auto-profiling', () => {
      integration.enableAutoProfiling();

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should disable auto-profiling', () => {
      integration.disableAutoProfiling();

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('DevTools summary', () => {
    it('should get summary when profiler active', () => {
      const mockDevice = createMockDevice();
      integration.attachProfiler(mockDevice);

      const summary = integration.getDevToolsSummary();

      expect(summary).toBeDefined();
      expect(summary?.isActive).toBe(true);
    });

    it('should return null when no profiler', () => {
      const summary = integration.getDevToolsSummary();

      expect(summary).toBeNull();
    });
  });

  describe('report download', () => {
    it('should throw when no profiler', async () => {
      await expect(integration.downloadReport('json')).rejects.toThrow('No active profiler');
    });
  });
});

describe('VLJEPAProfiling', () => {
  let profiling: VLJEPAProfiling;
  let suite: ProfilerSuite;

  beforeEach(() => {
    suite = new ProfilerSuite(createMockDevice());
    profiling = createVLJEPAProfiling();
    profiling.attach(suite);
  });

  describe('X-Encoder recording', () => {
    it('should record X-Encoder execution', () => {
      profiling.recordXEncoder(15, 1920 * 1080 * 4);

      const metrics = profiling.getJEPAMetrics();
      expect(metrics.get('x-encoder-duration')).toBeDefined();
    });
  });

  describe('Y-Encoder recording', () => {
    it('should record Y-Encoder execution', () => {
      profiling.recordYEncoder(5, 128);

      const metrics = profiling.getJEPAMetrics();
      expect(metrics.get('y-encoder-duration')).toBeDefined();
    });
  });

  describe('Predictor recording', () => {
    it('should record Predictor execution', () => {
      profiling.recordPredictor(3);

      const metrics = profiling.getJEPAMetrics();
      expect(metrics.get('predictor-duration')).toBeDefined();
    });
  });

  describe('inference recording', () => {
    it('should record complete inference', () => {
      profiling.recordInference(25);

      const metrics = profiling.getJEPAMetrics();
      expect(metrics.get('jepa-total-duration')).toBeDefined();
      expect(metrics.get('jepa-fps')).toBeDefined();
    });

    it('should check real-time capability', () => {
      // Record fast inferences (>30 FPS)
      for (let i = 0; i < 10; i++) {
        profiling.recordInference(20); // 20ms = 50 FPS
      }

      expect(profiling.isRealTimeCapable()).toBe(true);
    });

    it('should detect non-real-time inferences', () => {
      // Record slow inferences (<30 FPS)
      for (let i = 0; i < 10; i++) {
        profiling.recordInference(50); // 50ms = 20 FPS
      }

      expect(profiling.isRealTimeCapable()).toBe(false);
    });
  });

  describe('FPS statistics', () => {
    it('should calculate FPS stats', () => {
      profiling.recordInference(20); // 50 FPS
      profiling.recordInference(25); // 40 FPS
      profiling.recordInference(33.33); // 30 FPS

      const stats = profiling.getFPSStats();

      expect(stats.avg).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThanOrEqual(stats.min);
    });

    it('should return zeros when no inferences', () => {
      const stats = profiling.getFPSStats();

      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });
  });

  describe('VL-JEPA metrics', () => {
    it('should track metrics over time', () => {
      profiling.recordXEncoder(10, 1024);
      profiling.recordXEncoder(12, 1024);
      profiling.recordXEncoder(8, 1024);

      const metrics = profiling.getJEPAMetrics();
      const durationMetric = metrics.get('x-encoder-duration');

      expect(durationMetric).toBeDefined();
      expect(durationMetric?.avg).toBe(10);
      expect(durationMetric?.min).toBe(8);
      expect(durationMetric?.max).toBe(12);
    });

    it('should track throughput metrics', () => {
      profiling.recordXEncoder(10, 10240); // 1024 bytes/ms

      const metrics = profiling.getJEPAMetrics();
      const throughputMetric = metrics.get('x-encoder-throughput');

      expect(throughputMetric).toBeDefined();
      expect(throughputMetric?.avg).toBe(1024);
    });

    it('should track token throughput', () => {
      profiling.recordYEncoder(5, 128); // 25.6 tokens/ms

      const metrics = profiling.getJEPAMetrics();
      const tokensMetric = metrics.get('y-encoder-tokens-per-ms');

      expect(tokensMetric).toBeDefined();
      expect(tokensMetric?.avg).toBeCloseTo(25.6, 1);
    });
  });
});

describe('Integration end-to-end', () => {
  it('should profile complete VL-JEPA pipeline', () => {
    const suite = new ProfilerSuite(createMockDevice());
    const jepa = createVLJEPAProfiling();
    jepa.attach(suite);

    suite.startAll();

    // Simulate VL-JEPA inference
    suite.gpu.beginFrame();

    jepa.recordXEncoder(15, 1920 * 1080 * 4);
    suite.gpu.recordKernelDispatch('x-encoder', [1, 1, 1]);
    suite.gpu.completeKernel('x-encoder');

    jepa.recordYEncoder(5, 128);
    suite.gpu.recordKernelDispatch('y-encoder', [1, 1, 1]);
    suite.gpu.completeKernel('y-encoder');

    jepa.recordPredictor(3);
    suite.gpu.recordKernelDispatch('predictor', [1, 1, 1]);
    suite.gpu.completeKernel('predictor');

    const totalInferenceTime = 23; // 15 + 5 + 3
    jepa.recordInference(totalInferenceTime);

    suite.gpu.endFrame();

    const report = suite.stopAll();

    expect(report.kernelSummary.totalKernels).toBe(3);
    expect(jepa.isRealTimeCapable()).toBe(true); // 23ms = ~43 FPS

    const fps = jepa.getFPSStats();
    expect(fps.avg).toBeGreaterThan(30);
  });

  it('should generate complete report with all components', () => {
    const suite = new ProfilerSuite(createMockDevice());

    suite.startAll();

    suite.gpu.beginFrame();
    suite.gpu.recordKernelDispatch('kernel1', [32, 32, 1]);
    suite.gpu.completeKernel('kernel1');

    suite.gpu.recordMemoryAllocation(1024, 'buffer');

    suite.gpu.startTransfer(2048, 'host-to-device');
    suite.gpu.completeTransfer('transfer-0');

    suite.gpu.endFrame();

    const report = suite.stopAll();

    expect(report.kernelSummary.totalKernels).toBe(1);
    expect(report.memorySummary.allocationCount).toBe(1);
    expect(report.transferSummary.totalTransfers).toBe(1);
    expect(report.frames?.length).toBe(1);
  });

  it('should analyze bottlenecks and generate report', () => {
    const suite = new ProfilerSuite(createMockDevice());

    suite.startAll();

    // Add some bottlenecks
    suite.gpu.beginFrame();
    suite.gpu.recordKernelDispatch('slow-kernel', [1, 1, 1]);
    suite.gpu.completeKernel('slow-kernel');

    suite.gpu.recordMemoryAllocation(10 * 1024 * 1024, 'buffer'); // 10MB

    suite.gpu.endFrame();

    const report = suite.stopAll();

    // Analyze bottlenecks
    const analysis = suite.analyzer.analyzeReport(report);

    expect(analysis.bottlenecks).toBeDefined();
    expect(analysis.optimizations).toBeDefined();
    expect(analysis.bottleneckScore).toBeGreaterThanOrEqual(0);

    // Generate HTML report
    const html = suite.reporter.exportAsHTML(report);
    expect(html).toContain('WebGPU Profiling Report');

    // Create timeline
    const events = suite.timeline.createTimeline(report.frames || []);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('Factory functions', () => {
  it('should create DevTools integration', () => {
    const integration = createDevToolsIntegration();

    expect(integration).toBeInstanceOf(DevToolsIntegration);
  });

  it('should create VL-JEPA profiling', () => {
    const profiling = createVLJEPAProfiling();

    expect(profiling).toBeInstanceOf(VLJEPAProfiling);
  });
});

describe('Global browser API', () => {
  it('should expose global API in browser', () => {
    if (typeof window !== 'undefined') {
      expect((window as any).__WebGPUProfiler).toBeDefined();
    }
  });
});
