# @lsi/core

**Hardware-Aware Computing Infrastructure for Aequor**

`@lsi/core` provides the foundational hardware monitoring, thermal management, and performance optimization infrastructure for the Aequor Cognitive Orchestration Platform. It enables intelligent dispatch decisions based on real-time system state, NUMA topology, thermal conditions, and power constraints.

## Features

### Hardware Monitoring
- Real-time CPU, GPU, memory, and network state tracking
- Automatic GPU detection and monitoring
- NUMA topology detection for multi-socket systems
- Thermal zone classification (normal/throttle/critical)
- Cross-platform support (Linux, macOS, Windows, WSL)

### Thermal Management
- Adaptive thermal controller with configurable policies
- Predictive thermal management
- Automatic throttling and rejection at critical temperatures
- Time-in-zone tracking and thermal metrics
- Zone change notifications

### Memory Management
- NUMA-aware memory allocation
- Aligned memory allocation for SIMD operations
- CPU-to-node affinity mapping
- Cross-node distance optimization
- Memory locality optimization

### SIMD Operations
- SIMD-optimized vector operations (add, sub, mul, dot, cosine)
- High-performance embedding operations
- Batch comparison and similarity search
- Hardware capability detection
- Fallback to pure JS when SIMD unavailable

### GPU Acceleration
- WebGPU and WebGL backend support
- GPU-accelerated vector and embedding operations
- Device detection and capability profiling
- Buffer management and compute operations
- Automatic fallback to CPU/SIMD

### Power Management
- Battery status monitoring and health tracking
- CPU power state control (C-states, P-states, frequency scaling)
- Power-aware dispatch with battery impact analysis
- Runtime prediction and power strategy optimization
- Thermal-aware power profile selection

### Auto-Tuning
- Automatic performance parameter optimization
- Multi-objective optimization (latency, throughput, quality)
- Workload pattern detection and prediction
- Feedback-driven parameter adjustment
- Tuning history and analytics

## Installation

```bash
npm install @lsi/core
```

### Optional Dependencies

For full hardware monitoring capabilities, install the optional dependency:

```bash
npm install systeminformation
```

Without `systeminformation`, the package will use mock data for testing and development.

## Quick Start

### Hardware Monitoring

```typescript
import { HardwareMonitor } from '@lsi/core';

// Create monitor with custom configuration
const monitor = new HardwareMonitor({
  updateInterval: 1000,
  thermalThresholds: {
    normal: 70,
    throttle: 85,
    critical: 95
  },
  memoryThreshold: 0.9,
  cpuThreshold: 0.95
});

// Start monitoring
await monitor.start();

// Get current state
const state = monitor.getState();
console.log('CPU Usage:', state.cpu.usage);
console.log('Temperature:', state.thermal.cpu);
console.log('Can Process Local:', state.canProcessLocal);

// Listen for state changes
monitor.on('thermalAlert', (temp, zone) => {
  console.log(`Thermal alert: ${temp}C in zone ${zone}`);
});

// Check recommendations
if (monitor.isLocalProcessingRecommended()) {
  console.log('Recommended: Process locally');
} else {
  console.log('Recommended: Route to cloud');
}

// Stop monitoring
monitor.stop();
```

### Thermal Management

```typescript
import { ThermalManager, createThermalManager } from '@lsi/core';

// Create thermal manager with custom policy
const thermalManager = createThermalManager({
  policy: {
    normalThreshold: 70,
    throttleThreshold: 85,
    criticalThreshold: 95,
    throttleAction: (temp) => ({
      type: 'throttle',
      reduction: Math.min(0.5, (temp - 85) / 10),
      reason: `Temperature ${temp.toFixed(1)}C exceeds threshold`
    })
  },
  onZoneChange: (from, to) => {
    console.log(`Thermal zone changed: ${from} -> ${to}`);
  }
});

// Update with current thermal state
const action = thermalManager.updateThermalState({
  cpu: 87,
  critical: false,
  zone: 'throttle',
  timeInZone: 5000
});

// Handle thermal action
if (action.type === 'throttle') {
  console.log(`Throttling by ${action.reduction * 100}%: ${action.reason}`);
}

// Get processing recommendation
const recommendation = thermalManager.getProcessingRecommendation();
if (recommendation.canProceed) {
  console.log(`Can proceed with ${recommendation.confidence * 100}% confidence`);
}
```

### NUMA-Aware Allocation

```typescript
import { NUMATopologyDetector, getNUMAStats, NUMAAllocator } from '@lsi/core';

// Detect NUMA topology
const detector = new NUMATopologyDetector();
const topology = await detector.detect();

console.log(`System type: ${topology.type}`);
console.log(`NUMA nodes: ${topology.numNodes}`);
console.log(`Total CPUs: ${topology.totalCPUs}`);
console.log(`Total Memory: ${(topology.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);

// Get NUMA statistics
const stats = getNUMAStats(topology);
console.log(`Load balance score: ${stats.loadBalanceScore}`);
console.log(`Average local access ratio: ${stats.avgLocalAccessRatio}`);

// NUMA-aware allocation
const allocator = new NUMAAllocator(topology);

// Allocate memory on preferred node
const buffer = allocator.allocateLocal(1024 * 1024, 64); // 1MB, 64-byte aligned
console.log(`Allocated on node: ${buffer.nodeId}`);

// Allocate with CPU affinity
const cpuBoundBuffer = allocator.allocateForCPU(512 * 1024, 7); // Bind to CPU 7
console.log(`CPU 7 preferred node: ${topology.getPreferredNode(7)}`);
```

### SIMD Vector Operations

```typescript
import { VectorOps, SIMDOptimizer } from '@lsi/core';

// Create vector operations with SIMD optimization
const optimizer = new SIMDOptimizer();
await optimizer.detectCapabilities();

const vecOps = new VectorOps(optimizer);

// Basic vector operations
const a = new Float32Array([1, 2, 3, 4]);
const b = new Float32Array([5, 6, 7, 8]);

const sum = vecOps.add(a, b);        // [6, 8, 10, 12]
const dot = vecOps.dot(a, b);        // 70
const cosine = vecOps.cosine(a, b);  // Similarity score
const euclidean = vecOps.euclidean(a, b); // Distance

// Batch operations
const vectors = [
  new Float32Array([1, 2, 3]),
  new Float32Array([4, 5, 6]),
  new Float32Array([7, 8, 9])
];

const query = new Float32Array([2, 3, 4]);

// Find top-K most similar vectors
const results = vecOps.batchCompare(query, vectors, 2, 'cosine');
console.log('Top matches:', results);

// Range search
const neighbors = vecOps.rangeSearch(query, vectors, 3.0);

// Get SIMD capabilities
const capabilities = optimizer.getCapabilities();
console.log('SIMD enabled:', capabilities.enabled);
console.log('Implementation:', capabilities.implementation);
```

### GPU Acceleration

```typescript
import { GPUDeviceManager, GPUVectorOps, GPUEmbeddingOps } from '@lsi/core';

// Initialize GPU device
const gpuManager = new GPUDeviceManager({
  preferredBackend: 'webgpu'
});

const device = await gpuManager.initialize();
if (!device) {
  console.log('GPU not available, falling back to CPU');
}

// GPU vector operations
const gpuOps = new GPUVectorOps(device);

// Benchmark GPU vs CPU
const benchmark = await gpuOps.benchmark({
  vectorSize: 768,
  numVectors: 1000,
  iterations: 100
});

console.log('GPU throughput:', benchmark.gpuTime, 'ms');
console.log('CPU throughput:', benchmark.cpuTime, 'ms');
console.log('Speedup:', benchmark.speedup, 'x');

// GPU embedding operations
const embeddingOps = new GPUEmbeddingOps(device);
const neighbors = await embeddingOps.findNearestNeighbors(
  queryEmbedding,
  databaseEmbeddings,
  { topK: 10, metric: 'cosine' }
);
```

### Power Management

```typescript
import {
  BatteryManager,
  PowerStateController,
  PowerAwareDispatcher
} from '@lsi/core';

// Monitor battery status
const battery = new BatteryManager();
await battery.startMonitoring();

battery.on('change', (status) => {
  console.log(`Battery: ${status.level * 100}%`);
  console.log(`Charging: ${status.charging}`);
  console.log(`Time remaining: ${status.timeRemaining} seconds`);
});

// Predict runtime for workload
const prediction = await battery.predictRuntime({
  cpuIntensity: 0.8,
  gpuIntensity: 0.5,
  duration: 60000 // 1 minute
});

console.log(`Predicted battery drain: ${prediction.batteryDrain * 100}%`);

// Control CPU power states
const powerController = new PowerStateController();
const currentState = await powerController.getCurrentState();

console.log(`CPU Frequency: ${currentState.frequency} MHz`);
console.log(`Governor: ${currentState.governor}`);
console.log(`Power Usage: ${currentState.powerUsage} W`);

// Set performance profile
await powerController.setProfile('performance');

// Power-aware dispatch
const dispatcher = new PowerAwareDispatcher({
  batteryManager: battery,
  powerController: powerController
});

const decision = await dispatcher.dispatch({
  type: 'inference',
  complexity: 'high',
  urgency: 'normal'
});

console.log('Dispatch decision:', decision.destination);
console.log('Battery impact:', decision.batteryImpact);
```

### Auto-Tuning

```typescript
import {
  AutoTuner,
  WorkloadAnalyzer,
  ParameterOptimizer
} from '@lsi/core';

// Analyze workload patterns
const workloadAnalyzer = new WorkloadAnalyzer();
const pattern = workloadAnalyzer.analyzePattern({
  queryCount: 1000,
  avgComplexity: 0.6,
  avgLatency: 150,
  cacheHitRate: 0.75
});

console.log('Workload type:', pattern.type);
console.log('Burst intensity:', pattern.burst.intensity);

// Create auto-tuner
const tuner = new AutoTuner({
  parameters: {
    batchSize: { min: 1, max: 32, current: 8 },
    cacheSize: { min: 100, max: 10000, current: 1000 },
    parallelism: { min: 1, max: 16, current: 4 }
  },
  objectives: {
    latency: { weight: 0.5, target: 100 },
    throughput: { weight: 0.3, target: 1000 },
    quality: { weight: 0.2, target: 0.95 }
  }
});

// Get tuning recommendation
const metrics = {
  latency: 120,
  throughput: 950,
  quality: 0.97
};

const recommendation = await tuner.tune(metrics);
console.log('Recommended parameters:', recommendation.parameters);
console.log('Expected improvement:', recommendation.expectedImprovement);

// Apply recommendation
tuner.applyRecommendation(recommendation);
```

## Core Components

### HardwareMonitor

Real-time hardware state monitoring with event-driven updates.

**Configuration:**
```typescript
interface HardwareMonitorConfig {
  updateInterval?: number;           // Polling interval (ms)
  thermalThresholds?: {
    normal: number;                  // Normal temperature threshold
    throttle: number;                // Throttle temperature threshold
    critical: number;                // Critical temperature threshold
  };
  memoryThreshold?: number;          // Memory usage threshold (0-1)
  cpuThreshold?: number;             // CPU usage threshold (0-1)
  enableGPUMonitoring?: boolean;     // Enable GPU monitoring
  enableNetworkMonitoring?: boolean; // Enable network monitoring
  onStateChange?: (event) => void;   // State change callback
}
```

**Events:**
- `stateChange` - Hardware state changed
- `thermalAlert` - Temperature threshold exceeded
- `memoryAlert` - Memory threshold exceeded
- `cpuAlert` - CPU usage threshold exceeded
- `gpuAlert` - GPU usage threshold exceeded

### ThermalManager

Manages thermal state with configurable policies and actions.

**Thermal Zones:**
- `normal` - Operating within safe temperature range
- `throttle` - Temperature elevated, reduce workload
- `critical` - Temperature critical, reject new work

**Actions:**
- `proceed` - Continue processing (full or reduced mode)
- `throttle` - Reduce workload by specified percentage
- `queue` - Delay processing
- `reject` - Reject processing request

### NUMATopology

Detects and manages NUMA topology for memory locality optimization.

**Topology Detection:**
- Linux: Reads from `/sys/devices/system/node/`
- Fallback: Uses `lscpu` command
- Default: Creates single-node UMA topology

**Features:**
- CPU-to-node mapping
- Inter-node distance matrix
- Memory statistics per node
- Load balance scoring

### VectorOps & SIMD

High-performance vector operations with SIMD optimization.

**Operations:**
- Arithmetic: add, sub, mul, scale, addScalar
- Linear Algebra: dot, cosine, euclidean, norm, normalize
- Distance: manhattan, minkowski, chebyshev, hamming
- Batch: batchCompare, rangeSearch, approxNN
- Utilities: clone, concat, slice, clamp, map, reduce

**SIMD Support:**
- Automatic capability detection
- WebAssembly SIMD (128-bit)
- Fallback to scalar operations
- Performance metrics tracking

### GPU Operations

GPU-accelerated vector and embedding operations.

**Backends:**
- WebGPU (preferred) - Modern compute API
- WebGL (fallback) - Wide compatibility
- CPU/SIMD (fallback) - Software rendering

**Operations:**
- Vector arithmetic and similarity
- Matrix multiplication
- Nearest neighbor search
- Batch comparison
- Performance benchmarking

### Power Management

Battery monitoring and CPU power state control.

**Battery Features:**
- Real-time status monitoring
- Health assessment
- Runtime prediction
- Power strategy selection

**Power State Features:**
- C-state and P-state control
- CPU frequency scaling
- Governor selection
- Power usage monitoring

## Configuration

### Environment Variables

```bash
# Hardware Monitoring
LSI_HARDWARE_UPDATE_INTERVAL=1000
LSI_THERMAL_NORMAL_THRESHOLD=70
LSI_THERMAL_THROTTLE_THRESHOLD=85
LSI_THERMAL_CRITICAL_THRESHOLD=95

# NUMA Allocation
LSI_NUMA_ENABLED=true
LSI_NUMA_PREFERRED_NODE=0

# GPU Operations
LSI_GPU_BACKEND=webgpu
LSI_GPU_FALLBACK_ENABLED=true

# Power Management
LSI_POWER_GOVERNOR=performance
LSI_POWER_PROFILE=balanced

# Auto-Tuning
LSI_AUTOTUNER_ENABLED=true
LSI_AUTOTUNER_INTERVAL=60000
```

### Programmatic Configuration

```typescript
import {
  HardwareMonitor,
  ThermalManager,
  NUMAAllocator
} from '@lsi/core';

// Global configuration
const config = {
  hardware: {
    updateInterval: 1000,
    thermalThresholds: { normal: 70, throttle: 85, critical: 95 }
  },
  thermal: {
    policy: { /* custom policy */ },
    enableAutoActions: true
  },
  numa: {
    enableNUMA: true,
    preferredNode: 0
  }
};
```

## Usage Examples

### Hardware-Aware Dispatch

```typescript
import { HardwareMonitor, HardwareAwareDispatcher } from '@lsi/core';

const monitor = new HardwareMonitor();
await monitor.start();

const dispatcher = new HardwareAwareDispatcher({
  monitor: monitor,
  constraints: {
    maxLatency: 1000,
    minQuality: 0.9,
    maxCost: 0.01
  }
});

// Dispatch based on current hardware state
const decision = await dispatcher.dispatch({
  query: 'What is the capital of France?',
  complexity: 0.3,
  urgency: 'normal'
});

console.log('Decision:', decision.destination); // 'local' | 'cloud' | 'hybrid'
console.log('Confidence:', decision.confidence);
```

### Thermal-Aware Scheduling

```typescript
import { ThermalManager } from '@lsi/core';

const thermalManager = new ThermalManager();

function scheduleWork(workload: Workload) {
  const recommendation = thermalManager.getProcessingRecommendation();

  if (!recommendation.canProceed) {
    // Defer to cloud or queue
    return deferWorkload(workload);
  }

  if (recommendation.action.type === 'throttle') {
    // Reduce workload intensity
    workload.intensity *= (1 - recommendation.action.reduction);
  }

  // Process locally
  return processLocally(workload);
}
```

### NUMA-Optimized Allocation

```typescript
import { NUMATopologyDetector, NUMAAllocator } from '@lsi/core';

const detector = new NUMATopologyDetector();
const topology = await detector.detect();

const allocator = new NUMAAllocator(topology);

// Allocate data close to compute
const cpuId = 7;
const preferredNode = topology.getPreferredNode(cpuId);

const buffer = allocator.allocateOnNode(
  1024 * 1024,  // 1MB
  preferredNode,
  64           // 64-byte aligned for SIMD
);

// Pin thread to CPU
bindThreadToCPU(cpuId);

// Access data with minimal latency
processData(buffer.data);
```

## Performance

### Benchmarks

Vector operations (768-dimensional embeddings, 1000 vectors):

| Operation | CPU (ms) | SIMD (ms) | GPU (ms) | Speedup |
|-----------|----------|-----------|----------|---------|
| Cosine Similarity | 45 | 12 | 2 | 22.5x |
| Dot Product | 38 | 10 | 1.5 | 25.3x |
| Euclidean Distance | 52 | 15 | 3 | 17.3x |
| Batch Compare (top-10) | 180 | 45 | 8 | 22.5x |

### Optimization Tips

1. **Use SIMD operations** - Automatically enabled when available
2. **Prefer GPU for large batches** - >100 vectors benefit from GPU acceleration
3. **NUMA-aware allocation** - Reduces cross-node traffic on multi-socket systems
4. **Thermal-aware dispatch** - Prevents thermal throttling by routing work appropriately
5. **Cache topology detection** - NUMA detection is cached for 60 seconds
6. **Use Float32Array** - Aligned for SIMD, better than regular arrays
7. **Batch operations** - BatchCompare is more efficient than individual comparisons

## API Reference

### Exports

```typescript
// Hardware Monitoring
export { HardwareMonitor } from './hardware/HardwareMonitor';
export type { HardwareMonitorConfig, HardwareMonitorEvent };

// Thermal Management
export { ThermalManager, createThermalManager } from './hardware/ThermalManager';
export type { ThermalAction, ThermalZone, ThermalPolicy, ThermalMetrics };

// Hardware-Aware Dispatch
export { HardwareAwareDispatcher, createHardwareAwareDispatcher } from './hardware/HardwareAwareDispatcher';
export type { DispatchDecision, DispatchConstraints, DispatchStats };

// NUMA Topology
export { NUMATopologyDetector, numaTopologyDetector } from './hardware/NUMATopology';
export { getNUMAStats } from './hardware/NUMATopology';
export type { NUMATopology, NUMANode, NUMAStats };

// NUMA Allocator
export { NUMAAllocator } from './hardware/NUMAAllocator';
export type { NUMABuffer, AllocationOptions };

// SIMD Operations
export { SIMDOptimizer } from './simd/SIMDOptimizer';
export type { SIMDCapabilities, SIMDPerformanceMetrics };

// Vector Operations
export { VectorOps } from './simd/VectorOps';
export type { BatchCompareResult };

// Embedding Operations
export { EmbeddingOps } from './simd/EmbeddingOps';
export type { AttentionConfig, PCAConfig, PCAResult };

// GPU Operations
export { GPUDeviceManager } from './gpu/GPUDevice';
export { GPUVectorOps } from './gpu/GPUVectorOps';
export { GPUEmbeddingOps } from './gpu/GPUEmbeddingOps';
export type { GPUBackend, GPUConfig, GPUInfo };

// Power Management
export { PowerStateController } from './power/PowerStateController';
export { BatteryManager } from './power/BatteryManager';
export { PowerAwareDispatcher } from './power/PowerAwareDispatcher';

// Auto-Tuning
export { AutoTuner, createAutoTuner } from './tuning/AutoTuner';
export { WorkloadAnalyzer, createWorkloadAnalyzer } from './tuning/WorkloadAnalyzer';
export { ParameterOptimizer, createParameterOptimizer } from './tuning/ParameterOptimizer';
```

## License

MIT

## Contributing

Contributions are welcome! Please see the main [Aequor documentation](../../../README.md) for guidelines.

## Support

For issues and questions, please use the [GitHub issue tracker](https://github.com/SuperInstance/SmartCRDT/issues).
