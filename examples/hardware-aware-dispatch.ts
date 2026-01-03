/**
 * Hardware-Aware Dispatch Example
 *
 * This example demonstrates hardware-aware AI inference that:
 * 1. Detects available hardware (GPU/CPU/NPU)
 * 2. Monitors thermal state and power consumption
 * 3. Routes workloads based on hardware capabilities
 * 4. Optimizes for energy efficiency and performance
 *
 * @package @lsi/performance-optimizer
 * @example
 */

import {
  HardwareDetector,
  CapabilityProfiler,
  HardwareRouter,
  ThermalManager,
  NUMAScheduler,
  type HardwareProfile,
  type ThermalState,
  type HardwareRoutingDecision,
  type NUMANode,
} from '@lsi/performance-optimizer';

/**
 * Example 1: Hardware Detection
 *
 * Detect and profile available hardware.
 */
async function hardwareDetectionExample() {
  console.log('=== Example 1: Hardware Detection ===\n');

  const detector = new HardwareDetector();

  try {
    const detectionResult = await detector.detect();

    console.log('Hardware Profile:');
    console.log(`  Platform: ${detectionResult.platform}`);
    console.log(`  Architecture: ${detectionResult.architecture}`);

    if (detectionResult.gpu) {
      console.log('\nGPU Detected:');
      console.log(`  Type: ${detectionResult.gpu.type}`);
      console.log(`  Vendor: ${detectionResult.gpu.vendor}`);
      console.log(`  Memory: ${detectionResult.gpu.memory}GB`);
      console.log(`  Compute Capability: ${detectionResult.gpu.computeCapability}`);
    } else {
      console.log('\nGPU: Not detected');
    }

    if (detectionResult.npu) {
      console.log('\nNPU Detected:');
      console.log(`  Type: ${detectionResult.npu.type}`);
      console.log(`  Vendor: ${detectionResult.npu.vendor}`);
      console.log(`  TOPS: ${detectionResult.npu.tops}`);
    } else {
      console.log('\nNPU: Not detected');
    }

    console.log('\nCPU:');
    console.log(`  Cores: ${detectionResult.cpu.cores}`);
    console.log(`  Frequency: ${detectionResult.cpu.frequency}GHz`);
    console.log(`  AVX Support: ${detectionResult.cpu.avxSupport}`);

    console.log('\nMemory:');
    console.log(`  Total: ${detectionResult.memory.total}GB`);
    console.log(`  Available: ${detectionResult.memory.available}GB`);
  } catch (error) {
    console.error('Hardware detection failed:', error);
  }
}

/**
 * Example 2: Capability Profiling
 *
 * Profile hardware capabilities for ML operations.
 */
async function capabilityProfilingExample() {
  console.log('\n=== Example 2: Capability Profiling ===\n');

  const profiler = new CapabilityProfiler();

  const capabilities = await profiler.profileCapabilities();

  console.log('ML Capabilities:\n');

  console.log('Matrix Operations:');
  console.log(`  GPU: ${capabilities.matrixOps.gpu ? '✓ Available' : '✗ Not available'}`);
  console.log(`  CPU (AVX): ${capabilities.matrixOps.cpuAVX ? '✓ Available' : '✗ Not available'}`);
  console.log(`  CPU (Baseline): ${capabilities.matrixOps.cpuBaseline ? '✓ Available' : '✗ Not available'}`);

  console.log('\nNeural Network Ops:');
  console.log(`  Convolutions: ${capabilities.neuralOps.convolutions ? '✓' : '✗'}`);
  console.log(`  Attention: ${capabilities.neuralOps.attention ? '✓' : '✗'}`);
  console.log(`  Recurrent: ${capabilities.neuralOps.recurrent ? '✓' : '✗'}`);

  console.log('\nPerformance Scores:');
  console.log(`  Inference Score: ${capabilities.performanceScores.inference.toFixed(2)}`);
  console.log(`  Training Score: ${capabilities.performanceScores.training.toFixed(2)}`);
  console.log(`  Memory Score: ${capabilities.performanceScores.memory.toFixed(2)}`);

  if (capabilities.benchmarks) {
    console.log('\nBenchmark Results:');
    for (const [name, result] of Object.entries(capabilities.benchmarks)) {
      console.log(`  ${name}:`);
      console.log(`    Latency: ${result.latency}ms`);
      console.log(`    Throughput: ${result.throughput} ops/sec`);
      console.log(`    Memory: ${result.memory}MB`);
    }
  }
}

/**
 * Example 3: Hardware-Aware Routing
 *
 * Route inference requests to optimal hardware.
 */
async function hardwareRoutingExample() {
  console.log('\n=== Example 3: Hardware-Aware Routing ===\n');

  const router = new HardwareRouter({
    enableGPUIfAvailable: true,
    thermalThrottlingEnabled: true,
    powerOptimization: 'balanced',
  });

  const workloads = [
    { name: 'Text Embedding', type: 'embedding', size: 'small', priority: 'normal' },
    { name: 'Image Classification', type: 'inference', size: 'large', priority: 'high' },
    { name: 'Text Generation', type: 'generation', size: 'medium', priority: 'normal' },
    { name: 'Batch Processing', type: 'batch', size: 'large', priority: 'low' },
  ];

  for (const workload of workloads) {
    const decision: HardwareRoutingDecision = await router.route(workload);

    console.log(`Workload: ${workload.name}`);
    console.log(`  Type: ${workload.type}`);
    console.log(`  Route: ${decision.target}`);
    console.log(`  Reason: ${decision.reason}`);
    console.log(`  Estimated Latency: ${decision.estimatedLatency}ms`);
    console.log(`  Estimated Power: ${decision.estimatedPower}W`);
    console.log();
  }
}

/**
 * Example 4: Thermal Management
 *
 * Monitor and manage thermal state.
 */
async function thermalManagementExample() {
  console.log('\n=== Example 4: Thermal Management ===\n');

  const thermalManager = new ThermalManager({
    thermalThreshold: 80, // °C
    criticalThreshold: 90, // °C
    monitoringInterval: 1000, // ms
  });

  // Get current thermal state
  const thermalState: ThermalState = await thermalManager.getThermalState();

  console.log('Thermal State:');
  console.log(`  CPU Temperature: ${thermalState.cpu.temperature}°C`);
  console.log(`  GPU Temperature: ${thermalState.gpu?.temperature || 'N/A'}°C`);
  console.log(`  Status: ${thermalState.status}`);

  if (thermalState.throttling) {
    console.log(`  Throttling: ${thermalState.throttling.active ? 'ACTIVE' : 'Inactive'}`);
    if (thermalState.throttling.active) {
      console.log(`    Type: ${thermalState.throttling.type}`);
      console.log(`    Duration: ${thermalState.throttling.duration}ms`);
    }
  }

  console.log('\nThermal Trend:');
  console.log(`  Trend: ${thermalState.trend.direction}`);
  console.log(`  Rate: ${thermalState.trend.rate}°C/min`);

  // Get prediction
  const prediction = await thermalManager.predictThermalState(60000); // 1 minute ahead
  console.log(`\nPredicted Temperature (1min): ${prediction.predictedTemperature.toFixed(1)}°C`);
  console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);

  if (prediction.recommendedAction) {
    console.log(`  Recommended Action: ${prediction.recommendedAction}`);
  }
}

/**
 * Example 5: NUMA-Aware Scheduling
 *
 * Optimize memory allocation for NUMA architectures.
 */
async function numaSchedulingExample() {
  console.log('\n=== Example 5: NUMA-Aware Scheduling ===\n');

  const numaScheduler = new NUMAScheduler({
    policy: 'local',
    enableMemoryMigration: true,
    enableLoadBalancing: true,
  });

  try {
    const numaTopology = await numaScheduler.detectTopology();

    if (numaTopology.available) {
      console.log('NUMA Topology Detected:');
      console.log(`  Nodes: ${numaTopology.nodes.length}`);

      numaTopology.nodes.forEach((node: NUMANode, index: number) => {
        console.log(`\n  Node ${index}:`);
        console.log(`    CPUs: [${node.cpus.join(', ')}]`);
        console.log(`    Memory: ${node.memory}GB`);
        console.log(`    Distance: [${node.distances.join(', ')}]`);
      });
    } else {
      console.log('NUMA: Not available (UMA system)');
    }

    // Allocate workload on optimal node
    const allocation = await numaScheduler.allocateWorkload({
      cpuRequired: 2,
      memoryRequired: 1024, // MB
      preferLocal: true,
    });

    console.log('\nWorkload Allocation:');
    console.log(`  Target Node: ${allocation.targetNode}`);
    console.log(`  CPUs: [${allocation.cpus.join(', ')}]`);
    console.log(`  Memory: ${allocation.memory}MB`);
    console.log(`  Reason: ${allocation.reason}`);
  } catch (error) {
    console.error('NUMA scheduling failed:', error);
  }
}

/**
 * Example 6: Power-Aware Dispatch
 *
 * Route workloads based on power constraints.
 */
async function powerAwareDispatchExample() {
  console.log('\n=== Example 6: Power-Aware Dispatch ===\n');

  const router = new HardwareRouter({
    enableGPUIfAvailable: true,
    powerOptimization: 'power-saver', // Minimize power consumption
    powerBudget: 15, // Watts
  });

  const workloads = [
    { name: 'Simple Query', complexity: 0.3 },
    { name: 'Complex Inference', complexity: 0.8 },
    { name: 'Batch Processing', complexity: 0.6 },
  ];

  for (const workload of workloads) {
    const decision = await router.route(workload);

    console.log(`Workload: ${workload.name} (complexity: ${workload.complexity})`);
    console.log(`  Target: ${decision.target}`);
    console.log(`  Power Estimate: ${decision.estimatedPower}W`);
    console.log(`  Reason: ${decision.reason}`);

    if (decision.estimatedPower > 15) {
      console.log('  ⚠️  Exceeds power budget, throttling recommended');
    }
    console.log();
  }
}

/**
 * Example 7: Adaptive Performance Tuning
 *
 * Adjust routing based on performance feedback.
 */
async function adaptiveTuningExample() {
  console.log('\n=== Example 7: Adaptive Performance Tuning ===\n');

  const router = new HardwareRouter({
    enableAdaptiveLearning: true,
    learningRate: 0.1,
    performanceWindow: 100,
  });

  // Simulate multiple routing decisions with feedback
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    const workload = { name: `Inference ${i}`, type: 'inference', size: 'medium' };
    const decision = await router.route(workload);

    // Simulate execution
    const latency = Math.random() * 100 + 50; // 50-150ms
    const success = Math.random() > 0.1; // 90% success rate

    // Provide feedback
    router.recordPerformance({
      target: decision.target,
      workload,
      latency,
      success,
      power: 10,
    });

    if (i % 3 === 0) {
      console.log(`Iteration ${i + 1}:`);
      console.log(`  Route: ${decision.target}`);
      console.log(`  Latency: ${latency.toFixed(1)}ms`);
      console.log(`  Success: ${success ? '✓' : '✗'}`);
    }
  }

  // Get learned preferences
  const preferences = router.getLearnedPreferences();
  console.log('\nLearned Preferences:');
  console.log(`  Preferred Target: ${preferences.preferredTarget}`);
  console.log(`  Confidence: ${(preferences.confidence * 100).toFixed(1)}%`);
  console.log(`  Sample Count: ${preferences.sampleCount}`);
}

/**
 * Example 8: Energy Efficiency Monitoring
 *
 * Track and optimize energy consumption.
 */
async function energyEfficiencyExample() {
  console.log('\n=== Example 8: Energy Efficiency Monitoring ===\n');

  const thermalManager = new ThermalManager();
  const router = new HardwareRouter({
    powerOptimization: 'efficiency',
  });

  // Get current power state
  const powerState = await thermalManager.getPowerState();

  console.log('Power State:');
  console.log(`  Current Power: ${powerState.currentPower}W`);
  console.log(`  Average Power: ${powerState.averagePower}W`);
  console.log(`  Peak Power: ${powerState.peakPower}W`);
  console.log(`  Energy Efficiency: ${powerState.efficiency} ops/W`);

  // Get efficiency recommendations
  const recommendations = await router.getEfficiencyRecommendations();

  console.log('\nEfficiency Recommendations:');
  recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec.action}`);
    console.log(`     Savings: ${rec.estimatedSavings}W`);
    console.log(`     Impact: ${rec.impact}`);
  });
}

/**
 * Example 9: Production Hardware Configuration
 *
 * Recommended production setup for hardware-aware dispatch.
 */
async function productionConfigExample() {
  console.log('\n=== Example 9: Production Configuration ===\n');

  const detector = new HardwareDetector();
  const router = new HardwareRouter({
    // Hardware preferences
    enableGPUIfAvailable: true,
    preferNPUForInference: true,

    // Thermal management
    thermalThrottlingEnabled: true,
    thermalThreshold: 75,
    criticalThreshold: 85,

    // Power optimization
    powerOptimization: 'adaptive',
    powerBudget: 100, // Watts

    // Adaptive learning
    enableAdaptiveLearning: true,
    learningRate: 0.1,
    performanceWindow: 1000,

    // NUMA scheduling
    enableNUMAAwareness: true,
    numaPolicy: 'local',

    // Fallback
    enableFallback: true,
    fallbackOnFailure: true,
  });

  console.log('Production Hardware Router Initialized');
  console.log('Features: GPU, NPU, Thermal, Power, NUMA, Adaptive Learning');

  const profile = await detector.getProfile();
  console.log(`\nDetected Hardware: ${profile.platform} (${profile.architecture})`);

  if (profile.gpu) {
    console.log(`GPU: ${profile.gpu.vendor} ${profile.gpu.type}`);
  }

  if (profile.npu) {
    console.log(`NPU: ${profile.npu.vendor} ${profile.npu.type}`);
  }

  console.log('\n✓ Hardware-aware dispatch ready for production');
}

/**
 * Run all examples
 */
async function main() {
  try {
    await hardwareDetectionExample();
    await capabilityProfilingExample();
    await hardwareRoutingExample();
    await thermalManagementExample();
    await numaSchedulingExample();
    await powerAwareDispatchExample();
    await adaptiveTuningExample();
    await energyEfficiencyExample();
    await productionConfigExample();

    console.log('\n=== All Hardware-Aware Dispatch Examples Completed ===');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export {
  hardwareDetectionExample,
  capabilityProfilingExample,
  hardwareRoutingExample,
  thermalManagementExample,
  numaSchedulingExample,
  powerAwareDispatchExample,
  adaptiveTuningExample,
  energyEfficiencyExample,
  productionConfigExample,
};
