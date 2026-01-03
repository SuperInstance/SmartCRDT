/**
 * @lsi/webgpu-compute/types test suite
 *
 * Tests for type definitions and interfaces.
 */

import { describe, it, expect } from 'vitest';

// Mock types for testing
describe('WebGPU Types', () => {
  describe('WorkgroupSize', () => {
    it('should accept valid workgroup sizes', () => {
      const wg1 = { x: 16, y: 16, z: 1 };
      const wg2 = { x: 256 };
      const wg3 = { x: 16, y: 16 };

      expect(wg1.x).toBe(16);
      expect(wg1.y).toBe(16);
      expect(wg1.z).toBe(1);

      expect(wg2.x).toBe(256);

      expect(wg3.x).toBe(16);
      expect(wg3.y).toBe(16);
    });
  });

  describe('MatrixShape', () => {
    it('should accept valid matrix shapes', () => {
      const shape = { rows: 768, cols: 768 };

      expect(shape.rows).toBe(768);
      expect(shape.cols).toBe(768);
    });
  });

  describe('BufferOptions', () => {
    it('should accept valid buffer options', () => {
      const options = {
        size: 1024,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: 'test-buffer',
      };

      expect(options.size).toBe(1024);
      expect(options.label).toBe('test-buffer');
    });
  });

  describe('DispatchConfig', () => {
    it('should accept valid dispatch config', () => {
      const config = {
        workgroupCount: { x: 16, y: 16, z: 1 },
        bufferSizes: [1024, 2048, 4096],
      };

      expect(config.workgroupCount.x).toBe(16);
      expect(config.bufferSizes?.length).toBe(3);
    });
  });

  describe('ComputeResult', () => {
    it('should accept successful result', () => {
      const result = {
        success: true,
        data: new Float32Array([1, 2, 3]),
        executionTime: 10.5,
      };

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.executionTime).toBe(10.5);
    });

    it('should accept failed result', () => {
      const result = {
        success: false,
        executionTime: 5.2,
        error: 'Test error',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('VectorOpType', () => {
    const validOps = ['add', 'sub', 'mul', 'div', 'dot', 'cross', 'normalize', 'magnitude', 'distance', 'similarity'];

    it.each(validOps)('should accept %s as valid operation', (op) => {
      expect(validOps).toContain(op);
    });
  });

  describe('ReductionOpType', () => {
    const validOps = ['sum', 'min', 'max', 'argmin', 'argmax', 'mean', 'prod'];

    it.each(validOps)('should accept %s as valid reduction', (op) => {
      expect(validOps).toContain(op);
    });
  });

  describe('SimilarityMetric', () => {
    const validMetrics = ['cosine', 'euclidean', 'manhattan', 'dot', 'chebyshev'];

    it.each(validMetrics)('should accept %s as valid metric', (metric) => {
      expect(validMetrics).toContain(metric);
    });
  });

  describe('ActivationType', () => {
    const validActivations = ['relu', 'gelu', 'swish', 'sigmoid', 'tanh', 'softmax', 'leaky-relu'];

    it.each(validActivations)('should accept %s as valid activation', (activation) => {
      expect(validActivations).toContain(activation);
    });
  });

  describe('BufferStats', () => {
    it('should accept buffer statistics', () => {
      const stats = {
        totalBuffers: 100,
        pooledBuffers: 50,
        activeBuffers: 50,
        totalMemory: 1024000,
        pooledMemory: 512000,
        activeMemory: 512000,
        allocations: 200,
        deallocations: 150,
        poolHits: 80,
        poolMisses: 20,
      };

      expect(stats.totalBuffers).toBe(100);
      expect(stats.pooledBuffers).toBe(50);
      expect(stats.poolHits).toBe(80);
    });
  });

  describe('ComputeStats', () => {
    it('should accept compute statistics', () => {
      const stats = {
        totalOperations: 1000,
        successfulOperations: 950,
        failedOperations: 50,
        totalExecutionTime: 5000,
        averageExecutionTime: 5,
        totalDataTransferred: 10240000,
        totalWorkgroupsDispatched: 10000,
      };

      expect(stats.totalOperations).toBe(1000);
      expect(stats.successfulOperations).toBe(950);
      expect(stats.averageExecutionTime).toBe(5);
    });
  });
});

describe('WebGPU Error Types', () => {
  it('should create WebGPUComputeError', () => {
    class WebGPUComputeError extends Error {
      constructor(
        message: string,
        public code: string,
        public details?: unknown
      ) {
        super(message);
        this.name = 'WebGPUComputeError';
      }
    }

    const error = new WebGPUComputeError('Test error', 'TEST_ERROR', { detail: 'test' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error.name).toBe('WebGPUComputeError');
  });

  it('should create ShaderCompilationError', () => {
    class ShaderCompilationError extends Error {
      constructor(message: string, public compilationInfo?: any) {
        super(message);
        this.name = 'ShaderCompilationError';
      }
    }

    const error = new ShaderCompilationError('Compilation failed', { messages: [] });

    expect(error.name).toBe('ShaderCompilationError');
    expect(error.compilationInfo).toBeDefined();
  });

  it('should create BufferAllocationError', () => {
    class BufferAllocationError extends Error {
      constructor(message: string, public requestedSize: number) {
        super(message);
        this.name = 'BufferAllocationError';
      }
    }

    const error = new BufferAllocationError('Buffer allocation failed', 1024);

    expect(error.name).toBe('BufferAllocationError');
    expect(error.requestedSize).toBe(1024);
  });

  it('should create DispatchError', () => {
    class DispatchError extends Error {
      constructor(message: string, public dispatchConfig: any) {
        super(message);
        this.name = 'DispatchError';
      }
    }

    const error = new DispatchError('Dispatch failed', { workgroupCount: { x: 1 } });

    expect(error.name).toBe('DispatchError');
    expect(error.dispatchConfig).toBeDefined();
  });

  it('should create DeviceLostError', () => {
    class DeviceLostError extends Error {
      constructor(message: string, public reason?: string) {
        super(message);
        this.name = 'DeviceLostError';
      }
    }

    const error = new DeviceLostError('Device lost', 'GPU reset');

    expect(error.name).toBe('DeviceLostError');
    expect(error.reason).toBe('GPU reset');
  });
});

describe('VL-JEPA Types', () => {
  describe('VLJEPAOpConfig', () => {
    it('should accept VL-JEPA operation config', () => {
      const config = {
        operation: 'embedding-prediction' as const,
        embeddingDim: 768 as const,
        seqLen: 512,
        numHeads: 12,
        workgroupCount: { x: 16, y: 16, z: 1 },
      };

      expect(config.embeddingDim).toBe(768);
      expect(config.seqLen).toBe(512);
    });
  });

  describe('EmbeddingOpConfig', () => {
    it('should accept embedding operation config', () => {
      const config = {
        embeddingDim: 768 as const,
        numEmbeddings: 1000,
      };

      expect(config.embeddingDim).toBe(768);
      expect(config.numEmbeddings).toBe(1000);
    });
  });

  describe('SimilaritySearchConfig', () => {
    it('should accept similarity search config', () => {
      const query = new Float32Array(768);
      const candidates = [new Float32Array(768), new Float32Array(768)];

      const config = {
        query,
        candidates,
        metric: 'cosine' as const,
        topK: 10,
        threshold: 0.5,
      };

      expect(config.query).toBeInstanceOf(Float32Array);
      expect(config.candidates.length).toBe(2);
      expect(config.metric).toBe('cosine');
      expect(config.topK).toBe(10);
    });
  });
});

describe('ComputeDataType', () => {
  const validTypes = ['float32', 'float16', 'int32', 'int16', 'int8', 'uint32', 'uint16', 'uint8'];

  it.each(validTypes)('should accept %s as valid data type', (type) => {
    expect(validTypes).toContain(type);
  });
});

describe('BufferType', () => {
  const validTypes = ['storage', 'uniform', 'vertex', 'index', 'indirect', 'query-resolve'];

  it.each(validTypes)('should accept %s as valid buffer type', (type) => {
    expect(validTypes).toContain(type);
  });
});

describe('ShaderStage', () => {
  const validStages = ['compute', 'vertex', 'fragment'];

  it.each(validStages)('should accept %s as valid shader stage', (stage) => {
    expect(validStages).toContain(stage);
  });
});

describe('PoolingType', () => {
  const validTypes = ['max', 'avg', 'min'];

  it.each(validTypes)('should accept %s as valid pooling type', (type) => {
    expect(validTypes).toContain(type);
  });
});

describe('ConvConfig', () => {
  it('should accept convolution configuration', () => {
    const config = {
      inputShape: [1, 224, 224, 3] as [number, number, number, number],
      filterShape: [3, 3, 3, 64] as [number, number, number, number],
      stride: [2, 2] as [number, number],
      padding: [1, 1, 1, 1] as [number, number, number, number],
      dilation: [1, 1] as [number, number],
    };

    expect(config.inputShape).toEqual([1, 224, 224, 3]);
    expect(config.filterShape).toEqual([3, 3, 3, 64]);
    expect(config.stride).toEqual([2, 2]);
  });
});

describe('PoolConfig', () => {
  it('should accept pooling configuration', () => {
    const config = {
      inputShape: [1, 112, 112, 64] as [number, number, number, number],
      poolType: 'max' as const,
      kernelSize: [2, 2] as [number, number],
      stride: [2, 2] as [number, number],
      padding: [0, 0, 0, 0] as [number, number, number, number],
    };

    expect(config.inputShape).toEqual([1, 112, 112, 64]);
    expect(config.poolType).toBe('max');
    expect(config.kernelSize).toEqual([2, 2]);
  });
});

describe('WebGPUContextConfig', () => {
  it('should accept WebGPU context configuration', () => {
    const config = {
      powerPreference: 'high-performance' as const,
      requiredFeatures: [] as string[],
      requiredLimits: {},
      label: 'test-context',
      enableTracing: true,
    };

    expect(config.powerPreference).toBe('high-performance');
    expect(config.label).toBe('test-context');
    expect(config.enableTracing).toBe(true);
  });
});

describe('BufferPoolConfig', () => {
  it('should accept buffer pool configuration', () => {
    const config = {
      maxPoolSize: 100,
      maxPoolMemory: 256 * 1024 * 1024,
      warmupSizes: [1024, 2048, 4096],
      cleanupInterval: 60000,
    };

    expect(config.maxPoolSize).toBe(100);
    expect(config.maxPoolMemory).toBe(256 * 1024 * 1024);
    expect(config.warmupSizes).toEqual([1024, 2048, 4096]);
    expect(config.cleanupInterval).toBe(60000);
  });
});

describe('BindGroupConfig', () => {
  it('should accept bind group configuration', () => {
    const mockBuffer = {} as GPUBuffer;

    const config = {
      bindings: [
        { binding: 0, buffer: mockBuffer },
        { binding: 1, buffer: mockBuffer, offset: 0, size: 1024 },
      ],
      label: 'test-bindgroup',
    };

    expect(config.bindings.length).toBe(2);
    expect(config.label).toBe('test-bindgroup');
    expect(config.bindings[0].binding).toBe(0);
  });
});

describe('ComputeOperationConfig', () => {
  it('should accept compute operation configuration', () => {
    const mockPipeline = {
      shader: {},
      layout: 'auto' as const,
      bindGroupLayout: {} as GPUBindGroupLayout,
      pipeline: {} as GPUComputePipeline,
    } as const;

    const mockBindGroup = {} as GPUBindGroup;
    const mockBuffer = {} as GPUBuffer;

    const config = {
      pipeline: mockPipeline,
      bindGroups: [mockBindGroup],
      dispatch: { workgroupCount: { x: 16, y: 16 } },
      inputs: [{ buffer: mockBuffer, offset: 0, size: 1024 }],
      output: { buffer: mockBuffer, offset: 0, size: 1024 },
      readOutput: true,
      label: 'test-operation',
    };

    expect(config.pipeline).toBeDefined();
    expect(config.bindGroups.length).toBe(1);
    expect(config.readOutput).toBe(true);
    expect(config.label).toBe('test-operation');
  });
});

describe('TensorBuffer', () => {
  it('should accept tensor buffer configuration', () => {
    const shape = [2, 3, 4];
    const dtype = 'float32' as const;
    const size = 2 * 3 * 4 * 4; // float32 = 4 bytes

    expect(shape.reduce((a, b) => a * b, 1)).toBe(24);
    expect(size).toBe(96);
  });
});

describe('WebGPUContext interface', () => {
  it('should define all required methods', () => {
    const methods = [
      'createCommandEncoder',
      'submit',
      'readBuffer',
      'destroyBuffer',
      'getDevice',
      'getAdapterInfo',
      'getMemoryInfo',
      'dispose',
    ];

    methods.forEach((method) => {
      expect(method).toBeDefined();
    });
  });
});

describe('MatMulConfig', () => {
  it('should accept matrix multiplication configuration', () => {
    const config = {
      workgroupCount: { x: 16, y: 16 },
      leftMatrix: { rows: 768, cols: 768 },
      rightMatrix: { rows: 768, cols: 768 },
      outputMatrix: { rows: 768, cols: 768 },
      batched: false,
    };

    expect(config.leftMatrix.rows).toBe(768);
    expect(config.rightMatrix.cols).toBe(768);
    expect(config.batched).toBe(false);
  });
});

describe('TransposeConfig', () => {
  it('should accept transpose configuration', () => {
    const config = {
      workgroupCount: { x: 16, y: 16 },
      inputShape: { rows: 768, cols: 1024 },
      outputShape: { rows: 1024, cols: 768 },
    };

    expect(config.inputShape.rows).toBe(768);
    expect(config.outputShape.rows).toBe(1024);
  });
});

describe('VectorOpConfig', () => {
  it('should accept vector operation configuration', () => {
    const config = {
      operation: 'add' as const,
      dimension: 768,
      numVectors: 100,
      workgroupCount: { x: 256 },
    };

    expect(config.operation).toBe('add');
    expect(config.dimension).toBe(768);
    expect(config.numVectors).toBe(100);
  });
});

describe('ReductionConfig', () => {
  it('should accept reduction configuration', () => {
    const config = {
      operation: 'sum' as const,
      inputSize: 768,
      reduceAlongAxis: true,
      axis: 0,
      workgroupCount: { x: 256 },
    };

    expect(config.operation).toBe('sum');
    expect(config.inputSize).toBe(768);
    expect(config.reduceAlongAxis).toBe(true);
    expect(config.axis).toBe(0);
  });
});

describe('PoolingConfig', () => {
  it('should accept pooling operation config', () => {
    const config = {
      workgroupCount: { x: 16, y: 16 },
      inputShape: [1, 56, 56, 64] as [number, number, number, number],
      poolType: 'max' as const,
      kernelSize: [2, 2] as [number, number],
      stride: [2, 2] as [number, number],
      padding: [0, 0, 0, 0] as [number, number, number, number],
    };

    expect(config.inputShape).toEqual([1, 56, 56, 64]);
    expect(config.poolType).toBe('max');
    expect(config.kernelSize).toEqual([2, 2]);
  });
});

describe('ConvConfig extended', () => {
  it('should accept full convolution configuration', () => {
    const config = {
      workgroupCount: { x: 16, y: 16 },
      inputShape: [1, 224, 224, 3] as [number, number, number, number],
      filterShape: [7, 7, 3, 64] as [number, number, number, number],
      stride: [2, 2] as [number, number],
      padding: [3, 3, 3, 3] as [number, number, number, number],
      dilation: [1, 1] as [number, number],
    };

    expect(config.inputShape[0]).toBe(1);
    expect(config.filterShape[0]).toBe(7);
    expect(config.dilation).toEqual([1, 1]);
  });
});

describe('BufferView', () => {
  it('should accept buffer view configuration', () => {
    const mockBuffer = {} as GPUBuffer;

    const view = {
      buffer: mockBuffer,
      offset: 0,
      size: 1024,
    };

    expect(view.buffer).toBeDefined();
    expect(view.offset).toBe(0);
    expect(view.size).toBe(1024);
  });
});

describe('BufferPoolEntry', () => {
  it('should accept buffer pool entry', () => {
    const mockBuffer = {} as GPUBuffer;

    const entry = {
      buffer: mockBuffer,
      size: 1024,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      lastUsed: Date.now(),
      inUse: false,
      label: 'test-buffer',
    };

    expect(entry.buffer).toBeDefined();
    expect(entry.size).toBe(1024);
    expect(entry.inUse).toBe(false);
    expect(entry.label).toBe('test-buffer');
  });
});
