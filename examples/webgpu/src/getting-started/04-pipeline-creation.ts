/**
 * @lsi/webgpu-examples/getting-started/04-pipeline-creation
 *
 * Pipeline Creation - Creating compute pipelines with different configurations.
 * This example demonstrates how to:
 * - Create basic compute pipelines
 * - Create pipelines with custom layouts
 * - Reuse pipelines
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createComputePipeline, BindGroupLayout, createBindGroup } from '../utils/ShaderUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Pipeline creation example
 */
export async function pipelineCreation(): Promise<{
  basicPipeline: boolean;
  customLayoutPipeline: boolean;
  pipelineReuse: boolean;
}> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  let basicPipeline = false;
  let customLayoutPipeline = false;
  let pipelineReuse = false;

  try {
    // 1. Create basic pipeline
    const basicShader = `
      @group(0) @binding(0) var<storage, read> input: array<f32>;
      @group(0) @binding(1) var<storage, read_write> output: array<f32>;

      @workgroup_size(64)
      @compute
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        output[index] = input[index] * 2.0;
      }
    `;

    const basicPipelineObj = createComputePipeline(device, basicShader, 'main', 'basic-pipeline');
    basicPipeline = true;
    console.log('Basic pipeline created successfully');

    // 2. Create pipeline with custom layout
    const customShader = `
      struct Uniforms {
        multiplier: f32,
      };

      struct StorageArray {
        data: array<f32>,
      };

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> input: StorageArray;
      @group(0) @binding(2) var<storage, read_write> output: StorageArray;

      @workgroup_size(64)
      @compute
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        output.data[index] = input.data[index] * uniforms.multiplier;
      }
    `;

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        BindGroupLayout.uniformBuffer(0),
        BindGroupLayout.storageBuffer(1, GPUShaderStage.COMPUTE, true),
        BindGroupLayout.storageBuffer(2, GPUShaderStage.COMPUTE, false)
      ]
    });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const customPipeline = device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({ code: customShader }),
        entryPoint: 'main'
      }
    });
    customLayoutPipeline = true;
    console.log('Custom layout pipeline created successfully');

    // 3. Test pipeline reuse
    const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const inputBuffer = createStorageBuffer(device, input.byteLength);
    const outputBuffer = createStorageBuffer(device, input.byteLength);

    writeBuffer(device, inputBuffer, input);

    // Create uniform buffer with multiplier
    const uniformData = new Float32Array([3.0]);
    const uniformBuffer = createUniformBuffer(device, uniformData.byteLength);
    writeBuffer(device, uniformBuffer, uniformData);

    // Create bind group
    const bindGroup = createBindGroup(
      device,
      bindGroupLayout,
      [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: inputBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } }
      ]
    );

    // Dispatch
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(customPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(input.length / 64));
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    // Read results
    const outputData = await readBuffer(device, outputBuffer, input.byteLength);
    const outputArray = new Float32Array(outputData);

    console.log('Pipeline reuse test output:', outputArray);
    pipelineReuse = true;

    // Clean up
    inputBuffer.destroy();
    outputBuffer.destroy();
    uniformBuffer.destroy();
  } finally {
    disposeWebGPU(device);
  }

  return { basicPipeline, customLayoutPipeline, pipelineReuse };
}

/**
 * Run pipeline creation example
 */
export async function runPipelineCreation(): Promise<void> {
  const results = await pipelineCreation();

  console.log('\n=== Pipeline Creation Results ===');
  console.log('Basic Pipeline:', results.basicPipeline);
  console.log('Custom Layout Pipeline:', results.customLayoutPipeline);
  console.log('Pipeline Reuse:', results.pipelineReuse);
}
