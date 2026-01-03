// WebGPU API types for environments where they're not available
// This provides type definitions for WebGPU APIs

declare global {
  interface Navigator {
    readonly gpu: GPU;
  }
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
  requestAdapterInfo(): Promise<GPUAdapterInfo>;
}

interface GPUAdapterInfo {
  vendor: string;
  device: string;
}

interface GPUDevice {
  readonly features: GPUFeatureSet;
  readonly limits: GPULimits;

  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor: GPUSamplerDescriptor): GPUSampler;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
  createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet;

  queue: GPUQueue;
}

interface GPUFeatureSet {
  readonly values: Set<string>;
}

interface GPULimits {
  readonly maxBufferSize: number;
  readonly maxTextureDimension2D: number;
  readonly maxComputeWorkgroupsPerDimension: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  // Add other limits as needed
}

interface GPUBufferDescriptor {
  size: number;
  usage: GPUBufferUsageFlags;
  mappedAtCreation?: boolean;
}

interface GPUTextureDescriptor {
  size: [number, number] | [number, number, number];
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  mipLevelCount?: number;
  sampleCount?: number;
  dimension?: GPUTextureDimension;
}

interface GPUSamplerDescriptor {
  addressModeU?: GPUAddressMode;
  addressModeV?: GPUAddressMode;
  addressModeW?: GPUAddressMode;
  magFilter?: GPUMagFilter;
  minFilter?: GPUMinFilter;
  mipmapFilter?: GPUMipmapFilter;
  lodMinClamp?: number;
  lodMaxClamp?: number;
  compare?: GPUCompareFunction;
  maxAnisotropy?: number;
}

interface GPUPipelineLayoutDescriptor {
  bindGroupLayouts: GPUBindGroupLayout[];
}

interface GPUBindGroupLayout {
  label?: string;
}

interface GPUBindGroupLayoutDescriptor {
  entries: GPUBindGroupLayoutEntry[];
}

interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: GPUShaderStage;
  buffer?: GPUBufferBindingLayout;
  sampler?: GPUSamplerBindingLayout;
  texture?: GPUTextureBindingLayout;
  storageTexture?: GPUStorageTextureBindingLayout;
}

interface GPUShaderModuleDescriptor {
  code: string | Uint32Array;
}

interface GPUComputePipelineDescriptor {
  layout?: GPUPipelineLayout;
  compute: {
    module: GPUShaderModule;
    entryPoint: string;
  };
}

interface GPURenderPipelineDescriptor {
  layout?: GPUPipelineLayout;
  vertex: {
    module: GPUShaderModule;
    entryPoint: string;
    buffers?: GPUVertexBufferLayout[];
  };
  fragment?: {
    module: GPUShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  };
  primitive?: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
}

interface GPUCommandEncoderDescriptor {
  label?: string;
}

interface GPUQuerySetDescriptor {
  type: GPUQueryType;
  count: number;
  pipelineStatistics?: GPUPipelineStatisticName[];
}

// Buffer types
interface GPUBuffer {
  readonly size: number;
  readonly usage: GPUBufferUsageFlags;
  readonly mappingState: GPUMapState;

  mapAsync(mode: GPUMapMode, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
  destroy(): void;
  setSubData(offset: number, data: ArrayBufferView): void;
}

interface GPUBufferBindingLayout {
  type?: GPUBufferBindingType;
  hasDynamicOffset?: boolean;
  minBindingSize?: number;
}

interface GPUSamplerBindingLayout {
  type?: GPUSamplerBindingType;
}

interface GPUTextureBindingLayout {
  sampleType?: GPUTextureSampleType;
  viewDimension?: GPUTextureViewDimension;
  multisampled?: boolean;
}

interface GPUStorageTextureBindingLayout {
  access: GPUStorageTextureAccess;
  format: GPUTextureFormat;
  viewDimension?: GPUTextureViewDimension;
}

// Command encoder
interface GPUCommandEncoder {
  beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  copyBufferToBuffer(
    source: GPUBuffer,
    sourceOffset: number,
    destination: GPUBuffer,
    destinationOffset: number,
    size: number
  ): void;
  copyBufferToTexture(
    source: GPUImageCopyBuffer,
    destination: GPUImageCopyTexture,
    copySize: [number, number, number]
  ): void;
  copyTextureToBuffer(
    source: GPUImageCopyTexture,
    destination: GPUImageCopyBuffer,
    copySize: [number, number, number]
  ): void;
  copyTextureToTexture(
    source: GPUImageCopyTexture,
    destination: GPUImageCopyTexture,
    copySize: [number, number, number]
  ): void;
  finish(descriptor?: GPUCommandBufferDescriptor): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: Uint32Array): void;
  pushDebugGroup(groupLabel: string): void;
  popDebugGroup(): void;
  insertDebugMarker(markerLabel: string): void;
  dispatch(x: number, y?: number, z?: number): void;
  dispatchIndirect(indirectBuffer: GPUBuffer, indirectOffset: number): void;
  end(): void;
}

interface GPURenderPassEncoder {
  // Add render pass methods as needed
}

interface GPUCommandBuffer {
  readonly label: string | null;
}

// Queue
interface GPUQueue {
  submit(commandBuffers: Iterable<GPUCommandBuffer>): void;
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: ArrayBufferView, dataOffset?: number, size?: number): void;
  writeTexture(
    destination: GPUImageCopyTexture,
    data: ArrayBufferView,
    dataLayout: GPUImageDataLayout,
    size: [number, number, number]
  ): void;
  onSubmittedWorkDone(): Promise<void>;
}

// Enums and constants
export const enum GPUBufferUsage {
  MAP_READ = 0x0001,
  MAP_WRITE = 0x0002,
  COPY_SRC = 0x0004,
  COPY_DST = 0x0008,
  INDEX = 0x0010,
  VERTEX = 0x0020,
  UNIFORM = 0x0040,
  STORAGE = 0x0080,
  INDIRECT = 0x0100,
  QUERY_RESOLVE = 0x0200,
}

export const enum GPUTextureUsage {
  COPY_SRC = 0x01,
  COPY_DST = 0x02,
  TEXTURE_BINDING = 0x04,
  STORAGE_BINDING = 0x08,
  RENDER_ATTACHMENT = 0x10,
}

export const enum GPUMapMode {
  READ = 0x0001,
  WRITE = 0x0002,
}

export const enum GPUShaderStage {
  VERTEX = 0x1,
  FRAGMENT = 0x2,
  COMPUTE = 0x4,
}

export const enum GPUAddressMode {
  CLAMP_TO_EDGE = "clamp-to-edge",
  REPEAT = "repeat",
  MIRROR_REPEAT = "mirror-repeat",
}

export const enum GPUMagFilter {
  NEAREST = "nearest",
  LINEAR = "linear",
}

export const enum GPUMinFilter {
  NEAREST = "nearest",
  LINEAR = "linear",
}

export const enum GPUMipmapFilter {
  NEAREST = "nearest",
  LINEAR = "linear",
}

export const enum GPUCompareFunction {
  NEVER = "never",
  LESS = "less",
  EQUAL = "equal",
  LESS_EQUAL = "less-equal",
  GREATER = "greater",
  NOT_EQUAL = "not-equal",
  GREATER_EQUAL = "greater-equal",
  ALWAYS = "always",
}

export const enum GPUTextureFormat {
  R8UNORM = "r8unorm",
  R8SNORM = "r8snorm",
  R8UINT = "r8uint",
  R8SINT = "r8sint",
  R16UINT = "r16uint",
  R16SINT = "r16sint",
  R16FLOAT = "r16float",
  RG8UNORM = "rg8unorm",
  RG8SNORM = "rg8snorm",
  RG8UINT = "rg8uint",
  RG8SINT = "rg8sint",
  R32UINT = "r32uint",
  R32SINT = "r32sint",
  R32FLOAT = "r32float",
  RG16UINT = "rg16uint",
  RG16SINT = "rg16sint",
  RG16FLOAT = "rg16float",
  RGBA8UNORM = "rgba8unorm",
  RGBA8UNORMSRGB = "rgba8unorm-srgb",
  RGBA8SNORM = "rgba8snorm",
  RGBA8UINT = "rgba8uint",
  RGBA8SINT = "rgba8sint",
  BGRA8UNORM = "bgra8unorm",
  BGRA8UNORMSRGB = "bgra8unorm-srgb",
  RGB10A2UNORM = "rgb10a2unorm",
  RG11B10UFLOAT = "rg11b10ufloat",
  RGB9E5UFLOAT = "rgb9e5ufloat",
  RG32UINT = "rg32uint",
  RG32SINT = "rg32sint",
  RG32FLOAT = "rg32float",
  RGBA16UINT = "rgba16uint",
  RGBA16SINT = "rgba16sint",
  RGBA16FLOAT = "rgba16float",
  RGBA32UINT = "rgba32uint",
  RGBA32SINT = "rgba32sint",
  RGBA32FLOAT = "rgba32float",
  // Additional formats as needed
}

export const enum GPUTextureDimension {
  "1d" = "1d",
  "2d" = "2d",
  "3d" = "3d",
}

export const enum GPUTextureViewDimension {
  "1d" = "1d",
  "2d" = "2d",
  "2d-array" = "2d-array",
  "cube" = "cube",
  "cube-array" = "cube-array",
  "3d" = "3d",
}

export const enum GPUBufferBindingType {
  "uniform" = "uniform",
  "storage" = "storage",
  "read-only-storage" = "read-only-storage",
}

export const enum GPUSamplerBindingType {
  "filtering" = "filtering",
  "non-filtering" = "non-filtering",
  "comparison" = "comparison",
}

export const enum GPUTextureSampleType {
  "float" = "float",
  "unfilterable-float" = "unfilterable-float",
  "depth" = "depth",
  "sint" = "sint",
  "uint" = "uint",
}

export const enum GPUStorageTextureAccess {
  "write-only" = "write-only",
  "read-only" = "read-only",
  "read-write" = "read-write",
}

export const enum GPUMapState {
  "unmapped" = "unmapped",
  "pending" = "pending",
  "mapped" = "mapped",
}

export const enum GPUPrimitiveTopology {
  "point-list" = "point-list",
  "line-list" = "line-list",
  "line-strip" = "line-strip",
  "triangle-list" = "triangle-list",
  "triangle-strip" = "triangle-strip",
}

export const enum GPUIndexFormat {
  "uint16" = "uint16",
  "uint32" = "uint32",
}

export const enum GPUInputStepMode {
  "vertex" = "vertex",
  "instance" = "instance",
}

export const enum GPUStencilOperation {
  "keep" = "keep",
  "zero" = "zero",
  "replace" = "replace",
  "invert" = "invert",
  "increment-clamp" = "increment-clamp",
  "decrement-clamp" = "decrement-clamp",
  "increment-wrap" = "increment-wrap",
  "decrement-wrap" = "decrement-wrap",
}

export const enum GPUCompareFunction {
  "never" = "never",
  "less" = "less",
  "equal" = "equal",
  "less-equal" = "less-equal",
  "greater" = "greater",
  "not-equal" = "not-equal",
  "greater-equal" = "greater-equal",
  "always" = "always",
}

export const enum GPUVertexFormat {
  "uint8x2" = "uint8x2",
  "uint8x4" = "uint8x4",
  "sint8x2" = "sint8x2",
  "sint8x4" = "sint8x4",
  "unorm8x2" = "unorm8x2",
  "unorm8x4" = "unorm8x4",
  "snorm8x2" = "snorm8x2",
  "snorm8x4" = "snorm8x4",
  "uint16x2" = "uint16x2",
  "uint16x4" = "uint16x4",
  "sint16x2" = "sint16x2",
  "sint16x4" = "sint16x4",
  "unorm16x2" = "unorm16x2",
  "unorm16x4" = "unorm16x4",
  "snorm16x2" = "snorm16x4",
  "snorm16x4" = "snorm16x4",
  "float16x2" = "float16x2",
  "float16x4" = "float16x4",
  "float32" = "float32",
  "float32x2" = "float32x2",
  "float32x3" = "float32x3",
  "float32x4" = "float32x4",
  "uint32" = "uint32",
  "uint32x2" = "uint32x2",
  "uint32x3" = "uint32x3",
  "uint32x4" = "uint32x4",
  "sint32" = "sint32",
  "sint32x2" = "sint32x2",
  "sint32x3" = "sint32x3",
  "sint32x4" = "sint32x4",
}

export const enum GPUQueryType {
  "occlusion" = "occlusion",
  "timestamp" = "timestamp",
}

export const enum GPUPipelineStatisticName {
  "vertex-shader-invocations" = "vertex-shader-invocations",
  "clipper-invocations" = "clipper-invocations",
  "clipper-primitives-out" = "clipper-primitives-out",
  "fragment-shader-invocations" = "fragment-shader-invocations",
  "compute-shader-invocations" = "compute-shader-invocations",
}

// Type aliases for compatibility
export type GPUBufferUsageFlags = number;
export type GPUTextureUsageFlags = number;
export type GPUAddressMode = GPUAddressMode;
export type GPUMagFilter = GPUMagFilter;
export type GPUMinFilter = GPUMinFilter;
export type GPUMipmapFilter = GPUMipmapFilter;
export type GPUCompareFunction = GPUCompareFunction;
export type GPUTextureFormat = GPUTextureFormat;
export type GPUTextureDimension = GPUTextureDimension;
export type GPUTextureViewDimension = GPUTextureViewDimension;
export type GPUBufferBindingType = GPUBufferBindingType;
export type GPUSamplerBindingType = GPUSamplerBindingType;
export type GPUTextureSampleType = GPUTextureSampleType;
export type GPUStorageTextureAccess = GPUStorageTextureAccess;
export type GPUMapMode = GPUMapMode;
export type GPUShaderStage = GPUShaderStage;
export type GPUPrimitiveState = any;
export type GPUDepthStencilState = any;
export type GPUColorTargetState = any;
export type GPUVertexBufferLayout = any;
export type GPUImageCopyBuffer = any;
export type GPUImageCopyTexture = any;
export type GPUCommandBufferDescriptor = any;
export type GPUComputePassDescriptor = any;
export type GPURenderPassDescriptor = any;
export type GPUImageDataLayout = any;
export type GPUPipelineStatisticName = GPUPipelineStatisticName;