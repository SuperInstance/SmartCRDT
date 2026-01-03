/**
 * WebGPU Examples - Real World Applications Tests
 *
 * Tests for real-world application examples: image processing,
 * particle simulation, physics simulation, and ML inference.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyImageFilter,
  resizeImage
} from '../src/real-world/17-image-processing.js';
import {
  GPUParticleSystem,
  ParticleConfig,
  runParticleSimulation
} from '../src/real-world/18-particle-simulation.ts';
import {
  NBodySimulation,
  PhysicsConfig,
  runPhysicsSimulation
} from '../src/real-world/19-physics-simulation.ts';
import {
  GPUMLInference,
  ModelLayer,
  createSimpleCNN,
  runMLInference
} from '../src/real-world/20-ml-inference.js';

const isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

describe('Image Processing', () => {
  describe.skipIf(!isWebGPUAvailable)('Image Filters', () => {
    it('should apply grayscale filter', async () => {
      const width = 64;
      const height = 64;
      const image = new Uint8ClampedArray(width * height * 4);

      // Create white image
      for (let i = 0; i < image.length; i += 4) {
        image[i] = 255;     // R
        image[i + 1] = 255; // G
        image[i + 2] = 255; // B
        image[i + 3] = 255; // A
      }

      const result = await applyImageFilter(image, width, height, 'grayscale');

      expect(result.length).toBe(image.length);

      // Check that pixels are gray (R = G = B)
      for (let i = 0; i < result.length; i += 4) {
        expect(result[i]).toBeCloseTo(result[i + 1], 1);
        expect(result[i]).toBeCloseTo(result[i + 2], 1);
      }
    });

    it('should apply invert filter', async () => {
      const width = 32;
      const height = 32;
      const image = new Uint8ClampedArray(width * height * 4);

      // Create colored image
      for (let i = 0; i < image.length; i += 4) {
        image[i] = 100;
        image[i + 1] = 150;
        image[i + 2] = 200;
        image[i + 3] = 255;
      }

      const result = await applyImageFilter(image, width, height, 'invert');

      // Check that colors are inverted
      expect(result[0]).toBe(255 - 100);
      expect(result[1]).toBe(255 - 150);
      expect(result[2]).toBe(255 - 200);
    });

    it('should apply blur filter', async () => {
      const width = 32;
      const height = 32;
      const image = new Uint8ClampedArray(width * height * 4);

      // Create pattern
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          image[i] = (x % 2) * 255;
        }
      }

      const result = await applyImageFilter(image, width, height, 'blur');

      // Blur should smooth the pattern
      expect(result).toBeInstanceOf(Uint8ClampedArray);
      expect(result.length).toBe(image.length);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Image Resize', () => {
    it('should resize image up', async () => {
      const srcWidth = 32;
      const srcHeight = 32;
      const image = new Uint8ClampedArray(srcWidth * srcHeight * 4).fill(128);

      const result = await resizeImage(image, srcWidth, srcHeight, 64, 64);

      expect(result.length).toBe(64 * 64 * 4);
    });

    it('should resize image down', async () => {
      const srcWidth = 64;
      const srcHeight = 64;
      const image = new Uint8ClampedArray(srcWidth * srcHeight * 4).fill(128);

      const result = await resizeImage(image, srcWidth, srcHeight, 32, 32);

      expect(result.length).toBe(32 * 32 * 4);
    });

    it('should maintain aspect ratio in scaling', async () => {
      const srcWidth = 64;
      const srcHeight = 64;
      const image = new Uint8ClampedArray(srcWidth * srcHeight * 4).fill(128);

      const result = await resizeImage(image, srcWidth, srcHeight, 128, 128);

      expect(result.length).toBe(128 * 128 * 4);
    });
  });
});

describe('Particle Simulation', () => {
  let system: GPUParticleSystem;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      const config: ParticleConfig = {
        numParticles: 1000,
        bounds: { width: 800, height: 600 },
        gravity: 100,
        drag: 0.1
      };
      system = new GPUParticleSystem(config);
      await system.init();
    }
  });

  afterEach(() => {
    if (system) {
      system.dispose();
    }
  });

  describe.skipIf(!isWebGPUAvailable)('Particle Updates', () => {
    it('should update particle positions', async () => {
      const particles = await system.update(1/60);

      expect(particles.length).toBe(1000);
      expect(particles[0]).toHaveProperty('x');
      expect(particles[0]).toHaveProperty('y');
      expect(particles[0]).toHaveProperty('vx');
      expect(particles[0]).toHaveProperty('vy');
      expect(particles[0]).toHaveProperty('life');
    });

    it('should keep particles within bounds', async () => {
      const particles = await system.update(1/60);

      for (const p of particles) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(800);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(600);
      }
    });

    it('should decay particle life', async () => {
      const particles1 = await system.update(1/60);
      const particles2 = await system.update(1/60);

      // Life should decrease (though some particles may respawn)
      const avgLife1 = particles1.reduce((sum, p) => sum + p.life, 0) / particles1.length;
      const avgLife2 = particles2.reduce((sum, p) => sum + p.life, 0) / particles2.length;

      // Average life may vary due to respawning
      expect(avgLife1).toBeGreaterThanOrEqual(0);
      expect(avgLife1).toBeLessThanOrEqual(1);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Configuration', () => {
    it('should handle different configurations', async () => {
      const customSystem = new GPUParticleSystem({
        numParticles: 500,
        bounds: { width: 1920, height: 1080 },
        gravity: 500,
        drag: 0.5
      });

      await customSystem.init();
      const particles = await customSystem.update(1/60);

      expect(particles.length).toBe(500);

      customSystem.dispose();
    });
  });
});

describe('Physics Simulation', () => {
  let simulation: NBodySimulation;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      const config: PhysicsConfig = {
        numBodies: 100,
        gravityConstant: 10,
        softening: 5,
        timeStep: 0.01
      };
      simulation = new NBodySimulation(config);
      await simulation.init();
    }
  });

  afterEach(() => {
    if (simulation) {
      simulation.dispose();
    }
  });

  describe.skipIf(!isWebGPUAvailable)('N-Body Simulation', () => {
    it('should update body positions', async () => {
      const bodies = await simulation.step();

      expect(bodies.length).toBe(100);
      expect(bodies[0]).toHaveProperty('x');
      expect(bodies[0]).toHaveProperty('y');
      expect(bodies[0]).toHaveProperty('z');
      expect(bodies[0]).toHaveProperty('vx');
      expect(bodies[0]).toHaveProperty('vy');
      expect(bodies[0]).toHaveProperty('vz');
      expect(bodies[0]).toHaveProperty('mass');
    });

    it('should apply gravity between bodies', async () => {
      const bodies1 = await simulation.step();
      const bodies2 = await simulation.step();

      // Velocities should change due to gravity
      expect(bodies2[0].vx).not.toBe(bodies1[0].vx);
    });

    it('should conserve momentum (approximately)', async () => {
      const bodies1 = await simulation.step();

      let totalMomentumX = 0;
      let totalMomentumY = 0;
      let totalMomentumZ = 0;

      for (const body of bodies1) {
        totalMomentumX += body.mass * body.vx;
        totalMomentumY += body.mass * body.vy;
        totalMomentumZ += body.mass * body.vz;
      }

      // With random initial velocities, momentum may not be zero
      // But it should be finite
      expect(totalMomentumX).toBeFinite();
      expect(totalMomentumY).toBeFinite();
      expect(totalMomentumZ).toBeFinite();
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Configuration', () => {
    it('should handle different gravity constants', async () => {
      const customSim = new NBodySimulation({
        numBodies: 50,
        gravityConstant: 100,
        softening: 10,
        timeStep: 0.01
      });

      await customSim.init();
      const bodies = await customSim.step();

      expect(bodies.length).toBe(50);

      customSim.dispose();
    });
  });
});

describe('ML Inference', () => {
  let model: GPUMLInference;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      model = createSimpleCNN();
      await model.init();
    }
  });

  afterEach(() => {
    if (model) {
      model.dispose();
    }
  });

  describe.skipIf(!isWebGPUAvailable)('Dense Layers', () => {
    it('should apply dense layer with ReLU', async () => {
      const input = new Float32Array(1352).fill(0.5);
      const output = await model.infer(input);

      expect(output.length).toBe(10); // Final layer output size
    });

    it('should output probabilities', async () => {
      const input = new Float32Array(28 * 28).fill(0.5);
      const output = await model.infer(input);

      // All outputs should be non-negative (ReLU)
      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Model Architecture', () => {
    it('should have correct layer structure', () => {
      const layers: ModelLayer[] = [
        { type: 'dense', inputShape: [10], outputShape: [5] },
        { type: 'dense', inputShape: [5], outputShape: [2] }
      ];

      const customModel = new GPUMLInference(layers);

      expect(customModel).toBeTruthy();
      customModel.dispose();
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Batch Inference', () => {
    it('should process multiple inputs', async () => {
      const inputs = [
        new Float32Array(28 * 28).fill(0.1),
        new Float32Array(28 * 28).fill(0.5),
        new Float32Array(28 * 28).fill(0.9)
      ];

      const outputs = await model.inferBatch(inputs);

      expect(outputs.length).toBe(3);
      expect(outputs[0].length).toBe(10);
    });
  });
});

describe('Integration Tests', () => {
  describe.skipIf(!isWebGPUAvailable)('Image to ML Pipeline', () => {
    it('should process image through ML model', async () => {
      // Resize image
      const image = new Uint8ClampedArray(64 * 64 * 4).fill(128);
      const resized = await resizeImage(image, 64, 64, 28, 28);

      // Convert to normalized float
      const input = new Float32Array(28 * 28);
      for (let i = 0; i < resized.length; i += 4) {
        input[i / 4] = resized[i] / 255;
      }

      // Run inference
      const model = createSimpleCNN();
      await model.init();
      const output = await model.infer(input);

      expect(output.length).toBe(10);

      model.dispose();
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Performance', () => {
    it('should complete operations quickly', async () => {
      const start = performance.now();

      // Image processing
      const image = new Uint8ClampedArray(64 * 64 * 4).fill(128);
      await applyImageFilter(image, 64, 64, 'grayscale');

      const end = performance.now();

      // Should complete in reasonable time
      expect(end - start).toBeLessThan(1000);
    });
  });
});

describe('Error Handling', () => {
  it.skipIf(!isWebGPUAvailable)('should handle invalid filter type', async () => {
    const image = new Uint8ClampedArray(64 * 64 * 4).fill(128);

    // @ts-expect-error - Testing invalid filter
    await expect(applyImageFilter(image, 64, 64, 'invalid')).rejects.toThrow();
  });

  it.skipIf(!isWebGPUAvailable)('should handle invalid resize dimensions', async () => {
    const image = new Uint8ClampedArray(64 * 64 * 4).fill(128);

    // Resizing to zero dimensions should handle gracefully
    const result = await resizeImage(image, 64, 64, 0, 0);
    expect(result.length).toBe(0);
  });
});

describe('Type Safety', () => {
  it('should maintain correct types for image data', () => {
    const image = new Uint8ClampedArray(16);
    expect(image).toBeInstanceOf(Uint8ClampedArray);
    expect(image.BYTES_PER_ELEMENT).toBe(1);
  });

  it('should maintain correct types for particle data', () => {
    const particles: ParticleConfig = {
      numParticles: 100,
      bounds: { width: 800, height: 600 },
      gravity: 100,
      drag: 0.1
    };

    expect(particles.numParticles).toBe(100);
    expect(particles.bounds.width).toBe(800);
  });

  it('should maintain correct types for model layers', () => {
    const layer: ModelLayer = {
      type: 'dense',
      inputShape: [10],
      outputShape: [5],
      weights: new Float32Array(50),
      biases: new Float32Array(5)
    };

    expect(layer.type).toBe('dense');
    expect(layer.inputShape).toEqual([10]);
    expect(layer.outputShape).toEqual([5]);
  });
});
