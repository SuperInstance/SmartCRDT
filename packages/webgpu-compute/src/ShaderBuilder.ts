/**
 * @lsi/webgpu-compute/ShaderBuilder - WGSL Shader Code Builder
 *
 * Utilities for building and composing WGSL compute shaders.
 * Provides template-based shader generation and composition.
 *
 * @version 1.0.0
 */

import type { WorkgroupSize, ComputeDataType, ShaderStage } from "./types.js";

/**
 * WGSL shader builder
 *
 * Fluent API for building WGSL compute shaders.
 */
export class ShaderBuilder {
  private bindings: ShaderBinding[] = [];
  private uniforms: ShaderUniform[] = [];
  private workgroupSize: WorkgroupSize = { x: 1, y: 1, z: 1 };
  private mainBody: string[] = [];
  private helperFunctions: string[] = [];
  private constants: ShaderConstant[] = [];
  private structs: ShaderStruct[] = [];

  /**
   * Add buffer binding
   *
   * @param binding - Binding index
   * @param name - Variable name
   * @param type - Buffer type
   * @param access - Access type
   * @returns This builder for chaining
   */
  addBuffer(
    binding: number,
    name: string,
    type: "array<f32>" | "array<u32>" | "array<i32>" | string,
    access: "read" | "read_write" | "uniform"
  ): this {
    const storage = access === "uniform" ? "uniform" : `storage, ${access}`;
    this.bindings.push({
      binding,
      name,
      type: `${storage} ${name}: array<f32>`,
      access,
    });
    return this;
  }

  /**
   * Add uniform buffer
   *
   * @param binding - Binding index
   * @param name - Variable name
   * @param structType - Struct type name
   * @returns This builder for chaining
   */
  addUniform(binding: number, name: string, structType: string): this {
    this.bindings.push({
      binding,
      name,
      type: `uniform ${name}: ${structType}`,
      access: "uniform",
    });
    return this;
  }

  /**
   * Add struct definition
   *
   * @param name - Struct name
   * @param fields - Struct fields
   * @returns This builder for chaining
   */
  addStruct(name: string, fields: Array<{ name: string; type: string }>): this {
    this.structs.push({
      name,
      fields: fields.map(f => `${f.name}: ${f.type}`).join(",\n  "),
    });
    return this;
  }

  /**
   * Add constant
   *
   * @param name - Constant name
   * @param value - Constant value
   * @param type - Value type
   * @returns This builder for chaining
   */
  addConstant(
    name: string,
    value: number | string,
    type: string = "f32"
  ): this {
    this.constants.push({ name, value: String(value), type });
    return this;
  }

  /**
   * Set workgroup size
   *
   * @param size - Workgroup size
   * @returns This builder for chaining
   */
  setWorkgroupSize(size: WorkgroupSize): this {
    this.workgroupSize = size;
    return this;
  }

  /**
   * Add code to main function
   *
   * @param code - Code to add
   * @returns This builder for chaining
   */
  addMain(code: string): this {
    this.mainBody.push(code);
    return this;
  }

  /**
   * Add helper function
   *
   * @param name - Function name
   * @param params - Function parameters
   * @param returnType - Return type
   * @param body - Function body
   * @returns This builder for chaining
   */
  addHelper(
    name: string,
    params: Array<{ name: string; type: string }>,
    returnType: string,
    body: string
  ): this {
    const paramStr = params.map(p => `${p.name}: ${p.type}`).join(", ");
    this.helperFunctions.push(
      `fn ${name}(${paramStr}) -> ${returnType} {\n  ${body}\n}`
    );
    return this;
  }

  /**
   * Add for loop
   *
   * @param variable - Loop variable name
   * @param start - Start value
   * @param end - End value
   * @param body - Loop body
   * @returns This builder for chaining
   */
  addForLoop(variable: string, start: number, end: number, body: string): this {
    const loopCode = `for (var ${variable}: u32 = ${start}u; ${variable} < ${end}u; ${variable} = ${variable} + 1u) {\n    ${body}\n  }`;
    this.mainBody.push(loopCode);
    return this;
  }

  /**
   * Add if statement
   *
   * @param condition - Condition expression
   * @param body - If body
   * @param elseBody - Optional else body
   * @returns This builder for chaining
   */
  addIf(condition: string, body: string, elseBody?: string): this {
    const ifCode = elseBody
      ? `if (${condition}) {\n    ${body}\n  } else {\n    ${elseBody}\n  }`
      : `if (${condition}) {\n    ${body}\n  }`;
    this.mainBody.push(ifCode);
    return this;
  }

  /**
   * Add boundary check
   *
   * @param variable - Variable to check
   * @param size - Size to check against
   * @returns This builder for chaining
   */
  addBoundaryCheck(variable: string, size: number): this {
    return this.addIf(`${variable} >= ${size}u`, "return;");
  }

  /**
   * Build the shader code
   *
   * @returns Complete WGSL shader code
   */
  build(): string {
    const lines: string[] = [];

    // Add structs
    for (const struct of this.structs) {
      lines.push(`struct ${struct.name} {\n  ${struct.fields}\n};`);
    }

    // Add bindings
    for (const binding of this.bindings) {
      lines.push(
        `@group(0) @binding(${binding.binding}) var<${binding.access}> ${binding.name};`
      );
    }

    // Add constants
    for (const constant of this.constants) {
      lines.push(
        `const ${constant.name}: ${constant.type} = ${constant.value};`
      );
    }

    // Add helper functions
    lines.push(...this.helperFunctions);

    // Add main compute function
    const { x: wgX, y: wgY, z: wgZ } = this.workgroupSize;
    lines.push(`@compute @workgroup_size(${wgX}u, ${wgY}u, ${wgZ}u)`);
    lines.push(
      "fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {"
    );
    lines.push("  " + this.mainBody.join("\n  "));
    lines.push("}");

    return lines.join("\n");
  }

  /**
   * Build with custom entry point
   *
   * @param entryPoint - Custom entry point name
   * @returns Complete WGSL shader code
   */
  buildWithEntryPoint(entryPoint: string): string {
    const code = this.build();
    return code.replace("fn main(", `fn ${entryPoint}(`);
  }

  /**
   * Reset builder to initial state
   */
  reset(): void {
    this.bindings = [];
    this.uniforms = [];
    this.workgroupSize = { x: 1, y: 1, z: 1 };
    this.mainBody = [];
    this.helperFunctions = [];
    this.constants = [];
    this.structs = [];
  }

  /**
   * Clone this builder
   *
   * @returns New builder with same configuration
   */
  clone(): ShaderBuilder {
    const cloned = new ShaderBuilder();
    cloned.bindings = [...this.bindings];
    cloned.uniforms = [...this.uniforms];
    cloned.workgroupSize = { ...this.workgroupSize };
    cloned.mainBody = [...this.mainBody];
    cloned.helperFunctions = [...this.helperFunctions];
    cloned.constants = [...this.constants];
    cloned.structs = [...this.structs];
    return cloned;
  }
}

/**
 * Shader binding interface
 */
interface ShaderBinding {
  binding: number;
  name: string;
  type: string;
  access: string;
}

/**
 * Shader uniform interface
 */
interface ShaderUniform {
  name: string;
  type: string;
  value: number | string;
}

/**
 * Shader constant interface
 */
interface ShaderConstant {
  name: string;
  value: string;
  type: string;
}

/**
 * Shader struct interface
 */
interface ShaderStruct {
  name: string;
  fields: string;
}

/**
 * Create a simple element-wise operation shader
 *
 * @param operation - Operation to perform
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function createElementwiseShader(
  operation: "add" | "sub" | "mul" | "div" | "max" | "min",
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const builder = new ShaderBuilder();

  builder
    .addBuffer(0, "input1", "array<f32>", "read")
    .addBuffer(1, "input2", "array<f32>", "read")
    .addBuffer(2, "output", "array<f32>", "read_write")
    .setWorkgroupSize(workgroupSize)
    .addBoundaryCheck("global_id.x", size);

  const opCode = {
    add: "output[idx] = input1[idx] + input2[idx];",
    sub: "output[idx] = input1[idx] - input2[idx];",
    mul: "output[idx] = input1[idx] * input2[idx];",
    div: "output[idx] = input1[idx] / input2[idx];",
    max: "output[idx] = max(input1[idx], input2[idx]);",
    min: "output[idx] = min(input1[idx], input2[idx]);",
  }[operation];

  builder.addMain("let idx = global_id.x;");
  builder.addMain(opCode);

  return builder.build();
}

/**
 * Create a map shader (apply function to each element)
 *
 * @param functionBody - Function body to apply
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function createMapShader(
  functionBody: string,
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const builder = new ShaderBuilder();

  builder
    .addBuffer(0, "input", "array<f32>", "read")
    .addBuffer(1, "output", "array<f32>", "read_write")
    .setWorkgroupSize(workgroupSize)
    .addBoundaryCheck("global_id.x", size)
    .addMain("let idx = global_id.x;")
    .addMain("let x = input[idx];")
    .addMain(`output[idx] = ${functionBody};`);

  return builder.build();
}

/**
 * Create a reduce shader (reduce array to single value)
 *
 * @param operation - Reduction operation
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function createReduceShader(
  operation: "sum" | "min" | "max" | "prod",
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const builder = new ShaderBuilder();
  const { x: wgX } = workgroupSize;

  builder
    .addBuffer(0, "input", "array<f32>", "read")
    .addBuffer(1, "output", "array<f32>", "read_write")
    .setWorkgroupSize(workgroupSize);

  // Add shared memory for tree reduction
  builder.addMain("var<workgroup> shared_data: array<f32, 256u>;");
  builder.addMain("let local_idx = local_invocation_id.x;");
  builder.addMain("let global_idx = global_id.x;");

  // Load data into shared memory
  builder.addMain(
    "let value = select(0.0, input[global_idx], global_idx < size);"
  );
  builder.addMain("shared_data[local_idx] = value;");
  builder.addMain("workgroupBarrier();");

  // Tree reduction
  const identity = {
    sum: "0.0",
    min: "1e9",
    max: "-1e9",
    prod: "1.0",
  }[operation];

  const op = {
    sum: "shared_data[local_idx] + shared_data[local_idx + stride]",
    min: "min(shared_data[local_idx], shared_data[local_idx + stride])",
    max: "max(shared_data[local_idx], shared_data[local_idx + stride])",
    prod: "shared_data[local_idx] * shared_data[local_idx + stride]",
  }[operation];

  builder.addForLoop(
    "stride",
    wgX / 2,
    0,
    "if (local_idx < stride) { shared_data[local_idx] = " + op + "; }"
  );
  builder.addMain("workgroupBarrier();");
  builder.addMain(
    "if (local_idx == 0u) { output[global_id.x / 256u] = shared_data[0u]; }"
  );

  // Replace 'size' with actual value
  return builder.build().replace(/size/g, String(size));
}

/**
 * Create a stencil shader (apply operation with neighbors)
 *
 * @param operation - Stencil operation to apply
 * @param dimensions - Array dimensions
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function createStencilShader(
  operation: string,
  dimensions: number[],
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const builder = new ShaderBuilder();

  builder
    .addBuffer(0, "input", "array<f32>", "read")
    .addBuffer(1, "output", "array<f32>", "read_write")
    .setWorkgroupSize(workgroupSize);

  const [height, width] = dimensions;

  builder.addMain("let x = i32(global_id.x);");
  builder.addMain("let y = i32(global_id.y);");
  builder.addIf("x < 0 || x >= width || y < 0 || y >= height", "return;");
  builder.addMain("let idx = u32(y * width + x);");
  builder.addMain(operation);

  return builder
    .build()
    .replace(/width/g, String(width))
    .replace(/height/g, String(height));
}

/**
 * Compose multiple shaders into one
 *
 * @param shaders - Shaders to compose
 * @param separator - Separator between shaders
 * @returns Composed shader code
 */
export function composeShaders(
  shaders: string[],
  separator: string = "\n\n"
): string {
  return shaders.join(separator);
}

/**
 * Optimize shader code
 *
 * Performs basic optimizations on WGSL code.
 *
 * @param code - Input shader code
 * @returns Optimized shader code
 */
export function optimizeShader(code: string): string {
  let optimized = code;

  // Remove unnecessary whitespace
  optimized = optimized.replace(/\n\s*\n\s*\n/g, "\n\n");

  // Remove comments (optional - can keep for debugging)
  // optimized = optimized.replace(/\/\/.*$/gm, '');

  return optimized;
}

/**
 * Validate shader syntax
 *
 * Performs basic syntax validation on WGSL code.
 *
 * @param code - Shader code to validate
 * @returns Validation result
 */
export function validateShader(code: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for balanced braces
  let braceCount = 0;
  for (const char of code) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
  }
  if (braceCount !== 0) {
    errors.push(
      `Unbalanced braces: ${braceCount > 0 ? "missing closing braces" : "extra closing braces"}`
    );
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of code) {
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
  }
  if (parenCount !== 0) {
    errors.push(
      `Unbalanced parentheses: ${parenCount > 0 ? "missing closing" : "extra closing"}`
    );
  }

  // Check for required functions
  if (!code.includes("fn main(") && !code.includes("@compute")) {
    errors.push("Missing main compute function");
  }

  // Check for workgroup size
  if (!code.includes("@workgroup_size")) {
    errors.push("Missing @workgroup_size attribute");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Shader template system
 */
export class ShaderTemplate {
  private templates: Map<string, string> = new Map();

  /**
   * Register a shader template
   *
   * @param name - Template name
   * @param template - Template string with {{placeholder}} syntax
   */
  register(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Render a template with given parameters
   *
   * @param name - Template name
   * @param params - Parameters to substitute
   * @returns Rendered shader code
   */
  render(name: string, params: Record<string, string | number>): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    let rendered = template;
    for (const [key, value] of Object.entries(params)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }

    return rendered;
  }

  /**
   * Check if template exists
   *
   * @param name - Template name
   * @returns Whether template exists
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Get all template names
   *
   * @returns Array of template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }
}

/**
 * Create default shader templates
 *
 * @returns Pre-configured shader template system
 */
export function createDefaultTemplates(): ShaderTemplate {
  const templates = new ShaderTemplate();

  // Matrix multiplication template
  templates.register(
    "matmul",
    `
@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let col = global_id.y;

  if (row >= {{M}}u || col >= {{N}}u) {
    return;
  }

  var sum: f32 = 0.0;
  for (var k: u32 = 0u; k < {{K}}u; k = k + 1u) {
    sum = sum + A[row * {{K}}u + k] * B[k * {{N}}u + col];
  }

  C[row * {{N}}u + col] = sum;
}
`
  );

  // Element-wise operation template
  templates.register(
    "elementwise",
    `
@group(0) @binding(0) var<storage, read> input1: array<f32>;
@group(0) @binding(1) var<storage, read> input2: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({{wgX}}u)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= {{size}}u) {
    return;
  }

  output[idx] = input1[idx] {{op}} input2[idx];
}
`
  );

  return templates;
}
