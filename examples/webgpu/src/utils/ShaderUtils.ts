/**
 * @lsi/webgpu-examples/utils/ShaderUtils
 *
 * WGSL shader compilation and management utilities.
 */

/**
 * Shader compilation result
 */
export interface ShaderCompileResult {
  success: boolean;
  shaderModule?: GPUShaderModule;
  compilationInfo?: GPUCompilationInfo;
  error?: string;
}

/**
 * Compile a WGSL shader module
 *
 * @param device - GPU device
 * @param code - WGSL shader code
 * @param label - Optional label for debugging
 * @returns Compilation result
 */
export function compileShader(
  device: GPUDevice,
  code: string,
  label?: string
): ShaderCompileResult {
  try {
    const shaderModule = device.createShaderModule({
      code,
      label
    });

    return {
      success: true,
      shaderModule
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get shader compilation information (errors and warnings)
 *
 * @param shaderModule - Shader module to query
 * @returns Promise resolving to compilation info
 */
export async function getCompilationInfo(
  shaderModule: GPUShaderModule
): Promise<GPUCompilationInfo> {
  return await shaderModule.getCompilationInfo();
}

/**
 * Format compilation messages as a readable string
 *
 * @param compilationInfo - Compilation info
 * @returns Formatted messages
 */
export function formatCompilationMessages(compilationInfo: GPUCompilationInfo): string {
  const messages: string[] = [];

  for (const message of compilationInfo.messages) {
    const prefix = message.type === 'error' ? 'ERROR' : 'WARNING';
    messages.push(
      `${prefix}: Line ${message.lineNum}, Column ${message.linePos}: ${message.message}`
    );
  }

  return messages.join('\n');
}

/**
 * Validate a shader module
 *
 * @param shaderModule - Shader module to validate
 * @returns Promise resolving to validation result
 */
export async function validateShader(
  shaderModule: GPUShaderModule
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const compilationInfo = await getCompilationInfo(shaderModule);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const message of compilationInfo.messages) {
    const formatted = `Line ${message.lineNum}, Col ${message.linePos}: ${message.message}`;
    if (message.type === 'error') {
      errors.push(formatted);
    } else if (message.type === 'warning') {
      warnings.push(formatted);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a compute pipeline from shader code
 *
 * @param device - GPU device
 * @param shaderCode - WGSL shader code
 * @param entryPoint - Entry point function name
 * @param label - Optional label for debugging
 * @returns Compute pipeline
 */
export function createComputePipeline(
  device: GPUDevice,
  shaderCode: string,
  entryPoint: string = 'main',
  label?: string
): GPUComputePipeline {
  const shaderModule = device.createShaderModule({
    code: shaderCode,
    label: label ? `${label}-shader` : undefined
  });

  return device.createComputePipeline({
    compute: {
      module: shaderModule,
      entryPoint
    },
    label
  });
}

/**
 * Create a basic compute shader boilerplate
 *
 * @param workgroupSize - Workgroup size (default: [64, 1, 1])
 * @param body - Shader body code
 * @returns Complete WGSL shader
 */
export function createComputeShader(
  workgroupSize: [number, number, number] = [64, 1, 1],
  body: string
): string {
  return `
@workgroup_size(${workgroupSize[0]}, ${workgroupSize[1]}, ${workgroupSize[2]})
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  ${body}
}
`.trim();
}

/**
 * Common WGSL utility functions
 */
export const WGSL_UTILS = {
  /** Convert u32 to f32 */
  u32ToF32: 'fn u32_to_f32(x: u32) -> f32 { return bitcast<f32>(x); }',

  /** Convert f32 to u32 */
  f32ToU32: 'fn f32_to_u32(x: f32) -> u32 { return bitcast<u32>(x); }',

  /** Clamp value between min and max */
  clamp: 'fn clamp_f32(x: f32, min_val: f32, max_val: f32) -> f32 { return max(min(x, max_val), min_val); }',

  /** Calculate index from 3D coordinates */
  index3D: `
fn index_3d(coord: vec3<u32>, size: vec3<u32>) -> u32 {
  return coord.x + coord.y * size.x + coord.z * size.x * size.y;
}
`,

  /** Calculate 1D index from 2D coordinates */
  index2D: `
fn index_2d(coord: vec2<u32>, width: u32) -> u32 {
  return coord.x + coord.y * width;
}
`,

  /** Reduce operation for sum */
  reduceSum: `
fn reduce_sum(local_id: u32, data: ptr<function, array<f32>>) -> f32 {
  var sum = 0.0;
  let offset = local_id;
  for (var i = 0u; i < 64u; i = i + 1u) {
    if (offset + i < arrayLength(&data)) {
      sum = sum + data[offset + i];
    }
  }
  return sum;
}
`
};

/**
 * Bind group layout entry builders
 */
export const BindGroupLayout = {
  /** Create a storage buffer entry */
  storageBuffer: (
    binding: number,
    visibility: GPUShaderStageFlags = GPUShaderStage.COMPUTE,
    readOnly: boolean = false
  ): GPUBindGroupLayoutEntry => ({
    binding,
    visibility,
    buffer: {
      type: readOnly ? 'read-only-storage' : 'storage'
    }
  }),

  /** Create a uniform buffer entry */
  uniformBuffer: (
    binding: number,
    visibility: GPUShaderStageFlags = GPUShaderStage.COMPUTE
  ): GPUBindGroupLayoutEntry => ({
    binding,
    visibility,
    buffer: {
      type: 'uniform'
    }
  }),

  /** Create a storage texture entry */
  storageTexture: (
    binding: number,
    visibility: GPUShaderStageFlags = GPUShaderStage.COMPUTE,
    access: 'write-only' | 'read-only' | 'read-write' = 'write-only',
    format: GPUTextureFormat = 'rgba8unorm'
  ): GPUBindGroupLayoutEntry => ({
    binding,
    visibility,
    texture: {
      access,
      format
    }
  }),

  /** Create a sampler entry */
  sampler: (
    binding: number,
    visibility: GPUShaderStageFlags = GPUShaderStage.COMPUTE
  ): GPUBindGroupLayoutEntry => ({
    binding,
    visibility,
    sampler: {
      type: 'filtering'
    }
  })
};

/**
 * Create a bind group from a layout and entries
 *
 * @param device - GPU device
 * @param layout - Bind group layout
 * @param entries - Bind group entries
 * @param label - Optional label
 * @returns Bind group
 */
export function createBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  entries: GPUBindGroupEntry[],
  label?: string
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    entries,
    label
  });
}
