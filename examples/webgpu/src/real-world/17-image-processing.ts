/**
 * @lsi/webgpu-examples/real-world/17-image-processing
 *
 * Image Processing on GPU.
 * This example demonstrates how to:
 * - Apply image filters using compute shaders
 * - Process images in parallel
 * - Implement common image operations
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Image filter types
 */
export type ImageFilter = 'grayscale' | 'blur' | 'sharpen' | 'edge-detect' | 'invert';

/**
 * Apply image filter on GPU
 *
 * @param image - Image data (width x height x 4 RGBA)
 * @param width - Image width
 * @param height - Image height
 * @param filter - Filter type
 * @returns Filtered image
 */
export async function applyImageFilter(
  image: Uint8ClampedArray,
  width: number,
  height: number,
  filter: ImageFilter
): Promise<Uint8ClampedArray> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const pixelCount = width * height;

  // Create buffers
  const bufferInput = createStorageBuffer(device, image.byteLength, 'input');
  const bufferOutput = createStorageBuffer(device, image.byteLength, 'output');

  writeBuffer(device, bufferInput, image);

  // Get filter kernel
  const kernel = getFilterKernel(filter);
  const kernelSize = kernel.length;
  const kernelRadius = Math.floor(Math.sqrt(kernelSize) / 2);

  // Create filter shader
  const shaderCode = createImageFilterShader(width, height, kernel, filter);

  // Create and dispatch
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferOutput } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(pixelCount / 256));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read output
  const outputData = await readBuffer(device, bufferOutput, image.byteLength);
  const output = new Uint8ClampedArray(outputData);

  // Clean up
  bufferInput.destroy();
  bufferOutput.destroy();
  disposeWebGPU(device);

  return output;
}

/**
 * Get filter kernel
 */
function getFilterKernel(filter: ImageFilter): Float32Array {
  switch (filter) {
    case 'grayscale':
      return new Float32Array([
        0.299, 0.587, 0.114, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 1
      ]);
    case 'blur':
      // 3x3 Gaussian blur
      const gaussian = 1 / 16;
      return new Float32Array([
        gaussian, gaussian * 2, gaussian,
        gaussian * 2, gaussian * 4, gaussian * 2,
        gaussian, gaussian * 2, gaussian
      ]);
    case 'sharpen':
      return new Float32Array([
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ]);
    case 'edge-detect':
      return new Float32Array([
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1
      ]);
    case 'invert':
      return new Float32Array([-1]);
    default:
      return new Float32Array([1]);
  }
}

/**
 * Create image filter shader
 */
function createImageFilterShader(
  width: number,
  height: number,
  kernel: Float32Array,
  filter: ImageFilter
): string {
  const kernelSize = kernel.length;
  const kernelRadius = Math.floor(Math.sqrt(kernelSize) / 2);

  const kernelArray = Array.from(kernel).map(v => v.toFixed(6));

  let shaderCode = '';

  if (filter === 'grayscale') {
    shaderCode = `
struct ImageData {
  data: array<u32>, // Packed RGBA
};

@group(0) @binding(0) var<storage, read> input: ImageData;
@group(0) @binding(1) var<storage, read_write> output: ImageData;

const WIDTH = ${width}u;
const HEIGHT = ${height}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= WIDTH * HEIGHT) {
    return;
  }

  let pixel = input.data[idx];
  let r = f32((pixel >> 0u) & 0xFFu);
  let g = f32((pixel >> 8u) & 0xFFu);
  let b = f32((pixel >> 16u) & 0xFFu);

  let gray = u32(0.299 * r + 0.587 * g + 0.114 * b);

  output.data[idx] = (0xFFu << 24u) | (gray << 16u) | (gray << 8u) | gray;
}
`;
  } else if (filter === 'invert') {
    shaderCode = `
struct ImageData {
  data: array<u32>,
};

@group(0) @binding(0) var<storage, read> input: ImageData;
@group(0) @binding(1) var<storage, read_write> output: ImageData;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= ${width * height}u) {
    return;
  }

  let pixel = input.data[idx];
  let r = 255u - ((pixel >> 0u) & 0xFFu);
  let g = 255u - ((pixel >> 8u) & 0xFFu);
  let b = 255u - ((pixel >> 16u) & 0xFFu);
  let a = (pixel >> 24u) & 0xFFu;

  output.data[idx] = (a << 24u) | (b << 16u) | (g << 8u) | r;
}
`;
  } else {
    // Convolution-based filters
    shaderCode = `
struct ImageData {
  data: array<u32>,
};

const KERNEL: array<f32, ${kernelSize}> = array<f32, ${kernelSize}>(${kernelArray.map(v => v + 'f').join(', ')});

@group(0) @binding(0) var<storage, read> input: ImageData;
@group(0) @binding(1) var<storage, read_write> output: ImageData;

const WIDTH = ${width}u;
const HEIGHT = ${height}u;
const RADIUS = ${kernelRadius}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= WIDTH * HEIGHT) {
    return;
  }

  let x = idx % WIDTH;
  let y = idx / WIDTH;

  var sum_r = 0.0;
  var sum_g = 0.0;
  var sum_b = 0.0;

  for (var ky = 0i; ky < ${Math.sqrt(kernelSize)}i; ky = ky + 1) {
    for (var kx = 0i; kx < ${Math.sqrt(kernelSize)}i; kx = kx + 1) {
      let px = i32(x) + (kx - i32(RADIUS));
      let py = i32(y) + (ky - i32(RADIUS));

      px = clamp(px, 0, i32(WIDTH) - 1);
      py = clamp(py, 0, i32(HEIGHT) - 1);

      let pidx = u32(py) * WIDTH + u32(px);
      let pixel = input.data[pidx];

      let k = f32(ky * ${Math.sqrt(kernelSize)}i + kx);
      let r = f32((pixel >> 0u) & 0xFFu);
      let g = f32((pixel >> 8u) & 0xFFu);
      let b = f32((pixel >> 16u) & 0xFFu);

      sum_r = sum_r + r * KERNEL[k];
      sum_g = sum_g + g * KERNEL[k];
      sum_b = sum_b + b * KERNEL[k];
    }
  }

  let r = u32(clamp(sum_r, 0.0, 255.0));
  let g = u32(clamp(sum_g, 0.0, 255.0));
  let b = u32(clamp(sum_b, 0.0, 255.0));

  output.data[idx] = (0xFFu << 24u) | (b << 16u) | (g << 8u) | r;
}
`;
  }

  return shaderCode;
}

/**
 * Resize image using GPU
 */
export async function resizeImage(
  image: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Promise<Uint8ClampedArray> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const bufferInput = createStorageBuffer(device, image.byteLength, 'input');
  const bufferOutput = createStorageBuffer(device, dstWidth * dstHeight * 4, 'output');

  writeBuffer(device, bufferInput, image);

  // Bilinear interpolation shader
  const shaderCode = `
struct ImageData {
  data: array<u32>,
};

@group(0) @binding(0) var<storage, read> input: ImageData;
@group(0) @binding(1) var<storage, read_write> output: ImageData;

const SRC_WIDTH = ${srcWidth}u;
const SRC_HEIGHT = ${srcHeight}u;
const DST_WIDTH = ${dstWidth}u;
const DST_HEIGHT = ${dstHeight}u;

fn get_pixel(x: u32, y: u32) -> vec4<f32> {
  let idx = y * SRC_WIDTH + x;
  let pixel = input.data[idx];
  return vec4<f32>(
    f32((pixel >> 0u) & 0xFFu),
    f32((pixel >> 8u) & 0xFFu),
    f32((pixel >> 16u) & 0xFFu),
    f32((pixel >> 24u) & 0xFFu)
  );
}

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= DST_WIDTH * DST_HEIGHT) {
    return;
  }

  let dst_x = idx % DST_WIDTH;
  let dst_y = idx / DST_WIDTH;

  let src_x = f32(dst_x) * (f32(SRC_WIDTH) / f32(DST_WIDTH));
  let src_y = f32(dst_y) * (f32(SRC_HEIGHT) / f32(DST_HEIGHT));

  let x0 = u32(src_x);
  let y0 = u32(src_y);
  let x1 = min(x0 + 1u, SRC_WIDTH - 1u);
  let y1 = min(y0 + 1u, SRC_HEIGHT - 1u);

  let fx = src_x - f32(x0);
  let fy = src_y - f32(y0);

  let c00 = get_pixel(x0, y0);
  let c10 = get_pixel(x1, y0);
  let c01 = get_pixel(x0, y1);
  let c11 = get_pixel(x1, y1);

  let c0 = mix(c00, c10, fx);
  let c1 = mix(c01, c11, fx);
  let c = mix(c0, c1, fy);

  output.data[idx] = (u32(c.a) << 24u) | (u32(c.b) << 16u) | (u32(c.g) << 8u) | u32(c.r);
}
`;

  // Create and dispatch
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferOutput } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(dstWidth * dstHeight / 256));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read output
  const outputData = await readBuffer(device, bufferOutput, dstWidth * dstHeight * 4);
  const output = new Uint8ClampedArray(outputData);

  // Clean up
  bufferInput.destroy();
  bufferOutput.destroy();
  disposeWebGPU(device);

  return output;
}

/**
 * Run image processing example
 */
export async function runImageProcessing(): Promise<void> {
  console.log('=== Image Processing on GPU ===\n');

  // Create sample image (64x64 RGBA)
  const width = 64;
  const height = 64;
  const image = new Uint8ClampedArray(width * height * 4);

  // Create a simple pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      image[idx] = (x * 4) % 256; // R
      image[idx + 1] = (y * 4) % 256; // G
      image[idx + 2] = 128; // B
      image[idx + 3] = 255; // A
    }
  }

  console.log(`Original image: ${width}x${height}`);

  // Apply filters
  const filters: ImageFilter[] = ['grayscale', 'invert', 'blur'];

  for (const filter of filters) {
    const startTime = performance.now();
    const filtered = await applyImageFilter(image, width, height, filter);
    const endTime = performance.now();

    console.log(`${filter}: ${(endTime - startTime).toFixed(2)}ms`);
  }

  // Test resize
  console.log('\nResizing to 128x128...');
  const startTime = performance.now();
  const resized = await resizeImage(image, width, height, 128, 128);
  const endTime = performance.now();
  console.log(`Resized in ${(endTime - startTime).toFixed(2)}ms`);
}
