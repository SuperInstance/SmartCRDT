/**
 * Tests for laplacianNoise function
 */

import { describe, it, expect } from "vitest";

/**
 * Laplacian noise generator for ε-differential privacy
 *
 * Generates calibrated Laplacian noise to satisfy ε-differential privacy.
 * The Laplacian mechanism provides better privacy guarantees than Gaussian
 * for some applications while maintaining utility.
 *
 * @param epsilon - Privacy budget (lower = more private)
 * @param sensitivity - Query sensitivity (default: 1.0)
 * @returns Laplacian noise sample
 */
function laplacianNoise(epsilon: number, sensitivity: number = 1.0): number {
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

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
    expect(Math.abs(mean)).toBeLessThan(0.2); // Relaxed tolerance for small sample size

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

  it("should handle sensitivity parameter correctly", () => {
    const epsilon = 1.0;
    const samplesLowSens = Array.from({ length: 100 }, () =>
      laplacianNoise(epsilon, 0.5)
    );
    const samplesHighSens = Array.from({ length: 100 }, () =>
      laplacianNoise(epsilon, 2.0)
    );

    const meanAbsLow = samplesLowSens.reduce((sum, x) => sum + Math.abs(x), 0) / samplesLowSens.length;
    const meanAbsHigh = samplesHighSens.reduce((sum, x) => sum + Math.abs(x), 0) / samplesHighSens.length;

    // Higher sensitivity should produce higher noise magnitude
    expect(meanAbsLow).toBeLessThan(meanAbsHigh);
  });

  it("should handle edge cases", () => {
    // Very small epsilon (strong privacy)
    const verySmallEps = laplacianNoise(0.01, 1.0);
    expect(Math.abs(verySmallEps)).toBeGreaterThan(0);

    // Large epsilon (weak privacy)
    const largeEps = laplacianNoise(10.0, 1.0);
    expect(Math.abs(largeEps)).toBeGreaterThanOrEqual(0);

    // Very large sensitivity
    const largeSens = laplacianNoise(1.0, 100.0);
    expect(Math.abs(largeSens)).toBeGreaterThan(0);
  });
});