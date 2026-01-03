/**
 * Hardware Detection Integration Example
 *
 * Demonstrates complete hardware-aware routing workflow.
 */

import {
  HardwareDetector,
  CapabilityProfiler,
  HardwareRouter,
} from "../index.js";
import { OperationType, RoutingPriority } from "@lsi/protocol";

async function main() {
  console.log("=== Hardware Detection and Routing Demo ===\n");

  // ==========================================================================
  // STEP 1: Detect Hardware
  // ==========================================================================

  console.log("Step 1: Detecting hardware...");
  const detector = new HardwareDetector({
    cacheTTL: 60000, // Cache for 1 minute
    detectionTimeout: 5000, // 5 second timeout
  });

  const detectionResult = await detector.detect();

  if (!detectionResult.success || !detectionResult.profile) {
    console.error("❌ Hardware detection failed:", detectionResult.error);
    return;
  }

  const profile = detectionResult.profile;
  console.log("✅ Hardware detected in", detectionResult.detectionTime, "ms\n");

  // ==========================================================================
  // STEP 2: Display Hardware Profile
  // ==========================================================================

  console.log("Step 2: Hardware Profile");
  console.log("────────────────────────────────────");

  // GPU
  console.log("\n🎮 GPU:");
  if (profile.gpu.available) {
    console.log("  Type:", profile.gpu.type);
    console.log("  Name:", profile.gpu.name);
    console.log("  VRAM:", `${profile.gpu.vramMB} MB`);
    console.log("  Available VRAM:", `${profile.gpu.availableVRAMMB} MB`);
    if (profile.gpu.computeCapability) {
      console.log("  Compute Capability:", profile.gpu.computeCapability);
    }
  } else {
    console.log("  ❌ No GPU available");
  }

  // CPU
  console.log("\n💻 CPU:");
  console.log("  Architecture:", profile.cpu.architecture);
  console.log("  Model:", profile.cpu.model);
  console.log("  Physical Cores:", profile.cpu.physicalCores);
  console.log("  Logical Cores:", profile.cpu.logicalCores);
  console.log("  Max Clock:", `${profile.cpu.maxClockMHz} MHz`);
  console.log("  SIMD Support:");
  console.log("    AVX2:", profile.cpu.simd.avx2 ? "✅" : "❌");
  console.log("    AVX-512:", profile.cpu.simd.avx512 ? "✅" : "❌");
  console.log("    NEON:", profile.cpu.simd.neon ? "✅" : "❌");

  // Memory
  console.log("\n🧠 Memory:");
  console.log("  Total:", `${(profile.memory.totalMB / 1024).toFixed(2)} GB`);
  console.log("  Available:", `${(profile.memory.availableMB / 1024).toFixed(2)} GB`);
  console.log("  Used:", `${(profile.memory.usedMB / 1024).toFixed(2)} GB`);
  console.log("  Usage:", `${profile.memory.usagePercent.toFixed(1)}%`);

  // NPU
  console.log("\n🔮 NPU:");
  if (profile.npu.available) {
    console.log("  Name:", profile.npu.name);
    console.log("  Vendor:", profile.npu.vendor);
    if (profile.npu.tops) {
      console.log("  TOPS:", profile.npu.tops);
    }
    console.log("  Supported Precision:", profile.npu.supportedPrecision.join(", "));
  } else {
    console.log("  ❌ No NPU available");
  }

  // Thermal
  console.log("\n🌡️  Thermal:");
  console.log("  State:", profile.thermal.state);
  console.log("  Throttling:", profile.thermal.throttling ? "⚠️  Yes" : "✅ No");
  if (profile.thermal.cpuTempC) {
    console.log("  CPU Temperature:", `${profile.thermal.cpuTempC}°C`);
  }

  // Capability Score
  console.log("\n📊 Overall Capability Score:", `${profile.capabilityScore}/100`);

  // ==========================================================================
  // STEP 3: Profile Capabilities
  // ==========================================================================

  console.log("\n\nStep 3: Capability Profiling");
  console.log("────────────────────────────────────");

  const profiler = new CapabilityProfiler();
  const profilingResult = profiler.profile(profile);

  console.log("\nComponent Scores:");
  console.log("  GPU:", `${profilingResult.componentScores.gpu}/100`);
  console.log("  CPU:", `${profilingResult.componentScores.cpu}/100`);
  console.log("  Memory:", `${profilingResult.componentScores.memory}/100`);
  console.log("  NPU:", `${profilingResult.componentScores.npu}/100`);

  console.log("\nSupported Operations:");
  console.log("  Simple Query:", profilingResult.categories.simpleQuery ? "✅" : "❌");
  console.log("  Complex Reasoning:", profilingResult.categories.complexReasoning ? "✅" : "❌");
  console.log("  ML Inference:", profilingResult.categories.mlInference ? "✅" : "❌");
  console.log("  ML Training:", profilingResult.categories.mlTraining ? "✅" : "❌");
  console.log("  Vector Operations:", profilingResult.categories.vectorOps ? "✅" : "❌");
  console.log("  Matrix Operations:", profilingResult.categories.matrixMul ? "✅" : "❌");
  console.log("  Video Processing:", profilingResult.categories.videoProcessing ? "✅" : "❌");

  // ==========================================================================
  // STEP 4: Route Operations
  // ==========================================================================

  console.log("\n\nStep 4: Routing Decisions");
  console.log("────────────────────────────────────");

  const router = new HardwareRouter(detector, profiler);

  // Example operations
  const operations = [
    {
      type: OperationType.SIMPLE_QUERY,
      name: "Simple Query",
      description: "Basic text query",
    },
    {
      type: OperationType.ML_INFERENCE,
      name: "ML Inference",
      description: "Machine learning inference",
    },
    {
      type: OperationType.ML_TRAINING,
      name: "ML Training",
      description: "Machine learning model training",
    },
    {
      type: OperationType.VECTOR_OPS,
      name: "Vector Operations",
      description: "Vector arithmetic operations",
    },
    {
      type: OperationType.EMBEDDING_GEN,
      name: "Embedding Generation",
      description: "Generate text embeddings",
    },
  ];

  for (const op of operations) {
    console.log(`\n${op.name} (${op.description}):`);

    const decision = await router.route(op.type);

    console.log("  Target:", decision.target);
    console.log("  Confidence:", `${(decision.confidence * 100).toFixed(1)}%`);
    console.log("  Estimated Latency:", `${decision.estimatedLatency} ms`);
    console.log("  Estimated Cost:", `$${decision.estimatedCost.toFixed(4)}`);

    if (decision.reasoning.length > 0) {
      console.log("  Reasoning:");
      decision.reasoning.forEach(reason => {
        console.log(`    - ${reason}`);
      });
    }

    if (decision.fallbackTargets.length > 0) {
      console.log("  Fallback Targets:", decision.fallbackTargets.join(" → "));
    }
  }

  // ==========================================================================
  // STEP 5: Route with Constraints
  // ==========================================================================

  console.log("\n\nStep 5: Routing with Constraints");
  console.log("────────────────────────────────────");

  // Privacy constraint (require local execution)
  console.log("\n🔒 Privacy-Constrained Routing (requireLocal: true):");
  const privacyDecision = await router.route(OperationType.ML_INFERENCE, {
    requireLocal: true,
    thermalLimit: "high",
  });

  console.log("  Target:", privacyDecision.target);
  console.log("  Use Cloud:", privacyDecision.useCloud ? "⚠️  Yes" : "✅ No");
  console.log("  Confidence:", `${(privacyDecision.confidence * 100).toFixed(1)}%`);

  // Cost constraint
  console.log("\n💰 Cost-Constrained Routing (maxCost: $0.0001):");
  const costDecision = await router.route(OperationType.ML_INFERENCE, {
    maxCost: 0.0001,
    preferLocal: true,
  });

  console.log("  Target:", costDecision.target);
  console.log("  Estimated Cost:", `$${costDecision.estimatedCost.toFixed(4)}`);
  console.log("  Reasoning:", costDecision.reasoning.join("; "));

  // Latency constraint
  console.log("\n⚡ Latency-Constrained Routing (maxLatency: 50ms):");
  const latencyDecision = await router.routeWithPriority(
    OperationType.COMPLEX_REASONING,
    RoutingPriority.CRITICAL,
    {
      maxLatency: 50,
    }
  );

  console.log("  Target:", latencyDecision.target);
  console.log("  Estimated Latency:", `${latencyDecision.estimatedLatency} ms`);
  console.log("  Meets Constraint:", latencyDecision.estimatedLatency <= 50 ? "✅ Yes" : "❌ No");

  // ==========================================================================
  // STEP 6: Routing Statistics
  // ==========================================================================

  console.log("\n\nStep 6: Routing Statistics");
  console.log("────────────────────────────────────");

  const stats = router.getStatistics();

  console.log("\nTotal Routes:", stats.totalRoutes);
  console.log("Average Latency:", `${stats.averageLatency.toFixed(2)} ms`);
  console.log("Cloud Fallback Rate:", `${(stats.cloudFallbackRate * 100).toFixed(1)}%`);

  console.log("\nRoutes by Target:");
  Object.entries(stats.routesByTarget).forEach(([target, count]) => {
    const percentage = ((count / stats.totalRoutes) * 100).toFixed(1);
    console.log(`  ${target}: ${count} (${percentage}%)`);
  });

  console.log("\nRoutes by Operation:");
  Object.entries(stats.routesByOperation).forEach(([operation, count]) => {
    const percentage = ((count / stats.totalRoutes) * 100).toFixed(1);
    console.log(`  ${operation}: ${count} (${percentage}%)`);
  });

  // ==========================================================================
  // STEP 7: Recommendations
  // ==========================================================================

  console.log("\n\nStep 7: Hardware Recommendations");
  console.log("────────────────────────────────────");

  const recommendOperations = [
    OperationType.SIMPLE_QUERY,
    OperationType.ML_INFERENCE,
    OperationType.ML_TRAINING,
    OperationType.VECTOR_OPS,
    OperationType.EMBEDDING_GEN,
  ];

  for (const op of recommendOperations) {
    const recommendations = profiler.getRecommendedHardware(op, profile);
    const opName = op.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    console.log(`\n${opName}:`);
    console.log("  ", recommendations.join(" → "));
  }

  // ==========================================================================
  // CONCLUSION
  // ==========================================================================

  console.log("\n\n=== Demo Complete ===");
  console.log("\nHardware detection and routing is working correctly!");
  console.log("\nNext Steps:");
  console.log("  1. Integrate HardwareRouter into your application");
  console.log("  2. Configure routing strategy based on your needs");
  console.log("  3. Monitor routing statistics for optimization");
  console.log("  4. Adjust constraints based on your requirements");
}

// Run the demo
if (require.main === module) {
  main().catch(console.error);
}

export { main };
