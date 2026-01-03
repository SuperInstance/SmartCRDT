/**
 * @lsi/webgpu-compute/ShaderBuilder test suite
 *
 * Tests for shader builder and code generation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  ShaderBuilder,
  ShaderTemplate,
  createElementwiseShader,
  createMapShader,
  createReduceShader,
  composeShaders,
  optimizeShader,
  validateShader,
  createDefaultTemplates,
} from '../src/ShaderBuilder.js';

describe('ShaderBuilder', () => {
  describe('constructor', () => {
    it('should create empty builder', () => {
      const builder = new ShaderBuilder();
      expect(builder).toBeDefined();
    });
  });

  describe('addBuffer', () => {
    it('should add storage buffer', () => {
      const builder = new ShaderBuilder();
      builder.addBuffer(0, 'input', 'array<f32>', 'read');

      const shader = builder.build();
      expect(shader).toContain('@group(0) @binding(0)');
      expect(shader).toContain('var<storage, read> input: array<f32>');
    });

    it('should add read_write buffer', () => {
      const builder = new ShaderBuilder();
      builder.addBuffer(0, 'output', 'array<f32>', 'read_write');

      const shader = builder.build();
      expect(shader).toContain('var<storage, read_write> output: array<f32>');
    });

    it('should add uniform buffer', () => {
      const builder = new ShaderBuilder();
      builder.addBuffer(0, 'params', 'array<f32>', 'uniform');

      const shader = builder.build();
      expect(shader).toContain('var<uniform> params: array<f32>');
    });

    it('should support chaining', () => {
      const builder = new ShaderBuilder();
      builder
        .addBuffer(0, 'input1', 'array<f32>', 'read')
        .addBuffer(1, 'input2', 'array<f32>', 'read')
        .addBuffer(2, 'output', 'array<f32>', 'read_write');

      const shader = builder.build();
      expect(shader).toContain('@group(0) @binding(0)');
      expect(shader).toContain('@group(0) @binding(1)');
      expect(shader).toContain('@group(0) @binding(2)');
    });
  });

  describe('addStruct', () => {
    it('should add struct definition', () => {
      const builder = new ShaderBuilder();
      builder.addStruct('MyStruct', [
        { name: 'value', type: 'f32' },
        { name: 'index', type: 'u32' },
      ]);

      const shader = builder.build();
      expect(shader).toContain('struct MyStruct {');
      expect(shader).toContain('value: f32');
      expect(shader).toContain('index: u32');
      expect(shader).toContain('};');
    });
  });

  describe('addConstant', () => {
    it('should add constant', () => {
      const builder = new ShaderBuilder();
      builder.addConstant('PI', 3.14159, 'f32');

      const shader = builder.build();
      expect(shader).toContain('const PI: f32 = 3.14159;');
    });

    it('should add integer constant', () => {
      const builder = new ShaderBuilder();
      builder.addConstant('MAX_SIZE', 1024, 'u32');

      const shader = builder.build();
      expect(shader).toContain('const MAX_SIZE: u32 = 1024;');
    });
  });

  describe('setWorkgroupSize', () => {
    it('should set 1D workgroup size', () => {
      const builder = new ShaderBuilder();
      builder.setWorkgroupSize({ x: 256 });

      const shader = builder.build();
      expect(shader).toContain('@workgroup_size(256u');
    });

    it('should set 2D workgroup size', () => {
      const builder = new ShaderBuilder();
      builder.setWorkgroupSize({ x: 16, y: 16 });

      const shader = builder.build();
      expect(shader).toContain('@workgroup_size(16u, 16u');
    });

    it('should set 3D workgroup size', () => {
      const builder = new ShaderBuilder();
      builder.setWorkgroupSize({ x: 16, y: 16, z: 1 });

      const shader = builder.build();
      expect(shader).toContain('@workgroup_size(16u, 16u, 1u)');
    });
  });

  describe('addMain', () => {
    it('should add code to main function', () => {
      const builder = new ShaderBuilder();
      builder.addMain('let idx = global_id.x;');
      builder.addMain('output[idx] = input[idx] * 2.0;');

      const shader = builder.build();
      expect(shader).toContain('let idx = global_id.x;');
      expect(shader).toContain('output[idx] = input[idx] * 2.0;');
    });
  });

  describe('addForLoop', () => {
    it('should add for loop', () => {
      const builder = new ShaderBuilder();
      builder.addForLoop('i', 0, 10, 'sum = sum + input[i];');

      const shader = builder.build();
      expect(shader).toContain('for (var i: u32 = 0u; i < 10u; i = i + 1u)');
      expect(shader).toContain('sum = sum + input[i];');
    });
  });

  describe('addIf', () => {
    it('should add if statement', () => {
      const builder = new ShaderBuilder();
      builder.addIf('idx >= 100u', 'return;');

      const shader = builder.build();
      expect(shader).toContain('if (idx >= 100u)');
      expect(shader).toContain('return;');
    });

    it('should add if-else statement', () => {
      const builder = new ShaderBuilder();
      builder.addIf('x > 0.0', 'output[idx] = x;', 'output[idx] = 0.0;');

      const shader = builder.build();
      expect(shader).toContain('if (x > 0.0)');
      expect(shader).toContain('output[idx] = x;');
      expect(shader).toContain('else');
      expect(shader).toContain('output[idx] = 0.0;');
    });
  });

  describe('addBoundaryCheck', () => {
    it('should add boundary check', () => {
      const builder = new ShaderBuilder();
      builder.addBoundaryCheck('global_id.x', 1024);

      const shader = builder.build();
      expect(shader).toContain('if (global_id.x >= 1024u)');
      expect(shader).toContain('return;');
    });
  });

  describe('addHelper', () => {
    it('should add helper function', () => {
      const builder = new ShaderBuilder();
      builder.addHelper(
        'square',
        [{ name: 'x', type: 'f32' }],
        'f32',
        'return x * x;'
      );

      const shader = builder.build();
      expect(shader).toContain('fn square(x: f32) -> f32');
      expect(shader).toContain('return x * x;');
    });
  });

  describe('build', () => {
    it('should build complete shader', () => {
      const builder = new ShaderBuilder();
      builder
        .addBuffer(0, 'input', 'array<f32>', 'read')
        .addBuffer(1, 'output', 'array<f32>', 'read_write')
        .setWorkgroupSize({ x: 256 })
        .addBoundaryCheck('global_id.x', 1024)
        .addMain('let idx = global_id.x;')
        .addMain('output[idx] = input[idx] * 2.0;');

      const shader = builder.build();
      expect(shader).toContain('@group(0) @binding(0)');
      expect(shader).toContain('var<storage, read> input: array<f32>');
      expect(shader).toContain('var<storage, read_write> output: array<f32>');
      expect(shader).toContain('@compute @workgroup_size(256u)');
      expect(shader).toContain('fn main(@builtin(global_invocation_id)');
      expect(shader).toContain('let idx = global_id.x;');
      expect(shader).toContain('output[idx] = input[idx] * 2.0;');
    });

    it('should include helper functions', () => {
      const builder = new ShaderBuilder();
      builder
        .addHelper('test', [], 'f32', 'return 1.0;')
        .addMain('let x = test();');

      const shader = builder.build();
      expect(shader).toContain('fn test() -> f32');
      expect(shader).toContain('return 1.0;');
      expect(shader).toContain('let x = test();');
    });
  });

  describe('buildWithEntryPoint', () => {
    it('should build with custom entry point', () => {
      const builder = new ShaderBuilder();
      builder.addMain('let idx = global_id.x;');

      const shader = builder.buildWithEntryPoint('compute_main');
      expect(shader).toContain('fn compute_main(');
      expect(shader).not.toContain('fn main(');
    });
  });

  describe('reset', () => {
    it('should reset builder to initial state', () => {
      const builder = new ShaderBuilder();
      builder.addBuffer(0, 'input', 'array<f32>', 'read');
      builder.addMain('let idx = global_id.x;');

      let shader = builder.build();
      expect(shader).toContain('var<storage, read> input: array<f32>');

      builder.reset();
      shader = builder.build();
      expect(shader).not.toContain('var<storage, read> input: array<f32>');
    });
  });

  describe('clone', () => {
    it('should clone builder', () => {
      const builder = new ShaderBuilder();
      builder.addBuffer(0, 'input', 'array<f32>', 'read');
      builder.addMain('let idx = global_id.x;');

      const cloned = builder.clone();
      cloned.addBuffer(1, 'output', 'array<f32>', 'read_write');
      cloned.addMain('output[idx] = input[idx];');

      const originalShader = builder.build();
      const clonedShader = cloned.build();

      expect(originalShader).not.toContain('var<storage, read_write> output');
      expect(clonedShader).toContain('var<storage, read_write> output');
    });
  });
});

describe('createElementwiseShader', () => {
  it('should create addition shader', () => {
    const shader = createElementwiseShader('add', 1024);
    expect(shader).toContain('output[idx] = input1[idx] + input2[idx]');
  });

  it('should create subtraction shader', () => {
    const shader = createElementwiseShader('sub', 1024);
    expect(shader).toContain('output[idx] = input1[idx] - input2[idx]');
  });

  it('should create multiplication shader', () => {
    const shader = createElementwiseShader('mul', 1024);
    expect(shader).toContain('output[idx] = input1[idx] * input2[idx]');
  });

  it('should create division shader', () => {
    const shader = createElementwiseShader('div', 1024);
    expect(shader).toContain('output[idx] = input1[idx] / input2[idx]');
  });

  it('should create max shader', () => {
    const shader = createElementwiseShader('max', 1024);
    expect(shader).toContain('output[idx] = max(input1[idx], input2[idx])');
  });

  it('should create min shader', () => {
    const shader = createElementwiseShader('min', 1024);
    expect(shader).toContain('output[idx] = min(input1[idx], input2[idx])');
  });
});

describe('createMapShader', () => {
  it('should create map shader with function', () => {
    const shader = createMapShader('x * 2.0', 1024);
    expect(shader).toContain('output[idx] = x * 2.0');
  });

  it('should create map shader with complex function', () => {
    const shader = createMapShader('sqrt(abs(x))', 1024);
    expect(shader).toContain('output[idx] = sqrt(abs(x))');
  });
});

describe('createReduceShader', () => {
  it('should create sum reduction shader', () => {
    const shader = createReduceShader('sum', 1024);
    expect(shader).toContain('shared_data[local_idx] + shared_data[local_idx + stride]');
  });

  it('should create min reduction shader', () => {
    const shader = createReduceShader('min', 1024);
    expect(shader).toContain('min(shared_data[local_idx], shared_data[local_idx + stride])');
  });

  it('should create max reduction shader', () => {
    const shader = createReduceShader('max', 1024);
    expect(shader).toContain('max(shared_data[local_idx], shared_data[local_idx + stride])');
  });

  it('should create product reduction shader', () => {
    const shader = createReduceShader('prod', 1024);
    expect(shader).toContain('shared_data[local_idx] * shared_data[local_idx + stride]');
  });
});

describe('composeShaders', () => {
  it('should compose multiple shaders', () => {
    const shader1 = '@group(0) @binding(0) var<storage, read> input: array<f32>;';
    const shader2 = '@compute @workgroup_size(256u)\nfn main() {}';

    const composed = composeShaders([shader1, shader2]);
    expect(composed).toContain(shader1);
    expect(composed).toContain(shader2);
  });

  it('should use custom separator', () => {
    const shader1 = 'fn helper1() {}';
    const shader2 = 'fn helper2() {}';

    const composed = composeShaders([shader1, shader2], '\n/// SEPARATOR ///\n');
    expect(composed).toContain('/// SEPARATOR ///');
  });
});

describe('optimizeShader', () => {
  it('should remove extra whitespace', () => {
    const input = `
fn main() {


    let x = 1.0;


}
`;
    const optimized = optimizeShader(input);
    expect(optimized).not.toContain('\n\n\n');
  });
});

describe('validateShader', () => {
  it('should validate correct shader', () => {
    const shader = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@compute @workgroup_size(256u)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= 1024u) { return; }
}
`;

    const result = validateShader(shader);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect unbalanced braces', () => {
    const shader = `
fn main() {
  let x = 1.0;
`;

    const result = validateShader(shader);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('braces');
  });

  it('should detect unbalanced parentheses', () => {
    const shader = `
fn main() {
  let x = (1.0 + 2.0;
}
`;

    const result = validateShader(shader);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('parentheses'))).toBe(true);
  });

  it('should detect missing main function', () => {
    const shader = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@compute @workgroup_size(256u)
fn other(@builtin(global_invocation_id) global_id: vec3<u32>) {}
`;

    const result = validateShader(shader);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('main'))).toBe(true);
  });

  it('should detect missing workgroup_size', () => {
    const shader = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {}
`;

    const result = validateShader(shader);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('workgroup_size'))).toBe(true);
  });
});

describe('ShaderTemplate', () => {
  describe('constructor', () => {
    it('should create empty template', () => {
      const template = new ShaderTemplate();
      expect(template).toBeDefined();
    });
  });

  describe('register', () => {
    it('should register template', () => {
      const template = new ShaderTemplate();
      template.register('test', 'const {{NAME}}: f32 = {{VALUE}};');

      expect(template.has('test')).toBe(true);
    });
  });

  describe('render', () => {
    it('should render template with params', () => {
      const template = new ShaderTemplate();
      template.register('test', 'const {{NAME}}: f32 = {{VALUE}};');

      const rendered = template.render('test', { NAME: 'PI', VALUE: 3.14159 });
      expect(rendered).toContain('const PI: f32 = 3.14159;');
    });

    it('should handle multiple replacements', () => {
      const template = new ShaderTemplate();
      template.register('matmul', `
@group(0) @binding({{BINDING}}) var<storage, read> {{NAME}}: array<f32>;
const {{SIZE}}: u32 = {{VALUE}}u;
`);

      const rendered = template.render('matmul', {
        BINDING: 0,
        NAME: 'input',
        SIZE: 'N',
        VALUE: 768
      });

      expect(rendered).toContain('@group(0) @binding(0)');
      expect(rendered).toContain('var<storage, read> input: array<f32>');
      expect(rendered).toContain('const N: u32 = 768u;');
    });

    it('should throw error for unknown template', () => {
      const template = new ShaderTemplate();

      expect(() => template.render('unknown', {})).toThrow('Template not found');
    });
  });

  describe('has', () => {
    it('should check if template exists', () => {
      const template = new ShaderTemplate();
      template.register('test', 'test');

      expect(template.has('test')).toBe(true);
      expect(template.has('unknown')).toBe(false);
    });
  });

  describe('getTemplateNames', () => {
    it('should return all template names', () => {
      const template = new ShaderTemplate();
      template.register('template1', 'test1');
      template.register('template2', 'test2');

      const names = template.getTemplateNames();
      expect(names).toContain('template1');
      expect(names).toContain('template2');
      expect(names.length).toBe(2);
    });
  });
});

describe('createDefaultTemplates', () => {
  it('should create templates with common operations', () => {
    const templates = createDefaultTemplates();

    expect(templates.has('matmul')).toBe(true);
    expect(templates.has('elementwise')).toBe(true);
  });

  it('should render matmul template', () => {
    const templates = createDefaultTemplates();

    const rendered = templates.render('matmul', { M: 64, K: 64, N: 64 });
    expect(rendered).toContain('64u');
    expect(rendered).toContain('A[row * 64u + k]');
  });

  it('should render elementwise template', () => {
    const templates = createDefaultTemplates();

    const rendered = templates.render('elementwise', { size: 1024, wgX: 256, op: '+' });
    expect(rendered).toContain('1024u');
    expect(rendered).toContain('256u');
    expect(rendered).toContain('output[idx] = input1[idx] + input2[idx]');
  });
});

describe('Shader Builder Complex Scenarios', () => {
  it('should build complex matrix shader', () => {
    const builder = new ShaderBuilder();

    builder
      .addStruct('MatrixParams', [
        { name: 'M', type: 'u32' },
        { name: 'N', type: 'u32' },
        { name: 'K', type: 'u32' },
      ])
      .addBuffer(0, 'params', 'MatrixParams', 'uniform')
      .addBuffer(1, 'A', 'array<f32>', 'read')
      .addBuffer(2, 'B', 'array<f32>', 'read')
      .addBuffer(3, 'C', 'array<f32>', 'read_write')
      .addConstant('TILE_SIZE', 16, 'u32')
      .setWorkgroupSize({ x: 16, y: 16, z: 1 })
      .addHelper('getRowIndex', [{ name: 'global_id', type: 'vec3<u32>' }], 'u32', 'return global_id.x;')
      .addBoundaryCheck('global_id.x', 1024)
      .addMain('let row = getRowIndex(global_id);')
      .addMain('let col = global_id.y;')
      .addForLoop('k', 0, 64, 'sum = sum + A[row * 64u + k] * B[k * 64u + col];');

    const shader = builder.build();

    expect(shader).toContain('struct MatrixParams');
    expect(shader).toContain('M: u32');
    expect(shader).toContain('const TILE_SIZE: u32 = 16u;');
    expect(shader).toContain('fn getRowIndex(global_id: vec3<u32>) -> u32');
    expect(shader).toContain('for (var k: u32 = 0u; k < 64u; k = k + 1u)');
  });

  it('should build neural network layer shader', () => {
    const builder = new ShaderBuilder();

    builder
      .addBuffer(0, 'input', 'array<f32>', 'read')
      .addBuffer(1, 'weights', 'array<f32>', 'read')
      .addBuffer(2, 'bias', 'array<f32>', 'read')
      .addBuffer(3, 'output', 'array<f32>', 'read_write')
      .setWorkgroupSize({ x: 256 })
      .addBoundaryCheck('global_id.x', 768)
      .addMain('let idx = global_id.x;')
      .addMain('var sum: f32 = 0.0;')
      .addForLoop('i', 0, 768, 'sum = sum + input[i] * weights[i * 768u + idx];')
      .addMain('let activated = sum + bias[idx];')
      .addIf('activated < 0.0', 'activated = 0.0;')
      .addMain('output[idx] = activated;');

    const shader = builder.build();

    expect(shader).toContain('var sum: f32 = 0.0;');
    expect(shader).toContain('weights[i * 768u + idx]');
    expect(shader).toContain('let activated = sum + bias[idx];');
    expect(shader).toContain('if (activated < 0.0)');
    expect(shader).toContain('activated = 0.0;');
  });
});

describe('Edge Cases', () => {
  it('should handle empty builder', () => {
    const builder = new ShaderBuilder();
    const shader = builder.build();

    expect(shader).toContain('@compute @workgroup_size(1u, 1u, 1u)');
    expect(shader).toContain('fn main(@builtin(global_invocation_id) global_id: vec3<u32>)');
  });

  it('should handle only buffers', () => {
    const builder = new ShaderBuilder();
    builder
      .addBuffer(0, 'input', 'array<f32>', 'read')
      .addBuffer(1, 'output', 'array<f32>', 'read_write');

    const shader = builder.build();
    expect(shader).toContain('var<storage, read> input');
    expect(shader).toContain('var<storage, read_write> output');
  });

  it('should handle only main code', () => {
    const builder = new ShaderBuilder();
    builder.addMain('let idx = global_id.x;');
    builder.addMain('output[idx] = 0.0;');

    const shader = builder.build();
    expect(shader).toContain('let idx = global_id.x;');
    expect(shader).toContain('output[idx] = 0.0;');
  });

  it('should handle only helper functions', () => {
    const builder = new ShaderBuilder();
    builder.addHelper('test1', [], 'f32', 'return 1.0;');
    builder.addHelper('test2', [{ name: 'x', type: 'f32' }], 'f32', 'return x * 2.0;');

    const shader = builder.build();
    expect(shader).toContain('fn test1() -> f32');
    expect(shader).toContain('fn test2(x: f32) -> f32');
  });
});
