/**
 * Simple tests for IntentEncoder ε-differential privacy implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { laplacianNoise } from "./IntentEncoder.js";

describe("laplacianNoise", () => {
  it("should generate noise with correct scale based on epsilon", () => {
    const epsilon = 1.0;
    const sensitivity = 1.0;

    // Generate multiple samples to check distribution
    const samples = Array.from({ length: 100 }, () =>
      laplacianNoise(epsilon, sensitivity)
    );

    // Laplacian distribution with scale = 1/1 = 1.0
    // Mean should be close to 0
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.1); // Should be centered around 0

    // Check some sample values are non-zero (noise should be applied)
    expect(samples.some(x => Math.abs(x) > 0.01)).toBe(true);
  });

  it("should generate less noise with higher epsilon (weaker privacy)", () => {
    const sensitivity = 1.0;
    const samplesLowEps = Array.from({ length: 100 }, () =>
      laplacianNoise(0.5, sensitivity) // ε = 0.5 (strong privacy)
    );
    const samplesHighEps = Array.from({ length: 100 }, () =>
      laplacianNoise(2.0, sensitivity) // ε = 2.0 (weak privacy)
    );

    // Calculate mean absolute values (proxy for noise magnitude)
    const meanAbsLow = samplesLowEps.reduce((sum, x) => sum + Math.abs(x), 0) / samplesLowEps.length;
    const meanAbsHigh = samplesHighEps.reduce((sum, x) => sum + Math.abs(x), 0) / samplesHighEps.length;

    // Lower epsilon should produce higher noise magnitude
    expect(meanAbsLow).toBeGreaterThan(meanAbsHigh);
  });
});

// PrivacyBudgetTracker tests removed - type is internal to IntentEncoder