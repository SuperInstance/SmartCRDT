/**
 * @lsi/webgpu-examples/real-world/18-particle-simulation
 *
 * Particle System Simulation on GPU.
 * This example demonstrates how to:
 * - Simulate particle physics on GPU
 * - Handle particle updates in parallel
 * - Render particle positions
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Particle data structure
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Particle simulation configuration
 */
export interface ParticleConfig {
  numParticles: number;
  bounds: { width: number; height: number };
  gravity: number;
  drag: number;
}

/**
 * Particle system on GPU
 */
export class GPUParticleSystem {
  private device: GPUDevice | null = null;
  private config: ParticleConfig;
  private bufferPositions: GPUBuffer | null = null;
  private bufferVelocities: GPUBuffer | null = null;
  private bufferLife: GPUBuffer | null = null;

  constructor(config: ParticleConfig) {
    this.config = config;
  }

  /**
   * Initialize particle system
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;

    const { numParticles } = this.config;

    // Create buffers
    this.bufferPositions = createStorageBuffer(this.device, numParticles * 8, 'positions');
    this.bufferVelocities = createStorageBuffer(this.device, numParticles * 8, 'velocities');
    this.bufferLife = createStorageBuffer(this.device, numParticles * 4, 'life');

    // Initialize particles
    this.initializeParticles();
  }

  /**
   * Initialize particle data
   */
  private initializeParticles(): void {
    if (!this.device) throw new Error('Device not initialized');

    const { numParticles, bounds } = this.config;

    // Create initial positions (center of screen)
    const positions = new Float32Array(numParticles * 2);
    const velocities = new Float32Array(numParticles * 2);
    const life = new Float32Array(numParticles);

    for (let i = 0; i < numParticles; i++) {
      // Start at center with random offset
      positions[i * 2] = bounds.width / 2 + (Math.random() - 0.5) * 50;
      positions[i * 2 + 1] = bounds.height / 2 + (Math.random() - 0.5) * 50;

      // Random velocity
      velocities[i * 2] = (Math.random() - 0.5) * 200;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 200;

      // Random life
      life[i] = Math.random();
    }

    writeBuffer(this.device, this.bufferPositions!, positions);
    writeBuffer(this.device, this.bufferVelocities!, velocities);
    writeBuffer(this.device, this.bufferLife!, life);
  }

  /**
   * Update particles
   *
   * @param deltaTime - Time step in seconds
   */
  async update(deltaTime: number): Promise<Particle[]> {
    if (!this.device) throw new Error('Device not initialized');

    const { numParticles, bounds, gravity, drag } = this.config;

    // Create uniform buffer with config
    const uniformData = new Float32Array([
      deltaTime,
      bounds.width,
      bounds.height,
      gravity,
      drag
    ]);
    const bufferUniform = createUniformBuffer(this.device, uniformData.byteLength, 'config');
    writeBuffer(this.device, bufferUniform, uniformData);

    // Update shader
    const shaderCode = `
struct Config {
  delta_time: f32,
  bounds_width: f32,
  bounds_height: f32,
  gravity: f32,
  drag: f32,
};

struct Positions {
  data: array<vec2<f32>>,
};

struct Velocities {
  data: array<vec2<f32>>,
};

struct Life {
  data: array<f32>,
};

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read_write> positions: Positions;
@group(0) @binding(2) var<storage, read_write> velocities: Velocities;
@group(0) @binding(3) var<storage, read_write> life: Life;

const NUM_PARTICLES = ${numParticles}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= NUM_PARTICLES) {
    return;
  }

  // Update life
  life.data[idx] = life.data[idx] - config.delta_time;

  // Respawn if dead
  if (life.data[idx] <= 0.0) {
    life.data[idx] = 1.0;
    positions.data[idx] = vec2<f32>(config.bounds_width * 0.5, config.bounds_height * 0.5);
    velocities.data[idx] = vec2<f32>(
      (f32(idx) * 1234.5) - 500.0,
      (f32(idx) * 5678.9) - 500.0
    );
    return;
  }

  // Apply gravity
  velocities.data[idx].y = velocities.data[idx].y + config.gravity * config.delta_time;

  // Apply drag
  velocities.data[idx] = velocities.data[idx] * (1.0 - config.drag * config.delta_time);

  // Update position
  positions.data[idx] = positions.data[idx] + velocities.data[idx] * config.delta_time;

  // Bounce off walls
  if (positions.data[idx].x < 0.0) {
    positions.data[idx].x = 0.0;
    velocities.data[idx].x = -velocities.data[idx].x * 0.8;
  }
  if (positions.data[idx].x > config.bounds_width) {
    positions.data[idx].x = config.bounds_width;
    velocities.data[idx].x = -velocities.data[idx].x * 0.8;
  }
  if (positions.data[idx].y < 0.0) {
    positions.data[idx].y = 0.0;
    velocities.data[idx].y = -velocities.data[idx].y * 0.8;
  }
  if (positions.data[idx].y > config.bounds_height) {
    positions.data[idx].y = config.bounds_height;
    velocities.data[idx].y = -velocities.data[idx].y * 0.8;
  }
}
`;

    // Create and dispatch
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferUniform } },
        { binding: 1, resource: { buffer: this.bufferPositions } },
        { binding: 2, resource: { buffer: this.bufferVelocities } },
        { binding: 3, resource: { buffer: this.bufferLife } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numParticles / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read results
    const posData = await readBuffer(this.device, this.bufferPositions, numParticles * 8);
    const velData = await readBuffer(this.device, this.bufferVelocities, numParticles * 8);
    const lifeData = await readBuffer(this.device, this.bufferLife, numParticles * 4);

    const positions = new Float32Array(posData);
    const velocities = new Float32Array(velData);
    const life = new Float32Array(lifeData);

    // Convert to Particle array
    const particles: Particle[] = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: positions[i * 2],
        y: positions[i * 2 + 1],
        vx: velocities[i * 2],
        vy: velocities[i * 2 + 1],
        life: life[i]
      });
    }

    // Clean up uniform buffer
    bufferUniform.destroy();

    return particles;
  }

  /**
   * Get current particle positions
   */
  async getPositions(): Promise<Float32Array> {
    if (!this.device || !this.bufferPositions) throw new Error('Not initialized');

    const data = await readBuffer(this.device, this.bufferPositions, this.config.numParticles * 8);
    return new Float32Array(data);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.bufferPositions) this.bufferPositions.destroy();
    if (this.bufferVelocities) this.bufferVelocities.destroy();
    if (this.bufferLife) this.bufferLife.destroy();
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

/**
 * Run particle simulation example
 */
export async function runParticleSimulation(): Promise<void> {
  console.log('=== Particle Simulation on GPU ===\n');

  const config: ParticleConfig = {
    numParticles: 10000,
    bounds: { width: 1920, height: 1080 },
    gravity: 500,
    drag: 0.5
  };

  console.log(`Simulating ${config.numParticles} particles`);
  console.log(`Canvas: ${config.bounds.width}x${config.bounds.height}`);
  console.log();

  const system = new GPUParticleSystem(config);
  await system.init();

  // Simulate 60 frames
  const deltaTime = 1 / 60;
  let totalUpdateTime = 0;

  for (let frame = 0; frame < 60; frame++) {
    const startTime = performance.now();
    const particles = await system.update(deltaTime);
    const endTime = performance.now();

    totalUpdateTime += endTime - startTime;

    if (frame % 10 === 0) {
      const avgLife = particles.reduce((sum, p) => sum + p.life, 0) / particles.length;
      console.log(`Frame ${frame}: ${(endTime - startTime).toFixed(2)}ms, avg life: ${avgLife.toFixed(3)}`);
    }
  }

  console.log();
  console.log(`Average update time: ${(totalUpdateTime / 60).toFixed(2)}ms`);
  console.log(`Target: <16ms for 60fps`);

  system.dispose();
}
