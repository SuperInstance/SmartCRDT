/**
 * GPU Device Manager for WebGPU/WebGL Compute
 *
 * Provides GPU device detection, initialization, and memory management
 * with fallback support for when GPU compute is unavailable.
 *
 * @packageDocumentation
 */


/**
 * GPU backend type
 */
export type GPUBackend = "webgpu" | "webgl2" | "webgl" | "cpu";

/**
 * WebGPU interface types
 */
interface WebGPUBuffer {
  readonly size: number;
  readonly usage: number;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
  setSubData(offset: number, data: ArrayBufferView): void;
  destroy?(): void;
}

interface WebGPUTexture {
  destroy?(): void;
}

interface GPUDevice {
  createBuffer(descriptor: { size: number; usage: number }): WebGPUBuffer;
  createTexture(descriptor: { size: [number, number] | [number, number, number]; format: string; usage: number }): WebGPUTexture;
  createShaderModule(descriptor: { code: string | Uint32Array }): any;
  createComputePipeline(descriptor: { layout?: any; compute: { module: any; entryPoint: string } }): any;
  createRenderPipeline(descriptor: any): any;
  createCommandEncoder(): any;
  createBindGroupLayout(descriptor: { entries: any[] }): any;
  createPipelineLayout(descriptor: { bindGroupLayouts: any[] }): any;
  createBindGroup(descriptor: { layout: any; entries: any[] }): any;
  createSampler(descriptor?: any): any;
  createQuerySet(descriptor: { type: string; count: number }): any;
  queue: {
    submit(commandBuffers: any[]): void;
    writeBuffer(buffer: WebGPUBuffer, bufferOffset: number, data: ArrayBufferView, dataOffset?: number, size?: number): void;
  };
  readonly features: any;
  readonly limits: any;
}

interface GPUCommandEncoder {
  encoder?: any;
  beginComputePass?(descriptor?: any): any;
  beginRenderPass(descriptor: any): any;
  copyBufferToBuffer(source: WebGPUBuffer, sourceOffset: number, destination: WebGPUBuffer, destinationOffset: number, size: number): void;
  finish(descriptor?: any): any;
}

interface GPUBindGroupLayout {
  label?: string;
}

// Re-export enums from the local definitions
export const enum GPUShaderStage {
  VERTEX = 0x1,
  FRAGMENT = 0x2,
  COMPUTE = 0x4,
}

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
  COPY_SRC = 0x0001,
  COPY_DST = 0x0002,
  SAMPLED = 0x0004,
  STORAGE = 0x0008,
  RENDER_ATTACHMENT = 0x0010,
  INPUT_ATTACHMENT = 0x0020,
  UNINITIALIZED = 0x0040,
}

export const enum GPUMapMode {
  READ = 0x0001,
  WRITE = 0x0002,
}

/**
 * Buffer usage flags
 */
export enum BufferUsage {
  Storage = 1,
  Uniform = 2,
  Vertex = 4,
  Index = 8,
  CopySrc = 16,
  CopyDst = 32,
  MapRead = 64,
  MapWrite = 128,
}

/**
 * Texture format
 */
export enum TextureFormat {
  RGBA8Unorm = "rgba8unorm",
  RGBA32Float = "rgba32float",
  RG32Float = "rg32float",
  R32Float = "r32float",
}

/**
 * GPU configuration options
 */
export interface GPUConfig {
  preferred_backend: GPUBackend;
  fallback_enabled: boolean;
  memory_limit: number; // in bytes
  compute_mode: "float32" | "float16";
  enable_profiling: boolean;
}

/**
 * GPU device information
 */
export interface GPUInfo {
  backend: GPUBackend;
  vendor: string;
  device: string;
  memory: number; // in bytes
  features: string[];
  limits: GPULimits;
}

/**
 * GPU device limits
 */
export interface GPULimits {
  maxBufferSize: number;
  maxTextureSize: number;
  maxComputeWorkgroupsPerDimension: number;
  maxInvocationsPerWorkgroup: number;
}

/**
 * GPU features
 */
export interface GPUFeatures {
  timestampQuery: boolean;
  pipelineStatisticsQuery: boolean;
  float16: boolean;
  bgra8UnormStorage: boolean;
}

/**
 * Memory allocation tracking
 */
interface MemoryAllocation {
  buffer: GPUBuffer | WebGLBuffer | null;
  size: number;
  usage: BufferUsage;
  createdAt: number;
}

/**
 * GPU buffer wrapper
 */
export class GPUBuffer {
  constructor(
    public buffer: GPUBuffer | WebGLBuffer | null,
    public size: number,
    public usage: BufferUsage,
    public device: GPUDeviceManager
  ) {}

  /**
   * Write data to buffer
   */
  async write(data: Float32Array | Uint8Array): Promise<void> {
    if (!this.buffer) {
      throw new Error("Buffer is null (CPU fallback)");
    }

    const device = this.device;
    if (this.device?.getInternalBackend() === "webgpu" && this.buffer && !(this.buffer instanceof WebGLBuffer)) {
      // Cast to WebGPU buffer
      const webgpuBuffer = this.buffer as unknown as WebGPUBuffer;
      webgpuBuffer.setSubData(0, data);
    } else if (device.getInternalBackend().startsWith("webgl")) {
      // WebGL buffer write
      device.glBindBuffer(BufferUsage.CopyDst, this.buffer as WebGLBuffer);
      device.glBufferSubData(BufferUsage.CopyDst, 0, data);
    }
  }

  /**
   * Read data from buffer
   */
  async read(): Promise<Float32Array> {
    if (!this.buffer) {
      throw new Error("Buffer is null (CPU fallback)");
    }

    const device = this.device;
    if (this.device?.getInternalBackend() === "webgpu" && this.buffer && !(this.buffer instanceof WebGLBuffer)) {
      // Map buffer for reading
      const webgpuBuffer = this.buffer as unknown as WebGPUBuffer;
      await webgpuBuffer.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(webgpuBuffer.getMappedRange().slice(0));
      webgpuBuffer.unmap();
      return data;
    } else if (device.getInternalBackend().startsWith("webgl")) {
      // WebGL buffer read
      const data = new Float32Array(this.size / 4);
      device.glBindBuffer(BufferUsage.Vertex, this.buffer as WebGLBuffer);
      device.glGetBufferSubData(BufferUsage.Vertex, 0, data);
      return data;
    }

    return new Float32Array(0);
  }

  /**
   * Destroy the buffer
   */
  destroy(): void {
    if (this.buffer) {
      if (this.buffer instanceof GPUBuffer) {
        this.buffer.destroy();
      }
      this.buffer = null;
    }
    this.device.freeBuffer(this);
  }
}

/**
 * GPU texture wrapper
 */
export class GPUTexture {
  constructor(
    public texture: GPUTexture | WebGLTexture | null,
    public width: number,
    public height: number,
    public format: TextureFormat,
    public device: GPUDeviceManager
  ) {}

  /**
   * Destroy the texture
   */
  destroy(): void {
    if (this.texture) {
      if (this.texture instanceof GPUTexture) {
        this.texture.destroy();
      }
      this.texture = null;
    }
    this.device.freeTexture(this);
  }
}

/**
 * GPU compute pipeline wrapper
 */
export class GPUComputePipeline {
  constructor(
    public pipeline: GPUComputePipeline | WebGLProgram | null,
    public device: GPUDeviceManager,
    public bindGroupLayout: GPUBindGroupLayout | null
  ) {}
}

/**
 * GPU bind group wrapper
 */
export class GPUBindGroup {
  constructor(
    public bindGroup: GPUBindGroup | WebGLUniformLocation[] | null,
    public device: GPUDeviceManager
  ) {}
}

/**
 * GPU command encoder wrapper
 */
export class GPUCommandEncoderWrapper implements GPUCommandEncoder {
  public encoder?: any;

  constructor(
    public internalEncoder: any,
    public device: GPUDeviceManager
  ) {
    this.encoder = internalEncoder;
  }

  /**
   * Begin compute pass
   */
  beginComputePass?(descriptor?: any): any {
    if (this.encoder && typeof this.encoder.beginComputePass === "function") {
      return this.encoder.beginComputePass(descriptor);
    }
    return null;
  }

  /**
   * Begin render pass
   */
  beginRenderPass(descriptor: any): any {
    if (this.encoder && typeof this.encoder.beginRenderPass === "function") {
      return this.encoder.beginRenderPass(descriptor);
    }
    return null;
  }

  /**
   * Copy buffer to buffer
   */
  copyBufferToBuffer(source: WebGPUBuffer, sourceOffset: number, destination: WebGPUBuffer, destinationOffset: number, size: number): void {
    if (this.encoder && typeof this.encoder.copyBufferToBuffer === "function") {
      this.encoder.copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size);
    }
  }

  /**
   * Finish encoding commands
   */
  finish(): GPUCommandBuffer | null {
    if (this.internalEncoder && typeof this.internalEncoder === "object") {
      return this.internalEncoder.finish();
    }
    return null;
  }
}

/**
 * GPU Device Manager Class
 *
 * Manages GPU device detection, initialization, and resource management.
 */
export class GPUDeviceManager {
  private config: GPUConfig;
  private device: GPUDevice | null = null;
  private context: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private _backend: GPUBackend = "cpu";
  private info: GPUInfo | null = null;
  private allocations: Map<GPUBuffer | WebGLBuffer, MemoryAllocation> =
    new Map();
  private textures: Map<GPUTexture | WebGLTexture, number> = new Map();
  private currentMemoryUsage: number = 0;
  private pipelineCache: Map<string, GPUComputePipeline> = new Map();

  // WebGL-specific state
  private gl: any = null;
  private currentProgram: WebGLProgram | null = null;

  constructor(config: Partial<GPUConfig> = {}) {
    this.config = {
      preferred_backend: config.preferred_backend || "webgpu",
      fallback_enabled: config.fallback_enabled !== false,
      memory_limit: config.memory_limit || 512 * 1024 * 1024, // 512 MB default
      compute_mode: config.compute_mode || "float32",
      enable_profiling: config.enable_profiling || false,
    };
  }

  /**
   * Initialize GPU device
   */
  async initialize(): Promise<void> {
    // Try to initialize preferred backend
    for (const backend of this.getBackendPriority()) {
      try {
        await this.initializeBackend(backend);
        if (this.getInternalBackend() !== "cpu") {
          break;
        }
      } catch (error) {
        console.warn(`Failed to initialize ${backend}:`, error);
      }
    }

    // Collect device info
    this.info = await this.collectDeviceInfo();

    console.log(`GPU Device initialized: ${this.getInternalBackend()}`, this.info);
  }

  /**
   * Get backend priority list
   */
  private getBackendPriority(): GPUBackend[] {
    if (this.config.preferred_backend === "cpu") {
      return ["cpu"];
    }

    const priority: GPUBackend[] = [this.config.preferred_backend];

    // Add fallback options
    if (this.config.fallback_enabled) {
      if (this.config.preferred_backend !== "webgpu") {
        priority.push("webgpu");
      }
      if (this.config.preferred_backend !== "webgl2") {
        priority.push("webgl2");
      }
      if (this.config.preferred_backend !== "webgl") {
        priority.push("webgl");
      }
      priority.push("cpu");
    }

    return priority;
  }

  /**
   * Initialize specific backend
   */
  private async initializeBackend(backend: GPUBackend): Promise<void> {
    switch (backend) {
      case "webgpu":
        await this.initializeWebGPU();
        break;
      case "webgl2":
      case "webgl":
        await this.initializeWebGL(backend);
        break;
      case "cpu":
        this._backend = "cpu";
        break;
    }
  }

  /**
   * Initialize WebGPU backend
   */
  private async initializeWebGPU(): Promise<void> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      throw new Error("WebGPU not supported");
    }

    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No WebGPU adapter found");
    }

    this.device = await adapter.requestDevice();
    this._backend = "webgpu";
  }

  /**
   * Initialize WebGL backend
   */
  private async initializeWebGL(backend: "webgl2" | "webgl"): Promise<void> {
    if (typeof document === "undefined") {
      throw new Error("WebGL requires DOM environment");
    }

    const canvas = document.createElement("canvas");
    const contextType = backend === "webgl2" ? "webgl2" : "webgl";
    const gl = canvas.getContext(contextType);

    if (!gl) {
      throw new Error(`Failed to get ${contextType} context`);
    }

    this.context = gl as WebGL2RenderingContext | WebGLRenderingContext;
    this.gl = gl;
    this._backend = backend;
  }

  /**
   * Get the raw GPU device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get WebGL context
   */
  getWebGLContext(): WebGL2RenderingContext | WebGLRenderingContext | null {
    return this.context;
  }

  /**
   * Check if GPU is available
   */
  isAvailable(): boolean {
    return this._backend !== "cpu";
  }

  /**
   * Get current backend
   */
  getBackend(): GPUBackend {
    return this._backend;
  }

  /**
   * Get internal backend for internal use
   */
  getInternalBackend(): GPUBackend {
    return this._backend;
  }

  /**
   * Get device information
   */
  getInfo(): GPUInfo | null {
    return this.info;
  }

  /**
   * Get device limits
   */
  getLimits(): GPULimits {
    if (!this.info) {
      return this.getDefaultLimits();
    }
    return this.info.limits;
  }

  /**
   * Get device features
   */
  getFeatures(): string[] {
    if (!this.info) {
      return [];
    }
    return this.info.features;
  }

  /**
   * Collect device information
   */
  private async collectDeviceInfo(): Promise<GPUInfo> {
    const info: GPUInfo = {
      backend: this.getInternalBackend(),
      vendor: "Unknown",
      device: "Unknown",
      memory: 0,
      features: [],
      limits: this.getDefaultLimits(),
    };

    if (this.getInternalBackend() === "webgpu" && this.device) {
      const adapter = await (this.device as any).adapter;
      if (adapter) {
        info.vendor = (await adapter.requestAdapterInfo()).vendor || "Unknown";
        info.device = (await adapter.requestAdapterInfo()).device || "Unknown";
        info.features = this.device.features.values().toArray();
        info.limits = {
          maxBufferSize: this.device.limits.maxBufferSize,
          maxTextureSize: this.device.limits.maxTextureDimension2D,
          maxComputeWorkgroupsPerDimension:
            this.device.limits.maxComputeWorkgroupsPerDimension,
          maxInvocationsPerWorkgroup:
            this.device.limits.maxComputeInvocationsPerWorkgroup,
        };
      }
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        info.vendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        info.device = this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      info.features = ["webgl_compute_shader"];
      info.limits = {
        maxBufferSize: this.gl.getParameter(this.gl.MAX_ARRAY_BUFFER_BYTES),
        maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
        maxComputeWorkgroupsPerDimension: 0,
        maxInvocationsPerWorkgroup: 0,
      };
    }

    return info;
  }

  /**
   * Get default device limits
   */
  private getDefaultLimits(): GPULimits {
    return {
      maxBufferSize: 256 * 1024 * 1024, // 256 MB
      maxTextureSize: 4096,
      maxComputeWorkgroupsPerDimension: 65535,
      maxInvocationsPerWorkgroup: 256,
    };
  }

  // ==================== Memory Management ====================

  /**
   * Allocate GPU buffer
   */
  allocateBuffer(size: number, usage: BufferUsage): GPUBuffer {
    // Check memory limit
    if (this.currentMemoryUsage + size > this.config.memory_limit) {
      throw new Error(
        `Memory limit exceeded: ${this.currentMemoryUsage + size} / ${this.config.memory_limit}`
      );
    }

    let buffer: GPUBuffer | WebGLBuffer | null = null;

    if (this.getInternalBackend() === "webgpu" && this.device) {
      buffer = this.device.createBuffer({
        size,
        usage: this.convertBufferUsage(usage),
      });
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      buffer = this.gl.createBuffer();
    }

    const wrapper = new GPUBuffer(buffer, size, usage, this);
    this.allocations.set(buffer as GPUBuffer | WebGLBuffer, {
      buffer,
      size,
      usage,
      createdAt: Date.now(),
    });
    this.currentMemoryUsage += size;

    return wrapper;
  }

  /**
   * Allocate GPU texture
   */
  allocateTexture(
    width: number,
    height: number,
    format: TextureFormat
  ): GPUTexture {
    let texture: GPUTexture | WebGLTexture | null = null;

    if (this.getInternalBackend() === "webgpu" && this.device) {
      texture = this.device.createTexture({
        size: [width, height],
        format: format,
        usage: BufferUsage.CopySrc | BufferUsage.CopyDst,
      });
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA32F,
        width,
        height,
        0,
        this.gl.RGBA,
        this.gl.FLOAT,
        null
      );
    }

    const wrapper = new GPUTexture(texture, width, height, format, this);
    this.textures.set(texture as GPUTexture | WebGLTexture, width * height * 4);

    return wrapper;
  }

  /**
   * Free GPU buffer
   */
  freeBuffer(bufferWrapper: GPUBuffer): void {
    const buffer = bufferWrapper.buffer;
    if (!buffer) return;

    const allocation = this.allocations.get(buffer);
    if (allocation) {
      this.currentMemoryUsage -= allocation.size;
      this.allocations.delete(buffer);
    }

    if (this.getInternalBackend() === "webgpu" && buffer instanceof GPUBuffer) {
      buffer.destroy();
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      this.gl.deleteBuffer(buffer as WebGLBuffer);
    }
  }

  /**
   * Free GPU texture
   */
  freeTexture(textureWrapper: GPUTexture): void {
    const texture = textureWrapper.texture;
    if (!texture) return;

    this.textures.delete(texture as GPUTexture | WebGLTexture);

    if (this.getInternalBackend() === "webgpu" && texture instanceof GPUTexture) {
      texture.destroy();
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      this.gl.deleteTexture(texture as WebGLTexture);
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): number {
    return this.currentMemoryUsage;
  }

  /**
   * Get memory limit
   */
  getMemoryLimit(): number {
    return this.config.memory_limit;
  }

  /**
   * Clear all allocations
   */
  clearAll(): void {
    // Free all buffers
    for (const [buffer] of this.allocations) {
      if (this.getInternalBackend() === "webgpu" && buffer instanceof GPUBuffer) {
        buffer.destroy();
      } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
        this.gl.deleteBuffer(buffer as WebGLBuffer);
      }
    }
    this.allocations.clear();

    // Free all textures
    for (const [texture] of this.textures) {
      if (this.getInternalBackend() === "webgpu" && texture instanceof GPUTexture) {
        texture.destroy();
      } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
        this.gl.deleteTexture(texture as WebGLTexture);
      }
    }
    this.textures.clear();

    // Clear pipeline cache
    this.pipelineCache.clear();

    this.currentMemoryUsage = 0;
  }

  // ==================== Compute Pipeline Management ====================

  /**
   * Create compute pipeline
   */
  createComputePipeline(code: string, entryPoint: string): GPUComputePipeline {
    const cacheKey = `${entryPoint}_${hashString(code)}`;

    if (this.pipelineCache.has(cacheKey)) {
      return this.pipelineCache.get(cacheKey)!;
    }

    let pipeline: GPUComputePipeline | WebGLProgram | null = null;
    let bindGroupLayout: GPUBindGroupLayout | null = null;

    if (this.getInternalBackend() === "webgpu" && this.device) {
      const shaderModule = this.device.createShaderModule({ code });
      bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" },
          },
        ],
      });

      pipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module: shaderModule, entryPoint },
      });
    } else if (this.getInternalBackend().startsWith("webgl") && this.gl) {
      // WebGL transform feedback or compute shader
      const vertexShader = this.compileWebGLVertexShader(code);
      const fragmentShader = this.compileWebGLFragmentShader(code);

      pipeline = this.gl.createProgram();
      this.gl.attachShader(pipeline as WebGLProgram, vertexShader);
      this.gl.attachShader(pipeline as WebGLProgram, fragmentShader);
      this.gl.linkProgram(pipeline as WebGLProgram);

      if (
        !this.gl.getProgramParameter(
          pipeline as WebGLProgram,
          this.gl.LINK_STATUS
        )
      ) {
        throw new Error(
          `WebGL program link failed: ${this.gl.getProgramInfoLog(pipeline as WebGLProgram)}`
        );
      }
    }

    const wrapper = new GPUComputePipeline(pipeline, this, bindGroupLayout);
    this.pipelineCache.set(cacheKey, wrapper);

    return wrapper;
  }

  /**
   * Compile WebGL vertex shader
   */
  private compileWebGLVertexShader(code: string): WebGLShader {
    const shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(shader, code);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(
        `Vertex shader compile failed: ${this.gl.getShaderInfoLog(shader)}`
      );
    }

    return shader;
  }

  /**
   * Compile WebGL fragment shader
   */
  private compileWebGLFragmentShader(code: string): WebGLShader {
    const shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(shader, code);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(
        `Fragment shader compile failed: ${this.gl.getShaderInfoLog(shader)}`
      );
    }

    return shader;
  }

  /**
   * Create bind group
   */
  createBindGroup(
    layout: GPUBindGroupLayout,
    entries: GPUBindGroupEntry[]
  ): GPUBindGroup {
    let bindGroup: GPUBindGroup | null = null;

    if (this.getInternalBackend() === "webgpu" && this.device) {
      bindGroup = this.device.createBindGroup({
        layout,
        entries: entries.map((e, i) => ({
          binding: i,
          resource: { buffer: e.buffer as GPUBuffer },
        })),
      });
    }

    return new GPUBindGroup(bindGroup, this);
  }

  // ==================== Command Management ====================

  /**
   * Begin command encoding
   */
  beginCommands(): GPUCommandEncoder {
    let encoder: GPUCommandEncoder | null = null;

    if (this.getInternalBackend() === "webgpu" && this.device) {
      encoder = this.device.createCommandEncoder();
    }

    return new GPUCommandEncoderWrapper(encoder, this);
  }

  /**
   * Submit commands to GPU
   */
  submitCommands(commandBuffer: GPUCommandBuffer | null): void {
    if (this.getInternalBackend() === "webgpu" && this.device && commandBuffer) {
      this.device.queue.submit([commandBuffer]);
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Convert buffer usage to WebGPU flags
   */
  private convertBufferUsage(usage: BufferUsage): number {
    let flags = 0;
    if (usage & BufferUsage.Storage) flags |= GPUBufferUsage.STORAGE;
    if (usage & BufferUsage.Uniform) flags |= GPUBufferUsage.UNIFORM;
    if (usage & BufferUsage.Vertex) flags |= GPUBufferUsage.VERTEX;
    if (usage & BufferUsage.Index) flags |= GPUBufferUsage.INDEX;
    if (usage & BufferUsage.CopySrc) flags |= GPUBufferUsage.COPY_SRC;
    if (usage & BufferUsage.CopyDst) flags |= GPUBufferUsage.COPY_DST;
    if (usage & BufferUsage.MapRead) flags |= GPUBufferUsage.MAP_READ;
    if (usage & BufferUsage.MapWrite) flags |= GPUBufferUsage.MAP_WRITE;
    return flags;
  }

  /**
   * Bind WebGL buffer (helper)
   */
  glBindBuffer(target: BufferUsage, buffer: WebGLBuffer): void {
    if (this.gl) {
      const glTarget =
        target === BufferUsage.CopyDst
          ? this.gl.ARRAY_BUFFER
          : this.gl.ELEMENT_ARRAY_BUFFER;
      this.gl.bindBuffer(glTarget, buffer);
    }
  }

  /**
   * Buffer sub data for WebGL
   */
  glBufferSubData(
    target: BufferUsage,
    offset: number,
    data: Float32Array | Uint8Array
  ): void {
    if (this.gl) {
      const glTarget =
        target === BufferUsage.CopyDst
          ? this.gl.ARRAY_BUFFER
          : this.gl.ELEMENT_ARRAY_BUFFER;
      this.gl.bufferSubData(glTarget, offset, data);
    }
  }

  /**
   * Get buffer sub data for WebGL
   */
  glGetBufferSubData(
    target: BufferUsage,
    offset: number,
    data: Float32Array
  ): void {
    if (this.gl) {
      const glTarget =
        target === BufferUsage.Vertex
          ? this.gl.ARRAY_BUFFER
          : this.gl.ELEMENT_ARRAY_BUFFER;
      this.gl.getBufferSubData(glTarget, offset, data);
    }
  }

  /**
   * Destroy device and cleanup resources
   */
  destroy(): void {
    this.clearAll();
    this.device = null;
    this.context = null;
    this.gl = null;
    this._backend = "cpu";
    this.info = null;
  }
}

/**
 * String hash function for caching
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Bind group entry interface
 */
interface GPUBindGroupEntry {
  buffer: GPUBuffer | WebGLBuffer;
  offset?: number;
  size?: number;
}

/**
 * Command buffer interface
 */
interface GPUCommandBuffer {
  // Placeholder for WebGPU command buffer
}
