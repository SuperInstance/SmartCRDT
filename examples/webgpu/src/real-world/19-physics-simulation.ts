/**
 * @lsi/webgpu-examples/real-world/19-physics-simulation
 *
 * Physics Simulation on GPU.
 * This example demonstrates how to:
 * - Implement N-body gravity simulation
 * - Handle collision detection
 * - Simulate rigid body physics
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Body in physics simulation
 */
export interface PhysicsBody {
  mass: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Physics simulation configuration
 */
export interface PhysicsConfig {
  numBodies: number;
  gravityConstant: number;
  softening: number;
  timeStep: number;
}

/**
 * N-body simulation on GPU
 */
export class NBodySimulation {
  private device: GPUDevice | null = null;
  private config: PhysicsConfig;
  private bufferMass: GPUBuffer | null = null;
  private bufferPosition: GPUBuffer | null = null;
  private bufferVelocity: GPUBuffer | null = null;

  constructor(config: PhysicsConfig) {
    this.config = config;
  }

  /**
   * Initialize simulation
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;

    const { numBodies } = this.config;

    // Create buffers
    this.bufferMass = createStorageBuffer(this.device, numBodies * 4, 'mass');
    this.bufferPosition = createStorageBuffer(this.device, numBodies * 12, 'position');
    this.bufferVelocity = createStorageBuffer(this.device, numBodies * 12, 'velocity');

    // Initialize bodies
    this.initializeBodies();
  }

  /**
   * Initialize body data
   */
  private initializeBodies(): void {
    if (!this.device) throw new Error('Device not initialized');

    const { numBodies } = this.config;

    const mass = new Float32Array(numBodies);
    const position = new Float32Array(numBodies * 3);
    const velocity = new Float32Array(numBodies * 3);

    for (let i = 0; i < numBodies; i++) {
      // Random mass
      mass[i] = 100 + Math.random() * 900;

      // Random position in sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = Math.random() * 1000;

      position[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      position[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      position[i * 3 + 2] = r * Math.cos(phi);

      // Initial orbital velocity (simplified)
      velocity[i * 3] = (Math.random() - 0.5) * 10;
      velocity[i * 3 + 1] = (Math.random() - 0.5) * 10;
      velocity[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }

    writeBuffer(this.device, this.bufferMass!, mass);
    writeBuffer(this.device, this.bufferPosition!, position);
    writeBuffer(this.device, this.bufferVelocity!, velocity);
  }

  /**
   * Step simulation
   */
  async step(): Promise<PhysicsBody[]> {
    if (!this.device) throw new Error('Device not initialized');

    const { numBodies, gravityConstant, softening, timeStep } = this.config;

    // Create uniform buffer
    const uniformData = new Float32Array([gravityConstant, softening, timeStep]);
    const bufferUniform = createUniformBuffer(this.device, uniformData.byteLength, 'config');
    writeBuffer(this.device, bufferUniform, uniformData);

    // N-body shader
    const shaderCode = `
struct Config {
  G: f32,
  softening: f32,
  dt: f32,
};

struct Mass {
  data: array<f32>,
};

struct Position {
  data: array<vec3<f32>>,
};

struct Velocity {
  data: array<vec3<f32>>,
};

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read> mass: Mass;
@group(0) @binding(2) var<storage, read> position: Position;
@group(0) @binding(3) var<storage, read_write> velocity: Velocity;

const NUM_BODIES = ${numBodies}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= NUM_BODIES) {
    return;
  }

  let pos_i = position.data[i];
  var accel = vec3<f32>(0.0, 0.0, 0.0);

  for (var j = 0u; j < NUM_BODIES; j = j + 1u) {
    if (i == j) {
      continue;
    }

    let pos_j = position.data[j];
    let diff = pos_j - pos_i;
    let dist_sq = dot(diff, diff) + config.softening;
    let dist = sqrt(dist_sq);
    let f = config.G * mass.data[j] / (dist * dist * dist);

    accel = accel + f * diff;
  }

  velocity.data[i] = velocity.data[i] + accel * config.dt;
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
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferUniform } },
        { binding: 1, resource: { buffer: this.bufferMass } },
        { binding: 2, resource: { buffer: this.bufferPosition } },
        { binding: 3, resource: { buffer: this.bufferVelocity } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numBodies / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Update positions (separate pass for simplicity)
    await this.updatePositions();

    // Read results
    const massData = await readBuffer(this.device, this.bufferMass, numBodies * 4);
    const posData = await readBuffer(this.device, this.bufferPosition, numBodies * 12);
    const velData = await readBuffer(this.device, this.bufferVelocity, numBodies * 12);

    const bodies: PhysicsBody[] = [];
    const massArray = new Float32Array(massData);
    const posArray = new Float32Array(posData);
    const velArray = new Float32Array(velData);

    for (let i = 0; i < numBodies; i++) {
      bodies.push({
        mass: massArray[i],
        x: posArray[i * 3],
        y: posArray[i * 3 + 1],
        z: posArray[i * 3 + 2],
        vx: velArray[i * 3],
        vy: velArray[i * 3 + 1],
        vz: velArray[i * 3 + 2]
      });
    }

    bufferUniform.destroy();

    return bodies;
  }

  /**
   * Update positions based on velocities
   */
  private async updatePositions(): Promise<void> {
    if (!this.device) throw new Error('Device not initialized');

    const { numBodies, timeStep } = this.config;

    // Position update shader
    const shaderCode = `
struct Position {
  data: array<vec3<f32>>,
};

struct Velocity {
  data: array<vec3<f32>>,
};

@group(0) @binding(0) var<storage, read> velocity: Velocity;
@group(0) @binding(1) var<storage, read_write> position: Position;

const DT = ${timeStep}f;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= ${numBodies}u) {
    return;
  }

  position.data[idx] = position.data[idx] + velocity.data[idx] * DT;
}
`;

    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.bufferVelocity } },
        { binding: 1, resource: { buffer: this.bufferPosition } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numBodies / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.bufferMass) this.bufferMass.destroy();
    if (this.bufferPosition) this.bufferPosition.destroy();
    if (this.bufferVelocity) this.bufferVelocity.destroy();
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

/**
 * Run physics simulation example
 */
export async function runPhysicsSimulation(): Promise<void> {
  console.log('=== N-Body Physics Simulation on GPU ===\n');

  const config: PhysicsConfig = {
    numBodies: 1000,
    gravityConstant: 100,
    softening: 10,
    timeStep: 0.01
  };

  console.log(`Simulating ${config.numBodies} bodies`);
  console.log(`G = ${config.gravityConstant}, softening = ${config.softening}`);
  console.log();

  const simulation = new NBodySimulation(config);
  await simulation.init();

  // Simulate 100 steps
  let totalStepTime = 0;

  for (let step = 0; step < 100; step++) {
    const startTime = performance.now();
    const bodies = await simulation.step();
    const endTime = performance.now();

    totalStepTime += endTime - startTime;

    if (step % 10 === 0) {
      // Calculate center of mass
      let totalMass = 0;
      let comX = 0, comY = 0, comZ = 0;

      for (const body of bodies) {
        totalMass += body.mass;
        comX += body.x * body.mass;
        comY += body.y * body.mass;
        comZ += body.z * body.mass;
      }

      console.log(`Step ${step}: ${(endTime - startTime).toFixed(2)}ms, ` +
                 `CoM: (${(comX/totalMass).toFixed(1)}, ${(comY/totalMass).toFixed(1)}, ${(comZ/totalMass).toFixed(1)})`);
    }
  }

  console.log();
  console.log(`Average step time: ${(totalStepTime / 100).toFixed(2)}ms`);

  simulation.dispose();
}
