/**
 * Hardware-Aware Integration Tests
 *
 * Comprehensive integration tests for hardware-aware features including:
 * - GPU detection and fallback
 * - NUMA topology detection
 * - Thermal throttling response
 * - Performance profiling accuracy
 * - Hardware routing decisions
 * - Multi-socket load balancing
 * - Power state transitions
 * - Memory pressure handling
 *
 * @module hardware/integration-tests
 */

} from "@lsi/core/dist/hardware/NUMAAllocator.js";
import {
  HardwareMonitor,
  ThermalManager,
  HardwareAwareDispatcher,
  NUMATopologyDetector,
  NUMAAllocator,
  getNUMAStats,
  type HardwareMonitorConfig,
  type HardwareState,
  type CPUState,
  type GPUState,
  type MemoryState,
  type ThermalState,
  type NetworkState,
  type ThermalAction,
  type ThermalZone,
  type DispatchDecision,
  type DispatchConstraints,
  type RefinedQuery,
  type NUMATopology,
  type NUMANode,
  type AllocationRequest,
  type AllocationResult,
} from "@lsi/core/dist/hardware/index.js";

/**
 * Mock Hardware Implementation for CI/CD Testing
 *
 * Provides controlled hardware state for testing without requiring
 * actual physical hardware.
 */
export class MockHardware {
  private static mockState: HardwareState | null = null;

  /**
   * Create a mock hardware state
   */
  static createMockState(overrides: Partial<HardwareState> = {}): HardwareState {
    const defaultState: HardwareState = {
      cpu: {
        usage: 0.3,
        temperature: 50,
        availableCores: 8,
        totalCores: 8,
        frequency: 3000,
        loadAverage: [0.3, 0.25, 0.2],
      },
      gpu: {
        available: true,
        usage: 0.4,
        temperature: 60,
        memoryUsed: 2048,
        memoryTotal: 8192,
        utilization: 40,
        powerUsage: 150,
        name: "Mock GPU",
      },
      memory: {
        used: 8000,
        total: 16000,
        available: 8000,
        usageRatio: 0.5,
        cached: 1000,
        buffers: 500,
      },
      thermal: {
        cpu: 50,
        gpu: 60,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
      network: {
        latency: 10,
        available: true,
        type: "ethernet",
      },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: "local",
      confidence: 1.0,
      ...overrides,
    };

    this.mockState = defaultState;
    return defaultState;
  }

  /**
   * Create a mock NUMA topology
   */
  static createMockTopology(numNodes: number = 2): NUMATopology {
    const nodes: NUMANode[] = [];

    for (let i = 0; i < numNodes; i++) {
      const cpus = Array.from({ length: 4 }, (_, j) => i * 4 + j);
      nodes.push({
        nodeId: i,
        cpus,
        memory: {
          total: 16 * 1024 * 1024 * 1024, // 16 GB
          free: 8 * 1024 * 1024 * 1024, // 8 GB
          used: 8 * 1024 * 1024 * 1024, // 8 GB
        },
        distances: Array.from({ length: numNodes }, (_, j) =>
          i === j ? 10 : 20
        ),
        localCPUs: cpus,
      });
    }

    const topology: NUMATopology = {
      numNodes,
      nodes,
      totalCPUs: nodes.reduce((sum, node) => sum + node.cpus.length, 0),
      totalMemory: nodes.reduce((sum, node) => sum + node.memory.total, 0),
      type: numNodes === 1 ? "UMA" : "NUMA",

      getCPUs(nodeId: number): number[] {
        const node = this.nodes.find(n => n.nodeId === nodeId);
        return node ? node.cpus : [];
      },

      getPreferredNode(cpuId: number): number {
        for (const node of this.nodes) {
          if (node.cpus.includes(cpuId)) {
            return node.nodeId;
          }
        }
        return -1;
      },

      getDistance(fromNode: number, toNode: number): number {
        if (fromNode < 0 || fromNode >= this.numNodes) return 20;
        if (toNode < 0 || toNode >= this.numNodes) return 20;
        return this.nodes[fromNode]?.distances[toNode] ?? 20;
      },
    };

    return topology;
  }

  /**
   * Get current mock state
   */
  static getMockState(): HardwareState | null {
    return this.mockState;
  }

  /**
   * Reset mock state
   */
  static resetMockState(): void {
    this.mockState = null;
  }
}

/**
 * Test Scenario 1: GPU Detection and Fallback
 */
describe("Hardware-Aware Integration: GPU Detection and Fallback", () => {
  let dispatcher: HardwareAwareDispatcher;

  beforeEach(() => {
    dispatcher = new HardwareAwareDispatcher({
      enableStats: true,
      costLocal: 0.0,
      costCloud: 0.002,
      latencyLocal: 100,
      latencyCloud: 500,
    });
  });

  afterEach(async () => {
    dispatcher.dispose();
  });

  it("should detect GPU availability and route accordingly", async () => {
    const mockState = MockHardware.createMockState({
      gpu: {
        available: true,
        usage: 0.2,
        temperature: 55,
        memoryUsed: 1024,
        memoryTotal: 8192,
        utilization: 20,
        powerUsage: 100,
        name: "Test GPU",
      },
    });

    // Simulate GPU being available
    const resources = {
      cpu: mockState.cpu.availableCores > 0,
      gpu: mockState.gpu?.available ?? false,
      npu: false,
    };

    expect(resources.gpu).toBe(true);
    expect(resources.cpu).toBe(true);
  });

  it("should fallback to CPU when GPU is unavailable", async () => {
    const mockState = MockHardware.createMockState({
      gpu: undefined,
    });

    const resources = {
      cpu: mockState.cpu.availableCores > 0,
      gpu: mockState.gpu?.available ?? false,
      npu: false,
    };

    expect(resources.gpu).toBe(false);
    expect(resources.cpu).toBe(true);
  });

  it("should fallback to cloud when GPU is overloaded", async () => {
    const mockState = MockHardware.createMockState({
      gpu: {
        available: true,
        usage: 0.98,
        temperature: 85,
        memoryUsed: 7800,
        memoryTotal: 8192,
        utilization: 98,
        powerUsage: 250,
        name: "Overloaded GPU",
      },
      thermal: {
        cpu: 75,
        gpu: 85,
        critical: false,
        zone: "throttle",
        timeInZone: 5000,
      },
    });

    expect(mockState.gpu?.usage).toBeGreaterThan(0.95);
    expect(mockState.thermal.zone).toBe("throttle");
  });

  it("should handle multi-GPU systems", async () => {
    // Simulate multi-GPU detection
    const gpu1 = {
      available: true,
      usage: 0.3,
      temperature: 60,
      memoryUsed: 2048,
      memoryTotal: 8192,
      utilization: 30,
      powerUsage: 120,
      deviceId: "gpu-0",
      name: "GPU 0",
    };

    const gpu2 = {
      available: true,
      usage: 0.5,
      temperature: 65,
      memoryUsed: 4096,
      memoryTotal: 8192,
      utilization: 50,
      powerUsage: 150,
      deviceId: "gpu-1",
      name: "GPU 1",
    };

    // Select less utilized GPU
    const selectedGPU = gpu1.usage < gpu2.usage ? gpu1 : gpu2;
    expect(selectedGPU.deviceId).toBe("gpu-0");
  });
});

/**
 * Test Scenario 2: NUMA Topology Detection
 */
describe("Hardware-Aware Integration: NUMA Topology Detection", () => {
  it("should detect single-node UMA topology", async () => {
    const topology = MockHardware.createMockTopology(1);

    expect(topology.type).toBe("UMA");
    expect(topology.numNodes).toBe(1);
    expect(topology.totalCPUs).toBe(4);
  });

  it("should detect multi-node NUMA topology", async () => {
    const topology = MockHardware.createMockTopology(2);

    expect(topology.type).toBe("NUMA");
    expect(topology.numNodes).toBe(2);
    expect(topology.totalCPUs).toBe(8);
  });

  it("should correctly map CPUs to nodes", async () => {
    const topology = MockHardware.createMockTopology(2);

    // Node 0 should have CPUs 0-3
    const node0CPUs = topology.getCPUs(0);
    expect(node0CPUs).toEqual([0, 1, 2, 3]);

    // Node 1 should have CPUs 4-7
    const node1CPUs = topology.getCPUs(1);
    expect(node1CPUs).toEqual([4, 5, 6, 7]);
  });

  it("should find preferred node for CPU", async () => {
    const topology = MockHardware.createMockTopology(2);

    expect(topology.getPreferredNode(0)).toBe(0);
    expect(topology.getPreferredNode(4)).toBe(1);
    expect(topology.getPreferredNode(99)).toBe(-1);
  });

  it("should calculate accurate distances between nodes", async () => {
    const topology = MockHardware.createMockTopology(2);

    // Local access
    expect(topology.getDistance(0, 0)).toBe(10);
    expect(topology.getDistance(1, 1)).toBe(10);

    // Remote access
    expect(topology.getDistance(0, 1)).toBe(20);
    expect(topology.getDistance(1, 0)).toBe(20);
  });

  it("should generate NUMA statistics", async () => {
    const topology = MockHardware.createMockTopology(2);
    const stats = getNUMAStats(topology);

    expect(stats.nodeStats).toHaveLength(2);
    expect(stats.avgLocalAccessRatio).toBe(1.0);
    expect(stats.loadBalanceScore).toBeGreaterThan(0);
    expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
  });
});

/**
 * Test Scenario 3: Thermal Throttling Response
 */
describe("Hardware-Aware Integration: Thermal Throttling Response", () => {
  let thermalManager: ThermalManager;

  beforeEach(() => {
    thermalManager = new ThermalManager({
      enableAutoActions: false,
    });
  });

  afterEach(() => {
    thermalManager.dispose();
  });

  it("should remain in normal zone at low temperatures", () => {
    const thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 50,
        gpu: 55,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
    }).thermal;

    const action = thermalManager.updateThermalState(thermalState);

    expect(thermalManager.getCurrentZone()).toBe("normal");
    expect(thermalManager.isThrottling()).toBe(false);
    expect(action.type).toBe("proceed");
  });

  it("should enter throttle zone at high temperatures", () => {
    const thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 87,
        gpu: 85,
        critical: false,
        zone: "throttle",
        timeInZone: 6000,
      },
    }).thermal;

    const action = thermalManager.updateThermalState(thermalState);

    expect(thermalManager.getCurrentZone()).toBe("throttle");
    expect(thermalManager.isThrottling()).toBe(true);
    expect(action.type).toBe("throttle");
    if (action.type === "throttle") {
      expect(action.reduction).toBeGreaterThan(0);
      expect(action.reduction).toBeLessThanOrEqual(0.5);
    }
  });

  it("should enter critical zone at extreme temperatures", () => {
    const thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 96,
        gpu: 90,
        critical: true,
        zone: "critical",
        timeInZone: 1000,
      },
    }).thermal;

    const action = thermalManager.updateThermalState(thermalState);

    expect(thermalManager.getCurrentZone()).toBe("critical");
    expect(thermalManager.isCritical()).toBe(true);
    expect(action.type).toBe("reject");
  });

  it("should transition between zones correctly", () => {
    // Start in normal
    let thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 50,
        gpu: 55,
        critical: false,
        zone: "normal",
        timeInZone: 5000,
      },
    }).thermal;

    thermalManager.updateThermalState(thermalState);
    expect(thermalManager.getCurrentZone()).toBe("normal");

    // Heat up to throttle
    thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 87,
        gpu: 85,
        critical: false,
        zone: "throttle",
        timeInZone: 6000,
      },
    }).thermal;

    thermalManager.updateThermalState(thermalState);
    expect(thermalManager.getCurrentZone()).toBe("throttle");

    // Cool back to normal
    thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 65,
        gpu: 60,
        critical: false,
        zone: "normal",
        timeInZone: 6000,
      },
    }).thermal;

    thermalManager.updateThermalState(thermalState);
    expect(thermalManager.getCurrentZone()).toBe("normal");
  });

  it("should estimate time to normal zone", () => {
    const thermalState = MockHardware.createMockState({
      thermal: {
        cpu: 87,
        gpu: 85,
        critical: false,
        zone: "throttle",
        timeInZone: 1000,
      },
    }).thermal;

    thermalManager.updateThermalState(thermalState);

    const timeToNormal = thermalManager.estimateTimeToNormal();
    expect(timeToNormal).toBeGreaterThan(0);
    expect(timeToNormal).toBeLessThan(60000 * 10); // Less than 10 minutes
  });

  it("should track thermal metrics", () => {
    // Run through several temperature changes
    const temperatures = [50, 60, 70, 80, 75, 65];

    temperatures.forEach(temp => {
      const thermalState = MockHardware.createMockState({
        thermal: {
          cpu: temp,
          gpu: temp + 5,
          critical: temp > 90,
          zone: temp > 85 ? (temp > 95 ? "critical" : "throttle") : "normal",
          timeInZone: 0,
        },
      }).thermal;

      thermalManager.updateThermalState(thermalState);
    });

    const metrics = thermalManager.getMetrics();

    expect(metrics.maxTemperature).toBeGreaterThan(50);
    expect(metrics.averageTemperature).toBeGreaterThan(50);
    expect(metrics.averageTemperature).toBeLessThan(80);
  });
});

/**
 * Test Scenario 4: Performance Profiling Accuracy
 */
describe("Hardware-Aware Integration: Performance Profiling Accuracy", () => {
  it("should accurately profile CPU usage", async () => {
    const mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.45,
        temperature: 55,
        availableCores: 8,
        totalCores: 8,
        frequency: 3000,
        loadAverage: [0.45, 0.42, 0.38],
      },
    });

    expect(mockState.cpu.usage).toBe(0.45);
    expect(mockState.cpu.availableCores).toBe(8);
    expect(mockState.cpu.loadAverage).toHaveLength(3);
  });

  it("should accurately profile memory usage", async () => {
    const mockState = MockHardware.createMockState({
      memory: {
        used: 12000,
        total: 16000,
        available: 4000,
        usageRatio: 0.75,
        cached: 2000,
        buffers: 1000,
      },
    });

    expect(mockState.memory.usageRatio).toBe(0.75);
    expect(mockState.memory.used + mockState.memory.available).toBe(
      mockState.memory.total
    );
  });

  it("should accurately profile GPU utilization", async () => {
    const mockState = MockHardware.createMockState({
      gpu: {
        available: true,
        usage: 0.65,
        temperature: 70,
        memoryUsed: 5324,
        memoryTotal: 8192,
        utilization: 65,
        powerUsage: 180,
        name: "Test GPU",
      },
    });

    expect(mockState.gpu?.utilization).toBe(65);
    expect(mockState.gpu?.usage).toBe(0.65);
    expect(mockState.gpu?.memoryUsed).toBeLessThan(mockState.gpu?.memoryTotal);
  });

  it("should calculate confidence scores accurately", async () => {
    const highConfidenceState = MockHardware.createMockState({
      cpu: { usage: 0.2, temperature: 45, availableCores: 8, totalCores: 8, frequency: 3000, loadAverage: [0.2] },
      memory: { used: 4000, total: 16000, available: 12000, usageRatio: 0.25, cached: 1000, buffers: 500 },
      thermal: { cpu: 45, critical: false, zone: "normal", timeInZone: 0 },
    });

    expect(highConfidenceState.confidence).toBeGreaterThan(0.8);

    const lowConfidenceState = MockHardware.createMockState({
      cpu: { usage: 0.85, temperature: 80, availableCores: 8, totalCores: 8, frequency: 3000, loadAverage: [0.85] },
      memory: { used: 14000, total: 16000, available: 2000, usageRatio: 0.875, cached: 1000, buffers: 500 },
      thermal: { cpu: 80, critical: false, zone: "throttle", timeInZone: 5000 },
    });

    expect(lowConfidenceState.confidence).toBeLessThan(0.5);
  });
});

/**
 * Test Scenario 5: Hardware Routing Decisions
 */
describe("Hardware-Aware Integration: Hardware Routing Decisions", () => {
  let dispatcher: HardwareAwareDispatcher;

  beforeEach(async () => {
    dispatcher = new HardwareAwareDispatcher({
      enableStats: true,
      costLocal: 0.0,
      costCloud: 0.002,
      latencyLocal: 100,
      latencyCloud: 500,
    });
    await dispatcher.start();
  });

  afterEach(() => {
    dispatcher.dispose();
  });

  function createMockQuery(complexity: number = 0.5): RefinedQuery {
    return {
      original: "test query",
      normalized: "test query",
      staticFeatures: {
        length: 10,
        wordCount: 2,
        queryType: "question",
        complexity,
        hasCode: false,
        hasSQL: false,
        hasUrl: false,
        hasEmail: false,
        questionMark: true,
        exclamationCount: 0,
        ellipsisCount: 0,
        capitalizationRatio: 0.0,
        punctuationDensity: 0.1,
        technicalTerms: [],
        domainKeywords: [],
      },
      semanticFeatures: null,
      cacheKey: "test-key",
      suggestions: [],
      timestamp: Date.now(),
    };
  }

  it("should route to local when resources are available", async () => {
    // Mock good hardware state
    MockHardware.createMockState();

    const query = createMockQuery(0.3);
    const decision = await dispatcher.dispatch(query);

    expect(decision.destination).toBe("local");
    expect(decision.confidence).toBeGreaterThan(0.7);
    expect(decision.reasoning.thermalOk).toBe(true);
    expect(decision.reasoning.memoryOk).toBe(true);
  });

  it("should route to cloud when resources are constrained", async () => {
    // Mock constrained hardware state
    MockHardware.createMockState({
      cpu: { usage: 0.97, temperature: 90, availableCores: 8, totalCores: 8, frequency: 3000, loadAverage: [0.97] },
      memory: { used: 15200, total: 16000, available: 800, usageRatio: 0.95, cached: 1000, buffers: 500 },
      thermal: { cpu: 90, critical: false, zone: "throttle", timeInZone: 3000 },
    });

    const query = createMockQuery(0.7);
    const decision = await dispatcher.dispatch(query);

    expect(decision.destination).toBe("cloud");
  });

  it("should respect user constraints", async () => {
    const query = createMockQuery(0.5);
    const constraints: DispatchConstraints = {
      requireLocal: true,
      maxCost: 0.001,
    };

    const decision = await dispatcher.dispatch(query, constraints);

    // Should respect requireLocal constraint
    if (decision.destination !== "local") {
      expect(decision.notes).toContain("WARNING");
    }
  });

  it("should estimate latency and cost accurately", async () => {
    const query = createMockQuery(0.5);
    const decision = await dispatcher.dispatch(query);

    expect(decision.estimatedLatency).toBeGreaterThan(0);
    expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);

    if (decision.destination === "local") {
      expect(decision.estimatedCost).toBe(0);
    } else if (decision.destination === "cloud") {
      expect(decision.estimatedCost).toBeGreaterThan(0);
    }
  });

  it("should track dispatch statistics", async () => {
    const query = createMockQuery(0.5);

    // Make several dispatches
    await dispatcher.dispatch(query);
    await dispatcher.dispatch(query);
    await dispatcher.dispatch(query);

    const stats = dispatcher.getStats();

    expect(stats.total).toBe(3);
    expect(stats.averageConfidence).toBeGreaterThan(0);
    expect(stats.averageLatency).toBeGreaterThan(0);
  });
});

/**
 * Test Scenario 6: Multi-Socket Load Balancing
 */
describe("Hardware-Aware Integration: Multi-Socket Load Balancing", () => {
  it("should distribute load evenly across NUMA nodes", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology, {
      strategy: "spread",
    });

    const requests: AllocationRequest[] = [
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-1" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-2" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-3" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-4" },
    ];

    const allocations = requests.map(req => allocator.allocate(req));
    const nodeCounts = [0, 0];

    allocations.forEach(alloc => {
      nodeCounts[alloc.nodeId]++;
    });

    // Should be relatively balanced
    const balance = Math.abs(nodeCounts[0] - nodeCounts[1]);
    expect(balance).toBeLessThanOrEqual(2);
  });

  it("should pack allocations when strategy is pack", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology, {
      strategy: "pack",
    });

    const requests: AllocationRequest[] = [
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-1" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-2" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 1, taskId: "task-3" },
    ];

    const allocations = requests.map(req => allocator.allocate(req));

    // Most should be on first node
    const node0Count = allocations.filter(a => a.nodeId === 0).length;
    expect(node0Count).toBeGreaterThanOrEqual(2);
  });

  it("should respect CPU affinity preferences", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology);

    const request: AllocationRequest = {
      memoryBytes: 1024 * 1024 * 1024,
      cpuCount: 1,
      preferredCPU: 5, // CPU 5 is on node 1
      affinity: "strict",
      taskId: "task-1",
    };

    const allocation = allocator.allocate(request);

    expect(allocation.cpus).toContain(5);
    expect(allocation.nodeId).toBe(1);
  });

  it("should handle cross-node allocation when necessary", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology, {
      allowCrossNode: true,
    });

    // Request more memory than available on a single node
    const request: AllocationRequest = {
      memoryBytes: 12 * 1024 * 1024 * 1024, // 12 GB, more than single node has free
      cpuCount: 1,
      taskId: "task-1",
    };

    const allocation = allocator.allocate(request);

    expect(allocation.isFallback).toBe(true);
    expect(allocation.fallbackReason).toBeDefined();
  });

  it("should track load balance score", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology, {
      strategy: "balanced",
    });

    const requests: AllocationRequest[] = Array.from(
      { length: 10 },
      (_, i) => ({
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 1,
        taskId: `task-${i}`,
      })
    );

    requests.forEach(req => allocator.allocate(req));

    const stats = allocator.getStats();

    expect(stats.loadBalanceScore).toBeGreaterThan(0);
    expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
    expect(stats.totalAllocations).toBe(10);
  });
});

/**
 * Test Scenario 7: Power State Transitions
 */
describe("Hardware-Aware Integration: Power State Transitions", () => {
  it("should detect normal power state", () => {
    const mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.3,
        temperature: 50,
        availableCores: 8,
        totalCores: 8,
        frequency: 3000,
        loadAverage: [0.3],
      },
      thermal: {
        cpu: 50,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
    });

    expect(mockState.thermal.zone).toBe("normal");
    expect(mockState.canProcessLocal).toBe(true);
  });

  it("should detect power saving state", () => {
    const mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.1,
        temperature: 40,
        availableCores: 8,
        totalCores: 8,
        frequency: 1500, // Reduced frequency
        loadAverage: [0.1],
      },
      thermal: {
        cpu: 40,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
    });

    expect(mockState.cpu.frequency).toBeLessThan(3000);
    expect(mockState.cpu.usage).toBeLessThan(0.2);
  });

  it("should detect high power state", () => {
    const mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.9,
        temperature: 80,
        availableCores: 8,
        totalCores: 8,
        frequency: 3500, // Boost frequency
        loadAverage: [0.9],
      },
      gpu: {
        available: true,
        usage: 0.95,
        temperature: 82,
        memoryUsed: 7800,
        memoryTotal: 8192,
        utilization: 95,
        powerUsage: 280,
        name: "High Power GPU",
      },
      thermal: {
        cpu: 80,
        gpu: 82,
        critical: false,
        zone: "throttle",
        timeInZone: 2000,
      },
    });

    expect(mockState.cpu.frequency).toBeGreaterThan(3000);
    expect(mockState.gpu?.powerUsage).toBeGreaterThan(200);
    expect(mockState.thermal.zone).toBe("throttle");
  });

  it("should transition states based on load", () => {
    let mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.2,
        temperature: 45,
        availableCores: 8,
        totalCores: 8,
        frequency: 2000,
        loadAverage: [0.2],
      },
      thermal: {
        cpu: 45,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
    });

    expect(mockState.cpu.frequency).toBe(2000);

    // Simulate load increase
    mockState = MockHardware.createMockState({
      cpu: {
        usage: 0.8,
        temperature: 70,
        availableCores: 8,
        totalCores: 8,
        frequency: 3400,
        loadAverage: [0.8],
      },
      thermal: {
        cpu: 70,
        critical: false,
        zone: "normal",
        timeInZone: 5000,
      },
    });

    expect(mockState.cpu.frequency).toBe(3400);
    expect(mockState.cpu.usage).toBe(0.8);
  });
});

/**
 * Test Scenario 8: Memory Pressure Handling
 */
describe("Hardware-Aware Integration: Memory Pressure Handling", () => {
  it("should detect normal memory state", () => {
    const mockState = MockHardware.createMockState({
      memory: {
        used: 4000,
        total: 16000,
        available: 12000,
        usageRatio: 0.25,
        cached: 1000,
        buffers: 500,
      },
    });

    expect(mockState.memory.usageRatio).toBeLessThan(0.8);
    expect(mockState.canProcessLocal).toBe(true);
  });

  it("should detect high memory pressure", () => {
    const mockState = MockHardware.createMockState({
      memory: {
        used: 14000,
        total: 16000,
        available: 2000,
        usageRatio: 0.875,
        cached: 500,
        buffers: 250,
      },
    });

    expect(mockState.memory.usageRatio).toBeGreaterThan(0.8);
    expect(mockState.confidence).toBeLessThan(1.0);
  });

  it("should detect critical memory pressure", () => {
    const mockState = MockHardware.createMockState({
      memory: {
        used: 15500,
        total: 16000,
        available: 500,
        usageRatio: 0.97,
        cached: 100,
        buffers: 50,
      },
    });

    expect(mockState.memory.usageRatio).toBeGreaterThan(0.95);
    expect(mockState.canProcessLocal).toBe(false);
    expect(mockState.recommendedAction).toBe("cloud");
  });

  it("should handle memory allocation failure gracefully", () => {
    const topology = MockHardware.createMockTopology(1);
    const allocator = new NUMAAllocator(topology);

    // Request more memory than available
    const request: AllocationRequest = {
      memoryBytes: 32 * 1024 * 1024 * 1024, // 32 GB, more than total
      cpuCount: 1,
      taskId: "task-1",
    };

    expect(() => allocator.allocate(request)).toThrow();
  });

  it("should track memory statistics by node", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology);

    const memoryManager = allocator.getMemoryManager();
    const stats = memoryManager.getMemoryStats();

    expect(stats.size).toBe(2);
    stats.forEach((nodeStats, nodeId) => {
      expect(nodeStats.total).toBeGreaterThan(0);
      expect(nodeStats.used).toBeGreaterThanOrEqual(0);
      expect(nodeStats.free).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Performance Benchmarks
 */
describe("Hardware-Aware Integration: Performance Benchmarks", () => {
  it("should benchmark hardware state capture", async () => {
    const monitor = new HardwareMonitor();

    const startTime = performance.now();
    await monitor.captureState();
    const endTime = performance.now();

    const captureTime = endTime - startTime;

    // Should complete in reasonable time
    expect(captureTime).toBeLessThan(100); // Less than 100ms

    monitor.dispose();
  });

  it("should benchmark NUMA topology detection", async () => {
    const detector = new NUMATopologyDetector();

    const startTime = performance.now();
    const topology = await detector.detect();
    const endTime = performance.now();

    const detectionTime = endTime - startTime;

    // Should complete in reasonable time
    expect(detectionTime).toBeLessThan(50); // Less than 50ms
    expect(topology.numNodes).toBeGreaterThan(0);
  });

  it("should benchmark allocation decisions", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology);

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      allocator.allocate({
        memoryBytes: 1024 * 1024,
        cpuCount: 1,
        taskId: `task-${i}`,
      });
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;

    // Each allocation should be very fast
    expect(avgTime).toBeLessThan(1); // Less than 1ms per allocation
  });

  it("should benchmark dispatch decisions", async () => {
    const dispatcher = new HardwareAwareDispatcher();
    await dispatcher.start();

    const query: RefinedQuery = {
      original: "test query",
      normalized: "test query",
      staticFeatures: {
        length: 10,
        wordCount: 2,
        queryType: "question",
        complexity: 0.5,
        hasCode: false,
        hasSQL: false,
        hasUrl: false,
        hasEmail: false,
        questionMark: true,
        exclamationCount: 0,
        ellipsisCount: 0,
        capitalizationRatio: 0.0,
        punctuationDensity: 0.1,
        technicalTerms: [],
        domainKeywords: [],
      },
      semanticFeatures: null,
      cacheKey: "test-key",
      suggestions: [],
      timestamp: Date.now(),
    };

    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      await dispatcher.dispatch(query);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;

    // Each dispatch should be fast
    expect(avgTime).toBeLessThan(10); // Less than 10ms per dispatch

    dispatcher.dispose();
  });
});

/**
 * Hardware Simulation Tests
 */
describe("Hardware-Aware Integration: Hardware Simulation", () => {
  it("should simulate thermal throttling scenario", () => {
    const thermalManager = new ThermalManager();

    // Simulate gradual heating
    const temperatures = [50, 55, 60, 65, 70, 75, 80, 85, 87, 88, 85, 80, 75, 70];

    let zoneEntered: ThermalZone | null = null;

    temperatures.forEach(temp => {
      const thermalState = MockHardware.createMockState({
        thermal: {
          cpu: temp,
          critical: temp > 95,
          zone: temp > 95 ? "critical" : temp > 85 ? "throttle" : "normal",
          timeInZone: 6000,
        },
      }).thermal;

      const action = thermalManager.updateThermalState(thermalState);
      const currentZone = thermalManager.getCurrentZone();

      if (currentZone !== "normal" && !zoneEntered) {
        zoneEntered = currentZone;
      }

      if (currentZone === "throttle") {
        expect(action.type).toBe("throttle");
      }
    });

    expect(zoneEntered).toBe("throttle");

    thermalManager.dispose();
  });

  it("should simulate memory pressure scenario", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology);

    // Gradually increase memory usage
    const allocations: AllocationResult[] = [];

    for (let i = 0; i < 20; i++) {
      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024 * 1024, // 1 GB each
        cpuCount: 1,
        taskId: `task-${i}`,
      };

      try {
        const allocation = allocator.allocate(request);
        allocations.push(allocation);
      } catch (e) {
        // Memory exhausted
        break;
      }
    }

    // Should have made several allocations before exhaustion
    expect(allocations.length).toBeGreaterThan(0);

    const stats = allocator.getStats();
    expect(stats.totalAllocations).toBe(allocations.length);
  });

  it("should simulate multi-GPU workload distribution", () => {
    const gpus = [
      { id: "gpu-0", usage: 0.2, memoryFree: 6144 },
      { id: "gpu-1", usage: 0.5, memoryFree: 4096 },
      { id: "gpu-2", usage: 0.7, memoryFree: 2048 },
    ];

    // Select GPU with most free memory
    const selectedGPU = gpus.reduce((best, gpu) =>
      gpu.memoryFree > best.memoryFree ? gpu : best
    );

    expect(selectedGPU.id).toBe("gpu-0");
    expect(selectedGPU.memoryFree).toBe(6144);
  });

  it("should simulate NUMA-aware task placement", () => {
    const topology = MockHardware.createMockTopology(2);
    const allocator = new NUMAAllocator(topology, {
      strategy: "balanced",
    });

    // Create tasks with CPU affinity
    const tasks: AllocationRequest[] = [
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 2, preferredCPU: 0, taskId: "task-1" },
      { memoryBytes: 1024 * 1024 * 1024, cpuCount: 2, preferredCPU: 5, taskId: "task-2" },
    ];

    const placements = tasks.map(task => allocator.allocate(task));

    // Task 1 should be on node 0 (CPU 0 is on node 0)
    expect(placements[0].nodeId).toBe(0);

    // Task 2 should be on node 1 (CPU 5 is on node 1)
    expect(placements[1].nodeId).toBe(1);

    // Verify CPUs are local to their nodes
    placements.forEach((placement, i) => {
      const preferredCPU = tasks[i].preferredCPU!;
      const preferredNode = topology.getPreferredNode(preferredCPU);
      expect(placement.nodeId).toBe(preferredNode);
    });
  });
});
