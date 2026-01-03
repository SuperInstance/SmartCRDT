/**
 * Tests for GPUProfiler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GPUProfiler } from '../src/profiler/GPUProfiler.js';

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

describe('GPUProfiler', () => {
  let profiler: GPUProfiler;
  let mockDevice: GPUDevice;

  beforeEach(() => {
    mockDevice = createMockDevice();
    profiler = new GPUProfiler(mockDevice);
  });

  describe('constructor', () => {
    it('should create profiler with default config', () => {
      expect(profiler).toBeDefined();
      expect(profiler.device).toBe(mockDevice);
      expect(profiler.info).toBeDefined();
      expect(profiler.info.name).toBeDefined();
    });

    it('should accept custom config', () => {
      const customProfiler = new GPUProfiler(mockDevice, {
        bufferSize: 5000,
        samplingRate: 60,
      });
      expect(customProfiler.config.bufferSize).toBe(5000);
      expect(customProfiler.config.samplingRate).toBe(60);
    });
  });

  describe('startProfiling', () => {
    it('should start profiling session', () => {
      const sessionId = profiler.startProfiling();
      expect(sessionId).toMatch(/^session-\d+$/);
      expect(profiler.isProfiling()).toBe(true);
    });

    it('should throw if already profiling', () => {
      profiler.startProfiling();
      expect(() => profiler.startProfiling()).toThrow('Profiling session already active');
    });
  });

  describe('stopProfiling', () => {
    it('should stop profiling and return report', () => {
      profiler.startProfiling();
      const report = profiler.stopProfiling();

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^session-\d+$/);
      expect(report.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(profiler.isProfiling()).toBe(false);
    });

    it('should throw if not profiling', () => {
      expect(() => profiler.stopProfiling()).toThrow('No active profiling session');
    });
  });

  describe('kernel profiling', () => {
    beforeEach(() => {
      profiler.startProfiling();
    });

    it('should record kernel dispatch', () => {
      profiler.recordKernelDispatch('test-kernel', [16, 16, 1]);
      const stats = profiler.getStats();
      expect(stats.kernels).toBeGreaterThan(0);
    });

    it('should complete kernel and return duration', () => {
      profiler.recordKernelDispatch('test-kernel', [16, 16, 1]);
      const duration = profiler.completeKernel('test-kernel');

      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('memory profiling', () => {
    beforeEach(() => {
      profiler.startProfiling();
    });

    it('should record memory allocation', () => {
      const id = profiler.recordMemoryAllocation(1024, 'buffer', ['STORAGE']);
      expect(id).toMatch(/^alloc-\d+$/);

      const stats = profiler.getStats();
      expect(stats.allocations).toBeGreaterThan(0);
    });

    it('should record memory deallocation', () => {
      const id = profiler.recordMemoryAllocation(1024, 'buffer');
      profiler.recordMemoryDeallocation(id);

      const stats = profiler.getStats();
      expect(stats.allocations).toBeGreaterThan(0);
    });
  });

  describe('transfer profiling', () => {
    beforeEach(() => {
      profiler.startProfiling();
    });

    it('should start and complete transfer', () => {
      const id = profiler.startTransfer(1024 * 1024, 'host-to-device');
      expect(id).toMatch(/^transfer-\d+$/);

      const bandwidth = profiler.completeTransfer(id);
      expect(bandwidth).toBeGreaterThan(0);
    });
  });

  describe('frame profiling', () => {
    beforeEach(() => {
      profiler.startProfiling();
    });

    it('should begin and end frame', () => {
      profiler.beginFrame();
      profiler.endFrame();

      const stats = profiler.getStats();
      expect(stats.frames).toBe(1);
    });

    it('should auto-end previous frame when starting new one', () => {
      profiler.beginFrame();
      profiler.beginFrame();
      profiler.endFrame();

      const stats = profiler.getStats();
      expect(stats.frames).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when not profiling', () => {
      const stats = profiler.getStats();
      expect(stats.frames).toBe(0);
      expect(stats.kernels).toBe(0);
      expect(stats.allocations).toBe(0);
      expect(stats.transfers).toBe(0);
      expect(stats.duration).toBe(0);
    });

    it('should return current stats when profiling', () => {
      profiler.startProfiling();
      profiler.beginFrame();
      profiler.recordKernelDispatch('test', [1, 1, 1]);
      profiler.recordMemoryAllocation(512, 'buffer');

      const stats = profiler.getStats();
      expect(stats.frames).toBe(0); // Not ended yet
      expect(stats.allocations).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear profiler state', () => {
      profiler.startProfiling();
      profiler.beginFrame();
      profiler.reset();

      expect(profiler.isProfiling()).toBe(false);
    });
  });

  describe('report generation', () => {
    it('should generate complete report', () => {
      profiler.startProfiling();

      profiler.beginFrame();
      profiler.recordKernelDispatch('kernel1', [8, 8, 1]);
      profiler.completeKernel('kernel1');
      profiler.recordMemoryAllocation(1024, 'buffer');
      profiler.endFrame();

      const report = profiler.stopProfiling();

      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.sessionDuration).toBeGreaterThan(0);
      expect(report.kernelSummary).toBeDefined();
      expect(report.memorySummary).toBeDefined();
      expect(report.transferSummary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.frames).toBeDefined();
      expect(report.frames?.length).toBe(1);
    });
  });
});

describe('GPUProfiler with custom handlers', () => {
  it('should call kernel completion handler', () => {
    const mockDevice = createMockDevice();
    const onKernelComplete = vi.fn();

    const profiler = new GPUProfiler(mockDevice, {
      onKernelComplete,
    });

    profiler.startProfiling();
    profiler.recordKernelDispatch('test', [1, 1, 1]);
    profiler.completeKernel('test');

    expect(onKernelComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test',
      })
    );
  });

  it('should call memory allocation handler', () => {
    const mockDevice = createMockDevice();
    const onMemoryAllocate = vi.fn();

    const profiler = new GPUProfiler(mockDevice, {
      onMemoryAllocate,
    });

    profiler.startProfiling();
    profiler.recordMemoryAllocation(512, 'buffer');

    expect(onMemoryAllocate).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 512,
      })
    );
  });

  it('should call transfer completion handler', () => {
    const mockDevice = createMockDevice();
    const onTransferComplete = vi.fn();

    const profiler = new GPUProfiler(mockDevice, {
      onTransferComplete,
    });

    profiler.startProfiling();
    const id = profiler.startTransfer(1024, 'host-to-device');
    profiler.completeTransfer(id);

    expect(onTransferComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 1024,
      })
    );
  });
});
